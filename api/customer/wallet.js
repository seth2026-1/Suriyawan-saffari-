// api/customer/wallet.js
// Edge Function for Vercel Deployment

export const config = {
  runtime: 'edge',
  regions: ['iad1', 'sfo1', 'fra1', 'sin1'],
};

// Helper function to mask UPI ID
function maskUpi(upiId) {
  if (!upiId) return '';
  if (upiId.length <= 6) return '***' + upiId.slice(-3);
  return upiId.slice(0, 3) + '***' + upiId.slice(-4);
}

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
                'Prefer': 'return=representation'
              },
              body: JSON.stringify(data)
            });
            const result = await response.json();
            return { data: result[0] || result, error: null };
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

  try {
    const supabase = createSupabaseClient();
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

    // =====================================================
    // GET WALLET DETAILS
    // =====================================================
    if (request.method === 'GET') {
      const url = new URL(request.url);
      const cust_id = url.searchParams.get('cust_id');

      if (!cust_id) {
        return new Response(
          JSON.stringify({ success: false, error: 'Customer ID is required' }),
          { status: 400, headers: { 'Content-Type': 'application/json', ...corsHeaders } }
        );
      }

      // Get customer wallet and coins
      const customerResult = await supabase
        .from('customers')
        .select('wallet_balance, coins, trust_score, cod_status, cod_block_until')
        .eq('cust_id', cust_id)
        .single();

      if (customerResult.error || !customerResult.data) {
        return new Response(
          JSON.stringify({ success: false, error: 'Customer not found' }),
          { status: 404, headers: { 'Content-Type': 'application/json', ...corsHeaders } }
        );
      }

      const customer = customerResult.data;

      // Get wallet transaction history
      const walletTransactionsResult = await supabase
        .from('wallet_transactions')
        .select('*')
        .eq('user_id', cust_id)
        .eq('user_type', 'customer')
        .order('created_at', { ascending: false });

      const walletTransactions = walletTransactionsResult.data || [];

      // Get coin transaction history
      const coinTransactionsResult = await supabase
        .from('coin_transactions')
        .select('*')
        .eq('cust_id', cust_id)
        .order('created_at', { ascending: false });

      const coinTransactions = coinTransactionsResult.data || [];

      // Get pending payout requests
      const pendingPayoutsResult = await supabase
        .from('payouts')
        .select('*')
        .eq('user_id', cust_id)
        .eq('user_type', 'customer')
        .in('status', ['PENDING', 'PROCESSING'])
        .order('requested_at', { ascending: false });

      const pendingPayouts = pendingPayoutsResult.data || [];

      // Get settings
      const settingsResult = await supabase
        .from('system_settings')
        .select('setting_key, setting_value')
        .in('setting_key', ['min_payout_amount', 'coins_per_review', 'coins_order_percent', 'tds_percentage']);

      const settings = settingsResult.data || [];

      const minPayoutAmount = parseInt(settings.find(s => s.setting_key === 'min_payout_amount')?.setting_value || 100);
      const coinsPerReview = parseInt(settings.find(s => s.setting_key === 'coins_per_review')?.setting_value || 10);
      const coinsOrderPercent = parseInt(settings.find(s => s.setting_key === 'coins_order_percent')?.setting_value || 2);
      const tdsPercent = parseInt(settings.find(s => s.setting_key === 'tds_percentage')?.setting_value || 1);

      // Calculate total earned from coins
      const earnedCoins = coinTransactions.filter(t => t.type === 'credit').reduce((sum, t) => sum + t.coins, 0);
      const usedCoins = coinTransactions.filter(t => t.type === 'debit').reduce((sum, t) => sum + t.coins, 0);

      // Calculate wallet stats
      const totalWalletCredited = walletTransactions.filter(t => t.type === 'credit').reduce((sum, t) => sum + t.amount, 0);
      const totalWalletDebited = walletTransactions.filter(t => t.type === 'debit').reduce((sum, t) => sum + t.amount, 0);

      return new Response(
        JSON.stringify({
          success: true,
          wallet: {
            balance: customer.wallet_balance,
            coins: customer.coins,
            coins_value_rupees: customer.coins,
            trust_score: customer.trust_score,
            cod_status: customer.cod_status,
            cod_block_until: customer.cod_block_until
          },
          transactions: {
            wallet: walletTransactions.map(t => ({
              transaction_id: t.trans_id,
              amount: t.amount,
              type: t.type,
              reason: t.reason,
              reference_id: t.reference_id,
              created_at: t.created_at
            })),
            coins: coinTransactions.map(t => ({
              transaction_id: t.trans_id,
              coins: t.coins,
              type: t.type,
              reason: t.reason,
              reference_id: t.reference_id,
              created_at: t.created_at
            }))
          },
          pending_payouts: pendingPayouts.map(p => ({
            payout_id: p.payout_id,
            amount: p.amount,
            status: p.status,
            requested_at: p.requested_at
          })),
          settings: {
            min_payout_amount: minPayoutAmount,
            coins_per_review: coinsPerReview,
            coins_order_percent: coinsOrderPercent,
            tds_percentage: tdsPercent
          },
          stats: {
            total_wallet_credited: totalWalletCredited,
            total_wallet_debited: totalWalletDebited,
            total_coins_earned: earnedCoins,
            total_coins_used: usedCoins
          }
        }),
        { status: 200, headers: { 'Content-Type': 'application/json', ...corsHeaders } }
      );
    }

    // =====================================================
    // CLAIM WALLET TO UPI (Payout Request)
    // =====================================================
    if (request.method === 'POST') {
      const body = await request.json();
      const { cust_id, amount, upi_id } = body;

      if (!cust_id || !amount) {
        return new Response(
          JSON.stringify({ success: false, error: 'Customer ID and amount are required' }),
          { status: 400, headers: { 'Content-Type': 'application/json', ...corsHeaders } }
        );
      }

      // Get customer details
      const customerResult = await supabase
        .from('customers')
        .select('wallet_balance, upi_id as saved_upi_id, name, email, mobile')
        .eq('cust_id', cust_id)
        .single();

      if (customerResult.error || !customerResult.data) {
        return new Response(
          JSON.stringify({ success: false, error: 'Customer not found' }),
          { status: 404, headers: { 'Content-Type': 'application/json', ...corsHeaders } }
        );
      }

      const customer = customerResult.data;

      // Get minimum payout amount from settings
      const minSettingUrl = `${supabaseUrl}/rest/v1/system_settings?setting_key=eq.min_payout_amount&select=setting_value`;
      const minSettingResponse = await fetch(minSettingUrl, {
        headers: {
          'apikey': supabaseKey,
          'Authorization': `Bearer ${supabaseKey}`,
        },
      });
      const minSettingData = await minSettingResponse.json();
      const minSetting = minSettingData[0];
      const minPayoutAmount = minSetting ? parseInt(minSetting.setting_value) : 100;

      // Get TDS percentage
      const tdsSettingUrl = `${supabaseUrl}/rest/v1/system_settings?setting_key=eq.tds_percentage&select=setting_value`;
      const tdsSettingResponse = await fetch(tdsSettingUrl, {
        headers: {
          'apikey': supabaseKey,
          'Authorization': `Bearer ${supabaseKey}`,
        },
      });
      const tdsSettingData = await tdsSettingResponse.json();
      const tdsSetting = tdsSettingData[0];
      const tdsPercent = tdsSetting ? parseInt(tdsSetting.setting_value) : 1;

      // Validate amount
      if (amount < minPayoutAmount) {
        return new Response(
          JSON.stringify({ success: false, error: `Minimum payout amount is ₹${minPayoutAmount}` }),
          { status: 400, headers: { 'Content-Type': 'application/json', ...corsHeaders } }
        );
      }

      if (amount > customer.wallet_balance) {
        return new Response(
          JSON.stringify({ success: false, error: `Insufficient wallet balance. Available: ₹${customer.wallet_balance}` }),
          { status: 400, headers: { 'Content-Type': 'application/json', ...corsHeaders } }
        );
      }

      // Use provided UPI or saved UPI
      const finalUpiId = upi_id || customer.saved_upi_id;

      if (!finalUpiId) {
        return new Response(
          JSON.stringify({ success: false, error: 'UPI ID is required to claim payout. Please add UPI ID in profile.' }),
          { status: 400, headers: { 'Content-Type': 'application/json', ...corsHeaders } }
        );
      }

      // Check if there's already a pending payout request
      const pendingCheckUrl = `${supabaseUrl}/rest/v1/payouts?user_id=eq.${cust_id}&user_type=eq.customer&status=in.(PENDING,PROCESSING)&select=payout_id,status`;
      const pendingCheckResponse = await fetch(pendingCheckUrl, {
        headers: {
          'apikey': supabaseKey,
          'Authorization': `Bearer ${supabaseKey}`,
        },
      });
      const existingPayoutData = await pendingCheckResponse.json();
      const existingPayout = existingPayoutData[0];

      if (existingPayout) {
        return new Response(
          JSON.stringify({ success: false, error: `You already have a pending payout request (ID: ${existingPayout.payout_id}). Please wait for it to be processed.` }),
          { status: 400, headers: { 'Content-Type': 'application/json', ...corsHeaders } }
        );
      }

      // Calculate TDS
      const tdsAmount = Math.ceil((amount * tdsPercent) / 100);
      const netAmount = amount - tdsAmount;

      // Generate payout ID
      const payoutId = 'PYT' + Date.now() + Math.random().toString(36).substring(2, 6).toUpperCase();

      // Create payout request
      const payoutInsert = await supabase
        .from('payouts')
        .insert({
          payout_id: payoutId,
          user_id: cust_id,
          user_type: 'customer',
          amount: amount,
          upi_id: finalUpiId,
          tds_amount: tdsAmount,
          net_amount: netAmount,
          status: 'PENDING',
          notes: `Wallet claim by ${customer.name} (${customer.email})`,
          requested_at: new Date().toISOString()
        })
        .select();

      if (payoutInsert.error) {
        console.error('Payout creation error:', payoutInsert.error);
        return new Response(
          JSON.stringify({ success: false, error: 'Failed to create payout request' }),
          { status: 500, headers: { 'Content-Type': 'application/json', ...corsHeaders } }
        );
      }

      const payout = payoutInsert.data;

      // Deduct amount from wallet
      await fetch(`${supabaseUrl}/rest/v1/customers?cust_id=eq.${cust_id}`, {
        method: 'PATCH',
        headers: {
          'apikey': supabaseKey,
          'Authorization': `Bearer ${supabaseKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ wallet_balance: customer.wallet_balance - amount })
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
          user_id: cust_id,
          user_type: 'customer',
          amount: amount,
          type: 'debit',
          reason: `Payout request #${payout.payout_id}`,
          reference_id: payout.payout_id,
          created_at: new Date().toISOString()
        })
      });

      // Send notification to customer
      await fetch(`${supabaseUrl}/rest/v1/notifications`, {
        method: 'POST',
        headers: {
          'apikey': supabaseKey,
          'Authorization': `Bearer ${supabaseKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          user_id: cust_id,
          user_type: 'customer',
          title: 'Payout Request Submitted',
          message: `Your payout request of ₹${amount} has been submitted. TDS deducted: ₹${tdsAmount}. Net amount: ₹${netAmount}.`,
          type: 'payment',
          data: { payout_id: payout.payout_id, amount, net_amount: netAmount },
          created_at: new Date().toISOString()
        })
      });

      // Send notification to owner for approval
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
          title: 'New Payout Request',
          message: `Customer ${customer.name} requested payout of ₹${amount}. Payout ID: ${payout.payout_id}`,
          type: 'payment',
          data: { payout_id: payout.payout_id, cust_id, amount },
          created_at: new Date().toISOString()
        })
      });

      return new Response(
        JSON.stringify({
          success: true,
          message: 'Payout request submitted successfully',
          payout: {
            payout_id: payout.payout_id,
            requested_amount: amount,
            tds_amount: tdsAmount,
            net_amount: netAmount,
            upi_id: finalUpiId,
            status: 'PENDING',
            requested_at: payout.requested_at
          },
          wallet_balance: customer.wallet_balance - amount,
          note: `Amount will be credited to your UPI ID (${maskUpi(finalUpiId)}) within 2-3 business days after approval.`
        }),
        { status: 200, headers: { 'Content-Type': 'application/json', ...corsHeaders } }
      );
    }

    return new Response(
      JSON.stringify({ success: false, error: 'Method not allowed' }),
      { status: 405, headers: { 'Content-Type': 'application/json', ...corsHeaders } }
    );

  } catch (error) {
    console.error('Wallet error:', error);
    return new Response(
      JSON.stringify({ success: false, error: error.message || 'Internal server error' }),
      { status: 500, headers: { 'Content-Type': 'application/json', ...corsHeaders } }
    );
  }
}