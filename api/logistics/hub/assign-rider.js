// api/logistics/hub/assign-rider.js
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
              select: async (columns2, options = {}) => {
                let finalUrl = `${url}&${field}=eq.${value}&${field2}=in.(${values.join(',')})`;
                if (columns2) {
                  finalUrl += `&select=${columns2}`;
                }
                if (options.head) {
                  const response = await fetch(finalUrl, {
                    method: 'HEAD',
                    headers: {
                      'apikey': supabaseKey,
                      'Authorization': `Bearer ${supabaseKey}`,
                    },
                  });
                  const count = response.headers.get('content-range')?.split('/')[1];
                  return { count: count ? parseInt(count) : 0, error: null };
                }
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
              overlaps: (overlapsField, overlapsValue) => ({
                order: (orderField, { ascending }) => ({
                  select: async () => {
                    const sortOrder = ascending ? 'asc' : 'desc';
                    const finalUrl = `${url}&${field}=eq.${value}&${containsField}=cs.{${containsValue.join(',')}}&${overlapsField}=ov.{${overlapsValue.join(',')}}&order=${orderField}.${sortOrder}`;
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
            }),
            overlaps: (overlapsField, overlapsValue) => ({
              order: (orderField, { ascending }) => ({
                select: async () => {
                  const sortOrder = ascending ? 'asc' : 'desc';
                  const finalUrl = `${url}&${field}=eq.${value}&${overlapsField}=ov.{${overlapsValue.join(',')}}&order=${orderField}.${sortOrder}`;
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
            order: (orderField, { ascending }) => ({
              select: async () => {
                const sortOrder = ascending ? 'asc' : 'desc';
                const finalUrl = `${url}&${field}=eq.${value}&order=${orderField}.${sortOrder}`;
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
            contains: (containsField, containsValue) => ({
              order: (orderField, { ascending }) => ({
                select: async () => {
                  const sortOrder = ascending ? 'asc' : 'desc';
                  const finalUrl = `${url}&${field}=eq.${value}&${containsField}=cs.{${containsValue.join(',')}}&order=${orderField}.${sortOrder}`;
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
            overlaps: (overlapsField, overlapsValue) => ({
              order: (orderField, { ascending }) => ({
                select: async () => {
                  const sortOrder = ascending ? 'asc' : 'desc';
                  const finalUrl = `${url}&${field}=eq.${value}&${overlapsField}=ov.{${overlapsValue.join(',')}}&order=${orderField}.${sortOrder}`;
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
            order: (orderField, { ascending }) => ({
              select: async () => {
                const sortOrder = ascending ? 'asc' : 'desc';
                const finalUrl = `${url}&${field}=eq.${value}&order=${orderField}.${sortOrder}`;
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
    'Access-Control-Allow-Methods': 'GET, POST, PUT, OPTIONS',
    'Access-Control-Allow-Headers': 'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version, Authorization',
  };

  // Handle OPTIONS preflight
  if (request.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: corsHeaders });
  }

  const url = new URL(request.url);

  // =====================================================
  // GET AVAILABLE RIDERS FOR ASSIGNMENT
  // =====================================================
  if (request.method === 'GET') {
    try {
      const hub_id = url.searchParams.get('hub_id');
      const date = url.searchParams.get('date');
      const shift = url.searchParams.get('shift');
      const pincode = url.searchParams.get('pincode');

      if (!hub_id) {
        return new Response(JSON.stringify({ success: false, error: 'Hub ID is required' }), {
          status: 400,
          headers: { 'Content-Type': 'application/json', ...corsHeaders }
        });
      }

      const supabase = createSupabaseClient();
      const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
      const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

      // Get hub's assigned pincodes
      const hubResult = await supabase
        .from('hub_managers')
        .select('assigned_pincodes, name')
        .eq('hub_id', hub_id)
        .single();

      if (hubResult.error || !hubResult.data) {
        return new Response(JSON.stringify({ success: false, error: 'Hub not found' }), {
          status: 404,
          headers: { 'Content-Type': 'application/json', ...corsHeaders }
        });
      }

      const hub = hubResult.data;
      const targetDate = date || new Date().toISOString().split('T')[0];

      // Get all active riders in hub's area
      let ridersUrl = `${supabaseUrl}/rest/v1/riders?select=rider_id,name,mobile,email,rating,is_online,is_active,assigned_pincodes,total_deliveries,total_pickups,wallet_balance,current_location,last_location_update&is_active=eq.true&order=rating.desc`;

      if (pincode) {
        ridersUrl += `&assigned_pincodes=cs.{${pincode}}`;
      } else if (hub.assigned_pincodes && hub.assigned_pincodes.length > 0) {
        ridersUrl += `&assigned_pincodes=ov.{${hub.assigned_pincodes.join(',')}}`;
      }

      const ridersResponse = await fetch(ridersUrl, {
        headers: {
          'apikey': supabaseKey,
          'Authorization': `Bearer ${supabaseKey}`,
        },
      });
      const riders = await ridersResponse.json();

      // Get existing runsheets for the date
      const runsheetsUrl = `${supabaseUrl}/rest/v1/runsheets?hub_id=eq.${hub_id}&date=eq.${targetDate}&status=neq.CANCELLED&select=rider_id,shift,status`;
      const runsheetsResponse = await fetch(runsheetsUrl, {
        headers: {
          'apikey': supabaseKey,
          'Authorization': `Bearer ${supabaseKey}`,
        },
      });
      const existingRunsheets = await runsheetsResponse.json();

      const assignedRiders = new Map();
      existingRunsheets?.forEach(r => {
        assignedRiders.set(r.rider_id, r.shift);
      });

      // Get pending orders count for area
      const hubPincodes = hub.assigned_pincodes || [];
      let pendingDeliveriesCount = 0;
      let pendingPickupsCount = 0;

      if (hubPincodes.length > 0) {
        const deliveryUrl = `${supabaseUrl}/rest/v1/orders?status=eq.SHIPPED&address->>pincode=in.(${hubPincodes.join(',')})&select=book_id`;
        const deliveryResponse = await fetch(deliveryUrl, {
          method: 'HEAD',
          headers: {
            'apikey': supabaseKey,
            'Authorization': `Bearer ${supabaseKey}`,
          },
        });
        pendingDeliveriesCount = parseInt(deliveryResponse.headers.get('content-range')?.split('/')[1] || '0');

        const pickupUrl = `${supabaseUrl}/rest/v1/orders?status=eq.PACKED&address->>pincode=in.(${hubPincodes.join(',')})&select=book_id`;
        const pickupResponse = await fetch(pickupUrl, {
          method: 'HEAD',
          headers: {
            'apikey': supabaseKey,
            'Authorization': `Bearer ${supabaseKey}`,
          },
        });
        pendingPickupsCount = parseInt(pickupResponse.headers.get('content-range')?.split('/')[1] || '0');
      }

      // Get rider performance metrics
      const weekAgo = new Date();
      weekAgo.setDate(weekAgo.getDate() - 7);
      const weekAgoStr = weekAgo.toISOString();

      const riderPerformance = await Promise.all((riders || []).map(async (rider) => {
        // Get today's runsheet if any
        const todayRunsheetUrl = `${supabaseUrl}/rest/v1/runsheets?rider_id=eq.${rider.rider_id}&date=eq.${targetDate}&status=neq.CANCELLED&select=run_id,status,shift`;
        const todayRunsheetResponse = await fetch(todayRunsheetUrl, {
          headers: {
            'apikey': supabaseKey,
            'Authorization': `Bearer ${supabaseKey}`,
          },
        });
        const todayRunsheetData = await todayRunsheetResponse.json();
        const todayRunsheet = todayRunsheetData[0];

        // Get last 7 days performance
        const weekRunsheetsUrl = `${supabaseUrl}/rest/v1/runsheets?rider_id=eq.${rider.rider_id}&created_at=gte.${weekAgoStr}&select=total_deliveries,total_pickups,status`;
        const weekRunsheetsResponse = await fetch(weekRunsheetsUrl, {
          headers: {
            'apikey': supabaseKey,
            'Authorization': `Bearer ${supabaseKey}`,
          },
        });
        const weekRunsheets = await weekRunsheetsResponse.json();

        const weekDeliveries = weekRunsheets?.reduce((sum, r) => sum + (r.total_deliveries || 0), 0) || 0;
        const weekPickups = weekRunsheets?.reduce((sum, r) => sum + (r.total_pickups || 0), 0) || 0;
        const completedRunsheets = weekRunsheets?.filter(r => r.status === 'COMPLETED').length || 0;

        return {
          ...rider,
          has_runsheet_today: !!todayRunsheet,
          today_runsheet_status: todayRunsheet?.status,
          today_shift: todayRunsheet?.shift,
          week_performance: {
            deliveries: weekDeliveries,
            pickups: weekPickups,
            completed_runsheets: completedRunsheets
          },
          is_available: !todayRunsheet || todayRunsheet.status === 'COMPLETED'
        };
      }));

      return new Response(JSON.stringify({
        success: true,
        hub: {
          hub_id: hub_id,
          name: hub.name,
          assigned_pincodes: hub.assigned_pincodes
        },
        riders: riderPerformance,
        pending_orders: {
          deliveries: pendingDeliveriesCount,
          pickups: pendingPickupsCount
        },
        date: targetDate,
        shifts: ['MORNING', 'EVENING', 'NIGHT']
      }), {
        status: 200,
        headers: { 'Content-Type': 'application/json', ...corsHeaders }
      });

    } catch (error) {
      console.error('Get assign rider data error:', error);
      return new Response(JSON.stringify({ success: false, error: error.message }), {
        status: 500,
        headers: { 'Content-Type': 'application/json', ...corsHeaders }
      });
    }
  }

  // =====================================================
  // ASSIGN RIDER TO RUNSHEET (POST)
  // =====================================================
  if (request.method === 'POST') {
    try {
      const body = await request.json();
      const {
        hub_id,
        run_id,
        rider_id,
        shift,
        date,
        reassign_reason
      } = body;

      if (!hub_id || !rider_id) {
        return new Response(JSON.stringify({
          success: false,
          error: 'Hub ID and Rider ID are required'
        }), {
          status: 400,
          headers: { 'Content-Type': 'application/json', ...corsHeaders }
        });
      }

      const supabase = createSupabaseClient();
      const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
      const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

      // If run_id provided, reassign existing runsheet
      if (run_id) {
        // Verify runsheet exists
        const runsheetUrl = `${supabaseUrl}/rest/v1/runsheets?run_id=eq.${run_id}&hub_id=eq.${hub_id}&select=*,riders!left(name)`;
        const runsheetResponse = await fetch(runsheetUrl, {
          headers: {
            'apikey': supabaseKey,
            'Authorization': `Bearer ${supabaseKey}`,
          },
        });
        const runsheetData = await runsheetResponse.json();
        const runsheet = runsheetData[0];

        if (!runsheet) {
          return new Response(JSON.stringify({ success: false, error: 'Runsheet not found' }), {
            status: 404,
            headers: { 'Content-Type': 'application/json', ...corsHeaders }
          });
        }

        if (runsheet.status === 'COMPLETED') {
          return new Response(JSON.stringify({ success: false, error: 'Cannot reassign completed runsheet' }), {
            status: 400,
            headers: { 'Content-Type': 'application/json', ...corsHeaders }
          });
        }

        const oldRiderId = runsheet.rider_id;

        // Update runsheet with new rider
        await fetch(`${supabaseUrl}/rest/v1/runsheets?run_id=eq.${run_id}`, {
          method: 'PATCH',
          headers: {
            'apikey': supabaseKey,
            'Authorization': `Bearer ${supabaseKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            rider_id: rider_id,
            updated_at: new Date().toISOString(),
            reassigned_at: new Date().toISOString(),
            reassigned_from: oldRiderId,
            reassign_reason: reassign_reason || null
          })
        });

        // Update order rider assignments
        if (runsheet.delivery_orders && runsheet.delivery_orders.length > 0) {
          const orderIds = runsheet.delivery_orders.map(id => `'${id}'`).join(',');
          await fetch(`${supabaseUrl}/rest/v1/orders?book_id=in.(${orderIds})`, {
            method: 'PATCH',
            headers: {
              'apikey': supabaseKey,
              'Authorization': `Bearer ${supabaseKey}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({ rider_id: rider_id, updated_at: new Date().toISOString() })
          });
        }

        // Notify old rider
        if (oldRiderId) {
          await fetch(`${supabaseUrl}/rest/v1/notifications`, {
            method: 'POST',
            headers: {
              'apikey': supabaseKey,
              'Authorization': `Bearer ${supabaseKey}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              user_id: oldRiderId,
              user_type: 'rider',
              title: 'Runsheet Reassigned',
              message: `Runsheet ${run_id} has been reassigned to another rider.`,
              type: 'logistics',
              data: { run_id: run_id },
              created_at: new Date().toISOString()
            })
          });
        }

        // Get new rider details
        const newRiderUrl = `${supabaseUrl}/rest/v1/riders?rider_id=eq.${rider_id}&select=name,mobile`;
        const newRiderResponse = await fetch(newRiderUrl, {
          headers: {
            'apikey': supabaseKey,
            'Authorization': `Bearer ${supabaseKey}`,
          },
        });
        const newRiderData = await newRiderResponse.json();
        const newRider = newRiderData[0];

        // Notify new rider
        await fetch(`${supabaseUrl}/rest/v1/notifications`, {
          method: 'POST',
          headers: {
            'apikey': supabaseKey,
            'Authorization': `Bearer ${supabaseKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            user_id: rider_id,
            user_type: 'rider',
            title: 'New Runsheet Assigned',
            message: `You have been assigned to runsheet ${run_id} with ${runsheet.total_deliveries} deliveries.`,
            type: 'logistics',
            data: { run_id: run_id, shift: runsheet.shift },
            created_at: new Date().toISOString()
          })
        });

        return new Response(JSON.stringify({
          success: true,
          message: `Runsheet reassigned to rider ${newRider?.name}`,
          runsheet: {
            run_id: run_id,
            rider_id: rider_id,
            previous_rider_id: oldRiderId,
            shift: runsheet.shift
          }
        }), {
          status: 200,
          headers: { 'Content-Type': 'application/json', ...corsHeaders }
        });

      } else {
        // Create new runsheet with assigned rider
        const targetDate = date || new Date().toISOString().split('T')[0];
        const targetShift = shift || 'MORNING';

        // Check if rider already has runsheet for this shift
        const existingUrl = `${supabaseUrl}/rest/v1/runsheets?rider_id=eq.${rider_id}&date=eq.${targetDate}&shift=eq.${targetShift}&status=neq.CANCELLED&select=run_id`;
        const existingResponse = await fetch(existingUrl, {
          headers: {
            'apikey': supabaseKey,
            'Authorization': `Bearer ${supabaseKey}`,
          },
        });
        const existingData = await existingResponse.json();
        const existingRunsheet = existingData[0];

        if (existingRunsheet) {
          return new Response(JSON.stringify({
            success: false,
            error: 'Rider already has an active runsheet for this shift'
          }), {
            status: 400,
            headers: { 'Content-Type': 'application/json', ...corsHeaders }
          });
        }

        // Get hub's assigned pincodes
        const hubResult = await supabase
          .from('hub_managers')
          .select('assigned_pincodes')
          .eq('hub_id', hub_id)
          .single();

        const hubPincodes = hubResult.data?.assigned_pincodes || [];

        // Get pending orders for this area
        let deliveryOrders = [];
        let pickupOrders = [];

        if (hubPincodes.length > 0) {
          const pincodeList = hubPincodes.map(p => `'${p}'`).join(',');
          
          const deliveryUrl = `${supabaseUrl}/rest/v1/orders?status=eq.SHIPPED&address->>pincode=in.(${pincodeList})&limit=30&select=book_id,final_amount`;
          const deliveryResponse = await fetch(deliveryUrl, {
            headers: {
              'apikey': supabaseKey,
              'Authorization': `Bearer ${supabaseKey}`,
            },
          });
          deliveryOrders = await deliveryResponse.json();

          const pickupUrl = `${supabaseUrl}/rest/v1/orders?status=eq.PACKED&address->>pincode=in.(${pincodeList})&limit=10&select=book_id`;
          const pickupResponse = await fetch(pickupUrl, {
            headers: {
              'apikey': supabaseKey,
              'Authorization': `Bearer ${supabaseKey}`,
            },
          });
          pickupOrders = await pickupResponse.json();
        }

        const deliveryIds = deliveryOrders?.map(o => o.book_id) || [];
        const pickupIds = pickupOrders?.map(o => o.book_id) || [];
        const totalCod = deliveryOrders?.reduce((sum, o) => sum + (o.final_amount || 0), 0) || 0;

        // Create runsheet
        const runsheetInsert = await supabase
          .from('runsheets')
          .insert({
            hub_id,
            rider_id,
            shift: targetShift,
            date: targetDate,
            pickup_orders: pickupIds,
            delivery_orders: deliveryIds,
            total_pickups: pickupIds.length,
            total_deliveries: deliveryIds.length,
            total_cod: totalCod,
            status: 'ASSIGNED',
            created_at: new Date().toISOString(),
            created_by: hub_id
          })
          .select();

        if (runsheetInsert.error) {
          console.error('Runsheet creation error:', runsheetInsert.error);
          return new Response(JSON.stringify({ success: false, error: runsheetInsert.error.message }), {
            status: 500,
            headers: { 'Content-Type': 'application/json', ...corsHeaders }
          });
        }

        const runsheet = runsheetInsert.data;

        // Update order statuses
        if (deliveryIds.length > 0) {
          const deliveryList = deliveryIds.map(id => `'${id}'`).join(',');
          await fetch(`${supabaseUrl}/rest/v1/orders?book_id=in.(${deliveryList})`, {
            method: 'PATCH',
            headers: {
              'apikey': supabaseKey,
              'Authorization': `Bearer ${supabaseKey}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({ rider_id: rider_id, status: 'ASSIGNED_TO_RIDER' })
          });
        }

        if (pickupIds.length > 0) {
          const pickupList = pickupIds.map(id => `'${id}'`).join(',');
          await fetch(`${supabaseUrl}/rest/v1/orders?book_id=in.(${pickupList})`, {
            method: 'PATCH',
            headers: {
              'apikey': supabaseKey,
              'Authorization': `Bearer ${supabaseKey}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({ status: 'READY_FOR_PICKUP' })
          });
        }

        // Get rider details
        const riderUrl = `${supabaseUrl}/rest/v1/riders?rider_id=eq.${rider_id}&select=name,mobile`;
        const riderResponse = await fetch(riderUrl, {
          headers: {
            'apikey': supabaseKey,
            'Authorization': `Bearer ${supabaseKey}`,
          },
        });
        const riderData = await riderResponse.json();
        const rider = riderData[0];

        // Notify rider
        await fetch(`${supabaseUrl}/rest/v1/notifications`, {
          method: 'POST',
          headers: {
            'apikey': supabaseKey,
            'Authorization': `Bearer ${supabaseKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            user_id: rider_id,
            user_type: 'rider',
            title: '📋 New Runsheet Assigned',
            message: `You have been assigned a new runsheet for ${targetShift} shift with ${deliveryIds.length} deliveries.`,
            type: 'logistics',
            data: { run_id: runsheet.run_id, shift: targetShift },
            created_at: new Date().toISOString()
          })
        });

        return new Response(JSON.stringify({
          success: true,
          message: `Runsheet created and assigned to ${rider?.name}`,
          runsheet: {
            run_id: runsheet.run_id,
            rider_id: rider_id,
            shift: targetShift,
            date: targetDate,
            total_deliveries: deliveryIds.length,
            total_pickups: pickupIds.length,
            total_cod: totalCod
          }
        }), {
          status: 200,
          headers: { 'Content-Type': 'application/json', ...corsHeaders }
        });
      }

    } catch (error) {
      console.error('Assign rider error:', error);
      return new Response(JSON.stringify({ success: false, error: error.message }), {
        status: 500,
        headers: { 'Content-Type': 'application/json', ...corsHeaders }
      });
    }
  }

  // =====================================================
  // UPDATE RIDER ONLINE STATUS (PUT)
  // =====================================================
  if (request.method === 'PUT') {
    try {
      const body = await request.json();
      const { rider_id, is_online, hub_id, location } = body;

      if (!rider_id) {
        return new Response(JSON.stringify({ success: false, error: 'Rider ID is required' }), {
          status: 400,
          headers: { 'Content-Type': 'application/json', ...corsHeaders }
        });
      }

      const supabase = createSupabaseClient();
      const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
      const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

      const updateData = {
        is_online: is_online,
        updated_at: new Date().toISOString()
      };

      if (location) {
        updateData.current_location = location;
        updateData.last_location_update = new Date().toISOString();
      }

      await fetch(`${supabaseUrl}/rest/v1/riders?rider_id=eq.${rider_id}`, {
        method: 'PATCH',
        headers: {
          'apikey': supabaseKey,
          'Authorization': `Bearer ${supabaseKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(updateData)
      });

      // Notify hub about rider status change
      if (hub_id) {
        await fetch(`${supabaseUrl}/rest/v1/notifications`, {
          method: 'POST',
          headers: {
            'apikey': supabaseKey,
            'Authorization': `Bearer ${supabaseKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            user_id: hub_id,
            user_type: 'hub',
            title: `Rider ${is_online ? 'Online' : 'Offline'}`,
            message: `Rider status changed to ${is_online ? 'online' : 'offline'}`,
            type: 'logistics',
            data: { rider_id, is_online },
            created_at: new Date().toISOString()
          })
        });
      }

      return new Response(JSON.stringify({
        success: true,
        message: `Rider is now ${is_online ? 'online' : 'offline'}`,
        rider_id: rider_id,
        is_online: is_online
      }), {
        status: 200,
        headers: { 'Content-Type': 'application/json', ...corsHeaders }
      });

    } catch (error) {
      console.error('Update rider status error:', error);
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