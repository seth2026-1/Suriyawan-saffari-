// api/logistics/rider/delivery-scan.js
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
              },
              body: JSON.stringify(data)
            });
            return { error: null };
          }
        })
      })
    })
  };
}

export default async function handler(request) {
  // CORS Headers
  const corsHeaders = {
    'Access-Control-Allow-Credentials': 'true',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version, Authorization',
  };

  // Handle OPTIONS preflight
  if (request.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: corsHeaders });
  }

  const url = new URL(request.url);

  // =====================================================
  // GET PENDING DELIVERIES FOR TODAY
  // =====================================================
  if (request.method === 'GET') {
    try {
      const rider_id = url.searchParams.get('rider_id');

      if (!rider_id) {
        return new Response(JSON.stringify({ success: false, error: 'Rider ID is required' }), {
          status: 400,
          headers: { 'Content-Type': 'application/json', ...corsHeaders }
        });
      }

      const supabase = createSupabaseClient();
      const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
      const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

      const today = new Date().toISOString().split('T')[0];

      // Get today's runsheet
      const runsheetUrl = `${supabaseUrl}/rest/v1/runsheets?select=run_id,delivery_orders&rider_id=eq.${rider_id}&date=eq.${today}&status=neq.CANCELLED`;
      const runsheetResponse = await fetch(runsheetUrl, {
        headers: {
          'apikey': supabaseKey,
          'Authorization': `Bearer ${supabaseKey}`,
        },
      });
      const runsheetData = await runsheetResponse.json();
      const runsheet = runsheetData[0];

      if (!runsheet || !runsheet.delivery_orders || runsheet.delivery_orders.length === 0) {
        return new Response(JSON.stringify({
          success: true,
          has_deliveries: false,
          message: 'No delivery orders assigned for today'
        }), {
          status: 200,
          headers: { 'Content-Type': 'application/json', ...corsHeaders }
        });
      }

      // Get delivery order details
      const deliveryIdsList = runsheet.delivery_orders.map(id => `'${id}'`).join(',');
      const deliveriesUrl = `${supabaseUrl}/rest/v1/orders?select=book_id,tracking_id,final_amount,address,placed_at,customers!inner(cust_id,name,mobile),order_items!inner(quantity,products!inner(name,images))&book_id=in.(${deliveryIdsList})`;
      const deliveriesResponse = await fetch(deliveriesUrl, {
        headers: {
          'apikey': supabaseKey,
          'Authorization': `Bearer ${supabaseKey}`,
        },
      });
      const deliveries = await deliveriesResponse.json();

      // Get completed deliveries
      const completedUrl = `${supabaseUrl}/rest/v1/shipment_tracking?select=book_id&book_id=in.(${deliveryIdsList})&status=eq.DELIVERED&rider_id=eq.${rider_id}`;
      const completedResponse = await fetch(completedUrl, {
        headers: {
          'apikey': supabaseKey,
          'Authorization': `Bearer ${supabaseKey}`,
        },
      });
      const completedScans = await completedResponse.json();

      const completedIds = new Set(completedScans?.map(c => c.book_id) || []);

      const pendingDeliveries = deliveries?.filter(d => !completedIds.has(d.book_id)).map(d => ({
        book_id: d.book_id,
        tracking_id: d.tracking_id,
        amount: d.final_amount,
        customer_name: d.customers?.name,
        customer_mobile: d.customers?.mobile,
        address: d.address,
        items: d.order_items?.map(i => ({
          name: i.products?.name,
          quantity: i.quantity,
          image: i.products?.images?.[0] || null
        })) || []
      })) || [];

      // Calculate total COD amount
      const totalCod = pendingDeliveries.reduce((sum, d) => sum + d.amount, 0);

      return new Response(JSON.stringify({
        success: true,
        has_deliveries: pendingDeliveries.length > 0,
        total_deliveries: runsheet.delivery_orders.length,
        completed_deliveries: completedScans?.length || 0,
        pending_deliveries: pendingDeliveries,
        total_cod_amount: totalCod,
        runsheet_id: runsheet.run_id
      }), {
        status: 200,
        headers: { 'Content-Type': 'application/json', ...corsHeaders }
      });

    } catch (error) {
      console.error('Get pending deliveries error:', error);
      return new Response(JSON.stringify({ success: false, error: error.message }), {
        status: 500,
        headers: { 'Content-Type': 'application/json', ...corsHeaders }
      });
    }
  }

  // =====================================================
  // PROCESS DELIVERY SCAN (POST)
  // =====================================================
  if (request.method === 'POST') {
    try {
      const body = await request.json();
      const {
        rider_id,
        book_id,
        barcode,
        location,
        open_box_verified,
        customer_signature,
        product_photo,
        cancel_code,
        delivery_type,
        notes
      } = body;

      if ((!rider_id || !book_id) && (!rider_id || !barcode)) {
        return new Response(JSON.stringify({
          success: false,
          error: 'Rider ID and either Order ID or barcode are required'
        }), {
          status: 400,
          headers: { 'Content-Type': 'application/json', ...corsHeaders }
        });
      }

      const supabase = createSupabaseClient();
      const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
      const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

      let targetBookId = book_id;
      let cancelCodeUsed = cancel_code;

      // If barcode provided, find order by barcode
      if (barcode && !targetBookId) {
        if (barcode.startsWith('BOOK')) {
          targetBookId = barcode;
        } else if (barcode.startsWith('SS')) {
          const orderUrl = `${supabaseUrl}/rest/v1/orders?tracking_id=eq.${barcode}&select=book_id,cancel_code`;
          const orderResponse = await fetch(orderUrl, {
            headers: {
              'apikey': supabaseKey,
              'Authorization': `Bearer ${supabaseKey}`,
            },
          });
          const orderData = await orderResponse.json();
          const order = orderData[0];
          if (order) {
            targetBookId = order.book_id;
            if (!cancelCodeUsed) cancelCodeUsed = order.cancel_code;
          }
        } else if (barcode.match(/^[0-9]{6}$/)) {
          // Cancel code scan
          const orderUrl = `${supabaseUrl}/rest/v1/orders?cancel_code=eq.${barcode}&select=book_id,cancel_code`;
          const orderResponse = await fetch(orderUrl, {
            headers: {
              'apikey': supabaseKey,
              'Authorization': `Bearer ${supabaseKey}`,
            },
          });
          const orderData = await orderResponse.json();
          const order = orderData[0];
          if (order) {
            targetBookId = order.book_id;
            cancelCodeUsed = barcode;
          }
        }
      }

      if (!targetBookId) {
        return new Response(JSON.stringify({ success: false, error: 'Invalid order identifier' }), {
          status: 400,
          headers: { 'Content-Type': 'application/json', ...corsHeaders }
        });
      }

      // Get order details with customer info
      const orderSelect = `*, customers!inner (cust_id, name, mobile)`;
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

      // Check if order is already delivered
      const existingUrl = `${supabaseUrl}/rest/v1/shipment_tracking?select=track_id&book_id=eq.${targetBookId}&status=eq.DELIVERED`;
      const existingResponse = await fetch(existingUrl, {
        headers: {
          'apikey': supabaseKey,
          'Authorization': `Bearer ${supabaseKey}`,
        },
      });
      const existingData = await existingResponse.json();
      const existingDelivery = existingData[0];

      if (existingDelivery) {
        return new Response(JSON.stringify({
          success: false,
          error: 'This order has already been delivered',
          already_scanned: true
        }), {
          status: 400,
          headers: { 'Content-Type': 'application/json', ...corsHeaders }
        });
      }

      // Handle cancellation if cancel code provided
      if (cancelCodeUsed) {
        if (order.cancel_code !== cancelCodeUsed) {
          return new Response(JSON.stringify({ success: false, error: 'Invalid cancel code' }), {
            status: 400,
            headers: { 'Content-Type': 'application/json', ...corsHeaders }
          });
        }

        if (new Date(order.cancel_code_expiry) < new Date()) {
          return new Response(JSON.stringify({ success: false, error: 'Cancel code has expired' }), {
            status: 400,
            headers: { 'Content-Type': 'application/json', ...corsHeaders }
          });
        }

        if (order.status === 'DELIVERED') {
          return new Response(JSON.stringify({ success: false, error: 'Order already delivered, cannot cancel' }), {
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
            cancel_reason: 'Cancelled by customer at delivery',
            cancel_code_used_by: rider_id,
            cancel_code_used_at: new Date().toISOString()
          })
        });

        // Add tracking entry for cancellation
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
            notes: `Order cancelled using cancel code: ${cancelCodeUsed}`,
            created_at: new Date().toISOString()
          })
        });

        // Log barcode scan
        await fetch(`${supabaseUrl}/rest/v1/barcode_scans`, {
          method: 'POST',
          headers: {
            'apikey': supabaseKey,
            'Authorization': `Bearer ${supabaseKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            barcode: cancelCodeUsed,
            barcode_type: 'CANCEL',
            scanned_by: rider_id,
            scanned_by_type: 'rider',
            location: location,
            notes: 'Order cancelled using cancel code',
            created_at: new Date().toISOString()
          })
        });

        // Send cancellation notification
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
            message: `Your order ${targetBookId} has been cancelled at delivery.`,
            type: 'order',
            data: { book_id: targetBookId, cancel_code: cancelCodeUsed },
            created_at: new Date().toISOString()
          })
        });

        return new Response(JSON.stringify({
          success: true,
          message: 'Order cancelled successfully',
          delivery: {
            book_id: targetBookId,
            status: 'CANCELLED',
            cancelled_at: new Date().toISOString()
          },
          type: 'cancellation'
        }), {
          status: 200,
          headers: { 'Content-Type': 'application/json', ...corsHeaders }
        });
      }

      // Normal delivery process
      if (!open_box_verified) {
        return new Response(JSON.stringify({
          success: false,
          error: 'Open box verification is required before delivery'
        }), {
          status: 400,
          headers: { 'Content-Type': 'application/json', ...corsHeaders }
        });
      }

      // Update order status
      await fetch(`${supabaseUrl}/rest/v1/orders?book_id=eq.${targetBookId}`, {
        method: 'PATCH',
        headers: {
          'apikey': supabaseKey,
          'Authorization': `Bearer ${supabaseKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          status: 'DELIVERED',
          delivered_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
          delivered_by: rider_id
        })
      });

      // Add tracking entry
      await fetch(`${supabaseUrl}/rest/v1/shipment_tracking`, {
        method: 'POST',
        headers: {
          'apikey': supabaseKey,
          'Authorization': `Bearer ${supabaseKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          book_id: targetBookId,
          status: 'DELIVERED',
          location: location || 'Customer Address',
          rider_id: rider_id,
          notes: notes || `Open box delivery completed. Customer signature: ${customer_signature ? 'Yes' : 'No'}`,
          photo: product_photo || null,
          created_at: new Date().toISOString()
        })
      });

      // Update runsheet delivery count
      const today = new Date().toISOString().split('T')[0];
      const runsheetUrl = `${supabaseUrl}/rest/v1/runsheets?select=run_id,total_deliveries,completed_deliveries&rider_id=eq.${rider_id}&date=eq.${today}&status=neq.CANCELLED`;
      const runsheetResponse = await fetch(runsheetUrl, {
        headers: {
          'apikey': supabaseKey,
          'Authorization': `Bearer ${supabaseKey}`,
        },
      });
      const runsheetData = await runsheetResponse.json();
      const runsheet = runsheetData[0];

      if (runsheet) {
        const completedDeliveries = (runsheet.completed_deliveries || 0) + 1;
        await fetch(`${supabaseUrl}/rest/v1/runsheets?run_id=eq.${runsheet.run_id}`, {
          method: 'PATCH',
          headers: {
            'apikey': supabaseKey,
            'Authorization': `Bearer ${supabaseKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ completed_deliveries: completedDeliveries })
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
          barcode: targetBookId,
          barcode_type: 'BOOK',
          scanned_by: rider_id,
          scanned_by_type: 'rider',
          location: location,
          notes: 'Delivery completed with open box verification',
          created_at: new Date().toISOString()
        })
      });

      // Add rider earning for delivery (₹18 per delivery)
      const riderRate = 18;
      
      // Get current wallet balance
      const riderUrl = `${supabaseUrl}/rest/v1/riders?select=wallet_balance,total_deliveries&rider_id=eq.${rider_id}`;
      const riderResponse = await fetch(riderUrl, {
        headers: {
          'apikey': supabaseKey,
          'Authorization': `Bearer ${supabaseKey}`,
        },
      });
      const riderData = await riderResponse.json();
      const riderInfo = riderData[0];
      const currentBalance = riderInfo?.wallet_balance || 0;
      const currentDeliveries = riderInfo?.total_deliveries || 0;

      await fetch(`${supabaseUrl}/rest/v1/wallet_transactions`, {
        method: 'POST',
        headers: {
          'apikey': supabaseKey,
          'Authorization': `Bearer ${supabaseKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          user_id: rider_id,
          user_type: 'rider',
          amount: riderRate,
          type: 'credit',
          reason: `Delivery completed for order ${targetBookId}`,
          reference_id: targetBookId,
          created_at: new Date().toISOString()
        })
      });

      await fetch(`${supabaseUrl}/rest/v1/riders?rider_id=eq.${rider_id}`, {
        method: 'PATCH',
        headers: {
          'apikey': supabaseKey,
          'Authorization': `Bearer ${supabaseKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          wallet_balance: currentBalance + riderRate,
          total_deliveries: currentDeliveries + 1
        })
      });

      // Send delivery notification to customer
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
          title: 'Order Delivered! 🎉',
          message: `Your order ${targetBookId} has been delivered successfully. Thank you for shopping with Suriyawan Saffari!`,
          type: 'delivery',
          data: { book_id: targetBookId, tracking_id: order.tracking_id },
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
          title: 'Order Delivered',
          message: `Order ${targetBookId} has been delivered successfully.`,
          type: 'order',
          data: { book_id: targetBookId },
          created_at: new Date().toISOString()
        })
      });

      return new Response(JSON.stringify({
        success: true,
        message: 'Delivery completed successfully',
        delivery: {
          book_id: targetBookId,
          tracking_id: order.tracking_id,
          status: 'DELIVERED',
          delivered_at: new Date().toISOString(),
          earning: riderRate
        },
        type: 'delivery',
        next_step: 'Proceed to next delivery'
      }), {
        status: 200,
        headers: { 'Content-Type': 'application/json', ...corsHeaders }
      });

    } catch (error) {
      console.error('Delivery scan error:', error);
      return new Response(JSON.stringify({ success: false, error: error.message }), {
        status: 500,
        headers: { 'Content-Type': 'application/json', ...corsHeaders }
      });
    }
  }

  return new Response(JSON.stringify({ success: false, error: 'Method not allowed' }), {
    status: 405,
    headers: { 'ContentType': 'application/json', ...corsHeaders }
  });
}