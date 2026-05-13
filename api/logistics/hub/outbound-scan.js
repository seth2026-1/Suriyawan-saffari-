// api/logistics/hub/outbound-scan.js
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
            gte: (gteField, gteValue) => ({
              lte: (lteField, lteValue) => ({
                range: async (from, to) => {
                  const finalUrl = `${url}&${field}=eq.${value}&${gteField}=gte.${gteValue}&${lteField}=lte.${lteValue}&offset=${from}&limit=${to - from + 1}`;
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
            gte: (gteField, gteValue) => ({
              lte: (lteField, lteValue) => ({
                range: async (from, to) => {
                  const finalUrl = `${url}&${field}=eq.${value}&${gteField}=gte.${gteValue}&${lteField}=lte.${lteValue}&offset=${from}&limit=${to - from + 1}`;
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
            in: (field2, values) => ({
              select: async (columns2) => {
                const finalUrl = `${supabaseUrl}/rest/v1/${table}?select=${columns2 || '*'}&${field}=eq.${value}&${field2}=in.(${values.join(',')})`;
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
  // GET OUTBOUND SCAN DATA
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

      const today = new Date().toISOString().split('T')[0];
      const targetDate = date || today;

      // Get orders ready for outbound (INBOUND_SCAN status)
      let ordersUrl = `${supabaseUrl}/rest/v1/orders?select=book_id,tracking_id,final_amount,address,status,rider_id,customers!inner(name,mobile),sellers!inner(shop_name)&status=eq.INBOUND_SCAN&order=placed_at.asc`;

      const from = (page - 1) * limit;
      const to = from + limit - 1;
      ordersUrl += `&offset=${from}&limit=${limit}`;

      const ordersResponse = await fetch(ordersUrl, {
        headers: {
          'apikey': supabaseKey,
          'Authorization': `Bearer ${supabaseKey}`,
        },
      });
      const readyOrders = await ordersResponse.json();
      const count = parseInt(ordersResponse.headers.get('content-range')?.split('/')[1] || '0');

      // Get today's runsheets for outbound
      const runsheetsUrl = `${supabaseUrl}/rest/v1/runsheets?select=run_id,rider_id,shift,total_deliveries,total_pickups,status,riders!left(name,mobile,is_online)&hub_id=eq.${hub_id}&date=eq.${targetDate}&status=in.(ASSIGNED,ACCEPTED,STARTED)&order=created_at.asc`;
      const runsheetsResponse = await fetch(runsheetsUrl, {
        headers: {
          'apikey': supabaseKey,
          'Authorization': `Bearer ${supabaseKey}`,
        },
      });
      const runsheets = await runsheetsResponse.json();

      // Get outbound statistics
      const outboundUrl = `${supabaseUrl}/rest/v1/shipment_tracking?select=*&status=eq.OUTBOUND_SCAN&created_at=gte.${today}T00:00:00&created_at=lte.${today}T23:59:59`;
      const outboundResponse = await fetch(outboundUrl, {
        headers: {
          'apikey': supabaseKey,
          'Authorization': `Bearer ${supabaseKey}`,
        },
      });
      const todayOutbound = await outboundResponse.json();

      const stats = {
        ready_for_outbound: readyOrders?.length || 0,
        outbound_today: todayOutbound?.length || 0,
        active_runsheets: runsheets?.length || 0,
        riders_on_duty: runsheets?.filter(r => r.riders?.is_online).length || 0
      };

      return new Response(JSON.stringify({
        success: true,
        ready_orders: readyOrders?.map(order => ({
          book_id: order.book_id,
          tracking_id: order.tracking_id,
          customer_name: order.customers?.name,
          customer_mobile: order.customers?.mobile,
          seller_name: order.sellers?.shop_name,
          amount: order.final_amount,
          address: order.address
        })) || [],
        runsheets: runsheets || [],
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
      console.error('Get outbound scan error:', error);
      return new Response(JSON.stringify({ success: false, error: error.message }), {
        status: 500,
        headers: { 'Content-Type': 'application/json', ...corsHeaders }
      });
    }
  }

  // =====================================================
  // PROCESS OUTBOUND SCAN (POST)
  // =====================================================
  if (request.method === 'POST') {
    try {
      const body = await request.json();
      const {
        hub_id,
        barcode,
        rider_id,
        run_id,
        bag_id,
        weight,
        notes
      } = body;

      if (!hub_id || !barcode) {
        return new Response(JSON.stringify({
          success: false,
          error: 'Hub ID and barcode are required'
        }), {
          status: 400,
          headers: { 'Content-Type': 'application/json', ...corsHeaders }
        });
      }

      const supabase = createSupabaseClient();
      const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
      const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

      let bookId = null;
      let awbNumber = null;
      let result = null;

      // Determine barcode type
      if (barcode.startsWith('BOOK')) {
        const orderUrl = `${supabaseUrl}/rest/v1/orders?book_id=eq.${barcode}&select=book_id,tracking_id,status,rider_id`;
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

        bookId = order.book_id;
        awbNumber = order.tracking_id;

        // Check if already outbound scanned
        const existingUrl = `${supabaseUrl}/rest/v1/shipment_tracking?book_id=eq.${bookId}&status=eq.OUTBOUND_SCAN&select=track_id`;
        const existingResponse = await fetch(existingUrl, {
          headers: {
            'apikey': supabaseKey,
            'Authorization': `Bearer ${supabaseKey}`,
          },
        });
        const existingData = await existingResponse.json();
        const existingScan = existingData[0];

        if (existingScan) {
          return new Response(JSON.stringify({
            success: false,
            error: 'Order already scanned outbound',
            already_scanned: true
          }), {
            status: 400,
            headers: { 'Content-Type': 'application/json', ...corsHeaders }
          });
        }

        // Check if order is ready for outbound
        if (order.status !== 'INBOUND_SCAN') {
          return new Response(JSON.stringify({
            success: false,
            error: `Order is not ready for outbound. Current status: ${order.status}`
          }), {
            status: 400,
            headers: { 'Content-Type': 'application/json', ...corsHeaders }
          });
        }

        // Update order status
        const finalRiderId = rider_id || order.rider_id;
        await fetch(`${supabaseUrl}/rest/v1/orders?book_id=eq.${bookId}`, {
          method: 'PATCH',
          headers: {
            'apikey': supabaseKey,
            'Authorization': `Bearer ${supabaseKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            status: 'OUT_FOR_DELIVERY',
            rider_id: finalRiderId,
            out_for_delivery_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
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
            book_id: bookId,
            status: 'OUTBOUND_SCAN',
            location: 'Hub',
            hub_id: hub_id,
            rider_id: finalRiderId,
            notes: notes || `Outbound scan. Assigned to rider: ${finalRiderId}`,
            created_at: new Date().toISOString()
          })
        });

        result = {
          type: 'order',
          book_id: bookId,
          tracking_id: awbNumber,
          status: 'OUT_FOR_DELIVERY',
          rider_id: finalRiderId
        };

      } else if (barcode.startsWith('BAG')) {
        const bagUrl = `${supabaseUrl}/rest/v1/bags?bag_id=eq.${barcode}&select=*`;
        const bagResponse = await fetch(bagUrl, {
          headers: {
            'apikey': supabaseKey,
            'Authorization': `Bearer ${supabaseKey}`,
          },
        });
        const bagData = await bagResponse.json();
        const bag = bagData[0];

        if (!bag) {
          return new Response(JSON.stringify({ success: false, error: 'Bag not found' }), {
            status: 404,
            headers: { 'Content-Type': 'application/json', ...corsHeaders }
          });
        }

        const finalRiderId = rider_id;
        const bagIdValue = bag.bag_id;

        // Update bag status
        await fetch(`${supabaseUrl}/rest/v1/bags?bag_id=eq.${bagIdValue}`, {
          method: 'PATCH',
          headers: {
            'apikey': supabaseKey,
            'Authorization': `Bearer ${supabaseKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            status: 'OUT_FOR_DELIVERY',
            outbound_at: new Date().toISOString(),
            outbound_by: hub_id,
            rider_id: finalRiderId
          })
        });

        // Update all orders in bag
        for (const orderId of bag.order_ids || []) {
          await fetch(`${supabaseUrl}/rest/v1/orders?book_id=eq.${orderId}`, {
            method: 'PATCH',
            headers: {
              'apikey': supabaseKey,
              'Authorization': `Bearer ${supabaseKey}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              status: 'OUT_FOR_DELIVERY',
              rider_id: finalRiderId,
              out_for_delivery_at: new Date().toISOString()
            })
          });

          await fetch(`${supabaseUrl}/rest/v1/shipment_tracking`, {
            method: 'POST',
            headers: {
              'apikey': supabaseKey,
              'Authorization': `Bearer ${supabaseKey}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              book_id: orderId,
              status: 'OUTBOUND_SCAN',
              location: 'Hub',
              hub_id: hub_id,
              rider_id: finalRiderId,
              notes: `Outbound in bag ${bagIdValue}`,
              created_at: new Date().toISOString()
            })
          });
        }

        result = {
          type: 'bag',
          bag_id: bagIdValue,
          order_count: bag.order_ids?.length || 0,
          status: 'OUT_FOR_DELIVERY',
          rider_id: finalRiderId
        };

      } else if (barcode.startsWith('SS')) {
        const orderUrl = `${supabaseUrl}/rest/v1/orders?tracking_id=eq.${barcode}&select=book_id,tracking_id,status`;
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

        bookId = order.book_id;
        awbNumber = barcode;

        const finalRiderId = rider_id;

        // Update order status
        await fetch(`${supabaseUrl}/rest/v1/orders?book_id=eq.${bookId}`, {
          method: 'PATCH',
          headers: {
            'apikey': supabaseKey,
            'Authorization': `Bearer ${supabaseKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            status: 'OUT_FOR_DELIVERY',
            rider_id: finalRiderId,
            out_for_delivery_at: new Date().toISOString()
          })
        });

        await fetch(`${supabaseUrl}/rest/v1/shipment_tracking`, {
          method: 'POST',
          headers: {
            'apikey': supabaseKey,
            'Authorization': `Bearer ${supabaseKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            book_id: bookId,
            status: 'OUTBOUND_SCAN',
            location: 'Hub',
            hub_id: hub_id,
            rider_id: finalRiderId,
            notes: notes || 'Outbound scan',
            created_at: new Date().toISOString()
          })
        });

        result = {
          type: 'order',
          book_id: bookId,
          tracking_id: awbNumber,
          status: 'OUT_FOR_DELIVERY',
          rider_id: finalRiderId
        };
      } else {
        return new Response(JSON.stringify({
          success: false,
          error: 'Invalid barcode format'
        }), {
          status: 400,
          headers: { 'Content-Type': 'application/json', ...corsHeaders }
        });
      }

      // If run_id provided, update runsheet
      if (run_id) {
        await fetch(`${supabaseUrl}/rest/v1/runsheets?run_id=eq.${run_id}`, {
          method: 'PATCH',
          headers: {
            'apikey': supabaseKey,
            'Authorization': `Bearer ${supabaseKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            status: 'STARTED',
            started_at: new Date().toISOString()
          })
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
          barcode: barcode,
          barcode_type: result.type === 'bag' ? 'BAG' : 'BOOK',
          scanned_by: hub_id,
          scanned_by_type: 'hub',
          location: 'Outbound Gate',
          notes: notes,
          created_at: new Date().toISOString()
        })
      });

      // Send notification to customer
      if (bookId) {
        const orderCustUrl = `${supabaseUrl}/rest/v1/orders?book_id=eq.${bookId}&select=cust_id`;
        const orderCustResponse = await fetch(orderCustUrl, {
          headers: {
            'apikey': supabaseKey,
            'Authorization': `Bearer ${supabaseKey}`,
          },
        });
        const orderCustData = await orderCustResponse.json();
        const orderCust = orderCustData[0];

        if (orderCust && orderCust.cust_id) {
          await fetch(`${supabaseUrl}/rest/v1/notifications`, {
            method: 'POST',
            headers: {
              'apikey': supabaseKey,
              'Authorization': `Bearer ${supabaseKey}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              user_id: orderCust.cust_id,
              user_type: 'customer',
              title: 'Order Out for Delivery',
              message: `Your order ${bookId} is out for delivery. Track your order in real-time.`,
              type: 'delivery',
              data: { book_id: bookId, tracking_id: awbNumber },
              created_at: new Date().toISOString()
            })
          });
        }
      }

      return new Response(JSON.stringify({
        success: true,
        message: 'Outbound scan successful',
        scan_result: result,
        next_step: result.type === 'bag' ? 'Bag handed over to rider' : 'Order ready for delivery'
      }), {
        status: 200,
        headers: { 'Content-Type': 'application/json', ...corsHeaders }
      });

    } catch (error) {
      console.error('Outbound scan error:', error);
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