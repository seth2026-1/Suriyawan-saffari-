// api/owner/finance/tds-reports.js
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

function getQuarter(fyStart) {
  const now = new Date();
  const month = now.getMonth();

  if (month >= 3 && month <= 5) return 'Q1';
  if (month >= 6 && month <= 8) return 'Q2';
  if (month >= 9 && month <= 11) return 'Q3';
  return 'Q4';
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
    const financial_year = url.searchParams.get('financial_year');
    const quarter = url.searchParams.get('quarter');
    const user_type = url.searchParams.get('user_type');
    const from_date = url.searchParams.get('from_date');
    const to_date = url.searchParams.get('to_date');
    const export_format = url.searchParams.get('export_format') || 'json';
    const page = parseInt(url.searchParams.get('page') || '1');
    const limit = parseInt(url.searchParams.get('limit') || '100');

    const supabase = createSupabaseClient();
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

    // Determine financial year
    let fyStart, fyEnd;
    if (financial_year) {
      const [startYear, endYear] = financial_year.split('-');
      fyStart = new Date(`${startYear}-04-01`);
      fyEnd = new Date(`${endYear}-03-31`);
    } else {
      const now = new Date();
      const currentYear = now.getFullYear();
      if (now.getMonth() >= 3) {
        fyStart = new Date(`${currentYear}-04-01`);
        fyEnd = new Date(`${currentYear + 1}-03-31`);
      } else {
        fyStart = new Date(`${currentYear - 1}-04-01`);
        fyEnd = new Date(`${currentYear}-03-31`);
      }
    }

    const startDate = from_date || fyStart.toISOString().split('T')[0];
    const endDate = to_date || fyEnd.toISOString().split('T')[0];

    // Get TDS settings
    const settingsUrl = `${supabaseUrl}/rest/v1/system_settings?setting_key=in.(tds_percentage,tds_section,tds_threshold)&select=setting_key,setting_value`;
    const settingsResponse = await fetch(settingsUrl, {
      headers: {
        'apikey': supabaseKey,
        'Authorization': `Bearer ${supabaseKey}`,
      },
    });
    const settings = await settingsResponse.json();

    const tdsPercentage = parseInt(settings.find(s => s.setting_key === 'tds_percentage')?.setting_value || 1);
    const tdsSection = settings.find(s => s.setting_key === 'tds_section')?.setting_value || '194H';
    const tdsThreshold = parseInt(settings.find(s => s.setting_key === 'tds_threshold')?.setting_value || 10000);

    // =====================================================
    // SELLER TDS REPORTS
    // =====================================================
    let sellerTDS = [];
    if (!user_type || user_type === 'seller') {
      const sellerPayoutsSelect = `payout_id,amount,tds_amount,net_amount,utr_number,status,requested_at,completed_at,sellers!inner(seller_id,shop_name,owner_name,email,mobile,pan_number,gst_number,upi_id)`;
      const sellerPayoutsUrl = `${supabaseUrl}/rest/v1/payouts?select=${encodeURIComponent(sellerPayoutsSelect)}&user_type=eq.seller&status=eq.COMPLETED&completed_at=gte.${startDate}T00:00:00&completed_at=lte.${endDate}T23:59:59`;
      const sellerPayoutsResponse = await fetch(sellerPayoutsUrl, {
        headers: {
          'apikey': supabaseKey,
          'Authorization': `Bearer ${supabaseKey}`,
        },
      });
      const sellerPayouts = await sellerPayoutsResponse.json();
      sellerTDS = sellerPayouts || [];
    }

    // =====================================================
    // RIDER TDS REPORTS
    // =====================================================
    let riderTDS = [];
    if (!user_type || user_type === 'rider') {
      const riderPayoutsSelect = `payout_id,amount,tds_amount,net_amount,utr_number,status,requested_at,completed_at,riders!inner(rider_id,name,email,mobile,pan_number,upi_id,assigned_area)`;
      const riderPayoutsUrl = `${supabaseUrl}/rest/v1/payouts?select=${encodeURIComponent(riderPayoutsSelect)}&user_type=eq.rider&status=eq.COMPLETED&completed_at=gte.${startDate}T00:00:00&completed_at=lte.${endDate}T23:59:59`;
      const riderPayoutsResponse = await fetch(riderPayoutsUrl, {
        headers: {
          'apikey': supabaseKey,
          'Authorization': `Bearer ${supabaseKey}`,
        },
      });
      const riderPayouts = await riderPayoutsResponse.json();
      riderTDS = riderPayouts || [];
    }

    // Calculate totals
    const totalSellerAmount = sellerTDS.reduce((sum, p) => sum + p.amount, 0);
    const totalSellerTDS = sellerTDS.reduce((sum, p) => sum + (p.tds_amount || 0), 0);
    const totalRiderAmount = riderTDS.reduce((sum, p) => sum + p.amount, 0);
    const totalRiderTDS = riderTDS.reduce((sum, p) => sum + (p.tds_amount || 0), 0);

    const totalTDS = totalSellerTDS + totalRiderTDS;
    const totalAmount = totalSellerAmount + totalRiderAmount;

    // Get monthly breakdown
    const monthlyBreakdown = {};

    const allPayments = [...sellerTDS, ...riderTDS];
    allPayments.forEach(payment => {
      const date = new Date(payment.completed_at);
      const monthYear = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
      if (!monthlyBreakdown[monthYear]) {
        monthlyBreakdown[monthYear] = {
          month: monthYear,
          amount: 0,
          tds: 0,
          seller_count: 0,
          rider_count: 0
        };
      }
      monthlyBreakdown[monthYear].amount += payment.amount;
      monthlyBreakdown[monthYear].tds += (payment.tds_amount || 0);
      if (payment.sellers) monthlyBreakdown[monthYear].seller_count++;
      if (payment.riders) monthlyBreakdown[monthYear].rider_count++;
    });

    // Seller-wise TDS certificates
    const sellerWiseTDS = {};
    sellerTDS.forEach(payment => {
      const sellerId = payment.sellers?.seller_id;
      if (sellerId) {
        if (!sellerWiseTDS[sellerId]) {
          sellerWiseTDS[sellerId] = {
            seller_id: sellerId,
            shop_name: payment.sellers?.shop_name,
            owner_name: payment.sellers?.owner_name,
            email: payment.sellers?.email,
            mobile: payment.sellers?.mobile,
            pan_number: payment.sellers?.pan_number,
            gst_number: payment.sellers?.gst_number,
            total_amount: 0,
            total_tds: 0,
            payments: []
          };
        }
        sellerWiseTDS[sellerId].total_amount += payment.amount;
        sellerWiseTDS[sellerId].total_tds += (payment.tds_amount || 0);
        sellerWiseTDS[sellerId].payments.push({
          payout_id: payment.payout_id,
          amount: payment.amount,
          tds_amount: payment.tds_amount,
          net_amount: payment.net_amount,
          utr_number: payment.utr_number,
          date: payment.completed_at
        });
      }
    });

    // Rider-wise TDS certificates
    const riderWiseTDS = {};
    riderTDS.forEach(payment => {
      const riderId = payment.riders?.rider_id;
      if (riderId) {
        if (!riderWiseTDS[riderId]) {
          riderWiseTDS[riderId] = {
            rider_id: riderId,
            name: payment.riders?.name,
            email: payment.riders?.email,
            mobile: payment.riders?.mobile,
            pan_number: payment.riders?.pan_number,
            upi_id: payment.riders?.upi_id,
            total_amount: 0,
            total_tds: 0,
            payments: []
          };
        }
        riderWiseTDS[riderId].total_amount += payment.amount;
        riderWiseTDS[riderId].total_tds += (payment.tds_amount || 0);
        riderWiseTDS[riderId].payments.push({
          payout_id: payment.payout_id,
          amount: payment.amount,
          tds_amount: payment.tds_amount,
          net_amount: payment.net_amount,
          utr_number: payment.utr_number,
          date: payment.completed_at
        });
      }
    });

    // Prepare TDS return data (Form 26Q format)
    const tdsReturn = {
      financial_year: `${fyStart.getFullYear()}-${fyEnd.getFullYear()}`,
      quarter: quarter || getQuarter(fyStart),
      section: tdsSection,
      total_deductor_amount: totalAmount,
      total_tds_deducted: totalTDS,
      date_of_deposit: new Date().toISOString(),
      certificates: {
        sellers: Object.values(sellerWiseTDS),
        riders: Object.values(riderWiseTDS)
      }
    };

    // If export format is CSV
    if (export_format === 'csv') {
      const csvData = [];
      csvData.push(['User Type', 'User ID', 'Name', 'PAN', 'Total Amount', 'TDS Amount', 'Net Amount', 'Payment Date', 'UTR Number']);

      sellerTDS.forEach(p => {
        csvData.push([
          'Seller',
          p.sellers?.seller_id || '',
          p.sellers?.shop_name || '',
          p.sellers?.pan_number || 'Not Provided',
          p.amount.toString(),
          (p.tds_amount || 0).toString(),
          p.net_amount.toString(),
          p.completed_at?.split('T')[0] || '',
          p.utr_number || ''
        ]);
      });

      riderTDS.forEach(p => {
        csvData.push([
          'Rider',
          p.riders?.rider_id || '',
          p.riders?.name || '',
          p.riders?.pan_number || 'Not Provided',
          p.amount.toString(),
          (p.tds_amount || 0).toString(),
          p.net_amount.toString(),
          p.completed_at?.split('T')[0] || '',
          p.utr_number || ''
        ]);
      });

      const csvString = csvData.map(row => row.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(',')).join('\n');
      return new Response(csvString, {
        status: 200,
        headers: {
          'Content-Type': 'text/csv',
          'Content-Disposition': `attachment; filename=tds_report_${startDate}_${endDate}.csv`,
          ...corsHeaders
        }
      });
    }

    return new Response(JSON.stringify({
      success: true,
      report_type: 'TDS',
      financial_year: `${fyStart.getFullYear()}-${fyEnd.getFullYear()}`,
      period: {
        from: startDate,
        to: endDate
      },
      settings: {
        tds_percentage: tdsPercentage,
        tds_section: tdsSection,
        tds_threshold: tdsThreshold
      },
      summary: {
        total_amount_paid: totalAmount,
        total_tds_deducted: totalTDS,
        effective_rate: totalAmount > 0 ? ((totalTDS / totalAmount) * 100).toFixed(2) : 0,
        sellers_count: sellerTDS.length,
        riders_count: riderTDS.length,
        total_payments: sellerTDS.length + riderTDS.length
      },
      monthly_breakdown: Object.values(monthlyBreakdown),
      tds_return: tdsReturn,
      certificates: {
        sellers: Object.values(sellerWiseTDS),
        riders: Object.values(riderWiseTDS)
      },
      raw_data: {
        sellers: sellerTDS,
        riders: riderTDS
      },
      export_links: {
        csv: `/api/owner/finance/tds-reports?financial_year=${financial_year}&export_format=csv`,
        json: `/api/owner/finance/tds-reports?financial_year=${financial_year}&export_format=json`
      },
      generated_at: new Date().toISOString()
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json', ...corsHeaders }
    });

  } catch (error) {
    console.error('TDS reports error:', error);
    return new Response(JSON.stringify({
      success: false,
      error: error.message || 'Internal server error'
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json', ...corsHeaders }
    });
  }
}