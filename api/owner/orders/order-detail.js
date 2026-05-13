// api/owner/orders/order-detail.js
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
            maybeSingle: async () => {
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
      },
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
          return { data: result[0] || result, error: null };
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
            return { data: result[0] || result, error: null };
          }
        })
      })
    })
  };
}

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

export default async function handler(request) {
  // CORS Headers
  const corsHeaders = {
    'Access-Control-Allow-Credentials': 'true',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, PUT, OPTIONS',
    'Access-Control-Allow-Headers': 'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version, Authorization',
  };

  // Handle OPTIONS preflight
  if (request.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: corsHeaders });
  }

  const url = new URL(request.url);
  const supabase = createSupabaseClient();
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  // =====================================================
  // GET ORDER DETAILS
  // =====================================================
  if (request.method === 'GET') {
    try {
      const book_id = url.searchParams.get('book_id');

      if (!book_id) {
        return new Response(JSON.stringify({ success: false, error: 'Order ID is required' }), {
          status: 400,
          headers: { 'Content-Type': 'application/json', ...corsHeaders }
        });
      }

      // Get order details with all relations
      const orderSelect = `*,
        customers!inner(cust_id,name,email,mobile,address,trust_score),
        sellers!inner(seller_id,shop_name,owner_name,email as seller_email,mobile as seller_mobile,upi_id,commission_rate),
        riders!left(rider_id,name as rider_name,mobile as rider_mobile,rating as rider_rating),
        order_items!inner(item_id,quantity,price_at_time,products!inner(prod_id,name,description,images,mrp,selling_price,tags)),
        shipment_tracking(track_id,status,location,lat,lng,rider_id,hub_id,notes,photo,created_at),
        returns(return_id,reason,status,refund_amount,created_at),
        exchanges(exchange_id,old_book_id,new_book_id,price_difference,status)`;

      const orderUrl = `${supabaseUrl}/rest/v1/orders?select=${encodeURIComponent(orderSelect)}&book_id=eq.${book_id}`;
      const orderResponse = await fetch(orderUrl, {
        headers: {
          'apikey': supabaseKey,
          'Authorization': `Bearer ${supabaseKey}`,
        },
      });
      const orderData = await orderResponse.json();
      const order = orderData[0];

      if (!order) {
        return new Response(JSON.stringify({ success: false, error: 'Order not found' }), {
          status: 404,
          headers: { 'Content-Type': 'application/json', ...corsHeaders }
        });
      }

      // Get payment details
      const codUrl = `${supabaseUrl}/rest/v1/cod_payments?select=*&book_id=eq.${book_id}`;
      const codResponse = await fetch(codUrl, {
        headers: {
          'apikey': supabaseKey,
          'Authorization': `Bearer ${supabaseKey}`,
        },
      });
      const codData = await codResponse.json();
      const codPayments = codData[0] || null;

      // Get dispute details if any
      const disputeUrl = `${supabaseUrl}/rest/v1/disputes?select=*&book_id=eq.${book_id}`;
      const disputeResponse = await fetch(disputeUrl, {
        headers: {
          'apikey': supabaseKey,
          'Authorization': `Bearer ${supabaseKey}`,
        },
      });
      const disputeData = await disputeResponse.json();
      const dispute = disputeData[0] || null;

      // Calculate financial breakdown
      const commissionRate = order.sellers?.commission_rate || 10;
      const commissionAmount = (order.final_amount * commissionRate) / 100;
      const netPayable = order.final_amount - commissionAmount;

      // Get delivery timeline
      const timeline = [
        { status: 'Order Placed', date: order.placed_at, completed: true },
        { status: 'Accepted', date: order.accepted_at, completed: !!order.accepted_at },
        { status: 'Packed', date: order.packed_at, completed: !!order.packed_at },
        { status: 'Shipped', date: order.shipped_at, completed: !!order.shipped_at },
        { status: 'Out for Delivery', date: order.out_for_delivery_at, completed: !!order.out_for_delivery_at },
        { status: 'Delivered', date: order.delivered_at, completed: order.status === 'DELIVERED' }
      ];

      // Get cancellation details if any
      let cancellationDetails = null;
      if (order.status === 'CANCELLED' || order.status === 'RTO') {
        cancellationDetails = {
          reason: order.cancel_reason,
          cancelled_at: order.cancelled_at,
          cancelled_by: order.cancel_code_used_by,
          cancel_code_used: !!order.cancel_code_used_at
        };
      }

      // Format shipment tracking with proper order
      const trackingHistory = order.shipment_tracking?.sort((a, b) =>
        new Date(a.created_at) - new Date(b.created_at)
      ) || [];

      return new Response(JSON.stringify({
        success: true,
        order: {
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
          timeline: timeline,
          customer: {
            cust_id: order.customers?.cust_id,
            name: order.customers?.name,
            email: order.customers?.email,
            mobile: order.customers?.mobile,
            address: order.customers?.address,
            trust_score: order.customers?.trust_score
          },
          seller: {
            seller_id: order.sellers?.seller_id,
            shop_name: order.sellers?.shop_name,
            owner_name: order.sellers?.owner_name,
            email: order.sellers?.seller_email,
            mobile: order.sellers?.seller_mobile,
            upi_id: order.sellers?.upi_id,
            commission_rate: order.sellers?.commission_rate
          },
          rider: order.riders ? {
            rider_id: order.riders.rider_id,
            name: order.riders.rider_name,
            mobile: order.riders.rider_mobile,
            rating: order.riders.rider_rating
          } : null,
          items: (order.order_items || []).map(item => ({
            prod_id: item.products.prod_id,
            name: item.products.name,
            description: item.products.description,
            quantity: item.quantity,
            price: item.price_at_time,
            total: item.price_at_time * item.quantity,
            mrp: item.products.mrp,
            discount_percent: Math.round(((item.products.mrp - item.price_at_time) / item.products.mrp) * 100),
            image: item.products.images?.[0] || null,
            tags: item.products.tags
          })),
          financial: {
            subtotal: order.total_amount,
            delivery: order.delivery_charge,
            discount: order.discount_amount,
            total: order.final_amount,
            commission_rate: commissionRate,
            commission_amount: Math.round(commissionAmount),
            net_payable: Math.round(netPayable)
          },
          payment: codPayments ? {
            collected: true,
            amount: codPayments.amount,
            collected_at: codPayments.created_at,
            collected_by: codPayments.rider_id
          } : { collected: false },
          tracking_history: trackingHistory,
          return_info: order.returns?.[0] ? {
            return_id: order.returns[0].return_id,
            reason: order.returns[0].reason,
            status: order.returns[0].status,
            refund_amount: order.returns[0].refund_amount,
            created_at: order.returns[0].created_at
          } : null,
          exchange_info: order.exchanges?.[0] ? {
            exchange_id: order.exchanges[0].exchange_id,
            new_order_id: order.exchanges[0].new_book_id,
            price_difference: order.exchanges[0].price_difference,
            status: order.exchanges[0].status
          } : null,
          dispute_info: dispute ? {
            dispute_id: dispute.dispute_id,
            reason: dispute.reason,
            status: dispute.status,
            created_at: dispute.created_at,
            resolved_at: dispute.resolved_at
          } : null,
          cancellation_details: cancellationDetails
        },
        actions: {
          can_force_deliver: !['DELIVERED', 'CANCELLED', 'RTO'].includes(order.status),
          can_force_cancel: !['DELIVERED', 'CANCELLED', 'RTO'].includes(order.status),
          can_reset_cancel_code: order.status === 'PENDING' && order.cancel_code,
          can_edit_address: order.status === 'PENDING',
          can_edit_items: order.status === 'PENDING'
        },
        barcode_url: `/api/barcode/generate?text=${order.book_id}`,
        qr_url: `/api/barcode/generate-qr?text=${order.book_id}`,
        invoice_url: `/api/barcode/generate-invoice?book_id=${order.book_id}`
      }), {
        status: 200,
        headers: { 'Content-Type': 'application/json', ...corsHeaders }
      });

    } catch (error) {
      console.error('Order detail error:', error);
      return new Response(JSON.stringify({ success: false, error: error.message }), {
        status: 500,
        headers: { 'Content-Type': 'application/json', ...corsHeaders }
      });
    }
  }

  // =====================================================
  // FORCE UPDATE ORDER STATUS (POST)
  // =====================================================
  if (request.method === 'POST') {
    try {
      const body = await request.json();
      const { book_id, action, reason, notes } = body;

      if (!book_id || !action) {
        return new Response(JSON.stringify({
          success: false,
          error: 'Order ID and action are required'
        }), {
          status: 400,
          headers: { 'Content-Type': 'application/json', ...corsHeaders }
        });
      }

      // Get current order with customer and seller info
      const orderSelect = `*, customers!inner(cust_id,name,email), sellers!inner(seller_id,shop_name)`;
      const orderUrl = `${supabaseUrl}/rest/v1/orders?select=${encodeURIComponent(orderSelect)}&book_id=eq.${book_id}`;
      const orderResponse = await fetch(orderUrl, {
        headers: {
          'apikey': supabaseKey,
          'Authorization': `Bearer ${supabaseKey}`,
        },
      });
      const orderData = await orderResponse.json();
      const order = orderData[0];

      if (!order) {
        return new Response(JSON.stringify({ success: false, error: 'Order not found' }), {
          status: 404,
          headers: { 'Content-Type': 'application/json', ...corsHeaders }
        });
      }

      let newStatus;
      let updateData = {};
      let notificationMessage = '';

      switch (action) {
        case 'force_deliver':
          newStatus = 'DELIVERED';
          updateData.delivered_at = new Date().toISOString();
          notificationMessage = `Order ${book_id} has been marked as delivered by admin.`;
          break;
        case 'force_cancel':
          newStatus = 'CANCELLED';
          updateData.cancelled_at = new Date().toISOString();
          updateData.cancel_reason = reason || 'Cancelled by admin';
          notificationMessage = `Order ${book_id} has been cancelled by admin. Reason: ${reason || 'Not specified'}`;
          break;
        case 'force_rto':
          newStatus = 'RTO';
          updateData.rto_at = new Date().toISOString();
          updateData.cancel_reason = reason || 'Marked as RTO by admin';
          notificationMessage = `Order ${book_id} has been marked as RTO by admin.`;
          break;
        case 'reset_cancel_code':
          const newCancelCode = Math.floor(100000 + Math.random() * 900000).toString();
          const expiryDate = new Date();
          expiryDate.setDate(expiryDate.getDate() + 2);
          updateData.cancel_code = newCancelCode;
          updateData.cancel_code_expiry = expiryDate.toISOString();
          notificationMessage = `Cancel code for order ${book_id} has been reset. New code: ${newCancelCode}`;
          break;
        default:
          return new Response(JSON.stringify({ success: false, error: 'Invalid action' }), {
            status: 400,
            headers: { 'Content-Type': 'application/json', ...corsHeaders }
          });
      }

      if (newStatus) {
        updateData.status = newStatus;
      }
      updateData.updated_at = new Date().toISOString();

      const updateResult = await supabase
        .from('orders')
        .update(updateData)
        .eq('book_id', book_id)
        .select();

      if (updateResult.error) throw updateResult.error;
      const updatedOrder = updateResult.data;

      // Add tracking entry
      await fetch(`${supabaseUrl}/rest/v1/shipment_tracking`, {
        method: 'POST',
        headers: {
          'apikey': supabaseKey,
          'Authorization': `Bearer ${supabaseKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          book_id,
          status: newStatus || 'UPDATED',
          notes: notes || `Admin action: ${action}. ${reason ? `Reason: ${reason}` : ''}`,
          created_at: new Date().toISOString()
        })
      });

      // Send notification to customer
      await fetch(`${supabaseUrl}/rest/v1/notifications`, {
        method: 'POST',
        headers: {
          'apikey': supabaseKey,
          'Authorization': `Bearer ${supabaseKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          user_id: order.cust_id,
          user_type: 'customer',
          title: `Order ${newStatus === 'DELIVERED' ? 'Delivered' : 'Updated'}`,
          message: notificationMessage,
          type: 'order',
          data: { book_id, status: newStatus },
          created_at: new Date().toISOString()
        })
      });

      // Send notification to seller
      await fetch(`${supabaseUrl}/rest/v1/notifications`, {
        method: 'POST',
        headers: {
          'apikey': supabaseKey,
          'Authorization': `Bearer ${supabaseKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          user_id: order.seller_id,
          user_type: 'seller',
          title: `Order ${newStatus === 'DELIVERED' ? 'Delivered' : 'Updated'}`,
          message: `Order ${book_id} has been ${newStatus === 'DELIVERED' ? 'marked as delivered' : 'updated'} by admin.`,
          type: 'order',
          data: { book_id, status: newStatus },
          created_at: new Date().toISOString()
        })
      });

      return new Response(JSON.stringify({
        success: true,
        message: `Order ${action} completed successfully`,
        order: updatedOrder,
        action: action
      }), {
        status: 200,
        headers: { 'Content-Type': 'application/json', ...corsHeaders }
      });

    } catch (error) {
      console.error('Force update order error:', error);
      return new Response(JSON.stringify({ success: false, error: error.message }), {
        status: 500,
        headers: { 'Content-Type': 'application/json', ...corsHeaders }
      });
    }
  }

  // =====================================================
  // EDIT ORDER (PUT)
  // =====================================================
  if (request.method === 'PUT') {
    try {
      const body = await request.json();
      const { book_id, address, items, notes } = body;

      if (!book_id) {
        return new Response(JSON.stringify({ success: false, error: 'Order ID is required' }), {
          status: 400,
          headers: { 'Content-Type': 'application/json', ...corsHeaders }
        });
      }

      // Check if order can be edited (only PENDING status)
      const orderUrl = `${supabaseUrl}/rest/v1/orders?select=status&book_id=eq.${book_id}`;
      const orderResponse = await fetch(orderUrl, {
        headers: {
          'apikey': supabaseKey,
          'Authorization': `Bearer ${supabaseKey}`,
        },
      });
      const orderData = await orderResponse.json();
      const order = orderData[0];

      if (!order) {
        return new Response(JSON.stringify({ success: false, error: 'Order not found' }), {
          status: 404,
          headers: { 'Content-Type': 'application/json', ...corsHeaders }
        });
      }

      if (order.status !== 'PENDING') {
        return new Response(JSON.stringify({ success: false, error: 'Only pending orders can be edited' }), {
          status: 400,
          headers: { 'Content-Type': 'application/json', ...corsHeaders }
        });
      }

      const updateData = { updated_at: new Date().toISOString() };
      if (address) updateData.address = address;
      if (notes) updateData.admin_notes = notes;

      const updateResult = await supabase
        .from('orders')
        .update(updateData)
        .eq('book_id', book_id)
        .select();

      if (updateResult.error) throw updateResult.error;
      const updatedOrder = updateResult.data;

      return new Response(JSON.stringify({
        success: true,
        message: 'Order updated successfully',
        order: updatedOrder
      }), {
        status: 200,
        headers: { 'Content-Type': 'application/json', ...corsHeaders }
      });

    } catch (error) {
      console.error('Edit order error:', error);
      return new Response(JSON.stringify({ success: false, error: error.message }), {
        status: 500,
        headers: { 'Content-Type': 'application/json', ...corsHeaders }
      });
    }
  }

  return new Response(JSON.stringify({ success: false, error: 'Method not allowed' }), {
    status: 405,
    headers: { 'Content-Type': 'application/json', ...corsHeaders }
  });
}