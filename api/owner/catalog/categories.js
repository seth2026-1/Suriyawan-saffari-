// api/owner/catalog/categories.js
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
            neq: (neqField, neqValue) => ({
              maybeSingle: async () => {
                const finalUrl = `${url}&${field}=eq.${value}&${neqField}=neq.${neqValue}`;
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
            is: (isField, isValue) => ({
              order: (orderField, { ascending }) => ({
                select: async () => {
                  const sortOrder = ascending ? 'asc' : 'desc';
                  const finalUrl = `${url}&${field}=eq.${value}&${isField}=is.${isValue}&order=${orderField}.${sortOrder}`;
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
  // GET CATEGORIES LIST
  // =====================================================
  if (request.method === 'GET') {
    try {
      const include_subcategories = url.searchParams.get('include_subcategories');
      const is_active = url.searchParams.get('is_active');
      const parent_id = url.searchParams.get('parent_id');

      let categoriesUrl = `${supabaseUrl}/rest/v1/categories?select=cat_id,name,slug,icon,image,parent_id,commission_rate,is_active,sort_order,created_at,updated_at&order=sort_order.asc`;

      if (is_active !== undefined && is_active !== null) {
        categoriesUrl += `&is_active=eq.${is_active === 'true'}`;
      }

      if (parent_id !== undefined) {
        if (parent_id === 'null') {
          categoriesUrl += `&parent_id=is.null`;
        } else {
          categoriesUrl += `&parent_id=eq.${parseInt(parent_id)}`;
        }
      }

      const categoriesResponse = await fetch(categoriesUrl, {
        headers: {
          'apikey': supabaseKey,
          'Authorization': `Bearer ${supabaseKey}`,
        },
      });
      let categories = await categoriesResponse.json();

      // Build category tree if requested
      let categoryTree = categories;
      if (include_subcategories === 'true') {
        const buildTree = (items, parentId = null) => {
          return items
            .filter(item => item.parent_id === parentId)
            .map(item => ({
              ...item,
              children: buildTree(items, item.cat_id)
            }));
        };
        categoryTree = buildTree(categories);
      }

      // Get category statistics
      const allCategoriesUrl = `${supabaseUrl}/rest/v1/categories?select=cat_id,parent_id,is_active`;
      const allCategoriesResponse = await fetch(allCategoriesUrl, {
        headers: {
          'apikey': supabaseKey,
          'Authorization': `Bearer ${supabaseKey}`,
        },
      });
      const allCategories = await allCategoriesResponse.json();

      // Get product counts per category
      const productCountsUrl = `${supabaseUrl}/rest/v1/products?select=category_id`;
      const productCountsResponse = await fetch(productCountsUrl, {
        headers: {
          'apikey': supabaseKey,
          'Authorization': `Bearer ${supabaseKey}`,
        },
      });
      const productCounts = await productCountsResponse.json();

      const categoryProductCount = {};
      productCounts?.forEach(p => {
        if (p.category_id) {
          categoryProductCount[p.category_id] = (categoryProductCount[p.category_id] || 0) + 1;
        }
      });

      const stats = {
        total: allCategories?.length || 0,
        main_categories: allCategories?.filter(c => !c.parent_id).length || 0,
        sub_categories: allCategories?.filter(c => c.parent_id).length || 0,
        active: allCategories?.filter(c => c.is_active === true).length || 0
      };

      // Add product count to categories
      const addProductCount = (cat) => ({
        ...cat,
        product_count: categoryProductCount[cat.cat_id] || 0,
        children: cat.children?.map(child => addProductCount(child)) || []
      });

      const categoriesWithCount = categoryTree.map(cat => addProductCount(cat));

      return new Response(JSON.stringify({
        success: true,
        categories: categoriesWithCount,
        flat_categories: categories,
        stats: stats
      }), {
        status: 200,
        headers: { 'Content-Type': 'application/json', ...corsHeaders }
      });

    } catch (error) {
      console.error('Get categories error:', error);
      return new Response(JSON.stringify({ success: false, error: error.message }), {
        status: 500,
        headers: { 'Content-Type': 'application/json', ...corsHeaders }
      });
    }
  }

  // =====================================================
  // CREATE CATEGORY (POST)
  // =====================================================
  if (request.method === 'POST') {
    try {
      const body = await request.json();
      const {
        name,
        slug,
        icon,
        image,
        parent_id,
        commission_rate,
        sort_order
      } = body;

      if (!name || !slug) {
        return new Response(JSON.stringify({
          success: false,
          error: 'Category name and slug are required'
        }), {
          status: 400,
          headers: { 'Content-Type': 'application/json', ...corsHeaders }
        });
      }

      // Check if slug already exists
      const existingSlugUrl = `${supabaseUrl}/rest/v1/categories?slug=eq.${slug}&select=cat_id`;
      const existingSlugResponse = await fetch(existingSlugUrl, {
        headers: {
          'apikey': supabaseKey,
          'Authorization': `Bearer ${supabaseKey}`,
        },
      });
      const existingSlugData = await existingSlugResponse.json();
      const existingSlug = existingSlugData[0];

      if (existingSlug) {
        return new Response(JSON.stringify({ success: false, error: 'Category slug already exists' }), {
          status: 400,
          headers: { 'Content-Type': 'application/json', ...corsHeaders }
        });
      }

      // Get max sort order if not provided
      let finalSortOrder = sort_order;
      if (!finalSortOrder) {
        const maxSortUrl = `${supabaseUrl}/rest/v1/categories?select=sort_order&order=sort_order.desc&limit=1`;
        const maxSortResponse = await fetch(maxSortUrl, {
          headers: {
            'apikey': supabaseKey,
            'Authorization': `Bearer ${supabaseKey}`,
          },
        });
        const maxSortData = await maxSortResponse.json();
        finalSortOrder = (maxSortData[0]?.sort_order || 0) + 1;
      }

      const insertResult = await supabase
        .from('categories')
        .insert({
          name,
          slug,
          icon: icon || null,
          image: image || null,
          parent_id: parent_id || null,
          commission_rate: commission_rate || null,
          sort_order: finalSortOrder,
          is_active: true,
          created_at: new Date().toISOString()
        })
        .select();

      if (insertResult.error) {
        console.error('Category creation error:', insertResult.error);
        return new Response(JSON.stringify({ success: false, error: insertResult.error.message }), {
          status: 500,
          headers: { 'Content-Type': 'application/json', ...corsHeaders }
        });
      }

      const newCategory = insertResult.data;

      return new Response(JSON.stringify({
        success: true,
        message: 'Category created successfully',
        category: newCategory
      }), {
        status: 200,
        headers: { 'Content-Type': 'application/json', ...corsHeaders }
      });

    } catch (error) {
      console.error('Create category error:', error);
      return new Response(JSON.stringify({ success: false, error: error.message }), {
        status: 500,
        headers: { 'Content-Type': 'application/json', ...corsHeaders }
      });
    }
  }

  // =====================================================
  // UPDATE CATEGORY (PUT)
  // =====================================================
  if (request.method === 'PUT') {
    try {
      const body = await request.json();
      const {
        cat_id,
        name,
        slug,
        icon,
        image,
        parent_id,
        commission_rate,
        sort_order,
        is_active
      } = body;

      if (!cat_id) {
        return new Response(JSON.stringify({ success: false, error: 'Category ID is required' }), {
          status: 400,
          headers: { 'Content-Type': 'application/json', ...corsHeaders }
        });
      }

      // Check if category exists
      const existingCatUrl = `${supabaseUrl}/rest/v1/categories?select=*&cat_id=eq.${cat_id}`;
      const existingCatResponse = await fetch(existingCatUrl, {
        headers: {
          'apikey': supabaseKey,
          'Authorization': `Bearer ${supabaseKey}`,
        },
      });
      const existingCatData = await existingCatResponse.json();
      const existingCategory = existingCatData[0];

      if (!existingCategory) {
        return new Response(JSON.stringify({ success: false, error: 'Category not found' }), {
          status: 404,
          headers: { 'Content-Type': 'application/json', ...corsHeaders }
        });
      }

      // Check if new slug already exists (if changed)
      if (slug && slug !== existingCategory.slug) {
        const slugExistsUrl = `${supabaseUrl}/rest/v1/categories?slug=eq.${slug}&cat_id=neq.${cat_id}&select=cat_id`;
        const slugExistsResponse = await fetch(slugExistsUrl, {
          headers: {
            'apikey': supabaseKey,
            'Authorization': `Bearer ${supabaseKey}`,
          },
        });
        const slugExistsData = await slugExistsResponse.json();
        const slugExists = slugExistsData[0];

        if (slugExists) {
          return new Response(JSON.stringify({ success: false, error: 'Category slug already exists' }), {
            status: 400,
            headers: { 'Content-Type': 'application/json', ...corsHeaders }
          });
        }
      }

      // Prevent circular parent reference
      if (parent_id === cat_id) {
        return new Response(JSON.stringify({ success: false, error: 'Category cannot be its own parent' }), {
          status: 400,
          headers: { 'Content-Type': 'application/json', ...corsHeaders }
        });
      }

      const updateData = {};
      if (name !== undefined) updateData.name = name;
      if (slug !== undefined) updateData.slug = slug;
      if (icon !== undefined) updateData.icon = icon;
      if (image !== undefined) updateData.image = image;
      if (parent_id !== undefined) updateData.parent_id = parent_id || null;
      if (commission_rate !== undefined) updateData.commission_rate = commission_rate;
      if (sort_order !== undefined) updateData.sort_order = sort_order;
      if (is_active !== undefined) updateData.is_active = is_active;

      updateData.updated_at = new Date().toISOString();

      const updateResult = await supabase
        .from('categories')
        .update(updateData)
        .eq('cat_id', cat_id)
        .select();

      if (updateResult.error) {
        console.error('Category update error:', updateResult.error);
        return new Response(JSON.stringify({ success: false, error: updateResult.error.message }), {
          status: 500,
          headers: { 'Content-Type': 'application/json', ...corsHeaders }
        });
      }

      const updatedCategory = updateResult.data;

      return new Response(JSON.stringify({
        success: true,
        message: 'Category updated successfully',
        category: updatedCategory
      }), {
        status: 200,
        headers: { 'Content-Type': 'application/json', ...corsHeaders }
      });

    } catch (error) {
      console.error('Update category error:', error);
      return new Response(JSON.stringify({ success: false, error: error.message }), {
        status: 500,
        headers: { 'Content-Type': 'application/json', ...corsHeaders }
      });
    }
  }

  // =====================================================
  // DELETE CATEGORY (DELETE)
  // =====================================================
  if (request.method === 'DELETE') {
    try {
      const cat_id = url.searchParams.get('cat_id');

      if (!cat_id) {
        return new Response(JSON.stringify({ success: false, error: 'Category ID is required' }), {
          status: 400,
          headers: { 'Content-Type': 'application/json', ...corsHeaders }
        });
      }

      // Check if category has subcategories
      const subCategoriesUrl = `${supabaseUrl}/rest/v1/categories?select=cat_id&parent_id=eq.${parseInt(cat_id)}`;
      const subCategoriesResponse = await fetch(subCategoriesUrl, {
        headers: {
          'apikey': supabaseKey,
          'Authorization': `Bearer ${supabaseKey}`,
        },
      });
      const subCategories = await subCategoriesResponse.json();

      if (subCategories && subCategories.length > 0) {
        return new Response(JSON.stringify({
          success: false,
          error: `Cannot delete category. It has ${subCategories.length} sub-categories. Delete or reassign them first.`
        }), {
          status: 400,
          headers: { 'Content-Type': 'application/json', ...corsHeaders }
        });
      }

      // Check if category has products
      const productsUrl = `${supabaseUrl}/rest/v1/products?select=prod_id&category_id=eq.${parseInt(cat_id)}&limit=1`;
      const productsResponse = await fetch(productsUrl, {
        headers: {
          'apikey': supabaseKey,
          'Authorization': `Bearer ${supabaseKey}`,
        },
      });
      const products = await productsResponse.json();

      if (products && products.length > 0) {
        return new Response(JSON.stringify({
          success: false,
          error: 'Cannot delete category. It has products assigned. Reassign products first.'
        }), {
          status: 400,
          headers: { 'Content-Type': 'application/json', ...corsHeaders }
        });
      }

      // Delete category
      await fetch(`${supabaseUrl}/rest/v1/categories?cat_id=eq.${parseInt(cat_id)}`, {
        method: 'DELETE',
        headers: {
          'apikey': supabaseKey,
          'Authorization': `Bearer ${supabaseKey}`,
        },
      });

      return new Response(JSON.stringify({
        success: true,
        message: 'Category deleted successfully'
      }), {
        status: 200,
        headers: { 'Content-Type': 'application/json', ...corsHeaders }
      });

    } catch (error) {
      console.error('Delete category error:', error);
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