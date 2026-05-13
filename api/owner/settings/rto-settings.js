// api/owner/settings/rto-settings.js
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
  // GET RTO SETTINGS
  // =====================================================
  if (request.method === 'GET') {
    try {
      const settingsKeys = [
        'rto_enabled',
        'rto_reasons',
        'rto_fine_amount',
        'rto_block_days',
        'rto_restock_threshold',
        'rto_auto_approve',
        'rto_auto_approve_amount',
        'rto_dispute_window_days',
        'rto_quality_check_required',
        'rto_restocking_fee_percent',
        'rto_seller_penalty_percent',
        'rto_customer_penalty_points',
        'rto_notify_seller',
        'rto_notify_customer',
        'rto_return_shipping_charge',
        'rto_refund_method'
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
      const rtoSettings = {};
      settings?.forEach(s => {
        rtoSettings[s.setting_key] = s.setting_value;
      });

      // Default RTO reasons
      const defaultReasons = [
        'Customer not available',
        'Wrong address',
        'Customer rejected product',
        'Product damaged in transit',
        'Delivery time too long',
        'Area not serviceable',
        'Customer requested cancellation',
        'Other'
      ];

      // Set default values
      const defaultSettings = {
        rto_enabled: 'true',
        rto_reasons: JSON.stringify(defaultReasons),
        rto_fine_amount: '100',
        rto_block_days: '30',
        rto_restock_threshold: '7',
        rto_auto_approve: 'false',
        rto_auto_approve_amount: '500',
        rto_dispute_window_days: '7',
        rto_quality_check_required: 'true',
        rto_restocking_fee_percent: '10',
        rto_seller_penalty_percent: '5',
        rto_customer_penalty_points: '20',
        rto_notify_seller: 'true',
        rto_notify_customer: 'true',
        rto_return_shipping_charge: '50',
        rto_refund_method: 'wallet'
      };

      const mergedSettings = { ...defaultSettings, ...rtoSettings };

      // Parse JSON reasons
      let parsedReasons = defaultReasons;
      if (mergedSettings.rto_reasons) {
        try {
          parsedReasons = JSON.parse(mergedSettings.rto_reasons);
        } catch (e) {
          parsedReasons = defaultReasons;
        }
      }

      return new Response(JSON.stringify({
        success: true,
        settings: {
          ...mergedSettings,
          rto_reasons: parsedReasons
        }
      }), {
        status: 200,
        headers: { 'Content-Type': 'application/json', ...corsHeaders }
      });

    } catch (error) {
      console.error('Get RTO settings error:', error);
      return new Response(JSON.stringify({ success: false, error: error.message }), {
        status: 500,
        headers: { 'Content-Type': 'application/json', ...corsHeaders }
      });
    }
  }

  // =====================================================
  // UPDATE RTO SETTINGS (PUT)
  // =====================================================
  if (request.method === 'PUT') {
    try {
      const body = await request.json();
      const {
        rto_enabled,
        rto_reasons,
        rto_fine_amount,
        rto_block_days,
        rto_restock_threshold,
        rto_auto_approve,
        rto_auto_approve_amount,
        rto_dispute_window_days,
        rto_quality_check_required,
        rto_restocking_fee_percent,
        rto_seller_penalty_percent,
        rto_customer_penalty_points,
        rto_notify_seller,
        rto_notify_customer,
        rto_return_shipping_charge,
        rto_refund_method
      } = body;

      const updates = [];

      // Validation
      if (rto_fine_amount !== undefined && parseInt(rto_fine_amount) < 0) {
        return new Response(JSON.stringify({ success: false, error: 'RTO fine amount cannot be negative' }), {
          status: 400,
          headers: { 'Content-Type': 'application/json', ...corsHeaders }
        });
      }
      if (rto_block_days !== undefined && parseInt(rto_block_days) < 1) {
        return new Response(JSON.stringify({ success: false, error: 'RTO block days must be at least 1' }), {
          status: 400,
          headers: { 'Content-Type': 'application/json', ...corsHeaders }
        });
      }
      if (rto_restocking_fee_percent !== undefined && (parseInt(rto_restocking_fee_percent) < 0 || parseInt(rto_restocking_fee_percent) > 50)) {
        return new Response(JSON.stringify({ success: false, error: 'Restocking fee percentage must be between 0 and 50' }), {
          status: 400,
          headers: { 'Content-Type': 'application/json', ...corsHeaders }
        });
      }
      if (rto_seller_penalty_percent !== undefined && (parseInt(rto_seller_penalty_percent) < 0 || parseInt(rto_seller_penalty_percent) > 100)) {
        return new Response(JSON.stringify({ success: false, error: 'Seller penalty percentage must be between 0 and 100' }), {
          status: 400,
          headers: { 'Content-Type': 'application/json', ...corsHeaders }
        });
      }

      if (rto_enabled !== undefined) updates.push({ setting_key: 'rto_enabled', setting_value: rto_enabled });
      if (rto_reasons !== undefined) updates.push({ setting_key: 'rto_reasons', setting_value: JSON.stringify(rto_reasons) });
      if (rto_fine_amount !== undefined) updates.push({ setting_key: 'rto_fine_amount', setting_value: String(rto_fine_amount) });
      if (rto_block_days !== undefined) updates.push({ setting_key: 'rto_block_days', setting_value: String(rto_block_days) });
      if (rto_restock_threshold !== undefined) updates.push({ setting_key: 'rto_restock_threshold', setting_value: String(rto_restock_threshold) });
      if (rto_auto_approve !== undefined) updates.push({ setting_key: 'rto_auto_approve', setting_value: rto_auto_approve });
      if (rto_auto_approve_amount !== undefined) updates.push({ setting_key: 'rto_auto_approve_amount', setting_value: String(rto_auto_approve_amount) });
      if (rto_dispute_window_days !== undefined) updates.push({ setting_key: 'rto_dispute_window_days', setting_value: String(rto_dispute_window_days) });
      if (rto_quality_check_required !== undefined) updates.push({ setting_key: 'rto_quality_check_required', setting_value: rto_quality_check_required });
      if (rto_restocking_fee_percent !== undefined) updates.push({ setting_key: 'rto_restocking_fee_percent', setting_value: String(rto_restocking_fee_percent) });
      if (rto_seller_penalty_percent !== undefined) updates.push({ setting_key: 'rto_seller_penalty_percent', setting_value: String(rto_seller_penalty_percent) });
      if (rto_customer_penalty_points !== undefined) updates.push({ setting_key: 'rto_customer_penalty_points', setting_value: String(rto_customer_penalty_points) });
      if (rto_notify_seller !== undefined) updates.push({ setting_key: 'rto_notify_seller', setting_value: rto_notify_seller });
      if (rto_notify_customer !== undefined) updates.push({ setting_key: 'rto_notify_customer', setting_value: rto_notify_customer });
      if (rto_return_shipping_charge !== undefined) updates.push({ setting_key: 'rto_return_shipping_charge', setting_value: String(rto_return_shipping_charge) });
      if (rto_refund_method !== undefined) updates.push({ setting_key: 'rto_refund_method', setting_value: rto_refund_method });

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
        message: 'RTO settings updated successfully',
        updated_fields: updates.map(u => u.setting_key)
      }), {
        status: 200,
        headers: { 'Content-Type': 'application/json', ...corsHeaders }
      });

    } catch (error) {
      console.error('Update RTO settings error:', error);
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