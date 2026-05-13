// api/owner/users/sellers.js
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
  // GET SELLERS LIST
  // =====================================================
  if (request.method === 'GET') {
    try {
      const search = url.searchParams.get('search');
      const kyc_status = url.searchParams.get('kyc_status');
      const status = url.searchParams.get('status');
      const commission_min = url.searchParams.get('commission_min');
      const commission_max = url.searchParams.get('commission_max');
      const rating_min = url.searchParams.get('rating_min');
      const from_date = url.searchParams.get('from_date');
      const to_date = url.searchParams.get('to_date');
      const sort_by = url.searchParams.get('sort_by') || 'created_at';
      const sort_order = url.searchParams.get('sort_order') || 'desc';
      const page = parseInt(url.searchParams.get('page') || '1');
      const limit = parseInt(url.searchParams.get('limit') || '20');

      const sellersSelect = `seller_id,email,mobile,shop_name,owner_name,upi_id,gst_number,pan_number,kyc_status,commission_rate,trust_score,rating,total_sales,wallet_balance,is_active,created_at,updated_at`;
      let sellersUrl = `${supabaseUrl}/rest/v1/sellers?select=${encodeURIComponent(sellersSelect)}`;

      if (search) {
        sellersUrl += `&or=(shop_name.ilike.%${search}%,owner_name.ilike.%${search}%,email.ilike.%${search}%,mobile.ilike.%${search}%,seller_id.ilike.%${search}%)`;
      }

      if (kyc_status && kyc_status !== 'all') {
        sellersUrl += `&kyc_status=eq.${kyc_status.toUpperCase()}`;
      }

      if (status === 'active') {
        sellersUrl += `&is_active=eq.true`;
      } else if (status === 'inactive') {
        sellersUrl += `&is_active=eq.false`;
      }

      if (commission_min) {
        sellersUrl += `&commission_rate=gte.${parseInt(commission_min)}`;
      }
      if (commission_max) {
        sellersUrl += `&commission_rate=lte.${parseInt(commission_max)}`;
      }

      if (rating_min) {
        sellersUrl += `&rating=gte.${parseFloat(rating_min)}`;
      }

      if (from_date) {
        sellersUrl += `&created_at=gte.${from_date}`;
      }
      if (to_date) {
        sellersUrl += `&created_at=lte.${to_date}`;
      }

      const sortAsc = sort_order === 'asc';
      sellersUrl += `&order=${sort_by}.${sortAsc ? 'asc' : 'desc'}`;

      const from = (page - 1) * limit;
      const to = from + limit - 1;
      sellersUrl += `&offset=${from}&limit=${limit}`;

      const sellersResponse = await fetch(sellersUrl, {
        headers: {
          'apikey': supabaseKey,
          'Authorization': `Bearer ${supabaseKey}`,
        },
      });
      const sellers = await sellersResponse.json();
      const count = parseInt(sellersResponse.headers.get('content-range')?.split('/')[1] || '0');

      // Get statistics for each seller
      const sellersWithStats = await Promise.all(sellers.map(async (seller) => {
        // Get product stats
        const productsUrl = `${supabaseUrl}/rest/v1/products?select=prod_id,is_active,stock&seller_id=eq.${seller.seller_id}`;
        const productsResponse = await fetch(productsUrl, {
          headers: {
            'apikey': supabaseKey,
            'Authorization': `Bearer ${supabaseKey}`,
          },
        });
        const products = await productsResponse.json();

        // Get order stats
        const ordersUrl = `${supabaseUrl}/rest/v1/orders?select=status,final_amount&seller_id=eq.${seller.seller_id}`;
        const ordersResponse = await fetch(ordersUrl, {
          headers: {
            'apikey': supabaseKey,
            'Authorization': `Bearer ${supabaseKey}`,
          },
        });
        const orders = await ordersResponse.json();

        const totalOrders = orders?.length || 0;
        const totalRevenue = orders?.filter(o => o.status === 'DELIVERED').reduce((sum, o) => sum + (o.final_amount || 0), 0) || 0;
        const rtoCount = orders?.filter(o => o.status === 'RTO').length || 0;

        return {
          ...seller,
          product_stats: {
            total_products: products?.length || 0,
            active_products: products?.filter(p => p.is_active === true).length || 0,
            out_of_stock: products?.filter(p => p.stock === 0).length || 0
          },
          order_stats: {
            total_orders: totalOrders,
            total_revenue: totalRevenue,
            rto_count: rtoCount
          }
        };
      }));

      // Get statistics summary
      const allSellersUrl = `${supabaseUrl}/rest/v1/sellers?select=kyc_status,is_active,commission_rate,rating,wallet_balance`;
      const allSellersResponse = await fetch(allSellersUrl, {
        headers: {
          'apikey': supabaseKey,
          'Authorization': `Bearer ${supabaseKey}`,
        },
      });
      const allSellers = await allSellersResponse.json();

      const stats = {
        total: allSellers?.length || 0,
        active: allSellers?.filter(s => s.is_active === true).length || 0,
        inactive: allSellers?.filter(s => s.is_active === false).length || 0,
        kyc_pending: allSellers?.filter(s => s.kyc_status === 'PENDING').length || 0,
        kyc_approved: allSellers?.filter(s => s.kyc_status === 'APPROVED').length || 0,
        kyc_rejected: allSellers?.filter(s => s.kyc_status === 'REJECTED').length || 0,
        avg_commission: allSellers?.reduce((sum, s) => sum + (s.commission_rate || 0), 0) / (allSellers?.length || 1) || 0,
        avg_rating: allSellers?.reduce((sum, s) => sum + (s.rating || 0), 0) / (allSellers?.length || 1) || 0,
        total_wallet_balance: allSellers?.reduce((sum, s) => sum + (s.wallet_balance || 0), 0) || 0
      };

      return new Response(JSON.stringify({
        success: true,
        sellers: sellersWithStats,
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
      console.error('Get sellers error:', error);
      return new Response(JSON.stringify({ success: false, error: error.message }), {
        status: 500,
        headers: { 'Content-Type': 'application/json', ...corsHeaders }
      });
    }
  }

  // =====================================================
  // UPDATE SELLER (PUT)
  // =====================================================
  if (request.method === 'PUT') {
    try {
      const body = await request.json();
      const {
        seller_id,
        shop_name,
        owner_name,
        email,
        mobile,
        upi_id,
        gst_number,
        pan_number,
        commission_rate,
        is_active,
        wallet_balance
      } = body;

      if (!seller_id) {
        return new Response(JSON.stringify({ success: false, error: 'Seller ID is required' }), {
          status: 400,
          headers: { 'Content-Type': 'application/json', ...corsHeaders }
        });
      }

      const updateData = {};
      if (shop_name !== undefined) updateData.shop_name = shop_name;
      if (owner_name !== undefined) updateData.owner_name = owner_name;
      if (email !== undefined) updateData.email = email;
      if (mobile !== undefined) updateData.mobile = mobile;
      if (upi_id !== undefined) updateData.upi_id = upi_id;
      if (gst_number !== undefined) updateData.gst_number = gst_number;
      if (pan_number !== undefined) updateData.pan_number = pan_number;
      if (commission_rate !== undefined) updateData.commission_rate = commission_rate;
      if (is_active !== undefined) updateData.is_active = is_active;
      if (wallet_balance !== undefined) updateData.wallet_balance = wallet_balance;

      updateData.updated_at = new Date().toISOString();

      const updateResult = await supabase
        .from('sellers')
        .update(updateData)
        .eq('seller_id', seller_id)
        .select();

      if (updateResult.error) {
        console.error('Seller update error:', updateResult.error);
        return new Response(JSON.stringify({ success: false, error: updateResult.error.message }), {
          status: 500,
          headers: { 'Content-Type': 'application/json', ...corsHeaders }
        });
      }

      const updatedSeller = updateResult.data;

      return new Response(JSON.stringify({
        success: true,
        message: 'Seller updated successfully',
        seller: updatedSeller
      }), {
        status: 200,
        headers: { 'Content-Type': 'application/json', ...corsHeaders }
      });

    } catch (error) {
      console.error('Update seller error:', error);
      return new Response(JSON.stringify({ success: false, error: error.message }), {
        status: 500,
        headers: { 'Content-Type': 'application/json', ...corsHeaders }
      });
    }
  }

  // =====================================================
  // APPROVE/REJECT KYC (POST)
  // =====================================================
  if (request.method === 'POST') {
    try {
      const body = await request.json();
      const { seller_id, action, reason } = body;

      if (!seller_id || !action) {
        return new Response(JSON.stringify({
          success: false,
          error: 'Seller ID and action are required'
        }), {
          status: 400,
          headers: { 'Content-Type': 'application/json', ...corsHeaders }
        });
      }

      let kycStatus = '';
      let message = '';

      if (action === 'approve') {
        kycStatus = 'APPROVED';
        message = 'KYC approved successfully';
      } else if (action === 'reject') {
        kycStatus = 'REJECTED';
        message = 'KYC rejected successfully';
      } else {
        return new Response(JSON.stringify({ success: false, error: 'Invalid action' }), {
          status: 400,
          headers: { 'Content-Type': 'application/json', ...corsHeaders }
        });
      }

      const updateResult = await supabase
        .from('sellers')
        .update({
          kyc_status: kycStatus,
          is_active: action === 'approve',
          updated_at: new Date().toISOString()
        })
        .eq('seller_id', seller_id)
        .select();

      if (updateResult.error) {
        console.error('KYC update error:', updateResult.error);
        return new Response(JSON.stringify({ success: false, error: updateResult.error.message }), {
          status: 500,
          headers: { 'Content-Type': 'application/json', ...corsHeaders }
        });
      }

      const updatedSeller = updateResult.data;

      // Send notification to seller
      await fetch(`${supabaseUrl}/rest/v1/notifications`, {
        method: 'POST',
        headers: {
          'apikey': supabaseKey,
          'Authorization': `Bearer ${supabaseKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          user_id: seller_id,
          user_type: 'seller',
          title: action === 'approve' ? 'KYC Approved 🎉' : 'KYC Rejected',
          message: action === 'approve'
            ? 'Congratulations! Your KYC has been approved. You can now start selling on Suriyawan Saffari.'
            : `Your KYC has been rejected. Reason: ${reason || 'Please contact support for more details.'}`,
          type: 'kyc',
          data: { kyc_status: kycStatus, reason: reason },
          created_at: new Date().toISOString()
        })
      });

      return new Response(JSON.stringify({
        success: true,
        message: message,
        seller: updatedSeller
      }), {
        status: 200,
        headers: { 'Content-Type': 'application/json', ...corsHeaders }
      });

    } catch (error) {
      console.error('KYC action error:', error);
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