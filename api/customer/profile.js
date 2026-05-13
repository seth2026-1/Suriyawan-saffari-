// api/customer/profile.js
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
            neq: (neqField, neqValue) => ({
              maybeSingle: async () => {
                const finalUrl = `${url}&${field}=eq.${value}&${neqField}=neq.${neqValue}`;
                const response = await fetch(finalUrl, {
                  headers: {
                    'apikey': supabaseKey,
                    'Authorization': `Bearer ${supabaseKey}`,
                  },
                });
                const data = await response.json();
                return { data: data[0] || null, error: null };
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
            })
          }),
          order: (orderField, { ascending }) => ({
            limit: async (limit) => {
              const sortOrder = ascending ? 'asc' : 'desc';
              const finalUrl = `${url}&order=${orderField}.${sortOrder}&limit=${limit}`;
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
      }),
      delete: () => ({
        eq: (field, value) => ({
          select: async () => {
            const response = await fetch(`${supabaseUrl}/rest/v1/${table}?${field}=eq.${value}`, {
              method: 'DELETE',
              headers: {
                'apikey': supabaseKey,
                'Authorization': `Bearer ${supabaseKey}`,
              },
            });
            return { error: null };
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
    'Access-Control-Allow-Methods': 'GET, PUT, POST, DELETE, OPTIONS',
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

    // =====================================================
    // GET PROFILE
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

      // Get customer profile
      const customerResult = await supabase
        .from('customers')
        .select('*')
        .eq('cust_id', cust_id)
        .single();

      if (customerResult.error || !customerResult.data) {
        return new Response(
          JSON.stringify({ success: false, error: 'Customer not found' }),
          { status: 404, headers: { 'Content-Type': 'application/json', ...corsHeaders } }
        );
      }

      const customer = customerResult.data;

      // Get address book
      const addressesUrl = `${supabaseUrl}/rest/v1/addresses?cust_id=eq.${cust_id}&order=is_default.desc&select=*`;
      const addressesResponse = await fetch(addressesUrl, {
        headers: {
          'apikey': supabaseKey,
          'Authorization': `Bearer ${supabaseKey}`,
        },
      });
      const addresses = await addressesResponse.json();

      // Get order statistics
      const ordersUrl = `${supabaseUrl}/rest/v1/orders?cust_id=eq.${cust_id}&select=status,final_amount`;
      const ordersResponse = await fetch(ordersUrl, {
        headers: {
          'apikey': supabaseKey,
          'Authorization': `Bearer ${supabaseKey}`,
        },
      });
      const orders = await ordersResponse.json();

      let orderStats = {
        total_orders: 0,
        total_spent: 0,
        delivered_orders: 0,
        cancelled_orders: 0,
        rto_orders: 0
      };

      if (orders && orders.length > 0) {
        orderStats.total_orders = orders.length;
        orderStats.total_spent = orders.reduce((sum, o) => sum + (o.final_amount || 0), 0);
        orderStats.delivered_orders = orders.filter(o => o.status === 'DELIVERED').length;
        orderStats.cancelled_orders = orders.filter(o => o.status === 'CANCELLED').length;
        orderStats.rto_orders = orders.filter(o => o.status === 'RTO').length;
      }

      // Get recent orders
      const recentOrdersUrl = `${supabaseUrl}/rest/v1/orders?cust_id=eq.${cust_id}&select=book_id,status,final_amount,placed_at&order=placed_at.desc&limit=5`;
      const recentOrdersResponse = await fetch(recentOrdersUrl, {
        headers: {
          'apikey': supabaseKey,
          'Authorization': `Bearer ${supabaseKey}`,
        },
      });
      const recentOrders = await recentOrdersResponse.json();

      // Get recent support tickets
      const recentTicketsUrl = `${supabaseUrl}/rest/v1/support_tickets?user_id=eq.${cust_id}&select=ticket_id,status,subject,created_at&order=created_at.desc&limit=5`;
      const recentTicketsResponse = await fetch(recentTicketsUrl, {
        headers: {
          'apikey': supabaseKey,
          'Authorization': `Bearer ${supabaseKey}`,
        },
      });
      const recentTickets = await recentTicketsResponse.json();

      // Build trust score history
      const trustScoreHistory = [];

      if (orderStats.delivered_orders > 0) {
        trustScoreHistory.push({
          event: `${orderStats.delivered_orders} successful deliveries`,
          points_change: orderStats.delivered_orders * 5,
          date: new Date().toISOString()
        });
      }
      if (orderStats.cancelled_orders > 0) {
        trustScoreHistory.push({
          event: `${orderStats.cancelled_orders} order cancellations`,
          points_change: -(orderStats.cancelled_orders * 20),
          date: new Date().toISOString()
        });
      }
      if (orderStats.rto_orders > 0) {
        trustScoreHistory.push({
          event: `${orderStats.rto_orders} RTO orders`,
          points_change: -(orderStats.rto_orders * 20),
          date: new Date().toISOString()
        });
      }

      return new Response(
        JSON.stringify({
          success: true,
          profile: {
            cust_id: customer.cust_id,
            name: customer.name,
            email: customer.email,
            mobile: customer.mobile,
            photo: customer.photo,
            dob: customer.dob,
            gender: customer.gender,
            trust_score: customer.trust_score,
            trust_score_history: trustScoreHistory,
            wallet_balance: customer.wallet_balance,
            coins: customer.coins,
            cod_status: customer.cod_status,
            cod_block_reason: customer.cod_block_reason,
            cod_block_until: customer.cod_block_until,
            referral_code: customer.referral_code,
            referred_by: customer.referred_by,
            created_at: customer.created_at,
            updated_at: customer.updated_at
          },
          addresses: addresses || [],
          order_statistics: orderStats,
          recent_activity: {
            orders: recentOrders || [],
            tickets: recentTickets || []
          },
          has_fingerprint: customer.fingerprint_data !== null
        }),
        { status: 200, headers: { 'Content-Type': 'application/json', ...corsHeaders } }
      );
    }

    // =====================================================
    // UPDATE PROFILE (PUT)
    // =====================================================
    if (request.method === 'PUT') {
      const body = await request.json();
      const { 
        cust_id, 
        name, 
        email, 
        mobile, 
        dob, 
        gender, 
        photo,
        upi_id 
      } = body;

      if (!cust_id) {
        return new Response(
          JSON.stringify({ success: false, error: 'Customer ID is required' }),
          { status: 400, headers: { 'Content-Type': 'application/json', ...corsHeaders } }
        );
      }

      // Build update object
      const updateData = {};
      if (name) updateData.name = name;
      if (email) updateData.email = email;
      if (mobile) updateData.mobile = mobile;
      if (dob) updateData.dob = dob;
      if (gender) updateData.gender = gender;
      if (photo) updateData.photo = photo;
      if (upi_id) updateData.upi_id = upi_id;

      updateData.updated_at = new Date().toISOString();

      // Check if email already exists for another user
      if (email) {
        const emailCheckUrl = `${supabaseUrl}/rest/v1/customers?email=eq.${encodeURIComponent(email)}&cust_id=neq.${cust_id}&select=cust_id`;
        const emailCheckResponse = await fetch(emailCheckUrl, {
          headers: {
            'apikey': supabaseKey,
            'Authorization': `Bearer ${supabaseKey}`,
          },
        });
        const existingEmailData = await emailCheckResponse.json();
        
        if (existingEmailData && existingEmailData.length > 0) {
          return new Response(
            JSON.stringify({ success: false, error: 'Email already registered by another user' }),
            { status: 400, headers: { 'Content-Type': 'application/json', ...corsHeaders } }
          );
        }
      }

      // Check if mobile already exists for another user
      if (mobile) {
        const mobileCheckUrl = `${supabaseUrl}/rest/v1/customers?mobile=eq.${mobile}&cust_id=neq.${cust_id}&select=cust_id`;
        const mobileCheckResponse = await fetch(mobileCheckUrl, {
          headers: {
            'apikey': supabaseKey,
            'Authorization': `Bearer ${supabaseKey}`,
          },
        });
        const existingMobileData = await mobileCheckResponse.json();
        
        if (existingMobileData && existingMobileData.length > 0) {
          return new Response(
            JSON.stringify({ success: false, error: 'Mobile number already registered by another user' }),
            { status: 400, headers: { 'Content-Type': 'application/json', ...corsHeaders } }
          );
        }
      }

      // Update profile
      const updateResult = await supabase
        .from('customers')
        .update(updateData)
        .eq('cust_id', cust_id)
        .select();

      if (updateResult.error) {
        console.error('Profile update error:', updateResult.error);
        return new Response(
          JSON.stringify({ success: false, error: updateResult.error.message }),
          { status: 500, headers: { 'Content-Type': 'application/json', ...corsHeaders } }
        );
      }

      const updatedProfile = updateResult.data;

      return new Response(
        JSON.stringify({
          success: true,
          message: 'Profile updated successfully',
          profile: {
            cust_id: updatedProfile.cust_id,
            name: updatedProfile.name,
            email: updatedProfile.email,
            mobile: updatedProfile.mobile,
            photo: updatedProfile.photo,
            dob: updatedProfile.dob,
            gender: updatedProfile.gender,
            upi_id: updatedProfile.upi_id,
            updated_at: updatedProfile.updated_at
          }
        }),
        { status: 200, headers: { 'Content-Type': 'application/json', ...corsHeaders } }
      );
    }

    // =====================================================
    // ADD/UPDATE ADDRESS (POST)
    // =====================================================
    if (request.method === 'POST') {
      const body = await request.json();
      const { 
        cust_id, 
        address_id,
        name, 
        mobile,
        address_line1,
        address_line2,
        landmark,
        city,
        state,
        pincode,
        address_type,
        is_default,
        latitude,
        longitude
      } = body;

      if (!cust_id) {
        return new Response(
          JSON.stringify({ success: false, error: 'Customer ID is required' }),
          { status: 400, headers: { 'Content-Type': 'application/json', ...corsHeaders } }
        );
      }

      if (!address_line1 || !city || !state || !pincode) {
        return new Response(
          JSON.stringify({ success: false, error: 'Address line, city, state and pincode are required' }),
          { status: 400, headers: { 'Content-Type': 'application/json', ...corsHeaders } }
        );
      }

      // If this is set as default, remove default from other addresses
      if (is_default) {
        await fetch(`${supabaseUrl}/rest/v1/addresses?cust_id=eq.${cust_id}`, {
          method: 'PATCH',
          headers: {
            'apikey': supabaseKey,
            'Authorization': `Bearer ${supabaseKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ is_default: false })
        });
      }

      const addressData = {
        cust_id,
        name: name || null,
        mobile: mobile || null,
        address_line1,
        address_line2: address_line2 || null,
        landmark: landmark || null,
        city,
        state,
        pincode,
        address_type: address_type || 'home',
        is_default: is_default || false,
        latitude: latitude || null,
        longitude: longitude || null,
        updated_at: new Date().toISOString()
      };

      let result;
      let message;

      if (address_id) {
        // Update existing address
        const updateResult = await supabase
          .from('addresses')
          .update(addressData)
          .eq('address_id', address_id)
          .eq('cust_id', cust_id)
          .select();

        if (updateResult.error) throw updateResult.error;
        result = updateResult.data;
        message = 'Address updated successfully';
      } else {
        // Add new address
        addressData.created_at = new Date().toISOString();
        const insertResult = await supabase
          .from('addresses')
          .insert(addressData)
          .select();

        if (insertResult.error) throw insertResult.error;
        result = insertResult.data;
        message = 'Address added successfully';
      }

      // Get all addresses
      const allAddressesUrl = `${supabaseUrl}/rest/v1/addresses?cust_id=eq.${cust_id}&order=is_default.desc&select=*`;
      const allAddressesResponse = await fetch(allAddressesUrl, {
        headers: {
          'apikey': supabaseKey,
          'Authorization': `Bearer ${supabaseKey}`,
        },
      });
      const allAddresses = await allAddressesResponse.json();

      return new Response(
        JSON.stringify({
          success: true,
          message: message,
          address: result,
          addresses: allAddresses || []
        }),
        { status: 200, headers: { 'Content-Type': 'application/json', ...corsHeaders } }
      );
    }

    // =====================================================
    // DELETE ADDRESS (DELETE)
    // =====================================================
    if (request.method === 'DELETE') {
      const url = new URL(request.url);
      const cust_id = url.searchParams.get('cust_id');
      const address_id = url.searchParams.get('address_id');

      if (!cust_id || !address_id) {
        return new Response(
          JSON.stringify({ success: false, error: 'Customer ID and Address ID are required' }),
          { status: 400, headers: { 'Content-Type': 'application/json', ...corsHeaders } }
        );
      }

      // Check if address exists and belongs to user
      const addressCheckUrl = `${supabaseUrl}/rest/v1/addresses?address_id=eq.${address_id}&cust_id=eq.${cust_id}&select=address_id,is_default`;
      const addressCheckResponse = await fetch(addressCheckUrl, {
        headers: {
          'apikey': supabaseKey,
          'Authorization': `Bearer ${supabaseKey}`,
        },
      });
      const addressCheckData = await addressCheckResponse.json();
      const address = addressCheckData[0];

      if (!address) {
        return new Response(
          JSON.stringify({ success: false, error: 'Address not found' }),
          { status: 404, headers: { 'Content-Type': 'application/json', ...corsHeaders } }
        );
      }

      // Delete address
      await fetch(`${supabaseUrl}/rest/v1/addresses?address_id=eq.${address_id}`, {
        method: 'DELETE',
        headers: {
          'apikey': supabaseKey,
          'Authorization': `Bearer ${supabaseKey}`,
        },
      });

      // If deleted address was default, set another as default
      if (address.is_default) {
        const anotherAddressUrl = `${supabaseUrl}/rest/v1/addresses?cust_id=eq.${cust_id}&select=address_id&limit=1`;
        const anotherAddressResponse = await fetch(anotherAddressUrl, {
          headers: {
            'apikey': supabaseKey,
            'Authorization': `Bearer ${supabaseKey}`,
          },
        });
        const anotherAddressData = await anotherAddressResponse.json();
        const anotherAddress = anotherAddressData[0];

        if (anotherAddress) {
          await fetch(`${supabaseUrl}/rest/v1/addresses?address_id=eq.${anotherAddress.address_id}`, {
            method: 'PATCH',
            headers: {
              'apikey': supabaseKey,
              'Authorization': `Bearer ${supabaseKey}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({ is_default: true })
          });
        }
      }

      return new Response(
        JSON.stringify({ success: true, message: 'Address deleted successfully' }),
        { status: 200, headers: { 'Content-Type': 'application/json', ...corsHeaders } }
      );
    }

    return new Response(
      JSON.stringify({ success: false, error: 'Method not allowed' }),
      { status: 405, headers: { 'Content-Type': 'application/json', ...corsHeaders } }
    );

  } catch (error) {
    console.error('Profile error:', error);
    return new Response(
      JSON.stringify({ success: false, error: error.message || 'Internal server error' }),
      { status: 500, headers: { 'Content-Type': 'application/json', ...corsHeaders } }
    );
  }
}