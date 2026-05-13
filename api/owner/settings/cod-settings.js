// api/owner/settings/cod-settings.js
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
          })
        };
      },
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
    'Access-Control-Allow-Methods': 'GET, PUT, OPTIONS',
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
  // GET COD SETTINGS
  // =====================================================
  if (request.method === 'GET') {
    try {
      const settingsKeys = [
        'cod_enabled',
        'cod_min_amount',
        'cod_max_amount',
        'delivery_charge',
        'free_delivery_min',
        'cod_charge_percentage',
        'cod_charge_fixed',
        'rto_fine_amount',
        'rto_block_days',
        'cod_block_fine',
        'cod_block_days',
        'high_rto_threshold',
        'auto_block_cod_on_rto_count',
        'allowed_pincodes',
        'blocked_pincodes',
        'cod_available_till_time',
        'cod_cash_limit_per_rider',
        'require_customer_verification'
      ];

      const settingsUrl = `${supabaseUrl}/rest/v1/system_settings?setting_key=in.(${settingsKeys.join(',')})&select=*`;
      const settingsResponse = await fetch(settingsUrl, {
        headers: {
          'apikey': supabaseKey,
          'Authorization': `Bearer ${supabaseKey}`,
        },
      });
      const settings = await settingsResponse.json();

      // Convert to object
      const codSettings = {};
      settings?.forEach(s => {
        codSettings[s.setting_key] = s.setting_value;
      });

      // Set default values
      const defaultSettings = {
        cod_enabled: 'true',
        cod_min_amount: '200',
        cod_max_amount: '50000',
        delivery_charge: '40',
        free_delivery_min: '499',
        cod_charge_percentage: '0',
        cod_charge_fixed: '0',
        rto_fine_amount: '100',
        rto_block_days: '30',
        cod_block_fine: '100',
        cod_block_days: '30',
        high_rto_threshold: '25',
        auto_block_cod_on_rto_count: '3',
        allowed_pincodes: '[]',
        blocked_pincodes: '[]',
        cod_available_till_time: '20:00',
        cod_cash_limit_per_rider: '10000',
        require_customer_verification: 'true'
      };

      const mergedSettings = { ...defaultSettings, ...codSettings };

      // Parse JSON arrays
      if (mergedSettings.allowed_pincodes) {
        try {
          mergedSettings.allowed_pincodes = JSON.parse(mergedSettings.allowed_pincodes);
        } catch (e) {
          mergedSettings.allowed_pincodes = [];
        }
      }
      if (mergedSettings.blocked_pincodes) {
        try {
          mergedSettings.blocked_pincodes = JSON.parse(mergedSettings.blocked_pincodes);
        } catch (e) {
          mergedSettings.blocked_pincodes = [];
        }
      }

      return new Response(JSON.stringify({
        success: true,
        settings: mergedSettings
      }), {
        status: 200,
        headers: { 'Content-Type': 'application/json', ...corsHeaders }
      });

    } catch (error) {
      console.error('Get COD settings error:', error);
      return new Response(JSON.stringify({ success: false, error: error.message }), {
        status: 500,
        headers: { 'Content-Type': 'application/json', ...corsHeaders }
      });
    }
  }

  // =====================================================
  // UPDATE COD SETTINGS (PUT)
  // =====================================================
  if (request.method === 'PUT') {
    try {
      const body = await request.json();
      const {
        cod_enabled,
        cod_min_amount,
        cod_max_amount,
        delivery_charge,
        free_delivery_min,
        cod_charge_percentage,
        cod_charge_fixed,
        rto_fine_amount,
        rto_block_days,
        cod_block_fine,
        cod_block_days,
        high_rto_threshold,
        auto_block_cod_on_rto_count,
        allowed_pincodes,
        blocked_pincodes,
        cod_available_till_time,
        cod_cash_limit_per_rider,
        require_customer_verification
      } = body;

      const updates = [];

      // Validation
      if (cod_min_amount !== undefined && parseInt(cod_min_amount) < 100) {
        return new Response(JSON.stringify({ success: false, error: 'COD minimum amount cannot be less than ₹100' }), {
          status: 400,
          headers: { 'Content-Type': 'application/json', ...corsHeaders }
        });
      }
      if (cod_max_amount !== undefined && parseInt(cod_max_amount) > 100000) {
        return new Response(JSON.stringify({ success: false, error: 'COD maximum amount cannot exceed ₹100,000' }), {
          status: 400,
          headers: { 'Content-Type': 'application/json', ...corsHeaders }
        });
      }
      if (delivery_charge !== undefined && parseInt(delivery_charge) < 0) {
        return new Response(JSON.stringify({ success: false, error: 'Delivery charge cannot be negative' }), {
          status: 400,
          headers: { 'Content-Type': 'application/json', ...corsHeaders }
        });
      }
      if (rto_fine_amount !== undefined && parseInt(rto_fine_amount) < 0) {
        return new Response(JSON.stringify({ success: false, error: 'RTO fine amount cannot be negative' }), {
          status: 400,
          headers: { 'Content-Type': 'application/json', ...corsHeaders }
        });
      }

      if (cod_enabled !== undefined) updates.push({ setting_key: 'cod_enabled', setting_value: cod_enabled });
      if (cod_min_amount !== undefined) updates.push({ setting_key: 'cod_min_amount', setting_value: String(cod_min_amount) });
      if (cod_max_amount !== undefined) updates.push({ setting_key: 'cod_max_amount', setting_value: String(cod_max_amount) });
      if (delivery_charge !== undefined) updates.push({ setting_key: 'delivery_charge', setting_value: String(delivery_charge) });
      if (free_delivery_min !== undefined) updates.push({ setting_key: 'free_delivery_min', setting_value: String(free_delivery_min) });
      if (cod_charge_percentage !== undefined) updates.push({ setting_key: 'cod_charge_percentage', setting_value: String(cod_charge_percentage) });
      if (cod_charge_fixed !== undefined) updates.push({ setting_key: 'cod_charge_fixed', setting_value: String(cod_charge_fixed) });
      if (rto_fine_amount !== undefined) updates.push({ setting_key: 'rto_fine_amount', setting_value: String(rto_fine_amount) });
      if (rto_block_days !== undefined) updates.push({ setting_key: 'rto_block_days', setting_value: String(rto_block_days) });
      if (cod_block_fine !== undefined) updates.push({ setting_key: 'cod_block_fine', setting_value: String(cod_block_fine) });
      if (cod_block_days !== undefined) updates.push({ setting_key: 'cod_block_days', setting_value: String(cod_block_days) });
      if (high_rto_threshold !== undefined) updates.push({ setting_key: 'high_rto_threshold', setting_value: String(high_rto_threshold) });
      if (auto_block_cod_on_rto_count !== undefined) updates.push({ setting_key: 'auto_block_cod_on_rto_count', setting_value: String(auto_block_cod_on_rto_count) });
      if (cod_available_till_time !== undefined) updates.push({ setting_key: 'cod_available_till_time', setting_value: cod_available_till_time });
      if (cod_cash_limit_per_rider !== undefined) updates.push({ setting_key: 'cod_cash_limit_per_rider', setting_value: String(cod_cash_limit_per_rider) });
      if (require_customer_verification !== undefined) updates.push({ setting_key: 'require_customer_verification', setting_value: require_customer_verification });

      // Handle JSON arrays
      if (allowed_pincodes !== undefined) {
        updates.push({ setting_key: 'allowed_pincodes', setting_value: JSON.stringify(allowed_pincodes) });
      }
      if (blocked_pincodes !== undefined) {
        updates.push({ setting_key: 'blocked_pincodes', setting_value: JSON.stringify(blocked_pincodes) });
      }

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
        message: 'COD settings updated successfully',
        updated_fields: updates.map(u => u.setting_key)
      }), {
        status: 200,
        headers: { 'Content-Type': 'application/json', ...corsHeaders }
      });

    } catch (error) {
      console.error('Update COD settings error:', error);
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