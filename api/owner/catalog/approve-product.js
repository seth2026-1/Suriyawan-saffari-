// api/owner/catalog/approve-product.js
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
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
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
  // GET PENDING PRODUCTS
  // =====================================================
  if (request.method === 'GET') {
    try {
      const search = url.searchParams.get('search');
      const seller_id = url.searchParams.get('seller_id');
      const category_id = url.searchParams.get('category_id');
      const page = parseInt(url.searchParams.get('page') || '1');
      const limit = parseInt(url.searchParams.get('limit') || '20');
      const sort_by = url.searchParams.get('sort_by') || 'created_at';
      const sort_order = url.searchParams.get('sort_order') || 'desc';

      const productsSelect = `prod_id,name,description,mrp,selling_price,stock,tags,images,category_id,is_approved,is_active,created_at,sellers!inner(seller_id,shop_name,owner_name,email,mobile,kyc_status),categories!left(cat_id,name)`;
      let productsUrl = `${supabaseUrl}/rest/v1/products?select=${encodeURIComponent(productsSelect)}&is_approved=eq.false&order=${sort_by}.${sort_order}`;

      if (search) {
        productsUrl += `&or=(name.ilike.%${search}%,prod_id.ilike.%${search}%,sellers.shop_name.ilike.%${search}%)`;
      }

      if (seller_id) {
        productsUrl += `&seller_id=eq.${seller_id}`;
      }

      if (category_id) {
        productsUrl += `&category_id=eq.${parseInt(category_id)}`;
      }

      const from = (page - 1) * limit;
      const to = from + limit - 1;
      productsUrl += `&offset=${from}&limit=${limit}`;

      const productsResponse = await fetch(productsUrl, {
        headers: {
          'apikey': supabaseKey,
          'Authorization': `Bearer ${supabaseKey}`,
        },
      });
      const products = await productsResponse.json();
      const count = parseInt(productsResponse.headers.get('content-range')?.split('/')[1] || '0');

      // Get statistics
      const allPendingUrl = `${supabaseUrl}/rest/v1/products?select=seller_id,created_at&is_approved=eq.false`;
      const allPendingResponse = await fetch(allPendingUrl, {
        headers: {
          'apikey': supabaseKey,
          'Authorization': `Bearer ${supabaseKey}`,
        },
      });
      const allPendingProducts = await allPendingResponse.json();

      const sellersUrl = `${supabaseUrl}/rest/v1/sellers?select=seller_id,shop_name`;
      const sellersResponse = await fetch(sellersUrl, {
        headers: {
          'apikey': supabaseKey,
          'Authorization': `Bearer ${supabaseKey}`,
        },
      });
      const sellers = await sellersResponse.json();
      const sellersMap = new Map(sellers.map(s => [s.seller_id, s.shop_name]));

      const sellerWiseCount = {};
      allPendingProducts?.forEach(p => {
        sellerWiseCount[p.seller_id] = (sellerWiseCount[p.seller_id] || 0) + 1;
      });

      let oldestPending = null;
      if (allPendingProducts && allPendingProducts.length > 0) {
        oldestPending = allPendingProducts.reduce((oldest, p) => 
          new Date(p.created_at) < new Date(oldest.created_at) ? p : oldest, 
          allPendingProducts[0]
        )?.created_at;
      }

      const stats = {
        total_pending: allPendingProducts?.length || 0,
        sellers_with_pending: Object.keys(sellerWiseCount).length,
        oldest_pending: oldestPending
      };

      return new Response(JSON.stringify({
        success: true,
        products: products?.map(p => ({
          prod_id: p.prod_id,
          name: p.name,
          description: p.description,
          mrp: p.mrp,
          selling_price: p.selling_price,
          discount_percent: Math.round(((p.mrp - p.selling_price) / p.mrp) * 100),
          stock: p.stock,
          tags: p.tags,
          images: p.images,
          category: p.categories?.name,
          seller: {
            seller_id: p.sellers?.seller_id,
            shop_name: p.sellers?.shop_name,
            owner_name: p.sellers?.owner_name,
            email: p.sellers?.email,
            kyc_status: p.sellers?.kyc_status
          },
          created_at: p.created_at
        })) || [],
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
      console.error('Get pending products error:', error);
      return new Response(JSON.stringify({ success: false, error: error.message }), {
        status: 500,
        headers: { 'Content-Type': 'application/json', ...corsHeaders }
      });
    }
  }

  // =====================================================
  // APPROVE/REJECT PRODUCT (POST)
  // =====================================================
  if (request.method === 'POST') {
    try {
      const body = await request.json();

      // Check if bulk operation
      if (body.bulk === true) {
        // Bulk approve/reject
        const { prod_ids, action, price_override_percent } = body;

        if (!prod_ids || !Array.isArray(prod_ids) || prod_ids.length === 0) {
          return new Response(JSON.stringify({ success: false, error: 'Product IDs array is required' }), {
            status: 400,
            headers: { 'Content-Type': 'application/json', ...corsHeaders }
          });
        }

        if (!['approve', 'reject'].includes(action)) {
          return new Response(JSON.stringify({ success: false, error: 'Invalid action' }), {
            status: 400,
            headers: { 'Content-Type': 'application/json', ...corsHeaders }
          });
        }

        const results = {
          success: [],
          failed: []
        };

        for (const prod_id of prod_ids) {
          try {
            const productUrl = `${supabaseUrl}/rest/v1/products?select=*,sellers!inner(seller_id,shop_name)&prod_id=eq.${prod_id}`;
            const productResponse = await fetch(productUrl, {
              headers: {
                'apikey': supabaseKey,
                'Authorization': `Bearer ${supabaseKey}`,
              },
            });
            const productData = await productResponse.json();
            const product = productData[0];

            if (!product) {
              results.failed.push({ prod_id, error: 'Product not found' });
              continue;
            }

            let finalPrice = product.selling_price;
            if (action === 'approve' && price_override_percent) {
              finalPrice = Math.round(product.selling_price * (1 - price_override_percent / 100));
            }

            const updateData = action === 'approve' ? {
              is_approved: true,
              is_active: true,
              selling_price: finalPrice,
              updated_at: new Date().toISOString(),
              approved_at: new Date().toISOString(),
              approved_by: 'OWN001'
            } : {
              is_approved: false,
              is_active: false,
              updated_at: new Date().toISOString(),
              rejected_at: new Date().toISOString(),
              rejected_by: 'OWN001',
              rejection_reason: 'Bulk rejection by admin'
            };

            await fetch(`${supabaseUrl}/rest/v1/products?prod_id=eq.${prod_id}`, {
              method: 'PATCH',
              headers: {
                'apikey': supabaseKey,
                'Authorization': `Bearer ${supabaseKey}`,
                'Content-Type': 'application/json',
              },
              body: JSON.stringify(updateData)
            });

            results.success.push({ prod_id, name: product.name });

            // Send notification
            await fetch(`${supabaseUrl}/rest/v1/notifications`, {
              method: 'POST',
              headers: {
                'apikey': supabaseKey,
                'Authorization': `Bearer ${supabaseKey}`,
                'Content-Type': 'application/json',
              },
              body: JSON.stringify({
                user_id: product.seller_id,
                user_type: 'seller',
                title: action === 'approve' ? '✅ Product Approved' : '❌ Product Rejected',
                message: action === 'approve' 
                  ? `Your product "${product.name}" has been approved.`
                  : `Your product "${product.name}" has been rejected.`,
                type: 'product',
                data: { prod_id, action },
                created_at: new Date().toISOString()
              })
            });

          } catch (err) {
            results.failed.push({ prod_id, error: err.message });
          }
        }

        return new Response(JSON.stringify({
          success: true,
          message: `Bulk ${action} completed: ${results.success.length} successful, ${results.failed.length} failed`,
          results: results
        }), {
          status: 200,
          headers: { 'Content-Type': 'application/json', ...corsHeaders }
        });
      }

      // Single approve/reject
      const { prod_id, action, rejection_reason, price_override, commission_override } = body;

      if (!prod_id || !action) {
        return new Response(JSON.stringify({
          success: false,
          error: 'Product ID and action are required'
        }), {
          status: 400,
          headers: { 'Content-Type': 'application/json', ...corsHeaders }
        });
      }

      if (!['approve', 'reject'].includes(action)) {
        return new Response(JSON.stringify({ success: false, error: 'Invalid action' }), {
          status: 400,
          headers: { 'Content-Type': 'application/json', ...corsHeaders }
        });
      }

      // Get product details
      const productSelect = `*, sellers!inner (seller_id, shop_name, email, commission_rate)`;
      const productUrl = `${supabaseUrl}/rest/v1/products?select=${encodeURIComponent(productSelect)}&prod_id=eq.${prod_id}`;
      const productResponse = await fetch(productUrl, {
        headers: {
          'apikey': supabaseKey,
          'Authorization': `Bearer ${supabaseKey}`,
        },
      });
      const productData = await productResponse.json();
      const product = productData[0];

      if (!product) {
        return new Response(JSON.stringify({ success: false, error: 'Product not found' }), {
          status: 404,
          headers: { 'Content-Type': 'application/json', ...corsHeaders }
        });
      }

      let finalPrice = product.selling_price;
      let finalCommission = product.sellers?.commission_rate || 10;

      if (action === 'approve') {
        if (price_override && price_override > 0) {
          finalPrice = price_override;
        }

        if (commission_override && commission_override > 0) {
          finalCommission = commission_override;
        }

        const updateResult = await supabase
          .from('products')
          .update({
            is_approved: true,
            is_active: true,
            selling_price: finalPrice,
            updated_at: new Date().toISOString(),
            approved_at: new Date().toISOString(),
            approved_by: 'OWN001'
          })
          .eq('prod_id', prod_id)
          .select();

        if (updateResult.error) throw updateResult.error;
        const updatedProduct = updateResult.data;

        // Send approval notification to seller
        await fetch(`${supabaseUrl}/rest/v1/notifications`, {
          method: 'POST',
          headers: {
            'apikey': supabaseKey,
            'Authorization': `Bearer ${supabaseKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            user_id: product.seller_id,
            user_type: 'seller',
            title: '✅ Product Approved!',
            message: `Your product "${product.name}" has been approved and is now live on Suriyawan Saffari. ${finalPrice !== product.selling_price ? `Price updated to ₹${finalPrice}.` : ''}`,
            type: 'product',
            data: { prod_id, action: 'approved', price: finalPrice },
            created_at: new Date().toISOString()
          })
        });

        return new Response(JSON.stringify({
          success: true,
          message: 'Product approved successfully',
          product: {
            prod_id: updatedProduct.prod_id,
            name: updatedProduct.name,
            selling_price: updatedProduct.selling_price,
            is_approved: updatedProduct.is_approved,
            approved_at: updatedProduct.approved_at
          }
        }), {
          status: 200,
          headers: { 'Content-Type': 'application/json', ...corsHeaders }
        });

      } else if (action === 'reject') {
        const updateResult = await supabase
          .from('products')
          .update({
            is_approved: false,
            is_active: false,
            updated_at: new Date().toISOString(),
            rejection_reason: rejection_reason || null,
            rejected_at: new Date().toISOString(),
            rejected_by: 'OWN001'
          })
          .eq('prod_id', prod_id)
          .select();

        if (updateResult.error) throw updateResult.error;
        const updatedProduct = updateResult.data;

        // Send rejection notification to seller
        await fetch(`${supabaseUrl}/rest/v1/notifications`, {
          method: 'POST',
          headers: {
            'apikey': supabaseKey,
            'Authorization': `Bearer ${supabaseKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            user_id: product.seller_id,
            user_type: 'seller',
            title: '❌ Product Rejected',
            message: `Your product "${product.name}" has been rejected. Reason: ${rejection_reason || 'Please contact support for details.'}`,
            type: 'product',
            data: { prod_id, action: 'rejected', reason: rejection_reason },
            created_at: new Date().toISOString()
          })
        });

        return new Response(JSON.stringify({
          success: true,
          message: 'Product rejected successfully',
          product: {
            prod_id: updatedProduct.prod_id,
            name: updatedProduct.name,
            is_approved: updatedProduct.is_approved,
            rejected_reason: updatedProduct.rejection_reason,
            rejected_at: updatedProduct.rejected_at
          }
        }), {
          status: 200,
          headers: { 'Content-Type': 'application/json', ...corsHeaders }
        });
      }

    } catch (error) {
      console.error('Approve/Reject product error:', error);
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