// api/logistics/hub/create-runsheet.js
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
              not: (notField, notOperator, notValue) => ({
                select: async (columns2) => {
                  const finalUrl = `${url}&${field}=eq.${value}&${field2}=in.(${values.join(',')})&${notField}=${notOperator}.${notValue}&select=${columns2 || '*'}`;
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
            in: (field2, values) => ({
              not: (notField, notOperator, notValue) => ({
                select: async (columns2) => {
                  const finalUrl = `${url}&${field}=eq.${value}&${field2}=in.(${values.join(',')})&${notField}=${notOperator}.${notValue}&select=${columns2 || '*'}`;
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

// Helper function to optimize route (placeholder - for production integrate with Google Maps or OSRM)
async function optimizeRoute(deliveries, pickups) {
  const stops = [
    ...(deliveries || []).map(d => ({
      id: d.book_id,
      type: 'delivery',
      address: d.address,
      lat: d.address?.lat,
      lng: d.address?.lng
    })),
    ...(pickups || []).map(p => ({
      id: p.book_id,
      type: 'pickup',
      address: p.address,
      lat: p.address?.lat,
      lng: p.address?.lng
    }))
  ];

  if (stops.length === 0) {
    return { optimized_order: [], total_distance: 0, estimated_time: 0 };
  }

  const stopsWithCoords = stops.filter(s => s.lat && s.lng);

  if (stopsWithCoords.length > 1) {
    return {
      optimized_order: stops.map(s => s.id),
      total_distance: stops.length * 2,
      estimated_time: stops.length * 10,
      stops: stops
    };
  }

  return {
    optimized_order: stops.map(s => s.id),
    total_distance: stops.length * 2,
    estimated_time: stops.length * 10,
    stops: stops
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
  // GET DATA FOR CREATE RUNSHEET FORM
  // =====================================================
  if (request.method === 'GET') {
    try {
      const hub_id = url.searchParams.get('hub_id');
      const date = url.searchParams.get('date');

      if (!hub_id) {
        return new Response(JSON.stringify({ success: false, error: 'Hub ID is required' }), {
          status: 400,
          headers: { 'Content-Type': 'application/json', ...corsHeaders }
        });
      }

      const supabase = createSupabaseClient();
      const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
      const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

      const targetDate = date || new Date().toISOString().split('T')[0];

      // Get hub details
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

      // Get available riders
      const ridersUrl = `${supabaseUrl}/rest/v1/riders?select=rider_id,name,mobile,rating,is_online,assigned_pincodes&is_active=eq.true&order=rating.desc`;
      const ridersResponse = await fetch(ridersUrl, {
        headers: {
          'apikey': supabaseKey,
          'Authorization': `Bearer ${supabaseKey}`,
        },
      });
      const riders = await ridersResponse.json();

      // Get pending pickup orders (packed orders in this hub's area)
      let pickupOrders = [];
      if (hubPincodes.length > 0) {
        const pincodeList = hubPincodes.map(p => `'${p}'`).join(',');
        const pickupUrl = `${supabaseUrl}/rest/v1/orders?select=book_id,tracking_id,final_amount,address,placed_at,customers!inner(name,mobile),order_items!inner(quantity,products!inner(name,images))&status=eq.PACKED&address->>pincode=in.(${pincodeList})&order=placed_at.asc`;
        const pickupResponse = await fetch(pickupUrl, {
          headers: {
            'apikey': supabaseKey,
            'Authorization': `Bearer ${supabaseKey}`,
          },
        });
        pickupOrders = await pickupResponse.json();
      }

      // Get pending delivery orders (shipped orders in this hub's area)
      let deliveryOrders = [];
      if (hubPincodes.length > 0) {
        const pincodeList = hubPincodes.map(p => `'${p}'`).join(',');
        const deliveryUrl = `${supabaseUrl}/rest/v1/orders?select=book_id,tracking_id,final_amount,address,placed_at,customers!inner(name,mobile),order_items!inner(quantity,products!inner(name,images))&status=eq.SHIPPED&address->>pincode=in.(${pincodeList})&order=placed_at.asc`;
        const deliveryResponse = await fetch(deliveryUrl, {
          headers: {
            'apikey': supabaseKey,
            'Authorization': `Bearer ${supabaseKey}`,
          },
        });
        deliveryOrders = await deliveryResponse.json();
      }

      // Get existing runsheets for today
      const existingUrl = `${supabaseUrl}/rest/v1/runsheets?select=rider_id,shift&hub_id=eq.${hub_id}&date=eq.${targetDate}&status=neq.CANCELLED`;
      const existingResponse = await fetch(existingUrl, {
        headers: {
          'apikey': supabaseKey,
          'Authorization': `Bearer ${supabaseKey}`,
        },
      });
      const existingRunsheets = await existingResponse.json();

      const assignedRiders = new Set(existingRunsheets?.map(r => r.rider_id) || []);

      // Filter available riders
      const availableRiders = riders?.filter(r => !assignedRiders.has(r.rider_id)) || [];

      // Get route optimization data
      const routeData = await optimizeRoute(deliveryOrders, pickupOrders);

      const totalCod = deliveryOrders?.reduce((sum, o) => sum + (o.final_amount || 0), 0) || 0;

      return new Response(JSON.stringify({
        success: true,
        hub: {
          hub_id: hub_id,
          name: hub.name,
          assigned_pincodes: hub.assigned_pincodes
        },
        riders: availableRiders.map(r => ({
          rider_id: r.rider_id,
          name: r.name,
          mobile: r.mobile,
          rating: r.rating,
          is_online: r.is_online
        })),
        pending_pickups: pickupOrders?.map(order => ({
          book_id: order.book_id,
          tracking_id: order.tracking_id,
          amount: order.final_amount,
          customer_name: order.customers?.name,
          customer_mobile: order.customers?.mobile,
          address: order.address,
          items_count: order.order_items?.reduce((sum, i) => sum + i.quantity, 0) || 0,
          product_name: order.order_items?.[0]?.products?.name
        })) || [],
        pending_deliveries: deliveryOrders?.map(order => ({
          book_id: order.book_id,
          tracking_id: order.tracking_id,
          amount: order.final_amount,
          customer_name: order.customers?.name,
          customer_mobile: order.customers?.mobile,
          address: order.address,
          items_count: order.order_items?.reduce((sum, i) => sum + i.quantity, 0) || 0,
          product_name: order.order_items?.[0]?.products?.name
        })) || [],
        suggested_route: routeData,
        shifts: [
          { value: 'MORNING', label: 'Morning (9:00 AM - 2:00 PM)', time: '09:00' },
          { value: 'EVENING', label: 'Evening (3:00 PM - 8:00 PM)', time: '15:00' },
          { value: 'NIGHT', label: 'Night (6:00 PM - 10:00 PM)', time: '18:00' }
        ],
        date: targetDate,
        stats: {
          total_pickups: pickupOrders?.length || 0,
          total_deliveries: deliveryOrders?.length || 0,
          total_cod: totalCod,
          available_riders: availableRiders.length
        }
      }), {
        status: 200,
        headers: { 'Content-Type': 'application/json', ...corsHeaders }
      });

    } catch (error) {
      console.error('Get create runsheet data error:', error);
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
        route_data,
        total_pickups,
        total_deliveries,
        total_cod
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
      const riderUrl = `${supabaseUrl}/rest/v1/riders?rider_id=eq.${rider_id}&select=rider_id,name,is_active,email,mobile`;
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
      const existingUrl = `${supabaseUrl}/rest/v1/runsheets?rider_id=eq.${rider_id}&date=eq.${targetDate}&shift=eq.${shift}&status=neq.CANCELLED&select=run_id`;
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

      // Validate orders - check if already assigned
      const pickupList = pickup_orders || [];
      const deliveryList = delivery_orders || [];

      let duplicatePickups = [];
      if (pickupList.length > 0) {
        const pickupIdsList = pickupList.map(id => `'${id}'`).join(',');
        const assignedUrl = `${supabaseUrl}/rest/v1/runsheets?select=pickup_orders&hub_id=eq.${hub_id}&status=neq.CANCELLED`;
        const assignedResponse = await fetch(assignedUrl, {
          headers: {
            'apikey': supabaseKey,
            'Authorization': `Bearer ${supabaseKey}`,
          },
        });
        const assignedPickups = await assignedResponse.json();
        const assignedPickupIds = assignedPickups?.flatMap(r => r.pickup_orders || []) || [];
        duplicatePickups = pickupList.filter(id => assignedPickupIds.includes(id));
      }

      if (duplicatePickups.length > 0) {
        return new Response(JSON.stringify({
          success: false,
          error: `Orders already assigned to another runsheet: ${duplicatePickups.join(', ')}`
        }), {
          status: 400,
          headers: { 'Content-Type': 'application/json', ...corsHeaders }
        });
      }

      // Create runsheet
      const runsheetInsert = await supabase
        .from('runsheets')
        .insert({
          hub_id,
          rider_id,
          shift,
          date: targetDate,
          pickup_orders: pickupList,
          delivery_orders: deliveryList,
          route_data: route_data || null,
          total_pickups: total_pickups || pickupList.length,
          total_deliveries: total_deliveries || deliveryList.length,
          total_cod: total_cod || 0,
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

      // Update order statuses for pickup orders
      if (pickupList.length > 0) {
        const pickupIdsList = pickupList.map(id => `'${id}'`).join(',');
        await fetch(`${supabaseUrl}/rest/v1/orders?book_id=in.(${pickupIdsList})`, {
          method: 'PATCH',
          headers: {
            'apikey': supabaseKey,
            'Authorization': `Bearer ${supabaseKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ status: 'READY_FOR_PICKUP', updated_at: new Date().toISOString() })
        });
      }

      // Update order statuses for delivery orders
      if (deliveryList.length > 0) {
        const deliveryIdsList = deliveryList.map(id => `'${id}'`).join(',');
        await fetch(`${supabaseUrl}/rest/v1/orders?book_id=in.(${deliveryIdsList})`, {
          method: 'PATCH',
          headers: {
            'apikey': supabaseKey,
            'Authorization': `Bearer ${supabaseKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            rider_id: rider_id,
            status: 'ASSIGNED_TO_RIDER',
            updated_at: new Date().toISOString()
          })
        });
      }

      // Add shipment tracking entries for delivery orders
      for (const orderId of deliveryList) {
        await fetch(`${supabaseUrl}/rest/v1/shipment_tracking`, {
          method: 'POST',
          headers: {
            'apikey': supabaseKey,
            'Authorization': `Bearer ${supabaseKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            book_id: orderId,
            status: 'ASSIGNED_TO_RIDER',
            rider_id: rider_id,
            notes: `Assigned to rider: ${rider.name}`,
            created_at: new Date().toISOString()
          })
        });
      }

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
          title: '📋 New Runsheet Assigned',
          message: `You have been assigned a new runsheet for ${shift} shift on ${targetDate}. ${deliveryList.length} deliveries, ${pickupList.length} pickups.`,
          type: 'logistics',
          data: {
            run_id: runsheet.run_id,
            shift: shift,
            deliveries: deliveryList.length,
            pickups: pickupList.length
          },
          created_at: new Date().toISOString()
        })
      });

      return new Response(JSON.stringify({
        success: true,
        message: 'Runsheet created successfully',
        runsheet: {
          run_id: runsheet.run_id,
          rider_id: runsheet.rider_id,
          rider_name: rider.name,
          shift: runsheet.shift,
          date: runsheet.date,
          total_pickups: runsheet.total_pickups,
          total_deliveries: runsheet.total_deliveries,
          total_cod: runsheet.total_cod,
          status: runsheet.status,
          created_at: runsheet.created_at
        },
        next_steps: [
          'Rider has been notified',
          'Rider needs to accept the runsheet',
          'Print manifest for rider',
          'Handover cash advance if needed'
        ]
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

  return new Response(JSON.stringify({ success: false, error: 'Method not allowed' }), {
    status: 405,
    headers: { 'Content-Type': 'application/json', ...corsHeaders }
  });
}