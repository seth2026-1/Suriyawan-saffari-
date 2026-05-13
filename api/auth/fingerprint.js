// api/auth/fingerprint.js
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
        const response = await fetch(`${process.env.NEXT_PUBLIC_SUPABASE_URL}/auth/v1/token?grant_type=password`, {
          method: 'POST',
          headers: {
            'apikey': process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
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
    'Access-Control-Allow-Methods': 'POST, PUT, GET, OPTIONS',
    'Access-Control-Allow-Headers': 'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version, Authorization',
  };

  // Handle OPTIONS preflight
  if (request.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: corsHeaders });
  }

  try {
    const supabase = createSupabaseClient();

    // =====================================================
    // REGISTER FINGERPRINT (POST)
    // =====================================================
    if (request.method === 'POST') {
      const body = await request.json();
      const { user_id, user_type, fingerprint_data } = body;

      if (!user_id || !user_type || !fingerprint_data) {
        return new Response(
          JSON.stringify({ success: false, error: 'User ID, user type and fingerprint data are required' }),
          { status: 400, headers: { 'Content-Type': 'application/json', ...corsHeaders } }
        );
      }

      let tableName;
      let idField;

      switch (user_type) {
        case 'customer':
          tableName = 'customers';
          idField = 'cust_id';
          break;
        case 'seller':
          tableName = 'sellers';
          idField = 'seller_id';
          break;
        case 'rider':
          tableName = 'riders';
          idField = 'rider_id';
          break;
        case 'hub':
          tableName = 'hub_managers';
          idField = 'hub_id';
          break;
        case 'admin':
          tableName = 'admin_users';
          idField = 'admin_id';
          break;
        case 'owner':
          tableName = 'owner';
          idField = 'owner_id';
          break;
        default:
          return new Response(
            JSON.stringify({ success: false, error: 'Invalid user type' }),
            { status: 400, headers: { 'Content-Type': 'application/json', ...corsHeaders } }
          );
      }

      // Check if user exists
      const { data: existingUser, error: checkError } = await supabase
        .from(tableName)
        .select(idField)
        .eq(idField, user_id)
        .single();

      if (checkError || !existingUser) {
        return new Response(
          JSON.stringify({ success: false, error: 'User not found' }),
          { status: 404, headers: { 'Content-Type': 'application/json', ...corsHeaders } }
        );
      }

      // Update fingerprint data
      const { error: updateError } = await supabase
        .from(tableName)
        .update({
          fingerprint_data: fingerprint_data,
          updated_at: new Date().toISOString()
        })
        .eq(idField, user_id);

      if (updateError) {
        return new Response(
          JSON.stringify({ success: false, error: 'Failed to save fingerprint' }),
          { status: 500, headers: { 'Content-Type': 'application/json', ...corsHeaders } }
        );
      }

      return new Response(
        JSON.stringify({ success: true, message: 'Fingerprint registered successfully' }),
        { status: 200, headers: { 'Content-Type': 'application/json', ...corsHeaders } }
      );
    }

    // =====================================================
    // LOGIN WITH FINGERPRINT (PUT)
    // =====================================================
    if (request.method === 'PUT') {
      const body = await request.json();
      const { fingerprint_data, user_type } = body;

      if (!fingerprint_data || !user_type) {
        return new Response(
          JSON.stringify({ success: false, error: 'Fingerprint data and user type are required' }),
          { status: 400, headers: { 'Content-Type': 'application/json', ...corsHeaders } }
        );
      }

      let tableName;
      let idField;

      switch (user_type) {
        case 'customer':
          tableName = 'customers';
          idField = 'cust_id';
          break;
        case 'seller':
          tableName = 'sellers';
          idField = 'seller_id';
          break;
        case 'rider':
          tableName = 'riders';
          idField = 'rider_id';
          break;
        case 'hub':
          tableName = 'hub_managers';
          idField = 'hub_id';
          break;
        case 'admin':
          tableName = 'admin_users';
          idField = 'admin_id';
          break;
        case 'owner':
          tableName = 'owner';
          idField = 'owner_id';
          break;
        default:
          return new Response(
            JSON.stringify({ success: false, error: 'Invalid user type' }),
            { status: 400, headers: { 'Content-Type': 'application/json', ...corsHeaders } }
          );
      }

      // Build URL for fingerprint query
      const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
      const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
      
      const fingerprintUrl = `${supabaseUrl}/rest/v1/${tableName}?fingerprint_data=eq.${encodeURIComponent(fingerprint_data)}&select=*`;
      const fingerprintResponse = await fetch(fingerprintUrl, {
        headers: {
          'apikey': supabaseKey,
          'Authorization': `Bearer ${supabaseKey}`,
        },
      });
      
      const userData = await fingerprintResponse.json();
      const user = userData[0];

      if (!user) {
        return new Response(
          JSON.stringify({ success: false, error: 'Fingerprint not recognized' }),
          { status: 401, headers: { 'Content-Type': 'application/json', ...corsHeaders } }
        );
      }

      // Check if account is active
      if (user.is_active === false) {
        return new Response(
          JSON.stringify({ success: false, error: 'Your account has been deactivated. Please contact support.' }),
          { status: 403, headers: { 'Content-Type': 'application/json', ...corsHeaders } }
        );
      }

      // Check COD status for customers
      if (user_type === 'customer' && user.cod_status === 'BLOCKED') {
        return new Response(
          JSON.stringify({
            success: false,
            error: `COD is blocked for your account until ${user.cod_block_until}. Reason: ${user.cod_block_reason}`,
            cod_blocked: true,
            cod_block_until: user.cod_block_until,
            cod_block_reason: user.cod_block_reason
          }),
          { status: 403, headers: { 'Content-Type': 'application/json', ...corsHeaders } }
        );
      }

      // Attempt login with email and fingerprint-based password
      const { data: authUser, error: authError } = await supabase.auth.signInWithPassword({
        email: user.email,
        password: fingerprint_data.slice(0, 8)
      });

      let accessToken = null;
      let refreshToken = null;

      if (!authError && authUser && authUser.session) {
        accessToken = authUser.session.access_token;
        refreshToken = authUser.session.refresh_token;
      }

      // Update last login time
      await supabase
        .from(tableName)
        .update({ updated_at: new Date().toISOString() })
        .eq(idField, user[idField]);

      // Update rider online status
      if (user_type === 'rider') {
        const updateUrl = `${supabaseUrl}/rest/v1/riders?rider_id=eq.${user.rider_id}`;
        await fetch(updateUrl, {
          method: 'PATCH',
          headers: {
            'apikey': supabaseKey,
            'Authorization': `Bearer ${supabaseKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ is_online: true })
        });
      }

      // Prepare response
      let responseData = {
        user_type: user_type,
        auth: { access_token: accessToken, refresh_token: refreshToken }
      };

      if (user_type === 'customer') {
        responseData.user = {
          cust_id: user.cust_id,
          name: user.name,
          email: user.email,
          mobile: user.mobile,
          photo: user.photo,
          trust_score: user.trust_score,
          wallet_balance: user.wallet_balance,
          coins: user.coins,
          cod_status: user.cod_status,
          referral_code: user.referral_code
        };
      } else if (user_type === 'seller') {
        responseData.user = {
          seller_id: user.seller_id,
          shop_name: user.shop_name,
          owner_name: user.owner_name,
          email: user.email,
          mobile: user.mobile,
          upi_id: user.upi_id,
          kyc_status: user.kyc_status,
          commission_rate: user.commission_rate,
          rating: user.rating,
          wallet_balance: user.wallet_balance
        };
      } else if (user_type === 'rider') {
        responseData.user = {
          rider_id: user.rider_id,
          name: user.name,
          email: user.email,
          mobile: user.mobile,
          upi_id: user.upi_id,
          assigned_area: user.assigned_area,
          rate_per_parcel: user.rate_per_parcel,
          rating: user.rating,
          total_deliveries: user.total_deliveries,
          wallet_balance: user.wallet_balance,
          is_online: true
        };
      }

      return new Response(
        JSON.stringify({ success: true, message: 'Fingerprint login successful', data: responseData }),
        { status: 200, headers: { 'Content-Type': 'application/json', ...corsHeaders } }
      );
    }

    // =====================================================
    // CHECK IF FINGERPRINT EXISTS FOR USER (GET)
    // =====================================================
    if (request.method === 'GET') {
      const url = new URL(request.url);
      const user_id = url.searchParams.get('user_id');
      const user_type = url.searchParams.get('user_type');

      if (!user_id || !user_type) {
        return new Response(
          JSON.stringify({ success: false, error: 'User ID and user type are required' }),
          { status: 400, headers: { 'Content-Type': 'application/json', ...corsHeaders } }
        );
      }

      let tableName;
      let idField;

      switch (user_type) {
        case 'customer':
          tableName = 'customers';
          idField = 'cust_id';
          break;
        case 'seller':
          tableName = 'sellers';
          idField = 'seller_id';
          break;
        case 'rider':
          tableName = 'riders';
          idField = 'rider_id';
          break;
        case 'hub':
          tableName = 'hub_managers';
          idField = 'hub_id';
          break;
        default:
          return new Response(
            JSON.stringify({ success: false, error: 'Invalid user type' }),
            { status: 400, headers: { 'Content-Type': 'application/json', ...corsHeaders } }
          );
      }

      const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
      const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
      
      const checkUrl = `${supabaseUrl}/rest/v1/${tableName}?${idField}=eq.${user_id}&select=fingerprint_data`;
      const response = await fetch(checkUrl, {
        headers: {
          'apikey': supabaseKey,
          'Authorization': `Bearer ${supabaseKey}`,
        },
      });
      
      const userData = await response.json();
      const user = userData[0];

      if (!user) {
        return new Response(
          JSON.stringify({ success: true, has_fingerprint: false }),
          { status: 200, headers: { 'Content-Type': 'application/json', ...corsHeaders } }
        );
      }

      return new Response(
        JSON.stringify({ success: true, has_fingerprint: user.fingerprint_data !== null && user.fingerprint_data !== '', fingerprint_registered: user.fingerprint_data !== null }),
        { status: 200, headers: { 'Content-Type': 'application/json', ...corsHeaders } }
      );
    }

    // Method not allowed
    return new Response(
      JSON.stringify({ success: false, error: 'Method not allowed' }),
      { status: 405, headers: { 'Content-Type': 'application/json', ...corsHeaders } }
    );

  } catch (error) {
    console.error('Fingerprint error:', error);
    return new Response(
      JSON.stringify({ success: false, error: error.message || 'Internal server error' }),
      { status: 500, headers: { 'Content-Type': 'application/json', ...corsHeaders } }
    );
  }
}