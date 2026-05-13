// api/owner/orders/rto-approve.js
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
            or: (condition) => ({
              range: async (from, to) => {
                const finalUrl = `${url}&${field}=eq.${value}&or=${condition}&offset=${from}&limit=${to - from + 1}`;
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
            }),
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
            }
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
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
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
  // GET RTO ORDERS PENDING APPROVAL
  // =====================================================
  if (request.method === 'GET') {
    try {
      const page = parseInt(url.searchParams.get('page') || '1');
      const limit = parseInt(url.searchParams.get('limit') || '20');
      const search = url.searchParams.get('search');

      // Build RTO orders query
      const rtoSelect = `book_id,tracking_id,final_amount,cancel_reason,cancelled_at,address,
        customers!inner(cust_id,name,mobile,email),
        sellers!inner(seller_id,shop_name,owner_name,email as seller_email,mobile as seller_mobile,upi_id),
        order_items!inner(quantity,price_at_time,products(prod_id,name,images,selling_price)),
        shipment_tracking!inner(track_id,status,notes,photo,created_at)`;

      let rtoUrl = `${supabaseUrl}/rest/v1/orders?select=${encodeURIComponent(rtoSelect)}&status=eq.RTO&order=cancelled_at.desc`;

      if (search) {
        rtoUrl += `&or=(book_id.ilike.%${search}%,customers.name.ilike.%${search}%,sellers.shop_name.ilike.%${search}%)`;
      }

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

      const now = new Date();
      const monthAgo = new Date(now.setMonth(now.getMonth() - 1));

      const stats = {
        total_rto: allRtoOrders?.length || 0,
        total_rto_amount: allRtoOrders?.reduce((sum, o) => sum + (o.final_amount || 0), 0) || 0,
        pending_approval: rtoOrders?.length || 0,
        last_month_rto: allRtoOrders?.filter(o => new Date(o.cancelled_at) >= monthAgo).length || 0,
        avg_rto_value: allRtoOrders?.length > 0 ? (allRtoOrders.reduce((sum, o) => sum + (o.final_amount || 0), 0) / allRtoOrders.length) : 0
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
            cust_id: order.customers?.cust_id,
            name: order.customers?.name,
            mobile: order.customers?.mobile,
            email: order.customers?.email
          },
          seller: {
            seller_id: order.sellers?.seller_id,
            shop_name: order.sellers?.shop_name,
            owner_name: order.sellers?.owner_name,
            email: order.sellers?.seller_email,
            mobile: order.sellers?.seller_mobile,
            upi_id: order.sellers?.upi_id
          },
          items: (order.order_items || []).map(item => ({
            prod_id: item.products?.prod_id,
            name: item.products?.name,
            quantity: item.quantity,
            price: item.price_at_time,
            total: item.price_at_time * item.quantity,
            image: item.products?.images?.[0] || null
          })),
          tracking: (order.shipment_tracking || []).map(t => ({
            status: t.status,
            notes: t.notes,
            photo: t.photo,
            created_at: t.created_at
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
      console.error('Get RTO approvals error:', error);
      return new Response(JSON.stringify({ success: false, error: error.message }), {
        status: 500,
        headers: { 'Content-Type': 'application/json', ...corsHeaders }
      });
    }
  }

  // =====================================================
  // APPROVE/REJECT RTO (POST)
  // =====================================================
  if (request.method === 'POST') {
    try {
      const body = await request.json();
      const {
        book_id,
        action,
        resolution,
        refund_amount,
        notes,
        restock_items = true
      } = body;

      if (!book_id || !action) {
        return new Response(JSON.stringify({
          success: false,
          error: 'Order ID and action are required'
        }), {
          status: 400,
          headers: { 'Content-Type': 'application/json', ...corsHeaders }
        });
      }

      if (!['approve', 'reject', 'partial'].includes(action)) {
        return new Response(JSON.stringify({ success: false, error: 'Invalid action' }), {
          status: 400,
          headers: { 'Content-Type': 'application/json', ...corsHeaders }
        });
      }

      // Get order details with nested relations
      const orderSelect = `*,
        customers!inner(cust_id,name,email,mobile,wallet_balance),
        sellers!inner(seller_id,shop_name,email as seller_email),
        order_items!inner(item_id,quantity,price_at_time,prod_id,products!inner(name,stock))`;
      const orderUrl = `${supabaseUrl}/rest/v1/orders?select=${encodeURIComponent(orderSelect)}&book_id=eq.${book_id}`;
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

      const updateData = {
        updated_at: new Date().toISOString(),
        rto_resolution: resolution || null,
        rto_resolved_at: new Date().toISOString(),
        rto_resolved_by: 'OWN001'
      };

      let notificationMessage = '';
      let notificationTitle = '';

      if (action === 'approve') {
        updateData.status = 'RTO_APPROVED';
        updateData.rto_approved = true;
        updateData.rto_approved_at = new Date().toISOString();

        notificationTitle = 'RTO Request Approved';
        notificationMessage = `Your RTO request for order ${book_id} has been approved. ${refund_amount ? `Refund of ₹${refund_amount} will be processed.` : ''}`;

        // Process refund if applicable
        if (refund_amount && refund_amount > 0) {
          // Get current customer wallet balance
          const customerUrl = `${supabaseUrl}/rest/v1/customers?cust_id=eq.${order.cust_id}&select=wallet_balance`;
          const customerResponse = await fetch(customerUrl, {
            headers: {
              'apikey': supabaseKey,
              'Authorization': `Bearer ${supabaseKey}`,
            },
          });
          const customerData = await customerResponse.json();
          const currentBalance = customerData[0]?.wallet_balance || 0;

          await fetch(`${supabaseUrl}/rest/v1/wallet_transactions`, {
            method: 'POST',
            headers: {
              'apikey': supabaseKey,
              'Authorization': `Bearer ${supabaseKey}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              user_id: order.cust_id,
              user_type: 'customer',
              amount: refund_amount,
              type: 'credit',
              reason: `RTO refund for order ${book_id}`,
              reference_id: book_id,
              created_at: new Date().toISOString()
            })
          });

          await fetch(`${supabaseUrl}/rest/v1/customers?cust_id=eq.${order.cust_id}`, {
            method: 'PATCH',
            headers: {
              'apikey': supabaseKey,
              'Authorization': `Bearer ${supabaseKey}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({ wallet_balance: currentBalance + refund_amount })
          });
        }

        // Restock items if approved
        if (restock_items) {
          for (const item of order.order_items || []) {
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
              body: JSON.stringify({ stock: currentStock + item.quantity })
            });
          }
        }

      } else if (action === 'reject') {
        updateData.status = 'RTO_REJECTED';
        updateData.rto_rejected = true;
        updateData.rto_rejected_at = new Date().toISOString();

        notificationTitle = 'RTO Request Rejected';
        notificationMessage = `Your RTO request for order ${book_id} has been rejected. Reason: ${resolution || 'Please contact support for details.'}`;

      } else if (action === 'partial') {
        updateData.status = 'RTO_PARTIAL';
        updateData.rto_partial = true;
        updateData.rto_partial_amount = refund_amount;
        updateData.rto_partial_at = new Date().toISOString();

        notificationTitle = 'Partial RTO Approved';
        notificationMessage = `Your partial RTO request for order ${book_id} has been approved. Refund of ₹${refund_amount} will be processed.`;

        // Partial refund
        if (refund_amount && refund_amount > 0) {
          const customerUrl = `${supabaseUrl}/rest/v1/customers?cust_id=eq.${order.cust_id}&select=wallet_balance`;
          const customerResponse = await fetch(customerUrl, {
            headers: {
              'apikey': supabaseKey,
              'Authorization': `Bearer ${supabaseKey}`,
            },
          });
          const customerData = await customerResponse.json();
          const currentBalance = customerData[0]?.wallet_balance || 0;

          await fetch(`${supabaseUrl}/rest/v1/wallet_transactions`, {
            method: 'POST',
            headers: {
              'apikey': supabaseKey,
              'Authorization': `Bearer ${supabaseKey}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              user_id: order.cust_id,
              user_type: 'customer',
              amount: refund_amount,
              type: 'credit',
              reason: `Partial RTO refund for order ${book_id}`,
              reference_id: book_id,
              created_at: new Date().toISOString()
            })
          });

          await fetch(`${supabaseUrl}/rest/v1/customers?cust_id=eq.${order.cust_id}`, {
            method: 'PATCH',
            headers: {
              'apikey': supabaseKey,
              'Authorization': `Bearer ${supabaseKey}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({ wallet_balance: currentBalance + refund_amount })
          });
        }
      }

      // Update order
      const updateResult = await supabase
        .from('orders')
        .update(updateData)
        .eq('book_id', book_id)
        .select();

      if (updateResult.error) {
        console.error('RTO approval update error:', updateResult.error);
        return new Response(JSON.stringify({ success: false, error: updateResult.error.message }), {
          status: 500,
          headers: { 'Content-Type': 'application/json', ...corsHeaders }
        });
      }

      const updatedOrder = updateResult.data;

      // Add tracking entry
      await fetch(`${supabaseUrl}/rest/v1/shipment_tracking`, {
        method: 'POST',
        headers: {
          'apikey': supabaseKey,
          'Authorization': `Bearer ${supabaseKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          book_id,
          status: updateData.status,
          notes: `RTO ${action}ed by admin. ${resolution ? `Resolution: ${resolution}` : ''} ${notes || ''}`,
          created_at: new Date().toISOString()
        })
      });

      // Send notification to customer
      await fetch(`${supabaseUrl}/rest/v1/notifications`, {
        method: 'POST',
        headers: {
          'apikey': supabaseKey,
          'Authorization': `Bearer ${supabaseKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          user_id: order.cust_id,
          user_type: 'customer',
          title: notificationTitle,
          message: notificationMessage,
          type: 'return',
          data: { book_id, action, refund_amount },
          created_at: new Date().toISOString()
        })
      });

      // Send notification to seller
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
          title: `RTO ${action === 'approve' ? 'Approved' : action === 'reject' ? 'Rejected' : 'Partial Approved'}`,
          message: `RTO request for order ${book_id} has been ${action}ed by admin.`,
          type: 'return',
          data: { book_id, action },
          created_at: new Date().toISOString()
        })
      });

      // Log audit
      await fetch(`${supabaseUrl}/rest/v1/audit_logs`, {
        method: 'POST',
        headers: {
          'apikey': supabaseKey,
          'Authorization': `Bearer ${supabaseKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          table_name: 'orders',
          record_id: book_id,
          action: `RTO_${action.toUpperCase()}`,
          new_data: { status: updateData.status, resolution, refund_amount },
          changed_by: 'OWN001',
          changed_at: new Date().toISOString()
        })
      });

      return new Response(JSON.stringify({
        success: true,
        message: `RTO request ${action}ed successfully`,
        order: {
          book_id: updatedOrder.book_id,
          status: updatedOrder.status,
          resolution: resolution,
          refund_amount: refund_amount || null,
          processed_at: new Date().toISOString()
        }
      }), {
        status: 200,
        headers: { 'Content-Type': 'application/json', ...corsHeaders }
      });

    } catch (error) {
      console.error('RTO approval error:', error);
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