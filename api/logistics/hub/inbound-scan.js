// api/logistics/hub/inbound-scan.js
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
          in: (field, values) => ({
            select: async (columns) => {
              const finalUrl = `${supabaseUrl}/rest/v1/${table}?select=${columns || '*'}&${field}=in.(${values.join(',')})`;
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
  // GET INBOUND SCAN DATA
  // =====================================================
  if (request.method === 'GET') {
    try {
      const hub_id = url.searchParams.get('hub_id');
      const status = url.searchParams.get('status');
      const date = url.searchParams.get('date');
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

      // Get today's expected inbound shipments
      const today = new Date().toISOString().split('T')[0];
      const targetDate = date || today;

      let shipmentsUrl = `${supabaseUrl}/rest/v1/shipment_tracking?select=track_id,book_id,status,location,created_at,orders!inner(book_id,tracking_id,seller_id,final_amount,address,sellers!inner(shop_name,mobile))&status=eq.SHIPPED&created_at=gte.${targetDate}T00:00:00&created_at=lte.${targetDate}T23:59:59&order=created_at.desc`;

      const from = (page - 1) * limit;
      const to = from + limit - 1;
      shipmentsUrl += `&offset=${from}&limit=${limit}`;

      const shipmentsResponse = await fetch(shipmentsUrl, {
        headers: {
          'apikey': supabaseKey,
          'Authorization': `Bearer ${supabaseKey}`,
        },
      });
      const inboundShipments = await shipmentsResponse.json();
      const count = parseInt(shipmentsResponse.headers.get('content-range')?.split('/')[1] || '0');

      // Get bags received today
      const bagsUrl = `${supabaseUrl}/rest/v1/bags?select=*&to_hub=eq.${hub_id}&received_at=gte.${targetDate}T00:00:00&order=received_at.desc`;
      const bagsResponse = await fetch(bagsUrl, {
        headers: {
          'apikey': supabaseKey,
          'Authorization': `Bearer ${supabaseKey}`,
        },
      });
      const bagsReceived = await bagsResponse.json();

      // Get scan statistics
      const scansUrl = `${supabaseUrl}/rest/v1/barcode_scans?select=*&scanned_by=eq.${hub_id}&scanned_by_type=eq.hub&created_at=gte.${targetDate}T00:00:00&created_at=lte.${targetDate}T23:59:59`;
      const scansResponse = await fetch(scansUrl, {
        headers: {
          'apikey': supabaseKey,
          'Authorization': `Bearer ${supabaseKey}`,
        },
      });
      const todayScans = await scansResponse.json();

      const stats = {
        total_expected: inboundShipments?.length || 0,
        scanned_today: todayScans?.length || 0,
        bags_received: bagsReceived?.length || 0,
        pending_scan: (inboundShipments?.length || 0) - (todayScans?.length || 0)
      };

      return new Response(JSON.stringify({
        success: true,
        inbound_shipments: inboundShipments?.map(s => ({
          book_id: s.orders.book_id,
          tracking_id: s.orders.tracking_id,
          seller_name: s.orders.sellers?.shop_name,
          seller_mobile: s.orders.sellers?.mobile,
          amount: s.orders.final_amount,
          address: s.orders.address,
          status: s.status,
          created_at: s.created_at
        })) || [],
        bags_received: bagsReceived || [],
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
      console.error('Get inbound scan error:', error);
      return new Response(JSON.stringify({ success: false, error: error.message }), {
        status: 500,
        headers: { 'Content-Type': 'application/json', ...corsHeaders }
      });
    }
  }

  // =====================================================
  // PROCESS INBOUND SCAN (POST)
  // =====================================================
  if (request.method === 'POST') {
    try {
      const body = await request.json();
      const {
        hub_id,
        barcode,
        scan_type,
        location,
        weight,
        dimensions,
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
      let bagId = null;
      let awbNumber = null;
      let result = null;

      // Determine barcode type and find the order/bag

      // Check if it's a BOOK ID
      if (barcode.startsWith('BOOK')) {
        const orderUrl = `${supabaseUrl}/rest/v1/orders?book_id=eq.${barcode}&select=book_id,tracking_id,status,seller_id,final_amount`;
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

        // Check if already scanned
        const existingUrl = `${supabaseUrl}/rest/v1/shipment_tracking?book_id=eq.${bookId}&status=eq.INBOUND_SCAN&select=track_id`;
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
            error: 'Order already scanned inbound',
            already_scanned: true
          }), {
            status: 400,
            headers: { 'Content-Type': 'application/json', ...corsHeaders }
          });
        }

        // Update order status
        await fetch(`${supabaseUrl}/rest/v1/orders?book_id=eq.${bookId}`, {
          method: 'PATCH',
          headers: {
            'apikey': supabaseKey,
            'Authorization': `Bearer ${supabaseKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            status: 'INBOUND_SCAN',
            updated_at: new Date().toISOString()
          })
        });

        // Add tracking entry
        const trackingInsert = await supabase
          .from('shipment_tracking')
          .insert({
            book_id: bookId,
            status: 'INBOUND_SCAN',
            location: location || 'Hub',
            hub_id: hub_id,
            notes: notes || `Inbound scan at hub. Weight: ${weight || 'N/A'}kg`,
            created_at: new Date().toISOString()
          })
          .select();

        result = {
          type: 'order',
          book_id: bookId,
          tracking_id: awbNumber,
          status: 'INBOUND_SCAN'
        };

      }
      // Check if it's a BAG ID
      else if (barcode.startsWith('BAG')) {
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

        bagId = bag.bag_id;

        // Update bag status
        await fetch(`${supabaseUrl}/rest/v1/bags?bag_id=eq.${bagId}`, {
          method: 'PATCH',
          headers: {
            'apikey': supabaseKey,
            'Authorization': `Bearer ${supabaseKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            status: 'RECEIVED',
            received_at: new Date().toISOString(),
            received_by: hub_id
          })
        });

        // Process all orders in the bag
        for (const orderId of bag.order_ids || []) {
          await fetch(`${supabaseUrl}/rest/v1/orders?book_id=eq.${orderId}`, {
            method: 'PATCH',
            headers: {
              'apikey': supabaseKey,
              'Authorization': `Bearer ${supabaseKey}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({ status: 'INBOUND_SCAN' })
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
              status: 'INBOUND_SCAN',
              location: location || 'Hub',
              hub_id: hub_id,
              notes: `Received in bag ${bagId}`,
              created_at: new Date().toISOString()
            })
          });
        }

        result = {
          type: 'bag',
          bag_id: bagId,
          order_count: bag.order_ids?.length || 0,
          status: 'RECEIVED'
        };

      }
      // Check if it's an AWB number (starts with SS)
      else if (barcode.startsWith('SS')) {
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

        // Check if already scanned
        const existingUrl = `${supabaseUrl}/rest/v1/shipment_tracking?book_id=eq.${bookId}&status=eq.INBOUND_SCAN&select=track_id`;
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
            error: 'Order already scanned inbound'
          }), {
            status: 400,
            headers: { 'Content-Type': 'application/json', ...corsHeaders }
          });
        }

        // Update order status
        await fetch(`${supabaseUrl}/rest/v1/orders?book_id=eq.${bookId}`, {
          method: 'PATCH',
          headers: {
            'apikey': supabaseKey,
            'Authorization': `Bearer ${supabaseKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ status: 'INBOUND_SCAN' })
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
            status: 'INBOUND_SCAN',
            location: location || 'Hub',
            hub_id: hub_id,
            notes: notes || 'Inbound scan',
            created_at: new Date().toISOString()
          })
        });

        result = {
          type: 'order',
          book_id: bookId,
          tracking_id: awbNumber,
          status: 'INBOUND_SCAN'
        };
      }
      else {
        return new Response(JSON.stringify({
          success: false,
          error: 'Invalid barcode format'
        }), {
          status: 400,
          headers: { 'Content-Type': 'application/json', ...corsHeaders }
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
          location: location,
          notes: notes,
          created_at: new Date().toISOString()
        })
      });

      // Send notification to seller (if order)
      if (bookId) {
        const orderSellerUrl = `${supabaseUrl}/rest/v1/orders?book_id=eq.${bookId}&select=seller_id`;
        const orderSellerResponse = await fetch(orderSellerUrl, {
          headers: {
            'apikey': supabaseKey,
            'Authorization': `Bearer ${supabaseKey}`,
          },
        });
        const orderSellerData = await orderSellerResponse.json();
        const orderSeller = orderSellerData[0];

        if (orderSeller && orderSeller.seller_id) {
          await fetch(`${supabaseUrl}/rest/v1/notifications`, {
            method: 'POST',
            headers: {
              'apikey': supabaseKey,
              'Authorization': `Bearer ${supabaseKey}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              user_id: orderSeller.seller_id,
              user_type: 'seller',
              title: 'Order Received at Hub',
              message: `Order ${bookId} has been received at the logistics hub.`,
              type: 'logistics',
              data: { book_id: bookId },
              created_at: new Date().toISOString()
            })
          });
        }
      }

      return new Response(JSON.stringify({
        success: true,
        message: 'Inbound scan successful',
        scan_result: result,
        next_step: result.type === 'bag' ? 'Open bag and sort items' : 'Move to sorting area'
      }), {
        status: 200,
        headers: { 'Content-Type': 'application/json', ...corsHeaders }
      });

    } catch (error) {
      console.error('Inbound scan error:', error);
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