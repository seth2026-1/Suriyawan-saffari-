// api/customer/wishlist.js
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
    'Access-Control-Allow-Methods': 'GET, POST, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version, Authorization',
  };

  // Handle OPTIONS preflight
  if (request.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: corsHeaders });
  }

  try {
    const supabase = createSupabaseClient();
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

    // =====================================================
    // GET WISHLIST
    // =====================================================
    if (request.method === 'GET') {
      const url = new URL(request.url);
      const cust_id = url.searchParams.get('cust_id');
      const folder = url.searchParams.get('folder');

      if (!cust_id) {
        return new Response(
          JSON.stringify({ success: false, error: 'Customer ID is required' }),
          { status: 400, headers: { 'Content-Type': 'application/json', ...corsHeaders } }
        );
      }

      const wishlistSelect = `*,
        products!inner (
          prod_id,
          name,
          description,
          selling_price,
          mrp,
          flash_price,
          flash_start,
          flash_end,
          stock,
          images,
          rating,
          total_sold,
          is_cod_available,
          sellers!inner (
            seller_id,
            shop_name,
            rating as seller_rating
          )
        )`;

      let wishlistUrl = `${supabaseUrl}/rest/v1/wishlist?select=${encodeURIComponent(wishlistSelect)}&cust_id=eq.${cust_id}&order=added_at.desc`;

      if (folder && folder !== 'all') {
        wishlistUrl += `&folder_name=eq.${folder}`;
      }

      const wishlistResponse = await fetch(wishlistUrl, {
        headers: {
          'apikey': supabaseKey,
          'Authorization': `Bearer ${supabaseKey}`,
        },
      });
      const wishlistItems = await wishlistResponse.json();

      // Get unique folder names
      const folders = [...new Set((wishlistItems || []).map(item => item.folder_name || 'Default').filter(Boolean))];

      const now = new Date();

      // Calculate current prices and discounts
      const formattedWishlist = (wishlistItems || []).map(item => {
        const product = item.products;

        // Determine current price (check flash sale)
        let currentPrice = product.selling_price;
        let isFlashSale = false;

        if (product.flash_price && product.flash_start && product.flash_end) {
          const flashStart = new Date(product.flash_start);
          const flashEnd = new Date(product.flash_end);

          if (now >= flashStart && now <= flashEnd) {
            currentPrice = product.flash_price;
            isFlashSale = true;
          }
        }

        const discountPercent = Math.round(((product.mrp - currentPrice) / product.mrp) * 100);
        const inStock = product.stock > 0;

        return {
          wish_id: item.wish_id,
          prod_id: product.prod_id,
          name: product.name,
          description: product.description,
          mrp: product.mrp,
          selling_price: product.selling_price,
          current_price: currentPrice,
          is_flash_sale: isFlashSale,
          discount_percent: discountPercent,
          image: product.images?.[0] || null,
          rating: product.rating || 0,
          total_sold: product.total_sold || 0,
          in_stock: inStock,
          is_cod_available: product.is_cod_available,
          seller: {
            seller_id: product.sellers?.seller_id,
            shop_name: product.sellers?.shop_name,
            rating: product.sellers?.seller_rating || 0
          },
          added_at: item.added_at,
          folder: item.folder_name || 'Default'
        };
      });

      // Get wishlist count
      const countUrl = `${supabaseUrl}/rest/v1/wishlist?cust_id=eq.${cust_id}&select=wish_id`;
      const countResponse = await fetch(countUrl, {
        method: 'HEAD',
        headers: {
          'apikey': supabaseKey,
          'Authorization': `Bearer ${supabaseKey}`,
        },
      });
      const totalCount = parseInt(countResponse.headers.get('content-range')?.split('/')[1] || '0');

      return new Response(
        JSON.stringify({
          success: true,
          wishlist: formattedWishlist,
          folders: ['Default', ...folders.filter(f => f !== 'Default')],
          total_items: totalCount,
          stats: {
            total: formattedWishlist.length,
            in_stock: formattedWishlist.filter(item => item.in_stock).length,
            out_of_stock: formattedWishlist.filter(item => !item.in_stock).length,
            on_sale: formattedWishlist.filter(item => item.discount_percent > 20).length
          }
        }),
        { status: 200, headers: { 'Content-Type': 'application/json', ...corsHeaders } }
      );
    }

    // =====================================================
    // ADD TO WISHLIST (POST)
    // =====================================================
    if (request.method === 'POST') {
      const body = await request.json();
      const { cust_id, prod_id, folder_name } = body;

      if (!cust_id || !prod_id) {
        return new Response(
          JSON.stringify({ success: false, error: 'Customer ID and Product ID are required' }),
          { status: 400, headers: { 'Content-Type': 'application/json', ...corsHeaders } }
        );
      }

      // Check if product exists and is active
      const productUrl = `${supabaseUrl}/rest/v1/products?prod_id=eq.${prod_id}&select=prod_id,name,is_active,is_approved`;
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

      if (!product.is_active || !product.is_approved) {
        return new Response(
          JSON.stringify({ success: false, error: 'Product is not available' }),
          { status: 400, headers: { 'Content-Type': 'application/json', ...corsHeaders } }
        );
      }

      // Check if already in wishlist
      const existingUrl = `${supabaseUrl}/rest/v1/wishlist?cust_id=eq.${cust_id}&prod_id=eq.${prod_id}&select=wish_id`;
      const existingResponse = await fetch(existingUrl, {
        headers: {
          'apikey': supabaseKey,
          'Authorization': `Bearer ${supabaseKey}`,
        },
      });
      const existingData = await existingResponse.json();
      const existing = existingData[0];

      if (existing) {
        return new Response(
          JSON.stringify({
            success: true,
            message: 'Product already in wishlist',
            already_exists: true,
            wish_id: existing.wish_id
          }),
          { status: 200, headers: { 'Content-Type': 'application/json', ...corsHeaders } }
        );
      }

      // Add to wishlist
      const insertResponse = await fetch(`${supabaseUrl}/rest/v1/wishlist`, {
        method: 'POST',
        headers: {
          'apikey': supabaseKey,
          'Authorization': `Bearer ${supabaseKey}`,
          'Content-Type': 'application/json',
          'Prefer': 'return=representation'
        },
        body: JSON.stringify({
          cust_id,
          prod_id,
          folder_name: folder_name || 'Default',
          added_at: new Date().toISOString()
        })
      });
      
      const insertData = await insertResponse.json();
      const newWishlist = insertData[0];

      if (!newWishlist) {
        return new Response(
          JSON.stringify({ success: false, error: 'Failed to add to wishlist' }),
          { status: 500, headers: { 'Content-Type': 'application/json', ...corsHeaders } }
        );
      }

      // Get updated wishlist count
      const countUrl = `${supabaseUrl}/rest/v1/wishlist?cust_id=eq.${cust_id}&select=wish_id`;
      const countResponse = await fetch(countUrl, {
        method: 'HEAD',
        headers: {
          'apikey': supabaseKey,
          'Authorization': `Bearer ${supabaseKey}`,
        },
      });
      const totalCount = parseInt(countResponse.headers.get('content-range')?.split('/')[1] || '0');

      return new Response(
        JSON.stringify({
          success: true,
          message: 'Product added to wishlist',
          wish_id: newWishlist.wish_id,
          wishlist_count: totalCount
        }),
        { status: 200, headers: { 'Content-Type': 'application/json', ...corsHeaders } }
      );
    }

    // =====================================================
    // REMOVE FROM WISHLIST (DELETE)
    // =====================================================
    if (request.method === 'DELETE') {
      const url = new URL(request.url);
      const wish_id = url.searchParams.get('wish_id');
      const cust_id = url.searchParams.get('cust_id');
      const prod_id = url.searchParams.get('prod_id');

      if (!wish_id && (!cust_id || !prod_id)) {
        return new Response(
          JSON.stringify({ success: false, error: 'Wishlist ID or (Customer ID + Product ID) is required' }),
          { status: 400, headers: { 'Content-Type': 'application/json', ...corsHeaders } }
        );
      }

      let targetWishId = wish_id;

      // If wish_id not provided, find it
      if (!targetWishId && cust_id && prod_id) {
        const findUrl = `${supabaseUrl}/rest/v1/wishlist?cust_id=eq.${cust_id}&prod_id=eq.${prod_id}&select=wish_id`;
        const findResponse = await fetch(findUrl, {
          headers: {
            'apikey': supabaseKey,
            'Authorization': `Bearer ${supabaseKey}`,
          },
        });
        const findData = await findResponse.json();
        const wishItem = findData[0];

        if (!wishItem) {
          return new Response(
            JSON.stringify({ success: false, error: 'Wishlist item not found' }),
            { status: 404, headers: { 'Content-Type': 'application/json', ...corsHeaders } }
          );
        }

        targetWishId = wishItem.wish_id;
      }

      await fetch(`${supabaseUrl}/rest/v1/wishlist?wish_id=eq.${targetWishId}`, {
        method: 'DELETE',
        headers: {
          'apikey': supabaseKey,
          'Authorization': `Bearer ${supabaseKey}`,
        },
      });

      // Get updated wishlist count
      let totalCount = 0;
      if (cust_id) {
        const countUrl = `${supabaseUrl}/rest/v1/wishlist?cust_id=eq.${cust_id}&select=wish_id`;
        const countResponse = await fetch(countUrl, {
          method: 'HEAD',
          headers: {
            'apikey': supabaseKey,
            'Authorization': `Bearer ${supabaseKey}`,
          },
        });
        totalCount = parseInt(countResponse.headers.get('content-range')?.split('/')[1] || '0');
      }

      return new Response(
        JSON.stringify({
          success: true,
          message: 'Product removed from wishlist',
          wishlist_count: totalCount
        }),
        { status: 200, headers: { 'Content-Type': 'application/json', ...corsHeaders } }
      );
    }

    return new Response(
      JSON.stringify({ success: false, error: 'Method not allowed' }),
      { status: 405, headers: { 'Content-Type': 'application/json', ...corsHeaders } }
    );

  } catch (error) {
    console.error('Wishlist error:', error);
    return new Response(
      JSON.stringify({ success: false, error: error.message || 'Internal server error' }),
      { status: 500, headers: { 'Content-Type': 'application/json', ...corsHeaders } }
    );
  }
}