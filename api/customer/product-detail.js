// api/customer/product-detail.js
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
            neq: (neqField, neqValue) => ({
              limit: async (limit) => {
                const finalUrl = `${url}&${field}=eq.${value}&${neqField}=neq.${neqValue}&limit=${limit}`;
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
            neq: (neqField, neqValue) => ({
              limit: async (limit) => {
                const finalUrl = `${url}&${field}=eq.${value}&${neqField}=neq.${neqValue}&limit=${limit}`;
                const response = await fetch(finalUrl, {
                  headers: {
                    'apikey': supabaseKey,
                    'Authorization': `Bearer ${supabaseKey}`,
                  },
                });
                const data = await response.json();
                return { data, error: null };
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
      })
    })
  };
}

export default async function handler(request) {
  // CORS Headers
  const corsHeaders = {
    'Access-Control-Allow-Credentials': 'true',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, OPTIONS',
    'Access-Control-Allow-Headers': 'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version, Authorization',
  };

  // Handle OPTIONS preflight
  if (request.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: corsHeaders });
  }

  // Only allow GET
  if (request.method !== 'GET') {
    return new Response(
      JSON.stringify({ success: false, error: 'Method not allowed' }),
      { status: 405, headers: { 'Content-Type': 'application/json', ...corsHeaders } }
    );
  }

  try {
    const supabase = createSupabaseClient();
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

    const url = new URL(request.url);
    const prod_id = url.searchParams.get('prod_id');
    const slug = url.searchParams.get('slug');

    if (!prod_id && !slug) {
      return new Response(
        JSON.stringify({ success: false, error: 'Product ID or slug is required' }),
        { status: 400, headers: { 'Content-Type': 'application/json', ...corsHeaders } }
      );
    }

    // Build product query with nested joins
    const productSelect = `*,
      sellers!inner (
        seller_id,
        shop_name,
        owner_name,
        email,
        mobile,
        rating as seller_rating,
        total_sales,
        kyc_status,
        is_active as seller_active
      ),
      categories!inner (
        cat_id,
        name,
        slug as category_slug
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

    let productUrl = `${supabaseUrl}/rest/v1/products?select=${encodeURIComponent(productSelect)}&is_active=eq.true&is_approved=eq.true`;

    if (prod_id) {
      productUrl += `&prod_id=eq.${prod_id}`;
    } else if (slug) {
      productUrl += `&slug=eq.${slug}`;
    }

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
        JSON.stringify({ success: false, error: 'Product not found' }),
        { status: 404, headers: { 'Content-Type': 'application/json', ...corsHeaders } }
      );
    }

    // Get current product data for updating views
    const currentViewsUrl = `${supabaseUrl}/rest/v1/products?prod_id=eq.${product.prod_id}&select=total_views`;
    const currentViewsResponse = await fetch(currentViewsUrl, {
      headers: {
        'apikey': supabaseKey,
        'Authorization': `Bearer ${supabaseKey}`,
      },
    });
    const currentViewsData = await currentViewsResponse.json();
    const currentViews = currentViewsData[0]?.total_views || 0;

    // Increment view count
    await fetch(`${supabaseUrl}/rest/v1/products?prod_id=eq.${product.prod_id}`, {
      method: 'PATCH',
      headers: {
        'apikey': supabaseKey,
        'Authorization': `Bearer ${supabaseKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ total_views: currentViews + 1 })
    });

    // Get product reviews with customer info
    const reviewsSelect = `*,
      customers (
        cust_id,
        name,
        photo
      )`;
    const reviewsUrl = `${supabaseUrl}/rest/v1/reviews?select=${encodeURIComponent(reviewsSelect)}&prod_id=eq.${product.prod_id}&order=created_at.desc&limit=20`;
    const reviewsResponse = await fetch(reviewsUrl, {
      headers: {
        'apikey': supabaseKey,
        'Authorization': `Bearer ${supabaseKey}`,
      },
    });
    const reviews = await reviewsResponse.json();

    // Get related products (same category)
    const relatedSelect = `prod_id,name,selling_price,mrp,images,rating,total_sold`;
    const relatedUrl = `${supabaseUrl}/rest/v1/products?select=${encodeURIComponent(relatedSelect)}&category_id=eq.${product.category_id}&is_active=eq.true&is_approved=eq.true&prod_id=neq.${product.prod_id}&limit=10`;
    const relatedResponse = await fetch(relatedUrl, {
      headers: {
        'apikey': supabaseKey,
        'Authorization': `Bearer ${supabaseKey}`,
      },
    });
    const relatedProducts = await relatedResponse.json();

    // Get seller's other products
    const sellerSelect = `prod_id,name,selling_price,mrp,images,rating`;
    const sellerUrl = `${supabaseUrl}/rest/v1/products?select=${encodeURIComponent(sellerSelect)}&seller_id=eq.${product.seller_id}&is_active=eq.true&is_approved=eq.true&prod_id=neq.${product.prod_id}&limit=5`;
    const sellerResponse = await fetch(sellerUrl, {
      headers: {
        'apikey': supabaseKey,
        'Authorization': `Bearer ${supabaseKey}`,
      },
    });
    const sellerProducts = await sellerResponse.json();

    // Calculate discount percentages
    const discountPercent = Math.round(((product.mrp - product.selling_price) / product.mrp) * 100);
    const flashDiscount = product.flash_price ? 
      Math.round(((product.mrp - product.flash_price) / product.mrp) * 100) : null;

    const now = new Date();
    const isFlashSale = product.flash_price && 
      product.flash_start && new Date(product.flash_start) <= now && 
      product.flash_end && new Date(product.flash_end) >= now;

    const currentPrice = isFlashSale ? product.flash_price : product.selling_price;

    // Calculate flash sale end time in seconds
    let flashEndsIn = null;
    if (isFlashSale && product.flash_end) {
      flashEndsIn = Math.max(0, Math.floor((new Date(product.flash_end) - now) / 1000));
    }

    // Get stock status
    let stockStatus = 'in_stock';
    if (product.stock <= 0) {
      stockStatus = 'out_of_stock';
    } else if (product.stock <= 5) {
      stockStatus = 'low_stock';
    }

    // Calculate rating distribution
    const ratingDistribution = { 5: 0, 4: 0, 3: 0, 2: 0, 1: 0 };
    let totalRating = 0;

    if (reviews && reviews.length > 0) {
      reviews.forEach(review => {
        if (review.rating >= 1 && review.rating <= 5) {
          ratingDistribution[review.rating]++;
          totalRating += review.rating;
        }
      });
    }

    const averageRating = reviews && reviews.length > 0 ? 
      (totalRating / reviews.length).toFixed(1) : product.rating || 0;

    // Prepare related products with discounts
    const relatedWithDiscount = (relatedProducts || []).map(rel => ({
      ...rel,
      discount_percent: Math.round(((rel.mrp - rel.selling_price) / rel.mrp) * 100),
      current_price: rel.selling_price,
      image: rel.images?.[0] || null
    }));

    // Prepare variations with final prices
    const variationsWithPrice = (product.product_variations || []).map(varItem => ({
      var_id: varItem.var_id,
      size: varItem.size,
      color: varItem.color,
      material: varItem.material,
      sku: varItem.sku,
      stock: varItem.stock,
      price_adjustment: varItem.price_adjustment,
      final_price: currentPrice + (varItem.price_adjustment || 0),
      original_price: product.mrp + (varItem.price_adjustment || 0)
    }));

    // Prepare response
    const responseData = {
      success: true,
      product: {
        prod_id: product.prod_id,
        name: product.name,
        slug: product.slug,
        description: product.description,
        short_description: product.short_description,
        mrp: product.mrp,
        selling_price: product.selling_price,
        flash_price: product.flash_price,
        current_price: currentPrice,
        discount_percent: discountPercent,
        flash_discount: flashDiscount,
        is_flash_sale: isFlashSale,
        flash_ends_in: flashEndsIn,
        stock: product.stock,
        stock_status: stockStatus,
        images: product.images || [],
        video_url: product.video_url,
        tags: product.tags || [],
        specifications: product.specifications || {},
        rating: parseFloat(averageRating),
        total_reviews: reviews?.length || 0,
        total_sold: product.total_sold || 0,
        total_views: (currentViews + 1) || 0,
        is_cod_available: product.is_cod_available,
        min_cod_amount: product.min_cod_amount,
        category_id: product.category_id,
        category_name: product.categories?.name,
        category_slug: product.categories?.category_slug,
        sub_category_id: product.sub_category_id,
        created_at: product.created_at,
        variations: variationsWithPrice,
        seller: {
          seller_id: product.sellers?.seller_id,
          shop_name: product.sellers?.shop_name,
          owner_name: product.sellers?.owner_name,
          rating: product.sellers?.seller_rating || 0,
          total_sales: product.sellers?.total_sales || 0,
          is_verified: product.sellers?.kyc_status === 'APPROVED',
          other_products: (sellerProducts || []).map(sp => ({
            prod_id: sp.prod_id,
            name: sp.name,
            price: sp.selling_price,
            mrp: sp.mrp,
            discount: Math.round(((sp.mrp - sp.selling_price) / sp.mrp) * 100),
            image: sp.images?.[0] || null,
            rating: sp.rating
          }))
        }
      },
      reviews: (reviews || []).map(review => ({
        review_id: review.review_id,
        rating: review.rating,
        title: review.title,
        comment: review.comment,
        photo: review.photo,
        customer_name: review.customers?.name,
        customer_photo: review.customers?.photo,
        created_at: review.created_at
      })),
      rating_distribution: ratingDistribution,
      related_products: relatedWithDiscount,
      barcode_url: `/api/barcode/generate?text=${product.prod_id}`,
      qr_url: `/api/barcode/generate-qr?text=${product.prod_id}`
    };

    return new Response(
      JSON.stringify(responseData),
      { status: 200, headers: { 'Content-Type': 'application/json', ...corsHeaders } }
    );

  } catch (error) {
    console.error('Product detail error:', error);
    return new Response(
      JSON.stringify({ success: false, error: error.message || 'Internal server error' }),
      { status: 500, headers: { 'Content-Type': 'application/json', ...corsHeaders } }
    );
  }
}