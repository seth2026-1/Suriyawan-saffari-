// api/owner/settings/commission.js
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
          in: (field, values) => ({
            select: async () => {
              const finalUrl = `${url}&${field}=in.(${values.join(',')})`;
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
          eq: (field, value) => ({
            select: async () => {
              const finalUrl = `${url}&${field}=eq.${value}`;
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
              },
              body: JSON.stringify(data)
            });
            return { error: null };
          }
        })
      }),
      upsert: (data) => ({
        select: async () => {
          const response = await fetch(`${supabaseUrl}/rest/v1/${table}`, {
            method: 'POST',
            headers: {
              'apikey': supabaseKey,
              'Authorization': `Bearer ${supabaseKey}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify(data)
          });
          return { error: null };
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
    'Access-Control-Allow-Methods': 'GET, PUT, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version, Authorization',
  };

  // Handle OPTIONS preflight
  if (request.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: corsHeaders });
  }

  const supabase = createSupabaseClient();
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  // =====================================================
  // GET COMMISSION SETTINGS
  // =====================================================
  if (request.method === 'GET') {
    try {
      const settingsKeys = [
        'default_commission',
        'commission_type',
        'commission_tier_enabled',
        'commission_tier_1_min_sales',
        'commission_tier_1_rate',
        'commission_tier_2_min_sales',
        'commission_tier_2_rate',
        'commission_tier_3_min_sales',
        'commission_tier_3_rate',
        'category_commission_enabled',
        'gst_on_commission',
        'commission_payout_frequency',
        'minimum_payout_amount',
        'payout_processing_days'
      ];

      const settingsUrl = `${supabaseUrl}/rest/v1/system_settings?setting_key=in.(${settingsKeys.join(',')})&select=*`;
      const settingsResponse = await fetch(settingsUrl, {
        headers: {
          'apikey': supabaseKey,
          'Authorization': `Bearer ${supabaseKey}`,
        },
      });
      const globalSettings = await settingsResponse.json();

      // Convert to object
      const commissionSettings = {};
      globalSettings?.forEach(s => {
        commissionSettings[s.setting_key] = s.setting_value;
      });

      // Set default values
      const defaultSettings = {
        default_commission: '10',
        commission_type: 'percentage',
        commission_tier_enabled: 'false',
        commission_tier_1_min_sales: '100000',
        commission_tier_1_rate: '8',
        commission_tier_2_min_sales: '500000',
        commission_tier_2_rate: '6',
        commission_tier_3_min_sales: '1000000',
        commission_tier_3_rate: '5',
        category_commission_enabled: 'false',
        gst_on_commission: 'true',
        commission_payout_frequency: 'weekly',
        minimum_payout_amount: '500',
        payout_processing_days: '2'
      };

      const mergedSettings = { ...defaultSettings, ...commissionSettings };

      // Get category-wise commission settings
      let categoryCommissions = [];
      if (mergedSettings.category_commission_enabled === 'true') {
        const categoriesUrl = `${supabaseUrl}/rest/v1/categories?select=cat_id,name,commission_rate&is_active=eq.true`;
        const categoriesResponse = await fetch(categoriesUrl, {
          headers: {
            'apikey': supabaseKey,
            'Authorization': `Bearer ${supabaseKey}`,
          },
        });
        const categories = await categoriesResponse.json();
        categoryCommissions = categories || [];
      }

      // Get seller-wise custom commissions
      const sellersUrl = `${supabaseUrl}/rest/v1/sellers?select=seller_id,shop_name,commission_rate&is_active=eq.true`;
      const sellersResponse = await fetch(sellersUrl, {
        headers: {
          'apikey': supabaseKey,
          'Authorization': `Bearer ${supabaseKey}`,
        },
      });
      const sellerCommissions = await sellersResponse.json();

      return new Response(JSON.stringify({
        success: true,
        global_settings: mergedSettings,
        category_commissions: categoryCommissions,
        seller_commissions: sellerCommissions || [],
        tiers: {
          enabled: mergedSettings.commission_tier_enabled === 'true',
          tiers: [
            {
              min_sales: parseInt(mergedSettings.commission_tier_1_min_sales),
              rate: parseInt(mergedSettings.commission_tier_1_rate)
            },
            {
              min_sales: parseInt(mergedSettings.commission_tier_2_min_sales),
              rate: parseInt(mergedSettings.commission_tier_2_rate)
            },
            {
              min_sales: parseInt(mergedSettings.commission_tier_3_min_sales),
              rate: parseInt(mergedSettings.commission_tier_3_rate)
            }
          ]
        }
      }), {
        status: 200,
        headers: { 'Content-Type': 'application/json', ...corsHeaders }
      });

    } catch (error) {
      console.error('Get commission settings error:', error);
      return new Response(JSON.stringify({ success: false, error: error.message }), {
        status: 500,
        headers: { 'Content-Type': 'application/json', ...corsHeaders }
      });
    }
  }

  // =====================================================
  // UPDATE GLOBAL COMMISSION SETTINGS (PUT)
  // =====================================================
  if (request.method === 'PUT') {
    try {
      const body = await request.json();
      const type = body.type;

      // UPDATE GLOBAL COMMISSION SETTINGS
      if (type === 'global') {
        const {
          default_commission,
          commission_type,
          commission_tier_enabled,
          commission_tier_1_min_sales,
          commission_tier_1_rate,
          commission_tier_2_min_sales,
          commission_tier_2_rate,
          commission_tier_3_min_sales,
          commission_tier_3_rate,
          category_commission_enabled,
          gst_on_commission,
          commission_payout_frequency,
          minimum_payout_amount,
          payout_processing_days
        } = body;

        const updates = [];

        // Validation
        if (default_commission !== undefined && (parseInt(default_commission) < 0 || parseInt(default_commission) > 50)) {
          return new Response(JSON.stringify({ success: false, error: 'Default commission must be between 0 and 50' }), {
            status: 400,
            headers: { 'Content-Type': 'application/json', ...corsHeaders }
          });
        }
        if (minimum_payout_amount !== undefined && parseInt(minimum_payout_amount) < 100) {
          return new Response(JSON.stringify({ success: false, error: 'Minimum payout amount cannot be less than ₹100' }), {
            status: 400,
            headers: { 'Content-Type': 'application/json', ...corsHeaders }
          });
        }

        if (default_commission !== undefined) updates.push({ setting_key: 'default_commission', setting_value: String(default_commission) });
        if (commission_type !== undefined) updates.push({ setting_key: 'commission_type', setting_value: commission_type });
        if (commission_tier_enabled !== undefined) updates.push({ setting_key: 'commission_tier_enabled', setting_value: commission_tier_enabled });
        if (commission_tier_1_min_sales !== undefined) updates.push({ setting_key: 'commission_tier_1_min_sales', setting_value: String(commission_tier_1_min_sales) });
        if (commission_tier_1_rate !== undefined) updates.push({ setting_key: 'commission_tier_1_rate', setting_value: String(commission_tier_1_rate) });
        if (commission_tier_2_min_sales !== undefined) updates.push({ setting_key: 'commission_tier_2_min_sales', setting_value: String(commission_tier_2_min_sales) });
        if (commission_tier_2_rate !== undefined) updates.push({ setting_key: 'commission_tier_2_rate', setting_value: String(commission_tier_2_rate) });
        if (commission_tier_3_min_sales !== undefined) updates.push({ setting_key: 'commission_tier_3_min_sales', setting_value: String(commission_tier_3_min_sales) });
        if (commission_tier_3_rate !== undefined) updates.push({ setting_key: 'commission_tier_3_rate', setting_value: String(commission_tier_3_rate) });
        if (category_commission_enabled !== undefined) updates.push({ setting_key: 'category_commission_enabled', setting_value: category_commission_enabled });
        if (gst_on_commission !== undefined) updates.push({ setting_key: 'gst_on_commission', setting_value: gst_on_commission });
        if (commission_payout_frequency !== undefined) updates.push({ setting_key: 'commission_payout_frequency', setting_value: commission_payout_frequency });
        if (minimum_payout_amount !== undefined) updates.push({ setting_key: 'minimum_payout_amount', setting_value: String(minimum_payout_amount) });
        if (payout_processing_days !== undefined) updates.push({ setting_key: 'payout_processing_days', setting_value: String(payout_processing_days) });

        for (const update of updates) {
          await fetch(`${supabaseUrl}/rest/v1/system_settings`, {
            method: 'POST',
            headers: {
              'apikey': supabaseKey,
              'Authorization': `Bearer ${supabaseKey}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              setting_key: update.setting_key,
              setting_value: update.setting_value,
              updated_at: new Date().toISOString(),
              updated_by: 'OWN001'
            })
          });
        }

        return new Response(JSON.stringify({
          success: true,
          message: 'Global commission settings updated successfully',
          updated_fields: updates.map(u => u.setting_key)
        }), {
          status: 200,
          headers: { 'Content-Type': 'application/json', ...corsHeaders }
        });
      }

      // UPDATE CATEGORY COMMISSION
      if (type === 'category') {
        const { cat_id, commission_rate } = body;

        if (!cat_id) {
          return new Response(JSON.stringify({ success: false, error: 'Category ID is required' }), {
            status: 400,
            headers: { 'Content-Type': 'application/json', ...corsHeaders }
          });
        }

        if (commission_rate !== undefined && (parseInt(commission_rate) < 0 || parseInt(commission_rate) > 50)) {
          return new Response(JSON.stringify({ success: false, error: 'Category commission must be between 0 and 50' }), {
            status: 400,
            headers: { 'Content-Type': 'application/json', ...corsHeaders }
          });
        }

        await fetch(`${supabaseUrl}/rest/v1/categories?cat_id=eq.${cat_id}`, {
          method: 'PATCH',
          headers: {
            'apikey': supabaseKey,
            'Authorization': `Bearer ${supabaseKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ commission_rate: commission_rate, updated_at: new Date().toISOString() })
        });

        return new Response(JSON.stringify({
          success: true,
          message: 'Category commission updated successfully',
          category_id: cat_id,
          commission_rate: commission_rate
        }), {
          status: 200,
          headers: { 'Content-Type': 'application/json', ...corsHeaders }
        });
      }

      // UPDATE SELLER COMMISSION
      if (type === 'seller') {
        const { seller_id, commission_rate } = body;

        if (!seller_id) {
          return new Response(JSON.stringify({ success: false, error: 'Seller ID is required' }), {
            status: 400,
            headers: { 'Content-Type': 'application/json', ...corsHeaders }
          });
        }

        if (commission_rate !== undefined && (parseInt(commission_rate) < 0 || parseInt(commission_rate) > 50)) {
          return new Response(JSON.stringify({ success: false, error: 'Seller commission must be between 0 and 50' }), {
            status: 400,
            headers: { 'Content-Type': 'application/json', ...corsHeaders }
          });
        }

        await fetch(`${supabaseUrl}/rest/v1/sellers?seller_id=eq.${seller_id}`, {
          method: 'PATCH',
          headers: {
            'apikey': supabaseKey,
            'Authorization': `Bearer ${supabaseKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ commission_rate: commission_rate, updated_at: new Date().toISOString() })
        });

        return new Response(JSON.stringify({
          success: true,
          message: 'Seller commission updated successfully',
          seller_id: seller_id,
          commission_rate: commission_rate
        }), {
          status: 200,
          headers: { 'Content-Type': 'application/json', ...corsHeaders }
        });
      }

      return new Response(JSON.stringify({ success: false, error: 'Invalid type parameter' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json', ...corsHeaders }
      });

    } catch (error) {
      console.error('Update commission error:', error);
      return new Response(JSON.stringify({ success: false, error: error.message }), {
        status: 500,
        headers: { 'Content-Type': 'application/json', ...corsHeaders }
      });
    }
  }

  // =====================================================
  // BULK UPDATE CATEGORY COMMISSIONS (POST)
  // =====================================================
  if (request.method === 'POST') {
    try {
      const body = await request.json();
      const type = body.type;

      if (type === 'bulk_category') {
        const { commissions } = body;

        if (!commissions || !Array.isArray(commissions)) {
          return new Response(JSON.stringify({ success: false, error: 'Commissions array is required' }), {
            status: 400,
            headers: { 'Content-Type': 'application/json', ...corsHeaders }
          });
        }

        const results = { success: 0, failed: 0 };

        for (const item of commissions) {
          const response = await fetch(`${supabaseUrl}/rest/v1/categories?cat_id=eq.${item.cat_id}`, {
            method: 'PATCH',
            headers: {
              'apikey': supabaseKey,
              'Authorization': `Bearer ${supabaseKey}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({ commission_rate: item.commission_rate, updated_at: new Date().toISOString() })
          });

          if (response.ok) {
            results.success++;
          } else {
            results.failed++;
          }
        }

        return new Response(JSON.stringify({
          success: true,
          message: `Updated ${results.success} categories, ${results.failed} failed`,
          results: results
        }), {
          status: 200,
          headers: { 'Content-Type': 'application/json', ...corsHeaders }
        });
      }

      return new Response(JSON.stringify({ success: false, error: 'Invalid type parameter' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json', ...corsHeaders }
      });

    } catch (error) {
      console.error('Bulk update category commission error:', error);
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