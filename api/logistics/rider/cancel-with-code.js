// api/logistics/rider/cancel-with-code.js
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
          }),
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
              },
              body: JSON.stringify(data)
            });
            return { error: null };
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

  // =====================================================
  // VERIFY CANCEL CODE (GET)
  // =====================================================
  if (request.method === 'GET') {
    try {
      const cancel_code = url.searchParams.get('cancel_code');

      if (!cancel_code) {
        return new Response(JSON.stringify({ success: false, error: 'Cancel code is required' }), {
          status: 400,
          headers: { 'Content-Type': 'application/json', ...corsHeaders }
        });
      }

      const supabase = createSupabaseClient();
      const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
      const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

      // Find order with this cancel code
      const orderUrl = `${supabaseUrl}/rest/v1/orders?select=book_id,tracking_id,final_amount,status,cancel_code_expiry,customers!inner(name,mobile)&cancel_code=eq.${cancel_code}`;
      const orderResponse = await fetch(orderUrl, {
        headers: {
          'apikey': supabaseKey,
          'Authorization': `Bearer ${supabaseKey}`,
        },
      });
      const orderData = await orderResponse.json();
      const order = orderData[0];

      if (!order) {
        return new Response(JSON.stringify({
          success: false,
          error: 'Invalid cancel code',
          valid: false
        }), {
          status: 404,
          headers: { 'Content-Type': 'application/json', ...corsHeaders }
        });
      }

      // Check if cancel code is expired
      const isExpired = new Date(order.cancel_code_expiry) < new Date();

      // Check if order can be cancelled
      const cancelableStatuses = ['PENDING', 'ACCEPTED', 'PACKED', 'SHIPPED', 'OUT_FOR_DELIVERY'];
      const canCancel = cancelableStatuses.includes(order.status) && !isExpired;

      return new Response(JSON.stringify({
        success: true,
        valid: true,
        can_cancel: canCancel,
        order: {
          book_id: order.book_id,
          tracking_id: order.tracking_id,
          amount: order.final_amount,
          status: order.status,
          status_display: getStatusDisplay(order.status),
          customer_name: order.customers?.name,
          customer_mobile: order.customers?.mobile,
          cancel_code_expiry: order.cancel_code_expiry,
          is_expired: isExpired
        },
        message: canCancel ? 'Cancel code is valid. Order can be cancelled.' :
                 (isExpired ? 'Cancel code has expired.' : `Order cannot be cancelled as it is already ${order.status.toLowerCase()}.`)
      }), {
        status: 200,
        headers: { 'Content-Type': 'application/json', ...corsHeaders }
      });

    } catch (error) {
      console.error('Verify cancel code error:', error);
      return new Response(JSON.stringify({ success: false, error: error.message }), {
        status: 500,
        headers: { 'Content-Type': 'application/json', ...corsHeaders }
      });
    }
  }

  // =====================================================
  // PROCESS CANCELLATION WITH CANCEL CODE (POST)
  // =====================================================
  if (request.method === 'POST') {
    try {
      const body = await request.json();
      const {
        rider_id,
        cancel_code,
        book_id,
        reason,
        reason_detail,
        product_photo,
        location,
        notes
      } = body;

      if ((!rider_id || !cancel_code) && (!rider_id || !book_id)) {
        return new Response(JSON.stringify({
          success: false,
          error: 'Rider ID and either Cancel Code or Order ID are required'
        }), {
          status: 400,
          headers: { 'Content-Type': 'application/json', ...corsHeaders }
        });
      }

      const supabase = createSupabaseClient();
      const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
      const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

      let targetBookId = book_id;
      let targetCancelCode = cancel_code;

      // If book_id provided but no cancel_code, get it from order
      if (targetBookId && !targetCancelCode) {
        const orderUrl = `${supabaseUrl}/rest/v1/orders?book_id=eq.${targetBookId}&select=cancel_code`;
        const orderResponse = await fetch(orderUrl, {
          headers: {
            'apikey': supabaseKey,
            'Authorization': `Bearer ${supabaseKey}`,
          },
        });
        const orderData = await orderResponse.json();
        const order = orderData[0];
        if (order) targetCancelCode = order.cancel_code;
      }

      // If cancel_code provided but no book_id, get order
      if (targetCancelCode && !targetBookId) {
        const orderUrl = `${supabaseUrl}/rest/v1/orders?cancel_code=eq.${targetCancelCode}&select=book_id`;
        const orderResponse = await fetch(orderUrl, {
          headers: {
            'apikey': supabaseKey,
            'Authorization': `Bearer ${supabaseKey}`,
          },
        });
        const orderData = await orderResponse.json();
        const order = orderData[0];
        if (order) targetBookId = order.book_id;
      }

      if (!targetBookId || !targetCancelCode) {
        return new Response(JSON.stringify({ success: false, error: 'Invalid cancel code or order ID' }), {
          status: 400,
          headers: { 'Content-Type': 'application/json', ...corsHeaders }
        });
      }

      // Get order details with customer and seller info
      const orderSelect = `*,
        customers!inner (
          cust_id,
          name,
          mobile,
          email
        ),
        sellers!inner (
          seller_id,
          shop_name
        )`;
      const orderUrl = `${supabaseUrl}/rest/v1/orders?select=${encodeURIComponent(orderSelect)}&book_id=eq.${targetBookId}`;
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

      // Verify cancel code matches
      if (order.cancel_code !== targetCancelCode) {
        return new Response(JSON.stringify({ success: false, error: 'Invalid cancel code for this order' }), {
          status: 400,
          headers: { 'Content-Type': 'application/json', ...corsHeaders }
        });
      }

      // Check if cancel code is expired
      if (new Date(order.cancel_code_expiry) < new Date()) {
        return new Response(JSON.stringify({
          success: false,
          error: 'Cancel code has expired',
          expiry_date: order.cancel_code_expiry
        }), {
          status: 400,
          headers: { 'Content-Type': 'application/json', ...corsHeaders }
        });
      }

      // Check if order can be cancelled
      const cancelableStatuses = ['PENDING', 'ACCEPTED', 'PACKED', 'SHIPPED', 'OUT_FOR_DELIVERY'];
      if (!cancelableStatuses.includes(order.status)) {
        return new Response(JSON.stringify({
          success: false,
          error: `Order cannot be cancelled as it is already ${order.status.toLowerCase()}`
        }), {
          status: 400,
          headers: { 'Content-Type': 'application/json', ...corsHeaders }
        });
      }

      // Cancel the order
      await fetch(`${supabaseUrl}/rest/v1/orders?book_id=eq.${targetBookId}`, {
        method: 'PATCH',
        headers: {
          'apikey': supabaseKey,
          'Authorization': `Bearer ${supabaseKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          status: 'CANCELLED',
          cancelled_at: new Date().toISOString(),
          cancel_reason: reason || 'Cancelled by customer using cancel code',
          cancel_reason_detail: reason_detail || null,
          cancel_code_used_by: rider_id,
          cancel_code_used_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        })
      });

      // Add shipment tracking entry
      await fetch(`${supabaseUrl}/rest/v1/shipment_tracking`, {
        method: 'POST',
        headers: {
          'apikey': supabaseKey,
          'Authorization': `Bearer ${supabaseKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          book_id: targetBookId,
          status: 'CANCELLED',
          location: location || 'Delivery Location',
          rider_id: rider_id,
          notes: notes || `Order cancelled using cancel code. Reason: ${reason || 'Customer requested'}`,
          photo: product_photo || null,
          created_at: new Date().toISOString()
        })
      });

      // Restore product stock
      const orderItemsUrl = `${supabaseUrl}/rest/v1/order_items?select=prod_id,quantity&book_id=eq.${targetBookId}`;
      const orderItemsResponse = await fetch(orderItemsUrl, {
        headers: {
          'apikey': supabaseKey,
          'Authorization': `Bearer ${supabaseKey}`,
        },
      });
      const orderItems = await orderItemsResponse.json();

      for (const item of orderItems || []) {
        const productUrl = `${supabaseUrl}/rest/v1/products?prod_id=eq.${item.prod_id}&select=stock`;
        const productResponse = await fetch(productUrl, {
          headers: {
            'apikey': supabaseKey,
            'Authorization': `Bearer ${supabaseKey}`,
          },
        });
        const productData = await productResponse.json();
        const currentStock = productData[0]?.stock || 0;

        await fetch(`${supabaseUrl}/rest/v1/products?prod_id=eq.${item.prod_id}`, {
          method: 'PATCH',
          headers: {
            'apikey': supabaseKey,
            'Authorization': `Bearer ${supabaseKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ stock: currentStock + item.quantity })
        });
      }

      // Log barcode scan
      await fetch(`${supabaseUrl}/rest/v1/barcode_scans`, {
        method: 'POST',
        headers: {
          'apikey': supabaseKey,
          'Authorization': `Bearer ${supabaseKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          barcode: targetCancelCode,
          barcode_type: 'CANCEL',
          scanned_by: rider_id,
          scanned_by_type: 'rider',
          location: location,
          notes: `Order ${targetBookId} cancelled. Reason: ${reason || 'Customer request'}`,
          created_at: new Date().toISOString()
        })
      });

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
          message: `Your order ${targetBookId} has been cancelled using cancel code. Reason: ${reason || 'Customer requested'}`,
          type: 'order',
          data: { book_id: targetBookId, cancel_code: targetCancelCode },
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
          title: 'Order Cancelled',
          message: `Order ${targetBookId} has been cancelled by customer at delivery.`,
          type: 'order',
          data: { book_id: targetBookId },
          created_at: new Date().toISOString()
        })
      });

      // Update runsheet if this order was in today's runsheet
      const today = new Date().toISOString().split('T')[0];
      const runsheetUrl = `${supabaseUrl}/rest/v1/runsheets?select=run_id,delivery_orders,cancelled_orders&rider_id=eq.${rider_id}&date=eq.${today}&status=neq.CANCELLED`;
      const runsheetResponse = await fetch(runsheetUrl, {
        headers: {
          'apikey': supabaseKey,
          'Authorization': `Bearer ${supabaseKey}`,
        },
      });
      const runsheetData = await runsheetResponse.json();
      const runsheet = runsheetData[0];

      if (runsheet && runsheet.delivery_orders && runsheet.delivery_orders.includes(targetBookId)) {
        const cancelledOrders = [...(runsheet.cancelled_orders || []), targetBookId];
        await fetch(`${supabaseUrl}/rest/v1/runsheets?run_id=eq.${runsheet.run_id}`, {
          method: 'PATCH',
          headers: {
            'apikey': supabaseKey,
            'Authorization': `Bearer ${supabaseKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ cancelled_orders: cancelledOrders })
        });
      }

      // Update trust score (penalty for cancellation)
      await supabase.rpc('update_trust_score_on_cancel', {
        p_cust_id: order.cust_id
      });

      return new Response(JSON.stringify({
        success: true,
        message: 'Order cancelled successfully',
        cancellation: {
          book_id: targetBookId,
          cancel_code: targetCancelCode,
          cancelled_at: new Date().toISOString(),
          reason: reason || 'Customer requested'
        },
        next_steps: [
          'Return the product to hub',
          'Mark as RTO if applicable',
          'Update inventory status'
        ]
      }), {
        status: 200,
        headers: { 'Content-Type': 'application/json', ...corsHeaders }
      });

    } catch (error) {
      console.error('Cancel with code error:', error);
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