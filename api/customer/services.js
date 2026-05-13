// api/customer/services.js
// Edge Function for Vercel Deployment

export const config = {
  runtime: 'edge',
  regions: ['iad1', 'sfo1', 'fra1', 'sin1'],
};

// Define service types with details
const SERVICE_TYPES = {
  vehicle_booking: {
    name: 'Vehicle Booking',
    icon: 'fa-car',
    color: '#3b82f6',
    token_amount: 100,
    description: 'Book a vehicle for your travel needs',
    fields: ['vehicle_type', 'pickup_location', 'drop_location', 'travel_date', 'passengers']
  },
  other_booking: {
    name: 'Other Booking',
    icon: 'fa-calendar-alt',
    color: '#8b5cf6',
    token_amount: 50,
    description: 'Book tickets, events, or reservations',
    fields: ['booking_type', 'date', 'participants']
  },
  breakfast_drink: {
    name: 'Breakfast & Drink',
    icon: 'fa-mug-hot',
    color: '#f59e0b',
    token_amount: 50,
    description: 'Order breakfast or beverages',
    fields: ['item_type', 'quantity', 'delivery_time', 'special_instructions']
  },
  send_product: {
    name: 'Send Product',
    icon: 'fa-box',
    color: '#10b981',
    token_amount: 50,
    description: 'Send products to anyone',
    fields: ['product_name', 'receiver_name', 'receiver_mobile', 'receiver_address', 'pickup_time']
  },
  shadi_card: {
    name: 'Wedding Card Printing',
    icon: 'fa-envelope-open-text',
    color: '#ec4899',
    token_amount: 200,
    description: 'Design and print wedding cards',
    fields: ['card_type', 'quantity', 'design_preference', 'delivery_date', 'occasion_date']
  },
  suriyawan_special: {
    name: 'Suriyawan Saffari Special',
    icon: 'fa-crown',
    color: '#facc15',
    token_amount: 500,
    description: 'Premium curated services',
    fields: ['special_package', 'occasion', 'budget', 'preferences']
  },
  ac_repair: {
    name: 'AC Repair',
    icon: 'fa-snowflake',
    color: '#06b6d4',
    token_amount: 100,
    description: 'AC repair and maintenance',
    fields: ['ac_type', 'issue', 'brand', 'capacity']
  },
  painter: {
    name: 'Painter',
    icon: 'fa-paintbrush',
    color: '#a855f7',
    token_amount: 100,
    description: 'Professional painting services',
    fields: ['room_type', 'area_sqft', 'paint_type', 'color_preference']
  },
  electrician: {
    name: 'Electrician',
    icon: 'fa-bolt',
    color: '#f59e0b',
    token_amount: 100,
    description: 'Electrical repair and installation',
    fields: ['work_type', 'description', 'urgent']
  },
  plumber: {
    name: 'Plumber',
    icon: 'fa-wrench',
    color: '#3b82f6',
    token_amount: 100,
    description: 'Plumbing services',
    fields: ['issue_type', 'description', 'urgent']
  },
  car_wash: {
    name: 'Car Wash',
    icon: 'fa-car-side',
    color: '#22c55e',
    token_amount: 50,
    description: 'Car cleaning and detailing',
    fields: ['car_model', 'service_type', 'location']
  },
  mehndi: {
    name: 'Mehndi Artist',
    icon: 'fa-hand-fist',
    color: '#d946ef',
    token_amount: 200,
    description: 'Professional mehndi application',
    fields: ['occasion', 'style', 'persons_count', 'date']
  },
  catering: {
    name: 'Catering',
    icon: 'fa-utensils',
    color: '#f97316',
    token_amount: 500,
    description: 'Food catering for events',
    fields: ['event_type', 'guest_count', 'cuisine', 'budget_per_plate', 'event_date']
  }
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
            contains: (containsField, containsValue) => ({
              eq: (eqField, eqValue) => ({
                limit: async (limit) => {
                  const finalUrl = `${url}&${field}=eq.${value}&${containsField}=cs.{${containsValue.join(',')}}&${eqField}=eq.${eqValue}&limit=${limit}`;
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
            contains: (containsField, containsValue) => ({
              limit: async (limit) => {
                const finalUrl = `${url}&${field}=eq.${value}&${containsField}=cs.{${containsValue.join(',')}}&limit=${limit}`;
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
      })
    })
  };
}

// Helper functions
function getServiceStatusDisplay(status) {
  const statusMap = {
    'PENDING': 'Pending Confirmation',
    'ACCEPTED': 'Accepted',
    'IN_PROGRESS': 'In Progress',
    'COMPLETED': 'Completed',
    'CANCELLED': 'Cancelled'
  };
  return statusMap[status] || status;
}

async function getServiceStatusCounts(supabase, supabaseUrl, supabaseKey, cust_id) {
  const countsUrl = `${supabaseUrl}/rest/v1/services?cust_id=eq.${cust_id}&select=status`;
  const countsResponse = await fetch(countsUrl, {
    headers: {
      'apikey': supabaseKey,
      'Authorization': `Bearer ${supabaseKey}`,
    },
  });
  const services = await countsResponse.json();

  const counts = {
    all: services?.length || 0,
    PENDING: 0,
    ACCEPTED: 0,
    IN_PROGRESS: 0,
    COMPLETED: 0,
    CANCELLED: 0
  };

  if (services) {
    services.forEach(service => {
      const status = service.status;
      if (counts[status] !== undefined) {
        counts[status]++;
      }
    });
  }

  return counts;
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
    // GET SERVICES (Available services or user bookings)
    // =====================================================
    if (request.method === 'GET') {
      const url = new URL(request.url);
      const cust_id = url.searchParams.get('cust_id');
      const type = url.searchParams.get('type');
      const status = url.searchParams.get('status');
      const page = parseInt(url.searchParams.get('page') || '1');
      const limit = parseInt(url.searchParams.get('limit') || '20');

      // If no cust_id, return available service types
      if (!cust_id) {
        const servicesList = Object.entries(SERVICE_TYPES).map(([key, value]) => ({
          service_type: key,
          name: value.name,
          icon: value.icon,
          color: value.color,
          token_amount: value.token_amount,
          description: value.description,
          fields: value.fields
        }));

        return new Response(
          JSON.stringify({
            success: true,
            services: servicesList,
            total: servicesList.length
          }),
          { status: 200, headers: { 'Content-Type': 'application/json', ...corsHeaders } }
        );
      }

      // Get user's service bookings with seller info
      const bookingsSelect = `*,
        sellers!left (
          seller_id,
          shop_name,
          rating
        )`;
      
      let bookingsUrl = `${supabaseUrl}/rest/v1/services?select=${encodeURIComponent(bookingsSelect)}&cust_id=eq.${cust_id}&order=created_at.desc`;

      if (type && type !== 'all') {
        bookingsUrl += `&service_type=eq.${type}`;
      }

      if (status && status !== 'all') {
        bookingsUrl += `&status=eq.${status}`;
      }

      const from = (page - 1) * limit;
      const to = from + limit - 1;
      bookingsUrl += `&offset=${from}&limit=${limit}`;

      const bookingsResponse = await fetch(bookingsUrl, {
        headers: {
          'apikey': supabaseKey,
          'Authorization': `Bearer ${supabaseKey}`,
        },
      });
      const bookings = await bookingsResponse.json();
      const count = parseInt(bookingsResponse.headers.get('content-range')?.split('/')[1] || '0');

      const formattedBookings = (bookings || []).map(booking => {
        const serviceInfo = SERVICE_TYPES[booking.service_type] || {
          name: booking.service_type,
          icon: 'fa-briefcase',
          color: '#6b7280'
        };

        const canCancel = ['PENDING', 'ACCEPTED'].includes(booking.status) && 
          booking.cancel_code_expiry && new Date(booking.cancel_code_expiry) > new Date();

        return {
          serv_id: booking.serv_id,
          service_type: booking.service_type,
          service_name: serviceInfo.name,
          icon: serviceInfo.icon,
          color: serviceInfo.color,
          token_amount: booking.token_amount,
          balance_amount: booking.balance_amount,
          total_amount: booking.total_amount,
          cancel_code: booking.cancel_code,
          cancel_code_expiry: booking.cancel_code_expiry,
          status: booking.status,
          status_display: getServiceStatusDisplay(booking.status),
          scheduled_date: booking.scheduled_date,
          scheduled_time: booking.scheduled_time,
          address: booking.address,
          problem_description: booking.problem_description,
          problem_photos: booking.problem_photos,
          expert_id: booking.expert_id,
          created_at: booking.created_at,
          completed_at: booking.completed_at,
          rating: booking.rating,
          seller: booking.sellers ? {
            seller_id: booking.sellers.seller_id,
            shop_name: booking.sellers.shop_name,
            rating: booking.sellers.rating
          } : null,
          can_cancel: canCancel,
          can_reschedule: ['PENDING', 'ACCEPTED'].includes(booking.status)
        };
      });

      const statusCounts = await getServiceStatusCounts(supabase, supabaseUrl, supabaseKey, cust_id);

      return new Response(
        JSON.stringify({
          success: true,
          bookings: formattedBookings,
          pagination: {
            current_page: page,
            total_pages: Math.ceil(count / limit),
            total_items: count,
            items_per_page: limit
          },
          status_counts: statusCounts
        }),
        { status: 200, headers: { 'Content-Type': 'application/json', ...corsHeaders } }
      );
    }

    // =====================================================
    // BOOK A SERVICE (POST)
    // =====================================================
    if (request.method === 'POST') {
      const body = await request.json();
      const {
        cust_id,
        service_type,
        scheduled_date,
        scheduled_time,
        address,
        problem_description,
        problem_photos,
        additional_details
      } = body;

      // Validation
      if (!cust_id || !service_type || !scheduled_date || !scheduled_time || !address) {
        return new Response(
          JSON.stringify({ success: false, error: 'Customer ID, service type, date, time and address are required' }),
          { status: 400, headers: { 'Content-Type': 'application/json', ...corsHeaders } }
        );
      }

      if (!SERVICE_TYPES[service_type]) {
        return new Response(
          JSON.stringify({ success: false, error: 'Invalid service type' }),
          { status: 400, headers: { 'Content-Type': 'application/json', ...corsHeaders } }
        );
      }

      // Get customer details
      const customerUrl = `${supabaseUrl}/rest/v1/customers?cust_id=eq.${cust_id}&select=*`;
      const customerResponse = await fetch(customerUrl, {
        headers: {
          'apikey': supabaseKey,
          'Authorization': `Bearer ${supabaseKey}`,
        },
      });
      const customerData = await customerResponse.json();
      const customer = customerData[0];

      if (!customer) {
        return new Response(
          JSON.stringify({ success: false, error: 'Customer not found' }),
          { status: 404, headers: { 'Content-Type': 'application/json', ...corsHeaders } }
        );
      }

      // Find available seller/expert for this service
      const sellerUrl = `${supabaseUrl}/rest/v1/sellers?service_types=cs.{${service_type}}&is_active=eq.true&limit=1&select=seller_id,shop_name`;
      const sellerResponse = await fetch(sellerUrl, {
        headers: {
          'apikey': supabaseKey,
          'Authorization': `Bearer ${supabaseKey}`,
        },
      });
      const sellerData = await sellerResponse.json();
      const availableSeller = sellerData[0];

      // Generate cancel code
      const cancelCode = Math.random().toString(36).substring(2, 10).toUpperCase();
      const cancelCodeExpiry = new Date();
      cancelCodeExpiry.setDate(cancelCodeExpiry.getDate() + 2);

      // Calculate amounts
      const tokenAmount = SERVICE_TYPES[service_type].token_amount;
      let balanceAmount = 0;
      let totalAmount = tokenAmount;

      // Check if time slot is available
      const existingBookingUrl = `${supabaseUrl}/rest/v1/services?scheduled_date=eq.${scheduled_date}&scheduled_time=eq.${scheduled_time}&status=eq.PENDING&select=serv_id&limit=1`;
      const existingBookingResponse = await fetch(existingBookingUrl, {
        headers: {
          'apikey': supabaseKey,
          'Authorization': `Bearer ${supabaseKey}`,
        },
      });
      const existingBookingData = await existingBookingResponse.json();
      const existingBooking = existingBookingData[0];

      if (existingBooking) {
        return new Response(
          JSON.stringify({ success: false, error: 'This time slot is already booked. Please select another time.' }),
          { status: 400, headers: { 'Content-Type': 'application/json', ...corsHeaders } }
        );
      }

      // Create service booking
      const bookingInsert = await supabase
        .from('services')
        .insert({
          cust_id,
          seller_id: availableSeller?.seller_id || null,
          service_type,
          token_amount: tokenAmount,
          balance_amount: balanceAmount,
          total_amount: totalAmount,
          scheduled_date,
          scheduled_time,
          address,
          problem_description: problem_description || null,
          problem_photos: problem_photos || null,
          additional_details: additional_details || null,
          status: 'PENDING',
          cancel_code: cancelCode,
          cancel_code_expiry: cancelCodeExpiry.toISOString(),
          created_at: new Date().toISOString()
        })
        .select();

      if (bookingInsert.error) {
        console.error('Service booking error:', bookingInsert.error);
        return new Response(
          JSON.stringify({ success: false, error: 'Failed to book service' }),
          { status: 500, headers: { 'Content-Type': 'application/json', ...corsHeaders } }
        );
      }

      const newBooking = bookingInsert.data;

      // Send notifications to customer
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
          title: 'Service Booked',
          message: `Your ${SERVICE_TYPES[service_type].name} has been booked successfully. Service ID: ${newBooking.serv_id}`,
          type: 'service',
          data: { serv_id: newBooking.serv_id, service_type },
          created_at: new Date().toISOString()
        })
      });

      // Send notification to seller if assigned
      if (availableSeller) {
        await fetch(`${supabaseUrl}/rest/v1/notifications`, {
          method: 'POST',
          headers: {
            'apikey': supabaseKey,
            'Authorization': `Bearer ${supabaseKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            user_id: availableSeller.seller_id,
            user_type: 'seller',
            title: 'New Service Request',
            message: `New ${SERVICE_TYPES[service_type].name} request received for ${scheduled_date}`,
            type: 'service',
            data: { serv_id: newBooking.serv_id, cust_id },
            created_at: new Date().toISOString()
          })
        });
      }

      return new Response(
        JSON.stringify({
          success: true,
          message: 'Service booked successfully',
          booking: {
            serv_id: newBooking.serv_id,
            service_type: newBooking.service_type,
            service_name: SERVICE_TYPES[service_type].name,
            cancel_code: newBooking.cancel_code,
            cancel_code_expiry: newBooking.cancel_code_expiry,
            token_amount: newBooking.token_amount,
            balance_amount: newBooking.balance_amount,
            total_amount: newBooking.total_amount,
            scheduled_date: newBooking.scheduled_date,
            scheduled_time: newBooking.scheduled_time,
            status: newBooking.status,
            created_at: newBooking.created_at
          }
        }),
        { status: 200, headers: { 'Content-Type': 'application/json', ...corsHeaders } }
      );
    }

    // =====================================================
    // CANCEL SERVICE BOOKING (PUT)
    // =====================================================
    if (request.method === 'PUT') {
      const body = await request.json();
      const { serv_id, cust_id, cancel_code, reason } = body;

      if (!serv_id || !cust_id) {
        return new Response(
          JSON.stringify({ success: false, error: 'Service ID and Customer ID are required' }),
          { status: 400, headers: { 'Content-Type': 'application/json', ...corsHeaders } }
        );
      }

      // Get service booking
      const bookingUrl = `${supabaseUrl}/rest/v1/services?serv_id=eq.${serv_id}&cust_id=eq.${cust_id}&select=*`;
      const bookingResponse = await fetch(bookingUrl, {
        headers: {
          'apikey': supabaseKey,
          'Authorization': `Bearer ${supabaseKey}`,
        },
      });
      const bookingData = await bookingResponse.json();
      const booking = bookingData[0];

      if (!booking) {
        return new Response(
          JSON.stringify({ success: false, error: 'Service booking not found' }),
          { status: 404, headers: { 'Content-Type': 'application/json', ...corsHeaders } }
        );
      }

      // Check if can be cancelled
      if (!['PENDING', 'ACCEPTED'].includes(booking.status)) {
        return new Response(
          JSON.stringify({ success: false, error: `Service cannot be cancelled as it is already ${booking.status.toLowerCase()}` }),
          { status: 400, headers: { 'Content-Type': 'application/json', ...corsHeaders } }
        );
      }

      // Verify cancel code if provided
      if (cancel_code && booking.cancel_code !== cancel_code) {
        return new Response(
          JSON.stringify({ success: false, error: 'Invalid cancel code' }),
          { status: 400, headers: { 'Content-Type': 'application/json', ...corsHeaders } }
        );
      }

      // Check if cancel code expired
      if (booking.cancel_code_expiry && new Date(booking.cancel_code_expiry) < new Date()) {
        return new Response(
          JSON.stringify({ success: false, error: 'Cancel code has expired' }),
          { status: 400, headers: { 'Content-Type': 'application/json', ...corsHeaders } }
        );
      }

      // Update service status to cancelled
      const updateData = {
        status: 'CANCELLED',
        cancelled_at: new Date().toISOString()
      };
      
      if (reason) {
        updateData.additional_details = { ...(booking.additional_details || {}), cancel_reason: reason };
      }

      const updateResult = await supabase
        .from('services')
        .update(updateData)
        .eq('serv_id', serv_id)
        .select();

      if (updateResult.error) {
        return new Response(
          JSON.stringify({ success: false, error: updateResult.error.message }),
          { status: 500, headers: { 'Content-Type': 'application/json', ...corsHeaders } }
        );
      }

      // Send cancellation notification
      const serviceName = SERVICE_TYPES[booking.service_type]?.name || 'service';
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
          title: 'Service Cancelled',
          message: `Your ${serviceName} has been cancelled.`,
          type: 'service',
          data: { serv_id },
          created_at: new Date().toISOString()
        })
      });

      return new Response(
        JSON.stringify({
          success: true,
          message: 'Service cancelled successfully',
          serv_id: serv_id,
          refund_token: booking.token_amount > 0 ? booking.token_amount : 0,
          message_text: booking.token_amount > 0 
            ? `Token amount of ₹${booking.token_amount} will be refunded to your wallet within 3-5 business days.`
            : 'No token amount to refund.'
        }),
        { status: 200, headers: { 'Content-Type': 'application/json', ...corsHeaders } }
      );
    }

    return new Response(
      JSON.stringify({ success: false, error: 'Method not allowed' }),
      { status: 405, headers: { 'Content-Type': 'application/json', ...corsHeaders } }
    );

  } catch (error) {
    console.error('Services error:', error);
    return new Response(
      JSON.stringify({ success: false, error: error.message || 'Internal server error' }),
      { status: 500, headers: { 'Content-Type': 'application/json', ...corsHeaders } }
    );
  }
}