// api/seller/edit-product.js
// Edge Function for Vercel Deployment

export const config = {
  runtime: 'edge',
  regions: ['iad1', 'sfo1', 'fra1', 'sin1'],
};

// 40 Product Tags (same as in add-product)
const PRODUCT_TAGS = [
  'Hot', 'Fabulous', 'Super', 'Epic', 'Awesome', 'Amazing',
  'Stunning', 'Gorgeous', 'Breathtaking', 'Mind-blowing',
  'Luxury', 'Premium', 'Exclusive', 'Elite', 'Signature',
  'Ultimate', 'Legendary', 'Royal', 'Divine', 'Celestial',
  'Viral', 'Trending', 'Fire', 'Slay', 'Glow', 'Boss',
  'Iconic', 'Unreal', 'Next Level', 'Obsessed',
  'Must-Have', 'Game Changer', 'Showstopper', 'Dazzling',
  'Irresistible', 'Spellbinding', 'Radiant', 'Flawless', 'Killer', 'Sizzling'
];

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
            eq: (eqField, eqValue) => ({
              single: async () => {
                const finalUrl = `${url}&${field}=eq.${value}&${eqField}=eq.${eqValue}`;
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
    'Access-Control-Allow-Methods': 'GET, PUT, OPTIONS',
    'Access-Control-Allow-Headers': 'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version, Authorization',
  };

  // Handle OPTIONS preflight
  if (request.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: corsHeaders });
  }

  // =====================================================
  // GET PRODUCT DATA FOR EDITING (GET)
  // =====================================================
  if (request.method === 'GET') {
    try {
      const url = new URL(request.url);
      const prod_id = url.searchParams.get('prod_id');
      const seller_id = url.searchParams.get('seller_id');

      if (!prod_id || !seller_id) {
        return new Response(
          JSON.stringify({
            success: false,
            error: 'Product ID and Seller ID are required'
          }),
          { status: 400, headers: { 'Content-Type': 'application/json', ...corsHeaders } }
        );
      }

      const supabase = createSupabaseClient();
      const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
      const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

      // Get product details with categories and variations
      const productSelect = `*,
        categories!left (
          cat_id,
          name,
          parent_id
        ),
        product_variations (
          var_id,
          size,
          color,
          material,
          sku,
          stock,
          price_adjustment
        )`;

      const productUrl = `${supabaseUrl}/rest/v1/products?select=${encodeURIComponent(productSelect)}&prod_id=eq.${prod_id}&seller_id=eq.${seller_id}`;
      const productResponse = await fetch(productUrl, {
        headers: {
          'apikey': supabaseKey,
          'Authorization': `Bearer ${supabaseKey}`,
        },
      });
      const productData = await productResponse.json();
      const product = productData[0];

      if (!product) {
        return new Response(
          JSON.stringify({ success: false, error: 'Product not found or unauthorized' }),
          { status: 404, headers: { 'Content-Type': 'application/json', ...corsHeaders } }
        );
      }

      // Get categories for dropdown
      const categoriesUrl = `${supabaseUrl}/rest/v1/categories?is_active=eq.true&order=sort_order.asc&select=cat_id,name,parent_id`;
      const categoriesResponse = await fetch(categoriesUrl, {
        headers: {
          'apikey': supabaseKey,
          'Authorization': `Bearer ${supabaseKey}`,
        },
      });
      const categories = await categoriesResponse.json();

      const mainCategories = categories?.filter(c => !c.parent_id) || [];
      const subCategories = categories?.filter(c => c.parent_id) || [];

      // Get seller's commission rate
      const sellerResult = await supabase
        .from('sellers')
        .select('commission_rate')
        .eq('seller_id', seller_id)
        .single();

      // Calculate total sold from order items
      const orderItemsUrl = `${supabaseUrl}/rest/v1/order_items?select=quantity&prod_id=eq.${prod_id}`;
      const orderItemsResponse = await fetch(orderItemsUrl, {
        headers: {
          'apikey': supabaseKey,
          'Authorization': `Bearer ${supabaseKey}`,
        },
      });
      const orderItems = await orderItemsResponse.json();

      const totalSold = orderItems?.reduce((sum, item) => sum + item.quantity, 0) || 0;

      return new Response(
        JSON.stringify({
          success: true,
          product: {
            prod_id: product.prod_id,
            name: product.name,
            description: product.description,
            short_description: product.short_description,
            mrp: product.mrp,
            selling_price: product.selling_price,
            flash_price: product.flash_price,
            flash_start: product.flash_start,
            flash_end: product.flash_end,
            stock: product.stock,
            category_id: product.category_id,
            sub_category_id: product.sub_category_id,
            tags: product.tags || [],
            images: product.images || [],
            video_url: product.video_url,
            specifications: product.specifications || {},
            is_cod_available: product.is_cod_available,
            min_cod_amount: product.min_cod_amount,
            is_active: product.is_active,
            is_approved: product.is_approved,
            hsn_code: product.hsn_code,
            gst_percentage: product.gst_percentage,
            variations: product.product_variations || [],
            created_at: product.created_at,
            updated_at: product.updated_at
          },
          stats: {
            total_sold: totalSold,
            total_views: product.total_views || 0,
            rating: product.rating || 0,
            total_reviews: product.total_reviews || 0
          },
          categories: {
            main: mainCategories,
            sub: subCategories
          },
          tags: PRODUCT_TAGS,
          commission_rate: sellerResult.data?.commission_rate || 10,
          barcode_url: `/api/barcode/generate?text=${product.prod_id}`,
          qr_url: `/api/barcode/generate-qr?text=${product.prod_id}`
        }),
        { status: 200, headers: { 'Content-Type': 'application/json', ...corsHeaders } }
      );

    } catch (error) {
      console.error('Get product for edit error:', error);
      return new Response(
        JSON.stringify({ success: false, error: error.message }),
        { status: 500, headers: { 'Content-Type': 'application/json', ...corsHeaders } }
      );
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
        sub_category_id,
        tags,
        images,
        video_url,
        specifications,
        is_cod_available,
        min_cod_amount,
        is_active,
        variations,
        hsn_code,
        gst_percentage
      } = body;

      if (!prod_id || !seller_id) {
        return new Response(
          JSON.stringify({
            success: false,
            error: 'Product ID and Seller ID are required'
          }),
          { status: 400, headers: { 'Content-Type': 'application/json', ...corsHeaders } }
        );
      }

      const supabase = createSupabaseClient();
      const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
      const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

      // Verify product belongs to seller and get current data
      const existingUrl = `${supabaseUrl}/rest/v1/products?prod_id=eq.${prod_id}&select=seller_id,is_approved,selling_price`;
      const existingResponse = await fetch(existingUrl, {
        headers: {
          'apikey': supabaseKey,
          'Authorization': `Bearer ${supabaseKey}`,
        },
      });
      const existingData = await existingResponse.json();
      const existingProduct = existingData[0];

      if (!existingProduct) {
        return new Response(
          JSON.stringify({ success: false, error: 'Product not found' }),
          { status: 404, headers: { 'Content-Type': 'application/json', ...corsHeaders } }
        );
      }

      if (existingProduct.seller_id !== seller_id) {
        return new Response(
          JSON.stringify({ success: false, error: 'Unauthorized' }),
          { status: 403, headers: { 'Content-Type': 'application/json', ...corsHeaders } }
        );
      }

      // Validation
      if (selling_price && mrp && selling_price > mrp) {
        return new Response(
          JSON.stringify({
            success: false,
            error: 'Selling price cannot be greater than MRP'
          }),
          { status: 400, headers: { 'Content-Type': 'application/json', ...corsHeaders } }
        );
      }

      if (flash_price && mrp && flash_price > mrp) {
        return new Response(
          JSON.stringify({
            success: false,
            error: 'Flash price cannot be greater than MRP'
          }),
          { status: 400, headers: { 'Content-Type': 'application/json', ...corsHeaders } }
        );
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
      if (sub_category_id !== undefined) updateData.sub_category_id = sub_category_id;
      if (tags !== undefined) updateData.tags = tags;
      if (images !== undefined) updateData.images = images;
      if (video_url !== undefined) updateData.video_url = video_url;
      if (specifications !== undefined) updateData.specifications = specifications;
      if (is_cod_available !== undefined) updateData.is_cod_available = is_cod_available;
      if (min_cod_amount !== undefined) updateData.min_cod_amount = min_cod_amount;
      if (is_active !== undefined) updateData.is_active = is_active;
      if (hsn_code !== undefined) updateData.hsn_code = hsn_code;
      if (gst_percentage !== undefined) updateData.gst_percentage = gst_percentage;

      // If price changed, set needs re-approval
      if (selling_price !== undefined && selling_price != existingProduct.selling_price) {
        updateData.is_approved = false;
      }

      updateData.updated_at = new Date().toISOString();

      // Update product
      const updateResult = await supabase
        .from('products')
        .update(updateData)
        .eq('prod_id', prod_id)
        .select();

      if (updateResult.error) {
        console.error('Product update error:', updateResult.error);
        return new Response(
          JSON.stringify({ success: false, error: updateResult.error.message }),
          { status: 500, headers: { 'Content-Type': 'application/json', ...corsHeaders } }
        );
      }

      const updatedProduct = updateResult.data;

      // Update variations
      if (variations !== undefined) {
        // Delete existing variations
        await fetch(`${supabaseUrl}/rest/v1/product_variations?prod_id=eq.${prod_id}`, {
          method: 'DELETE',
          headers: {
            'apikey': supabaseKey,
            'Authorization': `Bearer ${supabaseKey}`,
          },
        });

        // Insert new variations if any
        if (variations.length > 0) {
          const variationData = variations.map(v => ({
            prod_id,
            size: v.size || null,
            color: v.color || null,
            material: v.material || null,
            sku: v.sku || `${prod_id}-${v.size || 'OS'}-${v.color || 'DF'}`,
            stock: v.stock || 0,
            price_adjustment: v.price_adjustment || 0,
            barcode: `/api/barcode/generate?text=${prod_id}-${v.size || 'OS'}`
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
      }

      // Notify owner if product needs re-approval
      if (updateData.is_approved === false) {
        const sellerResult = await supabase
          .from('sellers')
          .select('shop_name')
          .eq('seller_id', seller_id)
          .single();

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
            title: '📝 Product Updated - Pending Approval',
            message: `${sellerResult.data?.shop_name || seller_id} updated product: ${updatedProduct.name}`,
            type: 'product',
            data: { prod_id, seller_id, action: 'approve_product' },
            created_at: new Date().toISOString()
          })
        });
      }

      const messageText = existingProduct.is_approved && updateData.is_approved === false 
        ? 'Product updated successfully. Changes require owner approval.' 
        : 'Product updated successfully';

      return new Response(
        JSON.stringify({
          success: true,
          message: messageText,
          product: {
            prod_id: updatedProduct.prod_id,
            name: updatedProduct.name,
            mrp: updatedProduct.mrp,
            selling_price: updatedProduct.selling_price,
            stock: updatedProduct.stock,
            is_active: updatedProduct.is_active,
            is_approved: updatedProduct.is_approved,
            updated_at: updatedProduct.updated_at
          },
          barcode_url: `/api/barcode/generate?text=${updatedProduct.prod_id}`,
          qr_url: `/api/barcode/generate-qr?text=${updatedProduct.prod_id}`
        }),
        { status: 200, headers: { 'Content-Type': 'application/json', ...corsHeaders } }
      );

    } catch (error) {
      console.error('Update product error:', error);
      return new Response(
        JSON.stringify({ success: false, error: error.message }),
        { status: 500, headers: { 'Content-Type': 'application/json', ...corsHeaders } }
      );
    }
  }

  return new Response(
    JSON.stringify({ success: false, error: 'Method not allowed' }),
    { status: 405, headers: { 'Content-Type': 'application/json', ...corsHeaders } }
  );
}