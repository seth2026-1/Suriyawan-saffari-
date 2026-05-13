// api/owner/reports/sales.js
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
    const report_type = url.searchParams.get('report_type') || 'summary';
    const from_date = url.searchParams.get('from_date');
    const to_date = url.searchParams.get('to_date');
    const seller_id = url.searchParams.get('seller_id');
    const category_id = url.searchParams.get('category_id');
    const group_by = url.searchParams.get('group_by') || 'day';
    const export_format = url.searchParams.get('export_format') || 'json';
    const page = parseInt(url.searchParams.get('page') || '1');
    const limit = parseInt(url.searchParams.get('limit') || '100');

    const supabase = createSupabaseClient();
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

    // Set date range
    let startDate, endDate;
    if (from_date && to_date) {
      startDate = new Date(from_date);
      endDate = new Date(to_date);
    } else {
      const now = new Date();
      startDate = new Date(now.getFullYear(), now.getMonth(), 1);
      endDate = new Date();
    }

    const startDateStr = startDate.toISOString();
    const endDateStr = endDate.toISOString();

    // Base query for delivered orders with nested relations
    const ordersSelect = `book_id,final_amount,delivery_charge,discount_amount,status,placed_at,delivered_at,seller_id,sellers!inner(seller_id,shop_name,commission_rate),order_items(quantity,price_at_time,products!inner(prod_id,name,category_id,categories!inner(cat_id,name)))`;
    let ordersUrl = `${supabaseUrl}/rest/v1/orders?select=${encodeURIComponent(ordersSelect)}&status=eq.DELIVERED&delivered_at=gte.${startDateStr}&delivered_at=lte.${endDateStr}`;

    if (seller_id) {
      ordersUrl += `&seller_id=eq.${seller_id}`;
    }

    const ordersResponse = await fetch(ordersUrl, {
      headers: {
        'apikey': supabaseKey,
        'Authorization': `Bearer ${supabaseKey}`,
      },
    });
    const orders = await ordersResponse.json();

    // =====================================================
    // SUMMARY REPORT
    // =====================================================
    if (report_type === 'summary') {
      const totalRevenue = orders?.reduce((sum, o) => sum + (o.final_amount || 0), 0) || 0;
      const totalOrders = orders?.length || 0;
      const totalDeliveryCharge = orders?.reduce((sum, o) => sum + (o.delivery_charge || 0), 0) || 0;
      const totalDiscount = orders?.reduce((sum, o) => sum + (o.discount_amount || 0), 0) || 0;
      const averageOrderValue = totalOrders > 0 ? totalRevenue / totalOrders : 0;

      // Previous period comparison
      const duration = endDate - startDate;
      const prevStartDate = new Date(startDate);
      prevStartDate.setDate(prevStartDate.getDate() - Math.ceil(duration / (1000 * 60 * 60 * 24)));
      const prevEndDate = new Date(startDate);
      prevEndDate.setDate(prevEndDate.getDate() - 1);

      const prevUrl = `${supabaseUrl}/rest/v1/orders?select=final_amount&status=eq.DELIVERED&delivered_at=gte.${prevStartDate.toISOString()}&delivered_at=lte.${prevEndDate.toISOString()}`;
      const prevResponse = await fetch(prevUrl, {
        headers: {
          'apikey': supabaseKey,
          'Authorization': `Bearer ${supabaseKey}`,
        },
      });
      const prevOrders = await prevResponse.json();
      const prevRevenue = prevOrders?.reduce((sum, o) => sum + (o.final_amount || 0), 0) || 0;
      const revenueGrowth = prevRevenue > 0 ? ((totalRevenue - prevRevenue) / prevRevenue) * 100 : 0;

      // Seller-wise summary
      const sellerWiseSales = {};
      orders?.forEach(order => {
        const sellerId = order.seller_id;
        if (!sellerWiseSales[sellerId]) {
          sellerWiseSales[sellerId] = {
            seller_id: sellerId,
            shop_name: order.sellers?.shop_name,
            revenue: 0,
            orders: 0,
            commission: 0
          };
        }
        sellerWiseSales[sellerId].revenue += order.final_amount;
        sellerWiseSales[sellerId].orders++;
        sellerWiseSales[sellerId].commission += (order.final_amount * (order.sellers?.commission_rate || 10)) / 100;
      });

      // Category-wise summary
      const categoryWiseSales = {};
      orders?.forEach(order => {
        (order.order_items || []).forEach(item => {
          const categoryId = item.products?.category_id;
          const categoryName = item.products?.categories?.name;
          if (categoryId) {
            if (!categoryWiseSales[categoryId]) {
              categoryWiseSales[categoryId] = {
                category_id: categoryId,
                category_name: categoryName,
                revenue: 0,
                quantity: 0,
                orders: 0
              };
            }
            categoryWiseSales[categoryId].revenue += item.price_at_time * item.quantity;
            categoryWiseSales[categoryId].quantity += item.quantity;
            categoryWiseSales[categoryId].orders++;
          }
        });
      });

      // Daily/Monthly breakdown
      const breakdown = [];
      const currentDate = new Date(startDate);

      while (currentDate <= endDate) {
        const periodStart = new Date(currentDate);
        let periodEnd;

        if (group_by === 'day') {
          periodEnd = new Date(currentDate);
          periodEnd.setHours(23, 59, 59, 999);
          currentDate.setDate(currentDate.getDate() + 1);
        } else if (group_by === 'week') {
          periodEnd = new Date(currentDate);
          periodEnd.setDate(periodEnd.getDate() + 6);
          currentDate.setDate(currentDate.getDate() + 7);
        } else {
          periodEnd = new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 0);
          currentDate.setMonth(currentDate.getMonth() + 1);
        }

        const periodOrders = orders?.filter(o => {
          const deliveredDate = new Date(o.delivered_at);
          return deliveredDate >= periodStart && deliveredDate <= periodEnd;
        }) || [];

        const periodRevenue = periodOrders.reduce((sum, o) => sum + (o.final_amount || 0), 0);
        const periodOrdersCount = periodOrders.length;

        breakdown.push({
          period: periodStart.toISOString().split('T')[0],
          revenue: periodRevenue,
          orders: periodOrdersCount,
          average_order_value: periodOrdersCount > 0 ? periodRevenue / periodOrdersCount : 0
        });
      }

      if (export_format === 'csv') {
        const csvData = [
          ['Metric', 'Value'],
          ['Total Revenue', totalRevenue],
          ['Total Orders', totalOrders],
          ['Average Order Value', averageOrderValue.toFixed(2)],
          ['Total Delivery Charge', totalDeliveryCharge],
          ['Total Discount', totalDiscount],
          ['Revenue Growth (%)', revenueGrowth.toFixed(2)],
          [''],
          ['Seller Wise Sales'],
          ['Seller Name', 'Revenue', 'Orders', 'Commission'],
          ...Object.values(sellerWiseSales).map(s => [s.shop_name, s.revenue, s.orders, s.commission.toFixed(2)]),
          [''],
          ['Category Wise Sales'],
          ['Category Name', 'Revenue', 'Quantity', 'Orders'],
          ...Object.values(categoryWiseSales).map(c => [c.category_name, c.revenue.toFixed(2), c.quantity, c.orders])
        ];

        const csvString = csvData.map(row => row.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(',')).join('\n');
        return new Response(csvString, {
          status: 200,
          headers: {
            'Content-Type': 'text/csv',
            'Content-Disposition': `attachment; filename=sales_report_${startDateStr.split('T')[0]}_${endDateStr.split('T')[0]}.csv`,
            ...corsHeaders
          }
        });
      }

      return new Response(JSON.stringify({
        success: true,
        report_type: 'summary',
        period: {
          from: startDateStr.split('T')[0],
          to: endDateStr.split('T')[0]
        },
        summary: {
          total_revenue: totalRevenue,
          total_orders: totalOrders,
          average_order_value: averageOrderValue.toFixed(2),
          total_delivery_charge: totalDeliveryCharge,
          total_discount: totalDiscount,
          revenue_growth: revenueGrowth.toFixed(2),
          previous_period_revenue: prevRevenue
        },
        seller_wise: Object.values(sellerWiseSales),
        category_wise: Object.values(categoryWiseSales),
        breakdown: breakdown,
        generated_at: new Date().toISOString()
      }), {
        status: 200,
        headers: { 'Content-Type': 'application/json', ...corsHeaders }
      });
    }

    // =====================================================
    // DETAILED REPORT
    // =====================================================
    if (report_type === 'detailed') {
      const from = (page - 1) * limit;
      const to = from + limit - 1;

      const detailedOrders = orders?.slice(from, to).map(order => ({
        book_id: order.book_id,
        order_date: order.placed_at,
        delivered_date: order.delivered_at,
        final_amount: order.final_amount,
        delivery_charge: order.delivery_charge,
        discount: order.discount_amount,
        seller: {
          seller_id: order.sellers?.seller_id,
          shop_name: order.sellers?.shop_name,
          commission_rate: order.sellers?.commission_rate
        },
        items: (order.order_items || []).map(item => ({
          prod_id: item.products?.prod_id,
          name: item.products?.name,
          quantity: item.quantity,
          price: item.price_at_time,
          total: item.price_at_time * item.quantity,
          category: item.products?.categories?.name
        }))
      })) || [];

      if (export_format === 'csv') {
        const csvData = [
          ['Order ID', 'Order Date', 'Delivered Date', 'Amount', 'Delivery Charge', 'Discount', 'Seller', 'Items'],
          ...detailedOrders.map(o => [
            o.book_id,
            o.order_date,
            o.delivered_date,
            o.final_amount,
            o.delivery_charge,
            o.discount,
            o.seller?.shop_name,
            o.items.map(i => `${i.name} x${i.quantity}`).join('; ')
          ])
        ];

        const csvString = csvData.map(row => row.map(cell => `"${String(cell || '').replace(/"/g, '""')}"`).join(',')).join('\n');
        return new Response(csvString, {
          status: 200,
          headers: {
            'Content-Type': 'text/csv',
            'Content-Disposition': `attachment; filename=detailed_sales_${startDateStr.split('T')[0]}_${endDateStr.split('T')[0]}.csv`,
            ...corsHeaders
          }
        });
      }

      return new Response(JSON.stringify({
        success: true,
        report_type: 'detailed',
        period: {
          from: startDateStr.split('T')[0],
          to: endDateStr.split('T')[0]
        },
        orders: detailedOrders,
        total_count: orders?.length || 0,
        pagination: {
          current_page: page,
          total_pages: Math.ceil((orders?.length || 0) / limit),
          total_items: orders?.length || 0,
          items_per_page: limit
        },
        generated_at: new Date().toISOString()
      }), {
        status: 200,
        headers: { 'Content-Type': 'application/json', ...corsHeaders }
      });
    }

    // =====================================================
    // PRODUCT SALES REPORT
    // =====================================================
    if (report_type === 'product') {
      const productSales = {};

      orders?.forEach(order => {
        (order.order_items || []).forEach(item => {
          const prodId = item.products?.prod_id;
          if (!productSales[prodId]) {
            productSales[prodId] = {
              prod_id: prodId,
              name: item.products?.name,
              category: item.products?.categories?.name,
              quantity_sold: 0,
              revenue: 0,
              orders_count: 0
            };
          }
          productSales[prodId].quantity_sold += item.quantity;
          productSales[prodId].revenue += item.price_at_time * item.quantity;
          productSales[prodId].orders_count++;
        });
      });

      const topProducts = Object.values(productSales)
        .sort((a, b) => b.revenue - a.revenue)
        .slice(0, 50);

      if (export_format === 'csv') {
        const csvData = [
          ['Product ID', 'Product Name', 'Category', 'Quantity Sold', 'Revenue', 'Orders Count'],
          ...topProducts.map(p => [p.prod_id, p.name, p.category, p.quantity_sold, p.revenue.toFixed(2), p.orders_count])
        ];

        const csvString = csvData.map(row => row.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(',')).join('\n');
        return new Response(csvString, {
          status: 200,
          headers: {
            'Content-Type': 'text/csv',
            'Content-Disposition': `attachment; filename=product_sales_${startDateStr.split('T')[0]}_${endDateStr.split('T')[0]}.csv`,
            ...corsHeaders
          }
        });
      }

      return new Response(JSON.stringify({
        success: true,
        report_type: 'product',
        period: {
          from: startDateStr.split('T')[0],
          to: endDateStr.split('T')[0]
        },
        top_products: topProducts,
        total_products_sold: Object.values(productSales).reduce((sum, p) => sum + p.quantity_sold, 0),
        total_revenue: Object.values(productSales).reduce((sum, p) => sum + p.revenue, 0),
        generated_at: new Date().toISOString()
      }), {
        status: 200,
        headers: { 'Content-Type': 'application/json', ...corsHeaders }
      });
    }

    return new Response(JSON.stringify({ success: false, error: 'Invalid report type' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json', ...corsHeaders }
    });

  } catch (error) {
    console.error('Sales report error:', error);
    return new Response(JSON.stringify({
      success: false,
      error: error.message || 'Internal server error'
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json', ...corsHeaders }
    });
  }
}