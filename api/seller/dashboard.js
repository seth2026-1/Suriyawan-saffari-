// api/seller/dashboard.js
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
              lt: (ltField, ltValue) => ({
                select: async () => {
                  const finalUrl = `${url}&${field}=eq.${value}&${gteField}=gte.${gteValue}&${ltField}=lt.${ltValue}`;
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

// Helper function to get top selling products
async function getTopProducts(supabaseUrl, supabaseKey, seller_id, limit = 5) {
  // First get order IDs for this seller
  const ordersUrl = `${supabaseUrl}/rest/v1/orders?select=book_id&seller_id=eq.${seller_id}`;
  const ordersResponse = await fetch(ordersUrl, {
    headers: {
      'apikey': supabaseKey,
      'Authorization': `Bearer ${supabaseKey}`,
    },
  });
  const orders = await ordersResponse.json();
  const orderIds = orders?.map(o => o.book_id) || [];

  if (orderIds.length === 0) return [];

  const orderItemsUrl = `${supabaseUrl}/rest/v1/order_items?select=prod_id,quantity,products(name,selling_price,images)&book_id=in.(${orderIds.join(',')})`;
  const orderItemsResponse = await fetch(orderItemsUrl, {
    headers: {
      'apikey': supabaseKey,
      'Authorization': `Bearer ${supabaseKey}`,
    },
  });
  const orderItems = await orderItemsResponse.json();

  const productSales = {};

  if (orderItems) {
    orderItems.forEach(item => {
      if (productSales[item.prod_id]) {
        productSales[item.prod_id].quantity += item.quantity;
      } else {
        productSales[item.prod_id] = {
          prod_id: item.prod_id,
          name: item.products?.name,
          selling_price: item.products?.selling_price,
          image: item.products?.images?.[0] || null,
          quantity: item.quantity
        };
      }
    });
  }

  return Object.values(productSales)
    .sort((a, b) => b.quantity - a.quantity)
    .slice(0, limit);
}

// Helper function to get daily sales
async function getDailySales(supabaseUrl, supabaseKey, seller_id, days = 7) {
  const dailyData = [];

  for (let i = days - 1; i >= 0; i--) {
    const date = new Date();
    date.setDate(date.getDate() - i);
    date.setHours(0, 0, 0, 0);

    const nextDate = new Date(date);
    nextDate.setDate(nextDate.getDate() + 1);

    const ordersUrl = `${supabaseUrl}/rest/v1/orders?select=final_amount&seller_id=eq.${seller_id}&status=eq.DELIVERED&placed_at=gte.${date.toISOString()}&placed_at=lt.${nextDate.toISOString()}`;
    const ordersResponse = await fetch(ordersUrl, {
      headers: {
        'apikey': supabaseKey,
        'Authorization': `Bearer ${supabaseKey}`,
      },
    });
    const orders = await ordersResponse.json();

    const revenue = orders?.reduce((sum, o) => sum + (o.final_amount || 0), 0) || 0;

    dailyData.push({
      date: date.toISOString().split('T')[0],
      revenue: revenue,
      orders: orders?.length || 0
    });
  }

  return dailyData;
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
    return new Response(
      JSON.stringify({ success: false, error: 'Method not allowed' }),
      { status: 405, headers: { 'Content-Type': 'application/json', ...corsHeaders } }
    );
  }

  try {
    const url = new URL(request.url);
    const seller_id = url.searchParams.get('seller_id');
    const period = url.searchParams.get('period') || 'today';

    if (!seller_id) {
      return new Response(
        JSON.stringify({ success: false, error: 'Seller ID is required' }),
        { status: 400, headers: { 'Content-Type': 'application/json', ...corsHeaders } }
      );
    }

    const supabase = createSupabaseClient();
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

    // Verify seller exists
    const sellerResult = await supabase
      .from('sellers')
      .select('seller_id, shop_name, email, mobile, rating, trust_score, wallet_balance, kyc_status, commission_rate, is_active')
      .eq('seller_id', seller_id)
      .single();

    if (sellerResult.error || !sellerResult.data) {
      return new Response(
        JSON.stringify({ success: false, error: 'Seller not found' }),
        { status: 404, headers: { 'Content-Type': 'application/json', ...corsHeaders } }
      );
    }

    const seller = sellerResult.data;

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
      case 'year':
        startDate = new Date(now.setFullYear(now.getFullYear() - 1));
        break;
      default:
        startDate = new Date(now.setHours(0, 0, 0, 0));
    }

    // Get all orders for this seller
    const allOrdersUrl = `${supabaseUrl}/rest/v1/orders?select=*&seller_id=eq.${seller_id}`;
    const allOrdersResponse = await fetch(allOrdersUrl, {
      headers: {
        'apikey': supabaseKey,
        'Authorization': `Bearer ${supabaseKey}`,
      },
    });
    const allOrders = await allOrdersResponse.json();

    // Get orders for current period
    const periodOrdersUrl = `${supabaseUrl}/rest/v1/orders?select=*,order_items(*,products(*))&seller_id=eq.${seller_id}&placed_at=gte.${startDate.toISOString()}&order=placed_at.desc`;
    const periodOrdersResponse = await fetch(periodOrdersUrl, {
      headers: {
        'apikey': supabaseKey,
        'Authorization': `Bearer ${supabaseKey}`,
      },
    });
    const periodOrders = await periodOrdersResponse.json();

    // Get order counts by status using HEAD requests for efficiency
    const getCount = async (status) => {
      const countUrl = `${supabaseUrl}/rest/v1/orders?select=book_id&seller_id=eq.${seller_id}&status=eq.${status}`;
      const countResponse = await fetch(countUrl, {
        method: 'HEAD',
        headers: {
          'apikey': supabaseKey,
          'Authorization': `Bearer ${supabaseKey}`,
        },
      });
      return parseInt(countResponse.headers.get('content-range')?.split('/')[1] || '0');
    };

    const pendingOrders = await getCount('PENDING');
    const packedOrders = await getCount('PACKED');
    const shippedOrders = await getCount('SHIPPED');
    const outForDeliveryOrders = await getCount('OUT_FOR_DELIVERY');
    const rtoOrders = await getCount('RTO');
    const deliveredOrders = await getCount('DELIVERED');

    // Calculate today's stats
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const todayStr = today.toISOString();

    const todayOrdersUrl = `${supabaseUrl}/rest/v1/orders?select=final_amount,status&seller_id=eq.${seller_id}&placed_at=gte.${todayStr}`;
    const todayOrdersResponse = await fetch(todayOrdersUrl, {
      headers: {
        'apikey': supabaseKey,
        'Authorization': `Bearer ${supabaseKey}`,
      },
    });
    const todayOrders = await todayOrdersResponse.json();

    const todayOrderCount = todayOrders?.length || 0;
    const todayCodAmount = todayOrders?.filter(o => o.status !== 'CANCELLED').reduce((sum, o) => sum + (o.final_amount || 0), 0) || 0;
    const todayRtoCount = todayOrders?.filter(o => o.status === 'RTO').length || 0;

    // Get product statistics
    const productsUrl = `${supabaseUrl}/rest/v1/products?select=prod_id,name,stock,selling_price,total_sold,rating,is_active&seller_id=eq.${seller_id}`;
    const productsResponse = await fetch(productsUrl, {
      headers: {
        'apikey': supabaseKey,
        'Authorization': `Bearer ${supabaseKey}`,
      },
    });
    const products = await productsResponse.json();

    const totalProducts = products?.length || 0;
    const activeProducts = products?.filter(p => p.is_active === true).length || 0;
    const lowStockProducts = products?.filter(p => p.stock <= 5 && p.stock > 0).length || 0;
    const outOfStockProducts = products?.filter(p => p.stock === 0).length || 0;
    const totalProductValue = products?.reduce((sum, p) => sum + (p.selling_price * p.stock), 0) || 0;

    // Get top selling products
    const topProducts = await getTopProducts(supabaseUrl, supabaseKey, seller_id, 5);

    // Get daily sales for graph (last 7 days)
    const dailySales = await getDailySales(supabaseUrl, supabaseKey, seller_id, 7);

    // Get recent orders (last 10)
    const recentOrdersUrl = `${supabaseUrl}/rest/v1/orders?select=*,order_items(quantity,products(name))&seller_id=eq.${seller_id}&order=placed_at.desc&limit=10`;
    const recentOrdersResponse = await fetch(recentOrdersUrl, {
      headers: {
        'apikey': supabaseKey,
        'Authorization': `Bearer ${supabaseKey}`,
      },
    });
    const recentOrders = await recentOrdersResponse.json();

    // Get pending payouts
    const pendingPayoutsUrl = `${supabaseUrl}/rest/v1/payouts?select=payout_id,amount,status,requested_at&user_id=eq.${seller_id}&user_type=eq.seller&status=in.(PENDING,PROCESSING)`;
    const pendingPayoutsResponse = await fetch(pendingPayoutsUrl, {
      headers: {
        'apikey': supabaseKey,
        'Authorization': `Bearer ${supabaseKey}`,
      },
    });
    const pendingPayouts = await pendingPayoutsResponse.json();

    const pendingPayoutAmount = pendingPayouts?.reduce((sum, p) => sum + p.amount, 0) || 0;

    // Get unread notifications
    const notificationsUrl = `${supabaseUrl}/rest/v1/notifications?select=*&user_id=eq.${seller_id}&user_type=eq.seller&is_read=eq.false&order=created_at.desc&limit=10`;
    const notificationsResponse = await fetch(notificationsUrl, {
      headers: {
        'apikey': supabaseKey,
        'Authorization': `Bearer ${supabaseKey}`,
      },
    });
    const notifications = await notificationsResponse.json();

    // Calculate RTO percentage
    const totalOrders = allOrders?.length || 0;
    const rtoPercentage = totalOrders > 0 ? ((rtoOrders || 0) / totalOrders) * 100 : 0;

    // Calculate this period stats
    const periodOrderCount = periodOrders?.length || 0;
    const periodRevenue = periodOrders?.filter(o => o.status === 'DELIVERED').reduce((sum, o) => sum + (o.final_amount || 0), 0) || 0;
    const periodRtoCount = periodOrders?.filter(o => o.status === 'RTO').length || 0;
    const periodRtoAmount = periodOrders?.filter(o => o.status === 'RTO').reduce((sum, o) => sum + (o.final_amount || 0), 0) || 0;
    const totalRevenue = allOrders?.filter(o => o.status === 'DELIVERED').reduce((sum, o) => sum + (o.final_amount || 0), 0) || 0;

    // Calculate earnings after commission
    const commissionRate = seller.commission_rate || 10;
    const estimatedEarnings = periodRevenue * (1 - commissionRate / 100);

    return new Response(
      JSON.stringify({
        success: true,
        seller: {
          seller_id: seller.seller_id,
          shop_name: seller.shop_name,
          email: seller.email,
          mobile: seller.mobile,
          rating: seller.rating || 0,
          trust_score: seller.trust_score || 100,
          wallet_balance: seller.wallet_balance || 0,
          kyc_status: seller.kyc_status,
          commission_rate: seller.commission_rate,
          is_active: seller.is_active
        },
        dashboard: {
          period: period,
          today: {
            orders: todayOrderCount,
            cod_amount: todayCodAmount,
            rto_count: todayRtoCount
          },
          summary: {
            total_orders: totalOrders || 0,
            pending_orders: pendingOrders,
            packed_orders: packedOrders,
            shipped_orders: shippedOrders,
            out_for_delivery: outForDeliveryOrders,
            delivered_orders: deliveredOrders,
            rto_orders: rtoOrders,
            rto_percentage: parseFloat(rtoPercentage.toFixed(2)),
            total_revenue: totalRevenue,
            pending_payout: pendingPayoutAmount
          },
          products: {
            total: totalProducts,
            active: activeProducts,
            low_stock: lowStockProducts,
            out_of_stock: outOfStockProducts,
            total_inventory_value: totalProductValue
          },
          top_products: topProducts,
          daily_sales: dailySales,
          recent_orders: recentOrders?.map(order => ({
            book_id: order.book_id,
            status: order.status,
            final_amount: order.final_amount,
            placed_at: order.placed_at,
            customer_name: order.address?.name || 'Customer',
            items_count: order.order_items?.length || 0
          })) || [],
          notifications: notifications?.map(n => ({
            notification_id: n.notif_id,
            title: n.title,
            message: n.message,
            type: n.type,
            created_at: n.created_at
          })) || [],
          period_stats: {
            orders: periodOrderCount,
            revenue: periodRevenue,
            rto_count: periodRtoCount,
            rto_amount: periodRtoAmount,
            estimated_earnings: Math.round(estimatedEarnings)
          }
        }
      }),
      { status: 200, headers: { 'Content-Type': 'application/json', ...corsHeaders } }
    );

  } catch (error) {
    console.error('Seller dashboard error:', error);
    return new Response(
      JSON.stringify({
        success: false,
        error: error.message || 'Internal server error'
      }),
      { status: 500, headers: { 'Content-Type': 'application/json', ...corsHeaders } }
    );
  }
}