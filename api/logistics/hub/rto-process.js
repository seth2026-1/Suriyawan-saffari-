// api/logistics/hub/rto-process.js
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
            range: async (from, to) => {
              const finalUrl = `${url}&${field}=eq.${value}&offset=${from}&limit=${to - from + 1}`;
              const response = await fetch(finalUrl, {
                headers: {
                  'apikey': supabaseKey,
                  'Authorization': `Bearer ${supabaseKey}`,
                },
              });
              const data = await response.json();
              const count = response.headers.get('content-range')?.split('/')[1];
              return { data, error: null, count: count ? parseInt(count) : null };
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
  // GET RTO PROCESSING DATA
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

      // Get RTO orders with nested relations
      const rtoSelect = `book_id,tracking_id,final_amount,status,cancel_reason,cancelled_at,address,customers!inner(cust_id,name,mobile,address),sellers!inner(seller_id,shop_name,mobile as seller_mobile,upi_id),order_items!inner(quantity,price_at_time,products!inner(prod_id,name,images))`;
      let rtoUrl = `${supabaseUrl}/rest/v1/orders?select=${encodeURIComponent(rtoSelect)}&status=eq.RTO&order=cancelled_at.desc`;

      const from = (page - 1) * limit;
      const to = from + limit - 1;
      rtoUrl += `&offset=${from}&limit=${limit}`;

      const rtoResponse = await fetch(rtoUrl, {
        headers: {
          'apikey': supabaseKey,
          'Authorization': `Bearer ${supabaseKey}`,
        },
      });
      const rtoOrders = await rtoResponse.json();
      const count = parseInt(rtoResponse.headers.get('content-range')?.split('/')[1] || '0');

      // Get RTO statistics
      const allRtoUrl = `${supabaseUrl}/rest/v1/orders?select=final_amount,cancelled_at&status=eq.RTO`;
      const allRtoResponse = await fetch(allRtoUrl, {
        headers: {
          'apikey': supabaseKey,
          'Authorization': `Bearer ${supabaseKey}`,
        },
      });
      const allRtoOrders = await allRtoResponse.json();

      const totalRtoCount = allRtoOrders?.length || 0;
      const totalRtoAmount = allRtoOrders?.reduce((sum, o) => sum + (o.final_amount || 0), 0) || 0;

      // Get this month's RTO
      const monthStart = new Date();
      monthStart.setDate(1);
      monthStart.setHours(0, 0, 0, 0);
      const monthStartStr = monthStart.toISOString();

      const monthlyRto = allRtoOrders?.filter(o => new Date(o.cancelled_at) >= monthStart) || [];
      const monthlyRtoCount = monthlyRto.length;
      const monthlyRtoAmount = monthlyRto.reduce((sum, o) => sum + (o.final_amount || 0), 0) || 0;

      const stats = {
        total_rto: totalRtoCount,
        total_rto_amount: totalRtoAmount,
        monthly_rto: monthlyRtoCount,
        monthly_rto_amount: monthlyRtoAmount,
        pending_return_to_seller: rtoOrders?.length || 0
      };

      // Get RTO reasons breakdown
      const rtoReasons = {};
      allRtoOrders?.forEach(order => {
        const reason = order.cancel_reason || 'Unknown';
        rtoReasons[reason] = (rtoReasons[reason] || 0) + 1;
      });

      return new Response(JSON.stringify({
        success: true,
        rto_orders: rtoOrders?.map(order => ({
          book_id: order.book_id,
          tracking_id: order.tracking_id,
          amount: order.final_amount,
          cancel_reason: order.cancel_reason,
          cancelled_at: order.cancelled_at,
          customer: {
            name: order.customers?.name,
            mobile: order.customers?.mobile,
            address: order.customers?.address
          },
          seller: {
            seller_id: order.sellers?.seller_id,
            shop_name: order.sellers?.shop_name,
            mobile: order.sellers?.seller_mobile,
            upi_id: order.sellers?.upi_id
          },
          items: (order.order_items || []).map(item => ({
            prod_id: item.products.prod_id,
            name: item.products.name,
            quantity: item.quantity,
            price: item.price_at_time,
            image: item.products.images?.[0] || null
          }))
        })) || [],
        stats: stats,
        rto_reasons: rtoReasons,
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
      console.error('Get RTO process error:', error);
      return new Response(JSON.stringify({ success: false, error: error.message }), {
        status: 500,
        headers: { 'Content-Type': 'application/json', ...corsHeaders }
      });
    }
  }

  // =====================================================
  // PROCESS RTO - RETURN TO SELLER (POST)
  // =====================================================
  if (request.method === 'POST') {
    try {
      const body = await request.json();
      const {
        hub_id,
        book_id,
        action,
        quality_check_passed,
        damage_notes,
        damage_photos,
        restock_quantity
      } = body;

      if (!hub_id || !book_id || !action) {
        return new Response(JSON.stringify({
          success: false,
          error: 'Hub ID, Order ID and action are required'
        }), {
          status: 400,
          headers: { 'Content-Type': 'application/json', ...corsHeaders }
        });
      }

      const supabase = createSupabaseClient();
      const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
      const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

      // Get order details with seller info
      const orderUrl = `${supabaseUrl}/rest/v1/orders?select=*,sellers!inner(seller_id,shop_name,email,mobile)&book_id=eq.${book_id}`;
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

      if (order.status !== 'RTO') {
        return new Response(JSON.stringify({
          success: false,
          error: `Order is not in RTO status. Current status: ${order.status}`
        }), {
          status: 400,
          headers: { 'Content-Type': 'application/json', ...corsHeaders }
        });
      }

      if (action === 'return_to_seller') {
        // Update order status for return to seller
        await fetch(`${supabaseUrl}/rest/v1/orders?book_id=eq.${book_id}`, {
          method: 'PATCH',
          headers: {
            'apikey': supabaseKey,
            'Authorization': `Bearer ${supabaseKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            status: 'RETURNING_TO_SELLER',
            updated_at: new Date().toISOString(),
            rto_return_initiated_at: new Date().toISOString()
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
            book_id: book_id,
            status: 'RETURNING_TO_SELLER',
            location: hub_id,
            hub_id: hub_id,
            notes: `RTO shipment returning to seller. Quality check: ${quality_check_passed ? 'Passed' : 'Failed'}`,
            created_at: new Date().toISOString()
          })
        });

        // Create return shipment record
        await fetch(`${supabaseUrl}/rest/v1/return_shipments`, {
          method: 'POST',
          headers: {
            'apikey': supabaseKey,
            'Authorization': `Bearer ${supabaseKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            book_id: book_id,
            from_hub: hub_id,
            to_seller: order.seller_id,
            quality_check_passed: quality_check_passed || false,
            damage_notes: damage_notes || null,
            damage_photos: damage_photos || null,
            status: 'INITIATED',
            created_at: new Date().toISOString()
          })
        });

        // Notify seller
        await fetch(`${supabaseUrl}/rest/v1/notifications`, {
          method: 'POST',
          headers: {
            'apikey': supabaseKey,
            'Authorization': `Bearer ${supabaseKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            user_id: order.seller_id,
            user_type: 'seller',
            title: 'RTO Product Being Returned',
            message: `Your RTO product for order ${book_id} is being returned to you.`,
            type: 'rto',
            data: { book_id: book_id },
            created_at: new Date().toISOString()
          })
        });

        return new Response(JSON.stringify({
          success: true,
          message: 'RTO shipment initiated for return to seller',
          order: {
            book_id: book_id,
            status: 'RETURNING_TO_SELLER',
            quality_check_passed: quality_check_passed
          }
        }), {
          status: 200,
          headers: { 'Content-Type': 'application/json', ...corsHeaders }
        });

      }
      else if (action === 'restock') {
        // Get order items
        const orderItemsUrl = `${supabaseUrl}/rest/v1/order_items?select=prod_id,quantity&book_id=eq.${book_id}`;
        const orderItemsResponse = await fetch(orderItemsUrl, {
          headers: {
            'apikey': supabaseKey,
            'Authorization': `Bearer ${supabaseKey}`,
          },
        });
        const orderItems = await orderItemsResponse.json();

        for (const item of orderItems || []) {
          const restockQty = restock_quantity || item.quantity;
          
          // Get current stock
          const productUrl = `${supabaseUrl}/rest/v1/products?prod_id=eq.${item.prod_id}&select=stock`;
          const productResponse = await fetch(productUrl, {
            headers: {
              'apikey': supabaseKey,
              'Authorization': `Bearer ${supabaseKey}`,
            },
          });
          const productData = await productResponse.json();
          const currentStock = productData[0]?.stock || 0;

          await fetch(`${supabaseUrl}/rest/v1/products?prod_id=eq.${item.prod_id}`, {
            method: 'PATCH',
            headers: {
              'apikey': supabaseKey,
              'Authorization': `Bearer ${supabaseKey}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              stock: currentStock + restockQty,
              updated_at: new Date().toISOString()
            })
          });
        }

        // Update order status
        await fetch(`${supabaseUrl}/rest/v1/orders?book_id=eq.${book_id}`, {
          method: 'PATCH',
          headers: {
            'apikey': supabaseKey,
            'Authorization': `Bearer ${supabaseKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            status: 'RTO_RESTOCKED',
            updated_at: new Date().toISOString(),
            restocked_at: new Date().toISOString(),
            restocked_by: hub_id
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
            book_id: book_id,
            status: 'RTO_RESTOCKED',
            location: hub_id,
            hub_id: hub_id,
            notes: `RTO products restocked. Quantity: ${restock_quantity || 'All'}`,
            created_at: new Date().toISOString()
          })
        });

        return new Response(JSON.stringify({
          success: true,
          message: 'RTO products restocked successfully',
          order: {
            book_id: book_id,
            status: 'RTO_RESTOCKED'
          }
        }), {
          status: 200,
          headers: { 'Content-Type': 'application/json', ...corsHeaders }
        });

      }
      else if (action === 'dispose') {
        // Mark as disposed (for damaged products)
        await fetch(`${supabaseUrl}/rest/v1/orders?book_id=eq.${book_id}`, {
          method: 'PATCH',
          headers: {
            'apikey': supabaseKey,
            'Authorization': `Bearer ${supabaseKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            status: 'RTO_DISPOSED',
            updated_at: new Date().toISOString(),
            disposed_at: new Date().toISOString(),
            disposed_by: hub_id,
            disposal_reason: damage_notes || 'Product damaged'
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
            book_id: book_id,
            status: 'RTO_DISPOSED',
            location: hub_id,
            hub_id: hub_id,
            notes: `Product disposed due to: ${damage_notes || 'Damage'}`,
            created_at: new Date().toISOString()
          })
        });

        // Notify seller about disposal
        await fetch(`${supabaseUrl}/rest/v1/notifications`, {
          method: 'POST',
          headers: {
            'apikey': supabaseKey,
            'Authorization': `Bearer ${supabaseKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            user_id: order.seller_id,
            user_type: 'seller',
            title: 'RTO Product Disposed',
            message: `Your RTO product for order ${book_id} has been disposed due to damage.`,
            type: 'rto',
            data: { book_id: book_id },
            created_at: new Date().toISOString()
          })
        });

        return new Response(JSON.stringify({
          success: true,
          message: 'RTO product marked as disposed',
          order: {
            book_id: book_id,
            status: 'RTO_DISPOSED'
          }
        }), {
          status: 200,
          headers: { 'Content-Type': 'application/json', ...corsHeaders }
        });
      }
      else {
        return new Response(JSON.stringify({ success: false, error: 'Invalid action' }), {
          status: 400,
          headers: { 'Content-Type': 'application/json', ...corsHeaders }
        });
      }

    } catch (error) {
      console.error('Process RTO error:', error);
      return new Response(JSON.stringify({ success: false, error: error.message }), {
        status: 500,
        headers: { 'Content-Type': 'application/json', ...corsHeaders }
      });
    }
  }

  // =====================================================
  // UPDATE RTO DISPUTE RESOLUTION (PUT)
  // =====================================================
  if (request.method === 'PUT') {
    try {
      const body = await request.json();
      const { dispute_id, hub_id, resolution, resolution_notes, amount_settled } = body;

      if (!dispute_id || !hub_id || !resolution) {
        return new Response(JSON.stringify({
          success: false,
          error: 'Dispute ID, Hub ID and resolution are required'
        }), {
          status: 400,
          headers: { 'Content-Type': 'application/json', ...corsHeaders }
        });
      }

      const supabase = createSupabaseClient();
      const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
      const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

      // Get dispute details
      const disputeUrl = `${supabaseUrl}/rest/v1/disputes?dispute_id=eq.${dispute_id}&select=*`;
      const disputeResponse = await fetch(disputeUrl, {
        headers: {
          'apikey': supabaseKey,
          'Authorization': `Bearer ${supabaseKey}`,
        },
      });
      const disputeData = await disputeResponse.json();
      const dispute = disputeData[0];

      if (!dispute) {
        return new Response(JSON.stringify({ success: false, error: 'Dispute not found' }), {
          status: 404,
          headers: { 'Content-Type': 'application/json', ...corsHeaders }
        });
      }

      const updateData = {
        status: resolution === 'approved' ? 'RESOLVED' : 'REJECTED',
        resolved_at: new Date().toISOString(),
        resolved_by: hub_id,
        resolution_notes: resolution_notes || null
      };

      if (amount_settled) {
        updateData.amount_settled = amount_settled;
      }

      await fetch(`${supabaseUrl}/rest/v1/disputes?dispute_id=eq.${dispute_id}`, {
        method: 'PATCH',
        headers: {
          'apikey': supabaseKey,
          'Authorization': `Bearer ${supabaseKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(updateData)
      });

      // Notify seller about resolution
      await fetch(`${supabaseUrl}/rest/v1/notifications`, {
        method: 'POST',
        headers: {
          'apikey': supabaseKey,
          'Authorization': `Bearer ${supabaseKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          user_id: dispute.seller_id,
          user_type: 'seller',
          title: `RTO Dispute ${resolution === 'approved' ? 'Approved' : 'Rejected'}`,
          message: `Your RTO dispute for order ${dispute.book_id} has been ${resolution === 'approved' ? 'approved' : 'rejected'}.`,
          type: 'dispute',
          data: { dispute_id: dispute_id, book_id: dispute.book_id },
          created_at: new Date().toISOString()
        })
      });

      return new Response(JSON.stringify({
        success: true,
        message: `Dispute ${resolution === 'approved' ? 'approved' : 'rejected'} successfully`,
        dispute: {
          dispute_id: dispute_id,
          status: resolution === 'approved' ? 'RESOLVED' : 'REJECTED',
          resolved_at: new Date().toISOString()
        }
      }), {
        status: 200,
        headers: { 'Content-Type': 'application/json', ...corsHeaders }
      });

    } catch (error) {
      console.error('Update RTO dispute error:', error);
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