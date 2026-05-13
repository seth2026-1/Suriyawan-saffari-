// api/owner/reports/users.js
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
          gte: (gteField, gteValue) => ({
            lte: (lteField, lteValue) => ({
              order: (orderField, { ascending }) => ({
                range: async (from, to) => {
                  const result = await execute({
                    gte: { [gteField]: gteValue },
                    lte: { [lteField]: lteValue },
                    order: { field: orderField, ascending },
                    range: { from, to }
                  });
                  return result;
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
    const report_type = url.searchParams.get('report_type') || 'summary';
    const from_date = url.searchParams.get('from_date');
    const to_date = url.searchParams.get('to_date');
    const user_type = url.searchParams.get('user_type');
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

    // =====================================================
    // GET USER DATA
    // =====================================================

    // Customers
    let customersUrl = `${supabaseUrl}/rest/v1/customers?select=*`;
    if (from_date && to_date) {
      customersUrl += `&created_at=gte.${startDateStr}&created_at=lte.${endDateStr}`;
    }
    const customersResponse = await fetch(customersUrl, {
      headers: {
        'apikey': supabaseKey,
        'Authorization': `Bearer ${supabaseKey}`,
      },
    });
    const customers = await customersResponse.json();

    // Sellers
    let sellersUrl = `${supabaseUrl}/rest/v1/sellers?select=*`;
    if (from_date && to_date) {
      sellersUrl += `&created_at=gte.${startDateStr}&created_at=lte.${endDateStr}`;
    }
    const sellersResponse = await fetch(sellersUrl, {
      headers: {
        'apikey': supabaseKey,
        'Authorization': `Bearer ${supabaseKey}`,
      },
    });
    const sellers = await sellersResponse.json();

    // Riders
    let ridersUrl = `${supabaseUrl}/rest/v1/riders?select=*`;
    if (from_date && to_date) {
      ridersUrl += `&created_at=gte.${startDateStr}&created_at=lte.${endDateStr}`;
    }
    const ridersResponse = await fetch(ridersUrl, {
      headers: {
        'apikey': supabaseKey,
        'Authorization': `Bearer ${supabaseKey}`,
      },
    });
    const riders = await ridersResponse.json();

    // Hub Managers
    let hubsUrl = `${supabaseUrl}/rest/v1/hub_managers?select=*`;
    if (from_date && to_date) {
      hubsUrl += `&created_at=gte.${startDateStr}&created_at=lte.${endDateStr}`;
    }
    const hubsResponse = await fetch(hubsUrl, {
      headers: {
        'apikey': supabaseKey,
        'Authorization': `Bearer ${supabaseKey}`,
      },
    });
    const hubs = await hubsResponse.json();

    // =====================================================
    // SUMMARY REPORT
    // =====================================================
    if (report_type === 'summary') {
      const totalCustomers = customers?.length || 0;
      const totalSellers = sellers?.length || 0;
      const totalRiders = riders?.length || 0;
      const totalHubs = hubs?.length || 0;
      const totalUsers = totalCustomers + totalSellers + totalRiders + totalHubs;

      // Active users
      const activeCustomers = customers?.filter(c => c.is_active === true).length || 0;
      const activeSellers = sellers?.filter(s => s.is_active === true && s.kyc_status === 'APPROVED').length || 0;
      const activeRiders = riders?.filter(r => r.is_active === true).length || 0;
      const activeHubs = hubs?.filter(h => h.is_active === true).length || 0;

      // COD blocked customers
      const codBlockedCustomers = customers?.filter(c => c.cod_status === 'BLOCKED').length || 0;

      // KYC pending
      const kycPendingSellers = sellers?.filter(s => s.kyc_status === 'PENDING').length || 0;

      // Previous period comparison
      const duration = endDate - startDate;
      const prevStartDate = new Date(startDate);
      prevStartDate.setDate(prevStartDate.getDate() - Math.ceil(duration / (1000 * 60 * 60 * 24)));
      const prevEndDate = new Date(startDate);
      prevEndDate.setDate(prevEndDate.getDate() - 1);
      const prevStartStr = prevStartDate.toISOString();
      const prevEndStr = prevEndDate.toISOString();

      const prevCustomersUrl = `${supabaseUrl}/rest/v1/customers?select=cust_id&created_at=gte.${prevStartStr}&created_at=lte.${prevEndStr}`;
      const prevCustomersResponse = await fetch(prevCustomersUrl, {
        headers: {
          'apikey': supabaseKey,
          'Authorization': `Bearer ${supabaseKey}`,
        },
      });
      const prevCustomers = await prevCustomersResponse.json();
      const prevCustomersCount = prevCustomers?.length || 0;
      const customerGrowth = prevCustomersCount > 0 ? ((totalCustomers - prevCustomersCount) / prevCustomersCount) * 100 : 0;

      const prevSellersUrl = `${supabaseUrl}/rest/v1/sellers?select=seller_id&created_at=gte.${prevStartStr}&created_at=lte.${prevEndStr}`;
      const prevSellersResponse = await fetch(prevSellersUrl, {
        headers: {
          'apikey': supabaseKey,
          'Authorization': `Bearer ${supabaseKey}`,
        },
      });
      const prevSellers = await prevSellersResponse.json();
      const prevSellersCount = prevSellers?.length || 0;
      const sellerGrowth = prevSellersCount > 0 ? ((totalSellers - prevSellersCount) / prevSellersCount) * 100 : 0;

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

        const periodCustomersUrl = `${supabaseUrl}/rest/v1/customers?select=cust_id&created_at=gte.${periodStartStr}&created_at=lte.${periodEndStr}`;
        const periodCustomersResponse = await fetch(periodCustomersUrl, {
          headers: {
            'apikey': supabaseKey,
            'Authorization': `Bearer ${supabaseKey}`,
          },
        });
        const periodCustomers = await periodCustomersResponse.json();

        const periodSellersUrl = `${supabaseUrl}/rest/v1/sellers?select=seller_id&created_at=gte.${periodStartStr}&created_at=lte.${periodEndStr}`;
        const periodSellersResponse = await fetch(periodSellersUrl, {
          headers: {
            'apikey': supabaseKey,
            'Authorization': `Bearer ${supabaseKey}`,
          },
        });
        const periodSellers = await periodSellersResponse.json();

        breakdown.push({
          period: periodStart.toISOString().split('T')[0],
          new_customers: periodCustomers?.length || 0,
          new_sellers: periodSellers?.length || 0
        });
      }

      if (export_format === 'csv') {
        const csvData = [
          ['Metric', 'Value'],
          ['Total Users', totalUsers],
          ['Total Customers', totalCustomers],
          ['Total Sellers', totalSellers],
          ['Total Riders', totalRiders],
          ['Total Hubs', totalHubs],
          ['Active Customers', activeCustomers],
          ['Active Sellers', activeSellers],
          ['Active Riders', activeRiders],
          ['COD Blocked Customers', codBlockedCustomers],
          ['KYC Pending Sellers', kycPendingSellers],
          ['Customer Growth (%)', customerGrowth.toFixed(2)],
          ['Seller Growth (%)', sellerGrowth.toFixed(2)],
          [''],
          ['Daily/Monthly Breakdown'],
          ['Period', 'New Customers', 'New Sellers'],
          ...breakdown.map(b => [b.period, b.new_customers, b.new_sellers])
        ];

        const csvString = csvData.map(row => row.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(',')).join('\n');
        return new Response(csvString, {
          status: 200,
          headers: {
            'Content-Type': 'text/csv',
            'Content-Disposition': `attachment; filename=users_report_${startDateStr.split('T')[0]}_${endDateStr.split('T')[0]}.csv`,
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
          total_users: totalUsers,
          total_customers: totalCustomers,
          total_sellers: totalSellers,
          total_riders: totalRiders,
          total_hubs: totalHubs,
          active_customers: activeCustomers,
          active_sellers: activeSellers,
          active_riders: activeRiders,
          active_hubs: activeHubs,
          cod_blocked_customers: codBlockedCustomers,
          kyc_pending_sellers: kycPendingSellers,
          customer_growth: customerGrowth.toFixed(2),
          seller_growth: sellerGrowth.toFixed(2)
        },
        breakdown: breakdown,
        generated_at: new Date().toISOString()
      }), {
        status: 200,
        headers: { 'Content-Type': 'application/json', ...corsHeaders }
      });
    }

    // =====================================================
    // CUSTOMER REPORT
    // =====================================================
    if (report_type === 'customers' && (!user_type || user_type === 'customer')) {
      const from = (page - 1) * limit;
      const to = from + limit - 1;

      const customersWithStats = customers?.slice(from, to).map(customer => ({
        cust_id: customer.cust_id,
        name: customer.name,
        email: customer.email,
        mobile: customer.mobile,
        trust_score: customer.trust_score,
        cod_status: customer.cod_status,
        wallet_balance: customer.wallet_balance,
        coins: customer.coins,
        is_active: customer.is_active,
        created_at: customer.created_at
      })) || [];

      if (export_format === 'csv') {
        const csvData = [
          ['Customer ID', 'Name', 'Email', 'Mobile', 'Trust Score', 'COD Status', 'Wallet Balance', 'Coins', 'Created At'],
          ...customersWithStats.map(c => [
            c.cust_id, c.name, c.email, c.mobile, c.trust_score, c.cod_status, c.wallet_balance, c.coins, c.created_at
          ])
        ];

        const csvString = csvData.map(row => row.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(',')).join('\n');
        return new Response(csvString, {
          status: 200,
          headers: {
            'Content-Type': 'text/csv',
            'Content-Disposition': `attachment; filename=customers_report_${startDateStr.split('T')[0]}_${endDateStr.split('T')[0]}.csv`,
            ...corsHeaders
          }
        });
      }

      return new Response(JSON.stringify({
        success: true,
        report_type: 'customers',
        period: {
          from: startDateStr.split('T')[0],
          to: endDateStr.split('T')[0]
        },
        customers: customersWithStats,
        total_count: customers?.length || 0,
        pagination: {
          current_page: page,
          total_pages: Math.ceil((customers?.length || 0) / limit),
          total_items: customers?.length || 0,
          items_per_page: limit
        },
        generated_at: new Date().toISOString()
      }), {
        status: 200,
        headers: { 'Content-Type': 'application/json', ...corsHeaders }
      });
    }

    // =====================================================
    // SELLER REPORT
    // =====================================================
    if (report_type === 'sellers' && (!user_type || user_type === 'seller')) {
      const from = (page - 1) * limit;
      const to = from + limit - 1;

      const sellersWithStats = sellers?.slice(from, to).map(seller => ({
        seller_id: seller.seller_id,
        shop_name: seller.shop_name,
        owner_name: seller.owner_name,
        email: seller.email,
        mobile: seller.mobile,
        kyc_status: seller.kyc_status,
        commission_rate: seller.commission_rate,
        rating: seller.rating,
        trust_score: seller.trust_score,
        wallet_balance: seller.wallet_balance,
        is_active: seller.is_active,
        created_at: seller.created_at
      })) || [];

      if (export_format === 'csv') {
        const csvData = [
          ['Seller ID', 'Shop Name', 'Owner Name', 'Email', 'Mobile', 'KYC Status', 'Commission Rate', 'Rating', 'Wallet Balance', 'Created At'],
          ...sellersWithStats.map(s => [
            s.seller_id, s.shop_name, s.owner_name, s.email, s.mobile, s.kyc_status, s.commission_rate, s.rating, s.wallet_balance, s.created_at
          ])
        ];

        const csvString = csvData.map(row => row.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(',')).join('\n');
        return new Response(csvString, {
          status: 200,
          headers: {
            'Content-Type': 'text/csv',
            'Content-Disposition': `attachment; filename=sellers_report_${startDateStr.split('T')[0]}_${endDateStr.split('T')[0]}.csv`,
            ...corsHeaders
          }
        });
      }

      return new Response(JSON.stringify({
        success: true,
        report_type: 'sellers',
        period: {
          from: startDateStr.split('T')[0],
          to: endDateStr.split('T')[0]
        },
        sellers: sellersWithStats,
        total_count: sellers?.length || 0,
        pagination: {
          current_page: page,
          total_pages: Math.ceil((sellers?.length || 0) / limit),
          total_items: sellers?.length || 0,
          items_per_page: limit
        },
        generated_at: new Date().toISOString()
      }), {
        status: 200,
        headers: { 'Content-Type': 'application/json', ...corsHeaders }
      });
    }

    // =====================================================
    // RIDER REPORT
    // =====================================================
    if (report_type === 'riders' && (!user_type || user_type === 'rider')) {
      const from = (page - 1) * limit;
      const to = from + limit - 1;

      const ridersWithStats = riders?.slice(from, to).map(rider => ({
        rider_id: rider.rider_id,
        name: rider.name,
        email: rider.email,
        mobile: rider.mobile,
        assigned_area: rider.assigned_area,
        rate_per_parcel: rider.rate_per_parcel,
        rating: rider.rating,
        total_deliveries: rider.total_deliveries,
        total_pickups: rider.total_pickups,
        wallet_balance: rider.wallet_balance,
        is_online: rider.is_online,
        is_active: rider.is_active,
        created_at: rider.created_at
      })) || [];

      if (export_format === 'csv') {
        const csvData = [
          ['Rider ID', 'Name', 'Email', 'Mobile', 'Assigned Area', 'Rate/Parcel', 'Rating', 'Total Deliveries', 'Total Pickups', 'Wallet Balance', 'Is Online', 'Created At'],
          ...ridersWithStats.map(r => [
            r.rider_id, r.name, r.email, r.mobile, r.assigned_area, r.rate_per_parcel, r.rating, r.total_deliveries, r.total_pickups, r.wallet_balance, r.is_online, r.created_at
          ])
        ];

        const csvString = csvData.map(row => row.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(',')).join('\n');
        return new Response(csvString, {
          status: 200,
          headers: {
            'Content-Type': 'text/csv',
            'Content-Disposition': `attachment; filename=riders_report_${startDateStr.split('T')[0]}_${endDateStr.split('T')[0]}.csv`,
            ...corsHeaders
          }
        });
      }

      return new Response(JSON.stringify({
        success: true,
        report_type: 'riders',
        period: {
          from: startDateStr.split('T')[0],
          to: endDateStr.split('T')[0]
        },
        riders: ridersWithStats,
        total_count: riders?.length || 0,
        pagination: {
          current_page: page,
          total_pages: Math.ceil((riders?.length || 0) / limit),
          total_items: riders?.length || 0,
          items_per_page: limit
        },
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
    console.error('Users report error:', error);
    return new Response(JSON.stringify({
      success: false,
      error: error.message || 'Internal server error'
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json', ...corsHeaders }
    });
  }
}