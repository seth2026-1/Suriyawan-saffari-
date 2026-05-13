// api/logistics/rider/dashboard.js
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
            gte: (gteField, gteValue) => ({
              select: async () => {
                const finalUrl = `${url}&${field}=eq.${value}&${gteField}=gte.${gteValue}`;
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
              limit: async (limit) => {
                const sortOrder = ascending ? 'asc' : 'desc';
                const finalUrl = `${url}&${field}=eq.${value}&order=${orderField}.${sortOrder}&limit=${limit}`;
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
            gte: (gteField, gteValue) => ({
              lte: (lteField, lteValue) => ({
                select: async () => {
                  const finalUrl = `${url}&${field}=eq.${value}&${gteField}=gte.${gteValue}&${lteField}=lte.${lteValue}`;
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
              limit: async (limit) => {
                const sortOrder = ascending ? 'asc' : 'desc';
                const finalUrl = `${url}&${field}=eq.${value}&order=${orderField}.${sortOrder}&limit=${limit}`;
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
    'PICKUP_COMPLETED': 'Pickup Completed',
    'DELIVERED': 'Delivered',
    'OUT_FOR_DELIVERY': 'Out for Delivery',
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

    // Get rider details
    const riderResult = await supabase
      .from('riders')
      .select('rider_id, name, email, mobile, rating, is_online, is_active, total_deliveries, total_pickups, wallet_balance, rate_per_parcel, pickup_rate, assigned_area, assigned_pincodes, current_location, last_location_update')
      .eq('rider_id', rider_id)
      .single();

    if (riderResult.error || !riderResult.data) {
      return new Response(JSON.stringify({ success: false, error: 'Rider not found' }), {
        status: 404,
        headers: { 'Content-Type': 'application/json', ...corsHeaders }
      });
    }

    const rider = riderResult.data;

    if (!rider.is_active) {
      return new Response(JSON.stringify({ success: false, error: 'Your account is inactive. Please contact hub manager.' }), {
        status: 403,
        headers: { 'Content-Type': 'application/json', ...corsHeaders }
      });
    }

    // Get today's runsheet
    const today = new Date().toISOString().split('T')[0];
    const runsheetSelect = `run_id,shift,date,status,total_pickups,total_deliveries,total_cod,pickup_orders,delivery_orders,route_data,created_at,accepted_at,started_at,completed_at,hub_managers!inner(hub_id,name as hub_name)`;
    const runsheetUrl = `${supabaseUrl}/rest/v1/runsheets?select=${encodeURIComponent(runsheetSelect)}&rider_id=eq.${rider_id}&date=eq.${today}&status=neq.CANCELLED`;
    const runsheetResponse = await fetch(runsheetUrl, {
      headers: {
        'apikey': supabaseKey,
        'Authorization': `Bearer ${supabaseKey}`,
      },
    });
    const runsheetData = await runsheetResponse.json();
    const todayRunsheet = runsheetData[0];

    // Get pending tasks (pickups and deliveries from today's runsheet)
    let pendingPickups = [];
    let pendingDeliveries = [];
    let completedPickups = 0;
    let completedDeliveries = 0;

    if (todayRunsheet) {
      // Get pickup orders details
      if (todayRunsheet.pickup_orders && todayRunsheet.pickup_orders.length > 0) {
        const pickupIdsList = todayRunsheet.pickup_orders.map(id => `'${id}'`).join(',');
        const pickupDetailsUrl = `${supabaseUrl}/rest/v1/orders?select=book_id,tracking_id,final_amount,address,placed_at,customers!inner(name,mobile),sellers!inner(shop_name,mobile as seller_mobile,address as seller_address)&book_id=in.(${pickupIdsList})`;
        const pickupDetailsResponse = await fetch(pickupDetailsUrl, {
          headers: {
            'apikey': supabaseKey,
            'Authorization': `Bearer ${supabaseKey}`,
          },
        });
        const pickupDetails = await pickupDetailsResponse.json();

        // Check which are completed
        const completedPickupUrl = `${supabaseUrl}/rest/v1/shipment_tracking?select=book_id&book_id=in.(${pickupIdsList})&status=eq.PICKUP_COMPLETED&rider_id=eq.${rider_id}`;
        const completedPickupResponse = await fetch(completedPickupUrl, {
          headers: {
            'apikey': supabaseKey,
            'Authorization': `Bearer ${supabaseKey}`,
          },
        });
        const completedPickupScans = await completedPickupResponse.json();

        const completedPickupIds = new Set(completedPickupScans?.map(s => s.book_id) || []);
        completedPickups = completedPickupIds.size;

        pendingPickups = pickupDetails?.filter(p => !completedPickupIds.has(p.book_id)).map(p => ({
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
      }

      // Get delivery orders details
      if (todayRunsheet.delivery_orders && todayRunsheet.delivery_orders.length > 0) {
        const deliveryIdsList = todayRunsheet.delivery_orders.map(id => `'${id}'`).join(',');
        const deliveryDetailsUrl = `${supabaseUrl}/rest/v1/orders?select=book_id,tracking_id,final_amount,address,placed_at,customers!inner(name,mobile),order_items!inner(quantity,products!inner(name,images))&book_id=in.(${deliveryIdsList})`;
        const deliveryDetailsResponse = await fetch(deliveryDetailsUrl, {
          headers: {
            'apikey': supabaseKey,
            'Authorization': `Bearer ${supabaseKey}`,
          },
        });
        const deliveryDetails = await deliveryDetailsResponse.json();

        // Check which are completed
        const completedDeliveryUrl = `${supabaseUrl}/rest/v1/shipment_tracking?select=book_id&book_id=in.(${deliveryIdsList})&status=eq.DELIVERED&rider_id=eq.${rider_id}`;
        const completedDeliveryResponse = await fetch(completedDeliveryUrl, {
          headers: {
            'apikey': supabaseKey,
            'Authorization': `Bearer ${supabaseKey}`,
          },
        });
        const completedDeliveryScans = await completedDeliveryResponse.json();

        const completedDeliveryIds = new Set(completedDeliveryScans?.map(s => s.book_id) || []);
        completedDeliveries = completedDeliveryIds.size;

        pendingDeliveries = deliveryDetails?.filter(d => !completedDeliveryIds.has(d.book_id)).map(d => ({
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
      }
    }

    // Get earnings for today and this week
    const weekAgo = new Date();
    weekAgo.setDate(weekAgo.getDate() - 7);
    const weekAgoStr = weekAgo.toISOString();

    const weekEarningsUrl = `${supabaseUrl}/rest/v1/wallet_transactions?select=amount,created_at&user_id=eq.${rider_id}&user_type=eq.rider&type=eq.credit&created_at=gte.${weekAgoStr}`;
    const weekEarningsResponse = await fetch(weekEarningsUrl, {
      headers: {
        'apikey': supabaseKey,
        'Authorization': `Bearer ${supabaseKey}`,
      },
    });
    const weekEarnings = await weekEarningsResponse.json();

    const todayEarnings = weekEarnings?.filter(w => w.created_at.split('T')[0] === today).reduce((sum, w) => sum + w.amount, 0) || 0;
    const weekTotalEarnings = weekEarnings?.reduce((sum, w) => sum + w.amount, 0) || 0;

    // Get recent activities (last 10)
    const recentActivitiesUrl = `${supabaseUrl}/rest/v1/shipment_tracking?select=book_id,status,created_at,notes&rider_id=eq.${rider_id}&order=created_at.desc&limit=10`;
    const recentActivitiesResponse = await fetch(recentActivitiesUrl, {
      headers: {
        'apikey': supabaseKey,
        'Authorization': `Bearer ${supabaseKey}`,
      },
    });
    const recentActivities = await recentActivitiesResponse.json();

    // Get notifications
    const notificationsUrl = `${supabaseUrl}/rest/v1/notifications?select=notif_id,title,message,type,is_read,created_at&user_id=eq.${rider_id}&user_type=eq.rider&order=created_at.desc&limit=10`;
    const notificationsResponse = await fetch(notificationsUrl, {
      headers: {
        'apikey': supabaseKey,
        'Authorization': `Bearer ${supabaseKey}`,
      },
    });
    const notifications = await notificationsResponse.json();

    // Get performance metrics for last 30 days
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    const thirtyDaysAgoStr = thirtyDaysAgo.toISOString();

    const monthRunsheetsUrl = `${supabaseUrl}/rest/v1/runsheets?select=total_deliveries,total_pickups,status&rider_id=eq.${rider_id}&created_at=gte.${thirtyDaysAgoStr}`;
    const monthRunsheetsResponse = await fetch(monthRunsheetsUrl, {
      headers: {
        'apikey': supabaseKey,
        'Authorization': `Bearer ${supabaseKey}`,
      },
    });
    const monthRunsheets = await monthRunsheetsResponse.json();

    const monthDeliveries = monthRunsheets?.reduce((sum, r) => sum + (r.total_deliveries || 0), 0) || 0;
    const monthPickups = monthRunsheets?.reduce((sum, r) => sum + (r.total_pickups || 0), 0) || 0;
    const monthCompleted = monthRunsheets?.filter(r => r.status === 'COMPLETED').length || 0;
    const monthTotal = monthRunsheets?.length || 0;

    // Calculate rating from completed deliveries
    const reviewsUrl = `${supabaseUrl}/rest/v1/rider_reviews?select=rating&rider_id=eq.${rider_id}`;
    const reviewsResponse = await fetch(reviewsUrl, {
      headers: {
        'apikey': supabaseKey,
        'Authorization': `Bearer ${supabaseKey}`,
      },
    });
    const reviews = await reviewsResponse.json();

    const avgRating = reviews?.reduce((sum, r) => sum + r.rating, 0) / (reviews?.length || 1) || rider.rating || 0;

    // Get current location
    let currentLocation = rider.current_location;
    let lastUpdate = rider.last_location_update;

    // Update online status if needed (auto offline after inactivity)
    if (rider.is_online && lastUpdate) {
      const lastUpdateTime = new Date(lastUpdate);
      const now = new Date();
      const inactiveMinutes = (now - lastUpdateTime) / (1000 * 60);

      if (inactiveMinutes > 30) {
        await fetch(`${supabaseUrl}/rest/v1/riders?rider_id=eq.${rider_id}`, {
          method: 'PATCH',
          headers: {
            'apikey': supabaseKey,
            'Authorization': `Bearer ${supabaseKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ is_online: false, updated_at: new Date().toISOString() })
        });
        rider.is_online = false;
      }
    }

    // Check for alerts
    const alerts = [];

    if (todayRunsheet && (pendingDeliveries.length > 0 || pendingPickups.length > 0) && !todayRunsheet.started_at) {
      alerts.push({
        type: 'warning',
        title: 'Runsheet Not Started',
        message: 'You have pending tasks. Please start your runsheet.',
        action: '/logistics/rider/my-runsheet'
      });
    }

    if (rider.wallet_balance > 500) {
      alerts.push({
        type: 'success',
        title: 'Wallet Balance Available',
        message: `You have ₹${rider.wallet_balance} in your wallet. Claim your payout now.`,
        action: '/logistics/rider/earnings'
      });
    }

    if (pendingDeliveries.length > 5) {
      alerts.push({
        type: 'info',
        title: 'Multiple Deliveries Pending',
        message: `You have ${pendingDeliveries.length} deliveries pending for today.`,
        action: '/logistics/rider/delivery'
      });
    }

    // Calculate completion percentage
    let completionPercentage = 0;
    if (todayRunsheet) {
      const total = (todayRunsheet.total_deliveries || 0) + (todayRunsheet.total_pickups || 0);
      const completed = completedDeliveries + completedPickups;
      completionPercentage = total > 0 ? (completed / total) * 100 : 0;
    }

    return new Response(JSON.stringify({
      success: true,
      rider: {
        rider_id: rider.rider_id,
        name: rider.name,
        email: rider.email,
        mobile: rider.mobile,
        rating: parseFloat(avgRating.toFixed(1)),
        is_online: rider.is_online,
        total_deliveries: rider.total_deliveries || 0,
        total_pickups: rider.total_pickups || 0,
        wallet_balance: rider.wallet_balance || 0,
        rate_per_parcel: rider.rate_per_parcel || 18,
        current_location: currentLocation,
        last_location_update: lastUpdate
      },
      today_runsheet: todayRunsheet ? {
        run_id: todayRunsheet.run_id,
        shift: todayRunsheet.shift,
        status: todayRunsheet.status,
        total_pickups: todayRunsheet.total_pickups,
        total_deliveries: todayRunsheet.total_deliveries,
        total_cod: todayRunsheet.total_cod,
        completed_pickups: completedPickups,
        completed_deliveries: completedDeliveries,
        completion_percentage: Math.round(completionPercentage),
        pending_pickups: pendingPickups,
        pending_deliveries: pendingDeliveries
      } : null,
      earnings: {
        today: todayEarnings,
        week: weekTotalEarnings,
        wallet_balance: rider.wallet_balance || 0
      },
      performance: {
        month_deliveries: monthDeliveries,
        month_pickups: monthPickups,
        month_completed_runsheets: monthCompleted,
        month_total_runsheets: monthTotal,
        completion_rate: monthTotal > 0 ? Math.round((monthCompleted / monthTotal) * 100) : 0
      },
      recent_activities: recentActivities?.map(a => ({
        book_id: a.book_id,
        status: a.status,
        status_display: getStatusDisplay(a.status),
        time: a.created_at,
        notes: a.notes
      })) || [],
      notifications: notifications?.map(n => ({
        id: n.notif_id,
        title: n.title,
        message: n.message,
        type: n.type,
        is_read: n.is_read,
        created_at: n.created_at
      })) || [],
      alerts: alerts,
      last_updated: new Date().toISOString()
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json', ...corsHeaders }
    });

  } catch (error) {
    console.error('Rider dashboard error:', error);
    return new Response(JSON.stringify({
      success: false,
      error: error.message || 'Internal server error'
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json', ...corsHeaders }
    });
  }
}