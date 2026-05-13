// api/customer/cancel-order.js
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
          return { data: result, error: null };
        }
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

  // Only allow POST or GET
  if (request.method !== 'POST' && request.method !== 'GET') {
    return new Response(
      JSON.stringify({ success: false, error: 'Method not allowed' }),
      { status: 405, headers: { 'Content-Type': 'application/json', ...corsHeaders } }
    );
  }

  try {
    const supabase = createSupabaseClient();
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

    // =====================================================
    // GET CANCEL ELIGIBILITY
    // =====================================================
    if (request.method === 'GET') {
      const url = new URL(request.url);
      const book_id = url.searchParams.get('book_id');
      const cust_id = url.searchParams.get('cust_id');

      if (!book_id) {
        return new Response(
          JSON.stringify({ success: false, error: 'Order ID is required' }),
          { status: 400, headers: { 'Content-Type': 'application/json', ...corsHeaders } }
        );
      }

      // Get order details
      const { data: order, error: orderError } = await supabase
        .from('orders')
        .select('*')
        .eq('book_id', book_id)
        .single();

      if (orderError || !order) {
        return new Response(
          JSON.stringify({ success: false, error: 'Order not found' }),
          { status: 404, headers: { 'Content-Type': 'application/json', ...corsHeaders } }
        );
      }

      // Verify ownership if cust_id provided
      if (cust_id && order.cust_id !== cust_id) {
        return new Response(
          JSON.stringify({ success: false, error: 'Unauthorized' }),
          { status: 403, headers: { 'Content-Type': 'application/json', ...corsHeaders } }
        );
      }

      // Check if order can be cancelled
      const cancelableStatuses = ['PENDING', 'ACCEPTED', 'PACKED'];
      const isCancelable = cancelableStatuses.includes(order.status);

      const isCodeValid = order.cancel_code && 
        new Date(order.cancel_code_expiry) > new Date() &&
        order.status !== 'DELIVERED' &&
        order.status !== 'CANCELLED';

      const canCancel = isCancelable && isCodeValid;

      // Get cancellation reasons from settings
      const reasonsResult = await supabase
        .from('system_settings')
        .select('setting_value')
        .eq('setting_key', 'cancellation_reasons')
        .single();

      let cancellationReasons = [
        'Changed my mind',
        'Found better price elsewhere',
        'Order placed by mistake',
        'Delivery time too long',
        'Product not needed anymore',
        'Wrong address provided',
        'Payment issue',
        'Other'
      ];

      if (reasonsResult.data && reasonsResult.data.setting_value) {
        try {
          cancellationReasons = JSON.parse(reasonsResult.data.setting_value);
        } catch (e) {}
      }

      return new Response(
        JSON.stringify({
          success: true,
          can_cancel: canCancel,
          is_cancelable: isCancelable,
          is_code_valid: isCodeValid,
          current_status: order.status,
          cancel_code: order.cancel_code,
          cancel_code_expiry: order.cancel_code_expiry,
          cancellation_reasons: cancellationReasons,
          message: canCancel ? 'Order can be cancelled' : getCancelMessage(order.status, order.cancel_code_expiry)
        }),
        { status: 200, headers: { 'Content-Type': 'application/json', ...corsHeaders } }
      );
    }

    // =====================================================
    // CANCEL ORDER WITH CANCEL CODE (POST)
    // =====================================================
    if (request.method === 'POST') {
      const body = await request.json();
      const { 
        book_id, 
        cancel_code, 
        reason, 
        reason_detail,
        rider_id 
      } = body;

      if (!book_id) {
        return new Response(
          JSON.stringify({ success: false, error: 'Order ID is required' }),
          { status: 400, headers: { 'Content-Type': 'application/json', ...corsHeaders } }
        );
      }

      if (!cancel_code) {
        return new Response(
          JSON.stringify({ success: false, error: 'Cancel code is required' }),
          { status: 400, headers: { 'Content-Type': 'application/json', ...corsHeaders } }
        );
      }

      // Get order details with customer info
      const orderUrl = `${supabaseUrl}/rest/v1/orders?book_id=eq.${book_id}&select=*,customers!inner(cust_id,name,mobile)`;
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

      // Verify cancel code
      if (order.cancel_code !== cancel_code) {
        return new Response(
          JSON.stringify({ success: false, error: 'Invalid cancel code' }),
          { status: 400, headers: { 'Content-Type': 'application/json', ...corsHeaders } }
        );
      }

      // Check if cancel code is expired
      if (new Date(order.cancel_code_expiry) < new Date()) {
        return new Response(
          JSON.stringify({ success: false, error: 'Cancel code has expired' }),
          { status: 400, headers: { 'Content-Type': 'application/json', ...corsHeaders } }
        );
      }

      // Check if order can be cancelled
      const cancelableStatuses = ['PENDING', 'ACCEPTED', 'PACKED'];
      if (!cancelableStatuses.includes(order.status)) {
        return new Response(
          JSON.stringify({ 
            success: false, 
            error: `Order cannot be cancelled as it is already ${order.status.toLowerCase()}` 
          }),
          { status: 400, headers: { 'Content-Type': 'application/json', ...corsHeaders } }
        );
      }

      // Call database function to cancel order
      const cancelResult = await supabase.rpc('cancel_order_with_code', {
        p_book_id: book_id,
        p_cancel_code: cancel_code,
        p_rider_id: rider_id || null,
        p_reason: reason || 'Cancelled by customer'
      });

      if (cancelResult.error) {
        console.error('Cancel order error:', cancelResult.error);
        return new Response(
          JSON.stringify({ success: false, error: 'Failed to cancel order' }),
          { status: 500, headers: { 'Content-Type': 'application/json', ...corsHeaders } }
        );
      }

      // Restore product stock
      const orderItemsUrl = `${supabaseUrl}/rest/v1/order_items?book_id=eq.${book_id}&select=prod_id,quantity`;
      const orderItemsResponse = await fetch(orderItemsUrl, {
        headers: {
          'apikey': supabaseKey,
          'Authorization': `Bearer ${supabaseKey}`,
        },
      });
      const orderItems = await orderItemsResponse.json();

      if (orderItems && orderItems.length > 0) {
        for (const item of orderItems) {
          await supabase.rpc('restore_product_stock', {
            p_prod_id: item.prod_id,
            p_quantity: item.quantity
          });
        }
      }

      // Send cancellation notification to customer
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
          title: 'Order Cancelled',
          message: `Your order #${book_id} has been cancelled successfully. Reason: ${reason || 'Customer requested'}`,
          type: 'order',
          data: { order_id: book_id, cancel_code: cancel_code },
          created_at: new Date().toISOString()
        })
      });

      // Notify seller
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
          title: 'Order Cancelled',
          message: `Order #${book_id} has been cancelled by customer. Reason: ${reason || 'Customer requested'}`,
          type: 'order',
          data: { order_id: book_id },
          created_at: new Date().toISOString()
        })
      });

      // Update trust score (penalty for cancellation)
      await supabase.rpc('update_trust_score_on_cancel', {
        p_cust_id: order.cust_id
      });

      // Log cancel code usage in barcode scans
      await fetch(`${supabaseUrl}/rest/v1/barcode_scans`, {
        method: 'POST',
        headers: {
          'apikey': supabaseKey,
          'Authorization': `Bearer ${supabaseKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          barcode: cancel_code,
          barcode_type: 'CANCEL',
          scanned_by: rider_id || order.cust_id,
          scanned_by_type: rider_id ? 'rider' : 'customer',
          notes: `Order ${book_id} cancelled. Reason: ${reason}`,
          created_at: new Date().toISOString()
        })
      });

      // Calculate refund amount (if any wallet/coins were used)
      let refundWallet = 0;
      let refundCoins = 0;

      return new Response(
        JSON.stringify({
          success: true,
          message: 'Order cancelled successfully',
          data: {
            book_id: book_id,
            cancel_code: cancel_code,
            cancelled_at: new Date().toISOString(),
            refund_wallet: refundWallet,
            refund_coins: refundCoins
          }
        }),
        { status: 200, headers: { 'Content-Type': 'application/json', ...corsHeaders } }
      );
    }

    return new Response(
      JSON.stringify({ success: false, error: 'Method not allowed' }),
      { status: 405, headers: { 'Content-Type': 'application/json', ...corsHeaders } }
    );

  } catch (error) {
    console.error('Cancel order error:', error);
    return new Response(
      JSON.stringify({ success: false, error: error.message || 'Internal server error' }),
      { status: 500, headers: { 'Content-Type': 'application/json', ...corsHeaders } }
    );
  }
}

function getCancelMessage(status, expiryDate) {
  if (status === 'DELIVERED') {
    return 'Order cannot be cancelled after delivery. You can return the product instead.';
  }
  if (status === 'CANCELLED') {
    return 'Order is already cancelled.';
  }
  if (status === 'RTO') {
    return 'Order has been returned to origin.';
  }
  if (status === 'SHIPPED' || status === 'OUT_FOR_DELIVERY') {
    return 'Order has already been shipped. Please contact customer support for cancellation.';
  }
  if (expiryDate && new Date(expiryDate) < new Date()) {
    return 'Cancel code has expired. Please contact customer support.';
  }
  return 'Order cannot be cancelled at this time.';
}