// api/logistics/hub/bagging.js
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
          in: (field, values) => ({
            select: async (columns) => {
              const finalUrl = `${url}?${field}=in.(${values.join(',')})&select=${columns || '*'}`;
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
    'Access-Control-Allow-Methods': 'GET, POST, PUT, OPTIONS',
    'Access-Control-Allow-Headers': 'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version, Authorization',
  };

  // Handle OPTIONS preflight
  if (request.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: corsHeaders });
  }

  const url = new URL(request.url);

  // =====================================================
  // GET BAGGING DATA
  // =====================================================
  if (request.method === 'GET') {
    try {
      const hub_id = url.searchParams.get('hub_id');
      const status = url.searchParams.get('status');
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

      // Get orders ready for bagging (INBOUND_SCAN status)
      const readyOrdersUrl = `${supabaseUrl}/rest/v1/orders?select=book_id,tracking_id,final_amount,address->>pincode,customers!inner(name,mobile)&status=eq.INBOUND_SCAN&order=placed_at.asc`;
      const readyOrdersResponse = await fetch(readyOrdersUrl, {
        headers: {
          'apikey': supabaseKey,
          'Authorization': `Bearer ${supabaseKey}`,
        },
      });
      const readyOrders = await readyOrdersResponse.json();

      // Get existing bags
      let bagsUrl = `${supabaseUrl}/rest/v1/bags?select=*&from_hub=eq.${hub_id}&order=created_at.desc`;

      if (status === 'active') {
        bagsUrl += `&status=in.(CREATED,IN_TRANSIT)`;
      } else if (status === 'received') {
        bagsUrl += `&status=eq.RECEIVED`;
      }

      const from = (page - 1) * limit;
      const to = from + limit - 1;
      bagsUrl += `&offset=${from}&limit=${limit}`;

      const bagsResponse = await fetch(bagsUrl, {
        headers: {
          'apikey': supabaseKey,
          'Authorization': `Bearer ${supabaseKey}`,
        },
      });
      const bags = await bagsResponse.json();
      const count = parseInt(bagsResponse.headers.get('content-range')?.split('/')[1] || '0');

      // Get bagging statistics
      const allBagsUrl = `${supabaseUrl}/rest/v1/bags?select=status,packet_count&from_hub=eq.${hub_id}`;
      const allBagsResponse = await fetch(allBagsUrl, {
        headers: {
          'apikey': supabaseKey,
          'Authorization': `Bearer ${supabaseKey}`,
        },
      });
      const allBags = await allBagsResponse.json();

      const stats = {
        total_bags: allBags?.length || 0,
        created: allBags?.filter(b => b.status === 'CREATED').length || 0,
        in_transit: allBags?.filter(b => b.status === 'IN_TRANSIT').length || 0,
        received: allBags?.filter(b => b.status === 'RECEIVED').length || 0,
        total_packets: allBags?.reduce((sum, b) => sum + (b.packet_count || 0), 0) || 0,
        pending_orders: readyOrders?.length || 0
      };

      return new Response(JSON.stringify({
        success: true,
        ready_orders: readyOrders?.map(order => ({
          book_id: order.book_id,
          tracking_id: order.tracking_id,
          customer_name: order.customers?.name,
          customer_mobile: order.customers?.mobile,
          amount: order.final_amount,
          pincode: order.pincode
        })) || [],
        bags: bags || [],
        stats: stats,
        pagination: {
          current_page: page,
          total_pages: Math.ceil(count / limit),
          total_items: count,
          items_per_page: limit
        },
        bagging_settings: {
          max_packets_per_bag: 50,
          max_weight_per_bag: 30
        }
      }), {
        status: 200,
        headers: { 'Content-Type': 'application/json', ...corsHeaders }
      });

    } catch (error) {
      console.error('Get bagging data error:', error);
      return new Response(JSON.stringify({ success: false, error: error.message }), {
        status: 500,
        headers: { 'Content-Type': 'application/json', ...corsHeaders }
      });
    }
  }

  // =====================================================
  // CREATE BAG (POST)
  // =====================================================
  if (request.method === 'POST') {
    try {
      const body = await request.json();
      const {
        hub_id,
        order_ids,
        to_hub,
        seal_number,
        total_weight,
        notes
      } = body;

      if (!hub_id || !order_ids || !order_ids.length) {
        return new Response(JSON.stringify({
          success: false,
          error: 'Hub ID and order IDs are required'
        }), {
          status: 400,
          headers: { 'Content-Type': 'application/json', ...corsHeaders }
        });
      }

      if (order_ids.length > 50) {
        return new Response(JSON.stringify({
          success: false,
          error: 'Maximum 50 packets per bag'
        }), {
          status: 400,
          headers: { 'Content-Type': 'application/json', ...corsHeaders }
        });
      }

      const supabase = createSupabaseClient();
      const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
      const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

      // Verify all orders exist and are in correct status
      const orderIdsList = order_ids.map(id => `'${id}'`).join(',');
      const ordersUrl = `${supabaseUrl}/rest/v1/orders?select=book_id,status,tracking_id&book_id=in.(${orderIdsList})`;
      const ordersResponse = await fetch(ordersUrl, {
        headers: {
          'apikey': supabaseKey,
          'Authorization': `Bearer ${supabaseKey}`,
        },
      });
      const orders = await ordersResponse.json();

      const invalidOrders = orders.filter(o => o.status !== 'INBOUND_SCAN');
      if (invalidOrders.length > 0) {
        return new Response(JSON.stringify({
          success: false,
          error: `Orders not ready for bagging: ${invalidOrders.map(o => o.book_id).join(', ')}`
        }), {
          status: 400,
          headers: { 'Content-Type': 'application/json', ...corsHeaders }
        });
      }

      // Generate bag ID
      const date = new Date();
      const dateStr = date.toISOString().slice(0, 10).replace(/-/g, '');
      
      // Get last bag for serial
      const lastBagUrl = `${supabaseUrl}/rest/v1/bags?select=bag_id&order=created_at.desc&limit=1`;
      const lastBagResponse = await fetch(lastBagUrl, {
        headers: {
          'apikey': supabaseKey,
          'Authorization': `Bearer ${supabaseKey}`,
        },
      });
      const lastBagData = await lastBagResponse.json();
      const lastBag = lastBagData[0];

      let serial = '000001';
      if (lastBag && lastBag.bag_id) {
        const lastSerial = parseInt(lastBag.bag_id.slice(-6));
        serial = String(lastSerial + 1).padStart(6, '0');
      }
      const bagId = `BAG${dateStr}${serial}`;

      // Create bag
      const bagInsert = await supabase
        .from('bags')
        .insert({
          bag_id: bagId,
          from_hub: hub_id,
          to_hub: to_hub || null,
          order_ids: order_ids,
          awb_numbers: orders.map(o => o.tracking_id),
          packet_count: order_ids.length,
          total_weight: total_weight || null,
          seal_number: seal_number || null,
          status: 'CREATED',
          notes: notes || null,
          created_at: new Date().toISOString(),
          created_by: hub_id
        })
        .select();

      if (bagInsert.error) {
        console.error('Bag creation error:', bagInsert.error);
        return new Response(JSON.stringify({ success: false, error: bagInsert.error.message }), {
          status: 500,
          headers: { 'Content-Type': 'application/json', ...corsHeaders }
        });
      }

      const bag = bagInsert.data;

      // Update order statuses
      await fetch(`${supabaseUrl}/rest/v1/orders?book_id=in.(${orderIdsList})`, {
        method: 'PATCH',
        headers: {
          'apikey': supabaseKey,
          'Authorization': `Bearer ${supabaseKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          status: 'BAGGED',
          bag_id: bagId,
          updated_at: new Date().toISOString()
        })
      });

      // Add tracking entries
      for (const orderId of order_ids) {
        await fetch(`${supabaseUrl}/rest/v1/shipment_tracking`, {
          method: 'POST',
          headers: {
            'apikey': supabaseKey,
            'Authorization': `Bearer ${supabaseKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            book_id: orderId,
            status: 'BAGGED',
            location: hub_id,
            notes: `Bagged in ${bagId}`,
            created_at: new Date().toISOString()
          })
        });
      }

      // Log barcode for bag
      await fetch(`${supabaseUrl}/rest/v1/barcode_scans`, {
        method: 'POST',
        headers: {
          'apikey': supabaseKey,
          'Authorization': `Bearer ${supabaseKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          barcode: bagId,
          barcode_type: 'BAG',
          scanned_by: hub_id,
          scanned_by_type: 'hub',
          notes: `Bag created with ${order_ids.length} packets`,
          created_at: new Date().toISOString()
        })
      });

      return new Response(JSON.stringify({
        success: true,
        message: `Bag ${bagId} created successfully with ${order_ids.length} packets`,
        bag: {
          bag_id: bag.bag_id,
          packet_count: bag.packet_count,
          total_weight: bag.total_weight,
          seal_number: bag.seal_number,
          status: bag.status,
          created_at: bag.created_at
        },
        barcode: `/api/barcode/generate?text=${bagId}`,
        qr_code: `/api/barcode/generate-qr?text=${bagId}`,
        next_steps: [
          'Seal the bag',
          'Attach barcode label',
          'Handover to line haul',
          'Update seal number in system'
        ]
      }), {
        status: 200,
        headers: { 'Content-Type': 'application/json', ...corsHeaders }
      });

    } catch (error) {
      console.error('Create bag error:', error);
      return new Response(JSON.stringify({ success: false, error: error.message }), {
        status: 500,
        headers: { 'Content-Type': 'application/json', ...corsHeaders }
      });
    }
  }

  // =====================================================
  // UPDATE BAG STATUS (PUT)
  // =====================================================
  if (request.method === 'PUT') {
    try {
      const body = await request.json();
      const { bag_id, hub_id, action, seal_number, notes } = body;

      if (!bag_id || !hub_id || !action) {
        return new Response(JSON.stringify({
          success: false,
          error: 'Bag ID, Hub ID and action are required'
        }), {
          status: 400,
          headers: { 'Content-Type': 'application/json', ...corsHeaders }
        });
      }

      const supabase = createSupabaseClient();
      const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
      const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

      // Verify bag exists
      const bagUrl = `${supabaseUrl}/rest/v1/bags?bag_id=eq.${bag_id}&select=*`;
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

      let newStatus;
      let updateData = {};
      let message = '';

      switch (action) {
        case 'seal':
          if (bag.status !== 'CREATED') {
            return new Response(JSON.stringify({ success: false, error: 'Bag must be in CREATED status to seal' }), {
              status: 400,
              headers: { 'Content-Type': 'application/json', ...corsHeaders }
            });
          }
          newStatus = 'SEALED';
          updateData.seal_number = seal_number || bag.seal_number;
          updateData.sealed_at = new Date().toISOString();
          message = 'Bag sealed successfully';
          break;

        case 'dispatch':
          if (bag.status !== 'SEALED') {
            return new Response(JSON.stringify({ success: false, error: 'Bag must be sealed before dispatch' }), {
              status: 400,
              headers: { 'Content-Type': 'application/json', ...corsHeaders }
            });
          }
          newStatus = 'IN_TRANSIT';
          updateData.dispatched_at = new Date().toISOString();
          updateData.dispatched_by = hub_id;
          message = 'Bag dispatched successfully';
          break;

        case 'receive':
          if (bag.status !== 'IN_TRANSIT') {
            return new Response(JSON.stringify({ success: false, error: 'Bag must be in transit to receive' }), {
              status: 400,
              headers: { 'Content-Type': 'application/json', ...corsHeaders }
            });
          }
          newStatus = 'RECEIVED';
          updateData.received_at = new Date().toISOString();
          updateData.received_by = hub_id;
          message = 'Bag received successfully';

          // Update orders in bag to INBOUND_SCAN at receiving hub
          if (bag.order_ids && bag.order_ids.length > 0) {
            const orderIdsList = bag.order_ids.map(id => `'${id}'`).join(',');
            await fetch(`${supabaseUrl}/rest/v1/orders?book_id=in.(${orderIdsList})`, {
              method: 'PATCH',
              headers: {
                'apikey': supabaseKey,
                'Authorization': `Bearer ${supabaseKey}`,
                'Content-Type': 'application/json',
              },
              body: JSON.stringify({ status: 'INBOUND_SCAN' })
            });

            for (const orderId of bag.order_ids) {
              await fetch(`${supabaseUrl}/rest/v1/shipment_tracking`, {
                method: 'POST',
                headers: {
                  'apikey': supabaseKey,
                  'Authorization': `Bearer ${supabaseKey}`,
                  'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                  book_id: orderId,
                  status: 'BAG_RECEIVED',
                  location: hub_id,
                  notes: `Bag ${bag_id} received at hub`,
                  created_at: new Date().toISOString()
                })
              });
            }
          }
          break;

        case 'open':
          if (bag.status !== 'RECEIVED') {
            return new Response(JSON.stringify({ success: false, error: 'Bag must be received before opening' }), {
              status: 400,
              headers: { 'Content-Type': 'application/json', ...corsHeaders }
            });
          }
          newStatus = 'OPENED';
          updateData.opened_at = new Date().toISOString();
          updateData.opened_by = hub_id;
          message = 'Bag opened successfully';
          break;

        default:
          return new Response(JSON.stringify({ success: false, error: 'Invalid action' }), {
            status: 400,
            headers: { 'Content-Type': 'application/json', ...corsHeaders }
          });
      }

      updateData.status = newStatus;
      updateData.updated_at = new Date().toISOString();

      await fetch(`${supabaseUrl}/rest/v1/bags?bag_id=eq.${bag_id}`, {
        method: 'PATCH',
        headers: {
          'apikey': supabaseKey,
          'Authorization': `Bearer ${supabaseKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(updateData)
      });

      // Log bag scan
      await fetch(`${supabaseUrl}/rest/v1/barcode_scans`, {
        method: 'POST',
        headers: {
          'apikey': supabaseKey,
          'Authorization': `Bearer ${supabaseKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          barcode: bag_id,
          barcode_type: 'BAG',
          scanned_by: hub_id,
          scanned_by_type: 'hub',
          notes: `Bag ${action}ed`,
          created_at: new Date().toISOString()
        })
      });

      return new Response(JSON.stringify({
        success: true,
        message: message,
        bag: {
          bag_id: bag_id,
          status: newStatus,
          updated_at: new Date().toISOString()
        }
      }), {
        status: 200,
        headers: { 'Content-Type': 'application/json', ...corsHeaders }
      });

    } catch (error) {
      console.error('Update bag error:', error);
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