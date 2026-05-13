// api/owner/users/block-user.js
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
      select: (columns, options = {}) => {
        let url = `${supabaseUrl}/rest/v1/${table}`;
        if (columns && columns !== '*') {
          url += `?select=${columns}`;
        }

        const execute = async (queryModifiers = {}) => {
          let finalUrl = url;

          if (queryModifiers.eq) {
            const [field, value] = Object.entries(queryModifiers.eq)[0];
            finalUrl += `${finalUrl.includes('?') ? '&' : '?'}${field}=eq.${value}`;
          }

          if (queryModifiers.order) {
            finalUrl += `${finalUrl.includes('?') ? '&' : '?'}order=${queryModifiers.order.field}.${queryModifiers.order.ascending ? 'asc' : 'desc'}`;
          }

          if (queryModifiers.range) {
            finalUrl += `${finalUrl.includes('?') ? '&' : '?'}offset=${queryModifiers.range.from}&limit=${queryModifiers.range.to - queryModifiers.range.from + 1}`;
          }

          if (options.count === 'exact') {
            const response = await fetch(finalUrl, {
              method: 'HEAD',
              headers: {
                'apikey': supabaseKey,
                'Authorization': `Bearer ${supabaseKey}`,
              },
            });
            const count = response.headers.get('content-range')?.split('/')[1];
            return { count: count ? parseInt(count) : 0, error: null };
          }

          const response = await fetch(finalUrl, {
            headers: {
              'apikey': supabaseKey,
              'Authorization': `Bearer ${supabaseKey}`,
            },
          });
          const data = await response.json();
          const count = response.headers.get('content-range')?.split('/')[1];
          return { data, error: null, count: count ? parseInt(count) : null };
        };

        return {
          eq: (field, value) => ({
            single: async () => {
              const result = await execute({ eq: { [field]: value } });
              return { data: result.data[0] || null, error: null };
            },
            range: async (from, to) => {
              const result = await execute({
                eq: { [field]: value },
                range: { from, to }
              });
              return result;
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
            return { data: result[0] || result, error: null };
          }
        })
      }),
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
    })
  };
}

