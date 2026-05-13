// api/logistics/rider/earnings.js
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
  // GET EARNINGS AND WALLET DETAILS
  // =====================================================
  if (request.method === 'GET') {
    try {
      const rider_id = url.searchParams.get('rider_id');
      const period = url.searchParams.get('period') || 'month';
      const page = parseInt(url.searchParams.get('page') || '1');
      const limit = parseInt(url.searchParams.get('limit') || '50');

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
        .select('rider_id, name, wallet_balance, rate_per_parcel, pickup_rate, total_deliveries, total_pickups, upi_id')
        .eq('rider_id', rider_id)
        .single();

      if (riderResult.error || !riderResult.data) {
        return new Response(JSON.stringify({ success: false, error: 'Rider not found' }), {
          status: 404,
          headers: { 'Content-Type': 'application/json', ...corsHeaders }
        });
      }

      const rider = riderResult.data;

      // Date range based on period
      let startDate;
      const now = new Date();

      switch (period) {
        case 'today':
          startDate = new Date(now.setHours(0, 0, 0, 0));
          break;
        case 'week':
          startDate = new Date(now.setDate(now.getDate() - 7));
          break;
        case 'month':
          startDate = new Date(now.setMonth(now.getMonth() - 1));
          break;
        case 'year':
          startDate = new Date(now.setFullYear(now.getFullYear() - 1));
          break;
        default:
          startDate = new Date(now.setMonth(now.getMonth() - 1));
      }

      const startDateStr = startDate.toISOString();

      // Get wallet transactions
      let transactionsUrl = `${supabaseUrl}/rest/v1/wallet_transactions?select=*&user_id=eq.${rider_id}&user_type=eq.rider&order=created_at.desc`;

      if (period !== 'all') {
        transactionsUrl += `&created_at=gte.${startDateStr}`;
      }

      const transactionsResponse = await fetch(transactionsUrl, {
        headers: {
          'apikey': supabaseKey,
          'Authorization': `Bearer ${supabaseKey}`,
        },
      });
      const transactions = await transactionsResponse.json();

      // Get runsheets for earnings breakdown
      let runsheetsUrl = `${supabaseUrl}/rest/v1/runsheets?select=run_id,date,total_deliveries,total_pickups,total_cod,collected_cod,status,created_at,completed_at&rider_id=eq.${rider_id}&order=date.desc`;

      if (period !== 'all') {
        runsheetsUrl += `&date=gte.${startDateStr.split('T')[0]}`;
      }

      const runsheetsResponse = await fetch(runsheetsUrl, {
        headers: {
          'apikey': supabaseKey,
          'Authorization': `Bearer ${supabaseKey}`,
        },
      });
      const runsheets = await runsheetsResponse.json();

      // Get payout requests
      const payoutsUrl = `${supabaseUrl}/rest/v1/payouts?select=*&user_id=eq.${rider_id}&user_type=eq.rider&order=requested_at.desc&limit=20`;
      const payoutsResponse = await fetch(payoutsUrl, {
        headers: {
          'apikey': supabaseKey,
          'Authorization': `Bearer ${supabaseKey}`,
        },
      });
      const payouts = await payoutsResponse.json();

      // Calculate earnings summary
      const totalEarnings = transactions?.filter(t => t.type === 'credit').reduce((sum, t) => sum + t.amount, 0) || 0;
      const totalWithdrawn = transactions?.filter(t => t.type === 'debit').reduce((sum, t) => sum + t.amount, 0) || 0;

      // Calculate period earnings
      const periodTransactions = transactions?.filter(t => new Date(t.created_at) >= startDate) || [];
      const periodEarnings = periodTransactions.filter(t => t.type === 'credit').reduce((sum, t) => sum + t.amount, 0) || 0;
      const periodWithdrawn = periodTransactions.filter(t => t.type === 'debit').reduce((sum, t) => sum + t.amount, 0) || 0;

      // Calculate delivery and pickup counts
      const totalDeliveries = rider.total_deliveries || 0;
      const totalPickups = rider.total_pickups || 0;
      const deliveryRate = rider.rate_per_parcel || 18;
      const pickupRate = rider.pickup_rate || 10;
      const deliveryEarnings = totalDeliveries * deliveryRate;
      const pickupEarnings = totalPickups * pickupRate;
      const otherEarnings = totalEarnings - deliveryEarnings - pickupEarnings;

      // Get daily earnings for chart (last 30 days)
      const dailyEarnings = [];
      const last30Days = [];
      for (let i = 29; i >= 0; i--) {
        const date = new Date();
        date.setDate(date.getDate() - i);
        const dateStr = date.toISOString().split('T')[0];
        last30Days.push(dateStr);
      }

      for (const dateStr of last30Days) {
        const dayTransactions = transactions?.filter(t => t.created_at?.split('T')[0] === dateStr) || [];
        const dayEarnings = dayTransactions.filter(t => t.type === 'credit').reduce((sum, t) => sum + t.amount, 0) || 0;
        dailyEarnings.push({
          date: dateStr,
          earnings: dayEarnings,
          deliveries: runsheets?.filter(r => r.date === dateStr).reduce((sum, r) => sum + (r.total_deliveries || 0), 0) || 0,
          pickups: runsheets?.filter(r => r.date === dateStr).reduce((sum, r) => sum + (r.total_pickups || 0), 0) || 0
        });
      }

      // Get pending payout amount
      const pendingPayouts = payouts?.filter(p => p.status === 'PENDING' || p.status === 'PROCESSING').reduce((sum, p) => sum + p.amount, 0) || 0;
      const completedPayouts = payouts?.filter(p => p.status === 'COMPLETED').reduce((sum, p) => sum + p.amount, 0) || 0;

      // Get settings
      const settingsUrl = `${supabaseUrl}/rest/v1/system_settings?setting_key=in.(min_payout_amount,tds_percentage,rider_rate_per_parcel,rider_pickup_rate)&select=setting_key,setting_value`;
      const settingsResponse = await fetch(settingsUrl, {
        headers: {
          'apikey': supabaseKey,
          'Authorization': `Bearer ${supabaseKey}`,
        },
      });
      const settings = await settingsResponse.json();

      const minPayoutAmount = parseInt(settings.find(s => s.setting_key === 'min_payout_amount')?.setting_value || 100);
      const tdsPercentage = parseInt(settings.find(s => s.setting_key === 'tds_percentage')?.setting_value || 1);
      const defaultDeliveryRate = parseInt(settings.find(s => s.setting_key === 'rider_rate_per_parcel')?.setting_value || 18);
      const defaultPickupRate = parseInt(settings.find(s => s.setting_key === 'rider_pickup_rate')?.setting_value || 10);

      const canClaim = rider.wallet_balance >= minPayoutAmount && rider.upi_id;
      const estimatedTds = Math.ceil((rider.wallet_balance * tdsPercentage) / 100);
      const estimatedNetPayout = rider.wallet_balance - estimatedTds;

      // Format transactions (paginated)
      const from = (page - 1) * limit;
      const to = from + limit;
      const formattedTransactions = transactions?.slice(from, to).map(t => ({
        transaction_id: t.trans_id,
        amount: t.amount,
        type: t.type,
        reason: t.reason,
        reference_id: t.reference_id,
        created_at: t.created_at
      })) || [];

      // Format runsheets
      const formattedRunsheets = runsheets?.slice(0, 20).map(r => ({
        run_id: r.run_id,
        date: r.date,
        deliveries: r.total_deliveries,
        pickups: r.total_pickups,
        delivery_earning: (r.total_deliveries || 0) * (rider.rate_per_parcel || defaultDeliveryRate),
        pickup_earning: (r.total_pickups || 0) * (rider.pickup_rate || defaultPickupRate),
        total_earning: ((r.total_deliveries || 0) * (rider.rate_per_parcel || defaultDeliveryRate)) + ((r.total_pickups || 0) * (rider.pickup_rate || defaultPickupRate)),
        status: r.status,
        completed_at: r.completed_at
      })) || [];

      return new Response(JSON.stringify({
        success: true,
        rider: {
          rider_id: rider.rider_id,
          name: rider.name,
          wallet_balance: rider.wallet_balance || 0,
          upi_id: rider.upi_id ? maskUpi(rider.upi_id) : null,
          rate_per_parcel: rider.rate_per_parcel || defaultDeliveryRate,
          pickup_rate: rider.pickup_rate || defaultPickupRate
        },
        summary: {
          total_earnings: totalEarnings,
          total_withdrawn: totalWithdrawn,
          current_balance: rider.wallet_balance || 0,
          pending_payouts: pendingPayouts,
          completed_payouts: completedPayouts,
          period_earnings: periodEarnings,
          period_withdrawn: periodWithdrawn
        },
        breakdown: {
          delivery_earnings: deliveryEarnings,
          pickup_earnings: pickupEarnings,
          other_earnings: otherEarnings,
          total_deliveries: totalDeliveries,
          total_pickups: totalPickups
        },
        daily_earnings: dailyEarnings,
        transactions: formattedTransactions,
        runsheets: formattedRunsheets,
        payouts: payouts?.map(p => ({
          payout_id: p.payout_id,
          amount: p.amount,
          tds_amount: p.tds_amount,
          net_amount: p.net_amount,
          status: p.status,
          requested_at: p.requested_at,
          completed_at: p.completed_at
        })) || [],
        claim_eligibility: {
          can_claim: canClaim,
          min_amount: minPayoutAmount,
          current_balance: rider.wallet_balance || 0,
          shortfall: canClaim ? 0 : minPayoutAmount - (rider.wallet_balance || 0),
          has_upi: !!rider.upi_id,
          tds_percentage: tdsPercentage,
          estimated_tds: estimatedTds,
          estimated_net_payout: estimatedNetPayout
        },
        period: period,
        last_updated: new Date().toISOString()
      }), {
        status: 200,
        headers: { 'Content-Type': 'application/json', ...corsHeaders }
      });

    } catch (error) {
      console.error('Get earnings error:', error);
      return new Response(JSON.stringify({ success: false, error: error.message }), {
        status: 500,
        headers: { 'Content-Type': 'application/json', ...corsHeaders }
      });
    }
  }

  // =====================================================
  // REQUEST PAYOUT (POST)
  // =====================================================
  if (request.method === 'POST') {
    try {
      const body = await request.json();
      const { rider_id, amount, upi_id } = body;

      if (!rider_id || !amount) {
        return new Response(JSON.stringify({
          success: false,
          error: 'Rider ID and amount are required'
        }), {
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
        .select('wallet_balance, upi_id as saved_upi_id, name, email, mobile')
        .eq('rider_id', rider_id)
        .single();

      if (riderResult.error || !riderResult.data) {
        return new Response(JSON.stringify({ success: false, error: 'Rider not found' }), {
          status: 404,
          headers: { 'Content-Type': 'application/json', ...corsHeaders }
        });
      }

      const rider = riderResult.data;

      // Get settings
      const settingsUrl = `${supabaseUrl}/rest/v1/system_settings?setting_key=in.(min_payout_amount,tds_percentage)&select=setting_key,setting_value`;
      const settingsResponse = await fetch(settingsUrl, {
        headers: {
          'apikey': supabaseKey,
          'Authorization': `Bearer ${supabaseKey}`,
        },
      });
      const settings = await settingsResponse.json();

      const minPayoutAmount = parseInt(settings.find(s => s.setting_key === 'min_payout_amount')?.setting_value || 100);
      const tdsPercentage = parseInt(settings.find(s => s.setting_key === 'tds_percentage')?.setting_value || 1);

      // Validate amount
      if (amount < minPayoutAmount) {
        return new Response(JSON.stringify({
          success: false,
          error: `Minimum payout amount is ₹${minPayoutAmount}`
        }), {
          status: 400,
          headers: { 'Content-Type': 'application/json', ...corsHeaders }
        });
      }

      if (amount > rider.wallet_balance) {
        return new Response(JSON.stringify({
          success: false,
          error: `Insufficient balance. Available: ₹${rider.wallet_balance}`
        }), {
          status: 400,
          headers: { 'Content-Type': 'application/json', ...corsHeaders }
        });
      }

      const finalUpiId = upi_id || rider.saved_upi_id;

      if (!finalUpiId) {
        return new Response(JSON.stringify({
          success: false,
          error: 'UPI ID is required to claim payout. Please add UPI ID in profile.'
        }), {
          status: 400,
          headers: { 'Content-Type': 'application/json', ...corsHeaders }
        });
      }

      // Check for existing pending payout
      const existingUrl = `${supabaseUrl}/rest/v1/payouts?user_id=eq.${rider_id}&user_type=eq.rider&status=in.(PENDING,PROCESSING)&select=payout_id`;
      const existingResponse = await fetch(existingUrl, {
        headers: {
          'apikey': supabaseKey,
          'Authorization': `Bearer ${supabaseKey}`,
        },
      });
      const existingData = await existingResponse.json();
      const existingPayout = existingData[0];

      if (existingPayout) {
        return new Response(JSON.stringify({
          success: false,
          error: 'You already have a pending payout request'
        }), {
          status: 400,
          headers: { 'Content-Type': 'application/json', ...corsHeaders }
        });
      }

      // Calculate TDS
      const tdsAmount = Math.ceil((amount * tdsPercentage) / 100);
      const netAmount = amount - tdsAmount;

      // Create payout request
      const payoutInsert = await supabase
        .from('payouts')
        .insert({
          user_id: rider_id,
          user_type: 'rider',
          amount: amount,
          upi_id: finalUpiId,
          tds_amount: tdsAmount,
          net_amount: netAmount,
          status: 'PENDING',
          notes: `Payout claim by ${rider.name}`,
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

      // Deduct from wallet
      await fetch(`${supabaseUrl}/rest/v1/riders?rider_id=eq.${rider_id}`, {
        method: 'PATCH',
        headers: {
          'apikey': supabaseKey,
          'Authorization': `Bearer ${supabaseKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ wallet_balance: rider.wallet_balance - amount })
      });

      // Record transaction
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
          amount: amount,
          type: 'debit',
          reason: `Payout request #${payout.payout_id}`,
          reference_id: payout.payout_id,
          created_at: new Date().toISOString()
        })
      });

      // Send notification to rider
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
          title: 'Payout Request Submitted',
          message: `Your payout request of ₹${amount} has been submitted. TDS deducted: ₹${tdsAmount}. Net: ₹${netAmount}.`,
          type: 'payment',
          data: { payout_id: payout.payout_id, amount },
          created_at: new Date().toISOString()
        })
      });

      // Notify owner
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
          title: 'New Rider Payout Request',
          message: `${rider.name} requested payout of ₹${amount}`,
          type: 'payment',
          data: { payout_id: payout.payout_id, rider_id, amount },
          created_at: new Date().toISOString()
        })
      });

      return new Response(JSON.stringify({
        success: true,
        message: 'Payout request submitted successfully',
        payout: {
          payout_id: payout.payout_id,
          amount: amount,
          tds_amount: tdsAmount,
          net_amount: netAmount,
          upi_id: maskUpi(finalUpiId),
          status: 'PENDING',
          requested_at: payout.requested_at
        },
        wallet_balance: rider.wallet_balance - amount
      }), {
        status: 200,
        headers: { 'Content-Type': 'application/json', ...corsHeaders }
      });

    } catch (error) {
      console.error('Request payout error:', error);
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