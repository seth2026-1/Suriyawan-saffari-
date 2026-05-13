// api/owner/users/create-rider.js
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
      name,
      email,
      mobile,
      upi_id,
      dl_number,
      rc_number,
      aadhar,
      assigned_area,
      assigned_pincodes,
      rate_per_parcel,
      pickup_rate,
      password,
      hub_id
    } = body;

    // Validation
    if (!name || !email || !mobile || !upi_id) {
      return new Response(JSON.stringify({
        success: false,
        error: 'Name, email, mobile and UPI ID are required'
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

    // Check if rider already exists
    const existingEmailUrl = `${supabaseUrl}/rest/v1/riders?email=eq.${encodeURIComponent(email)}&select=rider_id`;
    const existingEmailResponse = await fetch(existingEmailUrl, {
      headers: {
        'apikey': supabaseKey,
        'Authorization': `Bearer ${supabaseKey}`,
      },
    });
    const existingEmailData = await existingEmailResponse.json();
    const existingEmailRider = existingEmailData[0];

    if (existingEmailRider) {
      return new Response(JSON.stringify({ success: false, error: 'Rider with this email already exists' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json', ...corsHeaders }
      });
    }

    const existingMobileUrl = `${supabaseUrl}/rest/v1/riders?mobile=eq.${mobile}&select=rider_id`;
    const existingMobileResponse = await fetch(existingMobileUrl, {
      headers: {
        'apikey': supabaseKey,
        'Authorization': `Bearer ${supabaseKey}`,
      },
    });
    const existingMobileData = await existingMobileResponse.json();
    const existingMobileRider = existingMobileData[0];

    if (existingMobileRider) {
      return new Response(JSON.stringify({ success: false, error: 'Rider with this mobile number already exists' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json', ...corsHeaders }
      });
    }

    // Generate RIDER ID
    const date = new Date();
    const dateStr = date.toISOString().slice(0, 10).replace(/-/g, '');
    const lastRiderUrl = `${supabaseUrl}/rest/v1/riders?select=rider_id&order=created_at.desc&limit=1`;
    const lastRiderResponse = await fetch(lastRiderUrl, {
      headers: {
        'apikey': supabaseKey,
        'Authorization': `Bearer ${supabaseKey}`,
      },
    });
    const lastRiderData = await lastRiderResponse.json();
    const lastRider = lastRiderData[0];

    let serial = '0001';
    if (lastRider && lastRider.rider_id) {
      const lastSerial = parseInt(lastRider.rider_id.slice(-4));
      serial = String(lastSerial + 1).padStart(4, '0');
    }

    const riderId = `RIDE${dateStr}${serial}`;

    // Create auth user for rider (if password provided)
    let authData = null;
    let authError = null;

    if (password) {
      const { data: auth, error: signUpError } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: {
            name: name,
            user_type: 'rider',
            rider_id: riderId
          }
        }
      });
      authData = auth;
      authError = signUpError;
    }

    // Create rider record
    const riderInsert = await supabase
      .from('riders')
      .insert({
        rider_id: riderId,
        name,
        email,
        mobile,
        upi_id,
        dl_number: dl_number || null,
        rc_number: rc_number || null,
        aadhar: aadhar || null,
        assigned_area: assigned_area || null,
        assigned_pincodes: assigned_pincodes || [],
        rate_per_parcel: rate_per_parcel || 18,
        pickup_rate: pickup_rate || 10,
        is_active: true,
        is_online: false,
        wallet_balance: 0,
        created_at: new Date().toISOString(),
        created_by: hub_id || 'OWN001'
      })
      .select();

    if (riderInsert.error) {
      console.error('Rider creation error:', riderInsert.error);
      return new Response(JSON.stringify({ success: false, error: riderInsert.error.message }), {
        status: 500,
        headers: { 'Content-Type': 'application/json', ...corsHeaders }
      });
    }

    const newRider = riderInsert.data;

    // Create welcome notification
    await fetch(`${supabaseUrl}/rest/v1/notifications`, {
      method: 'POST',
      headers: {
        'apikey': supabaseKey,
        'Authorization': `Bearer ${supabaseKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        user_id: riderId,
        user_type: 'rider',
        title: 'Welcome to Suriyawan Saffari! 🛵',
        message: 'Your rider account has been created. You can now accept delivery runsheets.',
        type: 'account',
        data: { rider_id: riderId },
        created_at: new Date().toISOString()
      })
    });

    // Notify owner about new rider
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
        title: 'New Rider Registered',
        message: `${name} has been registered as a delivery rider.`,
        type: 'rider',
        data: { rider_id: riderId },
        created_at: new Date().toISOString()
      })
    });

    // If hub_id provided, notify hub manager
    if (hub_id) {
      await fetch(`${supabaseUrl}/rest/v1/notifications`, {
        method: 'POST',
        headers: {
          'apikey': supabaseKey,
          'Authorization': `Bearer ${supabaseKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          user_id: hub_id,
          user_type: 'hub',
          title: 'New Rider Assigned',
          message: `${name} has been assigned to your hub as a delivery rider.`,
          type: 'rider',
          data: { rider_id: riderId },
          created_at: new Date().toISOString()
        })
      });
    }

    return new Response(JSON.stringify({
      success: true,
      message: 'Rider created successfully',
      rider: {
        rider_id: newRider.rider_id,
        name: newRider.name,
        email: newRider.email,
        mobile: newRider.mobile,
        upi_id: newRider.upi_id,
        assigned_area: newRider.assigned_area,
        assigned_pincodes: newRider.assigned_pincodes,
        rate_per_parcel: newRider.rate_per_parcel,
        pickup_rate: newRider.pickup_rate,
        is_active: newRider.is_active,
        created_at: newRider.created_at
      },
      auth: authData ? {
        email: authData.user?.email,
        user_id: authData.user?.id
      } : null,
      barcode_url: `/api/barcode/generate?text=${riderId}`,
      qr_url: `/api/barcode/generate-qr?text=${riderId}`,
      next_steps: [
        'Rider can now log in to the rider app',
        'Download and install the rider app',
        'Complete profile and document upload',
        'Start accepting runsheets'
      ]
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json', ...corsHeaders }
    });

  } catch (error) {
    console.error('Create rider error:', error);
    return new Response(JSON.stringify({
      success: false,
      error: error.message || 'Internal server error'
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json', ...corsHeaders }
    });
  }
}