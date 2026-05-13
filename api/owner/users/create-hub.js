// api/owner/users/create-hub.js
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
      assigned_zone,
      assigned_pincodes,
      address,
      latitude,
      longitude,
      password
    } = body;

    // Validation
    if (!name || !email || !mobile) {
      return new Response(JSON.stringify({
        success: false,
        error: 'Name, email and mobile are required'
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

    // Check if hub manager already exists
    const existingEmailUrl = `${supabaseUrl}/rest/v1/hub_managers?email=eq.${encodeURIComponent(email)}&select=hub_id`;
    const existingEmailResponse = await fetch(existingEmailUrl, {
      headers: {
        'apikey': supabaseKey,
        'Authorization': `Bearer ${supabaseKey}`,
      },
    });
    const existingEmailData = await existingEmailResponse.json();
    const existingEmailHub = existingEmailData[0];

    if (existingEmailHub) {
      return new Response(JSON.stringify({ success: false, error: 'Hub manager with this email already exists' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json', ...corsHeaders }
      });
    }

    const existingMobileUrl = `${supabaseUrl}/rest/v1/hub_managers?mobile=eq.${mobile}&select=hub_id`;
    const existingMobileResponse = await fetch(existingMobileUrl, {
      headers: {
        'apikey': supabaseKey,
        'Authorization': `Bearer ${supabaseKey}`,
      },
    });
    const existingMobileData = await existingMobileResponse.json();
    const existingMobileHub = existingMobileData[0];

    if (existingMobileHub) {
      return new Response(JSON.stringify({ success: false, error: 'Hub manager with this mobile number already exists' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json', ...corsHeaders }
      });
    }

    // Generate HUB ID
    const date = new Date();
    const dateStr = date.toISOString().slice(0, 10).replace(/-/g, '');
    const lastHubUrl = `${supabaseUrl}/rest/v1/hub_managers?select=hub_id&order=created_at.desc&limit=1`;
    const lastHubResponse = await fetch(lastHubUrl, {
      headers: {
        'apikey': supabaseKey,
        'Authorization': `Bearer ${supabaseKey}`,
      },
    });
    const lastHubData = await lastHubResponse.json();
    const lastHub = lastHubData[0];

    let serial = '0001';
    if (lastHub && lastHub.hub_id) {
      const lastSerial = parseInt(lastHub.hub_id.slice(-4));
      serial = String(lastSerial + 1).padStart(4, '0');
    }

    const hubId = `HUB${dateStr}${serial}`;

    // Create auth user for hub manager (if password provided)
    let authData = null;
    let authError = null;

    if (password) {
      const { data: auth, error: signUpError } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: {
            name: name,
            user_type: 'hub',
            hub_id: hubId
          }
        }
      });
      authData = auth;
      authError = signUpError;
    }

    // Create hub manager record
    const hubInsert = await supabase
      .from('hub_managers')
      .insert({
        hub_id: hubId,
        name,
        email,
        mobile,
        assigned_zone: assigned_zone || null,
        assigned_pincodes: assigned_pincodes || [],
        address: address || null,
        latitude: latitude || null,
        longitude: longitude || null,
        is_active: true,
        created_at: new Date().toISOString(),
        created_by: 'OWN001'
      })
      .select();

    if (hubInsert.error) {
      console.error('Hub creation error:', hubInsert.error);
      return new Response(JSON.stringify({ success: false, error: hubInsert.error.message }), {
        status: 500,
        headers: { 'Content-Type': 'application/json', ...corsHeaders }
      });
    }

    const newHub = hubInsert.data;

    // Create welcome notification to hub
    await fetch(`${supabaseUrl}/rest/v1/notifications`, {
      method: 'POST',
      headers: {
        'apikey': supabaseKey,
        'Authorization': `Bearer ${supabaseKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        user_id: hubId,
        user_type: 'hub',
        title: 'Welcome to Suriyawan Saffari! 🏢',
        message: 'Your hub manager account has been created. You can now manage logistics operations.',
        type: 'account',
        data: { hub_id: hubId },
        created_at: new Date().toISOString()
      })
    });

    // Notify owner about new hub
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
        title: 'New Hub Created',
        message: `${name} has been appointed as hub manager for ${assigned_zone || 'zone'}.`,
        type: 'hub',
        data: { hub_id: hubId },
        created_at: new Date().toISOString()
      })
    });

    return new Response(JSON.stringify({
      success: true,
      message: 'Hub manager created successfully',
      hub: {
        hub_id: newHub.hub_id,
        name: newHub.name,
        email: newHub.email,
        mobile: newHub.mobile,
        assigned_zone: newHub.assigned_zone,
        assigned_pincodes: newHub.assigned_pincodes,
        address: newHub.address,
        is_active: newHub.is_active,
        created_at: newHub.created_at
      },
      auth: authData ? {
        email: authData.user?.email,
        user_id: authData.user?.id
      } : null,
      barcode_url: `/api/barcode/generate?text=${hubId}`,
      qr_url: `/api/barcode/generate-qr?text=${hubId}`,
      next_steps: [
        'Hub manager can now log in to the hub portal',
        'Download and install the hub management app',
        'Start creating runsheets and managing riders',
        'Set up pickup and delivery zones'
      ]
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json', ...corsHeaders }
    });

  } catch (error) {
    console.error('Create hub error:', error);
    return new Response(JSON.stringify({
      success: false,
      error: error.message || 'Internal server error'
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json', ...corsHeaders }
    });
  }
}