// api/customer/order-track.js
// Edge Function for Vercel Deployment

export const config = {
  runtime: 'edge',
  regions: ['iad1', 'sfo1', 'fra1', 'sin1'],
};

// Helper function to create Supabase client in Edge environment
function createSupabaseClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  
  if (!supabaseUrl || !supabaseKey) {
    throw new Error('Missing Supabase environment variables');
  }
  
  return {
    from: (table) => ({
      select: (columns) => {
        let url = `${supabaseUrl}/rest/v1/${table}`;
        if (columns && columns !== '*') {
          url += `?select=${columns}`;
        }
        
        return {
          eq: (field, value) => ({
            single: async () => {
              const finalUrl = `${url}&${field}=eq.${value}`;
              const response = await fetch(finalUrl, {
                headers: {
                  'apikey': supabaseKey,
                  'Authorization': `Bearer ${supabaseKey}`,
                },
              });
              const data = await response.json();
              return { data: data[0] || null, error: null };
            },
            order: (orderField, { ascending }) => ({
              select: async () => {
                const sortOrder = ascending ? 'asc' : 'desc';
                const finalUrl = `${url}&${field}=eq.${value}&order=${orderField}.${sortOrder}`;
                const response = await fetch(finalUrl, {
                  headers: {
                    'apikey': supabaseKey,
                    'Authorization': `Bearer ${supabaseKey}`,
                  },
                });
                const data = await response.json();
                return { data, error: null };
              }
            })
          })
        };
      },
      fromWithJoin: (table, selectColumns) => {
        let url = `${supabaseUrl}/rest/v1/${table}?select=${selectColumns}`;
        
        return {
          eq: (field, value) => ({
            single: async () => {
              const finalUrl = `${url}&${field}=eq.${value}`;
              const response = await fetch(finalUrl, {
                headers: {
                  'apikey': supabaseKey,
                  'Authorization': `Bearer ${supabaseKey}`,
                },
              });
              const data = await response.json();
              return { data: data[0] || null, error: null };
            }
          })
        };
      }
    })
  };
}

