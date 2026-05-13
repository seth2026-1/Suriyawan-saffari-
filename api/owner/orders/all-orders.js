// api/owner/orders/all-orders.js
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
          }),
          eq: (field, value) => ({
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
      }
    })
  };
}

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
    const status = url.searchParams.get('status');
    const seller_id = url.searchParams.get('seller_id');
    const cust_id = url.searchParams.get('cust_id');
    const rider_id = url.searchParams.get('rider_id');
    const from_date = url.searchParams.get('from_date');
    const to_date = url.searchParams.get('to_date');
    const min_amount = url.searchParams.get('min_amount');
    const max_amount = url.searchParams.get('max_amount');
    const search = url.searchParams.get('search');
    const sort_by = url.searchParams.get('sort_by') || 'placed_at';
    const sort_order = url.searchParams.get('sort_order') || 'desc';
    const page = parseInt(url.searchParams.get('page') || '1');
    const limit = parseInt(url.searchParams.get('limit') || '20');

    const supabase = createSupabaseClient();
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

    // Build the orders query
    const ordersSelect = `book_id,tracking_id,cancel_code,cancel_code_expiry,status,total_amount,delivery_charge,discount_amount,final_amount,payment_method,address,placed_at,accepted_at,packed_at,shipped_at,out_for_delivery_at,delivered_at,cancelled_at,rto_at,cancel_reason,customers!inner(cust_id,name,email,mobile),sellers!inner(seller_id,shop_name,owner_name,mobile as seller_mobile),riders!left(rider_id,name as rider_name,mobile as rider_mobile),order_items(item_id,quantity,price_at_time,products(prod_id,name,images))`;
    let ordersUrl = `${supabaseUrl}/rest/v1/orders?select=${encodeURIComponent(ordersSelect)}&order=${sort_by}.${sort_order === 'asc' ? 'asc' : 'desc'}`;

    if (status && status !== 'all') {
      ordersUrl += `&status=eq.${status}`;
    }

    if (seller_id) {
      ordersUrl += `&seller_id=eq.${seller_id}`;
    }

    if (cust_id) {
      ordersUrl += `&cust_id=eq.${cust_id}`;
    }

    if (rider_id) {
      ordersUrl += `&rider_id=eq.${rider_id}`;
    }

    if (from_date) {
      ordersUrl += `&placed_at=gte.${from_date}`;
    }

    if (to_date) {
      ordersUrl += `&placed_at=lte.${to_date}`;
    }

    if (min_amount) {
      ordersUrl += `&final_amount=gte.${parseInt(min_amount)}`;
    }

    if (max_amount) {
      ordersUrl += `&final_amount=lte.${parseInt(max_amount)}`;
    }

    if (search) {
      ordersUrl += `&or=(book_id.ilike.%${search}%,tracking_id.ilike.%${search}%,customers.name.ilike.%${search}%,customers.email.ilike.%${search}%,sellers.shop_name.ilike.%${search}%)`;
    }

    const from = (page - 1) * limit;
    const to = from + limit - 1;
    ordersUrl += `&offset=${from}&limit=${limit}`;

    const ordersResponse = await fetch(ordersUrl, {
      headers: {
        'apikey': supabaseKey,
        'Authorization': `Bearer ${supabaseKey}`,
      },
    });
    const orders = await ordersResponse.json();
    const count = parseInt(ordersResponse.headers.get('content-range')?.split('/')[1] || '0');

    // Get order statistics for all orders
    const allOrdersUrl = `${supabaseUrl}/rest/v1/orders?select=status,final_amount,placed_at,seller_id`;
    const allOrdersResponse = await fetch(allOrdersUrl, {
      headers: {
        'apikey': supabaseKey,
        'Authorization': `Bearer ${supabaseKey}`,
      },
    });
    const allOrders = await allOrdersResponse.json();

    const now = new Date();
    const today = now.toISOString().split('T')[0];
    const weekAgo = new Date(now.setDate(now.getDate() - 7)).toISOString();
    now.setMonth(now.getMonth() - 1);
    const monthAgo = now.toISOString();

    const stats = {
      total: allOrders?.length || 0,
      total_revenue: allOrders?.filter(o => o.status === 'DELIVERED').reduce((sum, o) => sum + (o.final_amount || 0), 0) || 0,
      by_status: {
        pending: allOrders?.filter(o => o.status === 'PENDING').length || 0,
        accepted: allOrders?.filter(o => o.status === 'ACCEPTED').length || 0,
        packed: allOrders?.filter(o => o.status === 'PACKED').length || 0,
        shipped: allOrders?.filter(o => o.status === 'SHIPPED').length || 0,
        out_for_delivery: allOrders?.filter(o => o.status === 'OUT_FOR_DELIVERY').length || 0,
        delivered: allOrders?.filter(o => o.status === 'DELIVERED').length || 0,
        cancelled: allOrders?.filter(o => o.status === 'CANCELLED').length || 0,
        rto: allOrders?.filter(o => o.status === 'RTO').length || 0
      },
      today: {
        count: allOrders?.filter(o => o.placed_at?.startsWith(today)).length || 0,
        revenue: allOrders?.filter(o => o.placed_at?.startsWith(today) && o.status === 'DELIVERED').reduce((sum, o) => sum + (o.final_amount || 0), 0) || 0
      },
      this_week: {
        count: allOrders?.filter(o => o.placed_at >= weekAgo).length || 0,
        revenue: allOrders?.filter(o => o.placed_at >= weekAgo && o.status === 'DELIVERED').reduce((sum, o) => sum + (o.final_amount || 0), 0) || 0
      },
      this_month: {
        count: allOrders?.filter(o => o.placed_at >= monthAgo).length || 0,
        revenue: allOrders?.filter(o => o.placed_at >= monthAgo && o.status === 'DELIVERED').reduce((sum, o) => sum + (o.final_amount || 0), 0) || 0
      },
      avg_order_value: (() => {
        const deliveredOrders = allOrders?.filter(o => o.status === 'DELIVERED') || [];
        return deliveredOrders.length > 0 ? deliveredOrders.reduce((sum, o) => sum + (o.final_amount || 0), 0) / deliveredOrders.length : 0;
      })()
    };

    // Get top sellers by order count
    const sellerOrderCount = {};
    allOrders?.forEach(order => {
      if (order.seller_id) {
        sellerOrderCount[order.seller_id] = (sellerOrderCount[order.seller_id] || 0) + 1;
      }
    });
    const topSellers = Object.entries(sellerOrderCount)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([sellerId, orderCount]) => ({ seller_id: sellerId, order_count: orderCount }));

    // Format orders
    const formattedOrders = orders?.map(order => ({
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
      cancel_reason: order.cancel_reason,
      customer: {
        cust_id: order.customers?.cust_id,
        name: order.customers?.name,
        email: order.customers?.email,
        mobile: order.customers?.mobile
      },
      seller: {
        seller_id: order.sellers?.seller_id,
        shop_name: order.sellers?.shop_name,
        owner_name: order.sellers?.owner_name,
        mobile: order.sellers?.seller_mobile
      },
      rider: order.riders?.rider_id ? {
        rider_id: order.riders.rider_id,
        name: order.riders.rider_name,
        mobile: order.riders.rider_mobile
      } : null,
      items: (order.order_items || []).map(item => ({
        prod_id: item.products?.prod_id,
        name: item.products?.name,
        quantity: item.quantity,
        price: item.price_at_time,
        total: item.price_at_time * item.quantity,
        image: item.products?.images?.[0] || null
      }))
    })) || [];

    return new Response(JSON.stringify({
      success: true,
      orders: formattedOrders,
      stats: stats,
      top_sellers: topSellers,
      pagination: {
        current_page: page,
        total_pages: Math.ceil(count / limit),
        total_items: count,
        items_per_page: limit
      },
      filters_applied: {
        status: status || 'all',
        seller_id: seller_id || null,
        cust_id: cust_id || null,
        from_date: from_date || null,
        to_date: to_date || null,
        min_amount: min_amount || null,
        max_amount: max_amount || null
      }
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json', ...corsHeaders }
    });

  } catch (error) {
    console.error('All orders error:', error);
    return new Response(JSON.stringify({
      success: false,
      error: error.message || 'Internal server error'
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json', ...corsHeaders }
    });
  }
}