export default async function handler(request) {
  // CORS Headers
  const corsHeaders = {
    'Access-Control-Allow-Credentials': 'true',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'POST, GET, OPTIONS',
    'Access-Control-Allow-Headers': 'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version, Authorization',
  };

  // Handle OPTIONS preflight
  if (request.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: corsHeaders });
  }

  const url = new URL(request.url);
  const supabase = createSupabaseClient();
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  // =====================================================
  // GET BLOCKED USERS LIST
  // =====================================================
  if (request.method === 'GET') {
    try {
      const user_type = url.searchParams.get('user_type');
      const page = parseInt(url.searchParams.get('page') || '1');
      const limit = parseInt(url.searchParams.get('limit') || '20');

      let results = {};
      let totalCount = 0;

      if (!user_type || user_type === 'customer') {
        const customersUrl = `${supabaseUrl}/rest/v1/customers?select=cust_id,name,email,mobile,is_active,cod_status,cod_block_reason,cod_block_until,created_at&is_active=eq.false&offset=${(page - 1) * limit}&limit=${limit}`;
        const customersResponse = await fetch(customersUrl, {
          headers: {
            'apikey': supabaseKey,
            'Authorization': `Bearer ${supabaseKey}`,
          },
        });
        const customers = await customersResponse.json();
        const customersCount = parseInt(customersResponse.headers.get('content-range')?.split('/')[1] || '0');

        if (customers) {
          results.customers = customers;
          totalCount += customersCount;
        }
      }

      if (!user_type || user_type === 'seller') {
        const sellersUrl = `${supabaseUrl}/rest/v1/sellers?select=seller_id,shop_name,owner_name,email,mobile,is_active,kyc_status,created_at&is_active=eq.false&offset=${(page - 1) * limit}&limit=${limit}`;
        const sellersResponse = await fetch(sellersUrl, {
          headers: {
            'apikey': supabaseKey,
            'Authorization': `Bearer ${supabaseKey}`,
          },
        });
        const sellers = await sellersResponse.json();
        const sellersCount = parseInt(sellersResponse.headers.get('content-range')?.split('/')[1] || '0');

        if (sellers) {
          results.sellers = sellers;
          totalCount += sellersCount;
        }
      }

      if (!user_type || user_type === 'rider') {
        const ridersUrl = `${supabaseUrl}/rest/v1/riders?select=rider_id,name,email,mobile,is_active,rating,created_at&is_active=eq.false&offset=${(page - 1) * limit}&limit=${limit}`;
        const ridersResponse = await fetch(ridersUrl, {
          headers: {
            'apikey': supabaseKey,
            'Authorization': `Bearer ${supabaseKey}`,
          },
        });
        const riders = await ridersResponse.json();
        const ridersCount = parseInt(ridersResponse.headers.get('content-range')?.split('/')[1] || '0');

        if (riders) {
          results.riders = riders;
          totalCount += ridersCount;
        }
      }

      return new Response(JSON.stringify({
        success: true,
        blocked_users: results,
        total: totalCount,
        pagination: {
          current_page: page,
          total_pages: Math.ceil(totalCount / limit),
          items_per_page: limit
        }
      }), {
        status: 200,
        headers: { 'Content-Type': 'application/json', ...corsHeaders }
      });

    } catch (error) {
      console.error('Get blocked users error:', error);
      return new Response(JSON.stringify({ success: false, error: error.message }), {
        status: 500,
        headers: { 'Content-Type': 'application/json', ...corsHeaders }
      });
    }
  }

  // =====================================================
  // BLOCK/UNBLOCK USER (POST)
  // =====================================================
  if (request.method === 'POST') {
    try {
      const body = await request.json();
      const {
        user_id,
        user_type,
        action,
        reason,
        duration_days,
        block_type
      } = body;

      if (!user_id || !user_type || !action) {
        return new Response(JSON.stringify({
          success: false,
          error: 'User ID, user type and action are required'
        }), {
          status: 400,
          headers: { 'Content-Type': 'application/json', ...corsHeaders }
        });
      }

      if (!['block', 'unblock'].includes(action)) {
        return new Response(JSON.stringify({ success: false, error: 'Invalid action' }), {
          status: 400,
          headers: { 'Content-Type': 'application/json', ...corsHeaders }
        });
      }

      let result;
      let message = '';
      let notificationTitle = '';
      let notificationMessage = '';

      // Process based on user type
      if (user_type === 'customer') {
        if (action === 'block') {
          let blockUntil = null;
          if (duration_days) {
            blockUntil = new Date();
            blockUntil.setDate(blockUntil.getDate() + duration_days);
          }

          const updateData = {
            is_active: block_type !== 'cod_only',
            updated_at: new Date().toISOString()
          };

          if (block_type === 'cod_only' || block_type === 'full') {
            updateData.cod_status = 'BLOCKED';
            updateData.cod_block_reason = reason || 'Blocked by admin';
            updateData.cod_block_until = blockUntil ? blockUntil.toISOString().split('T')[0] : null;
          }

          const updateResult = await supabase
            .from('customers')
            .update(updateData)
            .eq('cust_id', user_id)
            .select();

          if (updateResult.error) throw updateResult.error;
          result = updateResult.data;

          message = block_type === 'cod_only' ? 'Customer COD access blocked' : 'Customer account blocked';
          notificationTitle = block_type === 'cod_only' ? 'COD Access Blocked' : 'Account Blocked';
          notificationMessage = reason || `Your account has been ${block_type === 'cod_only' ? 'COD access blocked' : 'blocked'}. ${duration_days ? `Blocked for ${duration_days} days.` : ''}`;

        } else {
          // Unblock
          const updateData = {
            is_active: true,
            cod_status: 'ACTIVE',
            cod_block_reason: null,
            cod_block_until: null,
            updated_at: new Date().toISOString()
          };

          const updateResult = await supabase
            .from('customers')
            .update(updateData)
            .eq('cust_id', user_id)
            .select();

          if (updateResult.error) throw updateResult.error;
          result = updateResult.data;

          message = 'Customer unblocked successfully';
          notificationTitle = 'Account Unblocked';
          notificationMessage = reason || 'Your account has been unblocked by admin.';
        }

      } else if (user_type === 'seller') {
        if (action === 'block') {
          const updateResult = await supabase
            .from('sellers')
            .update({
              is_active: false,
              updated_at: new Date().toISOString()
            })
            .eq('seller_id', user_id)
            .select();

          if (updateResult.error) throw updateResult.error;
          result = updateResult.data;

          message = 'Seller account blocked';
          notificationTitle = 'Account Blocked';
          notificationMessage = reason || 'Your seller account has been blocked. Please contact support.';

        } else {
          const updateResult = await supabase
            .from('sellers')
            .update({
              is_active: true,
              updated_at: new Date().toISOString()
            })
            .eq('seller_id', user_id)
            .select();

          if (updateResult.error) throw updateResult.error;
          result = updateResult.data;

          message = 'Seller account unblocked';
          notificationTitle = 'Account Unblocked';
          notificationMessage = reason || 'Your seller account has been unblocked by admin.';
        }

      } else if (user_type === 'rider') {
        if (action === 'block') {
          const updateResult = await supabase
            .from('riders')
            .update({
              is_active: false,
              is_online: false,
              updated_at: new Date().toISOString()
            })
            .eq('rider_id', user_id)
            .select();

          if (updateResult.error) throw updateResult.error;
          result = updateResult.data;

          message = 'Rider account blocked';
          notificationTitle = 'Account Blocked';
          notificationMessage = reason || 'Your rider account has been blocked. Please contact support.';

        } else {
          const updateResult = await supabase
            .from('riders')
            .update({
              is_active: true,
              updated_at: new Date().toISOString()
            })
            .eq('rider_id', user_id)
            .select();

          if (updateResult.error) throw updateResult.error;
          result = updateResult.data;

          message = 'Rider account unblocked';
          notificationTitle = 'Account Unblocked';
          notificationMessage = reason || 'Your rider account has been unblocked by admin.';
        }

      } else {
        return new Response(JSON.stringify({ success: false, error: 'Invalid user type' }), {
          status: 400,
          headers: { 'Content-Type': 'application/json', ...corsHeaders }
        });
      }

      // Send notification to user
      await fetch(`${supabaseUrl}/rest/v1/notifications`, {
        method: 'POST',
        headers: {
          'apikey': supabaseKey,
          'Authorization': `Bearer ${supabaseKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          user_id: user_id,
          user_type: user_type,
          title: notificationTitle,
          message: notificationMessage,
          type: 'account',
          data: { action: action, block_type: block_type, reason: reason },
          created_at: new Date().toISOString()
        })
      });

      // Log block action for audit
      await fetch(`${supabaseUrl}/rest/v1/audit_logs`, {
        method: 'POST',
        headers: {
          'apikey': supabaseKey,
          'Authorization': `Bearer ${supabaseKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          table_name: `${user_type}s`,
          record_id: user_id,
          action: action === 'block' ? 'BLOCK' : 'UNBLOCK',
          new_data: { is_active: action !== 'block' },
          changed_by: 'OWN001',
          changed_at: new Date().toISOString(),
          reason: reason
        })
      });

      return new Response(JSON.stringify({
        success: true,
        message: message,
        user: result,
        is_active: action !== 'block'
      }), {
        status: 200,
        headers: { 'Content-Type': 'application/json', ...corsHeaders }
      });

    } catch (error) {
      console.error('Block user error:', error);
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