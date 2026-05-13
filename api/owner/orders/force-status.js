// api/owner/orders/force-status.js
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
            in: (field2, values) => ({
              select: async (columns2) => {
                const finalUrl = `${url}&${field}=eq.${value}&${field2}=in.(${values.join(',')})&select=${columns2 || '*'}`;
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

export default async function handler(request) {
  // CORS Headers
  const corsHeaders = {
    'Access-Control-Allow-Credentials': 'true',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'POST, GET, OPTIONS',
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
  // GET AVAILABLE STATUSES (GET)
  // =====================================================
  if (request.method === 'GET') {
    try {
      const statuses = [
        { value: 'PENDING', label: 'Pending', color: '#f59e0b', requires_reason: false },
        { value: 'ACCEPTED', label: 'Accepted', color: '#3b82f6', requires_reason: false },
        { value: 'PACKED', label: 'Packed', color: '#8b5cf6', requires_reason: false },
        { value: 'SHIPPED', label: 'Shipped', color: '#06b6d4', requires_reason: false },
        { value: 'OUT_FOR_DELIVERY', label: 'Out for Delivery', color: '#10b981', requires_reason: false },
        { value: 'DELIVERED', label: 'Delivered', color: '#22c55e', requires_reason: false },
        { value: 'CANCELLED', label: 'Cancelled', color: '#ef4444', requires_reason: true },
        { value: 'RTO', label: 'Return to Origin', color: '#ef4444', requires_reason: true }
      ];

      return new Response(JSON.stringify({
        success: true,
        statuses: statuses
      }), {
        status: 200,
        headers: { 'Content-Type': 'application/json', ...corsHeaders }
      });

    } catch (error) {
      console.error('Get statuses error:', error);
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
      const {
        book_id,
        new_status,
        reason,
        notes,
        notify_customer = true,
        notify_seller = true
      } = body;

      if (!book_id || !new_status) {
        return new Response(JSON.stringify({
          success: false,
          error: 'Order ID and new status are required'
        }), {
          status: 400,
          headers: { 'Content-Type': 'application/json', ...corsHeaders }
        });
      }

      // Validate status
      const validStatuses = ['PENDING', 'ACCEPTED', 'PACKED', 'SHIPPED', 'OUT_FOR_DELIVERY', 'DELIVERED', 'CANCELLED', 'RTO'];
      if (!validStatuses.includes(new_status)) {
        return new Response(JSON.stringify({ success: false, error: 'Invalid status' }), {
          status: 400,
          headers: { 'Content-Type': 'application/json', ...corsHeaders }
        });
      }

      // Get current order details with customer and seller info
      const orderSelect = `*, customers!inner(cust_id,name,email,mobile), sellers!inner(seller_id,shop_name,email as seller_email)`;
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

      // Prevent force update if already in same status
      if (order.status === new_status) {
        return new Response(JSON.stringify({
          success: false,
          error: `Order is already in ${new_status} status`
        }), {
          status: 400,
          headers: { 'Content-Type': 'application/json', ...corsHeaders }
        });
      }

      // Build update data
      const updateData = {
        status: new_status,
        updated_at: new Date().toISOString(),
        force_status_reason: reason || null,
        force_status_by: 'OWN001',
        force_status_at: new Date().toISOString(),
        force_status_notes: notes || null
      };

      // Add timestamp based on new status
      switch (new_status) {
        case 'ACCEPTED':
          updateData.accepted_at = new Date().toISOString();
          break;
        case 'PACKED':
          updateData.packed_at = new Date().toISOString();
          break;
        case 'SHIPPED':
          updateData.shipped_at = new Date().toISOString();
          break;
        case 'OUT_FOR_DELIVERY':
          updateData.out_for_delivery_at = new Date().toISOString();
          break;
        case 'DELIVERED':
          updateData.delivered_at = new Date().toISOString();
          break;
        case 'CANCELLED':
          updateData.cancelled_at = new Date().toISOString();
          updateData.cancel_reason = reason || 'Forced cancellation by admin';
          break;
        case 'RTO':
          updateData.rto_at = new Date().toISOString();
          updateData.cancel_reason = reason || 'Forced RTO by admin';
          break;
      }

      // If moving to DELIVERED, add rider earning
      if (new_status === 'DELIVERED' && order.rider_id) {
        const riderRate = 18;
        
        // Get current rider data
        const riderUrl = `${supabaseUrl}/rest/v1/riders?select=wallet_balance&rider_id=eq.${order.rider_id}`;
        const riderResponse = await fetch(riderUrl, {
          headers: {
            'apikey': supabaseKey,
            'Authorization': `Bearer ${supabaseKey}`,
          },
        });
        const riderData = await riderResponse.json();
        const currentBalance = riderData[0]?.wallet_balance || 0;

        await fetch(`${supabaseUrl}/rest/v1/wallet_transactions`, {
          method: 'POST',
          headers: {
            'apikey': supabaseKey,
            'Authorization': `Bearer ${supabaseKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            user_id: order.rider_id,
            user_type: 'rider',
            amount: riderRate,
            type: 'credit',
            reason: `Force delivery completed for order ${book_id}`,
            reference_id: book_id,
            created_at: new Date().toISOString()
          })
        });

        await fetch(`${supabaseUrl}/rest/v1/riders?rider_id=eq.${order.rider_id}`, {
          method: 'PATCH',
          headers: {
            'apikey': supabaseKey,
            'Authorization': `Bearer ${supabaseKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ wallet_balance: currentBalance + riderRate })
        });
      }

      // Update order
      const updateResult = await supabase
        .from('orders')
        .update(updateData)
        .eq('book_id', book_id)
        .select();

      if (updateResult.error) {
        console.error('Force status update error:', updateResult.error);
        return new Response(JSON.stringify({ success: false, error: updateResult.error.message }), {
          status: 500,
          headers: { 'Content-Type': 'application/json', ...corsHeaders }
        });
      }

      const updatedOrder = updateResult.data;

      // Add shipment tracking entry
      await fetch(`${supabaseUrl}/rest/v1/shipment_tracking`, {
        method: 'POST',
        headers: {
          'apikey': supabaseKey,
          'Authorization': `Bearer ${supabaseKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          book_id,
          status: new_status,
          notes: `Force status update by admin. Previous status: ${order.status}. ${reason ? `Reason: ${reason}` : ''} ${notes || ''}`,
          created_at: new Date().toISOString()
        })
      });

      // Log audit entry
      await fetch(`${supabaseUrl}/rest/v1/audit_logs`, {
        method: 'POST',
        headers: {
          'apikey': supabaseKey,
          'Authorization': `Bearer ${supabaseKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          table_name: 'orders',
          record_id: book_id,
          action: 'FORCE_STATUS',
          old_data: { status: order.status },
          new_data: { status: new_status, reason: reason },
          changed_by: 'OWN001',
          changed_at: new Date().toISOString(),
          reason: reason
        })
      });

      // Send notification to customer
      if (notify_customer) {
        let customerMessage = '';
        if (new_status === 'DELIVERED') {
          customerMessage = `Great news! Your order ${book_id} has been marked as delivered. Thank you for shopping with us!`;
        } else if (new_status === 'CANCELLED') {
          customerMessage = `Your order ${book_id} has been cancelled by admin. Reason: ${reason || 'Not specified'}`;
        } else if (new_status === 'RTO') {
          customerMessage = `Your order ${book_id} is being returned to origin. Reason: ${reason || 'Delivery issue'}`;
        } else {
          customerMessage = `Your order ${book_id} status has been updated to ${getStatusDisplay(new_status)}.`;
        }

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
            title: `Order ${getStatusDisplay(new_status)}`,
            message: customerMessage,
            type: 'order',
            data: { book_id, status: new_status },
            created_at: new Date().toISOString()
          })
        });
      }

      // Send notification to seller
      if (notify_seller) {
        let sellerMessage = '';
        if (new_status === 'DELIVERED') {
          sellerMessage = `Order ${book_id} has been marked as delivered.`;
        } else if (new_status === 'CANCELLED') {
          sellerMessage = `Order ${book_id} has been cancelled by admin. Reason: ${reason || 'Not specified'}`;
        } else if (new_status === 'RTO') {
          sellerMessage = `Order ${book_id} has been marked as RTO by admin.`;
        } else {
          sellerMessage = `Order ${book_id} status has been force updated to ${getStatusDisplay(new_status)} by admin.`;
        }

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
            title: `Order ${getStatusDisplay(new_status)}`,
            message: sellerMessage,
            type: 'order',
            data: { book_id, status: new_status },
            created_at: new Date().toISOString()
          })
        });
      }

      // If RTO, update trust score
      if (new_status === 'RTO') {
        await supabase.rpc('update_trust_score_on_rto', {
          p_cust_id: order.cust_id
        });
      }

      return new Response(JSON.stringify({
        success: true,
        message: `Order status force updated to ${getStatusDisplay(new_status)}`,
        order: {
          book_id: updatedOrder.book_id,
          old_status: order.status,
          new_status: updatedOrder.status,
          updated_at: updatedOrder.updated_at,
          reason: reason,
          notes: notes
        },
        notifications_sent: {
          customer: notify_customer,
          seller: notify_seller
        }
      }), {
        status: 200,
        headers: { 'Content-Type': 'application/json', ...corsHeaders }
      });

    } catch (error) {
      console.error('Force status error:', error);
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