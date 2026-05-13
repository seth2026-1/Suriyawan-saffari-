// api/customer/service-book.js
// Edge Function for Vercel Deployment

export const config = {
  runtime: 'edge',
  regions: ['iad1', 'sfo1', 'fra1', 'sin1'],
};

// Service types configuration with detailed fields
const SERVICE_CONFIG = {
  vehicle_booking: {
    name: 'Vehicle Booking',
    icon: 'fa-car',
    color: '#3b82f6',
    token_amount: 100,
    description: 'Book a vehicle for your travel needs',
    fields: [
      { name: 'vehicle_type', label: 'Vehicle Type', type: 'select', required: true, options: ['Sedan', 'SUV', 'Hatchback', 'Luxury', 'Tempo Traveller', 'Bus'] },
      { name: 'pickup_location', label: 'Pickup Location', type: 'text', required: true, placeholder: 'Enter pickup address' },
      { name: 'drop_location', label: 'Drop Location', type: 'text', required: true, placeholder: 'Enter drop address' },
      { name: 'travel_date', label: 'Travel Date', type: 'date', required: true },
      { name: 'travel_time', label: 'Travel Time', type: 'time', required: true },
      { name: 'passengers', label: 'Number of Passengers', type: 'number', required: true, min: 1, max: 50 },
      { name: 'luggage', label: 'Luggage (kg)', type: 'number', required: false },
      { name: 'round_trip', label: 'Round Trip', type: 'checkbox', required: false },
      { name: 'special_requests', label: 'Special Requests', type: 'textarea', required: false, placeholder: 'Any special requirements...' }
    ]
  },
  other_booking: {
    name: 'Other Booking',
    icon: 'fa-calendar-alt',
    color: '#8b5cf6',
    token_amount: 50,
    description: 'Book tickets, events, or reservations',
    fields: [
      { name: 'booking_type', label: 'Booking Type', type: 'select', required: true, options: ['Movie Tickets', 'Event Tickets', 'Hotel Booking', 'Flight Booking', 'Train Booking', 'Restaurant Reservation'] },
      { name: 'booking_date', label: 'Booking Date', type: 'date', required: true },
      { name: 'participants', label: 'Number of Participants', type: 'number', required: true, min: 1 },
      { name: 'preferences', label: 'Preferences', type: 'textarea', required: false, placeholder: 'Any specific preferences...' }
    ]
  },
  breakfast_drink: {
    name: 'Breakfast & Drink',
    icon: 'fa-mug-hot',
    color: '#f59e0b',
    token_amount: 50,
    description: 'Order breakfast or beverages',
    fields: [
      { name: 'item_type', label: 'Item Type', type: 'select', required: true, options: ['Breakfast', 'Beverages', 'Snacks', 'Combo Meal'] },
      { name: 'items', label: 'Items', type: 'text', required: true, placeholder: 'Enter items (comma separated)' },
      { name: 'quantity', label: 'Quantity', type: 'number', required: true, min: 1 },
      { name: 'delivery_time', label: 'Delivery Time', type: 'time', required: true },
      { name: 'delivery_address', label: 'Delivery Address', type: 'text', required: true },
      { name: 'special_instructions', label: 'Special Instructions', type: 'textarea', required: false, placeholder: 'Any allergies or special requests...' }
    ]
  },
  send_product: {
    name: 'Send Product',
    icon: 'fa-box',
    color: '#10b981',
    token_amount: 50,
    description: 'Send products to anyone',
    fields: [
      { name: 'product_name', label: 'Product Name', type: 'text', required: true, placeholder: 'Enter product name' },
      { name: 'product_description', label: 'Product Description', type: 'textarea', required: false, placeholder: 'Describe the product' },
      { name: 'receiver_name', label: 'Receiver Name', type: 'text', required: true },
      { name: 'receiver_mobile', label: 'Receiver Mobile', type: 'tel', required: true, pattern: '[0-9]{10}' },
      { name: 'receiver_address', label: 'Receiver Address', type: 'text', required: true },
      { name: 'pickup_time', label: 'Pickup Time', type: 'datetime-local', required: true },
      { name: 'delivery_time', label: 'Expected Delivery', type: 'datetime-local', required: true },
      { name: 'is_fragile', label: 'Fragile Item', type: 'checkbox', required: false },
      { name: 'gift_wrap', label: 'Gift Wrap Required', type: 'checkbox', required: false },
      { name: 'message', label: 'Message for Receiver', type: 'textarea', required: false, placeholder: 'Write a message...' }
    ]
  },
  shadi_card: {
    name: 'Wedding Card Printing',
    icon: 'fa-envelope-open-text',
    color: '#ec4899',
    token_amount: 200,
    description: 'Design and print wedding cards',
    fields: [
      { name: 'card_type', label: 'Card Type', type: 'select', required: true, options: ['Standard', 'Premium', 'Luxury', 'Custom Design'] },
      { name: 'quantity', label: 'Quantity', type: 'number', required: true, min: 50, max: 5000 },
      { name: 'design_preference', label: 'Design Preference', type: 'text', required: false, placeholder: 'Color theme, style...' },
      { name: 'delivery_date', label: 'Delivery Date', type: 'date', required: true },
      { name: 'occasion_date', label: 'Occasion Date', type: 'date', required: true },
      { name: 'groom_name', label: 'Groom Name', type: 'text', required: true },
      { name: 'bride_name', label: 'Bride Name', type: 'text', required: true },
      { name: 'venue', label: 'Venue', type: 'text', required: false },
      { name: 'upload_design', label: 'Upload Custom Design', type: 'file', required: false, accept: 'image/*,application/pdf' }
    ]
  },
  suriyawan_special: {
    name: 'Suriyawan Saffari Special',
    icon: 'fa-crown',
    color: '#facc15',
    token_amount: 500,
    description: 'Premium curated services',
    fields: [
      { name: 'special_package', label: 'Package Type', type: 'select', required: true, options: ['Birthday Celebration', 'Anniversary Special', 'Corporate Event', 'Wedding Package', 'Festival Special', 'Custom Package'] },
      { name: 'occasion', label: 'Occasion', type: 'text', required: true },
      { name: 'budget', label: 'Budget Range', type: 'select', required: true, options: ['₹5,000 - ₹10,000', '₹10,000 - ₹25,000', '₹25,000 - ₹50,000', '₹50,000+'] },
      { name: 'event_date', label: 'Event Date', type: 'date', required: true },
      { name: 'event_time', label: 'Event Time', type: 'time', required: true },
      { name: 'guest_count', label: 'Number of Guests', type: 'number', required: true },
      { name: 'preferences', label: 'Preferences', type: 'textarea', required: false, placeholder: 'Any specific requirements...' },
      { name: 'call_required', label: 'Call Back Required', type: 'checkbox', required: false }
    ]
  },
  ac_repair: {
    name: 'AC Repair',
    icon: 'fa-snowflake',
    color: '#06b6d4',
    token_amount: 100,
    description: 'AC repair and maintenance',
    fields: [
      { name: 'ac_type', label: 'AC Type', type: 'select', required: true, options: ['Window AC', 'Split AC', 'Central AC', 'Portable AC'] },
      { name: 'brand', label: 'Brand', type: 'text', required: true, placeholder: 'Enter brand name' },
      { name: 'capacity', label: 'Capacity (Ton)', type: 'select', required: true, options: ['0.75', '1.0', '1.5', '2.0', '2.5+'] },
      { name: 'issue', label: 'Issue Description', type: 'textarea', required: true, placeholder: 'Describe the problem...' },
      { name: 'service_type', label: 'Service Type', type: 'select', required: true, options: ['Repair', 'Maintenance', 'Gas Refill', 'Installation', 'Removal'] },
      { name: 'preferred_date', label: 'Preferred Date', type: 'date', required: true },
      { name: 'preferred_time', label: 'Preferred Time', type: 'time', required: true },
      { name: 'address', label: 'Service Address', type: 'text', required: true }
    ]
  },
  painter: {
    name: 'Painter',
    icon: 'fa-paintbrush',
    color: '#a855f7',
    token_amount: 100,
    description: 'Professional painting services',
    fields: [
      { name: 'room_type', label: 'Room Type', type: 'select', required: true, options: ['Bedroom', 'Living Room', 'Kitchen', 'Bathroom', 'Exterior Wall', 'Full House'] },
      { name: 'area_sqft', label: 'Area (sq ft)', type: 'number', required: true, placeholder: 'Approximate area' },
      { name: 'paint_type', label: 'Paint Type', type: 'select', required: true, options: ['Emulsion', 'Enamel', 'Distemper', 'Texture', 'Premium'] },
      { name: 'color_preference', label: 'Color Preference', type: 'text', required: false, placeholder: 'Color codes or names' },
      { name: 'walls_count', label: 'Number of Walls', type: 'number', required: false },
      { name: 'additional_work', label: 'Additional Work', type: 'textarea', required: false, placeholder: 'Plastering, putty work etc.' },
      { name: 'start_date', label: 'Preferred Start Date', type: 'date', required: true }
    ]
  },
  electrician: {
    name: 'Electrician',
    icon: 'fa-bolt',
    color: '#f59e0b',
    token_amount: 100,
    description: 'Electrical repair and installation',
    fields: [
      { name: 'work_type', label: 'Work Type', type: 'select', required: true, options: ['Repair', 'Installation', 'Wiring', 'Maintenance', 'Inspection'] },
      { name: 'description', label: 'Problem Description', type: 'textarea', required: true, placeholder: 'Describe the electrical issue...' },
      { name: 'urgent', label: 'Urgent Service', type: 'checkbox', required: false },
      { name: 'equipment_type', label: 'Equipment Type', type: 'text', required: false, placeholder: 'Fan, light, switch, etc.' },
      { name: 'address', label: 'Service Address', type: 'text', required: true }
    ]
  },
  plumber: {
    name: 'Plumber',
    icon: 'fa-wrench',
    color: '#3b82f6',
    token_amount: 100,
    description: 'Plumbing services',
    fields: [
      { name: 'issue_type', label: 'Issue Type', type: 'select', required: true, options: ['Leakage', 'Blockage', 'Installation', 'Repair', 'Maintenance'] },
      { name: 'description', label: 'Problem Description', type: 'textarea', required: true, placeholder: 'Describe the plumbing issue...' },
      { name: 'urgent', label: 'Urgent Service', type: 'checkbox', required: false },
      { name: 'location', label: 'Problem Location', type: 'text', required: false, placeholder: 'Kitchen, bathroom, etc.' },
      { name: 'address', label: 'Service Address', type: 'text', required: true }
    ]
  },
  car_wash: {
    name: 'Car Wash',
    icon: 'fa-car-side',
    color: '#22c55e',
    token_amount: 50,
    description: 'Car cleaning and detailing',
    fields: [
      { name: 'car_model', label: 'Car Model', type: 'text', required: true, placeholder: 'Enter car model' },
      { name: 'car_number', label: 'Car Number', type: 'text', required: true, placeholder: 'Registration number' },
      { name: 'service_type', label: 'Service Type', type: 'select', required: true, options: ['Basic Wash', 'Premium Wash', 'Full Detailing', 'Interior Cleaning', 'AC Disinfection'] },
      { name: 'location', label: 'Car Location', type: 'text', required: true },
      { name: 'preferred_time', label: 'Preferred Time', type: 'datetime-local', required: true }
    ]
  },
  mehndi: {
    name: 'Mehndi Artist',
    icon: 'fa-hand-fist',
    color: '#d946ef',
    token_amount: 200,
    description: 'Professional mehndi application',
    fields: [
      { name: 'occasion', label: 'Occasion', type: 'select', required: true, options: ['Wedding', 'Engagement', 'Baby Shower', 'Festival', 'Party', 'Other'] },
      { name: 'style', label: 'Mehndi Style', type: 'select', required: true, options: ['Arabic', 'Indian', 'Rajasthani', 'Marathi', 'Modern', 'Custom'] },
      { name: 'persons_count', label: 'Number of Persons', type: 'number', required: true, min: 1 },
      { name: 'date', label: 'Event Date', type: 'date', required: true },
      { name: 'time', label: 'Start Time', type: 'time', required: true },
      { name: 'address', label: 'Venue Address', type: 'text', required: true },
      { name: 'special_requests', label: 'Special Requests', type: 'textarea', required: false, placeholder: 'Any specific design preferences...' }
    ]
  },
  catering: {
    name: 'Catering',
    icon: 'fa-utensils',
    color: '#f97316',
    token_amount: 500,
    description: 'Food catering for events',
    fields: [
      { name: 'event_type', label: 'Event Type', type: 'select', required: true, options: ['Wedding', 'Birthday', 'Corporate', 'Family Gathering', 'Festival', 'Other'] },
      { name: 'guest_count', label: 'Number of Guests', type: 'number', required: true, min: 10 },
      { name: 'cuisine', label: 'Cuisine Type', type: 'select', required: true, options: ['North Indian', 'South Indian', 'Chinese', 'Continental', 'Mughlai', 'Mixed'] },
      { name: 'budget_per_plate', label: 'Budget per Plate (₹)', type: 'number', required: true, min: 100 },
      { name: 'event_date', label: 'Event Date', type: 'date', required: true },
      { name: 'event_time', label: 'Event Time', type: 'time', required: true },
      { name: 'venue_address', label: 'Venue Address', type: 'text', required: true },
      { name: 'dietary_requirements', label: 'Dietary Requirements', type: 'textarea', required: false, placeholder: 'Vegan, Jain, Gluten-free etc.' }
    ]
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
            contains: (containsField, containsValue) => ({
              eq: (eqField, eqValue) => ({
                order: (orderField, { ascending }) => ({
                  limit: async (limit) => {
                    const sortOrder = ascending ? 'asc' : 'desc';
                    const finalUrl = `${url}&${field}=eq.${value}&${containsField}=cs.{${containsValue.join(',')}}&${eqField}=eq.${eqValue}&order=${orderField}.${sortOrder}&limit=${limit}`;
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
              })
            }),
            in: (field2, values) => ({
              limit: async (limit) => {
                const finalUrl = `${url}&${field}=eq.${value}&${field2}=in.(${values.join(',')})&limit=${limit}`;
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
    // GET SERVICE CONFIGURATION FOR BOOKING FORM
    // =====================================================
    if (request.method === 'GET') {
      const url = new URL(request.url);
      const service_type = url.searchParams.get('service_type');

      if (!service_type) {
        return new Response(
          JSON.stringify({ success: false, error: 'Service type is required' }),
          { status: 400, headers: { 'Content-Type': 'application/json', ...corsHeaders } }
        );
      }

      const serviceConfig = SERVICE_CONFIG[service_type];

      if (!serviceConfig) {
        return new Response(
          JSON.stringify({ success: false, error: 'Service type not found' }),
          { status: 404, headers: { 'Content-Type': 'application/json', ...corsHeaders } }
        );
      }

      return new Response(
        JSON.stringify({
          success: true,
          service: {
            service_type: service_type,
            name: serviceConfig.name,
            icon: serviceConfig.icon,
            color: serviceConfig.color,
            token_amount: serviceConfig.token_amount,
            description: serviceConfig.description,
            fields: serviceConfig.fields
          }
        }),
        { status: 200, headers: { 'Content-Type': 'application/json', ...corsHeaders } }
      );
    }

    // =====================================================
    // SUBMIT SERVICE BOOKING (POST)
    // =====================================================
    if (request.method === 'POST') {
      const body = await request.json();
      const {
        cust_id,
        service_type,
        scheduled_date,
        scheduled_time,
        address,
        form_data,
        problem_photos
      } = body;

      // Validation
      if (!cust_id || !service_type || !scheduled_date || !scheduled_time || !address) {
        return new Response(
          JSON.stringify({ success: false, error: 'Customer ID, service type, date, time and address are required' }),
          { status: 400, headers: { 'Content-Type': 'application/json', ...corsHeaders } }
        );
      }

      const serviceConfig = SERVICE_CONFIG[service_type];
      if (!serviceConfig) {
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

      // Check if customer has COD block
      if (customer.cod_status === 'BLOCKED') {
        return new Response(
          JSON.stringify({ success: false, error: 'Your account is blocked for COD. Please contact support.' }),
          { status: 403, headers: { 'Content-Type': 'application/json', ...corsHeaders } }
        );
      }

      // Check if time slot is available
      const existingBookingsUrl = `${supabaseUrl}/rest/v1/services?scheduled_date=eq.${scheduled_date}&scheduled_time=eq.${scheduled_time}&service_type=eq.${service_type}&status=in.(PENDING,ACCEPTED,IN_PROGRESS)&select=serv_id&limit=1`;
      const existingBookingsResponse = await fetch(existingBookingsUrl, {
        headers: {
          'apikey': supabaseKey,
          'Authorization': `Bearer ${supabaseKey}`,
        },
      });
      const existingBookings = await existingBookingsResponse.json();

      if (existingBookings && existingBookings.length > 0) {
        return new Response(
          JSON.stringify({ success: false, error: 'This time slot is already booked. Please select another time.' }),
          { status: 400, headers: { 'Content-Type': 'application/json', ...corsHeaders } }
        );
      }

      // Find available expert/seller for this service
      const expertUrl = `${supabaseUrl}/rest/v1/sellers?service_types=cs.{${service_type}}&is_active=eq.true&kyc_status=eq.APPROVED&order=rating.desc&limit=1&select=seller_id,shop_name,rating`;
      const expertResponse = await fetch(expertUrl, {
        headers: {
          'apikey': supabaseKey,
          'Authorization': `Bearer ${supabaseKey}`,
        },
      });
      const expertData = await expertResponse.json();
      const availableExpert = expertData[0];

      // Generate cancel code
      const cancelCode = Math.random().toString(36).substring(2, 10).toUpperCase();
      const cancelCodeExpiry = new Date();
      cancelCodeExpiry.setDate(cancelCodeExpiry.getDate() + 2);

      // Calculate amounts
      const tokenAmount = serviceConfig.token_amount;
      const totalAmount = tokenAmount;

      // Create service booking
      const bookingInsert = await supabase
        .from('services')
        .insert({
          cust_id,
          seller_id: availableExpert?.seller_id || null,
          service_type,
          service_name: serviceConfig.name,
          token_amount: tokenAmount,
          total_amount: totalAmount,
          scheduled_date,
          scheduled_time,
          address,
          problem_description: form_data ? JSON.stringify(form_data) : null,
          problem_photos: problem_photos || null,
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

      // Send notification to customer
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
          title: 'Service Booking Confirmed',
          message: `Your ${serviceConfig.name} booking has been confirmed for ${scheduled_date} at ${scheduled_time}. Booking ID: ${newBooking.serv_id}`,
          type: 'service',
          data: { serv_id: newBooking.serv_id, service_type },
          created_at: new Date().toISOString()
        })
      });

      // Send notification to seller if assigned
      if (availableExpert) {
        await fetch(`${supabaseUrl}/rest/v1/notifications`, {
          method: 'POST',
          headers: {
            'apikey': supabaseKey,
            'Authorization': `Bearer ${supabaseKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            user_id: availableExpert.seller_id,
            user_type: 'seller',
            title: 'New Service Booking',
            message: `New ${serviceConfig.name} booking received for ${scheduled_date} at ${scheduled_time}`,
            type: 'service',
            data: { serv_id: newBooking.serv_id, service_type },
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
            service_name: newBooking.service_name,
            scheduled_date: newBooking.scheduled_date,
            scheduled_time: newBooking.scheduled_time,
            address: newBooking.address,
            token_amount: newBooking.token_amount,
            total_amount: newBooking.total_amount,
            status: newBooking.status,
            cancel_code: newBooking.cancel_code,
            cancel_code_expiry: newBooking.cancel_code_expiry,
            created_at: newBooking.created_at
          }
        }),
        { status: 200, headers: { 'Content-Type': 'application/json', ...corsHeaders } }
      );
    }

    return new Response(
      JSON.stringify({ success: false, error: 'Method not allowed' }),
      { status: 405, headers: { 'Content-Type': 'application/json', ...corsHeaders } }
    );

  } catch (error) {
    console.error('Service booking error:', error);
    return new Response(
      JSON.stringify({ success: false, error: error.message || 'Internal server error' }),
      { status: 500, headers: { 'Content-Type': 'application/json', ...corsHeaders } }
    );
  }
}