// api/auth/logout.js
// Edge Function for Vercel Deployment

export const config = {
  runtime: 'edge',
  regions: ['iad1', 'sfo1', 'fra1', 'sin1'],
};

// Helper function to create Supabase client in Edge environment
function createSupabaseClient(useServiceRole = false) {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  let supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  
  if (useServiceRole) {
    const serviceRole = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (serviceRole) {
      supabaseKey = serviceRole;
    }
  }
  
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
            return { data: result, error: null };
          }
        })
      })
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
      },
      signOut: async () => {
        // In Edge Runtime, signOut is just a client-side operation
        // No server-side call needed as token revocation is handled by client
        return { error: null };
      },
      admin: {
        signOut: async (token) => {
          const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
          const serviceRole = process.env.SUPABASE_SERVICE_ROLE_KEY;
          
          if (!serviceRole) {
            return { error: null };
          }
          
          // Attempt to revoke the token via admin API
          const response = await fetch(`${supabaseUrl}/auth/v1/admin/users/${token}`, {
            method: 'DELETE',
            headers: {
              'apikey': serviceRole,
              'Authorization': `Bearer ${serviceRole}`,
            },
          });
          
          if (!response.ok) {
            return { error: { message: 'Failed to revoke token' } };
          }
          
          return { error: null };
        }
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
    // Create both regular and admin client
    const supabase = createSupabaseClient(false);
    const supabaseAdmin = createSupabaseClient(true);

    // Get the access token from authorization header
    const authHeader = request.headers.get('authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return new Response(
        JSON.stringify({ success: false, error: 'No token provided' }),
        { status: 401, headers: { 'Content-Type': 'application/json', ...corsHeaders } }
      );
    }

    const token = authHeader.split(' ')[1];

    // Sign out from Supabase Auth using admin API
    const { error: signOutError } = await supabaseAdmin.auth.admin.signOut(token);

    if (signOutError) {
      // Try user sign out as fallback
      const { error: userSignOutError } = await supabase.auth.signOut();
      if (userSignOutError) {
        console.error('Sign out error:', userSignOutError);
      }
    }

    // Get user info for logging
    let userId = null;
    let userType = null;

    try {
      const { data: { user } } = await supabase.auth.getUser(token);
      if (user && user.email) {
        const userEmail = user.email;

        // Find user type from email
        const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
        const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
        
        // Check customers table
        const customerResponse = await fetch(`${supabaseUrl}/rest/v1/customers?email=eq.${encodeURIComponent(userEmail)}&select=cust_id`, {
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
        } else {
          // Check sellers table
          const sellerResponse = await fetch(`${supabaseUrl}/rest/v1/sellers?email=eq.${encodeURIComponent(userEmail)}&select=seller_id`, {
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
          } else {
            // Check riders table
            const riderResponse = await fetch(`${supabaseUrl}/rest/v1/riders?email=eq.${encodeURIComponent(userEmail)}&select=rider_id`, {
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
            }
          }
        }
      }
    } catch (err) {
      // Ignore errors when getting user info
      console.log('Could not fetch user info:', err);
    }

    // Log logout activity if user info available
    if (userId && userType) {
      await supabase
        .from('notifications')
        .insert({
          user_id: userId,
          user_type: userType,
          title: 'Logged Out',
          message: 'You have successfully logged out',
          type: 'system',
          is_read: false,
          created_at: new Date().toISOString()
        });
    }

    // If rider was online, set offline status
    if (userType === 'rider' && userId) {
      const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
      const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
      
      await fetch(`${supabaseUrl}/rest/v1/riders?rider_id=eq.${userId}`, {
        method: 'PATCH',
        headers: {
          'apikey': supabaseKey,
          'Authorization': `Bearer ${supabaseKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ 
          is_online: false,
          updated_at: new Date().toISOString()
        })
      });
    }

    return new Response(
      JSON.stringify({
        success: true,
        message: 'Logged out successfully'
      }),
      { status: 200, headers: { 'Content-Type': 'application/json', ...corsHeaders } }
    );

  } catch (error) {
    console.error('Logout error:', error);
    return new Response(
      JSON.stringify({
        success: false,
        error: error.message || 'Internal server error'
      }),
      { status: 500, headers: { 'Content-Type': 'application/json', ...corsHeaders } }
    );
  }
}