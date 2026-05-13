// api/owner/users/customers.js
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

          if (queryModifiers.gte) {
            const [field, value] = Object.entries(queryModifiers.gte)[0];
            finalUrl += `${finalUrl.includes('?') ? '&' : '?'}${field}=gte.${value}`;
          }

          if (queryModifiers.lte) {
            const [field, value] = Object.entries(queryModifiers.lte)[0];
            finalUrl += `${finalUrl.includes('?') ? '&' : '?'}${field}=lte.${value}`;
          }

          if (queryModifiers.or) {
            finalUrl += `${finalUrl.includes('?') ? '&' : '?'}or=${queryModifiers.or}`;
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
            gte: (gteField, gteValue) => ({
              lte: (lteField, lteValue) => ({
                order: (orderField, { ascending }) => ({
                  range: async (from, to) => {
                    const result = await execute({
                      eq: { [field]: value },
                      gte: { [gteField]: gteValue },
                      lte: { [lteField]: lteValue },
                      order: { field: orderField, ascending },
                      range: { from, to }
                    });
                    return result;
                  }
                })
              })
            }),
            or: (condition) => ({
              order: (orderField, { ascending }) => ({
                range: async (from, to) => {
                  const result = await execute({
                    eq: { [field]: value },
                    or: condition,
                    order: { field: orderField, ascending },
                    range: { from, to }
                  });
                  return result;
                }
              })
            }),
            order: (orderField, { ascending }) => ({
              range: async (from, to) => {
                const result = await execute({
                  eq: { [field]: value },
                  order: { field: orderField, ascending },
                  range: { from, to }
                });
                return result;
              }
            })
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
    'Access-Control-Allow-Methods': 'GET, PUT, POST, OPTIONS',
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
  // GET CUSTOMERS LIST
  // =====================================================
  if (request.method === 'GET') {
    try {
      const search = url.searchParams.get('search');
      const status = url.searchParams.get('status');
      const trust_score_min = url.searchParams.get('trust_score_min');
      const trust_score_max = url.searchParams.get('trust_score_max');
      const cod_status = url.searchParams.get('cod_status');
      const from_date = url.searchParams.get('from_date');
      const to_date = url.searchParams.get('to_date');
      const sort_by = url.searchParams.get('sort_by') || 'created_at';
      const sort_order = url.searchParams.get('sort_order') || 'desc';
      const page = parseInt(url.searchParams.get('page') || '1');
      const limit = parseInt(url.searchParams.get('limit') || '20');

      const customersSelect = `cust_id,name,email,mobile,photo,trust_score,cod_status,cod_block_reason,cod_block_until,wallet_balance,coins,referral_code,is_active,created_at,updated_at`;
      let customersUrl = `${supabaseUrl}/rest/v1/customers?select=${encodeURIComponent(customersSelect)}`;

      if (search) {
        customersUrl += `&or=(name.ilike.%${search}%,email.ilike.%${search}%,mobile.ilike.%${search}%,cust_id.ilike.%${search}%)`;
      }

      if (status === 'active') {
        customersUrl += `&is_active=eq.true`;
      } else if (status === 'inactive') {
        customersUrl += `&is_active=eq.false`;
      } else if (status === 'cod_blocked') {
        customersUrl += `&cod_status=eq.BLOCKED`;
      }

      if (trust_score_min) {
        customersUrl += `&trust_score=gte.${parseInt(trust_score_min)}`;
      }
      if (trust_score_max) {
        customersUrl += `&trust_score=lte.${parseInt(trust_score_max)}`;
      }

      if (cod_status === 'ACTIVE') {
        customersUrl += `&cod_status=eq.ACTIVE`;
      } else if (cod_status === 'BLOCKED') {
        customersUrl += `&cod_status=eq.BLOCKED`;
      }

      if (from_date) {
        customersUrl += `&created_at=gte.${from_date}`;
      }
      if (to_date) {
        customersUrl += `&created_at=lte.${to_date}`;
      }

      const sortAsc = sort_order === 'asc';
      customersUrl += `&order=${sort_by}.${sortAsc ? 'asc' : 'desc'}`;

      const from = (page - 1) * limit;
      const to = from + limit - 1;
      customersUrl += `&offset=${from}&limit=${limit}`;

      const customersResponse = await fetch(customersUrl, {
        headers: {
          'apikey': supabaseKey,
          'Authorization': `Bearer ${supabaseKey}`,
        },
      });
      const customers = await customersResponse.json();
      const count = parseInt(customersResponse.headers.get('content-range')?.split('/')[1] || '0');

      // Get order statistics for each customer
      const customersWithStats = await Promise.all(customers.map(async (customer) => {
        const ordersUrl = `${supabaseUrl}/rest/v1/orders?select=status,final_amount&cust_id=eq.${customer.cust_id}`;
        const ordersResponse = await fetch(ordersUrl, {
          headers: {
            'apikey': supabaseKey,
            'Authorization': `Bearer ${supabaseKey}`,
          },
        });
        const orders = await ordersResponse.json();

        const totalOrders = orders?.length || 0;
        const totalSpent = orders?.filter(o => o.status === 'DELIVERED').reduce((sum, o) => sum + (o.final_amount || 0), 0) || 0;
        const rtoCount = orders?.filter(o => o.status === 'RTO').length || 0;

        return {
          ...customer,
          order_stats: {
            total_orders: totalOrders,
            total_spent: totalSpent,
            rto_count: rtoCount
          }
        };
      }));

      // Get statistics summary
      const allCustomersUrl = `${supabaseUrl}/rest/v1/customers?select=trust_score,cod_status,is_active,wallet_balance,coins`;
      const allCustomersResponse = await fetch(allCustomersUrl, {
        headers: {
          'apikey': supabaseKey,
          'Authorization': `Bearer ${supabaseKey}`,
        },
      });
      const allCustomers = await allCustomersResponse.json();

      const stats = {
        total: allCustomers?.length || 0,
        active: allCustomers?.filter(c => c.is_active === true).length || 0,
        inactive: allCustomers?.filter(c => c.is_active === false).length || 0,
        cod_active: allCustomers?.filter(c => c.cod_status === 'ACTIVE').length || 0,
        cod_blocked: allCustomers?.filter(c => c.cod_status === 'BLOCKED').length || 0,
        avg_trust_score: allCustomers?.reduce((sum, c) => sum + (c.trust_score || 0), 0) / (allCustomers?.length || 1) || 0,
        total_wallet_balance: allCustomers?.reduce((sum, c) => sum + (c.wallet_balance || 0), 0) || 0,
        total_coins: allCustomers?.reduce((sum, c) => sum + (c.coins || 0), 0) || 0
      };

      return new Response(JSON.stringify({
        success: true,
        customers: customersWithStats,
        stats: stats,
        pagination: {
          current_page: page,
          total_pages: Math.ceil(count / limit),
          total_items: count,
          items_per_page: limit
        }
      }), {
        status: 200,
        headers: { 'Content-Type': 'application/json', ...corsHeaders }
      });

    } catch (error) {
      console.error('Get customers error:', error);
      return new Response(JSON.stringify({ success: false, error: error.message }), {
        status: 500,
        headers: { 'Content-Type': 'application/json', ...corsHeaders }
      });
    }
  }

  // =====================================================
  // UPDATE CUSTOMER (PUT)
  // =====================================================
  if (request.method === 'PUT') {
    try {
      const body = await request.json();
      const {
        cust_id,
        name,
        email,
        mobile,
        trust_score,
        cod_status,
        cod_block_reason,
        cod_block_until,
        is_active,
        wallet_balance,
        coins
      } = body;

      if (!cust_id) {
        return new Response(JSON.stringify({ success: false, error: 'Customer ID is required' }), {
          status: 400,
          headers: { 'Content-Type': 'application/json', ...corsHeaders }
        });
      }

      const updateData = {};
      if (name !== undefined) updateData.name = name;
      if (email !== undefined) updateData.email = email;
      if (mobile !== undefined) updateData.mobile = mobile;
      if (trust_score !== undefined) updateData.trust_score = trust_score;
      if (cod_status !== undefined) updateData.cod_status = cod_status;
      if (cod_block_reason !== undefined) updateData.cod_block_reason = cod_block_reason;
      if (cod_block_until !== undefined) updateData.cod_block_until = cod_block_until;
      if (is_active !== undefined) updateData.is_active = is_active;
      if (wallet_balance !== undefined) updateData.wallet_balance = wallet_balance;
      if (coins !== undefined) updateData.coins = coins;

      updateData.updated_at = new Date().toISOString();

      const updateResult = await supabase
        .from('customers')
        .update(updateData)
        .eq('cust_id', cust_id)
        .select();

      if (updateResult.error) {
        console.error('Customer update error:', updateResult.error);
        return new Response(JSON.stringify({ success: false, error: updateResult.error.message }), {
          status: 500,
          headers: { 'Content-Type': 'application/json', ...corsHeaders }
        });
      }

      const updatedCustomer = updateResult.data;

      // If COD status changed to BLOCKED, send notification
      if (cod_status === 'BLOCKED') {
        await fetch(`${supabaseUrl}/rest/v1/notifications`, {
          method: 'POST',
          headers: {
            'apikey': supabaseKey,
            'Authorization': `Bearer ${supabaseKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            user_id: cust_id,
            user_type: 'customer',
            title: 'COD Access Blocked',
            message: cod_block_reason || 'Your COD access has been blocked due to policy violation.',
            type: 'account',
            data: { cod_status: 'BLOCKED', block_until: cod_block_until },
            created_at: new Date().toISOString()
          })
        });
      }

      return new Response(JSON.stringify({
        success: true,
        message: 'Customer updated successfully',
        customer: updatedCustomer
      }), {
        status: 200,
        headers: { 'Content-Type': 'application/json', ...corsHeaders }
      });

    } catch (error) {
      console.error('Update customer error:', error);
      return new Response(JSON.stringify({ success: false, error: error.message }), {
        status: 500,
        headers: { 'Content-Type': 'application/json', ...corsHeaders }
      });
    }
  }

  // =====================================================
  // BLOCK/UNBLOCK CUSTOMER (POST)
  // =====================================================
  if (request.method === 'POST') {
    try {
      const body = await request.json();
      const { cust_id, action, reason, duration_days } = body;

      if (!cust_id || !action) {
        return new Response(JSON.stringify({
          success: false,
          error: 'Customer ID and action are required'
        }), {
          status: 400,
          headers: { 'Content-Type': 'application/json', ...corsHeaders }
        });
      }

      let updateData = {};
      let message = '';

      if (action === 'block_cod') {
        const blockUntil = new Date();
        blockUntil.setDate(blockUntil.getDate() + (duration_days || 30));

        updateData = {
          cod_status: 'BLOCKED',
          cod_block_reason: reason || 'Blocked by owner',
          cod_block_until: blockUntil.toISOString().split('T')[0],
          updated_at: new Date().toISOString()
        };
        message = 'Customer COD access blocked successfully';
      }
      else if (action === 'unblock_cod') {
        updateData = {
          cod_status: 'ACTIVE',
          cod_block_reason: null,
          cod_block_until: null,
          updated_at: new Date().toISOString()
        };
        message = 'Customer COD access unblocked successfully';
      }
      else if (action === 'deactivate') {
        updateData = {
          is_active: false,
          updated_at: new Date().toISOString()
        };
        message = 'Customer account deactivated successfully';
      }
      else if (action === 'activate') {
        updateData = {
          is_active: true,
          updated_at: new Date().toISOString()
        };
        message = 'Customer account activated successfully';
      }
      else {
        return new Response(JSON.stringify({ success: false, error: 'Invalid action' }), {
          status: 400,
          headers: { 'Content-Type': 'application/json', ...corsHeaders }
        });
      }

      const updateResult = await supabase
        .from('customers')
        .update(updateData)
        .eq('cust_id', cust_id)
        .select();

      if (updateResult.error) {
        console.error('Customer action error:', updateResult.error);
        return new Response(JSON.stringify({ success: false, error: updateResult.error.message }), {
          status: 500,
          headers: { 'Content-Type': 'application/json', ...corsHeaders }
        });
      }

      const updatedCustomer = updateResult.data;

      // Send notification to customer
      await fetch(`${supabaseUrl}/rest/v1/notifications`, {
        method: 'POST',
        headers: {
          'apikey': supabaseKey,
          'Authorization': `Bearer ${supabaseKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          user_id: cust_id,
          user_type: 'customer',
          title: action === 'block_cod' ? 'COD Access Blocked' :
                 (action === 'unblock_cod' ? 'COD Access Restored' :
                  (action === 'deactivate' ? 'Account Deactivated' : 'Account Activated')),
          message: reason || `Your account has been ${action === 'block_cod' ? 'blocked' : action} by admin.`,
          type: 'account',
          data: { action: action },
          created_at: new Date().toISOString()
        })
      });

      return new Response(JSON.stringify({
        success: true,
        message: message,
        customer: updatedCustomer
      }), {
        status: 200,
        headers: { 'Content-Type': 'application/json', ...corsHeaders }
      });

    } catch (error) {
      console.error('Customer action error:', error);
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