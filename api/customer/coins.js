// api/customer/coins.js
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
            }),
            gte: (gteField, gteValue) => ({
              lte: (lteField, lteValue) => ({
                maybeSingle: async () => {
                  const finalUrl = `${url}&${field}=eq.${value}&${gteField}=gte.${gteValue}&${lteField}=lte.${lteValue}`;
                  const response = await fetch(finalUrl, {
                    headers: {
                      'apikey': supabaseKey,
                      'Authorization': `Bearer ${supabaseKey}`,
                    },
                  });
                  const data = await response.json();
                  return { data: data[0] || null, error: null };
                }
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
          return { data: result, error: null };
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

    // =====================================================
    // GET COINS DETAILS
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

      const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
      const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

      // Get customer coins balance
      const customerResult = await supabase
        .from('customers')
        .select('coins, wallet_balance, name, email')
        .eq('cust_id', cust_id)
        .single();

      if (customerResult.error || !customerResult.data) {
        return new Response(
          JSON.stringify({ success: false, error: 'Customer not found' }),
          { status: 404, headers: { 'Content-Type': 'application/json', ...corsHeaders } }
        );
      }

      const customer = customerResult.data;

      // Get coin transaction history
      const transactionsResult = await supabase
        .from('coin_transactions')
        .select('*')
        .eq('cust_id', cust_id)
        .order('created_at', { ascending: false });

      const transactions = transactionsResult.data || [];

      // Get settings
      const settingsResult = await supabase
        .from('system_settings')
        .select('setting_key, setting_value')
        .in('setting_key', [
          'coins_per_review',
          'coins_order_percent',
          'coins_per_referral',
          'coins_per_daily_checkin',
          'max_coins_per_day'
        ]);

      const settings = settingsResult.data || [];
      const coinsPerReview = parseInt(settings.find(s => s.setting_key === 'coins_per_review')?.setting_value || 10);
      const coinsOrderPercent = parseInt(settings.find(s => s.setting_key === 'coins_order_percent')?.setting_value || 2);
      const coinsPerReferral = parseInt(settings.find(s => s.setting_key === 'coins_per_referral')?.setting_value || 50);
      const coinsPerDailyCheckin = parseInt(settings.find(s => s.setting_key === 'coins_per_daily_checkin')?.setting_value || 5);
      const maxCoinsPerDay = parseInt(settings.find(s => s.setting_key === 'max_coins_per_day')?.setting_value || 100);

      // Calculate statistics
      let totalEarned = 0;
      let totalUsed = 0;
      let earningsByReason = {};

      if (transactions) {
        transactions.forEach(t => {
          if (t.type === 'credit') {
            totalEarned += t.coins;
            earningsByReason[t.reason] = (earningsByReason[t.reason] || 0) + t.coins;
          } else {
            totalUsed += t.coins;
          }
        });
      }

      // Check if daily check-in available
      const today = new Date().toISOString().split('T')[0];
      const todayCheckinUrl = `${supabaseUrl}/rest/v1/coin_transactions?cust_id=eq.${cust_id}&reason=eq.Daily%20Check-in&created_at=gte.${today}T00:00:00&created_at=lte.${today}T23:59:59&select=created_at`;
      const todayCheckinResponse = await fetch(todayCheckinUrl, {
        headers: {
          'apikey': supabaseKey,
          'Authorization': `Bearer ${supabaseKey}`,
        },
      });
      const todayCheckinData = await todayCheckinResponse.json();
      const todayCheckin = todayCheckinData[0];
      const canDailyCheckin = !todayCheckin;

      // Get streak data
      let streak = 0;
      let consecutiveDays = 0;

      if (transactions && transactions.length > 0) {
        const checkinDates = transactions
          .filter(t => t.reason === 'Daily Check-in' && t.type === 'credit')
          .map(t => t.created_at.split('T')[0])
          .sort();

        if (checkinDates.length > 0) {
          let currentStreak = 1;
          for (let i = checkinDates.length - 1; i > 0; i--) {
            const prevDate = new Date(checkinDates[i - 1]);
            const currDate = new Date(checkinDates[i]);
            const diffDays = Math.floor((currDate - prevDate) / (1000 * 60 * 60 * 24));

            if (diffDays === 1) {
              currentStreak++;
            } else {
              break;
            }
          }
          consecutiveDays = currentStreak;

          // Check if checked in today
          if (checkinDates[checkinDates.length - 1] === today) {
            streak = consecutiveDays;
          } else {
            streak = 0;
          }
        }
      }

      // Get referral code
      const referralResult = await supabase
        .from('customers')
        .select('referral_code')
        .eq('cust_id', cust_id)
        .single();

      const referralCode = referralResult.data?.referral_code || null;
      const referralLink = referralCode ? `https://suriyawansaffari.com/ref/${referralCode}` : null;

      // Get recent coin earnings from referrals
      const referralEarningsResult = await supabase
        .from('referrals')
        .select('*')
        .eq('referrer_cust_id', cust_id)
        .eq('reward_given', true)
        .order('completed_at', { ascending: false });

      const referralEarnings = referralEarningsResult.data || [];

      // Available rewards
      const rewards = [
        {
          id: 'review',
          name: 'Write a Review',
          coins: coinsPerReview,
          icon: 'fa-star',
          color: '#f59e0b',
          description: 'Earn coins by reviewing products you purchased',
          action: 'write_review'
        },
        {
          id: 'daily_checkin',
          name: 'Daily Check-in',
          coins: coinsPerDailyCheckin + (Math.floor(consecutiveDays / 7) * 5),
          icon: 'fa-calendar-check',
          color: '#10b981',
          description: `Day ${consecutiveDays + 1} streak! +${coinsPerDailyCheckin + (Math.floor(consecutiveDays / 7) * 5)} coins`,
          action: 'daily_checkin',
          available: canDailyCheckin
        },
        {
          id: 'referral',
          name: 'Refer a Friend',
          coins: coinsPerReferral,
          icon: 'fa-users',
          color: '#3b82f6',
          description: 'Invite friends and earn coins when they make their first purchase',
          action: 'share_referral'
        },
        {
          id: 'order',
          name: 'Place Order',
          coins: '2% of order value',
          icon: 'fa-shopping-cart',
          color: '#ec4899',
          description: 'Earn coins on every order you place',
          action: 'shop_now'
        },
        {
          id: 'festival',
          name: 'Festival Bonus',
          coins: 'Special',
          icon: 'fa-gift',
          color: '#f97316',
          description: 'Check during festivals for bonus coins',
          action: 'check_offers'
        }
      ];

      return new Response(
        JSON.stringify({
          success: true,
          coins: {
            balance: customer.coins,
            value_in_rupees: customer.coins,
            exchange_rate: '1 Coin = ₹1'
          },
          stats: {
            total_earned: totalEarned,
            total_used: totalUsed,
            available_to_use: customer.coins,
            earnings_by_reason: earningsByReason,
            streak_days: streak,
            consecutive_days: consecutiveDays
          },
          transactions: transactions.map(t => ({
            transaction_id: t.trans_id,
            coins: t.coins,
            type: t.type,
            reason: t.reason,
            reference_id: t.reference_id,
            created_at: t.created_at
          })),
          rewards: rewards,
          referral: {
            code: referralCode,
            link: referralLink,
            earnings: referralEarnings.length * (coinsPerReferral || 50),
            total_referred: referralEarnings.length || 0
          },
          settings: {
            coins_per_review: coinsPerReview,
            coins_order_percent: coinsOrderPercent,
            coins_per_referral: coinsPerReferral,
            coins_per_daily_checkin: coinsPerDailyCheckin,
            max_coins_per_day: maxCoinsPerDay
          },
          can_daily_checkin: canDailyCheckin
        }),
        { status: 200, headers: { 'Content-Type': 'application/json', ...corsHeaders } }
      );
    }

    // =====================================================
    // DAILY CHECK-IN (POST)
    // =====================================================
    if (request.method === 'POST') {
      const body = await request.json();
      const { cust_id } = body;

      if (!cust_id) {
        return new Response(
          JSON.stringify({ success: false, error: 'Customer ID is required' }),
          { status: 400, headers: { 'Content-Type': 'application/json', ...corsHeaders } }
        );
      }

      const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
      const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

      // Check if already checked in today
      const today = new Date().toISOString().split('T')[0];
      const existingUrl = `${supabaseUrl}/rest/v1/coin_transactions?cust_id=eq.${cust_id}&reason=eq.Daily%20Check-in&created_at=gte.${today}T00:00:00&created_at=lte.${today}T23:59:59&select=trans_id`;
      const existingResponse = await fetch(existingUrl, {
        headers: {
          'apikey': supabaseKey,
          'Authorization': `Bearer ${supabaseKey}`,
        },
      });
      const existingData = await existingResponse.json();
      const existingCheckin = existingData[0];

      if (existingCheckin) {
        return new Response(
          JSON.stringify({
            success: false,
            error: 'You have already checked in today. Come back tomorrow!'
          }),
          { status: 400, headers: { 'Content-Type': 'application/json', ...corsHeaders } }
        );
      }

      // Get customer data for streak calculation
      const previousUrl = `${supabaseUrl}/rest/v1/coin_transactions?cust_id=eq.${cust_id}&reason=eq.Daily%20Check-in&type=eq.credit&order=created_at.desc&limit=10&select=created_at`;
      const previousResponse = await fetch(previousUrl, {
        headers: {
          'apikey': supabaseKey,
          'Authorization': `Bearer ${supabaseKey}`,
        },
      });
      const previousCheckins = await previousResponse.json();

      // Calculate streak
      let streak = 0;
      if (previousCheckins && previousCheckins.length > 0) {
        const lastCheckin = new Date(previousCheckins[0].created_at);
        const yesterday = new Date();
        yesterday.setDate(yesterday.getDate() - 1);

        if (lastCheckin.toISOString().split('T')[0] === yesterday.toISOString().split('T')[0]) {
          streak = 1;
          for (let i = 1; i < previousCheckins.length; i++) {
            const prevDate = new Date(previousCheckins[i].created_at);
            const currDate = new Date(previousCheckins[i - 1].created_at);
            const diffDays = Math.floor((currDate - prevDate) / (1000 * 60 * 60 * 24));

            if (diffDays === 1) {
              streak++;
            } else {
              break;
            }
          }
        }
      }

      // Get coin amount from settings
      const settingUrl = `${supabaseUrl}/rest/v1/system_settings?setting_key=eq.coins_per_daily_checkin&select=setting_value`;
      const settingResponse = await fetch(settingUrl, {
        headers: {
          'apikey': supabaseKey,
          'Authorization': `Bearer ${supabaseKey}`,
        },
      });
      const settingData = await settingResponse.json();
      let coinsEarned = (settingData[0]?.setting_value && parseInt(settingData[0].setting_value)) || 5;

      // Bonus for weekly streak
      if ((streak + 1) % 7 === 0) {
        coinsEarned += 15;
      }

      // Bonus for monthly streak
      if ((streak + 1) % 30 === 0) {
        coinsEarned += 50;
      }

      // Add coins transaction
      await fetch(`${supabaseUrl}/rest/v1/coin_transactions`, {
        method: 'POST',
        headers: {
          'apikey': supabaseKey,
          'Authorization': `Bearer ${supabaseKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          cust_id: cust_id,
          coins: coinsEarned,
          type: 'credit',
          reason: 'Daily Check-in',
          created_at: new Date().toISOString()
        })
      });

      // Update customer coins balance
      const customerUrl = `${supabaseUrl}/rest/v1/customers?cust_id=eq.${cust_id}&select=coins`;
      const customerResponse = await fetch(customerUrl, {
        headers: {
          'apikey': supabaseKey,
          'Authorization': `Bearer ${supabaseKey}`,
        },
      });
      const customerData = await customerResponse.json();
      const currentCoins = customerData[0]?.coins || 0;

      await fetch(`${supabaseUrl}/rest/v1/customers?cust_id=eq.${cust_id}`, {
        method: 'PATCH',
        headers: {
          'apikey': supabaseKey,
          'Authorization': `Bearer ${supabaseKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ coins: currentCoins + coinsEarned })
      });

      // Get updated balance
      const finalResponse = await fetch(customerUrl, {
        headers: {
          'apikey': supabaseKey,
          'Authorization': `Bearer ${supabaseKey}`,
        },
      });
      const finalData = await finalResponse.json();
      const finalBalance = finalData[0]?.coins || 0;

      // Send notification
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
          title: 'Daily Check-in Success! 🎉',
          message: `You earned ${coinsEarned} coins! Streak: ${streak + 1} days.`,
          type: 'promotion',
          data: { coins_earned: coinsEarned, streak: streak + 1 },
          created_at: new Date().toISOString()
        })
      });

      return new Response(
        JSON.stringify({
          success: true,
          message: 'Daily check-in successful',
          coins_earned: coinsEarned,
          streak_days: streak + 1,
          current_balance: finalBalance,
          bonus_applied: {
            weekly_bonus: (streak + 1) % 7 === 0,
            monthly_bonus: (streak + 1) % 30 === 0
          }
        }),
        { status: 200, headers: { 'Content-Type': 'application/json', ...corsHeaders } }
      );
    }

    return new Response(
      JSON.stringify({ success: false, error: 'Method not allowed' }),
      { status: 405, headers: { 'Content-Type': 'application/json', ...corsHeaders } }
    );

  } catch (error) {
    console.error('Coins error:', error);
    return new Response(
      JSON.stringify({ success: false, error: error.message || 'Internal server error' }),
      { status: 500, headers: { 'Content-Type': 'application/json', ...corsHeaders } }
    );
  }
}