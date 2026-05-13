// api/owner/settings/return-policy.js
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
  // GET RETURN POLICY SETTINGS
  // =====================================================
  if (request.method === 'GET') {
    try {
      const settingsKeys = [
        'return_enabled',
        'return_policy_text',
        'return_window_days',
        'return_condition',
        'return_shipping_charge',
        'return_restocking_fee',
        'return_refund_method',
        'exchange_enabled',
        'exchange_window_days',
        'exchange_conditions',
        'return_reasons',
        'exchange_reasons',
        'return_auto_approve',
        'return_auto_approve_amount',
        'return_photo_required',
        'return_video_required',
        'return_quality_check',
        'return_quality_check_percentage'
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
      const returnSettings = {};
      settings?.forEach(s => {
        returnSettings[s.setting_key] = s.setting_value;
      });

      // Default return reasons
      const defaultReturnReasons = [
        'Product damaged/defective',
        'Wrong product delivered',
        'Size/color not matching',
        'Product not as described',
        'Quality issue',
        'Missing parts/accessories',
        'Expired product',
        'Better price available',
        'Changed my mind'
      ];

      // Default exchange reasons
      const defaultExchangeReasons = [
        'Size exchange needed',
        'Color exchange needed',
        'Different variant wanted',
        'Product not suitable',
        'Quality issue with current piece'
      ];

      // Set default values
      const defaultSettings = {
        return_enabled: 'true',
        return_policy_text: 'Return policy: Products can be returned within 7 days of delivery. Product must be unused, with original tags and packaging. Same-time return available at delivery.',
        return_window_days: '7',
        return_condition: 'unused_with_tags',
        return_shipping_charge: '50',
        return_restocking_fee: '10',
        return_refund_method: 'wallet',
        exchange_enabled: 'true',
        exchange_window_days: '7',
        exchange_conditions: 'Product must be in original condition with tags intact.',
        return_reasons: JSON.stringify(defaultReturnReasons),
        exchange_reasons: JSON.stringify(defaultExchangeReasons),
        return_auto_approve: 'false',
        return_auto_approve_amount: '500',
        return_photo_required: 'true',
        return_video_required: 'false',
        return_quality_check: 'true',
        return_quality_check_percentage: '10'
      };

      const mergedSettings = { ...defaultSettings, ...returnSettings };

      // Parse JSON arrays
      let returnReasons = defaultReturnReasons;
      let exchangeReasons = defaultExchangeReasons;

      if (mergedSettings.return_reasons) {
        try {
          returnReasons = JSON.parse(mergedSettings.return_reasons);
        } catch (e) {}
      }
      if (mergedSettings.exchange_reasons) {
        try {
          exchangeReasons = JSON.parse(mergedSettings.exchange_reasons);
        } catch (e) {}
      }

      return new Response(JSON.stringify({
        success: true,
        settings: mergedSettings,
        return_policy: {
          enabled: mergedSettings.return_enabled === 'true',
          text: mergedSettings.return_policy_text,
          window_days: parseInt(mergedSettings.return_window_days),
          condition: mergedSettings.return_condition,
          shipping_charge: parseInt(mergedSettings.return_shipping_charge),
          restocking_fee: parseInt(mergedSettings.return_restocking_fee),
          refund_method: mergedSettings.return_refund_method,
          reasons: returnReasons,
          auto_approve: mergedSettings.return_auto_approve === 'true',
          auto_approve_amount: parseInt(mergedSettings.return_auto_approve_amount),
          photo_required: mergedSettings.return_photo_required === 'true',
          video_required: mergedSettings.return_video_required === 'true',
          quality_check: mergedSettings.return_quality_check === 'true',
          quality_check_percentage: parseInt(mergedSettings.return_quality_check_percentage)
        },
        exchange_policy: {
          enabled: mergedSettings.exchange_enabled === 'true',
          window_days: parseInt(mergedSettings.exchange_window_days),
          conditions: mergedSettings.exchange_conditions,
          reasons: exchangeReasons
        }
      }), {
        status: 200,
        headers: { 'Content-Type': 'application/json', ...corsHeaders }
      });

    } catch (error) {
      console.error('Get return policy settings error:', error);
      return new Response(JSON.stringify({ success: false, error: error.message }), {
        status: 500,
        headers: { 'Content-Type': 'application/json', ...corsHeaders }
      });
    }
  }

  // =====================================================
  // UPDATE RETURN POLICY SETTINGS (PUT)
  // =====================================================
  if (request.method === 'PUT') {
    try {
      const body = await request.json();
      const {
        return_enabled,
        return_policy_text,
        return_window_days,
        return_condition,
        return_shipping_charge,
        return_restocking_fee,
        return_refund_method,
        exchange_enabled,
        exchange_window_days,
        exchange_conditions,
        return_reasons,
        exchange_reasons,
        return_auto_approve,
        return_auto_approve_amount,
        return_photo_required,
        return_video_required,
        return_quality_check,
        return_quality_check_percentage
      } = body;

      const updates = [];

      // Validation
      if (return_window_days !== undefined && parseInt(return_window_days) < 0) {
        return new Response(JSON.stringify({ success: false, error: 'Return window days cannot be negative' }), {
          status: 400,
          headers: { 'Content-Type': 'application/json', ...corsHeaders }
        });
      }
      if (return_shipping_charge !== undefined && parseInt(return_shipping_charge) < 0) {
        return new Response(JSON.stringify({ success: false, error: 'Return shipping charge cannot be negative' }), {
          status: 400,
          headers: { 'Content-Type': 'application/json', ...corsHeaders }
        });
      }
      if (return_restocking_fee !== undefined && (parseInt(return_restocking_fee) < 0 || parseInt(return_restocking_fee) > 50)) {
        return new Response(JSON.stringify({ success: false, error: 'Restocking fee must be between 0 and 50' }), {
          status: 400,
          headers: { 'Content-Type': 'application/json', ...corsHeaders }
        });
      }
      if (return_auto_approve_amount !== undefined && parseInt(return_auto_approve_amount) < 0) {
        return new Response(JSON.stringify({ success: false, error: 'Auto approve amount cannot be negative' }), {
          status: 400,
          headers: { 'Content-Type': 'application/json', ...corsHeaders }
        });
      }
      if (return_quality_check_percentage !== undefined && (parseInt(return_quality_check_percentage) < 0 || parseInt(return_quality_check_percentage) > 100)) {
        return new Response(JSON.stringify({ success: false, error: 'Quality check percentage must be between 0 and 100' }), {
          status: 400,
          headers: { 'Content-Type': 'application/json', ...corsHeaders }
        });
      }

      if (return_enabled !== undefined) updates.push({ setting_key: 'return_enabled', setting_value: return_enabled });
      if (return_policy_text !== undefined) updates.push({ setting_key: 'return_policy_text', setting_value: return_policy_text });
      if (return_window_days !== undefined) updates.push({ setting_key: 'return_window_days', setting_value: String(return_window_days) });
      if (return_condition !== undefined) updates.push({ setting_key: 'return_condition', setting_value: return_condition });
      if (return_shipping_charge !== undefined) updates.push({ setting_key: 'return_shipping_charge', setting_value: String(return_shipping_charge) });
      if (return_restocking_fee !== undefined) updates.push({ setting_key: 'return_restocking_fee', setting_value: String(return_restocking_fee) });
      if (return_refund_method !== undefined) updates.push({ setting_key: 'return_refund_method', setting_value: return_refund_method });
      if (exchange_enabled !== undefined) updates.push({ setting_key: 'exchange_enabled', setting_value: exchange_enabled });
      if (exchange_window_days !== undefined) updates.push({ setting_key: 'exchange_window_days', setting_value: String(exchange_window_days) });
      if (exchange_conditions !== undefined) updates.push({ setting_key: 'exchange_conditions', setting_value: exchange_conditions });
      if (return_reasons !== undefined) updates.push({ setting_key: 'return_reasons', setting_value: JSON.stringify(return_reasons) });
      if (exchange_reasons !== undefined) updates.push({ setting_key: 'exchange_reasons', setting_value: JSON.stringify(exchange_reasons) });
      if (return_auto_approve !== undefined) updates.push({ setting_key: 'return_auto_approve', setting_value: return_auto_approve });
      if (return_auto_approve_amount !== undefined) updates.push({ setting_key: 'return_auto_approve_amount', setting_value: String(return_auto_approve_amount) });
      if (return_photo_required !== undefined) updates.push({ setting_key: 'return_photo_required', setting_value: return_photo_required });
      if (return_video_required !== undefined) updates.push({ setting_key: 'return_video_required', setting_value: return_video_required });
      if (return_quality_check !== undefined) updates.push({ setting_key: 'return_quality_check', setting_value: return_quality_check });
      if (return_quality_check_percentage !== undefined) updates.push({ setting_key: 'return_quality_check_percentage', setting_value: String(return_quality_check_percentage) });

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
        message: 'Return policy settings updated successfully',
        updated_fields: updates.map(u => u.setting_key)
      }), {
        status: 200,
        headers: { 'Content-Type': 'application/json', ...corsHeaders }
      });

    } catch (error) {
      console.error('Update return policy settings error:', error);
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