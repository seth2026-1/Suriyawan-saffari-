// api/seller/settings.js
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
            gte: (gteField, gteValue) => ({
              order: (orderField, { ascending }) => ({
                select: async () => {
                  const sortOrder = ascending ? 'asc' : 'desc';
                  const finalUrl = `${url}&${field}=eq.${value}&${gteField}=gte.${gteValue}&order=${orderField}.${sortOrder}`;
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

export default async function handler(request) {
  // CORS Headers
  const corsHeaders = {
    'Access-Control-Allow-Credentials': 'true',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, PUT, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version, Authorization',
  };

  // Handle OPTIONS preflight
  if (request.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: corsHeaders });
  }

  const url = new URL(request.url);

  // =====================================================
  // GET SELLER SETTINGS
  // =====================================================
  if (request.method === 'GET') {
    try {
      const seller_id = url.searchParams.get('seller_id');

      if (!seller_id) {
        return new Response(JSON.stringify({ success: false, error: 'Seller ID is required' }), {
          status: 400,
          headers: { 'Content-Type': 'application/json', ...corsHeaders }
        });
      }

      const supabase = createSupabaseClient();
      const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
      const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

      // Get seller profile
      const sellerResult = await supabase
        .from('sellers')
        .select('*')
        .eq('seller_id', seller_id)
        .single();

      if (sellerResult.error || !sellerResult.data) {
        return new Response(JSON.stringify({ success: false, error: 'Seller not found' }), {
          status: 404,
          headers: { 'Content-Type': 'application/json', ...corsHeaders }
        });
      }

      const seller = sellerResult.data;

      // Get bank details
      const bankUrl = `${supabaseUrl}/rest/v1/seller_bank_details?seller_id=eq.${seller_id}&select=*`;
      const bankResponse = await fetch(bankUrl, {
        headers: {
          'apikey': supabaseKey,
          'Authorization': `Bearer ${supabaseKey}`,
        },
      });
      const bankData = await bankResponse.json();
      const bankDetails = bankData[0] || null;

      // Get KYC documents
      const kycUrl = `${supabaseUrl}/rest/v1/seller_kyc?seller_id=eq.${seller_id}&select=*`;
      const kycResponse = await fetch(kycUrl, {
        headers: {
          'apikey': supabaseKey,
          'Authorization': `Bearer ${supabaseKey}`,
        },
      });
      const kycData = await kycResponse.json();
      const kycDocuments = kycData[0] || null;

      // Get pickup addresses
      const addressesUrl = `${supabaseUrl}/rest/v1/seller_pickup_addresses?seller_id=eq.${seller_id}&order=is_default.desc&select=*`;
      const addressesResponse = await fetch(addressesUrl, {
        headers: {
          'apikey': supabaseKey,
          'Authorization': `Bearer ${supabaseKey}`,
        },
      });
      const pickupAddresses = await addressesResponse.json();

      // Get staff members
      const staffUrl = `${supabaseUrl}/rest/v1/seller_staff?seller_id=eq.${seller_id}&is_active=eq.true&select=*`;
      const staffResponse = await fetch(staffUrl, {
        headers: {
          'apikey': supabaseKey,
          'Authorization': `Bearer ${supabaseKey}`,
        },
      });
      const staffMembers = await staffResponse.json();

      // Get notification preferences
      const notifUrl = `${supabaseUrl}/rest/v1/seller_notification_preferences?seller_id=eq.${seller_id}&select=*`;
      const notifResponse = await fetch(notifUrl, {
        headers: {
          'apikey': supabaseKey,
          'Authorization': `Bearer ${supabaseKey}`,
        },
      });
      const notifData = await notifResponse.json();
      const notificationPrefs = notifData[0] || null;

      // Get holidays
      const todayStr = new Date().toISOString().split('T')[0];
      const holidaysUrl = `${supabaseUrl}/rest/v1/seller_holidays?seller_id=eq.${seller_id}&holiday_date=gte.${todayStr}&order=holiday_date.asc&select=*`;
      const holidaysResponse = await fetch(holidaysUrl, {
        headers: {
          'apikey': supabaseKey,
          'Authorization': `Bearer ${supabaseKey}`,
        },
      });
      const holidays = await holidaysResponse.json();

      // Get API keys
      const apiKeysUrl = `${supabaseUrl}/rest/v1/seller_api_keys?seller_id=eq.${seller_id}&is_active=eq.true&select=api_key,name,permissions,created_at,last_used_at`;
      const apiKeysResponse = await fetch(apiKeysUrl, {
        headers: {
          'apikey': supabaseKey,
          'Authorization': `Bearer ${supabaseKey}`,
        },
      });
      const apiKeys = await apiKeysResponse.json();

      return new Response(JSON.stringify({
        success: true,
        profile: {
          seller_id: seller.seller_id,
          email: seller.email,
          mobile: seller.mobile,
          shop_name: seller.shop_name,
          owner_name: seller.owner_name,
          upi_id: seller.upi_id,
          gst_number: seller.gst_number,
          pan_number: seller.pan_number,
          kyc_status: seller.kyc_status,
          commission_rate: seller.commission_rate,
          is_active: seller.is_active,
          created_at: seller.created_at
        },
        bank_details: bankDetails,
        kyc_documents: kycDocuments,
        pickup_addresses: pickupAddresses || [],
        staff_members: staffMembers || [],
        notification_preferences: notificationPrefs || {
          email_orders: true,
          email_payouts: true,
          email_promotions: false,
          sms_orders: true,
          sms_otp: true,
          push_notifications: true
        },
        holidays: holidays || [],
        api_keys: apiKeys || [],
        settings: {
          auto_accept_orders: seller.auto_accept_orders || false,
          auto_accept_delay_minutes: seller.auto_accept_delay_minutes || 120,
          low_stock_alert_threshold: seller.low_stock_alert_threshold || 5,
          default_delivery_charge: seller.default_delivery_charge || 40,
          free_delivery_min_amount: seller.free_delivery_min_amount || 499,
          return_window_days: seller.return_window_days || 7,
          allow_cod: seller.allow_cod !== false,
          allow_prepaid: seller.allow_prepaid !== false
        }
      }), {
        status: 200,
        headers: { 'Content-Type': 'application/json', ...corsHeaders }
      });

    } catch (error) {
      console.error('Get settings error:', error);
      return new Response(JSON.stringify({ success: false, error: error.message }), {
        status: 500,
        headers: { 'Content-Type': 'application/json', ...corsHeaders }
      });
    }
  }

  // =====================================================
  // UPDATE SELLER PROFILE (PUT)
  // =====================================================
  if (request.method === 'PUT') {
    try {
      const body = await request.json();
      const {
        seller_id,
        shop_name,
        owner_name,
        mobile,
        email,
        upi_id,
        gst_number,
        pan_number,
        auto_accept_orders,
        auto_accept_delay_minutes,
        low_stock_alert_threshold,
        default_delivery_charge,
        free_delivery_min_amount,
        allow_cod,
        allow_prepaid
      } = body;

      if (!seller_id) {
        return new Response(JSON.stringify({ success: false, error: 'Seller ID is required' }), {
          status: 400,
          headers: { 'Content-Type': 'application/json', ...corsHeaders }
        });
      }

      const supabase = createSupabaseClient();

      // Build update object
      const updateData = {};
      if (shop_name !== undefined) updateData.shop_name = shop_name;
      if (owner_name !== undefined) updateData.owner_name = owner_name;
      if (mobile !== undefined) updateData.mobile = mobile;
      if (email !== undefined) updateData.email = email;
      if (upi_id !== undefined) updateData.upi_id = upi_id;
      if (gst_number !== undefined) updateData.gst_number = gst_number;
      if (pan_number !== undefined) updateData.pan_number = pan_number;
      if (auto_accept_orders !== undefined) updateData.auto_accept_orders = auto_accept_orders;
      if (auto_accept_delay_minutes !== undefined) updateData.auto_accept_delay_minutes = auto_accept_delay_minutes;
      if (low_stock_alert_threshold !== undefined) updateData.low_stock_alert_threshold = low_stock_alert_threshold;
      if (default_delivery_charge !== undefined) updateData.default_delivery_charge = default_delivery_charge;
      if (free_delivery_min_amount !== undefined) updateData.free_delivery_min_amount = free_delivery_min_amount;
      if (allow_cod !== undefined) updateData.allow_cod = allow_cod;
      if (allow_prepaid !== undefined) updateData.allow_prepaid = allow_prepaid;

      updateData.updated_at = new Date().toISOString();

      // Check if email already exists for another seller
      if (email) {
        const existingResult = await supabase
          .from('sellers')
          .select('seller_id')
          .eq('email', email)
          .neq('seller_id', seller_id)
          .maybeSingle();

        if (existingResult.data) {
          return new Response(JSON.stringify({ success: false, error: 'Email already registered by another seller' }), {
            status: 400,
            headers: { 'Content-Type': 'application/json', ...corsHeaders }
          });
        }
      }

      const updateResult = await supabase
        .from('sellers')
        .update(updateData)
        .eq('seller_id', seller_id)
        .select();

      if (updateResult.error) {
        console.error('Profile update error:', updateResult.error);
        return new Response(JSON.stringify({ success: false, error: updateResult.error.message }), {
          status: 500,
          headers: { 'Content-Type': 'application/json', ...corsHeaders }
        });
      }

      const updatedSeller = updateResult.data;

      return new Response(JSON.stringify({
        success: true,
        message: 'Profile updated successfully',
        profile: {
          seller_id: updatedSeller.seller_id,
          shop_name: updatedSeller.shop_name,
          owner_name: updatedSeller.owner_name,
          email: updatedSeller.email,
          mobile: updatedSeller.mobile,
          upi_id: updatedSeller.upi_id,
          gst_number: updatedSeller.gst_number,
          updated_at: updatedSeller.updated_at
        }
      }), {
        status: 200,
        headers: { 'Content-Type': 'application/json', ...corsHeaders }
      });

    } catch (error) {
      console.error('Update profile error:', error);
      return new Response(JSON.stringify({ success: false, error: error.message }), {
        status: 500,
        headers: { 'Content-Type': 'application/json', ...corsHeaders }
      });
    }
  }

  // =====================================================
  // UPDATE BANK DETAILS (POST with type=bank)
  // =====================================================
  if (request.method === 'POST') {
    try {
      const body = await request.json();
      const { type } = body;

      // UPDATE BANK DETAILS
      if (type === 'bank') {
        const {
          seller_id,
          account_holder_name,
          account_number,
          ifsc_code,
          bank_name,
          branch_name,
          upi_id
        } = body;

        if (!seller_id) {
          return new Response(JSON.stringify({ success: false, error: 'Seller ID is required' }), {
            status: 400,
            headers: { 'Content-Type': 'application/json', ...corsHeaders }
          });
        }

        const supabase = createSupabaseClient();
        const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
        const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

        const bankData = {
          seller_id,
          account_holder_name,
          account_number,
          ifsc_code,
          bank_name,
          branch_name: branch_name || null,
          upi_id: upi_id || null,
          is_verified: false,
          updated_at: new Date().toISOString()
        };

        // Check if bank details exist
        const existingBankUrl = `${supabaseUrl}/rest/v1/seller_bank_details?seller_id=eq.${seller_id}&select=bank_id`;
        const existingBankResponse = await fetch(existingBankUrl, {
          headers: {
            'apikey': supabaseKey,
            'Authorization': `Bearer ${supabaseKey}`,
          },
        });
        const existingBankData = await existingBankResponse.json();
        const existingBank = existingBankData[0];

        let result;
        if (existingBank) {
          const updateResult = await supabase
            .from('seller_bank_details')
            .update(bankData)
            .eq('seller_id', seller_id)
            .select();

          if (updateResult.error) throw updateResult.error;
          result = updateResult.data;
        } else {
          bankData.created_at = new Date().toISOString();
          const insertResult = await supabase
            .from('seller_bank_details')
            .insert(bankData)
            .select();

          if (insertResult.error) throw insertResult.error;
          result = insertResult.data;
        }

        return new Response(JSON.stringify({
          success: true,
          message: 'Bank details updated successfully',
          bank_details: result
        }), {
          status: 200,
          headers: { 'Content-Type': 'application/json', ...corsHeaders }
        });
      }

      // ADD PICKUP ADDRESS
      if (type === 'address') {
        const {
          seller_id,
          address_line1,
          address_line2,
          city,
          state,
          pincode,
          landmark,
          contact_name,
          contact_mobile,
          is_default
        } = body;

        if (!seller_id || !address_line1 || !city || !state || !pincode) {
          return new Response(JSON.stringify({
            success: false,
            error: 'Seller ID, address line, city, state and pincode are required'
          }), {
            status: 400,
            headers: { 'Content-Type': 'application/json', ...corsHeaders }
          });
        }

        const supabase = createSupabaseClient();
        const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
        const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

        if (is_default) {
          await fetch(`${supabaseUrl}/rest/v1/seller_pickup_addresses?seller_id=eq.${seller_id}`, {
            method: 'PATCH',
            headers: {
              'apikey': supabaseKey,
              'Authorization': `Bearer ${supabaseKey}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({ is_default: false })
          });
        }

        const addressInsert = await supabase
          .from('seller_pickup_addresses')
          .insert({
            seller_id,
            address_line1,
            address_line2: address_line2 || null,
            city,
            state,
            pincode,
            landmark: landmark || null,
            contact_name: contact_name || null,
            contact_mobile: contact_mobile || null,
            is_default: is_default || false,
            is_active: true,
            created_at: new Date().toISOString()
          })
          .select();

        if (addressInsert.error) {
          console.error('Address insert error:', addressInsert.error);
          return new Response(JSON.stringify({ success: false, error: addressInsert.error.message }), {
            status: 500,
            headers: { 'Content-Type': 'application/json', ...corsHeaders }
          });
        }

        return new Response(JSON.stringify({
          success: true,
          message: 'Pickup address added successfully',
          address: addressInsert.data
        }), {
          status: 200,
          headers: { 'Content-Type': 'application/json', ...corsHeaders }
        });
      }

      // UPDATE NOTIFICATION PREFERENCES
      if (type === 'notifications') {
        const { seller_id, preferences } = body;

        if (!seller_id || !preferences) {
          return new Response(JSON.stringify({ success: false, error: 'Seller ID and preferences are required' }), {
            status: 400,
            headers: { 'Content-Type': 'application/json', ...corsHeaders }
          });
        }

        const supabase = createSupabaseClient();
        const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
        const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

        // Check if preferences exist
        const existingPrefsUrl = `${supabaseUrl}/rest/v1/seller_notification_preferences?seller_id=eq.${seller_id}&select=pref_id`;
        const existingPrefsResponse = await fetch(existingPrefsUrl, {
          headers: {
            'apikey': supabaseKey,
            'Authorization': `Bearer ${supabaseKey}`,
          },
        });
        const existingPrefsData = await existingPrefsResponse.json();
        const existingPrefs = existingPrefsData[0];

        let result;
        if (existingPrefs) {
          const updateResult = await supabase
            .from('seller_notification_preferences')
            .update({
              ...preferences,
              updated_at: new Date().toISOString()
            })
            .eq('seller_id', seller_id)
            .select();

          if (updateResult.error) throw updateResult.error;
          result = updateResult.data;
        } else {
          const insertResult = await supabase
            .from('seller_notification_preferences')
            .insert({
              seller_id,
              ...preferences,
              created_at: new Date().toISOString()
            })
            .select();

          if (insertResult.error) throw insertResult.error;
          result = insertResult.data;
        }

        return new Response(JSON.stringify({
          success: true,
          message: 'Notification preferences updated',
          preferences: result
        }), {
          status: 200,
          headers: { 'Content-Type': 'application/json', ...corsHeaders }
        });
      }

      // GENERATE API KEY
      if (type === 'api_key') {
        const { seller_id, name, permissions } = body;

        if (!seller_id || !name) {
          return new Response(JSON.stringify({ success: false, error: 'Seller ID and API key name are required' }), {
            status: 400,
            headers: { 'Content-Type': 'application/json', ...corsHeaders }
          });
        }

        const supabase = createSupabaseClient();
        const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
        const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

        const apiKey = `sk_${seller_id}_${Date.now()}_${Math.random().toString(36).substring(2, 15)}`;

        const insertResult = await supabase
          .from('seller_api_keys')
          .insert({
            seller_id,
            api_key: apiKey,
            name,
            permissions: permissions || ['read_orders', 'read_products'],
            is_active: true,
            created_at: new Date().toISOString()
          })
          .select();

        if (insertResult.error) {
          console.error('API key generation error:', insertResult.error);
          return new Response(JSON.stringify({ success: false, error: insertResult.error.message }), {
            status: 500,
            headers: { 'Content-Type': 'application/json', ...corsHeaders }
          });
        }

        const apiKeyInfo = insertResult.data;

        return new Response(JSON.stringify({
          success: true,
          message: 'API key generated successfully. Store it securely.',
          api_key: apiKey,
          api_key_info: {
            api_id: apiKeyInfo.api_id,
            name: apiKeyInfo.name,
            permissions: apiKeyInfo.permissions,
            created_at: apiKeyInfo.created_at
          },
          warning: 'This API key will not be shown again. Please store it securely.'
        }), {
          status: 200,
          headers: { 'Content-Type': 'application/json', ...corsHeaders }
        });
      }

      return new Response(JSON.stringify({ success: false, error: 'Invalid type parameter' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json', ...corsHeaders }
      });

    } catch (error) {
      console.error('Settings POST error:', error);
      return new Response(JSON.stringify({ success: false, error: error.message }), {
        status: 500,
        headers: { 'Content-Type': 'application/json', ...corsHeaders }
      });
    }
  }

  return new Response(JSON.stringify({ success: false, error: 'Method not allowed' }), {
    status: 405,
    headers: { 'Content-Type': 'application/json', ...corsHeaders }
  });
}