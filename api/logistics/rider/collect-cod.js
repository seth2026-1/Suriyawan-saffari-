// api/logistics/rider/collect-cod.js
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
            }),
            contains: (containsField, containsValue) => ({
              maybeSingle: async () => {
                const finalUrl = `${url}&${field}=eq.${value}&${containsField}=cs.{${containsValue.join(',')}}`;
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
  // GET COD COLLECTION SUMMARY FOR TODAY
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
      const runsheetUrl = `${supabaseUrl}/rest/v1/runsheets?select=run_id,total_cod,delivery_orders&rider_id=eq.${rider_id}&date=eq.${today}&status=neq.CANCELLED`;
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
          has_collection: false,
          message: 'No COD deliveries assigned for today'
        }), {
          status: 200,
          headers: { 'Content-Type': 'application/json', ...corsHeaders }
        });
      }

      // Get delivered orders with COD
      const deliveryIdsList = runsheet.delivery_orders.map(id => `'${id}'`).join(',');
      const deliveredOrdersUrl = `${supabaseUrl}/rest/v1/orders?select=book_id,final_amount,delivered_at&book_id=in.(${deliveryIdsList})&status=eq.DELIVERED&payment_method=eq.COD`;
      const deliveredOrdersResponse = await fetch(deliveredOrdersUrl, {
        headers: {
          'apikey': supabaseKey,
          'Authorization': `Bearer ${supabaseKey}`,
        },
      });
      const deliveredOrders = await deliveredOrdersResponse.json();

      // Get COD payments already collected/recorded
      const collectedCodUrl = `${supabaseUrl}/rest/v1/cod_payments?select=book_id,amount&rider_id=eq.${rider_id}&date=eq.${today}`;
      const collectedCodResponse = await fetch(collectedCodUrl, {
        headers: {
          'apikey': supabaseKey,
          'Authorization': `Bearer ${supabaseKey}`,
        },
      });
      const collectedCod = await collectedCodResponse.json();

      const collectedIds = new Set(collectedCod?.map(c => c.book_id) || []);
      const collectedAmount = collectedCod?.reduce((sum, c) => sum + c.amount, 0) || 0;

      const pendingOrders = deliveredOrders?.filter(d => !collectedIds.has(d.book_id)) || [];
      const pendingAmount = pendingOrders.reduce((sum, d) => sum + d.final_amount, 0);

      return new Response(JSON.stringify({
        success: true,
        has_collection: pendingOrders.length > 0,
        summary: {
          total_cod_expected: runsheet.total_cod || 0,
          collected_today: collectedAmount,
          pending_collection: pendingAmount,
          total_deliveries: runsheet.delivery_orders.length,
          delivered_count: deliveredOrders?.length || 0,
          pending_deliveries: runsheet.delivery_orders.length - (deliveredOrders?.length || 0)
        },
        pending_orders: pendingOrders.map(order => ({
          book_id: order.book_id,
          amount: order.final_amount,
          delivered_at: order.delivered_at
        })),
        runsheet_id: runsheet.run_id
      }), {
        status: 200,
        headers: { 'Content-Type': 'application/json', ...corsHeaders }
      });

    } catch (error) {
      console.error('Get COD collection error:', error);
      return new Response(JSON.stringify({ success: false, error: error.message }), {
        status: 500,
        headers: { 'Content-Type': 'application/json', ...corsHeaders }
      });
    }
  }

  // =====================================================
  // RECORD COD COLLECTION (POST)
  // =====================================================
  if (request.method === 'POST') {
    try {
      const body = await request.json();
      const {
        rider_id,
        book_id,
        amount,
        payment_method,
        customer_signature,
        notes
      } = body;

      if (!rider_id || !book_id || !amount) {
        return new Response(JSON.stringify({
          success: false,
          error: 'Rider ID, Order ID and amount are required'
        }), {
          status: 400,
          headers: { 'Content-Type': 'application/json', ...corsHeaders }
        });
      }

      const supabase = createSupabaseClient();
      const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
      const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

      // Verify order exists and is delivered
      const orderUrl = `${supabaseUrl}/rest/v1/orders?select=book_id,final_amount,status,cust_id&book_id=eq.${book_id}`;
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

      if (order.status !== 'DELIVERED') {
        return new Response(JSON.stringify({
          success: false,
          error: `Order is not delivered yet. Current status: ${order.status}`
        }), {
          status: 400,
          headers: { 'Content-Type': 'application/json', ...corsHeaders }
        });
      }

      if (amount !== order.final_amount) {
        return new Response(JSON.stringify({
          success: false,
          error: `Amount mismatch. Expected: ₹${order.final_amount}, Received: ₹${amount}`
        }), {
          status: 400,
          headers: { 'Content-Type': 'application/json', ...corsHeaders }
        });
      }

      // Check if COD already recorded for this order
      const existingPaymentUrl = `${supabaseUrl}/rest/v1/cod_payments?select=payment_id&book_id=eq.${book_id}`;
      const existingPaymentResponse = await fetch(existingPaymentUrl, {
        headers: {
          'apikey': supabaseKey,
          'Authorization': `Bearer ${supabaseKey}`,
        },
      });
      const existingPaymentData = await existingPaymentResponse.json();
      const existingPayment = existingPaymentData[0];

      if (existingPayment) {
        return new Response(JSON.stringify({
          success: false,
          error: 'COD payment already recorded for this order'
        }), {
          status: 400,
          headers: { 'Content-Type': 'application/json', ...corsHeaders }
        });
      }

      const today = new Date().toISOString().split('T')[0];

      // Record COD payment
      const paymentInsert = await supabase
        .from('cod_payments')
        .insert({
          rider_id,
          book_id,
          amount,
          payment_method: payment_method || 'cash',
          customer_signature: customer_signature || null,
          notes: notes || null,
          date: today,
          created_at: new Date().toISOString()
        })
        .select();

      if (paymentInsert.error) {
        console.error('COD payment record error:', paymentInsert.error);
        return new Response(JSON.stringify({ success: false, error: paymentInsert.error.message }), {
          status: 500,
          headers: { 'Content-Type': 'application/json', ...corsHeaders }
        });
      }

      const payment = paymentInsert.data;

      // Update runsheet collected COD amount
      const runsheetUrl = `${supabaseUrl}/rest/v1/runsheets?select=run_id,collected_cod&rider_id=eq.${rider_id}&date=eq.${today}&status=neq.CANCELLED`;
      const runsheetResponse = await fetch(runsheetUrl, {
        headers: {
          'apikey': supabaseKey,
          'Authorization': `Bearer ${supabaseKey}`,
        },
      });
      const runsheetData = await runsheetResponse.json();
      const runsheet = runsheetData[0];

      if (runsheet) {
        const newCollectedCod = (runsheet.collected_cod || 0) + amount;
        await fetch(`${supabaseUrl}/rest/v1/runsheets?run_id=eq.${runsheet.run_id}`, {
          method: 'PATCH',
          headers: {
            'apikey': supabaseKey,
            'Authorization': `Bearer ${supabaseKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ collected_cod: newCollectedCod })
        });
      }

      // Add transaction to rider's cash transactions
      await fetch(`${supabaseUrl}/rest/v1/rider_cash_transactions`, {
        method: 'POST',
        headers: {
          'apikey': supabaseKey,
          'Authorization': `Bearer ${supabaseKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          rider_id,
          book_id,
          amount,
          type: 'cod_collection',
          status: 'collected',
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
          barcode: book_id,
          barcode_type: 'BOOK',
          scanned_by: rider_id,
          scanned_by_type: 'rider',
          notes: `COD collected: ₹${amount}`,
          created_at: new Date().toISOString()
        })
      });

      // Send notification to hub about COD collection
      const riderUrl = `${supabaseUrl}/rest/v1/riders?select=assigned_pincodes&rider_id=eq.${rider_id}`;
      const riderResponse = await fetch(riderUrl, {
        headers: {
          'apikey': supabaseKey,
          'Authorization': `Bearer ${supabaseKey}`,
        },
      });
      const riderData = await riderResponse.json();
      const rider = riderData[0];

      if (rider && rider.assigned_pincodes && rider.assigned_pincodes.length > 0) {
        const hubUrl = `${supabaseUrl}/rest/v1/hub_managers?select=hub_id&assigned_pincodes=cs.{${rider.assigned_pincodes[0]}}`;
        const hubResponse = await fetch(hubUrl, {
          headers: {
            'apikey': supabaseKey,
            'Authorization': `Bearer ${supabaseKey}`,
          },
        });
        const hubData = await hubResponse.json();
        const hub = hubData[0];

        if (hub) {
          await fetch(`${supabaseUrl}/rest/v1/notifications`, {
            method: 'POST',
            headers: {
              'apikey': supabaseKey,
              'Authorization': `Bearer ${supabaseKey}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              user_id: hub.hub_id,
              user_type: 'hub',
              title: 'COD Collection Update',
              message: `Rider has collected ₹${amount} for order ${book_id}`,
              type: 'payment',
              data: { rider_id, book_id, amount },
              created_at: new Date().toISOString()
            })
          });
        }
      }

      return new Response(JSON.stringify({
        success: true,
        message: `COD of ₹${amount} recorded successfully`,
        payment: {
          payment_id: payment.payment_id,
          book_id: payment.book_id,
          amount: payment.amount,
          payment_method: payment.payment_method,
          recorded_at: payment.created_at
        },
        next_step: 'Deposit collected cash at hub at end of day'
      }), {
        status: 200,
        headers: { 'Content-Type': 'application/json', ...corsHeaders }
      });

    } catch (error) {
      console.error('Record COD collection error:', error);
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