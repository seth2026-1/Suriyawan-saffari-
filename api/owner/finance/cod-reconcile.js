// api/owner/finance/cod-reconcile.js
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
          gte: (gteField, gteValue) => ({
            lte: (lteField, lteValue) => ({
              select: async () => {
                const finalUrl = `${url}&${gteField}=gte.${gteValue}&${lteField}=lte.${lteValue}`;
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
            }),
            not: (notField, notOperator, notValue) => ({
              in: (inField, inValues) => ({
                gte: (gteField, gteValue) => ({
                  lte: (lteField, lteValue) => ({
                    select: async () => {
                      const finalUrl = `${url}&${field}=eq.${value}&${notField}=${notOperator}.${notValue}&${inField}=in.(${inValues.join(',')})&${gteField}=gte.${gteValue}&${lteField}=lte.${lteValue}`;
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
        }),
        in: (field, values) => ({
          select: async () => {
            const response = await fetch(`${supabaseUrl}/rest/v1/${table}?${field}=in.(${values.join(',')})`, {
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
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version, Authorization',
  };

  // Handle OPTIONS preflight
  if (request.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: corsHeaders });
  }

  const url = new URL(request.url);
  const supabase = createSupabaseClient();
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  // =====================================================
  // GET COD RECONCILIATION DATA
  // =====================================================
  if (request.method === 'GET') {
    try {
      const date = url.searchParams.get('date');
      const from_date = url.searchParams.get('from_date');
      const to_date = url.searchParams.get('to_date');
      const hub_id = url.searchParams.get('hub_id');
      const page = parseInt(url.searchParams.get('page') || '1');
      const limit = parseInt(url.searchParams.get('limit') || '50');

      const targetDate = date || new Date().toISOString().split('T')[0];
      const startDate = from_date || targetDate;
      const endDate = to_date || targetDate;

      // Get COD payments collected by riders with nested joins
      const codSelect = `*, riders!inner(rider_id,name,mobile,upi_id), orders!inner(book_id,final_amount,seller_id,customers!inner(cust_id,name,mobile),sellers!inner(seller_id,shop_name,upi_id as seller_upi_id))`;
      const codPaymentsUrl = `${supabaseUrl}/rest/v1/cod_payments?select=${encodeURIComponent(codSelect)}&created_at=gte.${startDate}T00:00:00&created_at=lte.${endDate}T23:59:59`;
      const codPaymentsResponse = await fetch(codPaymentsUrl, {
        headers: {
          'apikey': supabaseKey,
          'Authorization': `Bearer ${supabaseKey}`,
        },
      });
      const codPayments = await codPaymentsResponse.json();

      // Get cash deposits from riders to hubs
      const depositSelect = `*, riders!inner(rider_id,name,mobile), hub_managers!inner(hub_id,name as hub_name)`;
      const cashDepositsUrl = `${supabaseUrl}/rest/v1/cash_deposits?select=${encodeURIComponent(depositSelect)}&deposited_at=gte.${startDate}T00:00:00&deposited_at=lte.${endDate}T23:59:59`;
      const cashDepositsResponse = await fetch(cashDepositsUrl, {
        headers: {
          'apikey': supabaseKey,
          'Authorization': `Bearer ${supabaseKey}`,
        },
      });
      const cashDeposits = await cashDepositsResponse.json();

      // Get COD remittances to sellers
      const remitSelect = `*, sellers!inner(seller_id,shop_name,upi_id)`;
      const codRemittancesUrl = `${supabaseUrl}/rest/v1/cod_remittances?select=${encodeURIComponent(remitSelect)}&remitted_at=gte.${startDate}T00:00:00&remitted_at=lte.${endDate}T23:59:59`;
      const codRemittancesResponse = await fetch(codRemittancesUrl, {
        headers: {
          'apikey': supabaseKey,
          'Authorization': `Bearer ${supabaseKey}`,
        },
      });
      const codRemittances = await codRemittancesResponse.json();

      // Calculate totals
      const totalCollected = codPayments?.reduce((sum, p) => sum + p.amount, 0) || 0;
      const totalDeposited = cashDeposits?.reduce((sum, d) => sum + d.amount, 0) || 0;
      const totalRemitted = codRemittances?.reduce((sum, r) => sum + r.amount, 0) || 0;

      const pendingDeposit = totalCollected - totalDeposited;
      const pendingRemittance = totalDeposited - totalRemitted;

      // Get undeposited payments
      // First get all deposit payment IDs
      const depositPaymentIds = cashDeposits?.map(d => d.payment_id).filter(Boolean) || [];
      let undepositedPayments = [];
      if (depositPaymentIds.length > 0) {
        const undepositedUrl = `${supabaseUrl}/rest/v1/cod_payments?select=amount,rider_id,riders(name)&created_at=gte.${startDate}T00:00:00&created_at=lte.${endDate}T23:59:59&payment_id=not.in.(${depositPaymentIds.join(',')})`;
        const undepositedResponse = await fetch(undepositedUrl, {
          headers: {
            'apikey': supabaseKey,
            'Authorization': `Bearer ${supabaseKey}`,
          },
        });
        undepositedPayments = await undepositedResponse.json();
      } else {
        const undepositedUrl = `${supabaseUrl}/rest/v1/cod_payments?select=amount,rider_id,riders(name)&created_at=gte.${startDate}T00:00:00&created_at=lte.${endDate}T23:59:59`;
        const undepositedResponse = await fetch(undepositedUrl, {
          headers: {
            'apikey': supabaseKey,
            'Authorization': `Bearer ${supabaseKey}`,
          },
        });
        undepositedPayments = await undepositedResponse.json();
      }

      // Get unremitted deposits
      const remitDepositIds = codRemittances?.flatMap(r => r.deposit_ids || []) || [];
      let unremittedDeposits = [];
      if (remitDepositIds.length > 0) {
        const unremittedUrl = `${supabaseUrl}/rest/v1/cash_deposits?select=amount,deposit_id,deposited_at,deposit_method,bank_reference,notes,riders!inner(name),hub_managers!inner(name)&deposit_id=not.in.(${remitDepositIds.join(',')})&deposited_at=gte.${startDate}T00:00:00&deposited_at=lte.${endDate}T23:59:59`;
        const unremittedResponse = await fetch(unremittedUrl, {
          headers: {
            'apikey': supabaseKey,
            'Authorization': `Bearer ${supabaseKey}`,
          },
        });
        unremittedDeposits = await unremittedResponse.json();
      } else {
        const unremittedUrl = `${supabaseUrl}/rest/v1/cash_deposits?select=amount,deposit_id,deposited_at,deposit_method,bank_reference,notes,riders!inner(name),hub_managers!inner(name)&deposited_at=gte.${startDate}T00:00:00&deposited_at=lte.${endDate}T23:59:59`;
        const unremittedResponse = await fetch(unremittedUrl, {
          headers: {
            'apikey': supabaseKey,
            'Authorization': `Bearer ${supabaseKey}`,
          },
        });
        unremittedDeposits = await unremittedResponse.json();
      }

      // Group by rider for pending collection
      const riderWiseCollection = {};
      undepositedPayments?.forEach(p => {
        const riderId = p.rider_id;
        if (!riderWiseCollection[riderId]) {
          riderWiseCollection[riderId] = {
            rider_id: riderId,
            rider_name: p.riders?.name,
            amount: 0,
            payments: []
          };
        }
        riderWiseCollection[riderId].amount += p.amount;
        riderWiseCollection[riderId].payments.push(p);
      });

      // Group by hub for pending remittance
      const hubWiseRemittance = {};
      unremittedDeposits?.forEach(d => {
        const hubId = d.hub_id;
        if (!hubWiseRemittance[hubId]) {
          hubWiseRemittance[hubId] = {
            hub_id: hubId,
            hub_name: d.hub_managers?.name,
            amount: 0,
            deposits: []
          };
        }
        hubWiseRemittance[hubId].amount += d.amount;
        hubWiseRemittance[hubId].deposits.push(d);
      });

      // Calculate seller-wise payable amounts
      const sellerWisePayable = {};
      codPayments?.forEach(p => {
        const sellerId = p.orders?.sellers?.seller_id;
        if (sellerId) {
          if (!sellerWisePayable[sellerId]) {
            sellerWisePayable[sellerId] = {
              seller_id: sellerId,
              shop_name: p.orders?.sellers?.shop_name,
              upi_id: p.orders?.sellers?.seller_upi_id,
              total_amount: 0,
              orders: []
            };
          }
          sellerWisePayable[sellerId].total_amount += p.amount;
          sellerWisePayable[sellerId].orders.push({
            book_id: p.book_id,
            amount: p.amount,
            customer_name: p.orders?.customers?.name,
            collected_at: p.created_at
          });
        }
      });

      return new Response(JSON.stringify({
        success: true,
        date_range: {
          from: startDate,
          to: endDate
        },
        summary: {
          total_collected: totalCollected,
          total_deposited: totalDeposited,
          total_remitted: totalRemitted,
          pending_deposit: pendingDeposit,
          pending_remittance: pendingRemittance,
          reconciliation_status: pendingDeposit === 0 && pendingRemittance === 0 ? 'RECONCILED' : 'PENDING'
        },
        pending_collections: {
          total: pendingDeposit,
          rider_wise: Object.values(riderWiseCollection)
        },
        pending_remittances: {
          total: pendingRemittance,
          hub_wise: Object.values(hubWiseRemittance)
        },
        seller_payables: Object.values(sellerWisePayable),
        deposits: cashDeposits?.map(d => ({
          deposit_id: d.deposit_id,
          amount: d.amount,
          rider_name: d.riders?.name,
          hub_name: d.hub_managers?.hub_name,
          deposited_at: d.deposited_at,
          status: d.status
        })) || [],
        remittances: codRemittances?.map(r => ({
          remittance_id: r.remittance_id,
          amount: r.amount,
          seller_name: r.sellers?.shop_name,
          upi_id: r.sellers?.upi_id,
          utr_number: r.utr_number,
          remitted_at: r.remitted_at
        })) || [],
        pagination: {
          current_page: page,
          total_items: codPayments?.length || 0,
          items_per_page: limit
        }
      }), {
        status: 200,
        headers: { 'Content-Type': 'application/json', ...corsHeaders }
      });

    } catch (error) {
      console.error('COD reconcile error:', error);
      return new Response(JSON.stringify({ success: false, error: error.message }), {
        status: 500,
        headers: { 'Content-Type': 'application/json', ...corsHeaders }
      });
    }
  }

  // =====================================================
  // CREATE COD REMITTANCE (POST)
  // =====================================================
  if (request.method === 'POST') {
    try {
      const body = await request.json();
      const {
        seller_id,
        amount,
        upi_id,
        utr_number,
        notes,
        deposit_ids
      } = body;

      if (!seller_id || !amount || !upi_id) {
        return new Response(JSON.stringify({
          success: false,
          error: 'Seller ID, amount and UPI ID are required'
        }), {
          status: 400,
          headers: { 'Content-Type': 'application/json', ...corsHeaders }
        });
      }

      const supabase = createSupabaseClient();
      const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
      const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

      // Get seller details
      const sellerResult = await supabase
        .from('sellers')
        .select('shop_name, email, mobile, upi_id, wallet_balance')
        .eq('seller_id', seller_id)
        .single();

      if (sellerResult.error || !sellerResult.data) {
        return new Response(JSON.stringify({ success: false, error: 'Seller not found' }), {
          status: 404,
          headers: { 'Content-Type': 'application/json', ...corsHeaders }
        });
      }

      const seller = sellerResult.data;

      // Calculate TDS (1%)
      const tdsAmount = Math.ceil(amount * 0.01);
      const netAmount = amount - tdsAmount;

      // Create remittance record
      const remitInsert = await supabase
        .from('cod_remittances')
        .insert({
          seller_id,
          amount,
          tds_amount: tdsAmount,
          net_amount: netAmount,
          upi_id,
          utr_number: utr_number || null,
          notes: notes || null,
          deposit_ids: deposit_ids || [],
          status: 'COMPLETED',
          remitted_at: new Date().toISOString(),
          created_by: 'OWN001',
          created_at: new Date().toISOString()
        })
        .select();

      if (remitInsert.error) {
        console.error('Remittance creation error:', remitInsert.error);
        return new Response(JSON.stringify({ success: false, error: remitInsert.error.message }), {
          status: 500,
          headers: { 'Content-Type': 'application/json', ...corsHeaders }
        });
      }

      const remittance = remitInsert.data;

      // Update seller wallet (deduct remitted amount)
      const currentWallet = seller.wallet_balance;
      await fetch(`${supabaseUrl}/rest/v1/sellers?seller_id=eq.${seller_id}`, {
        method: 'PATCH',
        headers: {
          'apikey': supabaseKey,
          'Authorization': `Bearer ${supabaseKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          wallet_balance: currentWallet - amount,
          updated_at: new Date().toISOString()
        })
      });

      // Record wallet transaction
      await fetch(`${supabaseUrl}/rest/v1/wallet_transactions`, {
        method: 'POST',
        headers: {
          'apikey': supabaseKey,
          'Authorization': `Bearer ${supabaseKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          user_id: seller_id,
          user_type: 'seller',
          amount: amount,
          type: 'debit',
          reason: `COD remittance - ${remittance.remittance_id}`,
          reference_id: remittance.remittance_id,
          created_at: new Date().toISOString()
        })
      });

      // Mark deposits as remitted
      if (deposit_ids && deposit_ids.length > 0) {
        await fetch(`${supabaseUrl}/rest/v1/cash_deposits?deposit_id=in.(${deposit_ids.join(',')})`, {
          method: 'PATCH',
          headers: {
            'apikey': supabaseKey,
            'Authorization': `Bearer ${supabaseKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ remitted: true, remitted_at: new Date().toISOString() })
        });
      }

      // Send notification to seller
      await fetch(`${supabaseUrl}/rest/v1/notifications`, {
        method: 'POST',
        headers: {
          'apikey': supabaseKey,
          'Authorization': `Bearer ${supabaseKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          user_id: seller_id,
          user_type: 'seller',
          title: 'COD Remittance Processed',
          message: `COD amount of ₹${amount} has been remitted to your UPI ID. TDS deducted: ₹${tdsAmount}. Net amount: ₹${netAmount}. UTR: ${utr_number || 'Pending'}`,
          type: 'payment',
          data: { remittance_id: remittance.remittance_id, amount, net_amount: netAmount },
          created_at: new Date().toISOString()
        })
      });

      return new Response(JSON.stringify({
        success: true,
        message: 'COD remittance processed successfully',
        remittance: {
          remittance_id: remittance.remittance_id,
          amount: remittance.amount,
          tds_amount: remittance.tds_amount,
          net_amount: remittance.net_amount,
          upi_id: remittance.upi_id,
          utr_number: remittance.utr_number,
          remitted_at: remittance.remitted_at
        }
      }), {
        status: 200,
        headers: { 'Content-Type': 'application/json', ...corsHeaders }
      });

    } catch (error) {
      console.error('Process COD remittance error:', error);
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