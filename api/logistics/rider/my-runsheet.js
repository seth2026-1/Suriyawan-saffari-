// api/logistics/rider/my-runsheet.js
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

function getStatusDisplay(status) {
  const statusMap = {
    'ASSIGNED': 'Assigned',
    'ACCEPTED': 'Accepted',
    'STARTED': 'In Progress',
    'COMPLETED': 'Completed',
    'CANCELLED': 'Cancelled'
  };
  return statusMap[status] || status;
}

export default async function handler(request) {
  // CORS Headers
  const corsHeaders = {
    'Access-Control-Allow-Credentials': 'true',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, PUT, OPTIONS',
    'Access-Control-Allow-Headers': 'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version, Authorization',
  };

  // Handle OPTIONS preflight
  if (request.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: corsHeaders });
  }

  const url = new URL(request.url);

  // =====================================================
  // GET MY RUNSHEET
  // =====================================================
  if (request.method === 'GET') {
    try {
      const rider_id = url.searchParams.get('rider_id');
      const date = url.searchParams.get('date');

      if (!rider_id) {
        return new Response(JSON.stringify({ success: false, error: 'Rider ID is required' }), {
          status: 400,
          headers: { 'Content-Type': 'application/json', ...corsHeaders }
        });
      }

      const supabase = createSupabaseClient();
      const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
      const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

      const targetDate = date || new Date().toISOString().split('T')[0];

      // Get today's runsheet with hub details
      const runsheetSelect = `run_id, hub_id, shift, date, status, total_pickups, total_deliveries, total_cod, pickup_orders, delivery_orders, route_data, created_at, accepted_at, started_at, completed_at, hub_managers!inner (hub_id, name as hub_name, mobile as hub_mobile)`;
      const runsheetUrl = `${supabaseUrl}/rest/v1/runsheets?select=${encodeURIComponent(runsheetSelect)}&rider_id=eq.${rider_id}&date=eq.${targetDate}&status=neq.CANCELLED`;
      const runsheetResponse = await fetch(runsheetUrl, {
        headers: {
          'apikey': supabaseKey,
          'Authorization': `Bearer ${supabaseKey}`,
        },
      });
      const runsheetData = await runsheetResponse.json();
      const runsheet = runsheetData[0];

      if (!runsheet) {
        return new Response(JSON.stringify({
          success: true,
          has_runsheet: false,
          message: 'No runsheet assigned for today'
        }), {
          status: 200,
          headers: { 'Content-Type': 'application/json', ...corsHeaders }
        });
      }

      // Get pickup order details
      let pickupDetails = [];
      if (runsheet.pickup_orders && runsheet.pickup_orders.length > 0) {
        const pickupIdsList = runsheet.pickup_orders.map(id => `'${id}'`).join(',');
        const pickupsUrl = `${supabaseUrl}/rest/v1/orders?select=book_id,tracking_id,final_amount,address,placed_at,customers!inner(name,mobile),sellers!inner(shop_name,mobile as seller_mobile,address as seller_address)&book_id=in.(${pickupIdsList})`;
        const pickupsResponse = await fetch(pickupsUrl, {
          headers: {
            'apikey': supabaseKey,
            'Authorization': `Bearer ${supabaseKey}`,
          },
        });
        const pickups = await pickupsResponse.json();

        // Get completion status
        const completedUrl = `${supabaseUrl}/rest/v1/shipment_tracking?select=book_id&book_id=in.(${pickupIdsList})&status=eq.PICKUP_COMPLETED&rider_id=eq.${rider_id}`;
        const completedResponse = await fetch(completedUrl, {
          headers: {
            'apikey': supabaseKey,
            'Authorization': `Bearer ${supabaseKey}`,
          },
        });
        const completedPickups = await completedResponse.json();

        const completedIds = new Set(completedPickups?.map(c => c.book_id) || []);

        pickupDetails = pickups?.map(p => ({
          book_id: p.book_id,
          tracking_id: p.tracking_id,
          amount: p.final_amount,
          seller_name: p.sellers?.shop_name,
          seller_mobile: p.sellers?.seller_mobile,
          seller_address: p.sellers?.seller_address,
          customer_name: p.customers?.name,
          customer_mobile: p.customers?.mobile,
          address: p.address,
          is_completed: completedIds.has(p.book_id),
          status: completedIds.has(p.book_id) ? 'completed' : 'pending'
        })) || [];
      }

      // Get delivery order details
      let deliveryDetails = [];
      if (runsheet.delivery_orders && runsheet.delivery_orders.length > 0) {
        const deliveryIdsList = runsheet.delivery_orders.map(id => `'${id}'`).join(',');
        const deliveriesUrl = `${supabaseUrl}/rest/v1/orders?select=book_id,tracking_id,final_amount,address,placed_at,customers!inner(name,mobile),order_items!inner(quantity,products!inner(name,images))&book_id=in.(${deliveryIdsList})`;
        const deliveriesResponse = await fetch(deliveriesUrl, {
          headers: {
            'apikey': supabaseKey,
            'Authorization': `Bearer ${supabaseKey}`,
          },
        });
        const deliveries = await deliveriesResponse.json();

        // Get completion status
        const completedDeliveryUrl = `${supabaseUrl}/rest/v1/shipment_tracking?select=book_id&book_id=in.(${deliveryIdsList})&status=eq.DELIVERED&rider_id=eq.${rider_id}`;
        const completedDeliveryResponse = await fetch(completedDeliveryUrl, {
          headers: {
            'apikey': supabaseKey,
            'Authorization': `Bearer ${supabaseKey}`,
          },
        });
        const completedDeliveries = await completedDeliveryResponse.json();

        const completedIds = new Set(completedDeliveries?.map(c => c.book_id) || []);

        deliveryDetails = deliveries?.map(d => ({
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
          })) || [],
          is_completed: completedIds.has(d.book_id),
          status: completedIds.has(d.book_id) ? 'completed' : 'pending'
        })) || [];
      }

      // Calculate progress
      const totalTasks = (runsheet.total_pickups || 0) + (runsheet.total_deliveries || 0);
      const completedTasks = pickupDetails.filter(p => p.is_completed).length + deliveryDetails.filter(d => d.is_completed).length;
      const progressPercentage = totalTasks > 0 ? (completedTasks / totalTasks) * 100 : 0;

      // Generate optimized route order
      let optimizedOrder = [];
      if (runsheet.route_data && runsheet.route_data.optimized_order) {
        optimizedOrder = runsheet.route_data.optimized_order;
      } else {
        const allStops = [
          ...pickupDetails.map(p => ({ id: p.book_id, type: 'pickup' })),
          ...deliveryDetails.map(d => ({ id: d.book_id, type: 'delivery' }))
        ];
        optimizedOrder = allStops.map(s => s.id);
      }

      // Check actions availability
      const canAccept = runsheet.status === 'ASSIGNED';
      const canStart = runsheet.status === 'ACCEPTED';
      const canComplete = runsheet.status === 'STARTED' && completedTasks === totalTasks && totalTasks > 0;

      // Calculate estimated earnings
      const estimatedEarnings = (runsheet.total_deliveries || 0) * 18 + (runsheet.total_pickups || 0) * 10;

      return new Response(JSON.stringify({
        success: true,
        has_runsheet: true,
        runsheet: {
          run_id: runsheet.run_id,
          hub_name: runsheet.hub_managers?.hub_name,
          hub_mobile: runsheet.hub_managers?.hub_mobile,
          shift: runsheet.shift,
          date: runsheet.date,
          status: runsheet.status,
          status_display: getStatusDisplay(runsheet.status),
          total_pickups: runsheet.total_pickups,
          total_deliveries: runsheet.total_deliveries,
          total_cod: runsheet.total_cod,
          completed_pickups: pickupDetails.filter(p => p.is_completed).length,
          completed_deliveries: deliveryDetails.filter(d => d.is_completed).length,
          progress_percentage: Math.round(progressPercentage),
          estimated_earnings: estimatedEarnings,
          created_at: runsheet.created_at,
          accepted_at: runsheet.accepted_at,
          started_at: runsheet.started_at,
          completed_at: runsheet.completed_at
        },
        pickups: pickupDetails,
        deliveries: deliveryDetails,
        optimized_order: optimizedOrder,
        actions: {
          can_accept: canAccept,
          can_start: canStart,
          can_complete: canComplete
        },
        route_data: runsheet.route_data,
        barcode_url: `/api/barcode/generate?text=${runsheet.run_id}`,
        qr_url: `/api/barcode/generate-qr?text=${runsheet.run_id}`
      }), {
        status: 200,
        headers: { 'Content-Type': 'application/json', ...corsHeaders }
      });

    } catch (error) {
      console.error('Get my runsheet error:', error);
      return new Response(JSON.stringify({ success: false, error: error.message }), {
        status: 500,
        headers: { 'Content-Type': 'application/json', ...corsHeaders }
      });
    }
  }

  // =====================================================
  // UPDATE RUNSHEET STATUS (ACCEPT, START, COMPLETE)
  // =====================================================
  if (request.method === 'PUT') {
    try {
      const body = await request.json();
      const { run_id, rider_id, action, location } = body;

      if (!run_id || !rider_id || !action) {
        return new Response(JSON.stringify({
          success: false,
          error: 'Runsheet ID, Rider ID and action are required'
        }), {
          status: 400,
          headers: { 'Content-Type': 'application/json', ...corsHeaders }
        });
      }

      const supabase = createSupabaseClient();
      const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
      const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

      // Verify runsheet belongs to rider
      const runsheetUrl = `${supabaseUrl}/rest/v1/runsheets?select=*,hub_managers!inner(hub_id)&run_id=eq.${run_id}&rider_id=eq.${rider_id}`;
      const runsheetResponse = await fetch(runsheetUrl, {
        headers: {
          'apikey': supabaseKey,
          'Authorization': `Bearer ${supabaseKey}`,
        },
      });
      const runsheetData = await runsheetResponse.json();
      const runsheet = runsheetData[0];

      if (!runsheet) {
        return new Response(JSON.stringify({ success: false, error: 'Runsheet not found or unauthorized' }), {
          status: 404,
          headers: { 'Content-Type': 'application/json', ...corsHeaders }
        });
      }

      let newStatus;
      let updateData = {};
      let message = '';
      let notificationTitle = '';
      let notificationMessage = '';

      switch (action) {
        case 'accept':
          if (runsheet.status !== 'ASSIGNED') {
            return new Response(JSON.stringify({ success: false, error: 'Runsheet cannot be accepted at this stage' }), {
              status: 400,
              headers: { 'Content-Type': 'application/json', ...corsHeaders }
            });
          }
          newStatus = 'ACCEPTED';
          updateData.accepted_at = new Date().toISOString();
          message = 'Runsheet accepted successfully';
          notificationTitle = 'Runsheet Accepted';
          notificationMessage = `Rider ${rider_id} has accepted runsheet ${run_id}`;
          break;

        case 'start':
          if (runsheet.status !== 'ACCEPTED') {
            return new Response(JSON.stringify({ success: false, error: 'Runsheet must be accepted before starting' }), {
              status: 400,
              headers: { 'Content-Type': 'application/json', ...corsHeaders }
            });
          }
          newStatus = 'STARTED';
          updateData.started_at = new Date().toISOString();
          if (location) {
            updateData.current_location = location;
          }
          message = 'Runsheet started successfully';
          notificationTitle = 'Runsheet Started';
          notificationMessage = `Rider ${rider_id} has started runsheet ${run_id}`;
          break;

        case 'complete':
          if (runsheet.status !== 'STARTED') {
            return new Response(JSON.stringify({ success: false, error: 'Runsheet must be started before completion' }), {
              status: 400,
              headers: { 'Content-Type': 'application/json', ...corsHeaders }
            });
          }

          // Check if all tasks are completed
          const totalTasks = (runsheet.total_pickups || 0) + (runsheet.total_deliveries || 0);

          let completedPickupIds = [];
          if (runsheet.pickup_orders && runsheet.pickup_orders.length > 0) {
            const pickupIdsList = runsheet.pickup_orders.map(id => `'${id}'`).join(',');
            const completedPickupsUrl = `${supabaseUrl}/rest/v1/shipment_tracking?select=book_id&book_id=in.(${pickupIdsList})&status=eq.PICKUP_COMPLETED&rider_id=eq.${rider_id}`;
            const completedPickupsResponse = await fetch(completedPickupsUrl, {
              headers: {
                'apikey': supabaseKey,
                'Authorization': `Bearer ${supabaseKey}`,
              },
            });
            const completedPickups = await completedPickupsResponse.json();
            completedPickupIds = completedPickups.map(c => c.book_id);
          }

          let completedDeliveryIds = [];
          if (runsheet.delivery_orders && runsheet.delivery_orders.length > 0) {
            const deliveryIdsList = runsheet.delivery_orders.map(id => `'${id}'`).join(',');
            const completedDeliveriesUrl = `${supabaseUrl}/rest/v1/shipment_tracking?select=book_id&book_id=in.(${deliveryIdsList})&status=eq.DELIVERED&rider_id=eq.${rider_id}`;
            const completedDeliveriesResponse = await fetch(completedDeliveriesUrl, {
              headers: {
                'apikey': supabaseKey,
                'Authorization': `Bearer ${supabaseKey}`,
              },
            });
            const completedDeliveries = await completedDeliveriesResponse.json();
            completedDeliveryIds = completedDeliveries.map(c => c.book_id);
          }

          const completedCount = completedPickupIds.length + completedDeliveryIds.length;

          if (completedCount < totalTasks) {
            return new Response(JSON.stringify({
              success: false,
              error: `Cannot complete runsheet. ${completedCount}/${totalTasks} tasks completed.`
            }), {
              status: 400,
              headers: { 'Content-Type': 'application/json', ...corsHeaders }
            });
          }

          newStatus = 'COMPLETED';
          updateData.completed_at = new Date().toISOString();
          message = 'Runsheet completed successfully!';
          notificationTitle = 'Runsheet Completed';
          notificationMessage = `Rider ${rider_id} has completed runsheet ${run_id}`;
          break;

        default:
          return new Response(JSON.stringify({ success: false, error: 'Invalid action' }), {
            status: 400,
            headers: { 'Content-Type': 'application/json', ...corsHeaders }
          });
      }

      updateData.status = newStatus;
      updateData.updated_at = new Date().toISOString();

      await fetch(`${supabaseUrl}/rest/v1/runsheets?run_id=eq.${run_id}`, {
        method: 'PATCH',
        headers: {
          'apikey': supabaseKey,
          'Authorization': `Bearer ${supabaseKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(updateData)
      });

      // Send notification to hub
      await fetch(`${supabaseUrl}/rest/v1/notifications`, {
        method: 'POST',
        headers: {
          'apikey': supabaseKey,
          'Authorization': `Bearer ${supabaseKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          user_id: runsheet.hub_id,
          user_type: 'hub',
          title: notificationTitle,
          message: notificationMessage,
          type: 'logistics',
          data: { run_id: run_id, rider_id: rider_id, action: action },
          created_at: new Date().toISOString()
        })
      });

      // If completed, calculate earnings
      let earnings = null;
      if (action === 'complete') {
        const deliveryEarnings = (runsheet.total_deliveries || 0) * 18;
        const pickupEarnings = (runsheet.total_pickups || 0) * 10;
        earnings = deliveryEarnings + pickupEarnings;

        // Get current wallet balance
        const riderUrl = `${supabaseUrl}/rest/v1/riders?select=wallet_balance,total_deliveries,total_pickups&rider_id=eq.${rider_id}`;
        const riderResponse = await fetch(riderUrl, {
          headers: {
            'apikey': supabaseKey,
            'Authorization': `Bearer ${supabaseKey}`,
          },
        });
        const riderData = await riderResponse.json();
        const rider = riderData[0];
        const currentBalance = rider?.wallet_balance || 0;
        const currentDeliveries = rider?.total_deliveries || 0;
        const currentPickups = rider?.total_pickups || 0;

        // Add to rider's wallet
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
            amount: earnings,
            type: 'credit',
            reason: `Runsheet completion - ${run_id}`,
            reference_id: run_id,
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
            wallet_balance: currentBalance + earnings,
            total_deliveries: currentDeliveries + (runsheet.total_deliveries || 0),
            total_pickups: currentPickups + (runsheet.total_pickups || 0)
          })
        });
      }

      return new Response(JSON.stringify({
        success: true,
        message: message,
        runsheet: {
          run_id: run_id,
          status: newStatus,
          updated_at: new Date().toISOString()
        },
        earnings: earnings ? { amount: earnings, message: `You earned ₹${earnings} for this runsheet` } : null
      }), {
        status: 200,
        headers: { 'Content-Type': 'application/json', ...corsHeaders }
      });

    } catch (error) {
      console.error('Update runsheet error:', error);
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