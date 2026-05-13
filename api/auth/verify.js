// api/auth/verify.js
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
      }
    }),
    auth: {
      getUser: async (token) => {
        const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
        const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
        
        const response = await fetch(`${supabaseUrl}/auth/v1/user`, {
          method: 'GET',
          headers: {
            'apikey': supabaseKey,
            'Authorization': `Bearer ${token}`,
          },
        });
        
        const data = await response.json();
        
        if (!response.ok) {
          return { data: null, error: data };
        }
        
        return { data: { user: data }, error: null };
      }
    }
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

  // Only allow GET or POST
  if (request.method !== 'GET' && request.method !== 'POST') {
    return new Response(
      JSON.stringify({ success: false, error: 'Method not allowed' }),
      { status: 405, headers: { 'Content-Type': 'application/json', ...corsHeaders } }
    );
  }

  try {
    const supabase = createSupabaseClient();

    // Get the access token from authorization header
    const authHeader = request.headers.get('authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: 'No token provided',
          is_authenticated: false 
        }),
        { status: 401, headers: { 'Content-Type': 'application/json', ...corsHeaders } }
      );
    }

    const token = authHeader.split(' ')[1];

    // Verify token with Supabase
    const { data: { user }, error: userError } = await supabase.auth.getUser(token);

    if (userError || !user) {
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: 'Invalid or expired token',
          is_authenticated: false 
        }),
        { status: 401, headers: { 'Content-Type': 'application/json', ...corsHeaders } }
      );
    }

    // Get user email
    const userEmail = user.email;

    // Determine user type and get full profile
    let userData = null;
    let userType = null;
    let userId = null;

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

    // Check if customer
    const customerUrl = `${supabaseUrl}/rest/v1/customers?email=eq.${encodeURIComponent(userEmail)}&select=*`;
    const customerResponse = await fetch(customerUrl, {
      headers: {
        'apikey': supabaseKey,
        'Authorization': `Bearer ${supabaseKey}`,
      },
    });
    const customerData = await customerResponse.json();
    const customer = customerData[0];

    if (customer) {
      userType = 'customer';
      userId = customer.cust_id;
      userData = {
        cust_id: customer.cust_id,
        name: customer.name,
        email: customer.email,
        mobile: customer.mobile,
        photo: customer.photo,
        trust_score: customer.trust_score,
        wallet_balance: customer.wallet_balance,
        coins: customer.coins,
        cod_status: customer.cod_status,
        referral_code: customer.referral_code,
        is_active: customer.is_active,
        created_at: customer.created_at
      };

      // Check if COD is blocked
      if (customer.cod_status === 'BLOCKED') {
        return new Response(
          JSON.stringify({
            success: true,
            is_authenticated: true,
            user_type: 'customer',
            user: userData,
            warnings: {
              cod_blocked: true,
              cod_block_until: customer.cod_block_until,
              cod_block_reason: customer.cod_block_reason
            }
          }),
          { status: 200, headers: { 'Content-Type': 'application/json', ...corsHeaders } }
        );
      }
    }

    // Check if seller
    if (!userData) {
      const sellerUrl = `${supabaseUrl}/rest/v1/sellers?email=eq.${encodeURIComponent(userEmail)}&select=*`;
      const sellerResponse = await fetch(sellerUrl, {
        headers: {
          'apikey': supabaseKey,
          'Authorization': `Bearer ${supabaseKey}`,
        },
      });
      const sellerData = await sellerResponse.json();
      const seller = sellerData[0];

      if (seller) {
        userType = 'seller';
        userId = seller.seller_id;
        userData = {
          seller_id: seller.seller_id,
          shop_name: seller.shop_name,
          owner_name: seller.owner_name,
          email: seller.email,
          mobile: seller.mobile,
          upi_id: seller.upi_id,
          gst_number: seller.gst_number,
          kyc_status: seller.kyc_status,
          commission_rate: seller.commission_rate,
          rating: seller.rating,
          trust_score: seller.trust_score,
          wallet_balance: seller.wallet_balance,
          is_active: seller.is_active,
          created_at: seller.created_at
        };
      }
    }

    // Check if rider
    if (!userData) {
      const riderUrl = `${supabaseUrl}/rest/v1/riders?email=eq.${encodeURIComponent(userEmail)}&select=*`;
      const riderResponse = await fetch(riderUrl, {
        headers: {
          'apikey': supabaseKey,
          'Authorization': `Bearer ${supabaseKey}`,
        },
      });
      const riderData = await riderResponse.json();
      const rider = riderData[0];

      if (rider) {
        userType = 'rider';
        userId = rider.rider_id;
        userData = {
          rider_id: rider.rider_id,
          name: rider.name,
          email: rider.email,
          mobile: rider.mobile,
          upi_id: rider.upi_id,
          assigned_area: rider.assigned_area,
          assigned_pincodes: rider.assigned_pincodes,
          rate_per_parcel: rider.rate_per_parcel,
          rating: rider.rating,
          total_deliveries: rider.total_deliveries,
          wallet_balance: rider.wallet_balance,
          is_online: rider.is_online,
          is_active: rider.is_active
        };
      }
    }

    // Check if hub manager
    if (!userData) {
      const hubUrl = `${supabaseUrl}/rest/v1/hub_managers?email=eq.${encodeURIComponent(userEmail)}&select=*`;
      const hubResponse = await fetch(hubUrl, {
        headers: {
          'apikey': supabaseKey,
          'Authorization': `Bearer ${supabaseKey}`,
        },
      });
      const hubData = await hubResponse.json();
      const hub = hubData[0];

      if (hub) {
        userType = 'hub';
        userId = hub.hub_id;
        userData = {
          hub_id: hub.hub_id,
          name: hub.name,
          email: hub.email,
          mobile: hub.mobile,
          assigned_zone: hub.assigned_zone,
          assigned_pincodes: hub.assigned_pincodes,
          is_active: hub.is_active
        };
      }
    }

    // Check if admin
    if (!userData) {
      const adminUrl = `${supabaseUrl}/rest/v1/admin_users?email=eq.${encodeURIComponent(userEmail)}&select=*`;
      const adminResponse = await fetch(adminUrl, {
        headers: {
          'apikey': supabaseKey,
          'Authorization': `Bearer ${supabaseKey}`,
        },
      });
      const adminData = await adminResponse.json();
      const admin = adminData[0];

      if (admin) {
        userType = 'admin';
        userId = admin.admin_id;
        userData = {
          admin_id: admin.admin_id,
          name: admin.name,
          email: admin.email,
          mobile: admin.mobile,
          role: admin.role,
          permissions: admin.permissions,
          is_active: admin.is_active
        };
      }
    }

    // Check if owner
    if (!userData) {
      const ownerUrl = `${supabaseUrl}/rest/v1/owner?email=eq.${encodeURIComponent(userEmail)}&select=*`;
      const ownerResponse = await fetch(ownerUrl, {
        headers: {
          'apikey': supabaseKey,
          'Authorization': `Bearer ${supabaseKey}`,
        },
      });
      const ownerData = await ownerResponse.json();
      const owner = ownerData[0];

      if (owner) {
        userType = 'owner';
        userId = owner.owner_id;
        userData = {
          owner_id: owner.owner_id,
          name: owner.name,
          email: owner.email,
          mobile: owner.mobile,
          upi_id: owner.upi_id
        };
      }
    }

    // If no user found in any table
    if (!userData) {
      return new Response(
        JSON.stringify({
          success: true,
          is_authenticated: true,
          user_type: 'unknown',
          user: { email: userEmail },
          warning: 'User profile not found. Please complete your profile.'
        }),
        { status: 200, headers: { 'Content-Type': 'application/json', ...corsHeaders } }
      );
    }

    // Check if account is active
    if (userData.is_active === false) {
      return new Response(
        JSON.stringify({
          success: true,
          is_authenticated: true,
          user_type: userType,
          user: userData,
          is_active: false,
          warning: 'Your account is deactivated. Please contact support.'
        }),
        { status: 200, headers: { 'Content-Type': 'application/json', ...corsHeaders } }
      );
    }

    // Return success response
    return new Response(
      JSON.stringify({
        success: true,
        is_authenticated: true,
        user_type: userType,
        user_id: userId,
        user: userData,
        token_valid: true,
        token_expires_at: user.app_metadata?.expires_at || null
      }),
      { status: 200, headers: { 'Content-Type': 'application/json', ...corsHeaders } }
    );

  } catch (error) {
    console.error('Verify token error:', error);
    return new Response(
      JSON.stringify({
        success: false,
        error: error.message || 'Internal server error',
        is_authenticated: false
      }),
      { status: 500, headers: { 'Content-Type': 'application/json', ...corsHeaders } }
    );
  }
}