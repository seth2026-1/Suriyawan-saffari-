// api/customer/products.js
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
            not: (notField, operator, notValue) => ({
              lt: (ltField, ltValue) => ({
                gt: (gtField, gtValue) => ({
                  order: (orderField, { ascending }) => {
                    const sortOrder = ascending ? 'asc' : 'desc';
                    return {
                      range: async (from, to) => {
                        let finalUrl = `${url}&${field}=eq.${value}&${notField}=${operator}.${notValue}&${ltField}=lt.${ltValue}&${gtField}=gt.${gtValue}&order=${orderField}.${sortOrder}`;
                        finalUrl += `&offset=${from}&limit=${to - from + 1}`;
                        const response = await fetch(finalUrl, {
                          headers: {
                            'apikey': supabaseKey,
                            'Authorization': `Bearer ${supabaseKey}`,
                          },
                        });
                        const data = await response.json();
                        const count = response.headers.get('content-range')?.split('/')[1];
                        return { data, error: null, count: count ? parseInt(count) : null };
                      }
                    };
                  }
                })
              })
            }),
            contains: (containsField, containsValue) => ({
              order: (orderField, { ascending }) => {
                const sortOrder = ascending ? 'asc' : 'desc';
                return {
                  range: async (from, to) => {
                    let finalUrl = `${url}&${field}=eq.${value}&${containsField}=cs.{${containsValue.join(',')}}&order=${orderField}.${sortOrder}`;
                    finalUrl += `&offset=${from}&limit=${to - from + 1}`;
                    const response = await fetch(finalUrl, {
                      headers: {
                        'apikey': supabaseKey,
                        'Authorization': `Bearer ${supabaseKey}`,
                      },
                    });
                    const data = await response.json();
                    const count = response.headers.get('content-range')?.split('/')[1];
                    return { data, error: null, count: count ? parseInt(count) : null };
                  }
                };
              }
            }),
            gte: (gteField, gteValue) => ({
              order: (orderField, { ascending }) => {
                const sortOrder = ascending ? 'asc' : 'desc';
                return {
                  range: async (from, to) => {
                    let finalUrl = `${url}&${field}=eq.${value}&${gteField}=gte.${gteValue}&order=${orderField}.${sortOrder}`;
                    finalUrl += `&offset=${from}&limit=${to - from + 1}`;
                    const response = await fetch(finalUrl, {
                      headers: {
                        'apikey': supabaseKey,
                        'Authorization': `Bearer ${supabaseKey}`,
                      },
                    });
                    const data = await response.json();
                    const count = response.headers.get('content-range')?.split('/')[1];
                    return { data, error: null, count: count ? parseInt(count) : null };
                  }
                };
              }
            })
          }),
          eq: (field, value) => ({
            gte: (gteField, gteValue) => ({
              lte: (lteField, lteValue) => ({
                order: (orderField, { ascending }) => {
                  const sortOrder = ascending ? 'asc' : 'desc';
                  return {
                    range: async (from, to) => {
                      let finalUrl = `${url}&${field}=eq.${value}&${gteField}=gte.${gteValue}&${lteField}=lte.${lteValue}&order=${orderField}.${sortOrder}`;
                      finalUrl += `&offset=${from}&limit=${to - from + 1}`;
                      const response = await fetch(finalUrl, {
                        headers: {
                          'apikey': supabaseKey,
                          'Authorization': `Bearer ${supabaseKey}`,
                        },
                      });
                      const data = await response.json();
                      const count = response.headers.get('content-range')?.split('/')[1];
                      return { data, error: null, count: count ? parseInt(count) : null };
                    }
                  };
                }
              })
            }),
            gt: (gtField, gtValue) => ({
              order: (orderField, { ascending }) => {
                const sortOrder = ascending ? 'asc' : 'desc';
                return {
                  range: async (from, to) => {
                    let finalUrl = `${url}&${field}=eq.${value}&${gtField}=gt.${gtValue}&order=${orderField}.${sortOrder}`;
                    finalUrl += `&offset=${from}&limit=${to - from + 1}`;
                    const response = await fetch(finalUrl, {
                      headers: {
                        'apikey': supabaseKey,
                        'Authorization': `Bearer ${supabaseKey}`,
                      },
                    });
                    const data = await response.json();
                    const count = response.headers.get('content-range')?.split('/')[1];
                    return { data, error: null, count: count ? parseInt(count) : null };
                  }
                };
              }
            }),
            not: (notField, operator, notValue) => ({
              lt: (ltField, ltValue) => ({
                gt: (gtField, gtValue) => ({
                  order: (orderField, { ascending }) => {
                    const sortOrder = ascending ? 'asc' : 'desc';
                    return {
                      range: async (from, to) => {
                        let finalUrl = `${url}&${field}=eq.${value}&${notField}=${operator}.${notValue}&${ltField}=lt.${ltValue}&${gtField}=gt.${gtValue}&order=${orderField}.${sortOrder}`;
                        finalUrl += `&offset=${from}&limit=${to - from + 1}`;
                        const response = await fetch(finalUrl, {
                          headers: {
                            'apikey': supabaseKey,
                            'Authorization': `Bearer ${supabaseKey}`,
                          },
                        });
                        const data = await response.json();
                        const count = response.headers.get('content-range')?.split('/')[1];
                        return { data, error: null, count: count ? parseInt(count) : null };
                      }
                    };
                  }
                })
              })
            }),
            contains: (containsField, containsValue) => ({
              order: (orderField, { ascending }) => {
                const sortOrder = ascending ? 'asc' : 'desc';
                return {
                  range: async (from, to) => {
                    let finalUrl = `${url}&${field}=eq.${value}&${containsField}=cs.{${containsValue.join(',')}}&order=${orderField}.${sortOrder}`;
                    finalUrl += `&offset=${from}&limit=${to - from + 1}`;
                    const response = await fetch(finalUrl, {
                      headers: {
                        'apikey': supabaseKey,
                        'Authorization': `Bearer ${supabaseKey}`,
                      },
                    });
                    const data = await response.json();
                    const count = response.headers.get('content-range')?.split('/')[1];
                    return { data, error: null, count: count ? parseInt(count) : null };
                  }
                };
              }
            }),
            gte: (gteField, gteValue) => ({
              order: (orderField, { ascending }) => {
                const sortOrder = ascending ? 'asc' : 'desc';
                return {
                  range: async (from, to) => {
                    let finalUrl = `${url}&${field}=eq.${value}&${gteField}=gte.${gteValue}&order=${orderField}.${sortOrder}`;
                    finalUrl += `&offset=${from}&limit=${to - from + 1}`;
                    const response = await fetch(finalUrl, {
                      headers: {
                        'apikey': supabaseKey,
                        'Authorization': `Bearer ${supabaseKey}`,
                      },
                    });
                    const data = await response.json();
                    const count = response.headers.get('content-range')?.split('/')[1];
                    return { data, error: null, count: count ? parseInt(count) : null };
                  }
                };
              }
            }),
            lte: (lteField, lteValue) => ({
              order: (orderField, { ascending }) => {
                const sortOrder = ascending ? 'asc' : 'desc';
                return {
                  range: async (from, to) => {
                    let finalUrl = `${url}&${field}=eq.${value}&${lteField}=lte.${lteValue}&order=${orderField}.${sortOrder}`;
                    finalUrl += `&offset=${from}&limit=${to - from + 1}`;
                    const response = await fetch(finalUrl, {
                      headers: {
                        'apikey': supabaseKey,
                        'Authorization': `Bearer ${supabaseKey}`,
                      },
                    });
                    const data = await response.json();
                    const count = response.headers.get('content-range')?.split('/')[1];
                    return { data, error: null, count: count ? parseInt(count) : null };
                  }
                };
              }
            }),
            order: (orderField, { ascending }) => {
              const sortOrder = ascending ? 'asc' : 'desc';
              return {
                range: async (from, to) => {
                  let finalUrl = `${url}&${field}=eq.${value}&order=${orderField}.${sortOrder}`;
                  
                  // Add or condition for search
                  if (options.or) {
                    finalUrl += `&or=${options.or}`;
                  }
                  
                  finalUrl += `&offset=${from}&limit=${to - from + 1}`;
                  const response = await fetch(finalUrl, {
                    headers: {
                      'apikey': supabaseKey,
                      'Authorization': `Bearer ${supabaseKey}`,
                    },
                  });
                  const data = await response.json();
                  const count = response.headers.get('content-range')?.split('/')[1];
                  return { data, error: null, count: count ? parseInt(count) : null };
                }
              };
            }
          }),
          or: (condition) => ({
            order: (orderField, { ascending }) => ({
              range: async (from, to) => {
                const sortOrder = ascending ? 'asc' : 'desc';
                const finalUrl = `${url}&or=${condition}&order=${orderField}.${sortOrder}&offset=${from}&limit=${to - from + 1}`;
                const response = await fetch(finalUrl, {
                  headers: {
                    'apikey': supabaseKey,
                    'Authorization': `Bearer ${supabaseKey}`,
                  },
                });
                const data = await response.json();
                const count = response.headers.get('content-range')?.split('/')[1];
                return { data, error: null, count: count ? parseInt(count) : null };
              }
            })
          })
        };
      }
    })
  };
}

