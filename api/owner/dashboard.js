// api/owner/dashboard.js
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

          if (queryModifiers.order) {
            finalUrl += `${finalUrl.includes('?') ? '&' : '?'}order=${queryModifiers.order.field}.${queryModifiers.order.ascending ? 'asc' : 'desc'}`;
          }

          if (queryModifiers.range) {
            finalUrl += `${finalUrl.includes('?') ? '&' : '?'}offset=${queryModifiers.range.from}&limit=${queryModifiers.range.to - queryModifiers.range.from + 1}`;
          }

          if (options.count === 'exact' && options.head) {
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
            single: async () => {
              const result = await execute({ eq: { [field]: value } });
              return { data: result.data[0] || null, error: null };
            },
            order: (orderField, { ascending }) => ({
              limit: async (limit) => {
                const result = await execute({
                  eq: { [field]: value },
                  order: { field: orderField, ascending },
                  range: { from: 0, to: limit - 1 }
                });
                return result;
              }
            })
          })
        };
      }
    })
  };
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
    const owner_id = url.searchParams.get('owner_id');
    const period = url.searchParams.get('period') || 'today';

    if (!owner_id || owner_id !== 'OWN001') {
      return new Response(JSON.stringify({ success: false, error: 'Unauthorized. Owner access required.' }), {
        status: 403,
        headers: { 'Content-Type': 'application/json', ...corsHeaders }
      });
    }

    const supabase = createSupabaseClient();
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

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

    const startDateStr = startDate.toISOString();
    const todayStr = new Date().toISOString().split('T')[0];

    // =====================================================
    // USER STATISTICS
    // =====================================================

    // Total counts using HEAD requests for efficiency
    const getCount = async (table, filters = '') => {
      let countUrl = `${supabaseUrl}/rest/v1/${table}?select=*`;
      if (filters) countUrl += filters;
      const response = await fetch(countUrl, {
        method: 'HEAD',
        headers: {
          'apikey': supabaseKey,
          'Authorization': `Bearer ${supabaseKey}`,
        },
      });
      return parseInt(response.headers.get('content-range')?.split('/')[1] || '0');
    };

    const totalCustomers = await getCount('customers');
    const totalSellers = await getCount('sellers');
    const totalRiders = await getCount('riders');
    const totalHubs = await getCount('hub_managers');

    const newCustomers = await getCount('customers', `&created_at=gte.${startDateStr}`);
    const newSellers = await getCount('sellers', `&created_at=gte.${startDateStr}`);
    const newRiders = await getCount('riders', `&created_at=gte.${startDateStr}`);

    const activeCustomers = await getCount('customers', '&is_active=eq.true');
    const activeSellers = await getCount('sellers', '&is_active=eq.true&kyc_status=eq.APPROVED');
    const activeRiders = await getCount('riders', '&is_active=eq.true&is_online=eq.true');

    // =====================================================
    // ORDER STATISTICS
    // =====================================================

    const allOrdersUrl = `${supabaseUrl}/rest/v1/orders?select=status,final_amount,placed_at`;
    const allOrdersResponse = await fetch(allOrdersUrl, {
      headers: {
        'apikey': supabaseKey,
        'Authorization': `Bearer ${supabaseKey}`,
      },
    });
    const allOrders = await allOrdersResponse.json();

    const totalOrders = allOrders?.length || 0;
    const totalRevenue = allOrders?.filter(o => o.status === 'DELIVERED').reduce((sum, o) => sum + (o.final_amount || 0), 0) || 0;

    const deliveredOrders = allOrders?.filter(o => o.status === 'DELIVERED').length || 0;
    const pendingOrders = allOrders?.filter(o => o.status === 'PENDING').length || 0;
    const cancelledOrders = allOrders?.filter(o => o.status === 'CANCELLED').length || 0;
    const rtoOrders = allOrders?.filter(o => o.status === 'RTO').length || 0;
    const shippedOrders = allOrders?.filter(o => o.status === 'SHIPPED').length || 0;

    // Period orders
    const periodOrders = allOrders?.filter(o => new Date(o.placed_at) >= startDate) || [];
    const periodRevenue = periodOrders.filter(o => o.status === 'DELIVERED').reduce((sum, o) => sum + (o.final_amount || 0), 0) || 0;
    const periodOrdersCount = periodOrders.length;

    // Today's orders
    const todayOrders = allOrders?.filter(o => o.placed_at?.split('T')[0] === todayStr) || [];
    const todayRevenue = todayOrders.filter(o => o.status === 'DELIVERED').reduce((sum, o) => sum + (o.final_amount || 0), 0) || 0;

    // Order stats for chart (last 7 days)
    const last7Days = [];
    for (let i = 6; i >= 0; i--) {
      const date = new Date();
      date.setDate(date.getDate() - i);
      const dateStr = date.toISOString().split('T')[0];
      const dayOrders = allOrders?.filter(o => o.placed_at?.split('T')[0] === dateStr) || [];
      last7Days.push({
        date: dateStr,
        orders: dayOrders.length,
        revenue: dayOrders.filter(o => o.status === 'DELIVERED').reduce((sum, o) => sum + (o.final_amount || 0), 0) || 0
      });
    }

    // =====================================================
    // PRODUCT STATISTICS
    // =====================================================

    const productsUrl = `${supabaseUrl}/rest/v1/products?select=is_active,is_approved,stock,seller_id`;
    const productsResponse = await fetch(productsUrl, {
      headers: {
        'apikey': supabaseKey,
        'Authorization': `Bearer ${supabaseKey}`,
      },
    });
    const allProducts = await productsResponse.json();

    const totalProducts = allProducts?.length || 0;
    const activeProducts = allProducts?.filter(p => p.is_active === true).length || 0;
    const pendingApprovalProducts = allProducts?.filter(p => p.is_approved === false).length || 0;
    const outOfStockProducts = allProducts?.filter(p => p.stock === 0).length || 0;

    // Get top selling products
    const orderItemsUrl = `${supabaseUrl}/rest/v1/order_items?select=prod_id,quantity,products(name,images,selling_price)&limit=100`;
    const orderItemsResponse = await fetch(orderItemsUrl, {
      headers: {
        'apikey': supabaseKey,
        'Authorization': `Bearer ${supabaseKey}`,
      },
    });
    const topItems = await orderItemsResponse.json();

    const productSales = {};
    topItems?.forEach(item => {
      if (productSales[item.prod_id]) {
        productSales[item.prod_id].quantity += item.quantity;
      } else {
        productSales[item.prod_id] = {
          prod_id: item.prod_id,
          name: item.products?.name,
          image: item.products?.images?.[0] || null,
          price: item.products?.selling_price,
          quantity: item.quantity
        };
      }
    });

    const topSellingProducts = Object.values(productSales)
      .sort((a, b) => b.quantity - a.quantity)
      .slice(0, 10);

    // =====================================================
    // FINANCE STATISTICS
    // =====================================================

    const pendingSellerPayoutsUrl = `${supabaseUrl}/rest/v1/payouts?select=amount&user_type=eq.seller&status=eq.PENDING`;
    const pendingSellerPayoutsResponse = await fetch(pendingSellerPayoutsUrl, {
      headers: {
        'apikey': supabaseKey,
        'Authorization': `Bearer ${supabaseKey}`,
      },
    });
    const pendingSellerPayouts = await pendingSellerPayoutsResponse.json();

    const pendingRiderPayoutsUrl = `${supabaseUrl}/rest/v1/payouts?select=amount&user_type=eq.rider&status=eq.PENDING`;
    const pendingRiderPayoutsResponse = await fetch(pendingRiderPayoutsUrl, {
      headers: {
        'apikey': supabaseKey,
        'Authorization': `Bearer ${supabaseKey}`,
      },
    });
    const pendingRiderPayouts = await pendingRiderPayoutsResponse.json();

    const totalPendingPayouts = (pendingSellerPayouts?.reduce((sum, p) => sum + p.amount, 0) || 0) +
                                (pendingRiderPayouts?.reduce((sum, p) => sum + p.amount, 0) || 0);

    const totalCommission = totalRevenue * 0.10;
    const rtoAmount = allOrders?.filter(o => o.status === 'RTO').reduce((sum, o) => sum + (o.final_amount || 0), 0) || 0;

    // Wallet balances
    const customerWalletsUrl = `${supabaseUrl}/rest/v1/customers?select=wallet_balance`;
    const customerWalletsResponse = await fetch(customerWalletsUrl, {
      headers: {
        'apikey': supabaseKey,
        'Authorization': `Bearer ${supabaseKey}`,
      },
    });
    const customerWallets = await customerWalletsResponse.json();
    const totalCustomerWallet = customerWallets?.reduce((sum, c) => sum + (c.wallet_balance || 0), 0) || 0;

    const sellerWalletsUrl = `${supabaseUrl}/rest/v1/sellers?select=wallet_balance`;
    const sellerWalletsResponse = await fetch(sellerWalletsUrl, {
      headers: {
        'apikey': supabaseKey,
        'Authorization': `Bearer ${supabaseKey}`,
      },
    });
    const sellerWallets = await sellerWalletsResponse.json();
    const totalSellerWallet = sellerWallets?.reduce((sum, s) => sum + (s.wallet_balance || 0), 0) || 0;

    const riderWalletsUrl = `${supabaseUrl}/rest/v1/riders?select=wallet_balance`;
    const riderWalletsResponse = await fetch(riderWalletsUrl, {
      headers: {
        'apikey': supabaseKey,
        'Authorization': `Bearer ${supabaseKey}`,
      },
    });
    const riderWallets = await riderWalletsResponse.json();
    const totalRiderWallet = riderWallets?.reduce((sum, r) => sum + (r.wallet_balance || 0), 0) || 0;

    // =====================================================
    // LOGISTICS STATISTICS
    // =====================================================

    const runsheetsUrl = `${supabaseUrl}/rest/v1/runsheets?select=status,total_deliveries`;
    const runsheetsResponse = await fetch(runsheetsUrl, {
      headers: {
        'apikey': supabaseKey,
        'Authorization': `Bearer ${supabaseKey}`,
      },
    });
    const runsheets = await runsheetsResponse.json();

    const totalRunsheets = runsheets?.length || 0;
    const completedRunsheets = runsheets?.filter(r => r.status === 'COMPLETED').length || 0;
    const totalDeliveriesByRiders = runsheets?.reduce((sum, r) => sum + (r.total_deliveries || 0), 0) || 0;

    // =====================================================
    // ALERTS
    // =====================================================

    const alerts = [];

    if (pendingApprovalProducts > 0) {
      alerts.push({
        type: 'warning',
        title: 'Products Pending Approval',
        message: `${pendingApprovalProducts} products are waiting for your approval`,
        action: '/owner/catalog/approve-products'
      });
    }

    if (outOfStockProducts > 0) {
      alerts.push({
        type: 'info',
        title: 'Out of Stock Products',
        message: `${outOfStockProducts} products are out of stock`,
        action: '/owner/catalog/products'
      });
    }

    if (totalPendingPayouts > 10000) {
      alerts.push({
        type: 'danger',
        title: 'High Pending Payouts',
        message: `Total pending payouts: ₹${totalPendingPayouts.toLocaleString()}`,
        action: '/owner/finance/payouts'
      });
    }

    if (rtoAmount > 50000) {
      alerts.push({
        type: 'warning',
        title: 'High RTO Loss',
        message: `Total RTO loss: ₹${rtoAmount.toLocaleString()}`,
        action: '/owner/reports/rto'
      });
    }

    // Get recent activities
    const recentOrdersUrl = `${supabaseUrl}/rest/v1/orders?select=book_id,final_amount,status,placed_at,customers(name)&order=placed_at.desc&limit=10`;
    const recentOrdersResponse = await fetch(recentOrdersUrl, {
      headers: {
        'apikey': supabaseKey,
        'Authorization': `Bearer ${supabaseKey}`,
      },
    });
    const recentOrders = await recentOrdersResponse.json();

    const recentSellersUrl = `${supabaseUrl}/rest/v1/sellers?select=seller_id,shop_name,kyc_status,created_at&order=created_at.desc&limit=10`;
    const recentSellersResponse = await fetch(recentSellersUrl, {
      headers: {
        'apikey': supabaseKey,
        'Authorization': `Bearer ${supabaseKey}`,
      },
    });
    const recentSellers = await recentSellersResponse.json();

    const recentTicketsUrl = `${supabaseUrl}/rest/v1/support_tickets?select=ticket_id,subject,status,priority,created_at&status=eq.OPEN&order=created_at.desc&limit=10`;
    const recentTicketsResponse = await fetch(recentTicketsUrl, {
      headers: {
        'apikey': supabaseKey,
        'Authorization': `Bearer ${supabaseKey}`,
      },
    });
    const recentTickets = await recentTicketsResponse.json();

    return new Response(JSON.stringify({
      success: true,
      owner: {
        owner_id: 'OWN001',
        period: period
      },
      dashboard: {
        users: {
          total_customers: totalCustomers,
          total_sellers: totalSellers,
          total_riders: totalRiders,
          total_hubs: totalHubs,
          new_customers: newCustomers,
          new_sellers: newSellers,
          new_riders: newRiders,
          active_customers: activeCustomers,
          active_sellers: activeSellers,
          active_riders: activeRiders
        },
        orders: {
          total: totalOrders,
          delivered: deliveredOrders,
          pending: pendingOrders,
          cancelled: cancelledOrders,
          rto: rtoOrders,
          shipped: shippedOrders,
          today_orders: todayOrders.length,
          today_revenue: todayRevenue,
          period_orders: periodOrdersCount,
          period_revenue: periodRevenue,
          daily_trends: last7Days
        },
        products: {
          total: totalProducts,
          active: activeProducts,
          pending_approval: pendingApprovalProducts,
          out_of_stock: outOfStockProducts,
          top_selling: topSellingProducts
        },
        finance: {
          total_revenue: totalRevenue,
          total_commission: Math.round(totalCommission),
          rto_loss: rtoAmount,
          pending_payouts: totalPendingPayouts,
          wallet_balances: {
            customers: totalCustomerWallet,
            sellers: totalSellerWallet,
            riders: totalRiderWallet,
            total: totalCustomerWallet + totalSellerWallet + totalRiderWallet
          }
        },
        logistics: {
          total_runsheets: totalRunsheets,
          completed_runsheets: completedRunsheets,
          completion_rate: totalRunsheets > 0 ? (completedRunsheets / totalRunsheets) * 100 : 0,
          total_deliveries: totalDeliveriesByRiders
        },
        alerts: alerts,
        recent_activity: {
          orders: recentOrders?.map(o => ({
            book_id: o.book_id,
            amount: o.final_amount,
            status: o.status,
            customer_name: o.customers?.name,
            placed_at: o.placed_at
          })) || [],
          sellers: recentSellers || [],
          support_tickets: recentTickets || []
        }
      },
      last_updated: new Date().toISOString()
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json', ...corsHeaders }
    });

  } catch (error) {
    console.error('Owner dashboard error:', error);
    return new Response(JSON.stringify({
      success: false,
      error: error.message || 'Internal server error'
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json', ...corsHeaders }
    });
  }
}