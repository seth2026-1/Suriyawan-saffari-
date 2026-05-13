// api/logistics/hub/riders.js
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
      select: (columns, options = {}) => {
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
            overlaps: (overlapsField, overlapsValue) => ({
              order: (orderField, { ascending }) => ({
                range: async (from, to) => {
                  const sortOrder = ascending ? 'asc' : 'desc';
                  const finalUrl = `${url}&${field}=eq.${value}&${overlapsField}=ov.{${overlapsValue.join(',')}}&order=${orderField}.${sortOrder}&offset=${from}&limit=${to - from + 1}`;
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
            or: (condition) => ({
              order: (orderField, { ascending }) => ({
                range: async (from, to) => {
                  const sortOrder = ascending ? 'asc' : 'desc';
                  const finalUrl = `${url}&${field}=eq.${value}&or=${condition}&order=${orderField}.${sortOrder}&offset=${from}&limit=${to - from + 1}`;
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
          }),
          overlaps: (overlapsField, overlapsValue) => ({
            order: (orderField, { ascending }) => ({
              range: async (from, to) => {
                const sortOrder = ascending ? 'asc' : 'desc';
                const finalUrl = `${url}&${overlapsField}=ov.{${overlapsValue.join(',')}}&order=${orderField}.${sortOrder}&offset=${from}&limit=${to - from + 1}`;
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
          gte: (gteField, gteValue) => ({
            order: (orderField, { ascending }) => ({
              range: async (from, to) => {
                const sortOrder = ascending ? 'asc' : 'desc';
                const finalUrl = `${url}&${gteField}=gte.${gteValue}&order=${orderField}.${sortOrder}&offset=${from}&limit=${to - from + 1}`;
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
          order: (orderField, { ascending }) => ({
            range: async (from, to) => {
              const sortOrder = ascending ? 'asc' : 'desc';
              const finalUrl = `${url}&order=${orderField}.${sortOrder}&offset=${from}&limit=${to - from + 1}`;
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

export default async function handler(request) {
  // CORS Headers
  const corsHeaders = {
    'Access-Control-Allow-Credentials': 'true',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, PUT, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version, Authorization',
  };

  // Handle OPTIONS preflight
  if (request.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: corsHeaders });
  }

  const url = new URL(request.url);

  // =====================================================
  // GET RIDERS LIST
  // =====================================================
  if (request.method === 'GET') {
    try {
      const hub_id = url.searchParams.get('hub_id');
      const status = url.searchParams.get('status');
      const search = url.searchParams.get('search');
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
      const hubPincodes = hub.assigned_pincodes || [];

      // Build query for riders in hub's area
      let ridersUrl = `${supabaseUrl}/rest/v1/riders?select=rider_id,name,mobile,email,rating,is_online,is_active,assigned_area,assigned_pincodes,total_deliveries,total_pickups,wallet_balance,rate_per_parcel,pickup_rate,created_at,current_location,last_location_update`;

      if (hubPincodes.length > 0) {
        ridersUrl += `&assigned_pincodes=ov.{${hubPincodes.join(',')}}`;
      }

      if (status === 'online') {
        ridersUrl += `&is_online=eq.true`;
      } else if (status === 'offline') {
        ridersUrl += `&is_online=eq.false`;
      } else if (status === 'active') {
        ridersUrl += `&is_active=eq.true`;
      } else if (status === 'inactive') {
        ridersUrl += `&is_active=eq.false`;
      }

      if (search) {
        ridersUrl += `&or=(name.ilike.%${search}%,mobile.ilike.%${search}%,email.ilike.%${search}%)`;
      }

      ridersUrl += `&order=rating.desc`;

      const from = (page - 1) * limit;
      const to = from + limit - 1;
      ridersUrl += `&offset=${from}&limit=${limit}`;

      const ridersResponse = await fetch(ridersUrl, {
        headers: {
          'apikey': supabaseKey,
          'Authorization': `Bearer ${supabaseKey}`,
        },
      });
      const riders = await ridersResponse.json();
      const count = parseInt(ridersResponse.headers.get('content-range')?.split('/')[1] || '0');

      // Get today's runsheet assignments
      const today = new Date().toISOString().split('T')[0];
      const runsheetsUrl = `${supabaseUrl}/rest/v1/runsheets?select=rider_id,run_id,shift,status&hub_id=eq.${hub_id}&date=eq.${today}`;
      const runsheetsResponse = await fetch(runsheetsUrl, {
        headers: {
          'apikey': supabaseKey,
          'Authorization': `Bearer ${supabaseKey}`,
        },
      });
      const todayRunsheets = await runsheetsResponse.json();

      const riderRunMap = new Map();
      todayRunsheets?.forEach(r => {
        riderRunMap.set(r.rider_id, { run_id: r.run_id, shift: r.shift, status: r.status });
      });

      // Get last week performance for each rider
      const weekAgo = new Date();
      weekAgo.setDate(weekAgo.getDate() - 7);
      const weekAgoStr = weekAgo.toISOString();

      const weekRunsheetsUrl = `${supabaseUrl}/rest/v1/runsheets?select=rider_id,total_deliveries,total_pickups,status&hub_id=eq.${hub_id}&created_at=gte.${weekAgoStr}`;
      const weekRunsheetsResponse = await fetch(weekRunsheetsUrl, {
        headers: {
          'apikey': supabaseKey,
          'Authorization': `Bearer ${supabaseKey}`,
        },
      });
      const weekRunsheets = await weekRunsheetsResponse.json();

      const riderPerformance = new Map();
      weekRunsheets?.forEach(r => {
        if (!riderPerformance.has(r.rider_id)) {
          riderPerformance.set(r.rider_id, { deliveries: 0, pickups: 0, completed: 0 });
        }
        const perf = riderPerformance.get(r.rider_id);
        perf.deliveries += r.total_deliveries || 0;
        perf.pickups += r.total_pickups || 0;
        if (r.status === 'COMPLETED') perf.completed++;
      });

      // Get rider statistics
      let allRiders = [];
      if (hubPincodes.length > 0) {
        const statsUrl = `${supabaseUrl}/rest/v1/riders?select=is_online,is_active,rating&assigned_pincodes=ov.{${hubPincodes.join(',')}}`;
        const statsResponse = await fetch(statsUrl, {
          headers: {
            'apikey': supabaseKey,
            'Authorization': `Bearer ${supabaseKey}`,
          },
        });
        allRiders = await statsResponse.json();
      }

      const stats = {
        total: allRiders?.length || 0,
        online: allRiders?.filter(r => r.is_online === true).length || 0,
        offline: allRiders?.filter(r => r.is_online === false).length || 0,
        active: allRiders?.filter(r => r.is_active === true).length || 0,
        avg_rating: allRiders?.reduce((sum, r) => sum + (r.rating || 0), 0) / (allRiders?.length || 1) || 0
      };

      const formattedRiders = riders?.map(rider => ({
        rider_id: rider.rider_id,
        name: rider.name,
        mobile: rider.mobile,
        email: rider.email,
        rating: rider.rating || 0,
        is_online: rider.is_online,
        is_active: rider.is_active,
        assigned_area: rider.assigned_area,
        assigned_pincodes: rider.assigned_pincodes,
        total_deliveries: rider.total_deliveries || 0,
        total_pickups: rider.total_pickups || 0,
        wallet_balance: rider.wallet_balance || 0,
        rate_per_parcel: rider.rate_per_parcel || 18,
        current_location: rider.current_location,
        last_location_update: rider.last_location_update,
        today_runsheet: riderRunMap.get(rider.rider_id) || null,
        week_performance: riderPerformance.get(rider.rider_id) || { deliveries: 0, pickups: 0, completed: 0 },
        created_at: rider.created_at
      })) || [];

      return new Response(JSON.stringify({
        success: true,
        riders: formattedRiders,
        stats: stats,
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
      console.error('Get riders error:', error);
      return new Response(JSON.stringify({ success: false, error: error.message }), {
        status: 500,
        headers: { 'Content-Type': 'application/json', ...corsHeaders }
      });
    }
  }

  // =====================================================
  // UPDATE RIDER STATUS (PUT)
  // =====================================================
  if (request.method === 'PUT') {
    try {
      const body = await request.json();
      const { rider_id, hub_id, is_active, is_online, assigned_area, assigned_pincodes, rate_per_parcel } = body;

      if (!rider_id || !hub_id) {
        return new Response(JSON.stringify({
          success: false,
          error: 'Rider ID and Hub ID are required'
        }), {
          status: 400,
          headers: { 'Content-Type': 'application/json', ...corsHeaders }
        });
      }

      const supabase = createSupabaseClient();
      const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
      const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

      const updateData = {};
      if (is_active !== undefined) updateData.is_active = is_active;
      if (is_online !== undefined) updateData.is_online = is_online;
      if (assigned_area !== undefined) updateData.assigned_area = assigned_area;
      if (assigned_pincodes !== undefined) updateData.assigned_pincodes = assigned_pincodes;
      if (rate_per_parcel !== undefined) updateData.rate_per_parcel = rate_per_parcel;
      updateData.updated_at = new Date().toISOString();

      const updateResult = await supabase
        .from('riders')
        .update(updateData)
        .eq('rider_id', rider_id)
        .select();

      if (updateResult.error) {
        console.error('Rider update error:', updateResult.error);
        return new Response(JSON.stringify({ success: false, error: updateResult.error.message }), {
          status: 500,
          headers: { 'Content-Type': 'application/json', ...corsHeaders }
        });
      }

      const updatedRider = updateResult.data;

      // Send notification to rider
      let message = '';
      if (is_active !== undefined) {
        message = is_active ? 'Your account has been activated' : 'Your account has been deactivated';
      }
      if (is_online !== undefined) {
        message = is_online ? 'You have been marked online' : 'You have been marked offline';
      }

      if (message) {
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
            title: 'Account Status Updated',
            message: message,
            type: 'account',
            data: { status: is_active !== undefined ? (is_active ? 'active' : 'inactive') : (is_online ? 'online' : 'offline') },
            created_at: new Date().toISOString()
          })
        });
      }

      return new Response(JSON.stringify({
        success: true,
        message: 'Rider updated successfully',
        rider: updatedRider
      }), {
        status: 200,
        headers: { 'Content-Type': 'application/json', ...corsHeaders }
      });

    } catch (error) {
      console.error('Update rider error:', error);
      return new Response(JSON.stringify({ success: false, error: error.message }), {
        status: 500,
        headers: { 'Content-Type': 'application/json', ...corsHeaders }
      });
    }
  }

  // =====================================================
  // ADD NEW RIDER (POST - Hub can request)
  // =====================================================
  if (request.method === 'POST') {
    try {
      const body = await request.json();
      const {
        hub_id,
        name,
        email,
        mobile,
        assigned_area,
        assigned_pincodes,
        dl_number,
        rc_number,
        aadhar_number,
        rate_per_parcel
      } = body;

      if (!hub_id || !name || !email || !mobile) {
        return new Response(JSON.stringify({
          success: false,
          error: 'Hub ID, name, email and mobile are required'
        }), {
          status: 400,
          headers: { 'Content-Type': 'application/json', ...corsHeaders }
        });
      }

      const supabase = createSupabaseClient();
      const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
      const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

      // Check if rider already exists
      const existingEmailUrl = `${supabaseUrl}/rest/v1/riders?email=eq.${encodeURIComponent(email)}&select=rider_id`;
      const existingEmailResponse = await fetch(existingEmailUrl, {
        headers: {
          'apikey': supabaseKey,
          'Authorization': `Bearer ${supabaseKey}`,
        },
      });
      const existingEmailData = await existingEmailResponse.json();
      const existingRider = existingEmailData[0];

      if (existingRider) {
        return new Response(JSON.stringify({
          success: false,
          error: 'Rider with this email already exists'
        }), {
          status: 400,
          headers: { 'Content-Type': 'application/json', ...corsHeaders }
        });
      }

      const existingMobileUrl = `${supabaseUrl}/rest/v1/riders?mobile=eq.${mobile}&select=rider_id`;
      const existingMobileResponse = await fetch(existingMobileUrl, {
        headers: {
          'apikey': supabaseKey,
          'Authorization': `Bearer ${supabaseKey}`,
        },
      });
      const existingMobileData = await existingMobileResponse.json();
      const existingMobile = existingMobileData[0];

      if (existingMobile) {
        return new Response(JSON.stringify({
          success: false,
          error: 'Rider with this mobile number already exists'
        }), {
          status: 400,
          headers: { 'Content-Type': 'application/json', ...corsHeaders }
        });
      }

      // Create new rider (pending owner approval)
      const riderInsert = await supabase
        .from('riders')
        .insert({
          name,
          email,
          mobile,
          assigned_area: assigned_area || null,
          assigned_pincodes: assigned_pincodes || [],
          dl_number: dl_number || null,
          rc_number: rc_number || null,
          aadhar: aadhar_number || null,
          rate_per_parcel: rate_per_parcel || 18,
          is_active: false,
          is_online: false,
          created_at: new Date().toISOString(),
          created_by: hub_id
        })
        .select();

      if (riderInsert.error) {
        console.error('Rider creation error:', riderInsert.error);
        return new Response(JSON.stringify({ success: false, error: riderInsert.error.message }), {
          status: 500,
          headers: { 'Content-Type': 'application/json', ...corsHeaders }
        });
      }

      const newRider = riderInsert.data;

      // Notify owner for approval
      await fetch(`${supabaseUrl}/rest/v1/notifications`, {
        method: 'POST',
        headers: {
          'apikey': supabaseKey,
          'Authorization': `Bearer ${supabaseKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          user_id: 'OWN001',
          user_type: 'owner',
          title: 'New Rider Registration',
          message: `${name} has been registered as a rider and pending approval`,
          type: 'rider',
          data: { rider_id: newRider.rider_id, hub_id: hub_id },
          created_at: new Date().toISOString()
        })
      });

      return new Response(JSON.stringify({
        success: true,
        message: 'Rider registration submitted. Waiting for owner approval.',
        rider: {
          rider_id: newRider.rider_id,
          name: newRider.name,
          email: newRider.email,
          mobile: newRider.mobile,
          is_active: newRider.is_active
        }
      }), {
        status: 200,
        headers: { 'Content-Type': 'application/json', ...corsHeaders }
      });

    } catch (error) {
      console.error('Add rider error:', error);
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