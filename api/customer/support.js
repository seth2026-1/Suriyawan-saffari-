// api/customer/support.js
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
            in: (field2, values) => ({
              select: async (columns2) => {
                const finalUrl = `${url}&${field}=eq.${value}&${field2}=in.(${values.join(',')})&select=${columns2 || '*'}`;
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
              range: async (from, to) => {
                const sortOrder = ascending ? 'asc' : 'desc';
                const finalUrl = `${url}&${field}=eq.${value}&order=${orderField}.${sortOrder}&offset=${from}&limit=${to - from + 1}`;
                const response = await fetch(finalUrl, {
                  headers: {
                    'apikey': supabaseKey,
                    'Authorization': `Bearer ${supabaseKey}`,
                  },
                });
                const data = await response.json();
                const count = response.headers.get('content-range')?.split('/')[1];
                return { data, error: null, count: count ? parseInt(count) : null };
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
            in: (field2, values) => ({
              select: async (columns2) => {
                const finalUrl = `${url}&${field}=eq.${value}&${field2}=in.(${values.join(',')})&select=${columns2 || '*'}`;
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
              range: async (from, to) => {
                const sortOrder = ascending ? 'asc' : 'desc';
                const finalUrl = `${url}&${field}=eq.${value}&order=${orderField}.${sortOrder}&offset=${from}&limit=${to - from + 1}`;
                const response = await fetch(finalUrl, {
                  headers: {
                    'apikey': supabaseKey,
                    'Authorization': `Bearer ${supabaseKey}`,
                  },
                });
                const data = await response.json();
                const count = response.headers.get('content-range')?.split('/')[1];
                return { data, error: null, count: count ? parseInt(count) : null };
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

export default async function handler(request) {
  // CORS Headers
  const corsHeaders = {
    'Access-Control-Allow-Credentials': 'true',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, PUT, OPTIONS',
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
    // GET SUPPORT TICKETS / FAQ / CONTACT INFO
    // =====================================================
    if (request.method === 'GET') {
      const url = new URL(request.url);
      const cust_id = url.searchParams.get('cust_id');
      const ticket_id = url.searchParams.get('ticket_id');
      const type = url.searchParams.get('type') || 'all';
      const page = parseInt(url.searchParams.get('page') || '1');
      const limit = parseInt(url.searchParams.get('limit') || '20');

      // Get customer care settings
      const settingsUrl = `${supabaseUrl}/rest/v1/system_settings?setting_key=in.(customer_care_number,customer_care_email,customer_care_whatsapp,support_timings,sla_hours)&select=setting_key,setting_value`;
      const settingsResponse = await fetch(settingsUrl, {
        headers: {
          'apikey': supabaseKey,
          'Authorization': `Bearer ${supabaseKey}`,
        },
      });
      const settingsData = await settingsResponse.json();
      const settings = settingsData || [];

      const customerCare = {
        phone: settings.find(s => s.setting_key === 'customer_care_number')?.setting_value || '1800-xxx-xxx',
        email: settings.find(s => s.setting_key === 'customer_care_email')?.setting_value || 'support@suriyawansaffari.com',
        whatsapp: settings.find(s => s.setting_key === 'customer_care_whatsapp')?.setting_value || '91xxxxxxxxxx',
        timings: settings.find(s => s.setting_key === 'support_timings')?.setting_value || '10:00 AM - 7:00 PM, Monday to Saturday',
        slaHours: parseInt(settings.find(s => s.setting_key === 'sla_hours')?.setting_value || 24)
      };

      // Get FAQ data
      const faqUrl = `${supabaseUrl}/rest/v1/system_settings?setting_key=eq.faq_data&select=setting_value`;
      const faqResponse = await fetch(faqUrl, {
        headers: {
          'apikey': supabaseKey,
          'Authorization': `Bearer ${supabaseKey}`,
        },
      });
      const faqData = await faqResponse.json();
      const faqSetting = faqData[0];

      let faqs = [];
      if (faqSetting && faqSetting.setting_value) {
        try {
          faqs = JSON.parse(faqSetting.setting_value);
        } catch (e) {}
      } else {
        // Default FAQs
        faqs = [
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

      // If specific ticket ID requested
      if (ticket_id) {
        const ticketUrl = `${supabaseUrl}/rest/v1/support_tickets?ticket_id=eq.${ticket_id}&select=*`;
        const ticketResponse = await fetch(ticketUrl, {
          headers: {
            'apikey': supabaseKey,
            'Authorization': `Bearer ${supabaseKey}`,
          },
        });
        const ticketData = await ticketResponse.json();
        const ticket = ticketData[0];

        if (!ticket) {
          return new Response(
            JSON.stringify({ success: false, error: 'Ticket not found' }),
            { status: 404, headers: { 'Content-Type': 'application/json', ...corsHeaders } }
          );
        }

        // Verify ownership
        if (cust_id && ticket.user_id !== cust_id) {
          return new Response(
            JSON.stringify({ success: false, error: 'Unauthorized' }),
            { status: 403, headers: { 'Content-Type': 'application/json', ...corsHeaders } }
          );
        }

        return new Response(
          JSON.stringify({
            success: true,
            ticket: {
              ticket_id: ticket.ticket_id,
              category: ticket.category,
              subject: ticket.subject,
              message: ticket.message,
              photo: ticket.photo,
              status: ticket.status,
              priority: ticket.priority,
              created_at: ticket.created_at,
              sla_deadline: ticket.sla_deadline,
              resolution: ticket.resolution,
              resolved_at: ticket.resolved_at,
              rating: ticket.rating
            }
          }),
          { status: 200, headers: { 'Content-Type': 'application/json', ...corsHeaders } }
        );
      }

      // Get user's tickets
      let ticketsUrl = `${supabaseUrl}/rest/v1/support_tickets?order=created_at.desc&select=*`;

      if (cust_id) {
        ticketsUrl += `&user_id=eq.${cust_id}&user_type=eq.customer`;
      }

      if (type !== 'all') {
        ticketsUrl += `&status=eq.${type.toUpperCase()}`;
      }

      const from = (page - 1) * limit;
      const to = from + limit - 1;
      ticketsUrl += `&offset=${from}&limit=${limit}`;

      const ticketsResponse = await fetch(ticketsUrl, {
        headers: {
          'apikey': supabaseKey,
          'Authorization': `Bearer ${supabaseKey}`,
        },
      });
      const tickets = await ticketsResponse.json();
      const count = parseInt(ticketsResponse.headers.get('content-range')?.split('/')[1] || '0');

      // Get ticket categories
      const categories = [
        { value: 'order', label: 'Order Related', icon: 'fa-box' },
        { value: 'payment', label: 'Payment Issue', icon: 'fa-rupee-sign' },
        { value: 'delivery', label: 'Delivery Problem', icon: 'fa-truck' },
        { value: 'product', label: 'Product Issue', icon: 'fa-tag' },
        { value: 'return', label: 'Return/Exchange', icon: 'fa-undo' },
        { value: 'account', label: 'Account Issue', icon: 'fa-user' },
        { value: 'cod_block', label: 'COD Block', icon: 'fa-ban' },
        { value: 'wallet', label: 'Wallet/Coins', icon: 'fa-coins' },
        { value: 'seller', label: 'Seller Related', icon: 'fa-store' },
        { value: 'other', label: 'Other', icon: 'fa-question' }
      ];

      return new Response(
        JSON.stringify({
          success: true,
          customer_care: customerCare,
          faqs: faqs,
          categories: categories,
          tickets: (tickets || []).map(t => ({
            ticket_id: t.ticket_id,
            category: t.category,
            subject: t.subject,
            message: (t.message || '').substring(0, 100),
            status: t.status,
            priority: t.priority,
            created_at: t.created_at,
            sla_deadline: t.sla_deadline,
            is_resolved: t.status === 'RESOLVED' || t.status === 'CLOSED'
          })),
          pagination: {
            current_page: page,
            total_pages: Math.ceil(count / limit),
            total_items: count,
            items_per_page: limit
          }
        }),
        { status: 200, headers: { 'Content-Type': 'application/json', ...corsHeaders } }
      );
    }

    // =====================================================
    // CREATE SUPPORT TICKET (POST)
    // =====================================================
    if (request.method === 'POST') {
      const body = await request.json();
      const {
        cust_id,
        name,
        email,
        mobile,
        category,
        subject,
        message,
        photo,
        order_id,
        priority = 'MEDIUM'
      } = body;

      // Validation
      if (!cust_id || !category || !subject || !message) {
        return new Response(
          JSON.stringify({ success: false, error: 'Customer ID, category, subject and message are required' }),
          { status: 400, headers: { 'Content-Type': 'application/json', ...corsHeaders } }
        );
      }

      // Get customer details if not provided
      let customerName = name;
      let customerEmail = email;
      let customerMobile = mobile;

      if (!customerName || !customerEmail) {
        const customerUrl = `${supabaseUrl}/rest/v1/customers?cust_id=eq.${cust_id}&select=name,email,mobile`;
        const customerResponse = await fetch(customerUrl, {
          headers: {
            'apikey': supabaseKey,
            'Authorization': `Bearer ${supabaseKey}`,
          },
        });
        const customerData = await customerResponse.json();
        const customer = customerData[0];

        if (customer) {
          customerName = customerName || customer.name;
          customerEmail = customerEmail || customer.email;
          customerMobile = customerMobile || customer.mobile;
        }
      }

      // Generate SLA deadline (48 hours from now)
      const slaDeadline = new Date();
      slaDeadline.setHours(slaDeadline.getHours() + 48);

      // Generate ticket ID
      const ticketId = 'TKT' + Date.now() + Math.random().toString(36).substring(2, 6).toUpperCase();

      // Create ticket
      const ticketInsert = await supabase
        .from('support_tickets')
        .insert({
          ticket_id: ticketId,
          user_id: cust_id,
          user_type: 'customer',
          user_name: customerName,
          user_email: customerEmail,
          user_mobile: customerMobile,
          category: category,
          subject: subject,
          message: message,
          photo: photo || null,
          priority: priority,
          status: 'OPEN',
          order_id: order_id || null,
          sla_deadline: slaDeadline.toISOString(),
          created_at: new Date().toISOString()
        })
        .select();

      if (ticketInsert.error) {
        console.error('Ticket creation error:', ticketInsert.error);
        return new Response(
          JSON.stringify({ success: false, error: 'Failed to create support ticket' }),
          { status: 500, headers: { 'Content-Type': 'application/json', ...corsHeaders } }
        );
      }

      const ticket = ticketInsert.data;

      // Send confirmation notification to customer
      await fetch(`${supabaseUrl}/rest/v1/notifications`, {
        method: 'POST',
        headers: {
          'apikey': supabaseKey,
          'Authorization': `Bearer ${supabaseKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          user_id: cust_id,
          user_type: 'customer',
          title: 'Support Ticket Created',
          message: `Your ticket #${ticket.ticket_id} has been created. We will respond within 24 hours.`,
          type: 'support',
          data: { ticket_id: ticket.ticket_id },
          created_at: new Date().toISOString()
        })
      });

      // Notify support team (owner)
      await fetch(`${supabaseUrl}/rest/v1/notifications`, {
        method: 'POST',
        headers: {
          'apikey': supabaseKey,
          'Authorization': `Bearer ${supabaseKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          user_id: 'OWN001',
          user_type: 'owner',
          title: 'New Support Ticket',
          message: `New ticket #${ticket.ticket_id} from ${customerName}: ${subject}`,
          type: 'support',
          data: { ticket_id: ticket.ticket_id, cust_id },
          created_at: new Date().toISOString()
        })
      });

      return new Response(
        JSON.stringify({
          success: true,
          message: 'Support ticket created successfully',
          ticket: {
            ticket_id: ticket.ticket_id,
            status: ticket.status,
            sla_deadline: ticket.sla_deadline,
            created_at: ticket.created_at,
            category: ticket.category,
            subject: ticket.subject
          }
        }),
        { status: 200, headers: { 'Content-Type': 'application/json', ...corsHeaders } }
      );
    }

    // =====================================================
    // UPDATE TICKET RATING (PUT)
    // =====================================================
    if (request.method === 'PUT') {
      const body = await request.json();
      const { ticket_id, cust_id, rating } = body;

      if (!ticket_id || !cust_id || !rating) {
        return new Response(
          JSON.stringify({ success: false, error: 'Ticket ID, Customer ID and rating are required' }),
          { status: 400, headers: { 'Content-Type': 'application/json', ...corsHeaders } }
        );
      }

      if (rating < 1 || rating > 5) {
        return new Response(
          JSON.stringify({ success: false, error: 'Rating must be between 1 and 5' }),
          { status: 400, headers: { 'Content-Type': 'application/json', ...corsHeaders } }
        );
      }

      // Verify ticket belongs to customer
      const ticketUrl = `${supabaseUrl}/rest/v1/support_tickets?ticket_id=eq.${ticket_id}&select=ticket_id,user_id,status`;
      const ticketResponse = await fetch(ticketUrl, {
        headers: {
          'apikey': supabaseKey,
          'Authorization': `Bearer ${supabaseKey}`,
        },
      });
      const ticketData = await ticketResponse.json();
      const ticket = ticketData[0];

      if (!ticket) {
        return new Response(
          JSON.stringify({ success: false, error: 'Ticket not found' }),
          { status: 404, headers: { 'Content-Type': 'application/json', ...corsHeaders } }
        );
      }

      if (ticket.user_id !== cust_id) {
        return new Response(
          JSON.stringify({ success: false, error: 'Unauthorized' }),
          { status: 403, headers: { 'Content-Type': 'application/json', ...corsHeaders } }
        );
      }

      if (ticket.status !== 'RESOLVED' && ticket.status !== 'CLOSED') {
        return new Response(
          JSON.stringify({ success: false, error: 'Can only rate resolved tickets' }),
          { status: 400, headers: { 'Content-Type': 'application/json', ...corsHeaders } }
        );
      }

      // Update rating
      await fetch(`${supabaseUrl}/rest/v1/support_tickets?ticket_id=eq.${ticket_id}`, {
        method: 'PATCH',
        headers: {
          'apikey': supabaseKey,
          'Authorization': `Bearer ${supabaseKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ rating: rating, closed_at: new Date().toISOString() })
      });

      // Get coin setting
      const coinSettingUrl = `${supabaseUrl}/rest/v1/system_settings?setting_key=eq.coins_per_ticket_rating&select=setting_value`;
      const coinSettingResponse = await fetch(coinSettingUrl, {
        headers: {
          'apikey': supabaseKey,
          'Authorization': `Bearer ${supabaseKey}`,
        },
      });
      const coinSettingData = await coinSettingResponse.json();
      const coinSetting = coinSettingData[0];
      const coinsToAdd = coinSetting ? parseInt(coinSetting.setting_value) : 5;

      // Add coins for rating (bonus)
      await fetch(`${supabaseUrl}/rest/v1/coin_transactions`, {
        method: 'POST',
        headers: {
          'apikey': supabaseKey,
          'Authorization': `Bearer ${supabaseKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          cust_id: cust_id,
          coins: coinsToAdd,
          type: 'credit',
          reason: `Support ticket rating for #${ticket_id}`,
          created_at: new Date().toISOString()
        })
      });

      // Update customer coins
      const currentCustomerUrl = `${supabaseUrl}/rest/v1/customers?cust_id=eq.${cust_id}&select=coins`;
      const currentCustomerResponse = await fetch(currentCustomerUrl, {
        headers: {
          'apikey': supabaseKey,
          'Authorization': `Bearer ${supabaseKey}`,
        },
      });
      const currentCustomerData = await currentCustomerResponse.json();
      const currentCustomer = currentCustomerData[0];

      await fetch(`${supabaseUrl}/rest/v1/customers?cust_id=eq.${cust_id}`, {
        method: 'PATCH',
        headers: {
          'apikey': supabaseKey,
          'Authorization': `Bearer ${supabaseKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ coins: (currentCustomer?.coins || 0) + coinsToAdd })
      });

      return new Response(
        JSON.stringify({
          success: true,
          message: 'Thank you for your feedback!',
          rating: rating,
          coins_earned: coinsToAdd
        }),
        { status: 200, headers: { 'Content-Type': 'application/json', ...corsHeaders } }
      );
    }

    return new Response(
      JSON.stringify({ success: false, error: 'Method not allowed' }),
      { status: 405, headers: { 'Content-Type': 'application/json', ...corsHeaders } }
    );

  } catch (error) {
    console.error('Support error:', error);
    return new Response(
      JSON.stringify({ success: false, error: error.message || 'Internal server error' }),
      { status: 500, headers: { 'Content-Type': 'application/json', ...corsHeaders } }
    );
  }
}