// api/owner/users/create-seller.js
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

  if (request.method !== 'POST') {
    return new Response(JSON.stringify({ success: false, error: 'Method not allowed' }), {
      status: 405,
      headers: { 'Content-Type': 'application/json', ...corsHeaders }
    });
  }

  try {
    const body = await request.json();
    const {
      email,
      mobile,
      shop_name,
      owner_name,
      upi_id,
      gst_number,
      pan_number,
      commission_rate,
      password
    } = body;

    // Validation
    if (!email || !mobile || !shop_name || !owner_name || !upi_id) {
      return new Response(JSON.stringify({
        success: false,
        error: 'Email, mobile, shop name, owner name and UPI ID are required'
      }), {
        status: 400,
        headers: { 'Content-Type': 'application/json', ...corsHeaders }
      });
    }

    // Email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return new Response(JSON.stringify({ success: false, error: 'Invalid email format' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json', ...corsHeaders }
      });
    }

    // Mobile validation
    const mobileRegex = /^[6-9]\d{9}$/;
    if (!mobileRegex.test(mobile)) {
      return new Response(JSON.stringify({ success: false, error: 'Invalid mobile number' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json', ...corsHeaders }
      });
    }

    const supabase = createSupabaseClient();
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

    // Check if seller already exists
    const existingEmailUrl = `${supabaseUrl}/rest/v1/sellers?email=eq.${encodeURIComponent(email)}&select=seller_id`;
    const existingEmailResponse = await fetch(existingEmailUrl, {
      headers: {
        'apikey': supabaseKey,
        'Authorization': `Bearer ${supabaseKey}`,
      },
    });
    const existingEmailData = await existingEmailResponse.json();
    const existingEmailSeller = existingEmailData[0];

    if (existingEmailSeller) {
      return new Response(JSON.stringify({ success: false, error: 'Seller with this email already exists' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json', ...corsHeaders }
      });
    }

    const existingMobileUrl = `${supabaseUrl}/rest/v1/sellers?mobile=eq.${mobile}&select=seller_id`;
    const existingMobileResponse = await fetch(existingMobileUrl, {
      headers: {
        'apikey': supabaseKey,
        'Authorization': `Bearer ${supabaseKey}`,
      },
    });
    const existingMobileData = await existingMobileResponse.json();
    const existingMobileSeller = existingMobileData[0];

    if (existingMobileSeller) {
      return new Response(JSON.stringify({ success: false, error: 'Seller with this mobile number already exists' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json', ...corsHeaders }
      });
    }

    // Generate SELLER ID
    const date = new Date();
    const dateStr = date.toISOString().slice(0, 10).replace(/-/g, '');
    const lastSellerUrl = `${supabaseUrl}/rest/v1/sellers?select=seller_id&order=created_at.desc&limit=1`;
    const lastSellerResponse = await fetch(lastSellerUrl, {
      headers: {
        'apikey': supabaseKey,
        'Authorization': `Bearer ${supabaseKey}`,
      },
    });
    const lastSellerData = await lastSellerResponse.json();
    const lastSeller = lastSellerData[0];

    let serial = '0001';
    if (lastSeller && lastSeller.seller_id) {
      const lastSerial = parseInt(lastSeller.seller_id.slice(-4));
      serial = String(lastSerial + 1).padStart(4, '0');
    }

    const sellerId = `SELL${dateStr}${serial}`;

    // Create auth user for seller (if password provided)
    let authData = null;
    let authError = null;

    if (password) {
      const { data: auth, error: signUpError } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: {
            name: owner_name,
            user_type: 'seller',
            seller_id: sellerId
          }
        }
      });
      authData = auth;
      authError = signUpError;
    }

    // Create seller record
    const sellerInsert = await supabase
      .from('sellers')
      .insert({
        seller_id: sellerId,
        email,
        mobile,
        shop_name,
        owner_name,
        upi_id,
        gst_number: gst_number || null,
        pan_number: pan_number || null,
        commission_rate: commission_rate || 10,
        kyc_status: 'PENDING',
        is_active: true,
        trust_score: 100,
        wallet_balance: 0,
        created_at: new Date().toISOString()
      })
      .select();

    if (sellerInsert.error) {
      console.error('Seller creation error:', sellerInsert.error);
      return new Response(JSON.stringify({ success: false, error: sellerInsert.error.message }), {
        status: 500,
        headers: { 'Content-Type': 'application/json', ...corsHeaders }
      });
    }

    const newSeller = sellerInsert.data;

    // Create welcome notification
    await fetch(`${supabaseUrl}/rest/v1/notifications`, {
      method: 'POST',
      headers: {
        'apikey': supabaseKey,
        'Authorization': `Bearer ${supabaseKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        user_id: sellerId,
        user_type: 'seller',
        title: 'Welcome to Suriyawan Saffari! 🎉',
        message: 'Your seller account has been created. Please complete your KYC to start selling.',
        type: 'account',
        data: { seller_id: sellerId },
        created_at: new Date().toISOString()
      })
    });

    // Notify owner about new seller
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
        title: 'New Seller Registered',
        message: `${shop_name} (${owner_name}) has registered as a seller. Pending KYC approval.`,
        type: 'seller',
        data: { seller_id: sellerId, action: 'approve_kyc' },
        created_at: new Date().toISOString()
      })
    });

    return new Response(JSON.stringify({
      success: true,
      message: 'Seller created successfully',
      seller: {
        seller_id: newSeller.seller_id,
        email: newSeller.email,
        mobile: newSeller.mobile,
        shop_name: newSeller.shop_name,
        owner_name: newSeller.owner_name,
        upi_id: newSeller.upi_id,
        gst_number: newSeller.gst_number,
        commission_rate: newSeller.commission_rate,
        kyc_status: newSeller.kyc_status,
        is_active: newSeller.is_active,
        created_at: newSeller.created_at
      },
      auth: authData ? {
        email: authData.user?.email,
        user_id: authData.user?.id
      } : null,
      barcode_url: `/api/barcode/generate?text=${sellerId}`,
      qr_url: `/api/barcode/generate-qr?text=${sellerId}`,
      next_steps: [
        'Seller needs to complete KYC documentation',
        'Upload GST certificate (optional but recommended)',
        'Add bank details for payouts',
        'Start adding products after KYC approval'
      ]
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json', ...corsHeaders }
    });

  } catch (error) {
    console.error('Create seller error:', error);
    return new Response(JSON.stringify({
      success: false,
      error: error.message || 'Internal server error'
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json', ...corsHeaders }
    });
  }
}