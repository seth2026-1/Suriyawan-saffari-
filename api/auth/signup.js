// api/auth/signup.js
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
            return { data: result, error: null };
          }
        })
      })
    }),
    auth: {
      signUp: async ({ email, password, options }) => {
        const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
        const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
        
        const response = await fetch(`${supabaseUrl}/auth/v1/signup`, {
          method: 'POST',
          headers: {
            'apikey': supabaseKey,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            email,
            password,
            data: options.data
          }),
        });
        
        const data = await response.json();
        
        if (!response.ok) {
          return { data: null, error: data };
        }
        
        return {
          data: {
            user: data.user,
            session: data.session
          },
          error: null
        };
      }
    }
  };
}

export default async function handler(request) {
  // CORS Headers
  const corsHeaders = {
    'Access-Control-Allow-Credentials': 'true',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version, Authorization',
  };

  // Handle OPTIONS preflight
  if (request.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: corsHeaders });
  }

  // Only allow POST
  if (request.method !== 'POST') {
    return new Response(
      JSON.stringify({ success: false, error: 'Method not allowed' }),
      { status: 405, headers: { 'Content-Type': 'application/json', ...corsHeaders } }
    );
  }

  try {
    const supabase = createSupabaseClient();

    // Parse request body
    const body = await request.json();
    const {
      email,
      mobile,
      name,
      password,
      dob,
      gender,
      referred_by
    } = body;

    // Validation
    if (!email || !mobile || !name || !password) {
      return new Response(
        JSON.stringify({ success: false, error: 'Email, mobile, name and password are required' }),
        { status: 400, headers: { 'Content-Type': 'application/json', ...corsHeaders } }
      );
    }

    // Email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return new Response(
        JSON.stringify({ success: false, error: 'Invalid email format' }),
        { status: 400, headers: { 'Content-Type': 'application/json', ...corsHeaders } }
      );
    }

    // Mobile validation (10 digits Indian)
    const mobileRegex = /^[6-9]\d{9}$/;
    if (!mobileRegex.test(mobile)) {
      return new Response(
        JSON.stringify({ success: false, error: 'Invalid mobile number' }),
        { status: 400, headers: { 'Content-Type': 'application/json', ...corsHeaders } }
      );
    }

    // Password validation (min 6 chars)
    if (password.length < 6) {
      return new Response(
        JSON.stringify({ success: false, error: 'Password must be at least 6 characters' }),
        { status: 400, headers: { 'Content-Type': 'application/json', ...corsHeaders } }
      );
    }

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

    // Check if user already exists by email
    const emailCheckUrl = `${supabaseUrl}/rest/v1/customers?email=eq.${encodeURIComponent(email)}&select=email`;
    const emailCheckResponse = await fetch(emailCheckUrl, {
      headers: {
        'apikey': supabaseKey,
        'Authorization': `Bearer ${supabaseKey}`,
      },
    });
    const existingUserByEmailData = await emailCheckResponse.json();
    const existingUserByEmail = existingUserByEmailData[0];

    if (existingUserByEmail) {
      return new Response(
        JSON.stringify({ success: false, error: 'Email already registered' }),
        { status: 400, headers: { 'Content-Type': 'application/json', ...corsHeaders } }
      );
    }

    // Check if user already exists by mobile
    const mobileCheckUrl = `${supabaseUrl}/rest/v1/customers?mobile=eq.${mobile}&select=mobile`;
    const mobileCheckResponse = await fetch(mobileCheckUrl, {
      headers: {
        'apikey': supabaseKey,
        'Authorization': `Bearer ${supabaseKey}`,
      },
    });
    const existingUserByMobileData = await mobileCheckResponse.json();
    const existingUserByMobile = existingUserByMobileData[0];

    if (existingUserByMobile) {
      return new Response(
        JSON.stringify({ success: false, error: 'Mobile number already registered' }),
        { status: 400, headers: { 'Content-Type': 'application/json', ...corsHeaders } }
      );
    }

    // Create auth user in Supabase Auth
    const { data: authData, error: authError } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          name,
          mobile,
          user_type: 'customer'
        }
      }
    });

    if (authError) {
      return new Response(
        JSON.stringify({ success: false, error: authError.message }),
        { status: 400, headers: { 'Content-Type': 'application/json', ...corsHeaders } }
      );
    }

    // Check if customer record already exists
    const customerCheckUrl = `${supabaseUrl}/rest/v1/customers?email=eq.${encodeURIComponent(email)}&select=*`;
    const customerCheckResponse = await fetch(customerCheckUrl, {
      headers: {
        'apikey': supabaseKey,
        'Authorization': `Bearer ${supabaseKey}`,
      },
    });
    const existingCustData = await customerCheckResponse.json();
    const existingCust = existingCustData[0];

    let custId;
    let customerData;

    if (!existingCust) {
      // Insert customer record
      const insertResponse = await fetch(`${supabaseUrl}/rest/v1/customers`, {
        method: 'POST',
        headers: {
          'apikey': supabaseKey,
          'Authorization': `Bearer ${supabaseKey}`,
          'Content-Type': 'application/json',
          'Prefer': 'return=representation'
        },
        body: JSON.stringify({
          email,
          mobile,
          name,
          dob: dob || null,
          gender: gender || null,
          referred_by: referred_by || null,
          trust_score: 100,
          wallet_balance: 0,
          coins: 0,
          cod_status: 'ACTIVE',
          is_active: true,
          created_at: new Date().toISOString()
        })
      });
      
      const insertedCustomerData = await insertResponse.json();
      const insertedCustomer = insertedCustomerData[0];

      if (!insertedCustomer) {
        return new Response(
          JSON.stringify({ success: false, error: 'Failed to create customer profile' }),
          { status: 500, headers: { 'Content-Type': 'application/json', ...corsHeaders } }
        );
      }

      customerData = insertedCustomer;
      custId = insertedCustomer.cust_id;
    } else {
      customerData = existingCust;
      custId = existingCust.cust_id;
    }

    // Create wallet transaction for welcome bonus (50 coins)
    await fetch(`${supabaseUrl}/rest/v1/coin_transactions`, {
      method: 'POST',
      headers: {
        'apikey': supabaseKey,
        'Authorization': `Bearer ${supabaseKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        cust_id: custId,
        coins: 50,
        type: 'credit',
        reason: 'Welcome bonus',
        created_at: new Date().toISOString()
      })
    });

    // Update customer coins
    await fetch(`${supabaseUrl}/rest/v1/customers?cust_id=eq.${custId}`, {
      method: 'PATCH',
      headers: {
        'apikey': supabaseKey,
        'Authorization': `Bearer ${supabaseKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ coins: 50 })
    });

    // Process referral if referred_by is provided
    if (referred_by) {
      const referrerUrl = `${supabaseUrl}/rest/v1/customers?referral_code=eq.${encodeURIComponent(referred_by)}&select=cust_id`;
      const referrerResponse = await fetch(referrerUrl, {
        headers: {
          'apikey': supabaseKey,
          'Authorization': `Bearer ${supabaseKey}`,
        },
      });
      const referrerData = await referrerResponse.json();
      const referrer = referrerData[0];

      if (referrer) {
        await fetch(`${supabaseUrl}/rest/v1/referrals`, {
          method: 'POST',
          headers: {
            'apikey': supabaseKey,
            'Authorization': `Bearer ${supabaseKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            referrer_cust_id: referrer.cust_id,
            referred_cust_id: custId,
            referred_email: email,
            status: 'PENDING',
            created_at: new Date().toISOString()
          })
        });
      }
    }

    // Send welcome notification
    await fetch(`${supabaseUrl}/rest/v1/notifications`, {
      method: 'POST',
      headers: {
        'apikey': supabaseKey,
        'Authorization': `Bearer ${supabaseKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        user_id: custId,
        user_type: 'customer',
        title: 'Welcome to Suriyawan Saffari! 🎉',
        message: 'Thank you for joining us. Use code WELCOME50 for 10% off on your first order.',
        type: 'promotion',
        is_read: false,
        created_at: new Date().toISOString()
      })
    });

    // Return success response
    return new Response(
      JSON.stringify({
        success: true,
        message: 'Signup successful',
        data: {
          cust_id: custId,
          email: customerData.email,
          name: customerData.name,
          mobile: customerData.mobile,
          trust_score: customerData.trust_score,
          wallet_balance: customerData.wallet_balance,
          coins: customerData.coins || 50,
          cod_status: customerData.cod_status,
          referral_code: customerData.referral_code,
          created_at: customerData.created_at
        },
        auth: {
          access_token: authData.session?.access_token,
          refresh_token: authData.session?.refresh_token
        }
      }),
      { status: 200, headers: { 'Content-Type': 'application/json', ...corsHeaders } }
    );

  } catch (error) {
    console.error('Signup error:', error);
    return new Response(
      JSON.stringify({ success: false, error: error.message || 'Internal server error' }),
      { status: 500, headers: { 'Content-Type': 'application/json', ...corsHeaders } }
    );
  }
}