export default async function handler(request) {
  // CORS Headers
  const corsHeaders = {
    'Access-Control-Allow-Credentials': 'true',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, OPTIONS',
    'Access-Control-Allow-Headers': 'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version, Authorization',
  };

  // Handle OPTIONS preflight
  if (request.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: corsHeaders });
  }

  // Only allow GET
  if (request.method !== 'GET') {
    return new Response(
      JSON.stringify({ success: false, error: 'Method not allowed' }),
      { status: 405, headers: { 'Content-Type': 'application/json', ...corsHeaders } }
    );
  }

  try {
    const supabase = createSupabaseClient();
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

    const url = new URL(request.url);
    const book_id = url.searchParams.get('book_id');
    const tracking_id = url.searchParams.get('tracking_id');
    const cust_id = url.searchParams.get('cust_id');

    if (!book_id && !tracking_id) {
      return new Response(
        JSON.stringify({ success: false, error: 'Order ID (book_id) or Tracking ID (tracking_id) is required' }),
        { status: 400, headers: { 'Content-Type': 'application/json', ...corsHeaders } }
      );
    }

    // Find order by book_id or tracking_id with nested joins
    let orderSelect = `*,
      order_items (
        item_id,
        quantity,
        price_at_time,
        products!inner (
          prod_id,
          name,
          description,
          images,
          mrp,
          selling_price
        )
      ),
      sellers (
        seller_id,
        shop_name,
        mobile as seller_mobile,
        rating as seller_rating
      ),
      riders (
        rider_id,
        name as rider_name,
        mobile as rider_mobile,
        rating as rider_rating,
        current_location
      )`;

    let orderUrl;
    if (book_id) {
      orderUrl = `${supabaseUrl}/rest/v1/orders?select=${encodeURIComponent(orderSelect)}&book_id=eq.${book_id}`;
    } else {
      orderUrl = `${supabaseUrl}/rest/v1/orders?select=${encodeURIComponent(orderSelect)}&tracking_id=eq.${tracking_id}`;
    }

    const orderResponse = await fetch(orderUrl, {
      headers: {
        'apikey': supabaseKey,
        'Authorization': `Bearer ${supabaseKey}`,
      },
    });
    const orderData = await orderResponse.json();
    const order = orderData[0];

    if (!order) {
      return new Response(
        JSON.stringify({ success: false, error: 'Order not found' }),
        { status: 404, headers: { 'Content-Type': 'application/json', ...corsHeaders } }
      );
    }

    // If cust_id provided, verify ownership
    if (cust_id && order.cust_id !== cust_id) {
      return new Response(
        JSON.stringify({ success: false, error: 'You are not authorized to track this order' }),
        { status: 403, headers: { 'Content-Type': 'application/json', ...corsHeaders } }
      );
    }

    // Get shipment tracking history
    const trackingUrl = `${supabaseUrl}/rest/v1/shipment_tracking?book_id=eq.${order.book_id}&order=created_at.asc&select=*`;
    const trackingResponse = await fetch(trackingUrl, {
      headers: {
        'apikey': supabaseKey,
        'Authorization': `Bearer ${supabaseKey}`,
      },
    });
    const trackingHistory = await trackingResponse.json();

    // Get rider live location if order is out for delivery
    let riderLiveLocation = null;
    if (order.status === 'OUT_FOR_DELIVERY' && order.rider_id) {
      const riderUrl = `${supabaseUrl}/rest/v1/riders?rider_id=eq.${order.rider_id}&select=current_location,last_location_update,is_online`;
      const riderResponse = await fetch(riderUrl, {
        headers: {
          'apikey': supabaseKey,
          'Authorization': `Bearer ${supabaseKey}`,
        },
      });
      const riderData = await riderResponse.json();
      const rider = riderData[0];

      if (rider && rider.current_location) {
        riderLiveLocation = {
          lat: rider.current_location.lat,
          lng: rider.current_location.lng,
          last_update: rider.last_location_update,
          is_online: rider.is_online
        };
      }
    }

    // Calculate estimated delivery time
    let estimatedDelivery = null;
    if (order.status === 'SHIPPED' || order.status === 'OUT_FOR_DELIVERY') {
      const shippedEntry = trackingHistory?.find(t => t.status === 'SHIPPED');
      const shippedDate = shippedEntry?.created_at || order.placed_at;
      const estimatedDays = 3;
      const estimatedDate = new Date(shippedDate);
      estimatedDate.setDate(estimatedDate.getDate() + estimatedDays);
      estimatedDelivery = estimatedDate;
    }

    // Check if cancel code is still valid
    const isCancelCodeValid = order.cancel_code && 
      new Date(order.cancel_code_expiry) > new Date() && 
      order.status !== 'DELIVERED' &&
      order.status !== 'CANCELLED';

    // Get return eligibility
    let returnEligible = false;
    let returnWindowEnds = null;
    if (order.status === 'DELIVERED' && order.delivered_at) {
      const deliveryDate = new Date(order.delivered_at);
      const returnDeadline = new Date(deliveryDate);
      returnDeadline.setDate(returnDeadline.getDate() + 7);
      returnEligible = new Date() <= returnDeadline;
      returnWindowEnds = returnDeadline;
    }

    // Build tracking timeline
    const timeline = [];
    const statusOrder = ['PENDING', 'ACCEPTED', 'PACKED', 'SHIPPED', 'OUT_FOR_DELIVERY', 'DELIVERED'];
    let currentStatusIndex = statusOrder.indexOf(order.status);

    for (let i = 0; i <= currentStatusIndex; i++) {
      const statusName = statusOrder[i];
      const trackingEntry = trackingHistory?.find(t => t.status === statusName);

      timeline.push({
        status: statusName,
        status_display: getStatusDisplay(statusName),
        completed: true,
        date: trackingEntry?.created_at || null,
        location: trackingEntry?.location || null,
        notes: trackingEntry?.notes || null
      });
    }

    // Add cancelled status if applicable
    if (order.status === 'CANCELLED') {
      timeline.push({
        status: 'CANCELLED',
        status_display: 'Cancelled',
        completed: true,
        date: order.cancelled_at,
        notes: order.cancel_reason
      });
    }

    if (order.status === 'RTO') {
      timeline.push({
        status: 'RTO',
        status_display: 'Return to Origin',
        completed: true,
        date: order.rto_at,
        notes: order.cancel_reason
      });
    }

    // Format response
    const response = {
      success: true,
      order: {
        book_id: order.book_id,
        tracking_id: order.tracking_id,
        cancel_code: order.cancel_code,
        cancel_code_expiry: order.cancel_code_expiry,
        is_cancel_code_valid: isCancelCodeValid,
        status: order.status,
        status_display: getStatusDisplay(order.status),
        status_color: getStatusColor(order.status),
        status_icon: getStatusIcon(order.status),
        total_amount: order.total_amount,
        delivery_charge: order.delivery_charge,
        final_amount: order.final_amount,
        payment_method: order.payment_method,
        placed_at: order.placed_at,
        delivered_at: order.delivered_at,
        estimated_delivery: estimatedDelivery ? estimatedDelivery.toISOString() : null,
        address: order.address,
        items: (order.order_items || []).map(item => ({
          prod_id: item.products.prod_id,
          name: item.products.name,
          description: item.products.description,
          quantity: item.quantity,
          price: item.price_at_time,
          total: item.price_at_time * item.quantity,
          mrp: item.products.mrp,
          discount_percent: Math.round(((item.products.mrp - item.price_at_time) / item.products.mrp) * 100),
          image: item.products.images?.[0] || null
        })),
        seller: order.sellers ? {
          seller_id: order.sellers.seller_id,
          shop_name: order.sellers.shop_name,
          mobile: order.sellers.seller_mobile,
          rating: order.sellers.seller_rating
        } : null,
        rider: order.rider_id ? {
          rider_id: order.riders?.rider_id,
          name: order.riders?.rider_name,
          mobile: order.riders?.rider_mobile,
          rating: order.riders?.rider_rating,
          live_location: riderLiveLocation
        } : null,
        return_eligibility: {
          eligible: returnEligible,
          window_ends: returnWindowEnds ? returnWindowEnds.toISOString() : null
        },
        timeline: timeline,
        last_updated: trackingHistory?.[trackingHistory.length - 1]?.created_at || order.placed_at
      }
    };

    return new Response(
      JSON.stringify(response),
      { status: 200, headers: { 'Content-Type': 'application/json', ...corsHeaders } }
    );

  } catch (error) {
    console.error('Order track error:', error);
    return new Response(
      JSON.stringify({ success: false, error: error.message || 'Internal server error' }),
      { status: 500, headers: { 'Content-Type': 'application/json', ...corsHeaders } }
    );
  }
}

