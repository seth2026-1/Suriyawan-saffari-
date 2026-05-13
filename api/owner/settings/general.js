// api/owner/settings/general.js
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
  // GET GENERAL SETTINGS
  // =====================================================
  if (request.method === 'GET') {
    try {
      const settingsKeys = [
        'app_name',
        'app_logo',
        'app_version',
        'timezone',
        'currency',
        'currency_symbol',
        'date_format',
        'time_format',
        'primary_color',
        'secondary_color',
        'favicon',
        'meta_title',
        'meta_description',
        'meta_keywords',
        'company_name',
        'company_address',
        'company_email',
        'company_phone',
        'company_gst',
        'maintenance_mode',
        'maintenance_message',
        'allow_new_registration',
        'require_email_verification',
        'require_mobile_verification'
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
      const generalSettings = {};
      settings?.forEach(s => {
        generalSettings[s.setting_key] = s.setting_value;
      });

      // Set default values if not found
      const defaultSettings = {
        app_name: 'Suriyawan Saffari',
        app_version: '1.0.0',
        timezone: 'Asia/Kolkata',
        currency: 'INR',
        currency_symbol: '₹',
        date_format: 'DD/MM/YYYY',
        time_format: '12h',
        primary_color: '#1e3a8a',
        secondary_color: '#f59e0b',
        company_name: 'Suriyawan Saffari Pvt Ltd',
        company_address: 'Suriyawan, Bhadohi, Uttar Pradesh - 221404',
        company_email: 'info@suriyawansaffari.com',
        company_phone: '1800-xxx-xxx',
        maintenance_mode: 'false',
        allow_new_registration: 'true',
        require_email_verification: 'false',
        require_mobile_verification: 'false'
      };

      const mergedSettings = { ...defaultSettings, ...generalSettings };

      return new Response(JSON.stringify({
        success: true,
        settings: mergedSettings,
        version_info: {
          current: mergedSettings.app_version,
          latest: '1.0.0',
          update_available: false
        }
      }), {
        status: 200,
        headers: { 'Content-Type': 'application/json', ...corsHeaders }
      });

    } catch (error) {
      console.error('Get general settings error:', error);
      return new Response(JSON.stringify({ success: false, error: error.message }), {
        status: 500,
        headers: { 'Content-Type': 'application/json', ...corsHeaders }
      });
    }
  }

  // =====================================================
  // UPDATE GENERAL SETTINGS (PUT)
  // =====================================================
  if (request.method === 'PUT') {
    try {
      const body = await request.json();
      const {
        app_name,
        app_logo,
        timezone,
        currency,
        currency_symbol,
        date_format,
        time_format,
        primary_color,
        secondary_color,
        favicon,
        meta_title,
        meta_description,
        meta_keywords,
        company_name,
        company_address,
        company_email,
        company_phone,
        company_gst,
        maintenance_mode,
        maintenance_message,
        allow_new_registration,
        require_email_verification,
        require_mobile_verification
      } = body;

      const updates = [];

      if (app_name !== undefined) updates.push({ setting_key: 'app_name', setting_value: app_name });
      if (app_logo !== undefined) updates.push({ setting_key: 'app_logo', setting_value: app_logo });
      if (timezone !== undefined) updates.push({ setting_key: 'timezone', setting_value: timezone });
      if (currency !== undefined) updates.push({ setting_key: 'currency', setting_value: currency });
      if (currency_symbol !== undefined) updates.push({ setting_key: 'currency_symbol', setting_value: currency_symbol });
      if (date_format !== undefined) updates.push({ setting_key: 'date_format', setting_value: date_format });
      if (time_format !== undefined) updates.push({ setting_key: 'time_format', setting_value: time_format });
      if (primary_color !== undefined) updates.push({ setting_key: 'primary_color', setting_value: primary_color });
      if (secondary_color !== undefined) updates.push({ setting_key: 'secondary_color', setting_value: secondary_color });
      if (favicon !== undefined) updates.push({ setting_key: 'favicon', setting_value: favicon });
      if (meta_title !== undefined) updates.push({ setting_key: 'meta_title', setting_value: meta_title });
      if (meta_description !== undefined) updates.push({ setting_key: 'meta_description', setting_value: meta_description });
      if (meta_keywords !== undefined) updates.push({ setting_key: 'meta_keywords', setting_value: meta_keywords });
      if (company_name !== undefined) updates.push({ setting_key: 'company_name', setting_value: company_name });
      if (company_address !== undefined) updates.push({ setting_key: 'company_address', setting_value: company_address });
      if (company_email !== undefined) updates.push({ setting_key: 'company_email', setting_value: company_email });
      if (company_phone !== undefined) updates.push({ setting_key: 'company_phone', setting_value: company_phone });
      if (company_gst !== undefined) updates.push({ setting_key: 'company_gst', setting_value: company_gst });
      if (maintenance_mode !== undefined) updates.push({ setting_key: 'maintenance_mode', setting_value: maintenance_mode });
      if (maintenance_message !== undefined) updates.push({ setting_key: 'maintenance_message', setting_value: maintenance_message });
      if (allow_new_registration !== undefined) updates.push({ setting_key: 'allow_new_registration', setting_value: allow_new_registration });
      if (require_email_verification !== undefined) updates.push({ setting_key: 'require_email_verification', setting_value: require_email_verification });
      if (require_mobile_verification !== undefined) updates.push({ setting_key: 'require_mobile_verification', setting_value: require_mobile_verification });

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
        message: 'General settings updated successfully',
        updated_fields: updates.map(u => u.setting_key)
      }), {
        status: 200,
        headers: { 'Content-Type': 'application/json', ...corsHeaders }
      });

    } catch (error) {
      console.error('Update general settings error:', error);
      return new Response(JSON.stringify({ success: false, error: error.message }), {
        status: 500,
        headers: { 'Content-Type': 'application/json', ...corsHeaders }
      });
    }
  }

  // =====================================================
  // MAINTENANCE MODE TOGGLE (POST)
  // =====================================================
  if (request.method === 'POST') {
    try {
      const body = await request.json();
      const { action, message } = body;

      if (!action || !['enable', 'disable'].includes(action)) {
        return new Response(JSON.stringify({ success: false, error: 'Invalid action' }), {
          status: 400,
          headers: { 'Content-Type': 'application/json', ...corsHeaders }
        });
      }

      const maintenanceMode = action === 'enable' ? 'true' : 'false';
      const maintenanceMsg = message || 'We are currently under maintenance. Please check back soon.';

      await fetch(`${supabaseUrl}/rest/v1/system_settings`, {
        method: 'POST',
        headers: {
          'apikey': supabaseKey,
          'Authorization': `Bearer ${supabaseKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify([
          { setting_key: 'maintenance_mode', setting_value: maintenanceMode, updated_at: new Date().toISOString(), updated_by: 'OWN001' },
          { setting_key: 'maintenance_message', setting_value: maintenanceMsg, updated_at: new Date().toISOString(), updated_by: 'OWN001' }
        ])
      });

      // Notify all active users if enabling maintenance
      if (action === 'enable') {
        await fetch(`${supabaseUrl}/rest/v1/notifications`, {
          method: 'POST',
          headers: {
            'apikey': supabaseKey,
            'Authorization': `Bearer ${supabaseKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            user_id: 'ALL',
            user_type: 'all',
            title: 'Maintenance Mode Active',
            message: maintenanceMsg,
            type: 'system',
            created_at: new Date().toISOString()
          })
        });
      }

      return new Response(JSON.stringify({
        success: true,
        message: `Maintenance mode ${action}d successfully`,
        maintenance_mode: action === 'enable',
        maintenance_message: maintenanceMsg
      }), {
        status: 200,
        headers: { 'Content-Type': 'application/json', ...corsHeaders }
      });

    } catch (error) {
      console.error('Maintenance mode toggle error:', error);
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