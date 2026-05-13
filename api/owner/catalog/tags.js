// api/owner/catalog/tags.js
// Edge Function for Vercel Deployment

export const config = {
  runtime: 'edge',
  regions: ['iad1', 'sfo1', 'fra1', 'sin1'],
};

// 40 Product Tags List
const DEFAULT_TAGS = [
  // Top Attractive Tags (1-10)
  { name: 'Hot', category: 'attractive' },
  { name: 'Fabulous', category: 'attractive' },
  { name: 'Super', category: 'attractive' },
  { name: 'Epic', category: 'attractive' },
  { name: 'Awesome', category: 'attractive' },
  { name: 'Amazing', category: 'attractive' },
  { name: 'Stunning', category: 'attractive' },
  { name: 'Gorgeous', category: 'attractive' },
  { name: 'Breathtaking', category: 'attractive' },
  { name: 'Mind-blowing', category: 'attractive' },
  // Premium & Luxurious Tags (11-20)
  { name: 'Luxury', category: 'premium' },
  { name: 'Premium', category: 'premium' },
  { name: 'Exclusive', category: 'premium' },
  { name: 'Elite', category: 'premium' },
  { name: 'Signature', category: 'premium' },
  { name: 'Ultimate', category: 'premium' },
  { name: 'Legendary', category: 'premium' },
  { name: 'Royal', category: 'premium' },
  { name: 'Divine', category: 'premium' },
  { name: 'Celestial', category: 'premium' },
  // Trendy & Energetic Tags (21-30)
  { name: 'Viral', category: 'trendy' },
  { name: 'Trending', category: 'trendy' },
  { name: 'Fire', category: 'trendy' },
  { name: 'Slay', category: 'trendy' },
  { name: 'Glow', category: 'trendy' },
  { name: 'Boss', category: 'trendy' },
  { name: 'Iconic', category: 'trendy' },
  { name: 'Unreal', category: 'trendy' },
  { name: 'Next Level', category: 'trendy' },
  { name: 'Obsessed', category: 'trendy' },
  // Bonus Extra Catchy Tags (31-40)
  { name: 'Must-Have', category: 'bonus' },
  { name: 'Game Changer', category: 'bonus' },
  { name: 'Showstopper', category: 'bonus' },
  { name: 'Dazzling', category: 'bonus' },
  { name: 'Irresistible', category: 'bonus' },
  { name: 'Spellbinding', category: 'bonus' },
  { name: 'Radiant', category: 'bonus' },
  { name: 'Flawless', category: 'bonus' },
  { name: 'Killer', category: 'bonus' },
  { name: 'Sizzling', category: 'bonus' }
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
            contains: (containsField, containsValue) => ({
              limit: async (limit) => {
                const containsValues = containsValue.map(v => `"${v}"`).join(',');
                const finalUrl = `${url}&${field}=eq.${value}&${containsField}=cs.{${containsValues}}&limit=${limit}`;
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
        }),
        neq: (field, value) => ({
          select: async () => {
            const response = await fetch(`${supabaseUrl}/rest/v1/${table}?${field}=neq.${value}`, {
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
  // GET TAGS LIST
  // =====================================================
  if (request.method === 'GET') {
    try {
      const category = url.searchParams.get('category');
      const is_active = url.searchParams.get('is_active');

      let tagsUrl = `${supabaseUrl}/rest/v1/product_tags?select=*&order=tag_id.asc`;

      if (category && category !== 'all') {
        tagsUrl += `&category=eq.${category}`;
      }

      if (is_active !== undefined && is_active !== null) {
        tagsUrl += `&is_active=eq.${is_active === 'true'}`;
      }

      const tagsResponse = await fetch(tagsUrl, {
        headers: {
          'apikey': supabaseKey,
          'Authorization': `Bearer ${supabaseKey}`,
        },
      });
      const tags = await tagsResponse.json();

      // Get tag usage statistics from products
      const productsUrl = `${supabaseUrl}/rest/v1/products?select=tags`;
      const productsResponse = await fetch(productsUrl, {
        headers: {
          'apikey': supabaseKey,
          'Authorization': `Bearer ${supabaseKey}`,
        },
      });
      const productTags = await productsResponse.json();

      const tagUsageCount = {};
      productTags?.forEach(product => {
        if (product.tags && Array.isArray(product.tags)) {
          product.tags.forEach(tag => {
            tagUsageCount[tag] = (tagUsageCount[tag] || 0) + 1;
          });
        }
      });

      // Add usage count to tags
      const tagsWithUsage = tags.map(tag => ({
        ...tag,
        usage_count: tagUsageCount[tag.tag_name] || 0
      }));

      // Group by category
      const groupedTags = {
        attractive: tagsWithUsage.filter(t => t.category === 'attractive'),
        premium: tagsWithUsage.filter(t => t.category === 'premium'),
        trendy: tagsWithUsage.filter(t => t.category === 'trendy'),
        bonus: tagsWithUsage.filter(t => t.category === 'bonus')
      };

      const stats = {
        total: tagsWithUsage.length,
        attractive: groupedTags.attractive.length,
        premium: groupedTags.premium.length,
        trendy: groupedTags.trendy.length,
        bonus: groupedTags.bonus.length,
        total_usage: Object.values(tagUsageCount).reduce((sum, count) => sum + count, 0)
      };

      return new Response(JSON.stringify({
        success: true,
        tags: tagsWithUsage,
        grouped_tags: groupedTags,
        stats: stats
      }), {
        status: 200,
        headers: { 'Content-Type': 'application/json', ...corsHeaders }
      });

    } catch (error) {
      console.error('Get tags error:', error);
      return new Response(JSON.stringify({ success: false, error: error.message }), {
        status: 500,
        headers: { 'Content-Type': 'application/json', ...corsHeaders }
      });
    }
  }

  // =====================================================
  // CREATE TAG (POST)
  // =====================================================
  if (request.method === 'POST') {
    try {
      // Check if this is a reset action
      const body = await request.json();
      if (body.action === 'reset') {
        // Reset to default tags
        const deleteUrl = `${supabaseUrl}/rest/v1/product_tags?tag_id=neq.0`;
        await fetch(deleteUrl, {
          method: 'DELETE',
          headers: {
            'apikey': supabaseKey,
            'Authorization': `Bearer ${supabaseKey}`,
          },
        });

        // Insert default tags
        const insertData = DEFAULT_TAGS.map(tag => ({
          tag_name: tag.name,
          category: tag.category,
          is_active: true,
          created_at: new Date().toISOString()
        }));

        const insertResponse = await fetch(`${supabaseUrl}/rest/v1/product_tags`, {
          method: 'POST',
          headers: {
            'apikey': supabaseKey,
            'Authorization': `Bearer ${supabaseKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(insertData)
        });

        if (!insertResponse.ok) {
          const errorData = await insertResponse.json();
          console.error('Reset tags error:', errorData);
          return new Response(JSON.stringify({ success: false, error: 'Failed to reset tags' }), {
            status: 500,
            headers: { 'Content-Type': 'application/json', ...corsHeaders }
          });
        }

        return new Response(JSON.stringify({
          success: true,
          message: 'Tags reset to default successfully',
          total_tags: DEFAULT_TAGS.length
        }), {
          status: 200,
          headers: { 'Content-Type': 'application/json', ...corsHeaders }
        });
      }

      // Create new tag
      const { tag_name, category, icon } = body;

      if (!tag_name || !category) {
        return new Response(JSON.stringify({
          success: false,
          error: 'Tag name and category are required'
        }), {
          status: 400,
          headers: { 'Content-Type': 'application/json', ...corsHeaders }
        });
      }

      if (!['attractive', 'premium', 'trendy', 'bonus'].includes(category)) {
        return new Response(JSON.stringify({
          success: false,
          error: 'Invalid category. Must be: attractive, premium, trendy, or bonus'
        }), {
          status: 400,
          headers: { 'Content-Type': 'application/json', ...corsHeaders }
        });
      }

      // Check if tag already exists
      const existingUrl = `${supabaseUrl}/rest/v1/product_tags?tag_name=eq.${encodeURIComponent(tag_name)}&select=tag_id`;
      const existingResponse = await fetch(existingUrl, {
        headers: {
          'apikey': supabaseKey,
          'Authorization': `Bearer ${supabaseKey}`,
        },
      });
      const existingData = await existingResponse.json();
      const existingTag = existingData[0];

      if (existingTag) {
        return new Response(JSON.stringify({ success: false, error: 'Tag already exists' }), {
          status: 400,
          headers: { 'Content-Type': 'application/json', ...corsHeaders }
        });
      }

      const insertResult = await supabase
        .from('product_tags')
        .insert({
          tag_name,
          category,
          icon: icon || null,
          is_active: true,
          created_at: new Date().toISOString()
        })
        .select();

      if (insertResult.error) {
        console.error('Tag creation error:', insertResult.error);
        return new Response(JSON.stringify({ success: false, error: insertResult.error.message }), {
          status: 500,
          headers: { 'Content-Type': 'application/json', ...corsHeaders }
        });
      }

      const newTag = insertResult.data;

      return new Response(JSON.stringify({
        success: true,
        message: 'Tag created successfully',
        tag: newTag
      }), {
        status: 200,
        headers: { 'Content-Type': 'application/json', ...corsHeaders }
      });

    } catch (error) {
      console.error('Create tag error:', error);
      return new Response(JSON.stringify({ success: false, error: error.message }), {
        status: 500,
        headers: { 'Content-Type': 'application/json', ...corsHeaders }
      });
    }
  }

  // =====================================================
  // UPDATE TAG (PUT)
  // =====================================================
  if (request.method === 'PUT') {
    try {
      const body = await request.json();
      const { tag_id, tag_name, category, icon, is_active } = body;

      if (!tag_id) {
        return new Response(JSON.stringify({ success: false, error: 'Tag ID is required' }), {
          status: 400,
          headers: { 'Content-Type': 'application/json', ...corsHeaders }
        });
      }

      // Check if tag exists
      const existingUrl = `${supabaseUrl}/rest/v1/product_tags?tag_id=eq.${tag_id}&select=*`;
      const existingResponse = await fetch(existingUrl, {
        headers: {
          'apikey': supabaseKey,
          'Authorization': `Bearer ${supabaseKey}`,
        },
      });
      const existingData = await existingResponse.json();
      const existingTag = existingData[0];

      if (!existingTag) {
        return new Response(JSON.stringify({ success: false, error: 'Tag not found' }), {
          status: 404,
          headers: { 'Content-Type': 'application/json', ...corsHeaders }
        });
      }

      // Check if new tag_name already exists
      if (tag_name && tag_name !== existingTag.tag_name) {
        const nameExistsUrl = `${supabaseUrl}/rest/v1/product_tags?tag_name=eq.${encodeURIComponent(tag_name)}&tag_id=neq.${tag_id}&select=tag_id`;
        const nameExistsResponse = await fetch(nameExistsUrl, {
          headers: {
            'apikey': supabaseKey,
            'Authorization': `Bearer ${supabaseKey}`,
          },
        });
        const nameExistsData = await nameExistsResponse.json();
        const nameExists = nameExistsData[0];

        if (nameExists) {
          return new Response(JSON.stringify({ success: false, error: 'Tag name already exists' }), {
            status: 400,
            headers: { 'Content-Type': 'application/json', ...corsHeaders }
          });
        }
      }

      const updateData = {};
      if (tag_name !== undefined) updateData.tag_name = tag_name;
      if (category !== undefined) updateData.category = category;
      if (icon !== undefined) updateData.icon = icon;
      if (is_active !== undefined) updateData.is_active = is_active;

      updateData.updated_at = new Date().toISOString();

      const updateResult = await supabase
        .from('product_tags')
        .update(updateData)
        .eq('tag_id', tag_id)
        .select();

      if (updateResult.error) {
        console.error('Tag update error:', updateResult.error);
        return new Response(JSON.stringify({ success: false, error: updateResult.error.message }), {
          status: 500,
          headers: { 'Content-Type': 'application/json', ...corsHeaders }
        });
      }

      const updatedTag = updateResult.data;

      return new Response(JSON.stringify({
        success: true,
        message: 'Tag updated successfully',
        tag: updatedTag
      }), {
        status: 200,
        headers: { 'Content-Type': 'application/json', ...corsHeaders }
      });

    } catch (error) {
      console.error('Update tag error:', error);
      return new Response(JSON.stringify({ success: false, error: error.message }), {
        status: 500,
        headers: { 'Content-Type': 'application/json', ...corsHeaders }
      });
    }
  }

  // =====================================================
  // DELETE TAG (DELETE)
  // =====================================================
  if (request.method === 'DELETE') {
    try {
      const tag_id = url.searchParams.get('tag_id');

      if (!tag_id) {
        return new Response(JSON.stringify({ success: false, error: 'Tag ID is required' }), {
          status: 400,
          headers: { 'Content-Type': 'application/json', ...corsHeaders }
        });
      }

      // Check if tag exists
      const existingUrl = `${supabaseUrl}/rest/v1/product_tags?tag_id=eq.${tag_id}&select=tag_name`;
      const existingResponse = await fetch(existingUrl, {
        headers: {
          'apikey': supabaseKey,
          'Authorization': `Bearer ${supabaseKey}`,
        },
      });
      const existingData = await existingResponse.json();
      const existingTag = existingData[0];

      if (!existingTag) {
        return new Response(JSON.stringify({ success: false, error: 'Tag not found' }), {
          status: 404,
          headers: { 'Content-Type': 'application/json', ...corsHeaders }
        });
      }

      // Check if tag is being used in products
      const productsUrl = `${supabaseUrl}/rest/v1/products?select=prod_id&tags=cs.{${existingTag.tag_name}}&limit=1`;
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
          error: `Cannot delete tag "${existingTag.tag_name}". It is being used by some products.`
        }), {
          status: 400,
          headers: { 'Content-Type': 'application/json', ...corsHeaders }
        });
      }

      // Delete tag
      await fetch(`${supabaseUrl}/rest/v1/product_tags?tag_id=eq.${tag_id}`, {
        method: 'DELETE',
        headers: {
          'apikey': supabaseKey,
          'Authorization': `Bearer ${supabaseKey}`,
        },
      });

      return new Response(JSON.stringify({
        success: true,
        message: 'Tag deleted successfully'
      }), {
        status: 200,
        headers: { 'Content-Type': 'application/json', ...corsHeaders }
      });

    } catch (error) {
      console.error('Delete tag error:', error);
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