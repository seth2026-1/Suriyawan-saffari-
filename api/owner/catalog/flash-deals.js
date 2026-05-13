// api/owner/catalog/flash-deals.js
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

          if (queryModifiers.gte) {
            const [field, value] = Object.entries(queryModifiers.gte)[0];
            finalUrl += `${finalUrl.includes('?') ? '&' : '?'}${field}=gte.${value}`;
          }

          if (queryModifiers.gt) {
            const [field, value] = Object.entries(queryModifiers.gt)[0];
            finalUrl += `${finalUrl.includes('?') ? '&' : '?'}${field}=gt.${value}`;
          }

          if (queryModifiers.lt) {
            const [field, value] = Object.entries(queryModifiers.lt)[0];
            finalUrl += `${finalUrl.includes('?') ? '&' : '?'}${field}=lt.${value}`;
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
            not: (notField, operator, notValue) => ({
              lte: (lteField, lteValue) => ({
                gte: (gteField, gteValue) => ({
                  order: (orderField, { ascending }) => ({
                    range: async (from, to) => {
                      const result = await execute({
                        eq: { [field]: value },
                        not: { field: notField, operator, value: notValue },
                        lte: { [lteField]: lteValue },
                        gte: { [gteField]: gteValue },
                        order: { field: orderField, ascending },
                        range: { from, to }
                      });
                      return result;
                    }
                  })
                })
              })
            }),
            lte: (lteField, lteValue) => ({
              gte: (gteField, gteValue) => ({
                order: (orderField, { ascending }) => ({
                  range: async (from, to) => {
                    const result = await execute({
                      eq: { [field]: value },
                      lte: { [lteField]: lteValue },
                      gte: { [gteField]: gteValue },
                      order: { field: orderField, ascending },
                      range: { from, to }
                    });
                    return result;
                  }
                })
              })
            }),
            gt: (gtField, gtValue) => ({
              lt: (ltField, ltValue) => ({
                order: (orderField, { ascending }) => ({
                  range: async (from, to) => {
                    const result = await execute({
                      eq: { [field]: value },
                      gt: { [gtField]: gtValue },
                      lt: { [ltField]: ltValue },
                      order: { field: orderField, ascending },
                      range: { from, to }
                    });
                    return result;
                  }
                })
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

function getFlashStatus(start, end) {
  const now = new Date();
  const startDate = new Date(start);
  const endDate = new Date(end);

  if (now < startDate) return 'upcoming';
  if (now > endDate) return 'expired';
  return 'active';
}

function getTimeRemaining(end) {
  const endDate = new Date(end);
  const now = new Date();
  const diff = endDate - now;

  if (diff <= 0) return null;

  const hours = Math.floor(diff / (1000 * 60 * 60));
  const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
  const seconds = Math.floor((diff % (1000 * 60)) / 1000);

  return { hours, minutes, seconds, total: diff };
}

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
  const supabase = createSupabaseClient();
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  // =====================================================
  // GET FLASH DEALS
  // =====================================================
  if (request.method === 'GET') {
    try {
      const status = url.searchParams.get('status');
      const page = parseInt(url.searchParams.get('page') || '1');
      const limit = parseInt(url.searchParams.get('limit') || '20');

      const now = new Date().toISOString();

      const flashSelect = `prod_id,name,mrp,selling_price,flash_price,flash_start,flash_end,stock,images,seller_id,sellers!inner(shop_name,rating)`;
      let flashUrl = `${supabaseUrl}/rest/v1/products?select=${encodeURIComponent(flashSelect)}&flash_price=not.is.null&order=flash_start.desc`;

      if (status === 'active') {
        flashUrl += `&flash_start=lte.${now}&flash_end=gte.${now}`;
      } else if (status === 'upcoming') {
        flashUrl += `&flash_start=gt.${now}`;
      } else if (status === 'expired') {
        flashUrl += `&flash_end=lt.${now}`;
      }

      const from = (page - 1) * limit;
      const to = from + limit - 1;
      flashUrl += `&offset=${from}&limit=${limit}`;

      const flashResponse = await fetch(flashUrl, {
        headers: {
          'apikey': supabaseKey,
          'Authorization': `Bearer ${supabaseKey}`,
        },
      });
      const products = await flashResponse.json();
      const count = parseInt(flashResponse.headers.get('content-range')?.split('/')[1] || '0');

      // Get statistics
      const allFlashUrl = `${supabaseUrl}/rest/v1/products?select=mrp,flash_price,flash_start,flash_end&flash_price=not.is.null`;
      const allFlashResponse = await fetch(allFlashUrl, {
        headers: {
          'apikey': supabaseKey,
          'Authorization': `Bearer ${supabaseKey}`,
        },
      });
      const allFlashProducts = await allFlashResponse.json();

      const nowDate = new Date();
      const stats = {
        total: allFlashProducts?.length || 0,
        active: allFlashProducts?.filter(p => 
          new Date(p.flash_start) <= nowDate && new Date(p.flash_end) >= nowDate
        ).length || 0,
        upcoming: allFlashProducts?.filter(p => new Date(p.flash_start) > nowDate).length || 0,
        expired: allFlashProducts?.filter(p => new Date(p.flash_end) < nowDate).length || 0,
        total_discount_value: allFlashProducts?.reduce((sum, p) => 
          sum + ((p.mrp - p.flash_price) || 0), 0) || 0
      };

      return new Response(JSON.stringify({
        success: true,
        flash_deals: products?.map(p => ({
          prod_id: p.prod_id,
          name: p.name,
          mrp: p.mrp,
          selling_price: p.selling_price,
          flash_price: p.flash_price,
          discount_percent: Math.round(((p.mrp - p.flash_price) / p.mrp) * 100),
          flash_start: p.flash_start,
          flash_end: p.flash_end,
          stock: p.stock,
          image: p.images?.[0] || null,
          seller_name: p.sellers?.shop_name,
          status: getFlashStatus(p.flash_start, p.flash_end),
          time_remaining: getTimeRemaining(p.flash_end)
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
      console.error('Get flash deals error:', error);
      return new Response(JSON.stringify({ success: false, error: error.message }), {
        status: 500,
        headers: { 'Content-Type': 'application/json', ...corsHeaders }
      });
    }
  }

  // =====================================================
  // CREATE FLASH DEAL (POST)
  // =====================================================
  if (request.method === 'POST') {
    try {
      const body = await request.json();
      const {
        prod_id,
        flash_price,
        flash_start,
        flash_end,
        max_quantity
      } = body;

      if (!prod_id || !flash_price || !flash_start || !flash_end) {
        return new Response(JSON.stringify({
          success: false,
          error: 'Product ID, flash price, start date and end date are required'
        }), {
          status: 400,
          headers: { 'Content-Type': 'application/json', ...corsHeaders }
        });
      }

      if (flash_price <= 0) {
        return new Response(JSON.stringify({ success: false, error: 'Flash price must be greater than 0' }), {
          status: 400,
          headers: { 'Content-Type': 'application/json', ...corsHeaders }
        });
      }

      const startDate = new Date(flash_start);
      const endDate = new Date(flash_end);

      if (startDate >= endDate) {
        return new Response(JSON.stringify({ success: false, error: 'End date must be after start date' }), {
          status: 400,
          headers: { 'Content-Type': 'application/json', ...corsHeaders }
        });
      }

      // Get product details
      const productUrl = `${supabaseUrl}/rest/v1/products?select=mrp,selling_price,name,seller_id&prod_id=eq.${prod_id}`;
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

      if (flash_price >= product.mrp) {
        return new Response(JSON.stringify({
          success: false,
          error: `Flash price must be less than MRP (₹${product.mrp})`
        }), {
          status: 400,
          headers: { 'Content-Type': 'application/json', ...corsHeaders }
        });
      }

      // Check if product already has an overlapping flash deal
      const existingUrl = `${supabaseUrl}/rest/v1/products?select=prod_id&prod_id=eq.${prod_id}&flash_price=not.is.null&flash_start=lte.${flash_end}&flash_end=gte.${flash_start}`;
      const existingResponse = await fetch(existingUrl, {
        headers: {
          'apikey': supabaseKey,
          'Authorization': `Bearer ${supabaseKey}`,
        },
      });
      const existingData = await existingResponse.json();
      const existingDeal = existingData[0];

      if (existingDeal) {
        return new Response(JSON.stringify({
          success: false,
          error: 'Product already has an overlapping flash deal'
        }), {
          status: 400,
          headers: { 'Content-Type': 'application/json', ...corsHeaders }
        });
      }

      // Update product with flash deal
      const updateResult = await supabase
        .from('products')
        .update({
          flash_price: flash_price,
          flash_start: flash_start,
          flash_end: flash_end,
          flash_max_quantity: max_quantity || null,
          updated_at: new Date().toISOString(),
          flash_created_by: 'OWN001'
        })
        .eq('prod_id', prod_id)
        .select();

      if (updateResult.error) {
        console.error('Flash deal creation error:', updateResult.error);
        return new Response(JSON.stringify({ success: false, error: updateResult.error.message }), {
          status: 500,
          headers: { 'Content-Type': 'application/json', ...corsHeaders }
        });
      }

      const updatedProduct = updateResult.data;

      // Notify seller
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
          title: '⚡ Flash Deal Created',
          message: `Your product "${product.name}" is now on flash sale at ₹${flash_price}!`,
          type: 'product',
          data: { prod_id, flash_price, flash_start, flash_end },
          created_at: new Date().toISOString()
        })
      });

      return new Response(JSON.stringify({
        success: true,
        message: 'Flash deal created successfully',
        flash_deal: {
          prod_id: updatedProduct.prod_id,
          name: updatedProduct.name,
          original_price: updatedProduct.selling_price,
          flash_price: updatedProduct.flash_price,
          discount_percent: Math.round(((updatedProduct.mrp - updatedProduct.flash_price) / updatedProduct.mrp) * 100),
          flash_start: updatedProduct.flash_start,
          flash_end: updatedProduct.flash_end,
          status: 'upcoming'
        }
      }), {
        status: 200,
        headers: { 'Content-Type': 'application/json', ...corsHeaders }
      });

    } catch (error) {
      console.error('Create flash deal error:', error);
      return new Response(JSON.stringify({ success: false, error: error.message }), {
        status: 500,
        headers: { 'Content-Type': 'application/json', ...corsHeaders }
      });
    }
  }

  // =====================================================
  // UPDATE FLASH DEAL (PUT)
  // =====================================================
  if (request.method === 'PUT') {
    try {
      const body = await request.json();
      const {
        prod_id,
        flash_price,
        flash_start,
        flash_end,
        max_quantity
      } = body;

      if (!prod_id) {
        return new Response(JSON.stringify({ success: false, error: 'Product ID is required' }), {
          status: 400,
          headers: { 'Content-Type': 'application/json', ...corsHeaders }
        });
      }

      // Get product details
      const productUrl = `${supabaseUrl}/rest/v1/products?select=mrp,name,seller_id&prod_id=eq.${prod_id}`;
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

      const updateData = { updated_at: new Date().toISOString() };
      if (flash_price !== undefined) {
        if (flash_price >= product.mrp) {
          return new Response(JSON.stringify({
            success: false,
            error: `Flash price must be less than MRP (₹${product.mrp})`
          }), {
            status: 400,
            headers: { 'Content-Type': 'application/json', ...corsHeaders }
          });
        }
        updateData.flash_price = flash_price;
      }
      if (flash_start !== undefined) updateData.flash_start = flash_start;
      if (flash_end !== undefined) updateData.flash_end = flash_end;
      if (max_quantity !== undefined) updateData.flash_max_quantity = max_quantity;

      const updateResult = await supabase
        .from('products')
        .update(updateData)
        .eq('prod_id', prod_id)
        .select();

      if (updateResult.error) {
        console.error('Flash deal update error:', updateResult.error);
        return new Response(JSON.stringify({ success: false, error: updateResult.error.message }), {
          status: 500,
          headers: { 'Content-Type': 'application/json', ...corsHeaders }
        });
      }

      const updatedProduct = updateResult.data;

      return new Response(JSON.stringify({
        success: true,
        message: 'Flash deal updated successfully',
        flash_deal: updatedProduct
      }), {
        status: 200,
        headers: { 'Content-Type': 'application/json', ...corsHeaders }
      });

    } catch (error) {
      console.error('Update flash deal error:', error);
      return new Response(JSON.stringify({ success: false, error: error.message }), {
        status: 500,
        headers: { 'Content-Type': 'application/json', ...corsHeaders }
      });
    }
  }

  // =====================================================
  // DELETE FLASH DEAL (DELETE)
  // =====================================================
  if (request.method === 'DELETE') {
    try {
      const prod_id = url.searchParams.get('prod_id');

      if (!prod_id) {
        return new Response(JSON.stringify({ success: false, error: 'Product ID is required' }), {
          status: 400,
          headers: { 'Content-Type': 'application/json', ...corsHeaders }
        });
      }

      await fetch(`${supabaseUrl}/rest/v1/products?prod_id=eq.${prod_id}`, {
        method: 'PATCH',
        headers: {
          'apikey': supabaseKey,
          'Authorization': `Bearer ${supabaseKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          flash_price: null,
          flash_start: null,
          flash_end: null,
          flash_max_quantity: null,
          updated_at: new Date().toISOString()
        })
      });

      return new Response(JSON.stringify({
        success: true,
        message: 'Flash deal removed successfully'
      }), {
        status: 200,
        headers: { 'Content-Type': 'application/json', ...corsHeaders }
      });

    } catch (error) {
      console.error('Delete flash deal error:', error);
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