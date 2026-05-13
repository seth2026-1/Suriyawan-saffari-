// api/customer/orders-list.js
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
      select: (columns, options = {}) => {
        let url = `${supabaseUrl}/rest/v1/${table}`;
        if (columns && columns !== '*') {
          url += `?select=${columns}`;
        }
        
        return {
          eq: (field, value) => ({
            gte: (gteField, gteValue) => ({
              lte: (lteField, lteValue) => ({
                order: (orderField, { ascending }) => {
                  const sortOrder = ascending ? 'asc' : 'desc';
                  return {
                    range: async (from, to) => {
                      const finalUrl = `${url}&${field}=eq.${value}&${gteField}=gte.${gteValue}&${lteField}=lte.${lteValue}&order=${orderField}.${sortOrder}&offset=${from}&limit=${to - from + 1}`;
                      const response = await fetch(finalUrl, {
                        headers: {
                          'apikey': supabaseKey,
                          'Authorization': `Bearer ${supabaseKey}`,
                        },
                      });
                      const data = await response.json();
                      const count = response.headers.get('content-range')?.split('/')[1];
                      return { data, error: null, count: count ? parseInt(count) : null };
                    }
                  };
                }
              })
            }),
            order: (orderField, { ascending }) => {
              const sortOrder = ascending ? 'asc' : 'desc';
              return {
                range: async (from, to) => {
                  let finalUrl = `${url}&${field}=eq.${value}&order=${orderField}.${sortOrder}`;
                  
                  // Handle nested or condition for search
                  if (options.or) {
                    finalUrl += `&or=${options.or}`;
                  }
                  
                  finalUrl += `&offset=${from}&limit=${to - from + 1}`;
                  
                  const response = await fetch(finalUrl, {
                    headers: {
                      'apikey': supabaseKey,
                      'Authorization': `Bearer ${supabaseKey}`,
                    },
                  });
                  const data = await response.json();
                  const count = response.headers.get('content-range')?.split('/')[1];
                  return { data, error: null, count: count ? parseInt(count) : null };
                }
              };
            }
          }),
          eq: (field, value) => ({
            order: (orderField, { ascending }) => {
              const sortOrder = ascending ? 'asc' : 'desc';
              return {
                range: async (from, to) => {
                  let finalUrl = `${url}&${field}=eq.${value}&order=${orderField}.${sortOrder}`;
                  
                  if (options.or) {
                    finalUrl += `&or=${options.or}`;
                  }
                  
                  finalUrl += `&offset=${from}&limit=${to - from + 1}`;
                  
                  const response = await fetch(finalUrl, {
                    headers: {
                      'apikey': supabaseKey,
                      'Authorization': `Bearer ${supabaseKey}`,
                    },
                  });
                  const data = await response.json();
                  const count = response.headers.get('content-range')?.split('/')[1];
                  return { data, error: null, count: count ? parseInt(count) : null };
                }
              };
            }
          }),
          or: (condition) => ({
            order: (orderField, { ascending }) => ({
              range: async (from, to) => {
                const sortOrder = ascending ? 'asc' : 'desc';
                const finalUrl = `${url}&or=${condition}&order=${orderField}.${sortOrder}&offset=${from}&limit=${to - from + 1}`;
                const response = await fetch(finalUrl, {
                  headers: {
                    'apikey': supabaseKey,
                    'Authorization': `Bearer ${supabaseKey}`,
                  },
                });
                const data = await response.json();
                const count = response.headers.get('content-range')?.split('/')[1];
                return { data, error: null, count: count ? parseInt(count) : null };
              }
            })
          })
        };
      },
      fromWithJoin: (table, selectColumns) => {
        let url = `${supabaseUrl}/rest/v1/${table}?select=${selectColumns}`;
        
        return {
          eq: (field, value) => ({
            gte: (gteField, gteValue) => ({
              lte: (lteField, lteValue) => ({
                order: (orderField, { ascending }) => {
                  const sortOrder = ascending ? 'asc' : 'desc';
                  return {
                    range: async (from, to) => {
                      const finalUrl = `${url}&${field}=eq.${value}&${gteField}=gte.${gteValue}&${lteField}=lte.${lteValue}&order=${orderField}.${sortOrder}&offset=${from}&limit=${to - from + 1}`;
                      const response = await fetch(finalUrl, {
                        headers: {
                          'apikey': supabaseKey,
                          'Authorization': `Bearer ${supabaseKey}`,
                        },
                      });
                      const data = await response.json();
                      const count = response.headers.get('content-range')?.split('/')[1];
                      return { data, error: null, count: count ? parseInt(count) : null };
                    }
                  };
                }
              })
            }),
            order: (orderField, { ascending }) => {
              const sortOrder = ascending ? 'asc' : 'desc';
              return {
                range: async (from, to) => {
                  const finalUrl = `${url}&${field}=eq.${value}&order=${orderField}.${sortOrder}&offset=${from}&limit=${to - from + 1}`;
                  const response = await fetch(finalUrl, {
                    headers: {
                      'apikey': supabaseKey,
                      'Authorization': `Bearer ${supabaseKey}`,
                    },
                  });
                  const data = await response.json();
                  const count = response.headers.get('content-range')?.split('/')[1];
                  return { data, error: null, count: count ? parseInt(count) : null };
                }
              };
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
    const cust_id = url.searchParams.get('cust_id');
    const status = url.searchParams.get('status');
    const page = parseInt(url.searchParams.get('page') || '1');
    const limit = parseInt(url.searchParams.get('limit') || '20');
    const from_date = url.searchParams.get('from_date');
    const to_date = url.searchParams.get('to_date');
    const search = url.searchParams.get('search');
    const sort_by = url.searchParams.get('sort_by') || 'placed_at';
    const sort_order = url.searchParams.get('sort_order') || 'desc';

    if (!cust_id) {
      return new Response(
        JSON.stringify({ success: false, error: 'Customer ID is required' }),
        { status: 400, headers: { 'Content-Type': 'application/json', ...corsHeaders } }
      );
    }

    const orderSelect = `*,
      order_items (
        item_id,
        quantity,
        price_at_time,
        products!inner (
          prod_id,
          name,
          description,
          images
        )
      ),
      sellers (
        seller_id,
        shop_name,
        rating
      ),
      shipment_tracking (
        track_id,
        status,
        location,
        created_at
      )`;

    // Build the base URL with filters
    let ordersUrl = `${supabaseUrl}/rest/v1/orders?select=${encodeURIComponent(orderSelect)}&cust_id=eq.${cust_id}`;

    // Filter by status
    if (status && status !== 'all') {
      ordersUrl += `&status=eq.${status}`;
    }

    // Filter by date range
    if (from_date) {
      ordersUrl += `&placed_at=gte.${from_date}`;
    }
    if (to_date) {
      ordersUrl += `&placed_at=lte.${to_date}`;
    }

    // Search by order ID or tracking ID
    if (search) {
      ordersUrl += `&or=(book_id.ilike.%${search}%,tracking_id.ilike.%${search}%)`;
    }

    // Sorting
    const sortOrderValue = sort_order === 'asc' ? 'asc' : 'desc';
    ordersUrl += `&order=${sort_by}.${sortOrderValue}`;

    // Pagination
    const from = (page - 1) * limit;
    const to = from + limit - 1;
    ordersUrl += `&offset=${from}&limit=${limit}`;

    const ordersResponse = await fetch(ordersUrl, {
      headers: {
        'apikey': supabaseKey,
        'Authorization': `Bearer ${supabaseKey}`,
      },
    });
    const orders = await ordersResponse.json();
    const count = parseInt(ordersResponse.headers.get('content-range')?.split('/')[1] || '0');

    // Get order status counts for dashboard
    const statusCountsUrl = `${supabaseUrl}/rest/v1/orders?select=status&cust_id=eq.${cust_id}`;
    const statusCountsResponse = await fetch(statusCountsUrl, {
      headers: {
        'apikey': supabaseKey,
        'Authorization': `Bearer ${supabaseKey}`,
      },
    });
    const statusCountsData = await statusCountsResponse.json();
    const statusCounts = statusCountsData || [];

    let statusWiseCount = {
      all: count || 0,
      PENDING: 0,
      ACCEPTED: 0,
      PACKED: 0,
      SHIPPED: 0,
      OUT_FOR_DELIVERY: 0,
      DELIVERED: 0,
      CANCELLED: 0,
      RTO: 0
    };

    if (statusCounts) {
      statusCounts.forEach(order => {
        const orderStatus = order.status;
        if (statusWiseCount[orderStatus] !== undefined) {
          statusWiseCount[orderStatus]++;
        }
      });
    }

    // Format orders
    const formattedOrders = (orders || []).map(order => {
      // Calculate delivery timeline
      let timeline = {};

      const placedAt = new Date(order.placed_at);
      const shippedEntry = order.shipment_tracking?.find(t => t.status === 'SHIPPED');
      const outForDeliveryEntry = order.shipment_tracking?.find(t => t.status === 'OUT_FOR_DELIVERY');
      const shippedAt = shippedEntry?.created_at;
      const outForDeliveryAt = outForDeliveryEntry?.created_at;
      const deliveredAt = order.delivered_at;

      if (placedAt && shippedAt) {
        timeline.processing_days = Math.ceil((new Date(shippedAt) - placedAt) / (1000 * 60 * 60 * 24));
      }
      if (shippedAt && outForDeliveryAt) {
        timeline.transit_days = Math.ceil((new Date(outForDeliveryAt) - new Date(shippedAt)) / (1000 * 60 * 60 * 24));
      }
      if (outForDeliveryAt && deliveredAt) {
        timeline.delivery_days = Math.ceil((new Date(deliveredAt) - new Date(outForDeliveryAt)) / (1000 * 60 * 60 * 24));
      }

      const estimatedDays = timeline.processing_days || 2 + timeline.transit_days || 3;
      const estimatedDeliveryDate = new Date(order.placed_at);
      estimatedDeliveryDate.setDate(estimatedDeliveryDate.getDate() + (estimatedDays || 5));

      // Check if order can be cancelled
      const canCancel = ['PENDING', 'ACCEPTED', 'PACKED'].includes(order.status) && 
                        order.cancel_code_expiry && new Date(order.cancel_code_expiry) > new Date();

      // Check if return is eligible (within 7 days of delivery)
      let canReturn = false;
      let returnWindowEnds = null;
      if (order.status === 'DELIVERED' && order.delivered_at) {
        const deliveryDate = new Date(order.delivered_at);
        const returnDeadline = new Date(deliveryDate);
        returnDeadline.setDate(returnDeadline.getDate() + 7);
        canReturn = new Date() <= returnDeadline;
        returnWindowEnds = returnDeadline;
      }

      return {
        book_id: order.book_id,
        tracking_id: order.tracking_id,
        cancel_code: order.cancel_code,
        cancel_code_expiry: order.cancel_code_expiry,
        status: order.status,
        status_display: getStatusDisplay(order.status),
        status_color: getStatusColor(order.status),
        total_amount: order.total_amount,
        delivery_charge: order.delivery_charge,
        discount_amount: order.discount_amount,
        final_amount: order.final_amount,
        payment_method: order.payment_method,
        address: order.address,
        placed_at: order.placed_at,
        delivered_at: order.delivered_at,
        cancelled_at: order.cancelled_at,
        estimated_delivery_date: estimatedDeliveryDate.toISOString(),
        timeline: timeline,
        items: (order.order_items || []).map(item => ({
          prod_id: item.products?.prod_id,
          name: item.products?.name,
          description: item.products?.description,
          quantity: item.quantity,
          price: item.price_at_time,
          total: item.price_at_time * item.quantity,
          image: item.products?.images?.[0] || null
        })),
        seller: order.sellers ? {
          seller_id: order.sellers.seller_id,
          shop_name: order.sellers.shop_name,
          rating: order.sellers.rating
        } : null,
        tracking_history: (order.shipment_tracking || []).map(track => ({
          status: track.status,
          status_display: getStatusDisplay(track.status),
          location: track.location,
          created_at: track.created_at
        })).sort((a, b) => new Date(a.created_at) - new Date(b.created_at)),
        actions: {
          can_cancel: canCancel,
          can_return: canReturn,
          return_window_ends: returnWindowEnds ? returnWindowEnds.toISOString() : null,
          can_reorder: order.status === 'DELIVERED',
          can_invoice: order.status === 'DELIVERED'
        }
      };
    });

    return new Response(
      JSON.stringify({
        success: true,
        orders: formattedOrders,
        status_counts: statusWiseCount,
        pagination: {
          current_page: page,
          total_pages: Math.ceil(count / limit),
          total_items: count,
          items_per_page: limit,
          has_next: page * limit < count,
          has_prev: page > 1
        },
        filters_applied: {
          status: status || 'all',
          from_date: from_date || null,
          to_date: to_date || null,
          search: search || null
        }
      }),
      { status: 200, headers: { 'Content-Type': 'application/json', ...corsHeaders } }
    );

  } catch (error) {
    console.error('Orders list error:', error);
    return new Response(
      JSON.stringify({
        success: false,
        error: error.message || 'Internal server error'
      }),
      { status: 500, headers: { 'Content-Type': 'application/json', ...corsHeaders } }
    );
  }
}

// Helper functions
function getStatusDisplay(status) {
  const statusMap = {
    'PENDING': 'Pending',
    'ACCEPTED': 'Accepted',
    'PACKED': 'Packed',
    'SHIPPED': 'Shipped',
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