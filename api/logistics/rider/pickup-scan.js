// api/logistics/rider/pickup-scan.js
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
  // GET PENDING PICKUPS FOR TODAY
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
      const runsheetUrl = `${supabaseUrl}/rest/v1/runsheets?select=run_id,pickup_orders&rider_id=eq.${rider_id}&date=eq.${today}&status=neq.CANCELLED`;
      const runsheetResponse = await fetch(runsheetUrl, {
        headers: {
          'apikey': supabaseKey,
          'Authorization': `Bearer ${supabaseKey}`,
        },
      });
      const runsheetData = await runsheetResponse.json();
      const runsheet = runsheetData[0];

      if (!runsheet || !runsheet.pickup_orders || runsheet.pickup_orders.length === 0) {
        return new Response(JSON.stringify({
          success: true,
          has_pickups: false,
          message: 'No pickup orders assigned for today'
        }), {
          status: 200,
          headers: { 'Content-Type': 'application/json', ...corsHeaders }
        });
      }

      // Get pickup order details
      const pickupIdsList = runsheet.pickup_orders.map(id => `'${id}'`).join(',');
      const pickupsUrl = `${supabaseUrl}/rest/v1/orders?select=book_id,tracking_id,final_amount,address,placed_at,customers!inner(name,mobile),sellers!inner(seller_id,shop_name,mobile as seller_mobile,address as seller_address)&book_id=in.(${pickupIdsList})`;
      const pickupsResponse = await fetch(pickupsUrl, {
        headers: {
          'apikey': supabaseKey,
          'Authorization': `Bearer ${supabaseKey}`,
        },
      });
      const pickups = await pickupsResponse.json();

      // Get completed pickups
      const completedUrl = `${supabaseUrl}/rest/v1/shipment_tracking?select=book_id&book_id=in.(${pickupIdsList})&status=eq.PICKUP_COMPLETED&rider_id=eq.${rider_id}`;
      const completedResponse = await fetch(completedUrl, {
        headers: {
          'apikey': supabaseKey,
          'Authorization': `Bearer ${supabaseKey}`,
        },
      });
      const completedScans = await completedResponse.json();

      const completedIds = new Set(completedScans?.map(c => c.book_id) || []);

      const pendingPickups = pickups?.filter(p => !completedIds.has(p.book_id)).map(p => ({
        book_id: p.book_id,
        tracking_id: p.tracking_id,
        amount: p.final_amount,
        seller_name: p.sellers?.shop_name,
        seller_mobile: p.sellers?.seller_mobile,
        seller_address: p.sellers?.seller_address,
        customer_name: p.customers?.name,
        customer_mobile: p.customers?.mobile,
        address: p.address
      })) || [];

      return new Response(JSON.stringify({
        success: true,
        has_pickups: pendingPickups.length > 0,
        total_pickups: runsheet.pickup_orders.length,
        completed_pickups: completedScans?.length || 0,
        pending_pickups: pendingPickups,
        runsheet_id: runsheet.run_id
      }), {
        status: 200,
        headers: { 'Content-Type': 'application/json', ...corsHeaders }
      });

    } catch (error) {
      console.error('Get pending pickups error:', error);
      return new Response(JSON.stringify({ success: false, error: error.message }), {
        status: 500,
        headers: { 'Content-Type': 'application/json', ...corsHeaders }
      });
    }
  }

  // =====================================================
  // PROCESS PICKUP SCAN (POST)
  // =====================================================
  if (request.method === 'POST') {
    try {
      const body = await request.json();
      const {
        rider_id,
        book_id,
        barcode,
        location,
        weight,
        product_photo,
        seller_signature,
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
      let awbNumber = null;

      // If barcode provided, find order by barcode
      if (barcode && !targetBookId) {
        if (barcode.startsWith('BOOK')) {
          targetBookId = barcode;
        } else if (barcode.startsWith('SS')) {
          const orderUrl = `${supabaseUrl}/rest/v1/orders?tracking_id=eq.${barcode}&select=book_id`;
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
      }

      if (!targetBookId) {
        return new Response(JSON.stringify({ success: false, error: 'Invalid order identifier' }), {
          status: 400,
          headers: { 'Content-Type': 'application/json', ...corsHeaders }
        });
      }

      // Get order details with seller info
      const orderSelect = `*, sellers!inner (seller_id, shop_name, mobile as seller_mobile)`;
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

      // Check if order is already picked up
      const existingUrl = `${supabaseUrl}/rest/v1/shipment_tracking?select=track_id&book_id=eq.${targetBookId}&status=eq.PICKUP_COMPLETED`;
      const existingResponse = await fetch(existingUrl, {
        headers: {
          'apikey': supabaseKey,
          'Authorization': `Bearer ${supabaseKey}`,
        },
      });
      const existingData = await existingResponse.json();
      const existingPickup = existingData[0];

      if (existingPickup) {
        return new Response(JSON.stringify({
          success: false,
          error: 'This order has already been picked up',
          already_scanned: true
        }), {
          status: 400,
          headers: { 'Content-Type': 'application/json', ...corsHeaders }
        });
      }

      // Verify order is in correct status
      if (order.status !== 'READY_FOR_PICKUP' && order.status !== 'ASSIGNED_TO_RIDER') {
        return new Response(JSON.stringify({
          success: false,
          error: `Order is not ready for pickup. Current status: ${order.status}`
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
          status: 'PICKUP_COMPLETED',
          updated_at: new Date().toISOString(),
          picked_up_at: new Date().toISOString(),
          picked_up_by: rider_id
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
          status: 'PICKUP_COMPLETED',
          location: location || 'Seller Location',
          rider_id: rider_id,
          notes: notes || `Pickup completed. Weight: ${weight || 'N/A'}kg`,
          photo: product_photo || null,
          created_at: new Date().toISOString()
        })
      });

      // Update runsheet pickup count
      const today = new Date().toISOString().split('T')[0];
      const runsheetUrl = `${supabaseUrl}/rest/v1/runsheets?select=run_id,total_pickups,completed_pickups&rider_id=eq.${rider_id}&date=eq.${today}&status=neq.CANCELLED`;
      const runsheetResponse = await fetch(runsheetUrl, {
        headers: {
          'apikey': supabaseKey,
          'Authorization': `Bearer ${supabaseKey}`,
        },
      });
      const runsheetData = await runsheetResponse.json();
      const runsheet = runsheetData[0];

      if (runsheet) {
        const completedPickups = (runsheet.completed_pickups || 0) + 1;
        await fetch(`${supabaseUrl}/rest/v1/runsheets?run_id=eq.${runsheet.run_id}`, {
          method: 'PATCH',
          headers: {
            'apikey': supabaseKey,
            'Authorization': `Bearer ${supabaseKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ completed_pickups: completedPickups })
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
          notes: 'Pickup scan at seller location',
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
          title: 'Order Picked Up',
          message: `Order ${targetBookId} has been picked up by rider and is on its way.`,
          type: 'logistics',
          data: { book_id: targetBookId, rider_id: rider_id },
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
          title: 'Order Picked Up',
          message: `Your order ${targetBookId} has been picked up and will be delivered soon.`,
          type: 'delivery',
          data: { book_id: targetBookId, tracking_id: order.tracking_id },
          created_at: new Date().toISOString()
        })
      });

      // Add rider earning for pickup (₹10 per pickup)
      const pickupRate = 10;

      // Get current rider data
      const riderUrl = `${supabaseUrl}/rest/v1/riders?select=wallet_balance,total_pickups&rider_id=eq.${rider_id}`;
      const riderResponse = await fetch(riderUrl, {
        headers: {
          'apikey': supabaseKey,
          'Authorization': `Bearer ${supabaseKey}`,
        },
      });
      const riderData = await riderResponse.json();
      const rider = riderData[0];
      const currentBalance = rider?.wallet_balance || 0;
      const currentPickups = rider?.total_pickups || 0;

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
          amount: pickupRate,
          type: 'credit',
          reason: `Pickup completed for order ${targetBookId}`,
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
          wallet_balance: currentBalance + pickupRate,
          total_pickups: currentPickups + 1
        })
      });

      return new Response(JSON.stringify({
        success: true,
        message: 'Pickup scan successful',
        pickup: {
          book_id: targetBookId,
          tracking_id: order.tracking_id,
          status: 'PICKUP_COMPLETED',
          picked_up_at: new Date().toISOString(),
          earning: pickupRate
        },
        next_step: 'Proceed to next pickup or start deliveries'
      }), {
        status: 200,
        headers: { 'Content-Type': 'application/json', ...corsHeaders }
      });

    } catch (error) {
      console.error('Pickup scan error:', error);
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