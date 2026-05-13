// api/logistics/hub/dashboard.js
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
            gte: (gteField, gteValue) => ({
              lte: (lteField, lteValue) => ({
                select: async () => {
                  const finalUrl = `${url}&${field}=eq.${value}&${gteField}=gte.${gteValue}&${lteField}=lte.${lteValue}&order=created_at.desc`;
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
            contains: (containsField, containsValue) => ({
              gte: (gteField, gteValue) => ({
                select: async () => {
                  const finalUrl = `${url}&${field}=eq.${value}&${containsField}=cs.{${containsValue.join(',')}}&${gteField}=gte.${gteValue}`;
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
          in: (field, values) => ({
            gte: (gteField, gteValue) => ({
              select: async () => {
                const finalUrl = `${supabaseUrl}/rest/v1/${table}?select=*&${field}=in.(${values.join(',')})&${gteField}=gte.${gteValue}`;
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
      }
    })
  };
}

export default async function handler(request) {
  // CORS Headers
  const corsHeaders = {
    'Access-Control-Allow-Credentials': 'true',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, OPTIONS',
    'Access-Control-Allow-Headers': 'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version, Authorization',
  };

  // Handle OPTIONS preflight
  if (request.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: corsHeaders });
  }

  if (request.method !== 'GET') {
    return new Response(JSON.stringify({ success: false, error: 'Method not allowed' }), {
      status: 405,
      headers: { 'Content-Type': 'application/json', ...corsHeaders }
    });
  }

  try {
    const url = new URL(request.url);
    const hub_id = url.searchParams.get('hub_id');
    const period = url.searchParams.get('period') || 'today';

    if (!hub_id) {
      return new Response(JSON.stringify({ success: false, error: 'Hub ID is required' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json', ...corsHeaders }
      });
    }

    const supabase = createSupabaseClient();
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

    // Get hub details
    const hubResult = await supabase
      .from('hub_managers')
      .select('*')
      .eq('hub_id', hub_id)
      .single();

    if (hubResult.error || !hubResult.data) {
      return new Response(JSON.stringify({ success: false, error: 'Hub not found' }), {
        status: 404,
        headers: { 'Content-Type': 'application/json', ...corsHeaders }
      });
    }

    const hub = hubResult.data;

    // Date range based on period
    let startDate;
    const now = new Date();

    switch (period) {
      case 'today':
        startDate = new Date(now.setHours(0, 0, 0, 0));
        break;
      case 'week':
        startDate = new Date(now.setDate(now.getDate() - 7));
        break;
      case 'month':
        startDate = new Date(now.setMonth(now.getMonth() - 1));
        break;
      default:
        startDate = new Date(now.setHours(0, 0, 0, 0));
    }

    const startDateStr = startDate.toISOString();

    // =====================================================
    // RUNSHEET STATISTICS
    // =====================================================

    const runsheetsUrl = `${supabaseUrl}/rest/v1/runsheets?select=*,riders!left(rider_id,name,mobile)&hub_id=eq.${hub_id}&created_at=gte.${startDateStr}&order=created_at.desc`;
    const runsheetsResponse = await fetch(runsheetsUrl, {
      headers: {
        'apikey': supabaseKey,
        'Authorization': `Bearer ${supabaseKey}`,
      },
    });
    const runsheets = await runsheetsResponse.json();

    const totalRunsheets = runsheets?.length || 0;
    const assignedRunsheets = runsheets?.filter(r => r.status === 'ASSIGNED').length || 0;
    const acceptedRunsheets = runsheets?.filter(r => r.status === 'ACCEPTED').length || 0;
    const startedRunsheets = runsheets?.filter(r => r.status === 'STARTED').length || 0;
    const completedRunsheets = runsheets?.filter(r => r.status === 'COMPLETED').length || 0;
    const cancelledRunsheets = runsheets?.filter(r => r.status === 'CANCELLED').length || 0;

    // =====================================================
    // ORDER STATISTICS
    // =====================================================

    const assignedPincodes = hub.assigned_pincodes || [];
    let areaOrders = [];

    if (assignedPincodes.length > 0) {
      const pincodeList = assignedPincodes.map(p => `'${p}'`).join(',');
      let ordersUrl = `${supabaseUrl}/rest/v1/orders?select=*&address->>pincode=in.(${pincodeList})`;

      if (period !== 'all') {
        ordersUrl += `&placed_at=gte.${startDateStr}`;
      }

      const ordersResponse = await fetch(ordersUrl, {
        headers: {
          'apikey': supabaseKey,
          'Authorization': `Bearer ${supabaseKey}`,
        },
      });
      areaOrders = await ordersResponse.json();
    }

    const totalOrders = areaOrders?.length || 0;
    const pendingOrders = areaOrders?.filter(o => o.status === 'PENDING').length || 0;
    const acceptedOrders = areaOrders?.filter(o => o.status === 'ACCEPTED').length || 0;
    const packedOrders = areaOrders?.filter(o => o.status === 'PACKED').length || 0;
    const shippedOrders = areaOrders?.filter(o => o.status === 'SHIPPED').length || 0;
    const outForDelivery = areaOrders?.filter(o => o.status === 'OUT_FOR_DELIVERY').length || 0;
    const deliveredOrders = areaOrders?.filter(o => o.status === 'DELIVERED').length || 0;
    const rtoOrders = areaOrders?.filter(o => o.status === 'RTO').length || 0;

    // =====================================================
    // PICKUP & DELIVERY STATISTICS
    // =====================================================

    let totalPickups = 0;
    let totalDeliveries = 0;
    let totalCodCollected = 0;

    runsheets?.forEach(run => {
      totalPickups += run.total_pickups || 0;
      totalDeliveries += run.total_deliveries || 0;
      totalCodCollected += run.total_cod || 0;
    });

    // =====================================================
    // RIDER PERFORMANCE
    // =====================================================

    let riders = [];
    if (assignedPincodes.length > 0) {
      const pincodeList = assignedPincodes.map(p => `'${p}'`).join(',');
      const ridersUrl = `${supabaseUrl}/rest/v1/riders?select=*&assigned_pincodes=ov.{${pincodeList}}&is_active=eq.true`;
      const ridersResponse = await fetch(ridersUrl, {
        headers: {
          'apikey': supabaseKey,
          'Authorization': `Bearer ${supabaseKey}`,
        },
      });
      riders = await ridersResponse.json();
    }

    const totalRiders = riders?.length || 0;
    const onlineRiders = riders?.filter(r => r.is_online === true).length || 0;
    const offlineRiders = totalRiders - onlineRiders;

    // Get rider performance metrics
    const riderPerformance = await Promise.all((riders || []).map(async (rider) => {
      const riderRunsheets = runsheets?.filter(r => r.rider_id === rider.rider_id) || [];
      const riderDeliveries = riderRunsheets.reduce((sum, run) => sum + (run.total_deliveries || 0), 0);
      const riderPickups = riderRunsheets.reduce((sum, run) => sum + (run.total_pickups || 0), 0);

      return {
        rider_id: rider.rider_id,
        name: rider.name,
        mobile: rider.mobile,
        rating: rider.rating,
        is_online: rider.is_online,
        total_runsheets: riderRunsheets.length,
        total_deliveries: riderDeliveries,
        total_pickups: riderPickups,
        completed_runsheets: riderRunsheets.filter(r => r.status === 'COMPLETED').length
      };
    }));

    // =====================================================
    // BAG & SHIPMENT STATISTICS
    // =====================================================

    const bagsUrl = `${supabaseUrl}/rest/v1/bags?select=*&from_hub=eq.${hub_id}&created_at=gte.${startDateStr}`;
    const bagsResponse = await fetch(bagsUrl, {
      headers: {
        'apikey': supabaseKey,
        'Authorization': `Bearer ${supabaseKey}`,
      },
    });
    const bags = await bagsResponse.json();

    const totalBags = bags?.length || 0;
    const bagsInTransit = bags?.filter(b => b.status === 'IN_TRANSIT').length || 0;
    const bagsReceived = bags?.filter(b => b.status === 'RECEIVED').length || 0;
    const totalPacketsInBags = bags?.reduce((sum, b) => sum + (b.packet_count || 0), 0) || 0;

    // =====================================================
    // DAILY TRENDS
    // =====================================================

    const dailyTrends = [];
    const currentDate = new Date(startDate);
    const endDate = new Date();

    while (currentDate <= endDate) {
      const dateStr = currentDate.toISOString().split('T')[0];
      const dayRunsheets = runsheets?.filter(r => r.created_at?.split('T')[0] === dateStr) || [];
      const dayOrders = areaOrders?.filter(o => o.placed_at?.split('T')[0] === dateStr) || [];

      dailyTrends.push({
        date: dateStr,
        runsheets: dayRunsheets.length,
        orders: dayOrders.length,
        deliveries: dayRunsheets.reduce((sum, r) => sum + (r.total_deliveries || 0), 0),
        pickups: dayRunsheets.reduce((sum, r) => sum + (r.total_pickups || 0), 0),
        cod: dayRunsheets.reduce((sum, r) => sum + (r.total_cod || 0), 0)
      });

      currentDate.setDate(currentDate.getDate() + 1);
    }

    // =====================================================
    // RECENT ACTIVITY
    // =====================================================

    const recentRunsheets = runsheets?.slice(0, 10).map(run => ({
      run_id: run.run_id,
      rider_name: run.riders?.name,
      status: run.status,
      total_deliveries: run.total_deliveries,
      total_pickups: run.total_pickups,
      total_cod: run.total_cod,
      created_at: run.created_at,
      completed_at: run.completed_at
    })) || [];

    // Get recent RTO orders
    const recentRtoOrders = areaOrders?.filter(o => o.status === 'RTO').slice(0, 10).map(order => ({
      book_id: order.book_id,
      final_amount: order.final_amount,
      cancelled_at: order.cancelled_at,
      cancel_reason: order.cancel_reason
    })) || [];

    // =====================================================
    // ALERTS
    // =====================================================

    const alerts = [];

    if (packedOrders > 0) {
      alerts.push({
        type: 'warning',
        title: 'Pending Pickups',
        message: `${packedOrders} orders are packed and waiting for pickup`,
        action: '/logistics/hub/inbound'
      });
    }

    if (onlineRiders === 0 && totalRiders > 0) {
      alerts.push({
        type: 'danger',
        title: 'No Riders Online',
        message: 'No riders are currently online. Assign runsheets may be delayed.',
        action: '/logistics/hub/riders'
      });
    }

    const rtoRate = totalOrders > 0 ? (rtoOrders / totalOrders) * 100 : 0;
    if (rtoRate > 15) {
      alerts.push({
        type: 'danger',
        title: 'High RTO Rate',
        message: `RTO rate is ${rtoRate.toFixed(1)}%. Review customer delivery issues.`,
        action: '/logistics/hub/rto'
      });
    }

    if (totalCodCollected > 0) {
      const pendingCashUrl = `${supabaseUrl}/rest/v1/cash_deposits?select=*&hub_id=eq.${hub_id}&status=eq.PENDING&limit=1`;
      const pendingCashResponse = await fetch(pendingCashUrl, {
        headers: {
          'apikey': supabaseKey,
          'Authorization': `Bearer ${supabaseKey}`,
        },
      });
      const pendingCashData = await pendingCashResponse.json();
      const pendingCash = pendingCashData[0];

      if (pendingCash) {
        alerts.push({
          type: 'warning',
          title: 'Pending Cash Deposit',
          message: 'Cash collected from riders needs to be deposited',
          action: '/logistics/hub/cod'
        });
      }
    }

    return new Response(JSON.stringify({
      success: true,
      hub: {
        hub_id: hub.hub_id,
        name: hub.name,
        email: hub.email,
        mobile: hub.mobile,
        assigned_zone: hub.assigned_zone,
        assigned_pincodes: hub.assigned_pincodes
      },
      dashboard: {
        period: period,
        runsheets: {
          total: totalRunsheets,
          assigned: assignedRunsheets,
          accepted: acceptedRunsheets,
          started: startedRunsheets,
          completed: completedRunsheets,
          cancelled: cancelledRunsheets,
          completion_rate: totalRunsheets > 0 ? (completedRunsheets / totalRunsheets) * 100 : 0
        },
        orders: {
          total: totalOrders,
          pending: pendingOrders,
          accepted: acceptedOrders,
          packed: packedOrders,
          shipped: shippedOrders,
          out_for_delivery: outForDelivery,
          delivered: deliveredOrders,
          rto: rtoOrders,
          rto_rate: parseFloat(rtoRate.toFixed(2))
        },
        logistics: {
          total_pickups: totalPickups,
          total_deliveries: totalDeliveries,
          total_cod_collected: totalCodCollected,
          total_bags: totalBags,
          bags_in_transit: bagsInTransit,
          bags_received: bagsReceived,
          packets_in_bags: totalPacketsInBags
        },
        riders: {
          total: totalRiders,
          online: onlineRiders,
          offline: offlineRiders,
          performance: riderPerformance.sort((a, b) => b.completed_runsheets - a.completed_runsheets)
        },
        daily_trends: dailyTrends,
        recent_activity: {
          runsheets: recentRunsheets,
          rto_orders: recentRtoOrders
        },
        alerts: alerts,
        last_updated: new Date().toISOString()
      }
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json', ...corsHeaders }
    });

  } catch (error) {
    console.error('Hub dashboard error:', error);
    return new Response(JSON.stringify({
      success: false,
      error: error.message || 'Internal server error'
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json', ...corsHeaders }
    });
  }
}