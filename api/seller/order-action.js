// api/seller/order-action.js
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
      select: (columns) => ({
        eq: (field, value) => ({
          single: async () => {
            const url = `${supabaseUrl}/rest/v1/${table}?${field}=eq.${value}&select=${columns || '*'}`;
            const response = await fetch(url, {
              headers: {
                'apikey': supabaseKey,
                'Authorization': `Bearer ${supabaseKey}`,
              },
            });
            const data = await response.json();
            return { data: data[0] || null, error: null };
          },
          maybeSingle: async () => {
            const url = `${supabaseUrl}/rest/v1/${table}?${field}=eq.${value}&select=${columns || '*'}`;
            const response = await fetch(url, {
              headers: {
                'apikey': supabaseKey,
                'Authorization': `Bearer ${supabaseKey}`,
              },
            });
            const data = await response.json();
            return { data: data[0] || null, error: null };
          },
          limit: async (limit) => {
            const url = `${supabaseUrl}/rest/v1/${table}?${field}=eq.${value}&select=${columns || '*'}&limit=${limit}`;
            const response = await fetch(url, {
              headers: {
                'apikey': supabaseKey,
                'Authorization': `Bearer ${supabaseKey}`,
              },
            });
            const data = await response.json();
            return { data, error: null };
          }
        }),
        in: (field, values) => ({
          select: async (columns) => {
            const url = `${supabaseUrl}/rest/v1/${table}?${field}=in.(${values.join(',')})&select=${columns || '*'}`;
            const response = await fetch(url, {
              headers: {
                'apikey': supabaseKey,
                'Authorization': `Bearer ${supabaseKey}`,
              },
            });
            const data = await response.json();
            return { data, error: null };
          }
        })
      }),
      insert: (data) => ({
        select: async () => {
          const response = await fetch(`${supabaseUrl}/rest/v1/${table}`, {
            method: 'POST',
            headers: {
              'apikey': supabaseKey,
              'Authorization': `Bearer ${supabaseKey}`,
              'Content-Type': 'application/json',
              'Prefer': 'return=representation'
            },
            body: JSON.stringify(data)
          });
          const result = await response.json();
          return { data: result, error: null };
        }
      }),
      update: (data) => ({
        eq: (field, value) => ({
          select: async () => {
            const response = await fetch(`${supabaseUrl}/rest/v1/${table}?${field}=eq.${value}`, {
              method: 'PATCH',
              headers: {
                'apikey': supabaseKey,
                'Authorization': `Bearer ${supabaseKey}`,
                'Content-Type': 'application/json',
                'Prefer': 'return=representation'
              },
              body: JSON.stringify(data)
            });
            const result = await response.json();
            return { data: result, error: null };
          }
        })
      }),
      rpc: async (functionName, params) => {
        const response = await fetch(`${supabaseUrl}/rest/v1/rpc/${functionName}`, {
          method: 'POST',
          headers: {
            'apikey': supabaseKey,
            'Authorization': `Bearer ${supabaseKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(params)
        });
        const result = await response.json();
        return { data: result, error: null };
      }
    })
  };
}

// Main handler for Edge Function
export default async function handler(request) {
  // Enable CORS
  const corsHeaders = {
    'Access-Control-Allow-Credentials': 'true',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'POST, GET, OPTIONS',
    'Access-Control-Allow-Headers': 'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version, Authorization',
  };

  // Handle preflight
  if (request.method === 'OPTIONS') {
    return new Response(null, {
      status: 204,
      headers: corsHeaders,
    });
  }

  // Parse URL
  const url = new URL(request.url);

  // =====================================================
  // GET ORDER DETAILS FOR ACTION
  // =====================================================
  if (request.method === 'GET') {
    try {
      const book_id = url.searchParams.get('book_id');
      const seller_id = url.searchParams.get('seller_id');

      if (!book_id || !seller_id) {
        return new Response(JSON.stringify({
          success: false,
          error: 'Order ID and Seller ID are required'
        }), {
          status: 400,
          headers: { 'Content-Type': 'application/json', ...corsHeaders }
        });
      }

      const supabase = createSupabaseClient();

      // Get order details with items
      const orderResult = await supabase
        .from('orders')
        .select(`
          *,
          order_items (
            item_id,
            quantity,
            price_at_time,
            products!inner (
              prod_id,
              name,
              images,
              mrp,
              selling_price
            )
          ),
          customers!inner (
            cust_id,
            name,
            mobile,
            email
          )
        `)
        .eq('book_id', book_id)
        .single();

      if (orderResult.error || !orderResult.data) {
        return new Response(JSON.stringify({ 
          success: false, 
          error: 'Order not found or unauthorized' 
        }), {
          status: 404,
          headers: { 'Content-Type': 'application/json', ...corsHeaders }
        });
      }

      const order = orderResult.data;

      // Get shipping label if exists
      const labelResult = await supabase
        .from('shipping_labels')
        .select('*')
        .eq('book_id', book_id)
        .maybeSingle();

      // Check if order can be cancelled
      const canCancel = ['PENDING', 'ACCEPTED'].includes(order.status);
      const canAccept = order.status === 'PENDING';
      const canReject = order.status === 'PENDING';
      const canPack = order.status === 'ACCEPTED';
      const canShip = order.status === 'PACKED';

      // Calculate commission
      const sellerResult = await supabase
        .from('sellers')
        .select('commission_rate')
        .eq('seller_id', seller_id)
        .single();

      const commissionRate = sellerResult.data?.commission_rate || 10;
      const estimatedCommission = (order.final_amount * commissionRate) / 100;
      const estimatedEarnings = order.final_amount - estimatedCommission;

      return new Response(JSON.stringify({
        success: true,
        order: {
          book_id: order.book_id,
          tracking_id: order.tracking_id,
          cancel_code: order.cancel_code,
          cancel_code_expiry: order.cancel_code_expiry,
          status: order.status,
          status_display: getStatusDisplay(order.status),
          total_amount: order.total_amount,
          delivery_charge: order.delivery_charge,
          discount_amount: order.discount_amount,
          final_amount: order.final_amount,
          payment_method: order.payment_method,
          address: order.address,
          placed_at: order.placed_at,
          accepted_at: order.accepted_at,
          packed_at: order.packed_at,
          shipped_at: order.shipped_at,
          customer: {
            cust_id: order.customers.cust_id,
            name: order.customers.name,
            mobile: order.customers.mobile,
            email: order.customers.email
          },
          items: (order.order_items || []).map(item => ({
            prod_id: item.products.prod_id,
            name: item.products.name,
            quantity: item.quantity,
            price: item.price_at_time,
            total: item.price_at_time * item.quantity,
            mrp: item.products.mrp,
            discount: item.products.mrp - item.price_at_time,
            image: item.products.images?.[0] || null
          })),
          financial: {
            subtotal: order.total_amount,
            delivery: order.delivery_charge,
            discount: order.discount_amount,
            total: order.final_amount,
            commission_rate: commissionRate,
            estimated_commission: Math.round(estimatedCommission),
            estimated_earnings: Math.round(estimatedEarnings)
          }
        },
        actions: {
          can_accept: canAccept,
          can_reject: canReject,
          can_pack: canPack,
          can_ship: canShip,
          can_cancel: canCancel
        },
        has_label: !!labelResult.data,
        label_url: labelResult.data ? `/api/barcode/print-label?book_id=${book_id}` : null,
        invoice_url: `/api/barcode/generate-invoice?book_id=${book_id}`
      }), {
        status: 200,
        headers: { 'Content-Type': 'application/json', ...corsHeaders }
      });

    } catch (error) {
      console.error('Get order detail error:', error);
      return new Response(JSON.stringify({ 
        success: false, 
        error: error.message 
      }), {
        status: 500,
        headers: { 'Content-Type': 'application/json', ...corsHeaders }
      });
    }
  }

  // =====================================================
  // PROCESS ORDER ACTION (POST)
  // =====================================================
  if (request.method === 'POST') {
    try {
      const body = await request.json();
      const { 
        book_id, 
        seller_id, 
        action, 
        rejection_reason,
        awb_number,
        weight,
        dimensions,
        shipping_partner
      } = body;

      if (!book_id || !seller_id || !action) {
        return new Response(JSON.stringify({
          success: false,
          error: 'Order ID, Seller ID and action are required'
        }), {
          status: 400,
          headers: { 'Content-Type': 'application/json', ...corsHeaders }
        });
      }

      const supabase = createSupabaseClient();

      // Verify order belongs to seller
      const orderResult = await supabase
        .from('orders')
        .select('*, customers!inner(cust_id, name, mobile, email)')
        .eq('book_id', book_id)
        .single();

      if (orderResult.error || !orderResult.data) {
        return new Response(JSON.stringify({ 
          success: false, 
          error: 'Order not found or unauthorized' 
        }), {
          status: 404,
          headers: { 'Content-Type': 'application/json', ...corsHeaders }
        });
      }

      const order = orderResult.data;
      let newStatus;
      let updateData = {};
      let notificationMessage = '';
      let notificationTitle = '';

      switch (action) {
        case 'accept':
          if (order.status !== 'PENDING') {
            return new Response(JSON.stringify({ 
              success: false, 
              error: 'Order cannot be accepted at this stage' 
            }), {
              status: 400,
              headers: { 'Content-Type': 'application/json', ...corsHeaders }
            });
          }
          newStatus = 'ACCEPTED';
          updateData.accepted_at = new Date().toISOString();
          notificationTitle = 'Order Accepted';
          notificationMessage = `Great news! Your order #${book_id} has been accepted by the seller and will be processed soon.`;
          break;

        case 'reject':
          if (order.status !== 'PENDING') {
            return new Response(JSON.stringify({ 
              success: false, 
              error: 'Order cannot be rejected at this stage' 
            }), {
              status: 400,
              headers: { 'Content-Type': 'application/json', ...corsHeaders }
            });
          }
          newStatus = 'CANCELLED';
          updateData.cancelled_at = new Date().toISOString();
          updateData.cancel_reason = rejection_reason || 'Rejected by seller';
          notificationTitle = 'Order Cancelled';
          notificationMessage = `Your order #${book_id} has been cancelled by the seller. Reason: ${rejection_reason || 'Not specified'}`;
          break;

        case 'pack':
          if (order.status !== 'ACCEPTED') {
            return new Response(JSON.stringify({ 
              success: false, 
              error: 'Order must be accepted before packing' 
            }), {
              status: 400,
              headers: { 'Content-Type': 'application/json', ...corsHeaders }
            });
          }
          newStatus = 'PACKED';
          updateData.packed_at = new Date().toISOString();
          notificationTitle = 'Order Packed';
          notificationMessage = `Your order #${book_id} has been packed and is ready for pickup by the delivery partner.`;

          // Generate shipping label
          await generateShippingLabel(supabase, book_id, awb_number, weight, dimensions, shipping_partner);
          break;

        case 'ship':
          if (order.status !== 'PACKED') {
            return new Response(JSON.stringify({ 
              success: false, 
              error: 'Order must be packed before shipping' 
            }), {
              status: 400,
              headers: { 'Content-Type': 'application/json', ...corsHeaders }
            });
          }
          newStatus = 'SHIPPED';
          updateData.shipped_at = new Date().toISOString();
          if (awb_number) updateData.awb_number = awb_number;
          notificationTitle = 'Order Shipped';
          notificationMessage = `Your order #${book_id} has been shipped! Tracking ID: ${order.tracking_id}. You can track your order in real-time.`;
          break;

        case 'rto':
          if (!['SHIPPED', 'OUT_FOR_DELIVERY'].includes(order.status)) {
            return new Response(JSON.stringify({ 
              success: false, 
              error: 'Order cannot be marked as RTO at this stage' 
            }), {
              status: 400,
              headers: { 'Content-Type': 'application/json', ...corsHeaders }
            });
          }
          newStatus = 'RTO';
          updateData.rto_at = new Date().toISOString();
          updateData.cancel_reason = rejection_reason || 'Return to Origin';
          notificationTitle = 'Order RTO';
          notificationMessage = `Your order #${book_id} is being returned to origin due to delivery issues.`;
          break;

        default:
          return new Response(JSON.stringify({ 
            success: false, 
            error: 'Invalid action' 
          }), {
            status: 400,
            headers: { 'Content-Type': 'application/json', ...corsHeaders }
          });
      }

      // Update order status
      await supabase
        .from('orders')
        .update({
          status: newStatus,
          ...updateData,
          updated_at: new Date().toISOString()
        })
        .eq('book_id', book_id)
        .select();

      // Add shipment tracking entry
      await supabase
        .from('shipment_tracking')
        .insert({
          book_id,
          status: newStatus,
          notes: `Order ${action}ed by seller`,
          location: 'Seller Hub',
          created_at: new Date().toISOString()
        });

      // Send notification to customer
      await supabase
        .from('notifications')
        .insert({
          user_id: order.cust_id,
          user_type: 'customer',
          title: notificationTitle,
          message: notificationMessage,
          type: 'order',
          data: { order_id: book_id, status: newStatus }
        });

      // If RTO, update seller's trust score
      if (action === 'rto') {
        await supabase.rpc('update_seller_trust_score_on_rto', {
          p_seller_id: seller_id
        });
      }

      // If shipped, notify logistics hub
      if (action === 'ship') {
        await notifyLogisticsHub(supabase, book_id, order);
      }

      return new Response(JSON.stringify({
        success: true,
        message: `Order ${action}ed successfully`,
        order: {
          book_id,
          status: newStatus,
          status_display: getStatusDisplay(newStatus),
          updated_at: new Date().toISOString()
        },
        next_steps: getNextSteps(action)
      }), {
        status: 200,
        headers: { 'Content-Type': 'application/json', ...corsHeaders }
      });

    } catch (error) {
      console.error('Order action error:', error);
      return new Response(JSON.stringify({ 
        success: false, 
        error: error.message 
      }), {
        status: 500,
        headers: { 'Content-Type': 'application/json', ...corsHeaders }
      });
    }
  }

  // Method not allowed
  return new Response(JSON.stringify({ 
    success: false, 
    error: 'Method not allowed' 
  }), {
    status: 405,
    headers: { 'Content-Type': 'application/json', ...corsHeaders }
  });
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

async function generateShippingLabel(supabase, book_id, awb_number, weight, dimensions, shipping_partner) {
  const existingResult = await supabase
    .from('shipping_labels')
    .select('label_id')
    .eq('book_id', book_id)
    .maybeSingle();

  const labelData = {
    book_id,
    awb_number: awb_number || null,
    weight: weight || null,
    dimensions: dimensions || null,
    shipping_partner: shipping_partner || 'Suriyawan Saffari Logistics',
    printed_at: new Date().toISOString(),
    print_count: 1
  };

  if (existingResult.data) {
    await supabase
      .from('shipping_labels')
      .update(labelData)
      .eq('book_id', book_id)
      .select();
  } else {
    await supabase
      .from('shipping_labels')
      .insert(labelData);
  }
}

async function notifyLogisticsHub(supabase, book_id, order) {
  // Get nearest hub based on pincode
  const pincode = order.address?.pincode;

  const hubResult = await supabase
    .from('hub_managers')
    .select('hub_id')
    .contains('assigned_pincodes', [pincode])
    .limit(1);

  if (hubResult.data && hubResult.data.length > 0) {
    await supabase
      .from('notifications')
      .insert({
        user_id: hubResult.data[0].hub_id,
        user_type: 'hub',
        title: 'New Shipment Received',
        message: `Order #${book_id} is ready for pickup from seller.`,
        type: 'logistics',
        data: { order_id: book_id }
      });
  }
}

function getNextSteps(action) {
  const steps = {
    'accept': 'Pack the order and mark as packed when ready for pickup.',
    'pack': 'Handover the packed order to the logistics partner for shipping.',
    'ship': 'Order is now with logistics. Track delivery status.',
    'reject': 'Order has been cancelled. Customer has been notified.',
    'rto': 'Order is being returned. Update inventory when received.'
  };
  return steps[action] || 'Order updated successfully.';
}