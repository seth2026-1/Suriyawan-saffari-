// api/auth/login.js
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
      signInWithPassword: async ({ email, password }) => {
        const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
        const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
        
        const response = await fetch(`${supabaseUrl}/auth/v1/token?grant_type=password`, {
          method: 'POST',
          headers: {
            'apikey': supabaseKey,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            email,
            password,
          }),
        });
        
        const data = await response.json();
        
        if (!response.ok) {
          return { data: null, error: data };
        }
        
        return {
          data: {
            user: data.user,
            session: {
              access_token: data.access_token,
              refresh_token: data.refresh_token,
              expires_at: Math.floor(Date.now() / 1000) + data.expires_in
            }
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
    const { email, mobile, password, user_type } = body;

    // Validation
    if ((!email && !mobile) || !password) {
      return new Response(
        JSON.stringify({ success: false, error: 'Email/mobile and password are required' }),
        { status: 400, headers: { 'Content-Type': 'application/json', ...corsHeaders } }
      );
    }

    let loginEmail = email;
    let profile = null;
    let userType = user_type || 'customer';

    // If mobile is provided, find email first
    if (mobile && !email) {
      let tableName = 'customers';
      if (userType === 'seller') tableName = 'sellers';
      else if (userType === 'rider') tableName = 'riders';
      else if (userType === 'hub') tableName = 'hub_managers';
      else if (userType === 'admin') tableName = 'admin_users';

      const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
      const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
      
      const mobileUrl = `${supabaseUrl}/rest/v1/${tableName}?mobile=eq.${mobile}&select=email`;
      const mobileResponse = await fetch(mobileUrl, {
        headers: {
          'apikey': supabaseKey,
          'Authorization': `Bearer ${supabaseKey}`,
        },
      });
      
      const userByMobileData = await mobileResponse.json();
      const userByMobile = userByMobileData[0];

      if (userByMobile) {
        loginEmail = userByMobile.email;
      } else {
        return new Response(
          JSON.stringify({ success: false, error: 'Invalid credentials' }),
          { status: 401, headers: { 'Content-Type': 'application/json', ...corsHeaders } }
        );
      }
    }

    // Login with Supabase Auth
    const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
      email: loginEmail,
      password: password
    });

    if (authError) {
      return new Response(
        JSON.stringify({ success: false, error: 'Invalid email or password' }),
        { status: 401, headers: { 'Content-Type': 'application/json', ...corsHeaders } }
      );
    }

    // Get user profile based on type
    let profileTable = 'customers';
    let idField = 'cust_id';

    if (userType === 'seller') {
      profileTable = 'sellers';
      idField = 'seller_id';
    } else if (userType === 'rider') {
      profileTable = 'riders';
      idField = 'rider_id';
    } else if (userType === 'hub') {
      profileTable = 'hub_managers';
      idField = 'hub_id';
    } else if (userType === 'admin') {
      profileTable = 'admin_users';
      idField = 'admin_id';
    } else if (userType === 'owner') {
      profileTable = 'owner';
      idField = 'owner_id';
    }

    const { data: profileData, error: profileError } = await supabase
      .from(profileTable)
      .select('*')
      .eq('email', loginEmail)
      .single();

    if (!profileError && profileData) {
      profile = profileData;
    }

    // Check if account is active
    if (profile && profile.is_active === false) {
      return new Response(
        JSON.stringify({ success: false, error: 'Your account has been deactivated. Please contact support.' }),
        { status: 403, headers: { 'Content-Type': 'application/json', ...corsHeaders } }
      );
    }

    // Check COD status for customers
    if (userType === 'customer' && profile && profile.cod_status === 'BLOCKED') {
      return new Response(
        JSON.stringify({
          success: false,
          error: `COD is blocked for your account until ${profile.cod_block_until}. Reason: ${profile.cod_block_reason}`,
          cod_blocked: true,
          cod_block_until: profile.cod_block_until,
          cod_block_reason: profile.cod_block_reason
        }),
        { status: 403, headers: { 'Content-Type': 'application/json', ...corsHeaders } }
      );
    }

    // Update last login time
    if (profile) {
      await supabase
        .from(profileTable)
        .update({ updated_at: new Date().toISOString() })
        .eq('email', loginEmail);
    }

    // Prepare response data
    let responseData = {
      user_type: userType,
      auth: {
        access_token: authData.session.access_token,
        refresh_token: authData.session.refresh_token,
        expires_at: authData.session.expires_at
      }
    };

    if (profile) {
      if (userType === 'customer') {
        responseData.user = {
          cust_id: profile.cust_id,
          name: profile.name,
          email: profile.email,
          mobile: profile.mobile,
          photo: profile.photo,
          trust_score: profile.trust_score,
          wallet_balance: profile.wallet_balance,
          coins: profile.coins,
          cod_status: profile.cod_status,
          referral_code: profile.referral_code,
          created_at: profile.created_at
        };
      } else if (userType === 'seller') {
        responseData.user = {
          seller_id: profile.seller_id,
          shop_name: profile.shop_name,
          owner_name: profile.owner_name,
          email: profile.email,
          mobile: profile.mobile,
          upi_id: profile.upi_id,
          gst_number: profile.gst_number,
          kyc_status: profile.kyc_status,
          commission_rate: profile.commission_rate,
          rating: profile.rating,
          trust_score: profile.trust_score,
          wallet_balance: profile.wallet_balance,
          is_active: profile.is_active
        };
      } else if (userType === 'rider') {
        responseData.user = {
          rider_id: profile.rider_id,
          name: profile.name,
          email: profile.email,
          mobile: profile.mobile,
          upi_id: profile.upi_id,
          assigned_area: profile.assigned_area,
          assigned_pincodes: profile.assigned_pincodes,
          rate_per_parcel: profile.rate_per_parcel,
          rating: profile.rating,
          total_deliveries: profile.total_deliveries,
          wallet_balance: profile.wallet_balance,
          is_online: profile.is_online,
          is_active: profile.is_active
        };
      } else if (userType === 'hub') {
        responseData.user = {
          hub_id: profile.hub_id,
          name: profile.name,
          email: profile.email,
          mobile: profile.mobile,
          assigned_zone: profile.assigned_zone,
          assigned_pincodes: profile.assigned_pincodes,
          is_active: profile.is_active
        };
      } else if (userType === 'admin') {
        responseData.user = {
          admin_id: profile.admin_id,
          name: profile.name,
          email: profile.email,
          mobile: profile.mobile,
          role: profile.role,
          permissions: profile.permissions
        };
      } else if (userType === 'owner') {
        responseData.user = {
          owner_id: profile.owner_id,
          name: profile.name,
          email: profile.email,
          mobile: profile.mobile,
          upi_id: profile.upi_id
        };
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        message: 'Login successful',
        data: responseData
      }),
      { status: 200, headers: { 'Content-Type': 'application/json', ...corsHeaders } }
    );

  } catch (error) {
    console.error('Login error:', error);
    return new Response(
      JSON.stringify({ success: false, error: error.message || 'Internal server error' }),
      { status: 500, headers: { 'Content-Type': 'application/json', ...corsHeaders } }
    );
  }
}