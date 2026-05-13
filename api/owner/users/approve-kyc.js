// api/owner/users/approve-kyc.js
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

        const execute = async (queryModifiers = {}) => {
          let finalUrl = url;

          if (queryModifiers.eq) {
            const [field, value] = Object.entries(queryModifiers.eq)[0];
            finalUrl += `${finalUrl.includes('?') ? '&' : '?'}${field}=eq.${value}`;
          }

          if (queryModifiers.order) {
            finalUrl += `${finalUrl.includes('?') ? '&' : '?'}order=${queryModifiers.order.field}.${queryModifiers.order.ascending ? 'asc' : 'desc'}`;
          }

          if (queryModifiers.range) {
            finalUrl += `${finalUrl.includes('?') ? '&' : '?'}offset=${queryModifiers.range.from}&limit=${queryModifiers.range.to - queryModifiers.range.from + 1}`;
          }

          if (options.count === 'exact') {
            const response = await fetch(finalUrl, {
              method: 'HEAD',
              headers: {
                'apikey': supabaseKey,
                'Authorization': `Bearer ${supabaseKey}`,
              },
            });
            const count = response.headers.get('content-range')?.split('/')[1];
            return { count: count ? parseInt(count) : 0, error: null };
          }

          const response = await fetch(finalUrl, {
            headers: {
              'apikey': supabaseKey,
              'Authorization': `Bearer ${supabaseKey}`,
            },
          });
          const data = await response.json();
          const count = response.headers.get('content-range')?.split('/')[1];
          return { data, error: null, count: count ? parseInt(count) : null };
        };

        return {
          eq: (field, value) => ({
            single: async () => {
              const result = await execute({ eq: { [field]: value } });
              return { data: result.data[0] || null, error: null };
            },
            order: (orderField, { ascending }) => ({
              range: async (from, to) => {
                const result = await execute({
                  eq: { [field]: value },
                  order: { field: orderField, ascending },
                  range: { from, to }
                });
                return result;
              }
            })
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
                'Prefer': 'return=representation'
              },
              body: JSON.stringify(data)
            });
            const result = await response.json();
            return { data: result[0] || result, error: null };
          }
        })
      }),
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
    'Access-Control-Allow-Methods': 'POST, GET, OPTIONS',
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
  // GET PENDING KYC APPLICATIONS
  // =====================================================
  if (request.method === 'GET') {
    try {
      const type = url.searchParams.get('type') || 'seller';
      const page = parseInt(url.searchParams.get('page') || '1');
      const limit = parseInt(url.searchParams.get('limit') || '20');

      let applicationsUrl;
      let statsUrl;
      let count = 0;

      if (type === 'seller') {
        const sellersSelect = `seller_id,shop_name,owner_name,email,mobile,gst_number,pan_number,upi_id,created_at,kyc_documents`;
        applicationsUrl = `${supabaseUrl}/rest/v1/sellers?select=${encodeURIComponent(sellersSelect)}&kyc_status=eq.PENDING&order=created_at.asc&offset=${(page - 1) * limit}&limit=${limit}`;
        statsUrl = `${supabaseUrl}/rest/v1/sellers?select=kyc_status`;
      } else if (type === 'rider') {
        const ridersSelect = `rider_id,name,email,mobile,dl_number,rc_number,aadhar,upi_id,assigned_area,created_at,kyc_documents`;
        applicationsUrl = `${supabaseUrl}/rest/v1/riders?select=${encodeURIComponent(ridersSelect)}&kyc_status=eq.PENDING&order=created_at.asc&offset=${(page - 1) * limit}&limit=${limit}`;
        statsUrl = `${supabaseUrl}/rest/v1/riders?select=kyc_status`;
      } else {
        return new Response(JSON.stringify({ success: false, error: 'Invalid type. Use "seller" or "rider"' }), {
          status: 400,
          headers: { 'Content-Type': 'application/json', ...corsHeaders }
        });
      }

      const applicationsResponse = await fetch(applicationsUrl, {
        headers: {
          'apikey': supabaseKey,
          'Authorization': `Bearer ${supabaseKey}`,
        },
      });
      const applications = await applicationsResponse.json();
      const totalCount = parseInt(applicationsResponse.headers.get('content-range')?.split('/')[1] || '0');

      // Get statistics
      const statsResponse = await fetch(statsUrl, {
        headers: {
          'apikey': supabaseKey,
          'Authorization': `Bearer ${supabaseKey}`,
        },
      });
      const allData = await statsResponse.json();

      let stats;
      if (type === 'seller') {
        stats = {
          total: allData?.length || 0,
          pending: allData?.filter(s => s.kyc_status === 'PENDING').length || 0,
          approved: allData?.filter(s => s.kyc_status === 'APPROVED').length || 0,
          rejected: allData?.filter(s => s.kyc_status === 'REJECTED').length || 0
        };
      } else {
        stats = {
          total: allData?.length || 0,
          pending: allData?.filter(r => r.kyc_status === 'PENDING').length || 0,
          approved: allData?.filter(r => r.kyc_status === 'APPROVED').length || 0,
          rejected: allData?.filter(r => r.kyc_status === 'REJECTED').length || 0
        };
      }

      return new Response(JSON.stringify({
        success: true,
        applications: applications,
        stats: stats,
        pagination: {
          current_page: page,
          total_pages: Math.ceil(totalCount / limit),
          total_items: totalCount,
          items_per_page: limit
        }
      }), {
        status: 200,
        headers: { 'Content-Type': 'application/json', ...corsHeaders }
      });

    } catch (error) {
      console.error('Get KYC applications error:', error);
      return new Response(JSON.stringify({ success: false, error: error.message }), {
        status: 500,
        headers: { 'Content-Type': 'application/json', ...corsHeaders }
      });
    }
  }

  // =====================================================
  // APPROVE/REJECT KYC (POST)
  // =====================================================
  if (request.method === 'POST') {
    try {
      const body = await request.json();
      const {
        user_id,
        user_type,
        action,
        reason,
        commission_rate,
        rate_per_parcel
      } = body;

      if (!user_id || !user_type || !action) {
        return new Response(JSON.stringify({
          success: false,
          error: 'User ID, user type and action are required'
        }), {
          status: 400,
          headers: { 'Content-Type': 'application/json', ...corsHeaders }
        });
      }

      if (!['approve', 'reject'].includes(action)) {
        return new Response(JSON.stringify({ success: false, error: 'Invalid action' }), {
          status: 400,
          headers: { 'Content-Type': 'application/json', ...corsHeaders }
        });
      }

      let result;
      let message = '';
      let notificationTitle = '';
      let notificationMessage = '';

      if (user_type === 'seller') {
        // Get seller details
        const sellerUrl = `${supabaseUrl}/rest/v1/sellers?select=shop_name,owner_name,email,commission_rate&seller_id=eq.${user_id}`;
        const sellerResponse = await fetch(sellerUrl, {
          headers: {
            'apikey': supabaseKey,
            'Authorization': `Bearer ${supabaseKey}`,
          },
        });
        const sellerData = await sellerResponse.json();
        const seller = sellerData[0];

        if (!seller) {
          return new Response(JSON.stringify({ success: false, error: 'Seller not found' }), {
            status: 404,
            headers: { 'Content-Type': 'application/json', ...corsHeaders }
          });
        }

        const updateData = {
          kyc_status: action === 'approve' ? 'APPROVED' : 'REJECTED',
          updated_at: new Date().toISOString()
        };

        if (action === 'approve' && commission_rate) {
          updateData.commission_rate = commission_rate;
          updateData.is_active = true;
        }

        const updateResult = await supabase
          .from('sellers')
          .update(updateData)
          .eq('seller_id', user_id)
          .select();

        if (updateResult.error) throw updateResult.error;
        result = updateResult.data;

        message = action === 'approve' ? 'Seller KYC approved successfully' : 'Seller KYC rejected';
        notificationTitle = action === 'approve' ? 'KYC Approved! 🎉' : 'KYC Update';
        notificationMessage = action === 'approve'
          ? `Dear ${seller.owner_name}, your KYC has been approved. You can now start selling on Suriyawan Saffari. Your commission rate is ${updateData.commission_rate || seller.commission_rate}%.`
          : `Dear ${seller.owner_name}, your KYC application has been rejected. Reason: ${reason || 'Please contact support for more details.'}`;

      } else if (user_type === 'rider') {
        // Get rider details
        const riderUrl = `${supabaseUrl}/rest/v1/riders?select=name,email&rider_id=eq.${user_id}`;
        const riderResponse = await fetch(riderUrl, {
          headers: {
            'apikey': supabaseKey,
            'Authorization': `Bearer ${supabaseKey}`,
          },
        });
        const riderData = await riderResponse.json();
        const rider = riderData[0];

        if (!rider) {
          return new Response(JSON.stringify({ success: false, error: 'Rider not found' }), {
            status: 404,
            headers: { 'Content-Type': 'application/json', ...corsHeaders }
          });
        }

        const updateData = {
          kyc_status: action === 'approve' ? 'APPROVED' : 'REJECTED',
          updated_at: new Date().toISOString()
        };

        if (action === 'approve' && rate_per_parcel) {
          updateData.rate_per_parcel = rate_per_parcel;
          updateData.is_active = true;
        }

        const updateResult = await supabase
          .from('riders')
          .update(updateData)
          .eq('rider_id', user_id)
          .select();

        if (updateResult.error) throw updateResult.error;
        result = updateResult.data;

        message = action === 'approve' ? 'Rider KYC approved successfully' : 'Rider KYC rejected';
        notificationTitle = action === 'approve' ? 'KYC Approved! 🎉' : 'KYC Update';
        notificationMessage = action === 'approve'
          ? `Dear ${rider.name}, your KYC has been approved. You can now start accepting deliveries. Your rate per parcel is ₹${updateData.rate_per_parcel || 18}.`
          : `Dear ${rider.name}, your KYC application has been rejected. Reason: ${reason || 'Please contact support for more details.'}`;

      } else {
        return new Response(JSON.stringify({ success: false, error: 'Invalid user type. Use "seller" or "rider"' }), {
          status: 400,
          headers: { 'Content-Type': 'application/json', ...corsHeaders }
        });
      }

      // Send notification to user
      await fetch(`${supabaseUrl}/rest/v1/notifications`, {
        method: 'POST',
        headers: {
          'apikey': supabaseKey,
          'Authorization': `Bearer ${supabaseKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          user_id: user_id,
          user_type: user_type,
          title: notificationTitle,
          message: notificationMessage,
          type: 'kyc',
          data: { kyc_status: action === 'approve' ? 'APPROVED' : 'REJECTED', reason: reason },
          created_at: new Date().toISOString()
        })
      });

      // If approved, send additional welcome info
      if (action === 'approve') {
        if (user_type === 'seller') {
          await fetch(`${supabaseUrl}/rest/v1/notifications`, {
            method: 'POST',
            headers: {
              'apikey': supabaseKey,
              'Authorization': `Bearer ${supabaseKey}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              user_id: user_id,
              user_type: 'seller',
              title: 'Welcome to Selling! 📦',
              message: 'Start adding your products. Remember to upload high-quality images and accurate descriptions.',
              type: 'onboarding',
              data: { step: 'add_products' },
              created_at: new Date().toISOString()
            })
          });
        } else if (user_type === 'rider') {
          await fetch(`${supabaseUrl}/rest/v1/notifications`, {
            method: 'POST',
            headers: {
              'apikey': supabaseKey,
              'Authorization': `Bearer ${supabaseKey}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              user_id: user_id,
              user_type: 'rider',
              title: 'Welcome to Delivery! 🛵',
              message: 'You can now accept runsheets and start delivering. Download the rider app to get started.',
              type: 'onboarding',
              data: { step: 'accept_runsheets' },
              created_at: new Date().toISOString()
            })
          });
        }
      }

      return new Response(JSON.stringify({
        success: true,
        message: message,
        user: result,
        kyc_status: action === 'approve' ? 'APPROVED' : 'REJECTED'
      }), {
        status: 200,
        headers: { 'Content-Type': 'application/json', ...corsHeaders }
      });

    } catch (error) {
      console.error('KYC action error:', error);
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