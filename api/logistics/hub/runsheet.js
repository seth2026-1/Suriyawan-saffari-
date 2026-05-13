// api/logistics/hub/runsheet.js
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
            order: (orderField, { ascending }) => ({
              range: async (from, to) => {
                const sortOrder = ascending ? 'asc' : 'desc';
                const finalUrl = `${url}&${field}=eq.${value}&order=${orderField}.${sortOrder}&offset=${from}&limit=${to - from + 1}`;
                const response = await fetch(finalUrl, {
                  headers: {
                    'apikey': supabaseKey,
                    'Authorization': `Bearer ${supabaseKey}`,
                  },
                });
                const data = await response.json();
                const count = response.headers.get('content-range')?.split('/')[1];
                return { data, error: null, count: count ? parseInt(count) : null };
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
            order: (orderField, { ascending }) => ({
              range: async (from, to) => {
                const sortOrder = ascending ? 'asc' : 'desc';
                const finalUrl = `${url}&${field}=eq.${value}&order=${orderField}.${sortOrder}&offset=${from}&limit=${to - from + 1}`;
                const response = await fetch(finalUrl, {
                  headers: {
                    'apikey': supabaseKey,
                    'Authorization': `Bearer ${supabaseKey}`,
                  },
                });
                const data = await response.json();
                const count = response.headers.get('content-range')?.split('/')[1];
                return { data, error: null, count: count ? parseInt(count) : null };
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
  // GET RUNSHEETS LIST
  // =====================================================
  if (request.method === 'GET') {
    try {
      const hub_id = url.searchParams.get('hub_id');
      const status = url.searchParams.get('status');
      const date = url.searchParams.get('date');
      const rider_id = url.searchParams.get('rider_id');
      const page = parseInt(url.searchParams.get('page') || '1');
      const limit = parseInt(url.searchParams.get('limit') || '20');

      if (!hub_id) {
        return new Response(JSON.stringify({ success: false, error: 'Hub ID is required' }), {
          status: 400,
          headers: { 'Content-Type': 'application/json', ...corsHeaders }
        });
      }

      const supabase = createSupabaseClient();
      const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
      const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

      // Build query for runsheets with rider info
      let runsheetsUrl = `${supabaseUrl}/rest/v1/runsheets?select=*,riders!left(rider_id,name,mobile,rating,is_online)&hub_id=eq.${hub_id}&order=created_at.desc`;

      if (status && status !== 'all') {
        runsheetsUrl += `&status=eq.${status}`;
      }

      if (date) {
        runsheetsUrl += `&date=eq.${date}`;
      }

      if (rider_id) {
        runsheetsUrl += `&rider_id=eq.${rider_id}`;
      }

      const from = (page - 1) * limit;
      const to = from + limit - 1;
      runsheetsUrl += `&offset=${from}&limit=${limit}`;

      const runsheetsResponse = await fetch(runsheetsUrl, {
        headers: {
          'apikey': supabaseKey,
          'Authorization': `Bearer ${supabaseKey}`,
        },
      });
      const runsheets = await runsheetsResponse.json();
      const count = parseInt(runsheetsResponse.headers.get('content-range')?.split('/')[1] || '0');

      // Get statistics for all runsheets
      const allRunsheetsUrl = `${supabaseUrl}/rest/v1/runsheets?select=status&hub_id=eq.${hub_id}`;
      const allRunsheetsResponse = await fetch(allRunsheetsUrl, {
        headers: {
          'apikey': supabaseKey,
          'Authorization': `Bearer ${supabaseKey}`,
        },
      });
      const allRunsheets = await allRunsheetsResponse.json();

      const stats = {
        total: allRunsheets?.length || 0,
        assigned: allRunsheets?.filter(r => r.status === 'ASSIGNED').length || 0,
        accepted: allRunsheets?.filter(r => r.status === 'ACCEPTED').length || 0,
        started: allRunsheets?.filter(r => r.status === 'STARTED').length || 0,
        completed: allRunsheets?.filter(r => r.status === 'COMPLETED').length || 0,
        cancelled: allRunsheets?.filter(r => r.status === 'CANCELLED').length || 0
      };

      // Get available riders for filter
      const ridersUrl = `${supabaseUrl}/rest/v1/riders?select=rider_id,name&is_active=eq.true&order=name.asc`;
      const ridersResponse = await fetch(ridersUrl, {
        headers: {
          'apikey': supabaseKey,
          'Authorization': `Bearer ${supabaseKey}`,
        },
      });
      const riders = await ridersResponse.json();

      return new Response(JSON.stringify({
        success: true,
        runsheets: runsheets,
        stats: stats,
        riders: riders || [],
        pagination: {
          current_page: page,
          total_pages: Math.ceil(count / limit),
          total_items: count,
          items_per_page: limit
        }
      }), {
        status: 200,
        headers: { 'Content-Type': 'application/json', ...corsHeaders }
      });

    } catch (error) {
      console.error('Get runsheets error:', error);
      return new Response(JSON.stringify({ success: false, error: error.message }), {
        status: 500,
        headers: { 'Content-Type': 'application/json', ...corsHeaders }
      });
    }
  }

  // =====================================================
  // CREATE RUNSHEET (POST)
  // =====================================================
  if (request.method === 'POST') {
    try {
      const body = await request.json();
      const {
        hub_id,
        rider_id,
        shift,
        date,
        pickup_orders,
        delivery_orders,
        route_data
      } = body;

      if (!hub_id || !rider_id || !shift) {
        return new Response(JSON.stringify({
          success: false,
          error: 'Hub ID, Rider ID and shift are required'
        }), {
          status: 400,
          headers: { 'Content-Type': 'application/json', ...corsHeaders }
        });
      }

      const supabase = createSupabaseClient();
      const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
      const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

      // Verify rider exists and is active
      const riderUrl = `${supabaseUrl}/rest/v1/riders?rider_id=eq.${rider_id}&select=rider_id,name,is_active`;
      const riderResponse = await fetch(riderUrl, {
        headers: {
          'apikey': supabaseKey,
          'Authorization': `Bearer ${supabaseKey}`,
        },
      });
      const riderData = await riderResponse.json();
      const rider = riderData[0];

      if (!rider) {
        return new Response(JSON.stringify({ success: false, error: 'Rider not found' }), {
          status: 404,
          headers: { 'Content-Type': 'application/json', ...corsHeaders }
        });
      }

      if (!rider.is_active) {
        return new Response(JSON.stringify({ success: false, error: 'Rider is not active' }), {
          status: 400,
          headers: { 'Content-Type': 'application/json', ...corsHeaders }
        });
      }

      const targetDate = date || new Date().toISOString().split('T')[0];

      // Check if rider already has a runsheet for this date and shift
      const existingUrl = `${supabaseUrl}/rest/v1/runsheets?rider_id=eq.${rider_id}&date=eq.${targetDate}&shift=eq.${shift}&status=neq.COMPLETED&select=run_id`;
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

      // Calculate totals
      const totalPickups = pickup_orders?.length || 0;
      const totalDeliveries = delivery_orders?.length || 0;

      // Get COD amount from delivery orders
      let totalCod = 0;
      if (delivery_orders && delivery_orders.length > 0) {
        const deliveryIdsList = delivery_orders.map(id => `'${id}'`).join(',');
        const ordersUrl = `${supabaseUrl}/rest/v1/orders?select=final_amount&book_id=in.(${deliveryIdsList})`;
        const ordersResponse = await fetch(ordersUrl, {
          headers: {
            'apikey': supabaseKey,
            'Authorization': `Bearer ${supabaseKey}`,
          },
        });
        const orders = await ordersResponse.json();
        totalCod = orders?.reduce((sum, o) => sum + (o.final_amount || 0), 0) || 0;
      }

      // Create runsheet
      const runsheetInsert = await supabase
        .from('runsheets')
        .insert({
          hub_id,
          rider_id,
          shift,
          date: targetDate,
          pickup_orders: pickup_orders || [],
          delivery_orders: delivery_orders || [],
          route_data: route_data || null,
          total_pickups: totalPickups,
          total_deliveries: totalDeliveries,
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

      // Send notification to rider
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
          message: `You have been assigned a new runsheet for ${runsheet.shift} shift with ${totalDeliveries} deliveries and ${totalPickups} pickups.`,
          type: 'logistics',
          data: { run_id: runsheet.run_id, shift: runsheet.shift },
          created_at: new Date().toISOString()
        })
      });

      // Update order statuses for pickup orders
      if (pickup_orders && pickup_orders.length > 0) {
        const pickupIdsList = pickup_orders.map(id => `'${id}'`).join(',');
        await fetch(`${supabaseUrl}/rest/v1/orders?book_id=in.(${pickupIdsList})`, {
          method: 'PATCH',
          headers: {
            'apikey': supabaseKey,
            'Authorization': `Bearer ${supabaseKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ status: 'READY_FOR_PICKUP' })
        });
      }

      // Update order statuses for delivery orders
      if (delivery_orders && delivery_orders.length > 0) {
        const deliveryIdsList = delivery_orders.map(id => `'${id}'`).join(',');
        await fetch(`${supabaseUrl}/rest/v1/orders?book_id=in.(${deliveryIdsList})`, {
          method: 'PATCH',
          headers: {
            'apikey': supabaseKey,
            'Authorization': `Bearer ${supabaseKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ rider_id: rider_id, status: 'ASSIGNED_TO_RIDER' })
        });
      }

      return new Response(JSON.stringify({
        success: true,
        message: 'Runsheet created successfully',
        runsheet: runsheet
      }), {
        status: 200,
        headers: { 'Content-Type': 'application/json', ...corsHeaders }
      });

    } catch (error) {
      console.error('Create runsheet error:', error);
      return new Response(JSON.stringify({ success: false, error: error.message }), {
        status: 500,
        headers: { 'Content-Type': 'application/json', ...corsHeaders }
      });
    }
  }

  // =====================================================
  // UPDATE RUNSHEET STATUS (PUT)
  // =====================================================
  if (request.method === 'PUT') {
    try {
      const body = await request.json();
      const { run_id, hub_id, action } = body;

      if (!run_id || !hub_id || !action) {
        return new Response(JSON.stringify({
          success: false,
          error: 'Runsheet ID, Hub ID and action are required'
        }), {
          status: 400,
          headers: { 'Content-Type': 'application/json', ...corsHeaders }
        });
      }

      const supabase = createSupabaseClient();
      const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
      const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

      // Verify runsheet belongs to hub and get rider name
      const runsheetUrl = `${supabaseUrl}/rest/v1/runsheets?select=*,riders(name)&run_id=eq.${run_id}&hub_id=eq.${hub_id}`;
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

      switch (action) {
        case 'assign':
          if (runsheet.status !== 'ASSIGNED') {
            return new Response(JSON.stringify({ success: false, error: 'Runsheet is already accepted or started' }), {
              status: 400,
              headers: { 'Content-Type': 'application/json', ...corsHeaders }
            });
          }
          newStatus = 'ASSIGNED';
          message = 'Runsheet assigned to rider';
          break;

        case 'accept':
          if (runsheet.status !== 'ASSIGNED') {
            return new Response(JSON.stringify({ success: false, error: 'Runsheet must be assigned before acceptance' }), {
              status: 400,
              headers: { 'Content-Type': 'application/json', ...corsHeaders }
            });
          }
          newStatus = 'ACCEPTED';
          updateData.accepted_at = new Date().toISOString();
          message = 'Runsheet accepted by rider';
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
          message = 'Runsheet started';
          break;

        case 'complete':
          if (runsheet.status !== 'STARTED') {
            return new Response(JSON.stringify({ success: false, error: 'Runsheet must be started before completion' }), {
              status: 400,
              headers: { 'Content-Type': 'application/json', ...corsHeaders }
            });
          }
          newStatus = 'COMPLETED';
          updateData.completed_at = new Date().toISOString();
          message = 'Runsheet completed';
          break;

        case 'cancel':
          if (runsheet.status === 'COMPLETED') {
            return new Response(JSON.stringify({ success: false, error: 'Completed runsheet cannot be cancelled' }), {
              status: 400,
              headers: { 'Content-Type': 'application/json', ...corsHeaders }
            });
          }
          newStatus = 'CANCELLED';
          message = 'Runsheet cancelled';
          break;

        default:
          return new Response(JSON.stringify({ success: false, error: 'Invalid action' }), {
            status: 400,
            headers: { 'Content-Type': 'application/json', ...corsHeaders }
          });
      }

      await fetch(`${supabaseUrl}/rest/v1/runsheets?run_id=eq.${run_id}`, {
        method: 'PATCH',
        headers: {
          'apikey': supabaseKey,
          'Authorization': `Bearer ${supabaseKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          status: newStatus,
          ...updateData,
          updated_at: new Date().toISOString()
        })
      });

      // Send notification on status change
      if (action === 'accept' || action === 'start') {
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
            title: `Runsheet ${action}ed`,
            message: `Runsheet ${run_id} has been ${action}ed by rider ${runsheet.riders?.name}`,
            type: 'logistics',
            data: { run_id, status: newStatus },
            created_at: new Date().toISOString()
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
        }
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