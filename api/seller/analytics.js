// api/seller/analytics.js
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
    const period = url.searchParams.get('period') || 'month';
    const start_date = url.searchParams.get('start_date');
    const end_date = url.searchParams.get('end_date');

    if (!seller_id) {
      return new Response(
        JSON.stringify({ success: false, error: 'Seller ID is required' }),
        { status: 400, headers: { 'Content-Type': 'application/json', ...corsHeaders } }
      );
    }

    const supabase = createSupabaseClient();
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

    // Date range based on period
    let startDate, endDate;
    const now = new Date();

    if (start_date && end_date) {
      startDate = new Date(start_date);
      endDate = new Date(end_date);
    } else {
      switch (period) {
        case 'today':
          startDate = new Date();
          startDate.setHours(0, 0, 0, 0);
          endDate = new Date();
          break;
        case 'week':
          startDate = new Date();
          startDate.setDate(startDate.getDate() - 7);
          endDate = new Date();
          break;
        case 'month':
          startDate = new Date(now.getFullYear(), now.getMonth(), 1);
          endDate = new Date();
          break;
        case 'year':
          startDate = new Date(now.getFullYear(), 0, 1);
          endDate = new Date();
          break;
        default:
          startDate = new Date();
          startDate.setMonth(startDate.getMonth() - 1);
          endDate = new Date();
      }
    }

    const startDateStr = startDate.toISOString();
    const endDateStr = endDate.toISOString();

    // Get seller details
    const sellerResult = await supabase
      .from('sellers')
      .select('seller_id, shop_name, commission_rate, rating, total_sales')
      .eq('seller_id', seller_id)
      .single();

    if (sellerResult.error || !sellerResult.data) {
      return new Response(
        JSON.stringify({ success: false, error: 'Seller not found' }),
        { status: 404, headers: { 'Content-Type': 'application/json', ...corsHeaders } }
      );
    }

    const seller = sellerResult.data;

    // =====================================================
    // ORDER ANALYTICS
    // =====================================================

    const ordersUrl = `${supabaseUrl}/rest/v1/orders?select=*&seller_id=eq.${seller_id}&placed_at=gte.${startDateStr}&placed_at=lte.${endDateStr}`;
    const ordersResponse = await fetch(ordersUrl, {
      headers: {
        'apikey': supabaseKey,
        'Authorization': `Bearer ${supabaseKey}`,
      },
    });
    const orders = await ordersResponse.json();

    const totalOrders = orders?.length || 0;
    const deliveredOrders = orders?.filter(o => o.status === 'DELIVERED') || [];
    const cancelledOrders = orders?.filter(o => o.status === 'CANCELLED') || [];
    const rtoOrders = orders?.filter(o => o.status === 'RTO') || [];
    const pendingOrders = orders?.filter(o => o.status === 'PENDING') || [];

    const totalRevenue = deliveredOrders.reduce((sum, o) => sum + (o.final_amount || 0), 0);
    const totalCommission = totalRevenue * (seller.commission_rate / 100);
    const netEarnings = totalRevenue - totalCommission;
    const rtoLoss = rtoOrders.reduce((sum, o) => sum + (o.final_amount || 0), 0);

    const averageOrderValue = totalOrders > 0 ? totalRevenue / totalOrders : 0;

    // =====================================================
    // PRODUCT ANALYTICS
    // =====================================================

    const productsUrl = `${supabaseUrl}/rest/v1/products?select=*&seller_id=eq.${seller_id}`;
    const productsResponse = await fetch(productsUrl, {
      headers: {
        'apikey': supabaseKey,
        'Authorization': `Bearer ${supabaseKey}`,
      },
    });
    const products = await productsResponse.json();

    const totalProducts = products?.length || 0;
    const activeProducts = products?.filter(p => p.is_active === true).length || 0;
    const outOfStockProducts = products?.filter(p => p.stock === 0).length || 0;

    // Get order items for product sales
    const orderIds = orders?.map(o => o.book_id).filter(Boolean) || [];
    let productSales = {};
    
    if (orderIds.length > 0) {
      const orderItemsUrl = `${supabaseUrl}/rest/v1/order_items?select=quantity,price_at_time,products!inner(prod_id,name,selling_price,mrp,images)&book_id=in.(${orderIds.join(',')})`;
      const orderItemsResponse = await fetch(orderItemsUrl, {
        headers: {
          'apikey': supabaseKey,
          'Authorization': `Bearer ${supabaseKey}`,
        },
      });
      const orderItems = await orderItemsResponse.json();

      orderItems?.forEach(item => {
        const prodId = item.products.prod_id;
        if (!productSales[prodId]) {
          productSales[prodId] = {
            prod_id: prodId,
            name: item.products.name,
            selling_price: item.products.selling_price,
            mrp: item.products.mrp,
            image: item.products.images?.[0] || null,
            quantity_sold: 0,
            revenue: 0
          };
        }
        productSales[prodId].quantity_sold += item.quantity;
        productSales[prodId].revenue += item.price_at_time * item.quantity;
      });
    }

    const topProducts = Object.values(productSales)
      .sort((a, b) => b.revenue - a.revenue)
      .slice(0, 10);

    // =====================================================
    // DAILY SALES CHART
    // =====================================================

    const dailySales = [];
    const currentDate = new Date(startDate);
    while (currentDate <= endDate) {
      const dateStr = currentDate.toISOString().split('T')[0];
      const dayOrders = orders?.filter(o => o.placed_at?.split('T')[0] === dateStr) || [];
      const dayRevenue = dayOrders.filter(o => o.status === 'DELIVERED').reduce((sum, o) => sum + (o.final_amount || 0), 0);

      dailySales.push({
        date: dateStr,
        orders: dayOrders.length,
        revenue: dayRevenue,
        cancelled: dayOrders.filter(o => o.status === 'CANCELLED').length,
        rto: dayOrders.filter(o => o.status === 'RTO').length
      });

      currentDate.setDate(currentDate.getDate() + 1);
    }

    // =====================================================
    // CUSTOMER ANALYTICS
    // =====================================================

    const uniqueCustomers = new Set(orders?.map(o => o.cust_id)).size;
    
    // Calculate returning customers
    const customerOrderCounts = new Map();
    orders?.forEach(o => {
      const count = customerOrderCounts.get(o.cust_id) || 0;
      customerOrderCounts.set(o.cust_id, count + 1);
    });
    
    const returningCustomerCount = Array.from(customerOrderCounts.values()).filter(count => count > 1).length;

    // =====================================================
    // CATEGORY ANALYTICS
    // =====================================================
    
    let categoryRevenue = {};
    if (orderIds.length > 0) {
      const categoryItemsUrl = `${supabaseUrl}/rest/v1/order_items?select=quantity,price_at_time,products!inner(category_id,categories!inner(name))&book_id=in.(${orderIds.join(',')})`;
      const categoryItemsResponse = await fetch(categoryItemsUrl, {
        headers: {
          'apikey': supabaseKey,
          'Authorization': `Bearer ${supabaseKey}`,
        },
      });
      const categoryItems = await categoryItemsResponse.json();

      categoryItems?.forEach(item => {
        const catName = item.products?.categories?.name || 'Uncategorized';
        if (!categoryRevenue[catName]) {
          categoryRevenue[catName] = {
            name: catName,
            revenue: 0,
            quantity: 0
          };
        }
        categoryRevenue[catName].revenue += item.price_at_time * item.quantity;
        categoryRevenue[catName].quantity += item.quantity;
      });
    }

    const topCategories = Object.values(categoryRevenue)
      .sort((a, b) => b.revenue - a.revenue)
      .slice(0, 5);

    // =====================================================
    // GROWTH RATES
    // =====================================================

    const previousPeriodStart = new Date(startDate);
    previousPeriodStart.setMonth(previousPeriodStart.getMonth() - 1);
    const previousPeriodEnd = new Date(startDate);
    previousPeriodEnd.setDate(previousPeriodEnd.getDate() - 1);

    const prevPeriodStartStr = previousPeriodStart.toISOString();
    const prevPeriodEndStr = previousPeriodEnd.toISOString();

    const previousOrdersUrl = `${supabaseUrl}/rest/v1/orders?select=*&seller_id=eq.${seller_id}&placed_at=gte.${prevPeriodStartStr}&placed_at=lte.${prevPeriodEndStr}`;
    const previousOrdersResponse = await fetch(previousOrdersUrl, {
      headers: {
        'apikey': supabaseKey,
        'Authorization': `Bearer ${supabaseKey}`,
      },
    });
    const previousOrders = await previousOrdersResponse.json();

    const previousRevenue = previousOrders?.filter(o => o.status === 'DELIVERED').reduce((sum, o) => sum + (o.final_amount || 0), 0) || 0;
    const previousOrdersCount = previousOrders?.length || 0;

    const revenueGrowth = previousRevenue > 0 ? ((totalRevenue - previousRevenue) / previousRevenue) * 100 : 0;
    const ordersGrowth = previousOrdersCount > 0 ? ((totalOrders - previousOrdersCount) / previousOrdersCount) * 100 : 0;

    // =====================================================
    // RTO ANALYSIS
    // =====================================================

    const rtoRate = totalOrders > 0 ? (rtoOrders.length / totalOrders) * 100 : 0;

    // RTO by reason
    const rtoByReason = {};
    rtoOrders.forEach(order => {
      const reason = order.cancel_reason || 'Unknown';
      rtoByReason[reason] = (rtoByReason[reason] || 0) + 1;
    });

    // =====================================================
    // PERFORMANCE SUMMARY
    // =====================================================

    const performanceSummary = {
      shop_name: seller.shop_name,
      rating: seller.rating || 0,
      total_sales: seller.total_sales || 0,
      period: period,
      date_range: {
        from: startDateStr,
        to: endDateStr
      },
      revenue: {
        total: Math.round(totalRevenue),
        commission: Math.round(totalCommission),
        net: Math.round(netEarnings),
        rto_loss: Math.round(rtoLoss),
        growth: parseFloat(revenueGrowth.toFixed(2))
      },
      orders: {
        total: totalOrders,
        delivered: deliveredOrders.length,
        pending: pendingOrders.length,
        cancelled: cancelledOrders.length,
        rto: rtoOrders.length,
        growth: parseFloat(ordersGrowth.toFixed(2)),
        average_order_value: Math.round(averageOrderValue)
      },
      products: {
        total: totalProducts,
        active: activeProducts,
        out_of_stock: outOfStockProducts,
        top_selling: topProducts
      },
      customers: {
        unique: uniqueCustomers,
        returning: returningCustomerCount,
        repeat_rate: uniqueCustomers > 0 ? (returningCustomerCount / uniqueCustomers) * 100 : 0
      },
      rto_analysis: {
        rto_rate: parseFloat(rtoRate.toFixed(2)),
        total_rto_amount: Math.round(rtoLoss),
        rto_by_reason: rtoByReason
      },
      category_breakdown: topCategories,
      daily_trends: dailySales
    };

    return new Response(
      JSON.stringify({
        success: true,
        analytics: performanceSummary,
        export_url: `/api/seller/analytics/export?seller_id=${seller_id}&start_date=${startDateStr}&end_date=${endDateStr}`,
        last_updated: new Date().toISOString()
      }),
      { status: 200, headers: { 'Content-Type': 'application/json', ...corsHeaders } }
    );

  } catch (error) {
    console.error('Seller analytics error:', error);
    return new Response(
      JSON.stringify({
        success: false,
        error: error.message || 'Internal server error'
      }),
      { status: 500, headers: { 'Content-Type': 'application/json', ...corsHeaders } }
    );
  }
}