// Helper function to generate Product ID
function generateProdId() {
  const date = new Date();
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  const random = Math.random().toString(36).substring(2, 6).toUpperCase();
  const timestamp = Date.now().toString().slice(-4);
  return `PRD${year}${month}${day}${timestamp}${random}`;
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
    const category = url.searchParams.get('category');
    const subcategory = url.searchParams.get('subcategory');
    const search = url.searchParams.get('search');
    const sort = url.searchParams.get('sort');
    const min_price = url.searchParams.get('min_price');
    const max_price = url.searchParams.get('max_price');
    const rating = url.searchParams.get('rating');
    const tags = url.searchParams.get('tags');
    const page = parseInt(url.searchParams.get('page') || '1');
    const limit = parseInt(url.searchParams.get('limit') || '20');
    const type = url.searchParams.get('type');

    // Build product select with joins
    const productSelect = `*,
      sellers!inner (
        seller_id,
        shop_name,
        rating as seller_rating
      ),
      categories!inner (
        cat_id,
        name
      )`;

    let productsUrl = `${supabaseUrl}/rest/v1/products?select=${encodeURIComponent(productSelect)}&is_active=eq.true&is_approved=eq.true`;

    // Filter by category
    if (category && category !== 'all') {
      if (category === 'live') {
        productsUrl += `&is_live=eq.true`;
      } else if (category === 'flash') {
        const now = new Date().toISOString();
        productsUrl += `&flash_price=not.is.null&flash_start=lt.${now}&flash_end=gt.${now}`;
      } else if (category === 'trending') {
        productsUrl += `&tags=cs.{Trending,Viral}`;
      } else if (category === 'bestseller') {
        productsUrl += `&total_sold=gt.100`;
      } else if (category === 'seasonal') {
        productsUrl += `&tags=cs.{Seasonal,Festival}`;
      } else {
        // Get category by slug or name
        const catUrl = `${supabaseUrl}/rest/v1/categories?or=(slug.eq.${category},name.ilike.%25${category}%25)&select=cat_id`;
        const catResponse = await fetch(catUrl, {
          headers: {
            'apikey': supabaseKey,
            'Authorization': `Bearer ${supabaseKey}`,
          },
        });
        const catData = await catResponse.json();
        const catItem = catData[0];

        if (catItem) {
          productsUrl += `&category_id=eq.${catItem.cat_id}`;
        }
      }
    }

    // Filter by subcategory
    if (subcategory) {
      const subCatUrl = `${supabaseUrl}/rest/v1/categories?or=(slug.eq.${subcategory},name.ilike.%25${subcategory}%25)&select=cat_id`;
      const subCatResponse = await fetch(subCatUrl, {
        headers: {
          'apikey': supabaseKey,
          'Authorization': `Bearer ${supabaseKey}`,
        },
      });
      const subCatData = await subCatResponse.json();
      const subCatItem = subCatData[0];

      if (subCatItem) {
        productsUrl += `&sub_category_id=eq.${subCatItem.cat_id}`;
      }
    }

    // Search by name or description
    if (search) {
      productsUrl += `&or=(name.ilike.%25${search}%25,description.ilike.%25${search}%25)`;
    }

    // Filter by price range
    if (min_price) {
      productsUrl += `&selling_price=gte.${parseInt(min_price)}`;
    }
    if (max_price) {
      productsUrl += `&selling_price=lte.${parseInt(max_price)}`;
    }

    // Filter by rating
    if (rating) {
      productsUrl += `&rating=gte.${parseFloat(rating)}`;
    }

    // Filter by tags
    if (tags) {
      const tagArray = tags.split(',');
      productsUrl += `&tags=cs.{${tagArray.join(',')}}`;
    }

    // Filter by type
    if (type === 'flash_sale') {
      const now = new Date().toISOString();
      productsUrl += `&flash_price=not.is.null&flash_start=lt.${now}&flash_end=gt.${now}`;
    }
    if (type === 'new_arrival') {
      const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
      productsUrl += `&created_at=gte.${weekAgo}`;
    }

    // Sorting
    switch (sort) {
      case 'price_asc':
        productsUrl += `&order=selling_price.asc`;
        break;
      case 'price_desc':
        productsUrl += `&order=selling_price.desc`;
        break;
      case 'rating':
        productsUrl += `&order=rating.desc`;
        break;
      case 'newest':
        productsUrl += `&order=created_at.desc`;
        break;
      case 'popular':
        productsUrl += `&order=total_sold.desc`;
        break;
      case 'discount':
        // For discount sorting, we'll sort after fetching
        productsUrl += `&order=created_at.desc`;
        break;
      default:
        productsUrl += `&order=created_at.desc`;
    }

    // Pagination
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

    // Calculate discount percentage for each product and handle discount sorting
    let productsWithDiscount = products.map(product => {
      const now = new Date();
      const isFlashActive = product.flash_price && 
        product.flash_start && new Date(product.flash_start) <= now && 
        product.flash_end && new Date(product.flash_end) >= now;
      
      return {
        ...product,
        discount_percent: Math.round(((product.mrp - product.selling_price) / product.mrp) * 100),
        flash_discount: product.flash_price ? Math.round(((product.mrp - product.flash_price) / product.mrp) * 100) : null,
        current_price: isFlashActive ? product.flash_price : product.selling_price,
        prod_id: product.prod_id || generateProdId()
      };
    });

    // Apply discount sorting if selected
    if (sort === 'discount') {
      productsWithDiscount.sort((a, b) => b.discount_percent - a.discount_percent);
    }

    // Get featured products for homepage
    let featuredProducts = [];
    if (type === 'featured') {
      featuredProducts = productsWithDiscount.slice(0, 10);
    }

    return new Response(
      JSON.stringify({
        success: true,
        products: productsWithDiscount,
        featured: featuredProducts,
        pagination: {
          current_page: page,
          total_pages: Math.ceil(count / limit),
          total_items: count,
          items_per_page: limit
        }
      }),
      { status: 200, headers: { 'Content-Type': 'application/json', ...corsHeaders } }
    );

  } catch (error) {
    console.error('Products API error:', error);
    return new Response(
      JSON.stringify({
        success: false,
        error: error.message || 'Internal server error'
      }),
      { status: 500, headers: { 'Content-Type': 'application/json', ...corsHeaders } }
    );
  }
}