// api/seller/orders.js
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
            finalUrl += `${finalUrl.includes('?') ? '&' : '?'}select=*`;
          }

          const response = await fetch(finalUrl, {
            headers: {
              'apikey': supabaseKey,
              'Authorization': `Bearer ${supabaseKey}`,
              'Content-Type': 'application/json',
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
            order: (orderField, { ascending }) => ({
              range: async (from, to) => {
                const result = await execute({
                  eq: { [field]: value },
                  order: { field: orderField, ascending },
                  range: { from, to }
                });
                return result;
              }
            }),
            range: async (from, to) => {
              const result = await execute({
                eq: { [field]: value },
                range: { from, to }
              });
              return result;
            }
          }),
          in: (field, values) => ({
            select: async (columns) => {
              const url = `${supabaseUrl}/rest/v1/${table}?${field}=in.(${values.join(',')})&select=${columns || '*'}`;
              const response = await fetch(url, {
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
            order: (orderField, { ascending }) => ({
              range: async (from, to) => {
                const result = await execute({
                  or: condition,
                  order: { field: orderField, ascending },
                  range: { from, to }
                });
                return result;
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
          return { data: result, error: null };
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
            return { data: result, error: null };
          }
        })
      })
    })
  };
}

// Main handler for Edge Function
export default async function handler(request) {
  // CORS Headers
  const corsHeaders = {
    'Access-Control-Allow-Credentials': 'true',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET,PUT,OPTIONS',
    'Access-Control-Allow-Headers': 'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version, Authorization',
  };

  // Handle preflight
  if (request.method === 'OPTIONS') {
    return new Response(null, {
      status: 204,
      headers: corsHeaders,
    });
  }

  const url = new URL(request.url);

  // =====================================================
  // GET ORDERS LIST
  // =====================================================
  if (request.method === 'GET') {
    try {
      const seller_id = url.searchParams.get('seller_id');
      const status = url.searchParams.get('status');
      const page = parseInt(url.searchParams.get('page') || '1');
      const limit = parseInt(url.searchParams.get('limit') || '20');
      const search = url.searchParams.get('search');
      const from_date = url.searchParams.get('from_date');
      const to_date = url.searchParams.get('to_date');
      const sort_by = url.searchParams.get('sort_by') || 'placed_at';
      const sort_order = url.searchParams.get('sort_order') || 'desc';

      if (!seller_id) {
        return new Response(JSON.stringify({ 
          success: false, 
          error: 'Seller ID is required' 
        }), {
          status: 400,
          headers: { 'Content-Type': 'application/json', ...corsHeaders }
        });
      }

      const supabase = createSupabaseClient();

      // Verify seller exists
      const sellerResult = await supabase
        .from('sellers')
        .select('seller_id, shop_name, commission_rate')
        .eq('seller_id', seller_id)
        .single();

      if (sellerResult.error || !sellerResult.data) {
        return new Response(JSON.stringify({ 
          success: false, 
          error: 'Seller not found' 
        }), {
          status: 404,
          headers: { 'Content-Type': 'application/json', ...corsHeaders }
        });
      }

      const seller = sellerResult.data;

      // Build query
      let query = supabase
        .from('orders')
        .select(`
          *,
          order_items (
            item_id,
            quantity,
            price_at_time,
            products!inner (
              prod_id,
              name,
              images
            )
          ),
          customers!inner (
            cust_id,
            name,
            mobile
          )
        `, { count: 'exact' })
        .eq('seller_id', seller_id);

      if (status && status !== 'all') {
        query = query.eq('status', status);
      }

      if (from_date) {
        query = query.gte('placed_at', from_date);
      }
      if (to_date) {
        query = query.lte('placed_at', to_date);
      }

      if (search) {
        query = query.or(`book_id.ilike.%${search}%,customers.name.ilike.%${search}%`);
      }

      const sortAsc = sort_order === 'asc';
      query = query.order(sort_by, { ascending: sortAsc });

      const from = (page - 1) * limit;
      const to = from + limit - 1;

      const { data: orders, count } = await query.range(from, to);

      // Get order status counts
      const allOrdersResult = await supabase
        .from('orders')
        .select('status, final_amount')
        .eq('seller_id', seller_id);

      const statusCounts = allOrdersResult.data || [];

      const orderStats = {
        all: statusCounts.length || 0,
        pending: statusCounts.filter(o => o.status === 'PENDING').length || 0,
        accepted: statusCounts.filter(o => o.status === 'ACCEPTED').length || 0,
        packed: statusCounts.filter(o => o.status === 'PACKED').length || 0,
        shipped: statusCounts.filter(o => o.status === 'SHIPPED').length || 0,
        out_for_delivery: statusCounts.filter(o => o.status === 'OUT_FOR_DELIVERY').length || 0,
        delivered: statusCounts.filter(o => o.status === 'DELIVERED').length || 0,
        cancelled: statusCounts.filter(o => o.status === 'CANCELLED').length || 0,
        rto: statusCounts.filter(o => o.status === 'RTO').length || 0
      };

      const deliveredOrders = statusCounts.filter(o => o.status === 'DELIVERED') || [];
      const totalRevenue = deliveredOrders.reduce((sum, o) => sum + (o.final_amount || 0), 0);
      const totalCommission = totalRevenue * (seller.commission_rate / 100);
      const netEarnings = totalRevenue - totalCommission;

      const formattedOrders = (orders || []).map(order => ({
        book_id: order.book_id,
        tracking_id: order.tracking_id,
        cancel_code: order.cancel_code,
        cancel_code_expiry: order.cancel_code_expiry,
        status: order.status,
        status_display: getStatusDisplay(order.status),
        status_color: getStatusColor(order.status),
        total_amount: order.total_amount,
        delivery_charge: order.delivery_charge,
        discount_amount: order.discount_amount,
        final_amount: order.final_amount,
        payment_method: order.payment_method,
        address: order.address,
        placed_at: order.placed_at,
        accepted_at: order.accepted_at,
        packed_at: order.packed_at,
        shipped_at: order.shipped_at,
        out_for_delivery_at: order.out_for_delivery_at,
        delivered_at: order.delivered_at,
        cancelled_at: order.cancelled_at,
        customer: {
          cust_id: order.customers?.cust_id,
          name: order.customers?.name,
          mobile: order.customers?.mobile
        },
        items: (order.order_items || []).map(item => ({
          prod_id: item.products.prod_id,
          name: item.products.name,
          quantity: item.quantity,
          price: item.price_at_time,
          total: item.price_at_time * item.quantity,
          image: item.products.images?.[0] || null
        })),
        can_accept: order.status === 'PENDING',
        can_reject: order.status === 'PENDING',
        can_pack: order.status === 'ACCEPTED',
        can_ship: order.status === 'PACKED',
        can_print_slip: ['PENDING', 'ACCEPTED', 'PACKED'].includes(order.status)
      }));

      return new Response(JSON.stringify({
        success: true,
        orders: formattedOrders,
        stats: orderStats,
        financial: {
          total_revenue: totalRevenue,
          commission_rate: seller.commission_rate,
          total_commission: Math.round(totalCommission),
          net_earnings: Math.round(netEarnings)
        },
        pagination: {
          current_page: page,
          total_pages: Math.ceil(count / limit),
          total_items: count,
          items_per_page: limit
        },
        filters_applied: {
          status: status || 'all',
          from_date: from_date || null,
          to_date: to_date || null,
          search: search || null
        }
      }), {
        status: 200,
        headers: { 'Content-Type': 'application/json', ...corsHeaders }
      });

    } catch (error) {
      console.error('Get orders error:', error);
      return new Response(JSON.stringify({ 
        success: false, 
        error: error.message 
      }), {
        status: 500,
        headers: { 'Content-Type': 'application/json', ...corsHeaders }
      });
    }
  }

  // =====================================================
  // UPDATE ORDER STATUS (ACCEPT, PACK, SHIP)
  // =====================================================
  if (request.method === 'PUT') {
    try {
      const body = await request.json();
      const { book_id, seller_id, action, notes } = body;

      if (!book_id || !seller_id || !action) {
        return new Response(JSON.stringify({
          success: false,
          error: 'Order ID, Seller ID and action are required'
        }), {
          status: 400,
          headers: { 'Content-Type': 'application/json', ...corsHeaders }
        });
      }

      const supabase = createSupabaseClient();

      const orderResult = await supabase
        .from('orders')
        .select('*, customers!inner(cust_id, name, mobile)')
        .eq('book_id', book_id)
        .single();

      if (orderResult.error || !orderResult.data) {
        return new Response(JSON.stringify({ 
          success: false, 
          error: 'Order not found or unauthorized' 
        }), {
          status: 404,
          headers: { 'Content-Type': 'application/json', ...corsHeaders }
        });
      }

      const order = orderResult.data;
      let newStatus;
      let updateData = {};
      let notificationMessage = '';

      switch (action) {
        case 'accept':
          if (order.status !== 'PENDING') {
            return new Response(JSON.stringify({ 
              success: false, 
              error: 'Order cannot be accepted at this stage' 
            }), {
              status: 400,
              headers: { 'Content-Type': 'application/json', ...corsHeaders }
            });
          }
          newStatus = 'ACCEPTED';
          updateData.accepted_at = new Date().toISOString();
          notificationMessage = `Your order #${book_id} has been accepted by the seller and will be processed soon.`;
          break;

        case 'reject':
          if (order.status !== 'PENDING') {
            return new Response(JSON.stringify({ 
              success: false, 
              error: 'Order cannot be rejected at this stage' 
            }), {
              status: 400,
              headers: { 'Content-Type': 'application/json', ...corsHeaders }
            });
          }
          newStatus = 'CANCELLED';
          updateData.cancelled_at = new Date().toISOString();
          updateData.cancel_reason = notes || 'Rejected by seller';
          notificationMessage = `Your order #${book_id} has been cancelled by the seller. Reason: ${notes || 'Not specified'}`;
          break;

        case 'pack':
          if (order.status !== 'ACCEPTED') {
            return new Response(JSON.stringify({ 
              success: false, 
              error: 'Order must be accepted before packing' 
            }), {
              status: 400,
              headers: { 'Content-Type': 'application/json', ...corsHeaders }
            });
          }
          newStatus = 'PACKED';
          updateData.packed_at = new Date().toISOString();
          notificationMessage = `Your order #${book_id} has been packed and is ready for pickup.`;
          break;

        case 'ship':
          if (order.status !== 'PACKED') {
            return new Response(JSON.stringify({ 
              success: false, 
              error: 'Order must be packed before shipping' 
            }), {
              status: 400,
              headers: { 'Content-Type': 'application/json', ...corsHeaders }
            });
          }
          newStatus = 'SHIPPED';
          updateData.shipped_at = new Date().toISOString();
          notificationMessage = `Your order #${book_id} has been shipped. Tracking ID: ${order.tracking_id}`;
          break;

        default:
          return new Response(JSON.stringify({ 
            success: false, 
            error: 'Invalid action' 
          }), {
            status: 400,
            headers: { 'Content-Type': 'application/json', ...corsHeaders }
          });
      }

      await supabase
        .from('orders')
        .update({
          status: newStatus,
          ...updateData,
          updated_at: new Date().toISOString()
        })
        .eq('book_id', book_id)
        .select();

      await supabase
        .from('shipment_tracking')
        .insert({
          book_id,
          status: newStatus,
          notes: notes || `Order ${action}ed by seller`,
          created_at: new Date().toISOString()
        });

      await supabase
        .from('notifications')
        .insert({
          user_id: order.cust_id,
          user_type: 'customer',
          title: `Order ${getStatusDisplay(newStatus)}`,
          message: notificationMessage,
          type: 'order',
          data: { order_id: book_id, status: newStatus }
        });

      return new Response(JSON.stringify({
        success: true,
        message: `Order ${action}ed successfully`,
        order: {
          book_id,
          status: newStatus,
          status_display: getStatusDisplay(newStatus),
          updated_at: new Date().toISOString()
        }
      }), {
        status: 200,
        headers: { 'Content-Type': 'application/json', ...corsHeaders }
      });

    } catch (error) {
      console.error('Update order error:', error);
      return new Response(JSON.stringify({ 
        success: false, 
        error: error.message 
      }), {
        status: 500,
        headers: { 'Content-Type': 'application/json', ...corsHeaders }
      });
    }
  }

  return new Response(JSON.stringify({ 
    success: false, 
    error: 'Method not allowed' 
  }), {
    status: 405,
    headers: { 'Content-Type': 'application/json', ...corsHeaders }
  });
}

// Helper functions
function getStatusDisplay(status) {
  const statusMap = {
    'PENDING': 'Pending',
    'ACCEPTED': 'Accepted',
    'PACKED': 'Packed',
    'SHIPPED': 'Shipped',
    'OUT_FOR_DELIVERY': 'Out for Delivery',
    'DELIVERED': 'Delivered',
    'CANCELLED': 'Cancelled',
    'RTO': 'Return to Origin'
  };
  return statusMap[status] || status;
}

function getStatusColor(status) {
  const colorMap = {
    'PENDING': '#f59e0b',
    'ACCEPTED': '#3b82f6',
    'PACKED': '#8b5cf6',
    'SHIPPED': '#06b6d4',
    'OUT_FOR_DELIVERY': '#10b981',
    'DELIVERED': '#22c55e',
    'CANCELLED': '#ef4444',
    'RTO': '#ef4444'
  };
  return colorMap[status] || '#6b7280';
}