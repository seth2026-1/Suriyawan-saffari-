// api/owner/users/riders.js
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

        const execute = async (queryModifiers = {}) => {
          let finalUrl = url;

          if (queryModifiers.eq) {
            const [field, value] = Object.entries(queryModifiers.eq)[0];
            finalUrl += `${finalUrl.includes('?') ? '&' : '?'}${field}=eq.${value}`;
          }

          if (queryModifiers.gte) {
            const [field, value] = Object.entries(queryModifiers.gte)[0];
            finalUrl += `${finalUrl.includes('?') ? '&' : '?'}${field}=gte.${value}`;
          }

          if (queryModifiers.lte) {
            const [field, value] = Object.entries(queryModifiers.lte)[0];
            finalUrl += `${finalUrl.includes('?') ? '&' : '?'}${field}=lte.${value}`;
          }

          if (queryModifiers.or) {
            finalUrl += `${finalUrl.includes('?') ? '&' : '?'}or=${queryModifiers.or}`;
          }

          if (queryModifiers.order) {
            finalUrl += `${finalUrl.includes('?') ? '&' : '?'}order=${queryModifiers.order.field}.${queryModifiers.order.ascending ? 'asc' : 'desc'}`;
          }

          if (queryModifiers.range) {
            finalUrl += `${finalUrl.includes('?') ? '&' : '?'}offset=${queryModifiers.range.from}&limit=${queryModifiers.range.to - queryModifiers.range.from + 1}`;
          }

          if (options.count === 'exact') {
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
          const count = response.headers.get('content-range')?.split('/')[1];
          return { data, error: null, count: count ? parseInt(count) : null };
        };

        return {
          eq: (field, value) => ({
            single: async () => {
              const result = await execute({ eq: { [field]: value } });
              return { data: result.data[0] || null, error: null };
            },
            gte: (gteField, gteValue) => ({
              lte: (lteField, lteValue) => ({
                order: (orderField, { ascending }) => ({
                  range: async (from, to) => {
                    const result = await execute({
                      eq: { [field]: value },
                      gte: { [gteField]: gteValue },
                      lte: { [lteField]: lteValue },
                      order: { field: orderField, ascending },
                      range: { from, to }
                    });
                    return result;
                  }
                })
              })
            }),
            or: (condition) => ({
              order: (orderField, { ascending }) => ({
                range: async (from, to) => {
                  const result = await execute({
                    eq: { [field]: value },
                    or: condition,
                    order: { field: orderField, ascending },
                    range: { from, to }
                  });
                  return result;
                }
              })
            }),
            order: (orderField, { ascending }) => ({
              range: async (from, to) => {
                const result = await execute({
                  eq: { [field]: value },
                  order: { field: orderField, ascending },
                  range: { from, to }
                });
                return result;
              }
            })
          })
        };
      },
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
  const supabase = createSupabaseClient();
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  // =====================================================
  // GET RIDERS LIST
  // =====================================================
  if (request.method === 'GET') {
    try {
      const search = url.searchParams.get('search');
      const status = url.searchParams.get('status');
      const rating_min = url.searchParams.get('rating_min');
      const from_date = url.searchParams.get('from_date');
      const to_date = url.searchParams.get('to_date');
      const sort_by = url.searchParams.get('sort_by') || 'created_at';
      const sort_order = url.searchParams.get('sort_order') || 'desc';
      const page = parseInt(url.searchParams.get('page') || '1');
      const limit = parseInt(url.searchParams.get('limit') || '20');

      const ridersSelect = `rider_id,name,email,mobile,upi_id,dl_number,rc_number,aadhar,assigned_area,assigned_pincodes,rate_per_parcel,pickup_rate,rating,total_deliveries,total_pickups,wallet_balance,is_online,is_active,created_at,updated_at`;
      let ridersUrl = `${supabaseUrl}/rest/v1/riders?select=${encodeURIComponent(ridersSelect)}`;

      if (search) {
        ridersUrl += `&or=(name.ilike.%${search}%,email.ilike.%${search}%,mobile.ilike.%${search}%,rider_id.ilike.%${search}%)`;
      }

      if (status === 'active') {
        ridersUrl += `&is_active=eq.true`;
      } else if (status === 'inactive') {
        ridersUrl += `&is_active=eq.false`;
      } else if (status === 'online') {
        ridersUrl += `&is_online=eq.true`;
      } else if (status === 'offline') {
        ridersUrl += `&is_online=eq.false`;
      }

      if (rating_min) {
        ridersUrl += `&rating=gte.${parseFloat(rating_min)}`;
      }

      if (from_date) {
        ridersUrl += `&created_at=gte.${from_date}`;
      }
      if (to_date) {
        ridersUrl += `&created_at=lte.${to_date}`;
      }

      const sortAsc = sort_order === 'asc';
      ridersUrl += `&order=${sort_by}.${sortAsc ? 'asc' : 'desc'}`;

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

      // Get statistics for each rider
      const ridersWithStats = await Promise.all(riders.map(async (rider) => {
        // Get runsheet stats
        const runsheetsUrl = `${supabaseUrl}/rest/v1/runsheets?select=status,total_deliveries,total_pickups&rider_id=eq.${rider.rider_id}`;
        const runsheetsResponse = await fetch(runsheetsUrl, {
          headers: {
            'apikey': supabaseKey,
            'Authorization': `Bearer ${supabaseKey}`,
          },
        });
        const runsheets = await runsheetsResponse.json();

        const totalRunsheets = runsheets?.length || 0;
        const completedRunsheets = runsheets?.filter(r => r.status === 'COMPLETED').length || 0;
        const totalDeliveries = runsheets?.reduce((sum, r) => sum + (r.total_deliveries || 0), 0) || 0;
        const totalPickups = runsheets?.reduce((sum, r) => sum + (r.total_pickups || 0), 0) || 0;

        // Get last 7 days performance
        const weekAgo = new Date();
        weekAgo.setDate(weekAgo.getDate() - 7);
        const weekAgoStr = weekAgo.toISOString();

        const weekRunsheetsUrl = `${supabaseUrl}/rest/v1/runsheets?select=total_deliveries,total_pickups,status&rider_id=eq.${rider.rider_id}&created_at=gte.${weekAgoStr}`;
        const weekRunsheetsResponse = await fetch(weekRunsheetsUrl, {
          headers: {
            'apikey': supabaseKey,
            'Authorization': `Bearer ${supabaseKey}`,
          },
        });
        const weekRunsheets = await weekRunsheetsResponse.json();

        const weekDeliveries = weekRunsheets?.reduce((sum, r) => sum + (r.total_deliveries || 0), 0) || 0;
        const weekPickups = weekRunsheets?.reduce((sum, r) => sum + (r.total_pickups || 0), 0) || 0;

        return {
          ...rider,
          runsheet_stats: {
            total_runsheets: totalRunsheets,
            completed_runsheets: completedRunsheets,
            completion_rate: totalRunsheets > 0 ? (completedRunsheets / totalRunsheets) * 100 : 0,
            total_deliveries: totalDeliveries,
            total_pickups: totalPickups
          },
          week_performance: {
            deliveries: weekDeliveries,
            pickups: weekPickups
          }
        };
      }));

      // Get statistics summary
      const allRidersUrl = `${supabaseUrl}/rest/v1/riders?select=is_active,is_online,rating,wallet_balance`;
      const allRidersResponse = await fetch(allRidersUrl, {
        headers: {
          'apikey': supabaseKey,
          'Authorization': `Bearer ${supabaseKey}`,
        },
      });
      const allRiders = await allRidersResponse.json();

      const stats = {
        total: allRiders?.length || 0,
        active: allRiders?.filter(r => r.is_active === true).length || 0,
        inactive: allRiders?.filter(r => r.is_active === false).length || 0,
        online: allRiders?.filter(r => r.is_online === true).length || 0,
        offline: allRiders?.filter(r => r.is_online === false).length || 0,
        avg_rating: allRiders?.reduce((sum, r) => sum + (r.rating || 0), 0) / (allRiders?.length || 1) || 0,
        total_wallet_balance: allRiders?.reduce((sum, r) => sum + (r.wallet_balance || 0), 0) || 0
      };

      return new Response(JSON.stringify({
        success: true,
        riders: ridersWithStats,
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
  // UPDATE RIDER (PUT)
  // =====================================================
  if (request.method === 'PUT') {
    try {
      const body = await request.json();
      const {
        rider_id,
        name,
        email,
        mobile,
        upi_id,
        assigned_area,
        assigned_pincodes,
        rate_per_parcel,
        pickup_rate,
        is_active,
        wallet_balance
      } = body;

      if (!rider_id) {
        return new Response(JSON.stringify({ success: false, error: 'Rider ID is required' }), {
          status: 400,
          headers: { 'Content-Type': 'application/json', ...corsHeaders }
        });
      }

      const updateData = {};
      if (name !== undefined) updateData.name = name;
      if (email !== undefined) updateData.email = email;
      if (mobile !== undefined) updateData.mobile = mobile;
      if (upi_id !== undefined) updateData.upi_id = upi_id;
      if (assigned_area !== undefined) updateData.assigned_area = assigned_area;
      if (assigned_pincodes !== undefined) updateData.assigned_pincodes = assigned_pincodes;
      if (rate_per_parcel !== undefined) updateData.rate_per_parcel = rate_per_parcel;
      if (pickup_rate !== undefined) updateData.pickup_rate = pickup_rate;
      if (is_active !== undefined) updateData.is_active = is_active;
      if (wallet_balance !== undefined) updateData.wallet_balance = wallet_balance;

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
      if (is_active !== undefined) {
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
            title: is_active ? 'Account Activated' : 'Account Deactivated',
            message: is_active
              ? 'Your rider account has been activated by admin.'
              : 'Your rider account has been deactivated. Please contact support.',
            type: 'account',
            data: { is_active },
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
  // CREATE NEW RIDER (POST)
  // =====================================================
  if (request.method === 'POST') {
    try {
      const body = await request.json();
      const {
        name,
        email,
        mobile,
        upi_id,
        dl_number,
        rc_number,
        aadhar,
        assigned_area,
        assigned_pincodes,
        rate_per_parcel,
        pickup_rate
      } = body;

      if (!name || !email || !mobile) {
        return new Response(JSON.stringify({
          success: false,
          error: 'Name, email and mobile are required'
        }), {
          status: 400,
          headers: { 'Content-Type': 'application/json', ...corsHeaders }
        });
      }

      // Check if rider already exists
      const existingEmailUrl = `${supabaseUrl}/rest/v1/riders?email=eq.${encodeURIComponent(email)}&select=rider_id`;
      const existingEmailResponse = await fetch(existingEmailUrl, {
        headers: {
          'apikey': supabaseKey,
          'Authorization': `Bearer ${supabaseKey}`,
        },
      });
      const existingEmailData = await existingEmailResponse.json();
      const existingEmail = existingEmailData[0];

      if (existingEmail) {
        return new Response(JSON.stringify({ success: false, error: 'Rider with this email already exists' }), {
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
        return new Response(JSON.stringify({ success: false, error: 'Rider with this mobile number already exists' }), {
          status: 400,
          headers: { 'Content-Type': 'application/json', ...corsHeaders }
        });
      }

      // Generate RIDER ID
      const date = new Date();
      const dateStr = date.toISOString().slice(0, 10).replace(/-/g, '');
      const lastRiderUrl = `${supabaseUrl}/rest/v1/riders?select=rider_id&order=created_at.desc&limit=1`;
      const lastRiderResponse = await fetch(lastRiderUrl, {
        headers: {
          'apikey': supabaseKey,
          'Authorization': `Bearer ${supabaseKey}`,
        },
      });
      const lastRiderData = await lastRiderResponse.json();
      const lastRider = lastRiderData[0];

      let serial = '0001';
      if (lastRider && lastRider.rider_id) {
        const lastSerial = parseInt(lastRider.rider_id.slice(-4));
        serial = String(lastSerial + 1).padStart(4, '0');
      }

      const riderId = `RIDE${dateStr}${serial}`;

      // Create new rider
      const riderInsert = await supabase
        .from('riders')
        .insert({
          rider_id: riderId,
          name,
          email,
          mobile,
          upi_id: upi_id || null,
          dl_number: dl_number || null,
          rc_number: rc_number || null,
          aadhar: aadhar || null,
          assigned_area: assigned_area || null,
          assigned_pincodes: assigned_pincodes || [],
          rate_per_parcel: rate_per_parcel || 18,
          pickup_rate: pickup_rate || 10,
          is_active: true,
          is_online: false,
          created_at: new Date().toISOString()
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

      return new Response(JSON.stringify({
        success: true,
        message: 'Rider created successfully',
        rider: newRider,
        barcode_url: `/api/barcode/generate?text=${riderId}`,
        qr_url: `/api/barcode/generate-qr?text=${riderId}`
      }), {
        status: 200,
        headers: { 'Content-Type': 'application/json', ...corsHeaders }
      });

    } catch (error) {
      console.error('Create rider error:', error);
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