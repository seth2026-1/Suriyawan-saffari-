// api/seller/claim-payout.js
// Edge Function for Vercel Deployment

export const config = {
  runtime: 'edge',
  regions: ['iad1', 'sfo1', 'fra1', 'sin1'],
};

// Helper function to generate Payout ID
function generatePayoutId() {
  const date = new Date();
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  const random = Math.random().toString(36).substring(2, 8).toUpperCase();
  return `PAY${year}${month}${day}${random}`;
}

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
    'Access-Control-Allow-Methods': 'POST, GET, OPTIONS',
    'Access-Control-Allow-Headers': 'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version, Authorization',
  };

  // Handle OPTIONS preflight
  if (request.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: corsHeaders });
  }

  // =====================================================
  // GET CLAIM ELIGIBILITY (GET)
  // =====================================================
  if (request.method === 'GET') {
    try {
      const url = new URL(request.url);
      const seller_id = url.searchParams.get('seller_id');

      if (!seller_id) {
        return new Response(
          JSON.stringify({ success: false, error: 'Seller ID is required' }),
          { status: 400, headers: { 'Content-Type': 'application/json', ...corsHeaders } }
        );
      }

      const supabase = createSupabaseClient();
      const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
      const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

      // Get seller details
      const sellerResult = await supabase
        .from('sellers')
        .select('wallet_balance, upi_id, commission_rate, shop_name, kyc_status')
        .eq('seller_id', seller_id)
        .single();

      if (sellerResult.error || !sellerResult.data) {
        return new Response(
          JSON.stringify({ success: false, error: 'Seller not found' }),
          { status: 404, headers: { 'Content-Type': 'application/json', ...corsHeaders } }
        );
      }

      const seller = sellerResult.data;

      // Get system settings
      const settingsUrl = `${supabaseUrl}/rest/v1/system_settings?setting_key=in.(min_payout_amount,tds_percentage,payout_processing_days,payout_frequency)&select=setting_key,setting_value`;
      const settingsResponse = await fetch(settingsUrl, {
        headers: {
          'apikey': supabaseKey,
          'Authorization': `Bearer ${supabaseKey}`,
        },
      });
      const settings = await settingsResponse.json();

      const minPayoutAmount = parseInt(settings.find(s => s.setting_key === 'min_payout_amount')?.setting_value || 500);
      const tdsPercentage = parseInt(settings.find(s => s.setting_key === 'tds_percentage')?.setting_value || 1);
      const processingDays = parseInt(settings.find(s => s.setting_key === 'payout_processing_days')?.setting_value || 2);
      const payoutFrequency = settings.find(s => s.setting_key === 'payout_frequency')?.setting_value || 'weekly';

      // Check for existing pending payout
      const pendingUrl = `${supabaseUrl}/rest/v1/payouts?user_id=eq.${seller_id}&user_type=eq.seller&status=in.(PENDING,PROCESSING)&select=payout_id,status,requested_at`;
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
      const isKycApproved = seller.kyc_status === 'APPROVED';
      const tdsAmount = Math.ceil((seller.wallet_balance * tdsPercentage) / 100);
      const netAmount = seller.wallet_balance - tdsAmount;
      const canClaim = !hasPendingPayout && seller.wallet_balance >= minPayoutAmount && seller.upi_id && isKycApproved;

      // Get last payout date
      const lastPayoutUrl = `${supabaseUrl}/rest/v1/payouts?user_id=eq.${seller_id}&user_type=eq.seller&status=eq.COMPLETED&order=completed_at.desc&limit=1&select=completed_at`;
      const lastPayoutResponse = await fetch(lastPayoutUrl, {
        headers: {
          'apikey': supabaseKey,
          'Authorization': `Bearer ${supabaseKey}`,
        },
      });
      const lastPayoutData = await lastPayoutResponse.json();
      const lastPayout = lastPayoutData[0];
      const lastPayoutDate = lastPayout?.completed_at;

      // Calculate weekly earnings
      const weekStart = new Date();
      weekStart.setDate(weekStart.getDate() - 7);
      const weekStartStr = weekStart.toISOString();

      const weeklyOrdersUrl = `${supabaseUrl}/rest/v1/orders?select=final_amount&seller_id=eq.${seller_id}&status=eq.DELIVERED&delivered_at=gte.${weekStartStr}`;
      const weeklyOrdersResponse = await fetch(weeklyOrdersUrl, {
        headers: {
          'apikey': supabaseKey,
          'Authorization': `Bearer ${supabaseKey}`,
        },
      });
      const weeklyOrders = await weeklyOrdersResponse.json();

      const weeklyEarnings = weeklyOrders?.reduce((sum, o) => sum + (o.final_amount || 0), 0) || 0;
      const suggestedPayout = Math.min(seller.wallet_balance, weeklyEarnings || minPayoutAmount);

      return new Response(
        JSON.stringify({
          success: true,
          eligibility: {
            can_claim: canClaim,
            has_pending_payout: hasPendingPayout,
            pending_payout_id: pendingPayoutId,
            pending_since: pendingSince,
            reasons: {
              insufficient_balance: seller.wallet_balance < minPayoutAmount,
              no_upi_id: !seller.upi_id,
              kyc_not_approved: !isKycApproved,
              below_min_amount: seller.wallet_balance < minPayoutAmount
            }
          },
          wallet: {
            balance: seller.wallet_balance,
            min_payout_amount: minPayoutAmount,
            shortfall: canClaim ? 0 : minPayoutAmount - seller.wallet_balance
          },
          payout_details: {
            tds_percentage: tdsPercentage,
            tds_amount: tdsAmount,
            net_amount: netAmount,
            processing_days: processingDays,
            payout_frequency: payoutFrequency,
            upi_id: seller.upi_id ? maskUpi(seller.upi_id) : null,
            upi_id_exists: !!seller.upi_id,
            last_payout_date: lastPayoutDate
          },
          suggested_payout: suggestedPayout,
          shop_name: seller.shop_name
        }),
        { status: 200, headers: { 'Content-Type': 'application/json', ...corsHeaders } }
      );

    } catch (error) {
      console.error('Get claim eligibility error:', error);
      return new Response(
        JSON.stringify({ success: false, error: error.message }),
        { status: 500, headers: { 'Content-Type': 'application/json', ...corsHeaders } }
      );
    }
  }

  // =====================================================
  // SUBMIT CLAIM REQUEST (POST)
  // =====================================================
  if (request.method === 'POST') {
    try {
      const body = await request.json();
      const { seller_id, amount, upi_id } = body;

      if (!seller_id) {
        return new Response(
          JSON.stringify({ success: false, error: 'Seller ID is required' }),
          { status: 400, headers: { 'Content-Type': 'application/json', ...corsHeaders } }
        );
      }

      const supabase = createSupabaseClient();
      const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
      const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

      // Get seller details
      const sellerResult = await supabase
        .from('sellers')
        .select('wallet_balance, upi_id as saved_upi_id, shop_name, email, mobile, commission_rate, kyc_status')
        .eq('seller_id', seller_id)
        .single();

      if (sellerResult.error || !sellerResult.data) {
        return new Response(
          JSON.stringify({ success: false, error: 'Seller not found' }),
          { status: 404, headers: { 'Content-Type': 'application/json', ...corsHeaders } }
        );
      }

      const seller = sellerResult.data;

      // Check KYC status
      if (seller.kyc_status !== 'APPROVED') {
        return new Response(
          JSON.stringify({
            success: false,
            error: 'Your KYC is not approved yet. Please complete KYC to request payout.',
            kyc_status: seller.kyc_status
          }),
          { status: 403, headers: { 'Content-Type': 'application/json', ...corsHeaders } }
        );
      }

      // Get system settings
      const settingsUrl = `${supabaseUrl}/rest/v1/system_settings?setting_key=in.(min_payout_amount,tds_percentage,payout_processing_days)&select=setting_key,setting_value`;
      const settingsResponse = await fetch(settingsUrl, {
        headers: {
          'apikey': supabaseKey,
          'Authorization': `Bearer ${supabaseKey}`,
        },
      });
      const settings = await settingsResponse.json();

      const minPayoutAmount = parseInt(settings.find(s => s.setting_key === 'min_payout_amount')?.setting_value || 500);
      const tdsPercentage = parseInt(settings.find(s => s.setting_key === 'tds_percentage')?.setting_value || 1);
      const processingDays = parseInt(settings.find(s => s.setting_key === 'payout_processing_days')?.setting_value || 2);

      let claimAmount = amount || seller.wallet_balance;

      if (claimAmount < minPayoutAmount) {
        return new Response(
          JSON.stringify({
            success: false,
            error: `Minimum payout amount is ₹${minPayoutAmount}. Your balance: ₹${seller.wallet_balance}`
          }),
          { status: 400, headers: { 'Content-Type': 'application/json', ...corsHeaders } }
        );
      }

      if (claimAmount > seller.wallet_balance) {
        return new Response(
          JSON.stringify({
            success: false,
            error: `Insufficient wallet balance. Available: ₹${seller.wallet_balance}, Requested: ₹${claimAmount}`
          }),
          { status: 400, headers: { 'Content-Type': 'application/json', ...corsHeaders } }
        );
      }

      const finalUpiId = upi_id || seller.saved_upi_id;

      if (!finalUpiId) {
        return new Response(
          JSON.stringify({
            success: false,
            error: 'UPI ID is required to claim payout. Please add UPI ID in profile settings.'
          }),
          { status: 400, headers: { 'Content-Type': 'application/json', ...corsHeaders } }
        );
      }

      // Check for existing pending payout
      const pendingCheckUrl = `${supabaseUrl}/rest/v1/payouts?user_id=eq.${seller_id}&user_type=eq.seller&status=in.(PENDING,PROCESSING)&select=payout_id,status`;
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
          JSON.stringify({
            success: false,
            error: `You already have a pending payout request (ID: ${existingPayout.payout_id}). Please wait for it to be processed before requesting another.`,
            pending_payout_id: existingPayout.payout_id
          }),
          { status: 400, headers: { 'Content-Type': 'application/json', ...corsHeaders } }
        );
      }

      const payoutId = generatePayoutId();
      const tdsAmount = Math.ceil((claimAmount * tdsPercentage) / 100);
      const netAmount = claimAmount - tdsAmount;

      // Create payout request
      const payoutInsert = await supabase
        .from('payouts')
        .insert({
          payout_id: payoutId,
          user_id: seller_id,
          user_type: 'seller',
          amount: claimAmount,
          upi_id: finalUpiId,
          tds_amount: tdsAmount,
          net_amount: netAmount,
          status: 'PENDING',
          notes: `Payout claim from ${seller.shop_name} (${seller.email})`,
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
      await fetch(`${supabaseUrl}/rest/v1/sellers?seller_id=eq.${seller_id}`, {
        method: 'PATCH',
        headers: {
          'apikey': supabaseKey,
          'Authorization': `Bearer ${supabaseKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          wallet_balance: seller.wallet_balance - claimAmount,
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
          amount: claimAmount,
          type: 'debit',
          reason: `Payout claim #${payoutId}`,
          reference_id: payoutId,
          created_at: new Date().toISOString()
        })
      });

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
          title: '💰 Payout Claim Submitted',
          message: `Your payout claim of ₹${claimAmount} has been submitted. TDS deducted: ₹${tdsAmount}. Net amount: ₹${netAmount}.`,
          type: 'payment',
          data: {
            payout_id: payoutId,
            amount: claimAmount,
            net_amount: netAmount,
            upi_id: finalUpiId
          },
          created_at: new Date().toISOString()
        })
      });

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
          title: '💰 New Payout Claim',
          message: `${seller.shop_name} claimed payout of ₹${claimAmount}. Payout ID: ${payoutId}`,
          type: 'payment',
          priority: 'HIGH',
          data: {
            payout_id: payoutId,
            seller_id,
            amount: claimAmount,
            upi_id: finalUpiId
          },
          created_at: new Date().toISOString()
        })
      });

      const expectedDate = new Date();
      expectedDate.setDate(expectedDate.getDate() + processingDays);

      return new Response(
        JSON.stringify({
          success: true,
          message: 'Payout claim submitted successfully!',
          claim: {
            payout_id: payoutId,
            requested_amount: claimAmount,
            tds_amount: tdsAmount,
            net_amount: netAmount,
            upi_id: maskUpi(finalUpiId),
            status: 'PENDING',
            requested_at: payout.requested_at,
            expected_processing_days: processingDays,
            expected_date: expectedDate.toISOString().split('T')[0]
          },
          wallet_balance: seller.wallet_balance - claimAmount,
          next_steps: [
            'Your claim has been sent for approval',
            'Owner will review and process within 2-3 business days',
            `Amount will be credited to ${maskUpi(finalUpiId)}`,
            'You will receive notification once processed'
          ]
        }),
        { status: 200, headers: { 'Content-Type': 'application/json', ...corsHeaders } }
      );

    } catch (error) {
      console.error('Claim payout error:', error);
      return new Response(
        JSON.stringify({ success: false, error: error.message }),
        { status: 500, headers: { 'Content-Type': 'application/json', ...corsHeaders } }
      );
    }
  }

  return new Response(
    JSON.stringify({ success: false, error: 'Method not allowed' }),
    { status: 405, headers: { 'Content-Type': 'application/json', ...corsHeaders } }
  );
}