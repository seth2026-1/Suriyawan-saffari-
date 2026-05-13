// api/owner/settings/customer-care.js
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
  // GET CUSTOMER CARE SETTINGS
  // =====================================================
  if (request.method === 'GET') {
    try {
      const settingsKeys = [
        'customer_care_number',
        'customer_care_alt_number',
        'customer_care_email',
        'customer_care_whatsapp',
        'customer_care_support_timings',
        'customer_care_emergency_number',
        'support_ticket_sla_hours',
        'support_auto_resolve_days',
        'customer_care_address',
        'customer_care_working_days',
        'customer_care_language',
        'customer_care_faq_enabled',
        'customer_care_chat_enabled',
        'customer_care_callback_enabled',
        'customer_care_callback_hours',
        'customer_care_rating_enabled'
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
      const careSettings = {};
      settings?.forEach(s => {
        careSettings[s.setting_key] = s.setting_value;
      });

      // Set default values
      const defaultSettings = {
        customer_care_number: '1800-xxx-xxx',
        customer_care_alt_number: '1800-yyy-yyy',
        customer_care_email: 'support@suriyawansaffari.com',
        customer_care_whatsapp: '91xxxxxxxxxx',
        customer_care_support_timings: '9:00 AM - 9:00 PM, Monday to Saturday',
        customer_care_emergency_number: '112',
        support_ticket_sla_hours: '24',
        support_auto_resolve_days: '7',
        customer_care_address: 'Suriyawan Saffari HQ, Suriyawan, Bhadohi, Uttar Pradesh - 221404',
        customer_care_working_days: 'Monday,Tuesday,Wednesday,Thursday,Friday,Saturday',
        customer_care_language: 'hi,en',
        customer_care_faq_enabled: 'true',
        customer_care_chat_enabled: 'true',
        customer_care_callback_enabled: 'true',
        customer_care_callback_hours: '24',
        customer_care_rating_enabled: 'true'
      };

      const mergedSettings = { ...defaultSettings, ...careSettings };

      // Get FAQ data
      let faqData = [];
      const faqUrl = `${supabaseUrl}/rest/v1/system_settings?setting_key=eq.faq_data&select=setting_value`;
      const faqResponse = await fetch(faqUrl, {
        headers: {
          'apikey': supabaseKey,
          'Authorization': `Bearer ${supabaseKey}`,
        },
      });
      const faqSettingData = await faqResponse.json();
      const faqSetting = faqSettingData[0];

      if (faqSetting && faqSetting.setting_value) {
        try {
          faqData = JSON.parse(faqSetting.setting_value);
        } catch (e) {}
      } else {
        // Default FAQs
        faqData = [
          { id: 1, question: 'How do I place an order?', answer: 'Browse products, add to cart, proceed to checkout, select COD payment, and confirm order.', category: 'ordering' },
          { id: 2, question: 'How does Cancel Code work?', answer: 'Cancel Code is a 6-digit code sent with your order. Provide it to rider for cancellation.', category: 'cancellation' },
          { id: 3, question: 'What is Open Box Delivery?', answer: 'You can open and check the product in front of the rider before making payment.', category: 'delivery' },
          { id: 4, question: 'Can I return a product?', answer: 'Yes, same-time return is available. Check product at delivery and return immediately if needed.', category: 'returns' },
          { id: 5, question: 'How do I earn coins?', answer: 'Earn coins by placing orders (2%), writing reviews (10 coins), daily check-in, and referrals.', category: 'coins' },
          { id: 6, question: 'How to claim wallet balance?', answer: 'Go to Wallet section, click Claim, enter amount (min ₹100), and provide UPI ID.', category: 'wallet' },
          { id: 7, question: 'Why is my COD blocked?', answer: 'COD may be blocked due to multiple RTOs or returns. Contact support for unblock.', category: 'cod' },
          { id: 8, question: 'How to track my order?', answer: 'Go to My Orders → Track Order or use Tracking ID on tracking page.', category: 'tracking' },
          { id: 9, question: 'What are trust scores?', answer: 'Trust score reflects your reliability. Increases with successful orders, decreases with RTOs/returns.', category: 'account' },
          { id: 10, question: 'How to become a seller?', answer: 'Contact owner at owner@suriyawansaffari.com for seller registration and KYC.', category: 'seller' }
        ];
      }

      // Get auto-reply messages
      let autoReplies = {};
      const autoReplyUrl = `${supabaseUrl}/rest/v1/system_settings?setting_key=eq.auto_reply_messages&select=setting_value`;
      const autoReplyResponse = await fetch(autoReplyUrl, {
        headers: {
          'apikey': supabaseKey,
          'Authorization': `Bearer ${supabaseKey}`,
        },
      });
      const autoReplyData = await autoReplyResponse.json();
      const autoReplySetting = autoReplyData[0];

      if (autoReplySetting && autoReplySetting.setting_value) {
        try {
          autoReplies = JSON.parse(autoReplySetting.setting_value);
        } catch (e) {}
      } else {
        autoReplies = {
          welcome: 'Welcome to Suriyawan Saffari Support! How can we help you today?',
          order: 'Please share your order ID to help us assist you better.',
          return: 'For returns, please ensure the product is in original condition. Share your order ID.',
          complaint: 'We regret the inconvenience. Our team will look into this immediately.',
          closure: 'Thank you for contacting us. Is there anything else we can help with?'
        };
      }

      return new Response(JSON.stringify({
        success: true,
        settings: mergedSettings,
        faq: faqData,
        auto_replies: autoReplies,
        support_timings: {
          hours: mergedSettings.customer_care_support_timings,
          working_days: mergedSettings.customer_care_working_days.split(','),
          languages: mergedSettings.customer_care_language.split(',')
        },
        contact: {
          phone: mergedSettings.customer_care_number,
          alt_phone: mergedSettings.customer_care_alt_number,
          email: mergedSettings.customer_care_email,
          whatsapp: mergedSettings.customer_care_whatsapp,
          emergency: mergedSettings.customer_care_emergency_number,
          address: mergedSettings.customer_care_address
        }
      }), {
        status: 200,
        headers: { 'Content-Type': 'application/json', ...corsHeaders }
      });

    } catch (error) {
      console.error('Get customer care settings error:', error);
      return new Response(JSON.stringify({ success: false, error: error.message }), {
        status: 500,
        headers: { 'Content-Type': 'application/json', ...corsHeaders }
      });
    }
  }

  // =====================================================
  // UPDATE CUSTOMER CARE SETTINGS (PUT)
  // =====================================================
  if (request.method === 'PUT') {
    try {
      const body = await request.json();
      const type = body.type;

      // UPDATE SETTINGS
      if (type === 'settings') {
        const {
          customer_care_number,
          customer_care_alt_number,
          customer_care_email,
          customer_care_whatsapp,
          customer_care_support_timings,
          customer_care_emergency_number,
          support_ticket_sla_hours,
          support_auto_resolve_days,
          customer_care_address,
          customer_care_working_days,
          customer_care_language,
          customer_care_faq_enabled,
          customer_care_chat_enabled,
          customer_care_callback_enabled,
          customer_care_callback_hours,
          customer_care_rating_enabled
        } = body;

        const updates = [];

        // Validation
        if (support_ticket_sla_hours !== undefined && parseInt(support_ticket_sla_hours) < 1) {
          return new Response(JSON.stringify({ success: false, error: 'SLA hours must be at least 1' }), {
            status: 400,
            headers: { 'Content-Type': 'application/json', ...corsHeaders }
          });
        }
        if (customer_care_callback_hours !== undefined && parseInt(customer_care_callback_hours) < 1) {
          return new Response(JSON.stringify({ success: false, error: 'Callback hours must be at least 1' }), {
            status: 400,
            headers: { 'Content-Type': 'application/json', ...corsHeaders }
          });
        }

        if (customer_care_number !== undefined) updates.push({ setting_key: 'customer_care_number', setting_value: customer_care_number });
        if (customer_care_alt_number !== undefined) updates.push({ setting_key: 'customer_care_alt_number', setting_value: customer_care_alt_number });
        if (customer_care_email !== undefined) updates.push({ setting_key: 'customer_care_email', setting_value: customer_care_email });
        if (customer_care_whatsapp !== undefined) updates.push({ setting_key: 'customer_care_whatsapp', setting_value: customer_care_whatsapp });
        if (customer_care_support_timings !== undefined) updates.push({ setting_key: 'customer_care_support_timings', setting_value: customer_care_support_timings });
        if (customer_care_emergency_number !== undefined) updates.push({ setting_key: 'customer_care_emergency_number', setting_value: customer_care_emergency_number });
        if (support_ticket_sla_hours !== undefined) updates.push({ setting_key: 'support_ticket_sla_hours', setting_value: String(support_ticket_sla_hours) });
        if (support_auto_resolve_days !== undefined) updates.push({ setting_key: 'support_auto_resolve_days', setting_value: String(support_auto_resolve_days) });
        if (customer_care_address !== undefined) updates.push({ setting_key: 'customer_care_address', setting_value: customer_care_address });
        if (customer_care_working_days !== undefined) updates.push({ setting_key: 'customer_care_working_days', setting_value: customer_care_working_days });
        if (customer_care_language !== undefined) updates.push({ setting_key: 'customer_care_language', setting_value: customer_care_language });
        if (customer_care_faq_enabled !== undefined) updates.push({ setting_key: 'customer_care_faq_enabled', setting_value: customer_care_faq_enabled });
        if (customer_care_chat_enabled !== undefined) updates.push({ setting_key: 'customer_care_chat_enabled', setting_value: customer_care_chat_enabled });
        if (customer_care_callback_enabled !== undefined) updates.push({ setting_key: 'customer_care_callback_enabled', setting_value: customer_care_callback_enabled });
        if (customer_care_callback_hours !== undefined) updates.push({ setting_key: 'customer_care_callback_hours', setting_value: String(customer_care_callback_hours) });
        if (customer_care_rating_enabled !== undefined) updates.push({ setting_key: 'customer_care_rating_enabled', setting_value: customer_care_rating_enabled });

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
          message: 'Customer care settings updated successfully',
          updated_fields: updates.map(u => u.setting_key)
        }), {
          status: 200,
          headers: { 'Content-Type': 'application/json', ...corsHeaders }
        });
      }

      // UPDATE FAQ
      if (type === 'faq') {
        const { faq_data } = body;

        if (!faq_data || !Array.isArray(faq_data)) {
          return new Response(JSON.stringify({ success: false, error: 'FAQ data array is required' }), {
            status: 400,
            headers: { 'Content-Type': 'application/json', ...corsHeaders }
          });
        }

        await fetch(`${supabaseUrl}/rest/v1/system_settings`, {
          method: 'POST',
          headers: {
            'apikey': supabaseKey,
            'Authorization': `Bearer ${supabaseKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            setting_key: 'faq_data',
            setting_value: JSON.stringify(faq_data),
            updated_at: new Date().toISOString(),
            updated_by: 'OWN001'
          })
        });

        return new Response(JSON.stringify({
          success: true,
          message: 'FAQ updated successfully',
          count: faq_data.length
        }), {
          status: 200,
          headers: { 'Content-Type': 'application/json', ...corsHeaders }
        });
      }

      // UPDATE AUTO REPLIES
      if (type === 'autoreply') {
        const { auto_replies } = body;

        if (!auto_replies) {
          return new Response(JSON.stringify({ success: false, error: 'Auto replies data is required' }), {
            status: 400,
            headers: { 'Content-Type': 'application/json', ...corsHeaders }
          });
        }

        await fetch(`${supabaseUrl}/rest/v1/system_settings`, {
          method: 'POST',
          headers: {
            'apikey': supabaseKey,
            'Authorization': `Bearer ${supabaseKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            setting_key: 'auto_reply_messages',
            setting_value: JSON.stringify(auto_replies),
            updated_at: new Date().toISOString(),
            updated_by: 'OWN001'
          })
        });

        return new Response(JSON.stringify({
          success: true,
          message: 'Auto replies updated successfully'
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
      console.error('Update customer care error:', error);
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