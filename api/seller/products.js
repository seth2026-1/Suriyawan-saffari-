// api/seller/products.js
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
            finalUrl += `${finalUrl.includes('?') ? '&' : '?'}select=*`;
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
            lte: (lteField, lteValue) => ({
              order: (orderField, { ascending }) => ({
                range: async (from, to) => {
                  const result = await execute({
                    eq: { [field]: value },
                    lte: { [lteField]: lteValue },
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
          }),
          eq: (field, value) => ({
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
          }),
          or: (condition) => ({
            order: (orderField, { ascending }) => ({
              range: async (from, to) => {
                const result = await execute({
                  or: condition,
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

// Main handler for Edge Function
export default async function handler(request) {
  // CORS Headers
  const corsHeaders = {
    'Access-Control-Allow-Credentials': 'true',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version, Authorization',
  };

  // Handle OPTIONS preflight
  if (request.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: corsHeaders });
  }

  const url = new URL(request.url);

  // =====================================================
  // GET PRODUCTS LIST
  // =====================================================
  if (request.method === 'GET') {
    try {
      const seller_id = url.searchParams.get('seller_id');
      const status = url.searchParams.get('status');
      const category_id = url.searchParams.get('category_id');
      const search = url.searchParams.get('search');
      const page = parseInt(url.searchParams.get('page') || '1');
      const limit = parseInt(url.searchParams.get('limit') || '20');
      const sort_by = url.searchParams.get('sort_by') || 'created_at';
      const sort_order = url.searchParams.get('sort_order') || 'desc';

      if (!seller_id) {
        return new Response(JSON.stringify({ success: false, error: 'Seller ID is required' }), {
          status: 400,
          headers: { 'Content-Type': 'application/json', ...corsHeaders }
        });
      }

      const supabase = createSupabaseClient();
      const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
      const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

      // Build query
      let query = supabase
        .from('products')
        .select(`
          *,
          categories!left (
            cat_id,
            name
          ),
          product_variations (
            var_id,
            size,
            color,
            material,
            sku,
            stock,
            price_adjustment
          )
        `, { count: 'exact' })
        .eq('seller_id', seller_id);

      if (status === 'active') {
        query = query.eq('is_active', true);
      } else if (status === 'inactive') {
        query = query.eq('is_active', false);
      } else if (status === 'pending') {
        query = query.eq('is_approved', false);
      } else if (status === 'low_stock') {
        query = query.lte('stock', 5);
      } else if (status === 'out_of_stock') {
        query = query.eq('stock', 0);
      }

      if (category_id) {
        query = query.eq('category_id', parseInt(category_id));
      }

      if (search) {
        query = query.or(`name.ilike.%${search}%,description.ilike.%${search}%,prod_id.ilike.%${search}%`);
      }

      const sortAsc = sort_order === 'asc';
      query = query.order(sort_by, { ascending: sortAsc });

      const from = (page - 1) * limit;
      const to = from + limit - 1;

      const { data: products, count } = await query.range(from, to);

      // Get categories for filter
      const categoriesUrl = `${supabaseUrl}/rest/v1/categories?is_active=eq.true&order=name.asc&select=cat_id,name`;
      const categoriesResponse = await fetch(categoriesUrl, {
        headers: {
          'apikey': supabaseKey,
          'Authorization': `Bearer ${supabaseKey}`,
        },
      });
      const categories = await categoriesResponse.json();

      // Calculate statistics
      const allProductsUrl = `${supabaseUrl}/rest/v1/products?seller_id=eq.${seller_id}&select=is_active,is_approved,stock`;
      const allProductsResponse = await fetch(allProductsUrl, {
        headers: {
          'apikey': supabaseKey,
          'Authorization': `Bearer ${supabaseKey}`,
        },
      });
      const allProducts = await allProductsResponse.json();

      const stats = {
        total: allProducts?.length || 0,
        active: allProducts?.filter(p => p.is_active === true).length || 0,
        inactive: allProducts?.filter(p => p.is_active === false).length || 0,
        pending_approval: allProducts?.filter(p => p.is_approved === false).length || 0,
        low_stock: allProducts?.filter(p => p.stock <= 5 && p.stock > 0).length || 0,
        out_of_stock: allProducts?.filter(p => p.stock === 0).length || 0
      };

      // Format products
      const formattedProducts = (products || []).map(product => {
        const now = new Date();
        const isFlashSale = product.flash_price && 
          product.flash_start && new Date(product.flash_start) <= now && 
          product.flash_end && new Date(product.flash_end) >= now;

        return {
          prod_id: product.prod_id,
          name: product.name,
          description: product.description,
          mrp: product.mrp,
          selling_price: product.selling_price,
          flash_price: product.flash_price,
          stock: product.stock,
          category_id: product.category_id,
          category_name: product.categories?.name,
          tags: product.tags,
          images: product.images,
          rating: product.rating || 0,
          total_sold: product.total_sold || 0,
          total_views: product.total_views || 0,
          is_active: product.is_active,
          is_approved: product.is_approved,
          is_flash_sale: isFlashSale,
          flash_start: product.flash_start,
          flash_end: product.flash_end,
          discount_percent: Math.round(((product.mrp - product.selling_price) / product.mrp) * 100),
          variations: (product.product_variations || []).map(v => ({
            var_id: v.var_id,
            size: v.size,
            color: v.color,
            material: v.material,
            sku: v.sku,
            stock: v.stock,
            price_adjustment: v.price_adjustment
          })),
          created_at: product.created_at,
          updated_at: product.updated_at,
          barcode_url: `/api/barcode/generate?text=${product.prod_id}`,
          qr_url: `/api/barcode/generate-qr?text=${product.prod_id}`
        };
      });

      return new Response(JSON.stringify({
        success: true,
        products: formattedProducts,
        stats: stats,
        categories: categories || [],
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
      console.error('Get products error:', error);
      return new Response(JSON.stringify({ success: false, error: error.message }), {
        status: 500,
        headers: { 'Content-Type': 'application/json', ...corsHeaders }
      });
    }
  }

  // =====================================================
  // ADD NEW PRODUCT (POST)
  // =====================================================
  if (request.method === 'POST') {
    try {
      const body = await request.json();
      const {
        seller_id,
        name,
        description,
        short_description,
        mrp,
        selling_price,
        flash_price,
        flash_start,
        flash_end,
        stock,
        category_id,
        sub_category_id,
        tags,
        images,
        video_url,
        specifications,
        is_cod_available,
        min_cod_amount,
        variations
      } = body;

      if (!seller_id || !name || !mrp || !selling_price) {
        return new Response(JSON.stringify({
          success: false,
          error: 'Seller ID, name, MRP and selling price are required'
        }), {
          status: 400,
          headers: { 'Content-Type': 'application/json', ...corsHeaders }
        });
      }

      if (selling_price > mrp) {
        return new Response(JSON.stringify({
          success: false,
          error: 'Selling price cannot be greater than MRP'
        }), {
          status: 400,
          headers: { 'Content-Type': 'application/json', ...corsHeaders }
        });
      }

      if (flash_price && flash_price > mrp) {
        return new Response(JSON.stringify({
          success: false,
          error: 'Flash price cannot be greater than MRP'
        }), {
          status: 400,
          headers: { 'Content-Type': 'application/json', ...corsHeaders }
        });
      }

      const supabase = createSupabaseClient();
      const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
      const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

      // Get seller's commission rate and KYC status
      const sellerResult = await supabase
        .from('sellers')
        .select('commission_rate, kyc_status, shop_name')
        .eq('seller_id', seller_id)
        .single();

      if (!sellerResult.data || sellerResult.data.kyc_status !== 'APPROVED') {
        return new Response(JSON.stringify({
          success: false,
          error: 'Your KYC is not approved yet. Cannot add products.'
        }), {
          status: 403,
          headers: { 'Content-Type': 'application/json', ...corsHeaders }
        });
      }

      const seller = sellerResult.data;

      // Generate product ID
      const prodId = 'PROD' + Date.now() + Math.random().toString(36).substring(2, 8).toUpperCase();

      // Insert product
      const productInsert = await supabase
        .from('products')
        .insert({
          prod_id: prodId,
          seller_id,
          name,
          description: description || null,
          short_description: short_description || null,
          mrp,
          selling_price,
          flash_price: flash_price || null,
          flash_start: flash_start || null,
          flash_end: flash_end || null,
          stock: stock || 0,
          category_id: category_id || null,
          sub_category_id: sub_category_id || null,
          tags: tags || [],
          images: images || [],
          video_url: video_url || null,
          specifications: specifications || {},
          is_cod_available: is_cod_available !== false,
          min_cod_amount: min_cod_amount || 200,
          is_active: true,
          is_approved: false,
          created_at: new Date().toISOString()
        })
        .select();

      if (productInsert.error) {
        console.error('Product insert error:', productInsert.error);
        return new Response(JSON.stringify({ success: false, error: productInsert.error.message }), {
          status: 500,
          headers: { 'Content-Type': 'application/json', ...corsHeaders }
        });
      }

      const product = productInsert.data;

      // Insert variations if provided
      if (variations && variations.length > 0) {
        const variationData = variations.map(v => ({
          prod_id: product.prod_id,
          size: v.size || null,
          color: v.color || null,
          material: v.material || null,
          sku: v.sku || `${product.prod_id}-${v.size || ''}-${v.color || ''}`,
          stock: v.stock || 0,
          price_adjustment: v.price_adjustment || 0
        }));

        await fetch(`${supabaseUrl}/rest/v1/product_variations`, {
          method: 'POST',
          headers: {
            'apikey': supabaseKey,
            'Authorization': `Bearer ${supabaseKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(variationData)
        });
      }

      // Notify owner for approval
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
          title: 'New Product Pending Approval',
          message: `${seller.shop_name || seller_id} added a new product: ${name}`,
          type: 'product',
          data: { prod_id: product.prod_id, seller_id },
          created_at: new Date().toISOString()
        })
      });

      return new Response(JSON.stringify({
        success: true,
        message: 'Product added successfully. Waiting for owner approval.',
        product: {
          prod_id: product.prod_id,
          name: product.name,
          mrp: product.mrp,
          selling_price: product.selling_price,
          stock: product.stock,
          is_approved: product.is_approved,
          barcode_url: `/api/barcode/generate?text=${product.prod_id}`,
          qr_url: `/api/barcode/generate-qr?text=${product.prod_id}`
        }
      }), {
        status: 200,
        headers: { 'Content-Type': 'application/json', ...corsHeaders }
      });

    } catch (error) {
      console.error('Add product error:', error);
      return new Response(JSON.stringify({ success: false, error: error.message }), {
        status: 500,
        headers: { 'Content-Type': 'application/json', ...corsHeaders }
      });
    }
  }

  // =====================================================
  // UPDATE PRODUCT (PUT)
  // =====================================================
  if (request.method === 'PUT') {
    try {
      const body = await request.json();
      const {
        prod_id,
        seller_id,
        name,
        description,
        short_description,
        mrp,
        selling_price,
        flash_price,
        flash_start,
        flash_end,
        stock,
        category_id,
        tags,
        images,
        video_url,
        specifications,
        is_cod_available,
        min_cod_amount,
        is_active
      } = body;

      if (!prod_id || !seller_id) {
        return new Response(JSON.stringify({
          success: false,
          error: 'Product ID and Seller ID are required'
        }), {
          status: 400,
          headers: { 'Content-Type': 'application/json', ...corsHeaders }
        });
      }

      const supabase = createSupabaseClient();

      // Verify product belongs to seller
      const existingResult = await supabase
        .from('products')
        .select('seller_id')
        .eq('prod_id', prod_id)
        .single();

      if (existingResult.error || !existingResult.data) {
        return new Response(JSON.stringify({ success: false, error: 'Product not found' }), {
          status: 404,
          headers: { 'Content-Type': 'application/json', ...corsHeaders }
        });
      }

      if (existingResult.data.seller_id !== seller_id) {
        return new Response(JSON.stringify({ success: false, error: 'Unauthorized' }), {
          status: 403,
          headers: { 'Content-Type': 'application/json', ...corsHeaders }
        });
      }

      // Build update object
      const updateData = {};
      if (name !== undefined) updateData.name = name;
      if (description !== undefined) updateData.description = description;
      if (short_description !== undefined) updateData.short_description = short_description;
      if (mrp !== undefined) updateData.mrp = mrp;
      if (selling_price !== undefined) updateData.selling_price = selling_price;
      if (flash_price !== undefined) updateData.flash_price = flash_price;
      if (flash_start !== undefined) updateData.flash_start = flash_start;
      if (flash_end !== undefined) updateData.flash_end = flash_end;
      if (stock !== undefined) updateData.stock = stock;
      if (category_id !== undefined) updateData.category_id = category_id;
      if (tags !== undefined) updateData.tags = tags;
      if (images !== undefined) updateData.images = images;
      if (video_url !== undefined) updateData.video_url = video_url;
      if (specifications !== undefined) updateData.specifications = specifications;
      if (is_cod_available !== undefined) updateData.is_cod_available = is_cod_available;
      if (min_cod_amount !== undefined) updateData.min_cod_amount = min_cod_amount;
      if (is_active !== undefined) updateData.is_active = is_active;

      updateData.updated_at = new Date().toISOString();

      const updateResult = await supabase
        .from('products')
        .update(updateData)
        .eq('prod_id', prod_id)
        .select();

      if (updateResult.error) {
        console.error('Product update error:', updateResult.error);
        return new Response(JSON.stringify({ success: false, error: updateResult.error.message }), {
          status: 500,
          headers: { 'Content-Type': 'application/json', ...corsHeaders }
        });
      }

      const updatedProduct = updateResult.data;

      return new Response(JSON.stringify({
        success: true,
        message: 'Product updated successfully',
        product: updatedProduct
      }), {
        status: 200,
        headers: { 'Content-Type': 'application/json', ...corsHeaders }
      });

    } catch (error) {
      console.error('Update product error:', error);
      return new Response(JSON.stringify({ success: false, error: error.message }), {
        status: 500,
        headers: { 'Content-Type': 'application/json', ...corsHeaders }
      });
    }
  }

  // =====================================================
  // DELETE PRODUCT (DELETE)
  // =====================================================
  if (request.method === 'DELETE') {
    try {
      const prod_id = url.searchParams.get('prod_id');
      const seller_id = url.searchParams.get('seller_id');

      if (!prod_id || !seller_id) {
        return new Response(JSON.stringify({
          success: false,
          error: 'Product ID and Seller ID are required'
        }), {
          status: 400,
          headers: { 'Content-Type': 'application/json', ...corsHeaders }
        });
      }

      const supabase = createSupabaseClient();
      const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
      const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

      // Verify product belongs to seller
      const existingResult = await supabase
        .from('products')
        .select('seller_id, name')
        .eq('prod_id', prod_id)
        .single();

      if (existingResult.error || !existingResult.data) {
        return new Response(JSON.stringify({ success: false, error: 'Product not found' }), {
          status: 404,
          headers: { 'Content-Type': 'application/json', ...corsHeaders }
        });
      }

      if (existingResult.data.seller_id !== seller_id) {
        return new Response(JSON.stringify({ success: false, error: 'Unauthorized' }), {
          status: 403,
          headers: { 'Content-Type': 'application/json', ...corsHeaders }
        });
      }

      // Check if product has any orders
      const orderItemsUrl = `${supabaseUrl}/rest/v1/order_items?prod_id=eq.${prod_id}&select=item_id&limit=1`;
      const orderItemsResponse = await fetch(orderItemsUrl, {
        headers: {
          'apikey': supabaseKey,
          'Authorization': `Bearer ${supabaseKey}`,
        },
      });
      const orderItems = await orderItemsResponse.json();

      if (orderItems && orderItems.length > 0) {
        // Soft delete - just deactivate
        await fetch(`${supabaseUrl}/rest/v1/products?prod_id=eq.${prod_id}`, {
          method: 'PATCH',
          headers: {
            'apikey': supabaseKey,
            'Authorization': `Bearer ${supabaseKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ is_active: false, updated_at: new Date().toISOString() })
        });

        return new Response(JSON.stringify({
          success: true,
          message: 'Product deactivated as it has existing orders'
        }), {
          status: 200,
          headers: { 'Content-Type': 'application/json', ...corsHeaders }
        });
      }

      // Hard delete - remove variations first
      await fetch(`${supabaseUrl}/rest/v1/product_variations?prod_id=eq.${prod_id}`, {
        method: 'DELETE',
        headers: {
          'apikey': supabaseKey,
          'Authorization': `Bearer ${supabaseKey}`,
        },
      });

      // Delete product
      await fetch(`${supabaseUrl}/rest/v1/products?prod_id=eq.${prod_id}`, {
        method: 'DELETE',
        headers: {
          'apikey': supabaseKey,
          'Authorization': `Bearer ${supabaseKey}`,
        },
      });

      return new Response(JSON.stringify({
        success: true,
        message: 'Product deleted successfully'
      }), {
        status: 200,
        headers: { 'Content-Type': 'application/json', ...corsHeaders }
      });

    } catch (error) {
      console.error('Delete product error:', error);
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