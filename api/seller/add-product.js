// api/seller/add-product.js
// Edge Function for Vercel Deployment

export const config = {
  runtime: 'edge',
  regions: ['iad1', 'sfo1', 'fra1', 'sin1'],
};

// Helper function to generate Product ID
function generateProdId() {
  const date = new Date();
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  const random = Math.random().toString(36).substring(2, 6).toUpperCase();
  const timestamp = Date.now().toString().slice(-4);
  return `PROD${year}${month}${day}${timestamp}${random}`;
}

// 40 Product Tags
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

  // =====================================================
  // GET FORM DATA (Categories, Tags, etc.)
  // =====================================================
  if (request.method === 'GET') {
    try {
      const url = new URL(request.url);
      const seller_id = url.searchParams.get('seller_id');

      const supabase = createSupabaseClient();
      const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
      const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

      // Get categories
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

      let commissionRate = 10;
      if (seller_id) {
        const sellerResult = await supabase
          .from('sellers')
          .select('commission_rate, kyc_status')
          .eq('seller_id', seller_id)
          .single();

        if (sellerResult.data) {
          commissionRate = sellerResult.data.commission_rate || 10;
        }
      }

      return new Response(
        JSON.stringify({
          success: true,
          categories: {
            main: mainCategories,
            sub: subCategories
          },
          tags: PRODUCT_TAGS,
          tag_groups: {
            attractive: PRODUCT_TAGS.slice(0, 10),
            premium: PRODUCT_TAGS.slice(10, 20),
            trendy: PRODUCT_TAGS.slice(20, 30),
            bonus: PRODUCT_TAGS.slice(30, 40)
          },
          settings: {
            commission_rate: commissionRate,
            max_images: 8,
            max_video_size: 30,
            allowed_image_types: ['image/jpeg', 'image/png', 'image/webp', 'image/jpg']
          }
        }),
        { status: 200, headers: { 'Content-Type': 'application/json', ...corsHeaders } }
      );

    } catch (error) {
      console.error('Get form data error:', error);
      return new Response(
        JSON.stringify({ success: false, error: error.message }),
        { status: 500, headers: { 'Content-Type': 'application/json', ...corsHeaders } }
      );
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
        variations,
        is_cod_available,
        min_cod_amount
      } = body;

      const supabase = createSupabaseClient();
      const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
      const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

      // Validation
      if (!seller_id || !name || !mrp || !selling_price) {
        return new Response(
          JSON.stringify({
            success: false,
            error: 'Seller ID, product name, MRP and selling price are required'
          }),
          { status: 400, headers: { 'Content-Type': 'application/json', ...corsHeaders } }
        );
      }

      if (selling_price > mrp) {
        return new Response(
          JSON.stringify({
            success: false,
            error: 'Selling price cannot be greater than MRP'
          }),
          { status: 400, headers: { 'Content-Type': 'application/json', ...corsHeaders } }
        );
      }

      if (flash_price && flash_price > mrp) {
        return new Response(
          JSON.stringify({
            success: false,
            error: 'Flash price cannot be greater than MRP'
          }),
          { status: 400, headers: { 'Content-Type': 'application/json', ...corsHeaders } }
        );
      }

      if (stock < 0) {
        return new Response(
          JSON.stringify({
            success: false,
            error: 'Stock cannot be negative'
          }),
          { status: 400, headers: { 'Content-Type': 'application/json', ...corsHeaders } }
        );
      }

      // Get seller details
      const sellerResult = await supabase
        .from('sellers')
        .select('shop_name, commission_rate, kyc_status, is_active')
        .eq('seller_id', seller_id)
        .single();

      if (sellerResult.error || !sellerResult.data) {
        return new Response(
          JSON.stringify({ success: false, error: 'Seller not found' }),
          { status: 404, headers: { 'Content-Type': 'application/json', ...corsHeaders } }
        );
      }

      const seller = sellerResult.data;

      if (!seller.is_active) {
        return new Response(
          JSON.stringify({ success: false, error: 'Your seller account is inactive' }),
          { status: 403, headers: { 'Content-Type': 'application/json', ...corsHeaders } }
        );
      }

      if (seller.kyc_status !== 'APPROVED') {
        return new Response(
          JSON.stringify({
            success: false,
            error: 'Your KYC is not approved yet. Please complete KYC to add products.'
          }),
          { status: 403, headers: { 'Content-Type': 'application/json', ...corsHeaders } }
        );
      }

      // Generate PROD ID
      const prodId = generateProdId();

      // Validate images
      let processedImages = images || [];
      if (processedImages.length > 8) {
        return new Response(
          JSON.stringify({ success: false, error: 'Maximum 8 images allowed' }),
          { status: 400, headers: { 'Content-Type': 'application/json', ...corsHeaders } }
        );
      }

      // Limit tags to 3
      let finalTags = tags || [];
      if (finalTags.length > 3) {
        finalTags = finalTags.slice(0, 3);
      }

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
          tags: finalTags,
          images: processedImages,
          video_url: video_url || null,
          specifications: specifications || {},
          is_cod_available: is_cod_available !== false,
          min_cod_amount: min_cod_amount || 200,
          is_active: true,
          is_approved: false,
          created_at: new Date().toISOString(),
          barcode: `/api/barcode/generate?text=${prodId}`,
          qr_code: `/api/barcode/generate-qr?text=${prodId}`
        })
        .select();

      if (productInsert.error) {
        console.error('Product insert error:', productInsert.error);
        return new Response(
          JSON.stringify({ success: false, error: productInsert.error.message }),
          { status: 500, headers: { 'Content-Type': 'application/json', ...corsHeaders } }
        );
      }

      const product = productInsert.data;

      // Insert variations if provided
      if (variations && variations.length > 0) {
        const variationData = variations.map(v => ({
          prod_id: product.prod_id,
          size: v.size || null,
          color: v.color || null,
          material: v.material || null,
          sku: v.sku || `${product.prod_id}-${v.size || 'OS'}-${v.color || 'DF'}`,
          stock: v.stock || 0,
          price_adjustment: v.price_adjustment || 0,
          barcode: `/api/barcode/generate?text=${product.prod_id}-${v.size || 'OS'}`
        }));

        const variationInsert = await fetch(`${supabaseUrl}/rest/v1/product_variations`, {
          method: 'POST',
          headers: {
            'apikey': supabaseKey,
            'Authorization': `Bearer ${supabaseKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(variationData)
        });

        if (!variationInsert.ok) {
          console.error('Variation insert error:', await variationInsert.text());
        }
      }

      // Send notification to owner
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
          title: '🆕 New Product Pending Approval',
          message: `${seller.shop_name} added: ${name} (₹${selling_price})`,
          type: 'product',
          data: { prod_id: product.prod_id, seller_id, action: 'approve_product' },
          created_at: new Date().toISOString()
        })
      });

      return new Response(
        JSON.stringify({
          success: true,
          message: 'Product added successfully! Waiting for owner approval.',
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
        }),
        { status: 200, headers: { 'Content-Type': 'application/json', ...corsHeaders } }
      );

    } catch (error) {
      console.error('Add product error:', error);
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