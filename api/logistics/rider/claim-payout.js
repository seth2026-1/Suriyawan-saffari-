// api/logistics/rider/claim-payout.js
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
              maybeSingle: async () => {
                const finalUrl = `${url}&${field}=eq.${value}&${field2}=in.(${values.join(',')})`;
                const response = await fetch(finalUrl, {
                  headers: {
                    'apikey': supabaseKey,
                    'Authorization': `Bearer ${supabaseKey}`,
                  },
                });
                const data = await response.json();
                return { data: data[0] || null, error: null };
              }
            }),
            gte: (gteField, gteValue) => ({
              select: async () => {
                const finalUrl = `${url}&${field}=eq.${value}&${gteField}=gte.${gteValue}`;
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
            gte: (gteField, gteValue) => ({
              lte: (lteField, lteValue) => ({
                order: (orderField, { ascending }) => ({
                  select: async () => {
                    const sortOrder = ascending ? 'asc' : 'desc';
                    const finalUrl = `${url}&${field}=eq.${value}&${gteField}=gte.${gteValue}&${lteField}=lte.${lteValue}&order=${orderField}.${sortOrder}`;
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
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version, Authorization',
  };

  // Handle OPTIONS preflight
  if (request.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: corsHeaders });
  }

  const url = new URL(request.url);

  // =====================================================
  // GET CLAIM ELIGIBILITY (GET)
  // =====================================================
  if (request.method === 'GET') {
    try {
      const rider_id = url.searchParams.get('rider_id');

      if (!rider_id) {
        return new Response(JSON.stringify({ success: false, error: 'Rider ID is required' }), {
          status: 400,
          headers: { 'Content-Type': 'application/json', ...corsHeaders }
        });
      }

      const supabase = createSupabaseClient();
      const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
      const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

      // Get rider details
      const riderResult = await supabase
        .from('riders')
        .select('rider_id, name, wallet_balance, upi_id, email, mobile, rating, is_active')
        .eq('rider_id', rider_id)
        .single();

      if (riderResult.error || !riderResult.data) {
        return new Response(JSON.stringify({ success: false, error: 'Rider not found' }), {
          status: 404,
          headers: { 'Content-Type': 'application/json', ...corsHeaders }
        });
      }

      const rider = riderResult.data;

      if (!rider.is_active) {
        return new Response(JSON.stringify({
          success: false,
          error: 'Your account is inactive. Please contact hub manager.'
        }), {
          status: 403,
          headers: { 'Content-Type': 'application/json', ...corsHeaders }
        });
      }

      // Get settings
      const settingsUrl = `${supabaseUrl}/rest/v1/system_settings?setting_key=in.(min_payout_amount,tds_percentage,payout_processing_days)&select=setting_key,setting_value`;
      const settingsResponse = await fetch(settingsUrl, {
        headers: {
          'apikey': supabaseKey,
          'Authorization': `Bearer ${supabaseKey}`,
        },
      });
      const settings = await settingsResponse.json();

      const minPayoutAmount = parseInt(settings.find(s => s.setting_key === 'min_payout_amount')?.setting_value || 100);
      const tdsPercentage = parseInt(settings.find(s => s.setting_key === 'tds_percentage')?.setting_value || 1);
      const processingDays = parseInt(settings.find(s => s.setting_key === 'payout_processing_days')?.setting_value || 2);

      // Check for existing pending payout
      const pendingUrl = `${supabaseUrl}/rest/v1/payouts?user_id=eq.${rider_id}&user_type=eq.rider&status=in.(PENDING,PROCESSING)&select=payout_id,status,requested_at`;
      const pendingResponse = await fetch(pendingUrl, {
        headers: {
          'apikey': supabaseKey,
          'Authorization': `Bearer ${supabaseKey}`,
        },
      });
      const pendingData = await pendingResponse.json();
      const existingPayout = pendingData[0];

      const hasPendingPayout = !!existingPayout;
      const pendingPayoutId = existingPayout?.payout_id;
      const pendingSince = existingPayout?.requested_at;

      // Check if can claim
      const canClaim = !hasPendingPayout &&
                       rider.wallet_balance >= minPayoutAmount &&
                       rider.upi_id;

      // Calculate TDS
      const tdsAmount = Math.ceil((rider.wallet_balance * tdsPercentage) / 100);
      const netAmount = rider.wallet_balance - tdsAmount;

      // Get last payout date
      const lastPayoutUrl = `${supabaseUrl}/rest/v1/payouts?user_id=eq.${rider_id}&user_type=eq.rider&status=eq.COMPLETED&order=completed_at.desc&limit=1&select=completed_at`;
      const lastPayoutResponse = await fetch(lastPayoutUrl, {
        headers: {
          'apikey': supabaseKey,
          'Authorization': `Bearer ${supabaseKey}`,
        },
      });
      const lastPayoutData = await lastPayoutResponse.json();
      const lastPayout = lastPayoutData[0];
      const lastPayoutDate = lastPayout?.completed_at;

      // Get recent earnings summary (last 7 days)
      const weekAgo = new Date();
      weekAgo.setDate(weekAgo.getDate() - 7);
      const weekAgoStr = weekAgo.toISOString();

      const weekTransactionsUrl = `${supabaseUrl}/rest/v1/wallet_transactions?select=amount&user_id=eq.${rider_id}&user_type=eq.rider&type=eq.credit&created_at=gte.${weekAgoStr}`;
      const weekTransactionsResponse = await fetch(weekTransactionsUrl, {
        headers: {
          'apikey': supabaseKey,
          'Authorization': `Bearer ${supabaseKey}`,
        },
      });
      const weekTransactions = await weekTransactionsResponse.json();

      const weekEarnings = weekTransactions?.reduce((sum, t) => sum + t.amount, 0) || 0;

      return new Response(JSON.stringify({
        success: true,
        eligibility: {
          can_claim: canClaim,
          has_pending_payout: hasPendingPayout,
          pending_payout_id: pendingPayoutId,
          pending_since: pendingSince,
          reasons: {
            insufficient_balance: rider.wallet_balance < minPayoutAmount,
            no_upi_id: !rider.upi_id,
            below_min_amount: rider.wallet_balance < minPayoutAmount
          }
        },
        wallet: {
          balance: rider.wallet_balance,
          min_payout_amount: minPayoutAmount,
          shortfall: canClaim ? 0 : minPayoutAmount - rider.wallet_balance
        },
        payout_details: {
          tds_percentage: tdsPercentage,
          tds_amount: tdsAmount,
          net_amount: netAmount,
          processing_days: processingDays,
          upi_id: rider.upi_id ? maskUpi(rider.upi_id) : null,
          upi_id_exists: !!rider.upi_id,
          last_payout_date: lastPayoutDate
        },
        recent_earnings: {
          week: weekEarnings,
          today: 0
        },
        rider_name: rider.name
      }), {
        status: 200,
        headers: { 'Content-Type': 'application/json', ...corsHeaders }
      });

    } catch (error) {
      console.error('Get claim eligibility error:', error);
      return new Response(JSON.stringify({ success: false, error: error.message }), {
        status: 500,
        headers: { 'Content-Type': 'application/json', ...corsHeaders }
      });
    }
  }

  // =====================================================
  // SUBMIT CLAIM REQUEST (POST)
  // =====================================================
  if (request.method === 'POST') {
    try {
      const body = await request.json();
      const { rider_id, amount, upi_id } = body;

      if (!rider_id) {
        return new Response(JSON.stringify({ success: false, error: 'Rider ID is required' }), {
          status: 400,
          headers: { 'Content-Type': 'application/json', ...corsHeaders }
        });
      }

      const supabase = createSupabaseClient();
      const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
      const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

      // Get rider details
      const riderResult = await supabase
        .from('riders')
        .select('rider_id, name, wallet_balance, upi_id as saved_upi_id, email, mobile, rating, is_active')
        .eq('rider_id', rider_id)
        .single();

      if (riderResult.error || !riderResult.data) {
        return new Response(JSON.stringify({ success: false, error: 'Rider not found' }), {
          status: 404,
          headers: { 'Content-Type': 'application/json', ...corsHeaders }
        });
      }

      const rider = riderResult.data;

      if (!rider.is_active) {
        return new Response(JSON.stringify({
          success: false,
          error: 'Your account is inactive. Please contact hub manager.'
        }), {
          status: 403,
          headers: { 'Content-Type': 'application/json', ...corsHeaders }
        });
      }

      // Get settings
      const settingsUrl = `${supabaseUrl}/rest/v1/system_settings?setting_key=in.(min_payout_amount,tds_percentage,payout_processing_days)&select=setting_key,setting_value`;
      const settingsResponse = await fetch(settingsUrl, {
        headers: {
          'apikey': supabaseKey,
          'Authorization': `Bearer ${supabaseKey}`,
        },
      });
      const settings = await settingsResponse.json();

      const minPayoutAmount = parseInt(settings.find(s => s.setting_key === 'min_payout_amount')?.setting_value || 100);
      const tdsPercentage = parseInt(settings.find(s => s.setting_key === 'tds_percentage')?.setting_value || 1);
      const processingDays = parseInt(settings.find(s => s.setting_key === 'payout_processing_days')?.setting_value || 2);

      // Use provided amount or full balance
      let claimAmount = amount || rider.wallet_balance;

      // Validate amount
      if (claimAmount < minPayoutAmount) {
        return new Response(JSON.stringify({
          success: false,
          error: `Minimum payout amount is ₹${minPayoutAmount}. Your balance: ₹${rider.wallet_balance}`
        }), {
          status: 400,
          headers: { 'Content-Type': 'application/json', ...corsHeaders }
        });
      }

      if (claimAmount > rider.wallet_balance) {
        return new Response(JSON.stringify({
          success: false,
          error: `Insufficient balance. Available: ₹${rider.wallet_balance}, Requested: ₹${claimAmount}`
        }), {
          status: 400,
          headers: { 'Content-Type': 'application/json', ...corsHeaders }
        });
      }

      const finalUpiId = upi_id || rider.saved_upi_id;

      if (!finalUpiId) {
        return new Response(JSON.stringify({
          success: false,
          error: 'UPI ID is required to claim payout. Please add UPI ID in profile settings.'
        }), {
          status: 400,
          headers: { 'Content-Type': 'application/json', ...corsHeaders }
        });
      }

      // Check for existing pending payout
      const pendingCheckUrl = `${supabaseUrl}/rest/v1/payouts?user_id=eq.${rider_id}&user_type=eq.rider&status=in.(PENDING,PROCESSING)&select=payout_id,status`;
      const pendingCheckResponse = await fetch(pendingCheckUrl, {
        headers: {
          'apikey': supabaseKey,
          'Authorization': `Bearer ${supabaseKey}`,
        },
      });
      const existingPayoutData = await pendingCheckResponse.json();
      const existingPayout = existingPayoutData[0];

      if (existingPayout) {
        return new Response(JSON.stringify({
          success: false,
          error: 'You already have a pending payout request. Please wait for it to be processed before requesting another.',
          pending_payout_id: existingPayout.payout_id
        }), {
          status: 400,
          headers: { 'Content-Type': 'application/json', ...corsHeaders }
        });
      }

      // Calculate TDS
      const tdsAmount = Math.ceil((claimAmount * tdsPercentage) / 100);
      const netAmount = claimAmount - tdsAmount;

      // Create payout request
      const payoutInsert = await supabase
        .from('payouts')
        .insert({
          user_id: rider_id,
          user_type: 'rider',
          amount: claimAmount,
          upi_id: finalUpiId,
          tds_amount: tdsAmount,
          net_amount: netAmount,
          status: 'PENDING',
          notes: `Payout claim from rider ${rider.name} (${rider.email})`,
          requested_at: new Date().toISOString()
        })
        .select();

      if (payoutInsert.error) {
        console.error('Payout creation error:', payoutInsert.error);
        return new Response(JSON.stringify({ success: false, error: 'Failed to create payout request' }), {
          status: 500,
          headers: { 'Content-Type': 'application/json', ...corsHeaders }
        });
      }

      const payout = payoutInsert.data;

      // Deduct amount from wallet
      await fetch(`${supabaseUrl}/rest/v1/riders?rider_id=eq.${rider_id}`, {
        method: 'PATCH',
        headers: {
          'apikey': supabaseKey,
          'Authorization': `Bearer ${supabaseKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          wallet_balance: rider.wallet_balance - claimAmount,
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
          user_id: rider_id,
          user_type: 'rider',
          amount: claimAmount,
          type: 'debit',
          reason: `Payout claim #${payout.payout_id}`,
          reference_id: payout.payout_id,
          created_at: new Date().toISOString()
        })
      });

      // Send confirmation to rider
      await fetch(`${supabaseUrl}/rest/v1/notifications`, {
        method: 'POST',
        headers: {
          'apikey': supabaseKey,
          'Authorization': `Bearer ${supabaseKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          user_id: rider_id,
          user_type: 'rider',
          title: '💰 Payout Claim Submitted',
          message: `Your payout claim of ₹${claimAmount} has been submitted. TDS deducted: ₹${tdsAmount}. Net amount: ₹${netAmount}.`,
          type: 'payment',
          data: {
            payout_id: payout.payout_id,
            amount: claimAmount,
            net_amount: netAmount,
            upi_id: finalUpiId
          },
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
          title: '💰 New Rider Payout Claim',
          message: `${rider.name} claimed payout of ₹${claimAmount}. Payout ID: ${payout.payout_id}`,
          type: 'payment',
          priority: 'HIGH',
          data: {
            payout_id: payout.payout_id,
            rider_id,
            amount: claimAmount,
            upi_id: finalUpiId
          },
          created_at: new Date().toISOString()
        })
      });

      // Calculate expected date
      const expectedDate = new Date();
      expectedDate.setDate(expectedDate.getDate() + processingDays);

      return new Response(JSON.stringify({
        success: true,
        message: 'Payout claim submitted successfully!',
        claim: {
          payout_id: payout.payout_id,
          requested_amount: claimAmount,
          tds_amount: tdsAmount,
          net_amount: netAmount,
          upi_id: maskUpi(finalUpiId),
          status: 'PENDING',
          requested_at: payout.requested_at,
          expected_processing_days: processingDays,
          expected_date: expectedDate.toISOString().split('T')[0]
        },
        wallet_balance: rider.wallet_balance - claimAmount,
        next_steps: [
          'Your claim has been sent for approval',
          'Owner will review and process within 2-3 business days',
          `Amount will be credited to ${maskUpi(finalUpiId)}`,
          'You will receive notification once processed'
        ]
      }), {
        status: 200,
        headers: { 'Content-Type': 'application/json', ...corsHeaders }
      });

    } catch (error) {
      console.error('Claim payout error:', error);
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