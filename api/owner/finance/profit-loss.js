// api/owner/finance/profit-loss.js
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
    const period = url.searchParams.get('period') || 'month';
    const from_date = url.searchParams.get('from_date');
    const to_date = url.searchParams.get('to_date');
    const compare_with_previous = url.searchParams.get('compare_with_previous') !== 'false';
    const export_format = url.searchParams.get('export_format') || 'json';

    const supabase = createSupabaseClient();
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

    // Set date range based on period
    let startDate, endDate;
    const now = new Date();

    if (from_date && to_date) {
      startDate = new Date(from_date);
      endDate = new Date(to_date);
    } else {
      switch (period) {
        case 'today':
          startDate = new Date(now.setHours(0, 0, 0, 0));
          endDate = new Date();
          break;
        case 'week':
          startDate = new Date(now.setDate(now.getDate() - 7));
          endDate = new Date();
          break;
        case 'month':
          startDate = new Date(now.getFullYear(), now.getMonth(), 1);
          endDate = new Date();
          break;
        case 'quarter':
          const quarterStartMonth = Math.floor(now.getMonth() / 3) * 3;
          startDate = new Date(now.getFullYear(), quarterStartMonth, 1);
          endDate = new Date();
          break;
        case 'year':
          startDate = new Date(now.getFullYear(), 0, 1);
          endDate = new Date();
          break;
        default:
          startDate = new Date(now.getFullYear(), now.getMonth(), 1);
          endDate = new Date();
      }
    }

    const startDateStr = startDate.toISOString();
    const endDateStr = endDate.toISOString();

    // =====================================================
    // REVENUE CALCULATIONS
    // =====================================================

    // Total sales (delivered orders)
    const deliveredOrdersUrl = `${supabaseUrl}/rest/v1/orders?select=final_amount,placed_at&status=eq.DELIVERED&placed_at=gte.${startDateStr}&placed_at=lte.${endDateStr}`;
    const deliveredOrdersResponse = await fetch(deliveredOrdersUrl, {
      headers: {
        'apikey': supabaseKey,
        'Authorization': `Bearer ${supabaseKey}`,
      },
    });
    const deliveredOrders = await deliveredOrdersResponse.json();

    const totalRevenue = deliveredOrders?.reduce((sum, o) => sum + (o.final_amount || 0), 0) || 0;
    const totalOrders = deliveredOrders?.length || 0;

    // Get seller commission
    const commissionUrl = `${supabaseUrl}/rest/v1/system_settings?setting_key=eq.default_commission&select=setting_value`;
    const commissionResponse = await fetch(commissionUrl, {
      headers: {
        'apikey': supabaseKey,
        'Authorization': `Bearer ${supabaseKey}`,
      },
    });
    const commissionData = await commissionResponse.json();
    const commissionSetting = commissionData[0];
    const defaultCommission = parseInt(commissionSetting?.setting_value || 10);
    const totalCommission = totalRevenue * (defaultCommission / 100);

    // Platform fee (2% platform fee)
    const platformFee = totalRevenue * 0.02;

    // =====================================================
    // EXPENSE CALCULATIONS
    // =====================================================

    // Rider payouts
    const riderPayoutsUrl = `${supabaseUrl}/rest/v1/payouts?select=amount,status,completed_at&user_type=eq.rider&status=eq.COMPLETED&completed_at=gte.${startDateStr}&completed_at=lte.${endDateStr}`;
    const riderPayoutsResponse = await fetch(riderPayoutsUrl, {
      headers: {
        'apikey': supabaseKey,
        'Authorization': `Bearer ${supabaseKey}`,
      },
    });
    const riderPayouts = await riderPayoutsResponse.json();
    const totalRiderPayouts = riderPayouts?.reduce((sum, p) => sum + (p.amount || 0), 0) || 0;

    // Return/refund amounts
    const returnsUrl = `${supabaseUrl}/rest/v1/returns?select=refund_amount,created_at&status=eq.COMPLETED&created_at=gte.${startDateStr}&created_at=lte.${endDateStr}`;
    const returnsResponse = await fetch(returnsUrl, {
      headers: {
        'apikey': supabaseKey,
        'Authorization': `Bearer ${supabaseKey}`,
      },
    });
    const returns = await returnsResponse.json();
    const totalReturns = returns?.reduce((sum, r) => sum + (r.refund_amount || 0), 0) || 0;

    // RTO loss
    const rtoOrdersUrl = `${supabaseUrl}/rest/v1/orders?select=final_amount&status=eq.RTO&placed_at=gte.${startDateStr}&placed_at=lte.${endDateStr}`;
    const rtoOrdersResponse = await fetch(rtoOrdersUrl, {
      headers: {
        'apikey': supabaseKey,
        'Authorization': `Bearer ${supabaseKey}`,
      },
    });
    const rtoOrders = await rtoOrdersResponse.json();
    const totalRtoLoss = rtoOrders?.reduce((sum, o) => sum + (o.final_amount || 0), 0) || 0;

    // Marketing/Ad expenses
    const adExpensesUrl = `${supabaseUrl}/rest/v1/ad_expenses?select=amount&created_at=gte.${startDateStr}&created_at=lte.${endDateStr}`;
    const adExpensesResponse = await fetch(adExpensesUrl, {
      headers: {
        'apikey': supabaseKey,
        'Authorization': `Bearer ${supabaseKey}`,
      },
    });
    const adExpenses = await adExpensesResponse.json();
    const totalAdExpenses = adExpenses?.reduce((sum, a) => sum + (a.amount || 0), 0) || 0;

    // Operational expenses
    const operationalExpenses = {
      staff_salary: 50000,
      server_cost: 10000,
      customer_support: 20000,
      logistics_partner: 30000,
      miscellaneous: 15000
    };
    const totalOperationalExpenses = Object.values(operationalExpenses).reduce((a, b) => a + b, 0);

    // =====================================================
    // PROFIT CALCULATIONS
    // =====================================================

    const totalExpenses = totalRiderPayouts + totalReturns + totalRtoLoss + totalAdExpenses + totalOperationalExpenses;
    const grossProfit = totalRevenue - totalCommission - platformFee;
    const netProfit = grossProfit - totalExpenses;

    // =====================================================
    // PREVIOUS PERIOD COMPARISON
    // =====================================================
    let previousPeriodData = null;

    if (compare_with_previous) {
      const duration = endDate - startDate;
      const prevStartDate = new Date(startDate);
      prevStartDate.setDate(prevStartDate.getDate() - Math.ceil(duration / (1000 * 60 * 60 * 24)));
      const prevEndDate = new Date(startDate);
      prevEndDate.setDate(prevEndDate.getDate() - 1);

      const prevOrdersUrl = `${supabaseUrl}/rest/v1/orders?select=final_amount&status=eq.DELIVERED&placed_at=gte.${prevStartDate.toISOString()}&placed_at=lte.${prevEndDate.toISOString()}`;
      const prevOrdersResponse = await fetch(prevOrdersUrl, {
        headers: {
          'apikey': supabaseKey,
          'Authorization': `Bearer ${supabaseKey}`,
        },
      });
      const prevOrders = await prevOrdersResponse.json();
      const prevRevenue = prevOrders?.reduce((sum, o) => sum + (o.final_amount || 0), 0) || 0;
      const revenueGrowth = prevRevenue > 0 ? ((totalRevenue - prevRevenue) / prevRevenue) * 100 : 0;

      previousPeriodData = {
        period: `${prevStartDate.toISOString().split('T')[0]} to ${prevEndDate.toISOString().split('T')[0]}`,
        revenue: prevRevenue,
        growth_percentage: revenueGrowth.toFixed(2)
      };
    }

    // =====================================================
    // MONTHLY BREAKDOWN
    // =====================================================
    const monthlyBreakdown = [];
    const currentDate = new Date(startDate);

    while (currentDate <= endDate) {
      const year = currentDate.getFullYear();
      const month = currentDate.getMonth();
      const monthStart = new Date(year, month, 1);
      const monthEnd = new Date(year, month + 1, 0);
      const monthStartStr = monthStart.toISOString();
      const monthEndStr = monthEnd.toISOString();

      const monthOrdersUrl = `${supabaseUrl}/rest/v1/orders?select=final_amount&status=eq.DELIVERED&placed_at=gte.${monthStartStr}&placed_at=lte.${monthEndStr}`;
      const monthOrdersResponse = await fetch(monthOrdersUrl, {
        headers: {
          'apikey': supabaseKey,
          'Authorization': `Bearer ${supabaseKey}`,
        },
      });
      const monthOrders = await monthOrdersResponse.json();
      const monthRevenue = monthOrders?.reduce((sum, o) => sum + (o.final_amount || 0), 0) || 0;

      monthlyBreakdown.push({
        month: `${year}-${String(month + 1).padStart(2, '0')}`,
        revenue: monthRevenue,
        commission: monthRevenue * (defaultCommission / 100),
        net: monthRevenue - (monthRevenue * (defaultCommission / 100))
      });

      currentDate.setMonth(currentDate.getMonth() + 1);
    }

    // =====================================================
    // EXPENSE BREAKDOWN
    // =====================================================
    const expenseBreakdown = [
      { category: 'Rider Payouts', amount: totalRiderPayouts, percentage: totalRevenue > 0 ? (totalRiderPayouts / totalRevenue) * 100 : 0 },
      { category: 'Returns & Refunds', amount: totalReturns, percentage: totalRevenue > 0 ? (totalReturns / totalRevenue) * 100 : 0 },
      { category: 'RTO Loss', amount: totalRtoLoss, percentage: totalRevenue > 0 ? (totalRtoLoss / totalRevenue) * 100 : 0 },
      { category: 'Ad Expenses', amount: totalAdExpenses, percentage: totalRevenue > 0 ? (totalAdExpenses / totalRevenue) * 100 : 0 },
      { category: 'Staff Salary', amount: operationalExpenses.staff_salary, percentage: totalRevenue > 0 ? (operationalExpenses.staff_salary / totalRevenue) * 100 : 0 },
      { category: 'Server Cost', amount: operationalExpenses.server_cost, percentage: totalRevenue > 0 ? (operationalExpenses.server_cost / totalRevenue) * 100 : 0 },
      { category: 'Customer Support', amount: operationalExpenses.customer_support, percentage: totalRevenue > 0 ? (operationalExpenses.customer_support / totalRevenue) * 100 : 0 },
      { category: 'Logistics Partner', amount: operationalExpenses.logistics_partner, percentage: totalRevenue > 0 ? (operationalExpenses.logistics_partner / totalRevenue) * 100 : 0 },
      { category: 'Miscellaneous', amount: operationalExpenses.miscellaneous, percentage: totalRevenue > 0 ? (operationalExpenses.miscellaneous / totalRevenue) * 100 : 0 }
    ];

    const netProfitMargin = totalRevenue > 0 ? (netProfit / totalRevenue) * 100 : 0;

    // If export format is CSV
    if (export_format === 'csv') {
      const csvData = [
        ['Parameter', 'Amount (₹)', 'Percentage of Revenue'],
        ['Total Revenue', totalRevenue.toString(), '100%'],
        ['Commission Paid', totalCommission.toString(), `${((totalCommission / totalRevenue) * 100).toFixed(2)}%`],
        ['Platform Fee', platformFee.toString(), `${((platformFee / totalRevenue) * 100).toFixed(2)}%`],
        ['Gross Profit', grossProfit.toString(), `${((grossProfit / totalRevenue) * 100).toFixed(2)}%`],
        [''],
        ['Expenses'],
        ...expenseBreakdown.map(e => [e.category, e.amount.toString(), `${e.percentage.toFixed(2)}%`]),
        [''],
        ['Total Expenses', totalExpenses.toString(), `${((totalExpenses / totalRevenue) * 100).toFixed(2)}%`],
        ['Net Profit', netProfit.toString(), `${netProfitMargin.toFixed(2)}%`]
      ];

      const csvString = csvData.map(row => row.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(',')).join('\n');
      return new Response(csvString, {
        status: 200,
        headers: {
          'Content-Type': 'text/csv',
          'Content-Disposition': `attachment; filename=profit_loss_${startDateStr.split('T')[0]}_${endDateStr.split('T')[0]}.csv`,
          ...corsHeaders
        }
      });
    }

    return new Response(JSON.stringify({
      success: true,
      period: {
        from: startDateStr.split('T')[0],
        to: endDateStr.split('T')[0],
        type: period
      },
      revenue: {
        total: totalRevenue,
        total_orders: totalOrders,
        average_order_value: totalOrders > 0 ? totalRevenue / totalOrders : 0
      },
      costs: {
        commission: totalCommission,
        platform_fee: platformFee,
        gross_profit: grossProfit
      },
      expenses: {
        total: totalExpenses,
        breakdown: expenseBreakdown,
        rider_payouts: totalRiderPayouts,
        returns: totalReturns,
        rto_loss: totalRtoLoss,
        ad_expenses: totalAdExpenses,
        operational: totalOperationalExpenses
      },
      profit: {
        net: netProfit,
        net_margin_percentage: netProfitMargin.toFixed(2),
        is_profitable: netProfit > 0
      },
      monthly_breakdown: monthlyBreakdown,
      comparison: previousPeriodData,
      ratios: {
        operating_margin: totalRevenue > 0 ? ((grossProfit - totalExpenses) / totalRevenue) * 100 : 0,
        expense_to_revenue: totalRevenue > 0 ? (totalExpenses / totalRevenue) * 100 : 0,
        commission_to_revenue: totalRevenue > 0 ? (totalCommission / totalRevenue) * 100 : 0
      },
      generated_at: new Date().toISOString()
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json', ...corsHeaders }
    });

  } catch (error) {
    console.error('Profit & Loss error:', error);
    return new Response(JSON.stringify({
      success: false,
      error: error.message || 'Internal server error'
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json', ...corsHeaders }
    });
  }
}