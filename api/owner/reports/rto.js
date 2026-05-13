// api/owner/reports/rto.js
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
      },
      fromWithCount: (table, countOnly = false) => ({
        eq: (field, value) => ({
          gte: (gteField, gteValue) => ({
            lte: (lteField, lteValue) => ({
              select: async () => {
                let url = `${supabaseUrl}/rest/v1/${table}?${field}=eq.${value}&${gteField}=gte.${gteValue}&${lteField}=lte.${lteValue}`;
                if (countOnly) {
                  const response = await fetch(url, {
                    method: 'HEAD',
                    headers: {
                      'apikey': supabaseKey,
                      'Authorization': `Bearer ${supabaseKey}`,
                    },
                  });
                  const count = response.headers.get('content-range')?.split('/')[1];
                  return { count: count ? parseInt(count) : 0, error: null };
                }
                const response = await fetch(url, {
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
    const pincode = url.searchParams.get('pincode');
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

    // Get RTO orders with nested relations
    const rtoSelect = `book_id,final_amount,delivery_charge,cancel_reason,cancelled_at,placed_at,seller_id,cust_id,address,sellers!inner(seller_id,shop_name,commission_rate),customers!inner(cust_id,name,mobile),order_items(quantity,price_at_time,products!inner(prod_id,name,category_id))`;
    let rtoUrl = `${supabaseUrl}/rest/v1/orders?select=${encodeURIComponent(rtoSelect)}&status=eq.RTO&cancelled_at=gte.${startDateStr}&cancelled_at=lte.${endDateStr}`;

    if (seller_id) {
      rtoUrl += `&seller_id=eq.${seller_id}`;
    }

    const rtoResponse = await fetch(rtoUrl, {
      headers: {
        'apikey': supabaseKey,
        'Authorization': `Bearer ${supabaseKey}`,
      },
    });
    const rtoOrders = await rtoResponse.json();

    // =====================================================
    // SUMMARY REPORT
    // =====================================================
    if (report_type === 'summary') {
      const totalRtoCount = rtoOrders?.length || 0;
      const totalRtoAmount = rtoOrders?.reduce((sum, o) => sum + (o.final_amount || 0), 0) || 0;
      const totalDeliveryChargeLost = rtoOrders?.reduce((sum, o) => sum + (o.delivery_charge || 0), 0) || 0;
      const averageRtoValue = totalRtoCount > 0 ? totalRtoAmount / totalRtoCount : 0;

      // Previous period comparison
      const duration = endDate - startDate;
      const prevStartDate = new Date(startDate);
      prevStartDate.setDate(prevStartDate.getDate() - Math.ceil(duration / (1000 * 60 * 60 * 24)));
      const prevEndDate = new Date(startDate);
      prevEndDate.setDate(prevEndDate.getDate() - 1);

      const prevUrl = `${supabaseUrl}/rest/v1/orders?select=final_amount&status=eq.RTO&cancelled_at=gte.${prevStartDate.toISOString()}&cancelled_at=lte.${prevEndDate.toISOString()}`;
      const prevResponse = await fetch(prevUrl, {
        headers: {
          'apikey': supabaseKey,
          'Authorization': `Bearer ${supabaseKey}`,
        },
      });
      const prevRtoOrders = await prevResponse.json();
      const prevRtoCount = prevRtoOrders?.length || 0;
      const rtoGrowth = prevRtoCount > 0 ? ((totalRtoCount - prevRtoCount) / prevRtoCount) * 100 : 0;

      // RTO by reason
      const reasonWiseRto = {};
      rtoOrders?.forEach(order => {
        const reason = order.cancel_reason || 'Unknown';
        reasonWiseRto[reason] = (reasonWiseRto[reason] || 0) + 1;
      });

      // Seller-wise RTO
      const sellerWiseRto = {};
      rtoOrders?.forEach(order => {
        const sellerId = order.seller_id;
        if (!sellerWiseRto[sellerId]) {
          sellerWiseRto[sellerId] = {
            seller_id: sellerId,
            shop_name: order.sellers?.shop_name,
            rto_count: 0,
            rto_amount: 0,
            rto_rate: 0
          };
        }
        sellerWiseRto[sellerId].rto_count++;
        sellerWiseRto[sellerId].rto_amount += order.final_amount;
      });

      // Get total orders per seller to calculate RTO rate
      for (const seller of Object.values(sellerWiseRto)) {
        const totalOrdersUrl = `${supabaseUrl}/rest/v1/orders?select=book_id&seller_id=eq.${seller.seller_id}&placed_at=gte.${startDateStr}&placed_at=lte.${endDateStr}`;
        const totalOrdersResponse = await fetch(totalOrdersUrl, {
          method: 'HEAD',
          headers: {
            'apikey': supabaseKey,
            'Authorization': `Bearer ${supabaseKey}`,
          },
        });
        const totalOrdersCount = parseInt(totalOrdersResponse.headers.get('content-range')?.split('/')[1] || '1');
        seller.rto_rate = (seller.rto_count / totalOrdersCount) * 100;
      }

      // Pincode-wise RTO
      const pincodeWiseRto = {};
      rtoOrders?.forEach(order => {
        const pincodeValue = order.address?.pincode || 'Unknown';
        pincodeWiseRto[pincodeValue] = (pincodeWiseRto[pincodeValue] || 0) + 1;
      });

      // Daily/Monthly breakdown
      const breakdown = [];
      const currentDate = new Date(startDate);

      while (currentDate <= endDate) {
        const periodStart = new Date(currentDate);
        let periodEnd;
        let periodStartStr, periodEndStr;

        if (group_by === 'day') {
          periodEnd = new Date(currentDate);
          periodEnd.setHours(23, 59, 59, 999);
          periodStartStr = periodStart.toISOString();
          periodEndStr = periodEnd.toISOString();
          currentDate.setDate(currentDate.getDate() + 1);
        } else if (group_by === 'week') {
          periodEnd = new Date(currentDate);
          periodEnd.setDate(periodEnd.getDate() + 6);
          periodStartStr = periodStart.toISOString();
          periodEndStr = periodEnd.toISOString();
          currentDate.setDate(currentDate.getDate() + 7);
        } else {
          periodEnd = new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 0);
          periodStartStr = periodStart.toISOString();
          periodEndStr = periodEnd.toISOString();
          currentDate.setMonth(currentDate.getMonth() + 1);
        }

        const periodRto = rtoOrders?.filter(o => {
          const cancelledDate = new Date(o.cancelled_at);
          return cancelledDate >= periodStart && cancelledDate <= periodEnd;
        }) || [];

        const periodRtoCount = periodRto.length;
        const periodRtoAmount = periodRto.reduce((sum, o) => sum + (o.final_amount || 0), 0);

        breakdown.push({
          period: periodStart.toISOString().split('T')[0],
          rto_count: periodRtoCount,
          rto_amount: periodRtoAmount,
          avg_value: periodRtoCount > 0 ? periodRtoAmount / periodRtoCount : 0
        });
      }

      if (export_format === 'csv') {
        const csvData = [
          ['Metric', 'Value'],
          ['Total RTO Count', totalRtoCount],
          ['Total RTO Amount', totalRtoAmount],
          ['Average RTO Value', averageRtoValue.toFixed(2)],
          ['Delivery Charge Lost', totalDeliveryChargeLost],
          ['RTO Growth (%)', rtoGrowth.toFixed(2)],
          [''],
          ['RTO By Reason'],
          ['Reason', 'Count', 'Percentage'],
          ...Object.entries(reasonWiseRto).map(([reason, count]) => [reason, count, ((count / totalRtoCount) * 100).toFixed(2)]),
          [''],
          ['Seller Wise RTO'],
          ['Seller Name', 'RTO Count', 'RTO Amount', 'RTO Rate (%)'],
          ...Object.values(sellerWiseRto).map(s => [s.shop_name, s.rto_count, s.rto_amount, s.rto_rate.toFixed(2)]),
          [''],
          ['Pincode Wise RTO'],
          ['Pincode', 'RTO Count'],
          ...Object.entries(pincodeWiseRto).map(([pincodeValue, count]) => [pincodeValue, count])
        ];

        const csvString = csvData.map(row => row.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(',')).join('\n');
        return new Response(csvString, {
          status: 200,
          headers: {
            'Content-Type': 'text/csv',
            'Content-Disposition': `attachment; filename=rto_report_${startDateStr.split('T')[0]}_${endDateStr.split('T')[0]}.csv`,
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
          total_rto_count: totalRtoCount,
          total_rto_amount: totalRtoAmount,
          average_rto_value: averageRtoValue.toFixed(2),
          delivery_charge_lost: totalDeliveryChargeLost,
          rto_growth: rtoGrowth.toFixed(2),
          previous_period_rto_count: prevRtoCount
        },
        reason_wise: Object.entries(reasonWiseRto).map(([reason, count]) => ({
          reason,
          count,
          percentage: ((count / totalRtoCount) * 100).toFixed(2)
        })),
        seller_wise: Object.values(sellerWiseRto),
        pincode_wise: Object.entries(pincodeWiseRto).map(([pincodeValue, count]) => ({ pincode: pincodeValue, count })),
        breakdown: breakdown,
        generated_at: new Date().toISOString()
      }), {
        status: 200,
        headers: { 'Content-Type': 'application/json', ...corsHeaders }
      });
    }

    // =====================================================
    // DETAILED RTO REPORT
    // =====================================================
    if (report_type === 'detailed') {
      const from = (page - 1) * limit;
      const to = from + limit - 1;

      const detailedRto = rtoOrders?.slice(from, to).map(order => ({
        book_id: order.book_id,
        order_date: order.placed_at,
        rto_date: order.cancelled_at,
        amount: order.final_amount,
        delivery_charge: order.delivery_charge,
        reason: order.cancel_reason,
        customer: {
          cust_id: order.customers?.cust_id,
          name: order.customers?.name,
          mobile: order.customers?.mobile
        },
        seller: {
          seller_id: order.sellers?.seller_id,
          shop_name: order.sellers?.shop_name
        },
        address: order.address,
        items: (order.order_items || []).map(item => ({
          prod_id: item.products?.prod_id,
          name: item.products?.name,
          quantity: item.quantity,
          price: item.price_at_time,
          total: item.price_at_time * item.quantity
        }))
      })) || [];

      if (export_format === 'csv') {
        const csvData = [
          ['Order ID', 'Order Date', 'RTO Date', 'Amount', 'Delivery Charge', 'Reason', 'Customer Name', 'Seller Name', 'Pincode'],
          ...detailedRto.map(o => [
            o.book_id,
            o.order_date,
            o.rto_date,
            o.amount,
            o.delivery_charge,
            o.reason,
            o.customer?.name,
            o.seller?.shop_name,
            o.address?.pincode
          ])
        ];

        const csvString = csvData.map(row => row.map(cell => `"${String(cell || '').replace(/"/g, '""')}"`).join(',')).join('\n');
        return new Response(csvString, {
          status: 200,
          headers: {
            'Content-Type': 'text/csv',
            'Content-Disposition': `attachment; filename=detailed_rto_${startDateStr.split('T')[0]}_${endDateStr.split('T')[0]}.csv`,
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
        rto_orders: detailedRto,
        total_count: rtoOrders?.length || 0,
        pagination: {
          current_page: page,
          total_pages: Math.ceil((rtoOrders?.length || 0) / limit),
          total_items: rtoOrders?.length || 0,
          items_per_page: limit
        },
        generated_at: new Date().toISOString()
      }), {
        status: 200,
        headers: { 'Content-Type': 'application/json', ...corsHeaders }
      });
    }

    // =====================================================
    // CUSTOMER RTO REPORT
    // =====================================================
    if (report_type === 'customer') {
      const customerWiseRto = {};

      rtoOrders?.forEach(order => {
        const custId = order.cust_id;
        if (!customerWiseRto[custId]) {
          customerWiseRto[custId] = {
            cust_id: custId,
            name: order.customers?.name,
            mobile: order.customers?.mobile,
            rto_count: 0,
            rto_amount: 0,
            orders: []
          };
        }
        customerWiseRto[custId].rto_count++;
        customerWiseRto[custId].rto_amount += order.final_amount;
        customerWiseRto[custId].orders.push({
          book_id: order.book_id,
          amount: order.final_amount,
          reason: order.cancel_reason,
          date: order.cancelled_at
        });
      });

      const topRtoCustomers = Object.values(customerWiseRto)
        .sort((a, b) => b.rto_count - a.rto_count)
        .slice(0, 50);

      if (export_format === 'csv') {
        const csvData = [
          ['Customer Name', 'Mobile', 'RTO Count', 'RTO Amount'],
          ...topRtoCustomers.map(c => [c.name, c.mobile, c.rto_count, c.rto_amount.toFixed(2)])
        ];

        const csvString = csvData.map(row => row.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(',')).join('\n');
        return new Response(csvString, {
          status: 200,
          headers: {
            'Content-Type': 'text/csv',
            'Content-Disposition': `attachment; filename=customer_rto_${startDateStr.split('T')[0]}_${endDateStr.split('T')[0]}.csv`,
            ...corsHeaders
          }
        });
      }

      return new Response(JSON.stringify({
        success: true,
        report_type: 'customer',
        period: {
          from: startDateStr.split('T')[0],
          to: endDateStr.split('T')[0]
        },
        top_rto_customers: topRtoCustomers,
        total_customers_with_rto: Object.keys(customerWiseRto).length,
        total_rto_count: rtoOrders?.length || 0,
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
    console.error('RTO report error:', error);
    return new Response(JSON.stringify({
      success: false,
      error: error.message || 'Internal server error'
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json', ...corsHeaders }
    });
  }
}