// Helper functions
function getStatusDisplay(status) {
  const statusMap = {
    'PENDING': 'Order Placed',
    'ACCEPTED': 'Order Confirmed',
    'PACKED': 'Order Packed',
    'SHIPPED': 'Order Shipped',
    'OUT_FOR_DELIVERY': 'Out for Delivery',
    'DELIVERED': 'Delivered',
    'CANCELLED': 'Cancelled',
    'RTO': 'Return to Origin'
  };
  return statusMap[status] || status;
}

function getStatusColor(status) {
  const colorMap = {
    'PENDING': '#f59e0b',
    'ACCEPTED': '#3b82f6',
    'PACKED': '#8b5cf6',
    'SHIPPED': '#06b6d4',
    'OUT_FOR_DELIVERY': '#10b981',
    'DELIVERED': '#22c55e',
    'CANCELLED': '#ef4444',
    'RTO': '#ef4444'
  };
  return colorMap[status] || '#6b7280';
}

function getStatusIcon(status) {
  const iconMap = {
    'PENDING': 'fa-clock',
    'ACCEPTED': 'fa-check-circle',
    'PACKED': 'fa-box',
    'SHIPPED': 'fa-truck',
    'OUT_FOR_DELIVERY': 'fa-motorcycle',
    'DELIVERED': 'fa-check-double',
    'CANCELLED': 'fa-times-circle',
    'RTO': 'fa-undo'
  };
  return iconMap[status] || 'fa-circle';
}