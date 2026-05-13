// api/logistics/hub/cod-collect.js
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
            maybeSingle: async () => {
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
            gt: (gtField, gtValue) => ({
              order: (orderField, { ascending }) => ({
                range: async (from, to) => {
                  const sortOrder = ascending ? 'asc' : 'desc';
                  const finalUrl = `${url}&${field}=eq.${value}&${gtField}=gt.${gtValue}&order=${orderField}.${sortOrder}&offset=${from}&limit=${to - from + 1}`;
                  const response = await fetch(finalUrl, {
                    headers: {
                      'apikey': supabaseKey,
                      'Authorization': `Bearer ${supabaseKey}`,
                    },
                  });
                  const data = await response.json();
                  const count = response.headers.get('content-range')?.split('/')[1];
                  return { data, error: null, count: count ? parseInt(count) : null };
                }
              })
            }),
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
              range: async (from, to) => {
                const sortOrder = ascending ? 'asc' : 'desc';
                const finalUrl = `${url}&${field}=eq.${value}&order=${orderField}.${sortOrder}&offset=${from}&limit=${to - from + 1}`;
                const response = await fetch(finalUrl, {
                  headers: {
                    'apikey': supabaseKey,
                    'Authorization': `Bearer ${supabaseKey}`,
                  },
                });
                const data = await response.json();
                const count = response.headers.get('content-range')?.split('/')[1];
                return { data, error: null, count: count ? parseInt(count) : null };
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
            gt: (gtField, gtValue) => ({
              order: (orderField, { ascending }) => ({
                range: async (from, to) => {
                  const sortOrder = ascending ? 'asc' : 'desc';
                  const finalUrl = `${url}&${field}=eq.${value}&${gtField}=gt.${gtValue}&order=${orderField}.${sortOrder}&offset=${from}&limit=${to - from + 1}`;
                  const response = await fetch(finalUrl, {
                    headers: {
                      'apikey': supabaseKey,
                      'Authorization': `Bearer ${supabaseKey}`,
                    },
                  });
                  const data = await response.json();
                  const count = response.headers.get('content-range')?.split('/')[1];
                  return { data, error: null, count: count ? parseInt(count) : null };
                }
              })
            }),
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
              range: async (from, to) => {
                const sortOrder = ascending ? 'asc' : 'desc';
                const finalUrl = `${url}&${field}=eq.${value}&order=${orderField}.${sortOrder}&offset=${from}&limit=${to - from + 1}`;
                const response = await fetch(finalUrl, {
                  headers: {
                    'apikey': supabaseKey,
                    'Authorization': `Bearer ${supabaseKey}`,
                  },
                });
                const data = await response.json();
                const count = response.headers.get('content-range')?.split('/')[1];
                return { data, error: null, count: count ? parseInt(count) : null };
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
          return { data: result[0] || result, error: null };
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
              },
              body: JSON.stringify(data)
            });
            return { error: null };
          }
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
    'Access-Control-Allow-Methods': 'GET, POST, PUT, OPTIONS',
    'Access-Control-Allow-Headers': 'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version, Authorization',
  };

  // Handle OPTIONS preflight
  if (request.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: corsHeaders });
  }

  const url = new URL(request.url);

  // =====================================================
  // GET COD COLLECTION DATA
  // =====================================================
  if (request.method === 'GET') {
    try {
      const hub_id = url.searchParams.get('hub_id');
      const status = url.searchParams.get('status');
      const rider_id = url.searchParams.get('rider_id');
      const date = url.searchParams.get('date');
      const page = parseInt(url.searchParams.get('page') || '1');
      const limit = parseInt(url.searchParams.get('limit') || '20');

      if (!hub_id) {
        return new Response(JSON.stringify({ success: false, error: 'Hub ID is required' }), {
          status: 400,
          headers: { 'Content-Type': 'application/json', ...corsHeaders }
        });
      }

      const supabase = createSupabaseClient();
      const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
      const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

      const today = new Date().toISOString().split('T')[0];
      const targetDate = date || today;

      // Get runsheets with COD collection
      let runsheetsUrl = `${supabaseUrl}/rest/v1/runsheets?select=run_id,rider_id,shift,date,total_cod,status,riders!inner(name,mobile,upi_id),cash_deposits!left(deposit_id,amount,status,deposited_at)&hub_id=eq.${hub_id}&total_cod=gt.0&order=created_at.desc`;

      if (targetDate) {
        runsheetsUrl += `&date=eq.${targetDate}`;
      }

      if (rider_id) {
        runsheetsUrl += `&rider_id=eq.${rider_id}`;
      }

      if (status === 'pending') {
        runsheetsUrl += `&cash_deposits.deposit_id=is.null`;
      } else if (status === 'deposited') {
        runsheetsUrl += `&cash_deposits.deposit_id=not.is.null`;
      }

      const from = (page - 1) * limit;
      const to = from + limit - 1;
      runsheetsUrl += `&offset=${from}&limit=${limit}`;

      const runsheetsResponse = await fetch(runsheetsUrl, {
        headers: {
          'apikey': supabaseKey,
          'Authorization': `Bearer ${supabaseKey}`,
        },
      });
      const runsheets = await runsheetsResponse.json();
      const count = parseInt(runsheetsResponse.headers.get('content-range')?.split('/')[1] || '0');

      // Get COD statistics
      const allRunsheetsUrl = `${supabaseUrl}/rest/v1/runsheets?select=total_cod,date&hub_id=eq.${hub_id}&total_cod=gt.0`;
      const allRunsheetsResponse = await fetch(allRunsheetsUrl, {
        headers: {
          'apikey': supabaseKey,
          'Authorization': `Bearer ${supabaseKey}`,
        },
      });
      const allRunsheets = await allRunsheetsResponse.json();

      const totalCodCollected = allRunsheets?.reduce((sum, r) => sum + (r.total_cod || 0), 0) || 0;

      const depositedRunsheetsUrl = `${supabaseUrl}/rest/v1/cash_deposits?select=amount&hub_id=eq.${hub_id}`;
      const depositedRunsheetsResponse = await fetch(depositedRunsheetsUrl, {
        headers: {
          'apikey': supabaseKey,
          'Authorization': `Bearer ${supabaseKey}`,
        },
      });
      const depositedRunsheets = await depositedRunsheetsResponse.json();

      const totalDeposited = depositedRunsheets?.reduce((sum, d) => sum + (d.amount || 0), 0) || 0;
      const pendingCod = totalCodCollected - totalDeposited;

      const todayRunsheets = allRunsheets?.filter(r => r.date === today) || [];
      const todayCod = todayRunsheets.reduce((sum, r) => sum + (r.total_cod || 0), 0) || 0;

      const stats = {
        total_cod_collected: totalCodCollected,
        total_deposited: totalDeposited,
        pending_deposit: pendingCod,
        today_collection: todayCod,
        pending_runsheets: runsheets?.filter(r => !r.cash_deposits).length || 0
      };

      return new Response(JSON.stringify({
        success: true,
        cod_runsheets: runsheets?.map(r => ({
          run_id: r.run_id,
          rider_name: r.riders?.name,
          rider_mobile: r.riders?.mobile,
          rider_upi: r.riders?.upi_id,
          shift: r.shift,
          date: r.date,
          total_cod: r.total_cod,
          deposit: r.cash_deposits,
          status: r.cash_deposits ? 'deposited' : 'pending'
        })) || [],
        stats: stats,
        pagination: {
          current_page: page,
          total_pages: Math.ceil(count / limit),
          total_items: count,
          items_per_page: limit
        }
      }), {
        status: 200,
        headers: { 'Content-Type': 'application/json', ...corsHeaders }
      });

    } catch (error) {
      console.error('Get COD collection error:', error);
      return new Response(JSON.stringify({ success: false, error: error.message }), {
        status: 500,
        headers: { 'Content-Type': 'application/json', ...corsHeaders }
      });
    }
  }

  // =====================================================
  // RECORD COD DEPOSIT (POST)
  // =====================================================
  if (request.method === 'POST') {
    try {
      const body = await request.json();
      const {
        hub_id,
        run_id,
        rider_id,
        amount,
        deposit_method,
        bank_reference,
        notes
      } = body;

      if (!hub_id || !run_id || !amount) {
        return new Response(JSON.stringify({
          success: false,
          error: 'Hub ID, Runsheet ID and amount are required'
        }), {
          status: 400,
          headers: { 'Content-Type': 'application/json', ...corsHeaders }
        });
      }

      const supabase = createSupabaseClient();
      const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
      const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

      // Verify runsheet exists
      const runsheetUrl = `${supabaseUrl}/rest/v1/runsheets?run_id=eq.${run_id}&hub_id=eq.${hub_id}&select=run_id,total_cod,rider_id,date`;
      const runsheetResponse = await fetch(runsheetUrl, {
        headers: {
          'apikey': supabaseKey,
          'Authorization': `Bearer ${supabaseKey}`,
        },
      });
      const runsheetData = await runsheetResponse.json();
      const runsheet = runsheetData[0];

      if (!runsheet) {
        return new Response(JSON.stringify({ success: false, error: 'Runsheet not found' }), {
          status: 404,
          headers: { 'Content-Type': 'application/json', ...corsHeaders }
        });
      }

      // Check if already deposited
      const existingUrl = `${supabaseUrl}/rest/v1/cash_deposits?run_id=eq.${run_id}&select=deposit_id`;
      const existingResponse = await fetch(existingUrl, {
        headers: {
          'apikey': supabaseKey,
          'Authorization': `Bearer ${supabaseKey}`,
        },
      });
      const existingData = await existingResponse.json();
      const existingDeposit = existingData[0];

      if (existingDeposit) {
        return new Response(JSON.stringify({
          success: false,
          error: 'COD already deposited for this runsheet'
        }), {
          status: 400,
          headers: { 'Content-Type': 'application/json', ...corsHeaders }
        });
      }

      // Validate amount
      if (amount !== runsheet.total_cod) {
        return new Response(JSON.stringify({
          success: false,
          error: `Amount mismatch. Expected: ₹${runsheet.total_cod}, Received: ₹${amount}`
        }), {
          status: 400,
          headers: { 'Content-Type': 'application/json', ...corsHeaders }
        });
      }

      // Create deposit record
      const depositInsert = await supabase
        .from('cash_deposits')
        .insert({
          hub_id,
          run_id,
          rider_id: rider_id || runsheet.rider_id,
          amount: amount,
          deposit_method: deposit_method || 'cash',
          bank_reference: bank_reference || null,
          status: 'COMPLETED',
          deposited_at: new Date().toISOString(),
          notes: notes || null,
          created_at: new Date().toISOString()
        })
        .select();

      if (depositInsert.error) {
        console.error('Deposit creation error:', depositInsert.error);
        return new Response(JSON.stringify({ success: false, error: depositInsert.error.message }), {
          status: 500,
          headers: { 'Content-Type': 'application/json', ...corsHeaders }
        });
      }

      const deposit = depositInsert.data;

      // Update runsheet status if not completed
      if (runsheet.status !== 'COMPLETED') {
        await fetch(`${supabaseUrl}/rest/v1/runsheets?run_id=eq.${run_id}`, {
          method: 'PATCH',
          headers: {
            'apikey': supabaseKey,
            'Authorization': `Bearer ${supabaseKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ status: 'COMPLETED', completed_at: new Date().toISOString() })
        });
      }

      // Get rider details for notification
      const riderUrl = `${supabaseUrl}/rest/v1/riders?rider_id=eq.${rider_id || runsheet.rider_id}&select=name,mobile`;
      const riderResponse = await fetch(riderUrl, {
        headers: {
          'apikey': supabaseKey,
          'Authorization': `Bearer ${supabaseKey}`,
        },
      });
      const riderData = await riderResponse.json();
      const rider = riderData[0];

      // Send notification to rider
      if (rider) {
        await fetch(`${supabaseUrl}/rest/v1/notifications`, {
          method: 'POST',
          headers: {
            'apikey': supabaseKey,
            'Authorization': `Bearer ${supabaseKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            user_id: rider_id || runsheet.rider_id,
            user_type: 'rider',
            title: 'COD Deposit Confirmed',
            message: `Your COD deposit of ₹${amount} for runsheet ${run_id} has been confirmed.`,
            type: 'payment',
            data: { run_id, amount },
            created_at: new Date().toISOString()
          })
        });
      }

      // Send notification to owner
      await fetch(`${supabaseUrl}/rest/v1/notifications`, {
        method: 'POST',
        headers: {
          'apikey': supabaseKey,
          'Authorization': `Bearer ${supabaseKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          user_id: 'OWN001',
          user_type: 'owner',
          title: 'COD Deposit Received',
          message: `COD deposit of ₹${amount} received from hub ${hub_id} for runsheet ${run_id}`,
          type: 'payment',
          data: { hub_id, run_id, amount },
          created_at: new Date().toISOString()
        })
      });

      return new Response(JSON.stringify({
        success: true,
        message: `COD deposit of ₹${amount} recorded successfully`,
        deposit: {
          deposit_id: deposit.deposit_id,
          amount: deposit.amount,
          deposit_method: deposit.deposit_method,
          deposited_at: deposit.deposited_at,
          status: deposit.status
        },
        runsheet: {
          run_id: run_id,
          total_cod: runsheet.total_cod,
          status: 'COMPLETED'
        }
      }), {
        status: 200,
        headers: { 'Content-Type': 'application/json', ...corsHeaders }
      });

    } catch (error) {
      console.error('Record COD deposit error:', error);
      return new Response(JSON.stringify({ success: false, error: error.message }), {
        status: 500,
        headers: { 'Content-Type': 'application/json', ...corsHeaders }
      });
    }
  }

  // =====================================================
  // GET COD REMITTANCE DETAILS (PUT)
  // =====================================================
  if (request.method === 'PUT') {
    try {
      const body = await request.json();
      const { hub_id, date, seller_id } = body;

      if (!hub_id) {
        return new Response(JSON.stringify({ success: false, error: 'Hub ID is required' }), {
          status: 400,
          headers: { 'Content-Type': 'application/json', ...corsHeaders }
        });
      }

      const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
      const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

      const targetDate = date || new Date().toISOString().split('T')[0];

      // Get all completed deliveries for the date
      let ordersUrl = `${supabaseUrl}/rest/v1/orders?select=book_id,seller_id,final_amount,delivered_at,sellers!inner(seller_id,shop_name,upi_id,commission_rate,email)&status=eq.DELIVERED&payment_method=eq.COD&delivered_at=gte.${targetDate}T00:00:00&delivered_at=lte.${targetDate}T23:59:59`;

      if (seller_id) {
        ordersUrl += `&seller_id=eq.${seller_id}`;
      }

      const ordersResponse = await fetch(ordersUrl, {
        headers: {
          'apikey': supabaseKey,
          'Authorization': `Bearer ${supabaseKey}`,
        },
      });
      const deliveredOrders = await ordersResponse.json();

      // Group by seller and calculate remittance
      const sellerRemittance = {};
      for (const order of deliveredOrders || []) {
        const sellerId = order.seller_id;
        if (!sellerRemittance[sellerId]) {
          sellerRemittance[sellerId] = {
            seller_id: sellerId,
            shop_name: order.sellers?.shop_name,
            upi_id: order.sellers?.upi_id,
            email: order.sellers?.email,
            commission_rate: order.sellers?.commission_rate || 10,
            total_amount: 0,
            orders: []
          };
        }
        sellerRemittance[sellerId].total_amount += order.final_amount;
        sellerRemittance[sellerId].orders.push({
          book_id: order.book_id,
          amount: order.final_amount,
          delivered_at: order.delivered_at
        });
      }

      // Calculate net payable after commission
      const remittanceData = Object.values(sellerRemittance).map(s => ({
        ...s,
        commission_amount: (s.total_amount * s.commission_rate) / 100,
        net_payable: s.total_amount - ((s.total_amount * s.commission_rate) / 100)
      }));

      const totalOrdersAmount = deliveredOrders?.reduce((sum, o) => sum + (o.final_amount || 0), 0) || 0;
      const totalRemittance = remittanceData.reduce((sum, r) => sum + r.net_payable, 0);
      const totalCommission = totalOrdersAmount - totalRemittance;

      return new Response(JSON.stringify({
        success: true,
        date: targetDate,
        total_orders: deliveredOrders?.length || 0,
        total_amount: totalOrdersAmount,
        total_commission: totalCommission,
        total_remittance: totalRemittance,
        seller_remittance: remittanceData
      }), {
        status: 200,
        headers: { 'Content-Type': 'application/json', ...corsHeaders }
      });

    } catch (error) {
      console.error('Get COD remittance error:', error);
      return new Response(JSON.stringify({ success: false, error: error.message }), {
        status: 500,
        headers: { 'Content-Type': 'application/json', ...corsHeaders }
      });
    }
  }

  return new Response(JSON.stringify({ success: false, error: 'Method not allowed' }), {
    status: 405,
    headers: { 'Content-Type': 'application/json', ...corsHeaders }
  });
}