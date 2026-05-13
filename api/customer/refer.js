// api/customer/refer.js
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
            order: (orderField, { ascending }) => ({
              select: async () => {
                const sortOrder = ascending ? 'asc' : 'desc';
                const finalUrl = `${url}&${field}=eq.${value}&order=${orderField}.${sortOrder}`;
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
          in: (field, values) => ({
            select: async (columns) => {
              const finalUrl = `${supabaseUrl}/rest/v1/${table}?select=${columns}&${field}=in.(${values.join(',')})`;
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

// Helper function
function getReferralStatusDisplay(status) {
  const statusMap = {
    'PENDING': 'Pending Signup',
    'ORDERED': 'First Order Placed',
    'COMPLETED': 'Completed - Reward Given'
  };
  return statusMap[status] || status;
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
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://suriyawansaffari.com';

    // =====================================================
    // GET REFERRAL DETAILS
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

      // Get customer referral code
      const customerResult = await supabase
        .from('customers')
        .select('referral_code, name, email, coins')
        .eq('cust_id', cust_id)
        .single();

      if (customerResult.error || !customerResult.data) {
        return new Response(
          JSON.stringify({ success: false, error: 'Customer not found' }),
          { status: 404, headers: { 'Content-Type': 'application/json', ...corsHeaders } }
        );
      }

      const customer = customerResult.data;

      // Get referral settings
      const settingsUrl = `${supabaseUrl}/rest/v1/system_settings?setting_key=in.(refer_earn_amount,max_refer_per_day,referral_coins_bonus,referral_discount_percent)&select=setting_key,setting_value`;
      const settingsResponse = await fetch(settingsUrl, {
        headers: {
          'apikey': supabaseKey,
          'Authorization': `Bearer ${supabaseKey}`,
        },
      });
      const settingsData = await settingsResponse.json();
      const settings = settingsData || [];

      const referEarnAmount = parseInt(settings.find(s => s.setting_key === 'refer_earn_amount')?.setting_value || 10);
      const maxReferPerDay = parseInt(settings.find(s => s.setting_key === 'max_refer_per_day')?.setting_value || 5);
      const referralCoinsBonus = parseInt(settings.find(s => s.setting_key === 'referral_coins_bonus')?.setting_value || 50);
      const referralDiscountPercent = parseInt(settings.find(s => s.setting_key === 'referral_discount_percent')?.setting_value || 10);

      // Get referrals sent by this customer with referred customer details
      const sentReferralsUrl = `${supabaseUrl}/rest/v1/referrals?referrer_cust_id=eq.${cust_id}&order=created_at.desc&select=*,referred:referred_cust_id(cust_id,name,email,created_at)`;
      const sentReferralsResponse = await fetch(sentReferralsUrl, {
        headers: {
          'apikey': supabaseKey,
          'Authorization': `Bearer ${supabaseKey}`,
        },
      });
      const sentReferrals = await sentReferralsResponse.json();

      // Get referrals received (who referred this customer)
      const receivedReferralUrl = `${supabaseUrl}/rest/v1/referrals?referred_cust_id=eq.${cust_id}&select=*,referrer:referrer_cust_id(cust_id,name,email)`;
      const receivedReferralResponse = await fetch(receivedReferralUrl, {
        headers: {
          'apikey': supabaseKey,
          'Authorization': `Bearer ${supabaseKey}`,
        },
      });
      const receivedReferralData = await receivedReferralResponse.json();
      const receivedReferral = receivedReferralData[0];

      // Calculate statistics
      const totalReferred = sentReferrals?.length || 0;
      const completedReferrals = sentReferrals?.filter(r => r.status === 'COMPLETED').length || 0;
      const pendingReferrals = sentReferrals?.filter(r => r.status === 'PENDING').length || 0;
      const orderedReferrals = sentReferrals?.filter(r => r.status === 'ORDERED').length || 0;

      const totalEarned = (completedReferrals * referEarnAmount) + 
        (completedReferrals * referralCoinsBonus);

      // Get today's referral count
      const today = new Date().toISOString().split('T')[0];
      const todayReferrals = sentReferrals?.filter(r => 
        r.created_at && r.created_at.startsWith(today)
      ).length || 0;

      const canReferToday = todayReferrals < maxReferPerDay;

      // Generate referral link
      const referralLink = `${baseUrl}?ref=${customer.referral_code}`;
      const whatsappLink = `https://wa.me/?text=${encodeURIComponent(`Join Suriyawan Saffari and get ₹${referEarnAmount} cashback on your first order! Use my referral code: ${customer.referral_code}\n\nShop now: ${referralLink}`)}`;
      const smsText = encodeURIComponent(`Join Suriyawan Saffari! Use my referral code ${customer.referral_code} to get ₹${referEarnAmount} off on first order. Shop now: ${referralLink}`);

      // Format referrals list
      const formattedReferrals = (sentReferrals || []).map(ref => ({
        referral_id: ref.referral_id,
        referred_cust_id: ref.referred_cust_id,
        referred_name: ref.referred?.name || 'New User',
        referred_email: ref.referred?.email || ref.referred_email,
        status: ref.status,
        status_display: getReferralStatusDisplay(ref.status),
        reward_given: ref.reward_given,
        reward_amount: ref.reward_amount,
        created_at: ref.created_at,
        completed_at: ref.completed_at
      }));

      // Get referrer info for received referral
      let referredByInfo = null;
      if (receivedReferral && receivedReferral.referrer) {
        const referrerCodeUrl = `${supabaseUrl}/rest/v1/customers?cust_id=eq.${receivedReferral.referrer_cust_id}&select=referral_code`;
        const referrerCodeResponse = await fetch(referrerCodeUrl, {
          headers: {
            'apikey': supabaseKey,
            'Authorization': `Bearer ${supabaseKey}`,
          },
        });
        const referrerCodeData = await referrerCodeResponse.json();
        const referrerCode = referrerCodeData[0];

        referredByInfo = {
          referrer_name: receivedReferral.referrer?.name,
          referrer_code: referrerCode?.referral_code,
          discount_available: referralDiscountPercent
        };
      }

      return new Response(
        JSON.stringify({
          success: true,
          referral: {
            code: customer.referral_code,
            link: referralLink,
            earn_per_referral: referEarnAmount,
            coins_bonus: referralCoinsBonus,
            max_per_day: maxReferPerDay,
            today_referrals: todayReferrals,
            can_refer_today: canReferToday,
            discount_for_friend: referralDiscountPercent
          },
          stats: {
            total_referred: totalReferred,
            completed: completedReferrals,
            pending: pendingReferrals,
            ordered: orderedReferrals,
            total_earned: totalEarned,
            current_coins: customer.coins
          },
          referrals: formattedReferrals,
          referred_by: referredByInfo,
          share_links: {
            whatsapp: whatsappLink,
            sms: `sms:?body=${smsText}`,
            copy: referralLink
          }
        }),
        { status: 200, headers: { 'Content-Type': 'application/json', ...corsHeaders } }
      );
    }

    // =====================================================
    // APPLY REFERRAL CODE (POST)
    // =====================================================
    if (request.method === 'POST') {
      const body = await request.json();
      const { referred_email, referral_code, referred_cust_id } = body;

      if (!referral_code) {
        return new Response(
          JSON.stringify({ success: false, error: 'Referral code is required' }),
          { status: 400, headers: { 'Content-Type': 'application/json', ...corsHeaders } }
        );
      }

      // Find the referrer by referral code
      const referrerResult = await supabase
        .from('customers')
        .select('cust_id, name, email')
        .eq('referral_code', referral_code)
        .single();

      if (referrerResult.error || !referrerResult.data) {
        return new Response(
          JSON.stringify({ success: false, error: 'Invalid referral code' }),
          { status: 404, headers: { 'Content-Type': 'application/json', ...corsHeaders } }
        );
      }

      const referrer = referrerResult.data;

      // Prevent self referral
      if (referred_cust_id && referrer.cust_id === referred_cust_id) {
        return new Response(
          JSON.stringify({ success: false, error: 'You cannot refer yourself' }),
          { status: 400, headers: { 'Content-Type': 'application/json', ...corsHeaders } }
        );
      }

      // Check if already referred
      let referredId = referred_cust_id;

      if (!referredId && referred_email) {
        const existingCustomerUrl = `${supabaseUrl}/rest/v1/customers?email=eq.${encodeURIComponent(referred_email)}&select=cust_id`;
        const existingCustomerResponse = await fetch(existingCustomerUrl, {
          headers: {
            'apikey': supabaseKey,
            'Authorization': `Bearer ${supabaseKey}`,
          },
        });
        const existingCustomerData = await existingCustomerResponse.json();
        const existingCustomer = existingCustomerData[0];

        if (existingCustomer) {
          referredId = existingCustomer.cust_id;
        }
      }

      if (referredId) {
        const existingReferralUrl = `${supabaseUrl}/rest/v1/referrals?referred_cust_id=eq.${referredId}&select=referral_id`;
        const existingReferralResponse = await fetch(existingReferralUrl, {
          headers: {
            'apikey': supabaseKey,
            'Authorization': `Bearer ${supabaseKey}`,
          },
        });
        const existingReferralData = await existingReferralResponse.json();
        const existingReferral = existingReferralData[0];

        if (existingReferral) {
          return new Response(
            JSON.stringify({ success: false, error: 'This user has already been referred by someone else' }),
            { status: 400, headers: { 'Content-Type': 'application/json', ...corsHeaders } }
          );
        }
      }

      // Get settings for response
      const settingsUrl = `${supabaseUrl}/rest/v1/system_settings?setting_key=in.(refer_earn_amount,referral_discount_percent)&select=setting_key,setting_value`;
      const settingsResponse = await fetch(settingsUrl, {
        headers: {
          'apikey': supabaseKey,
          'Authorization': `Bearer ${supabaseKey}`,
        },
      });
      const settingsData = await settingsResponse.json();
      const settings = settingsData || [];
      const referEarnAmount = parseInt(settings.find(s => s.setting_key === 'refer_earn_amount')?.setting_value || 10);
      const referralDiscountPercent = parseInt(settings.find(s => s.setting_key === 'referral_discount_percent')?.setting_value || 10);

      // Create referral record
      const referralData = {
        referrer_cust_id: referrer.cust_id,
        status: 'PENDING',
        created_at: new Date().toISOString()
      };

      if (referred_cust_id) {
        referralData.referred_cust_id = referred_cust_id;
      }
      if (referred_email) {
        referralData.referred_email = referred_email;
      }

      const referralInsert = await supabase
        .from('referrals')
        .insert(referralData)
        .select();

      if (referralInsert.error) {
        console.error('Referral creation error:', referralInsert.error);
        return new Response(
          JSON.stringify({ success: false, error: 'Failed to apply referral code' }),
          { status: 500, headers: { 'Content-Type': 'application/json', ...corsHeaders } }
        );
      }

      const referral = referralInsert.data;

      // Update customer's referred_by field if cust_id provided
      if (referred_cust_id) {
        await fetch(`${supabaseUrl}/rest/v1/customers?cust_id=eq.${referred_cust_id}`, {
          method: 'PATCH',
          headers: {
            'apikey': supabaseKey,
            'Authorization': `Bearer ${supabaseKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ referred_by: referral_code })
        });
      }

      // Send notification to referrer
      await fetch(`${supabaseUrl}/rest/v1/notifications`, {
        method: 'POST',
        headers: {
          'apikey': supabaseKey,
          'Authorization': `Bearer ${supabaseKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          user_id: referrer.cust_id,
          user_type: 'customer',
          title: 'New Referral! 🎉',
          message: `Someone signed up using your referral code! They'll get ₹${referEarnAmount} off on first order.`,
          type: 'referral',
          data: { referral_id: referral.referral_id },
          created_at: new Date().toISOString()
        })
      });

      return new Response(
        JSON.stringify({
          success: true,
          message: 'Referral code applied successfully!',
          referral: {
            referral_id: referral.referral_id,
            referrer_name: referrer.name,
            discount: `${referralDiscountPercent}% off on first order`,
            valid_until: 'First order completion'
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
    console.error('Referral error:', error);
    return new Response(
      JSON.stringify({ success: false, error: error.message || 'Internal server error' }),
      { status: 500, headers: { 'Content-Type': 'application/json', ...corsHeaders } }
    );
  }
}