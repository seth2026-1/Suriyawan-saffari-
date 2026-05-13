// api/logistics/rider/profile.js
// Edge Function for Vercel Deployment

export const config = {
  runtime: 'edge',
  regions: ['iad1', 'sfo1', 'fra1', 'sin1'],
};

// Helper function to mask UPI ID
function maskUpi(upiId) {
  if (!upiId) return '';
  if (upiId.length <= 6) return '***' + upiId.slice(-3);
  return upiId.slice(0, 3) + '***' + upiId.slice(-4);
}

// Helper function to mask Aadhar number
function maskAadhar(aadhar) {
  if (!aadhar) return '';
  if (aadhar.length <= 8) return '****' + aadhar.slice(-4);
  return '**** **** ' + aadhar.slice(-4);
}

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
            neq: (neqField, neqValue) => ({
              maybeSingle: async () => {
                const finalUrl = `${url}&${field}=eq.${value}&${neqField}=neq.${neqValue}`;
                const response = await fetch(finalUrl, {
                  headers: {
                    'apikey': supabaseKey,
                    'Authorization': `Bearer ${supabaseKey}`,
                  },
                });
                const data = await response.json();
                return { data: data[0] || null, error: null };
              }
            }),
            gte: (gteField, gteValue) => ({
              lte: (lteField, lteValue) => ({
                select: async () => {
                  const finalUrl = `${url}&${field}=eq.${value}&${gteField}=gte.${gteValue}&${lteField}=lte.${lteValue}`;
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
            }),
            order: (orderField, { ascending }) => ({
              limit: async (limit) => {
                const sortOrder = ascending ? 'asc' : 'desc';
                const finalUrl = `${url}&${field}=eq.${value}&order=${orderField}.${sortOrder}&limit=${limit}`;
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
            order: (orderField, { ascending }) => ({
              limit: async (limit) => {
                const sortOrder = ascending ? 'asc' : 'desc';
                const finalUrl = `${url}&${field}=eq.${value}&order=${orderField}.${sortOrder}&limit=${limit}`;
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

  const url = new URL(request.url);

  // =====================================================
  // GET RIDER PROFILE
  // =====================================================
  if (request.method === 'GET') {
    try {
      const rider_id = url.searchParams.get('rider_id');

      if (!rider_id) {
        return new Response(JSON.stringify({ success: false, error: 'Rider ID is required' }), {
          status: 400,
          headers: { 'Content-Type': 'application/json', ...corsHeaders }
        });
      }

      const supabase = createSupabaseClient();
      const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
      const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

      // Get rider profile
      const riderSelect = `rider_id,name,email,mobile,upi_id,dl_number,rc_number,aadhar,fingerprint_data,assigned_area,assigned_pincodes,rate_per_parcel,pickup_rate,rating,total_deliveries,total_pickups,wallet_balance,is_online,is_active,created_at,updated_at`;
      const riderUrl = `${supabaseUrl}/rest/v1/riders?select=${riderSelect}&rider_id=eq.${rider_id}`;
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

      // Get document verification status
      const docsUrl = `${supabaseUrl}/rest/v1/rider_documents?select=*&rider_id=eq.${rider_id}`;
      const docsResponse = await fetch(docsUrl, {
        headers: {
          'apikey': supabaseKey,
          'Authorization': `Bearer ${supabaseKey}`,
        },
      });
      const documents = await docsResponse.json();

      // Get bank details
      const bankUrl = `${supabaseUrl}/rest/v1/rider_bank_details?select=*&rider_id=eq.${rider_id}`;
      const bankResponse = await fetch(bankUrl, {
        headers: {
          'apikey': supabaseKey,
          'Authorization': `Bearer ${supabaseKey}`,
        },
      });
      const bankData = await bankResponse.json();
      const bankDetails = bankData[0] || null;

      // Get performance metrics for last 30 days
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
      const thirtyDaysAgoStr = thirtyDaysAgo.toISOString();

      const runsheetsUrl = `${supabaseUrl}/rest/v1/runsheets?select=total_deliveries,total_pickups,status&rider_id=eq.${rider_id}&created_at=gte.${thirtyDaysAgoStr}`;
      const runsheetsResponse = await fetch(runsheetsUrl, {
        headers: {
          'apikey': supabaseKey,
          'Authorization': `Bearer ${supabaseKey}`,
        },
      });
      const monthRunsheets = await runsheetsResponse.json();

      const monthDeliveries = monthRunsheets?.reduce((sum, r) => sum + (r.total_deliveries || 0), 0) || 0;
      const monthPickups = monthRunsheets?.reduce((sum, r) => sum + (r.total_pickups || 0), 0) || 0;
      const monthCompleted = monthRunsheets?.filter(r => r.status === 'COMPLETED').length || 0;

      // Get recent ratings
      const reviewsUrl = `${supabaseUrl}/rest/v1/rider_reviews?select=rating,comment,created_at&rider_id=eq.${rider_id}&order=created_at.desc&limit=10`;
      const reviewsResponse = await fetch(reviewsUrl, {
        headers: {
          'apikey': supabaseKey,
          'Authorization': `Bearer ${supabaseKey}`,
        },
      });
      const reviews = await reviewsResponse.json();

      const avgRating = reviews?.reduce((sum, r) => sum + r.rating, 0) / (reviews?.length || 1) || rider.rating || 0;

      // Check document status
      const documentStatus = {
        dl_verified: documents?.find(d => d.type === 'dl')?.is_verified || false,
        rc_verified: documents?.find(d => d.type === 'rc')?.is_verified || false,
        aadhar_verified: documents?.find(d => d.type === 'aadhar')?.is_verified || false,
        bank_verified: bankDetails?.is_verified || false,
        all_verified: false
      };
      documentStatus.all_verified = documentStatus.dl_verified &&
                                    documentStatus.rc_verified &&
                                    documentStatus.aadhar_verified &&
                                    documentStatus.bank_verified;

      return new Response(JSON.stringify({
        success: true,
        profile: {
          rider_id: rider.rider_id,
          name: rider.name,
          email: rider.email,
          mobile: rider.mobile,
          upi_id: rider.upi_id ? maskUpi(rider.upi_id) : null,
          upi_id_full: rider.upi_id,
          dl_number: rider.dl_number,
          rc_number: rider.rc_number,
          aadhar: rider.aadhar ? maskAadhar(rider.aadhar) : null,
          has_fingerprint: !!rider.fingerprint_data,
          assigned_area: rider.assigned_area,
          assigned_pincodes: rider.assigned_pincodes,
          rate_per_parcel: rider.rate_per_parcel,
          pickup_rate: rider.pickup_rate,
          rating: parseFloat(avgRating.toFixed(1)),
          total_deliveries: rider.total_deliveries || 0,
          total_pickups: rider.total_pickups || 0,
          wallet_balance: rider.wallet_balance || 0,
          is_online: rider.is_online,
          is_active: rider.is_active,
          created_at: rider.created_at
        },
        documents: documents || [],
        bank_details: bankDetails || null,
        document_status: documentStatus,
        performance: {
          month_deliveries: monthDeliveries,
          month_pickups: monthPickups,
          month_completed_runsheets: monthCompleted,
          completion_rate: monthRunsheets?.length > 0 ? (monthCompleted / monthRunsheets.length) * 100 : 0
        },
        recent_reviews: reviews?.map(r => ({
          rating: r.rating,
          comment: r.comment,
          created_at: r.created_at
        })) || [],
        kyc_status: documentStatus.all_verified ? 'VERIFIED' : 'PENDING'
      }), {
        status: 200,
        headers: { 'Content-Type': 'application/json', ...corsHeaders }
      });

    } catch (error) {
      console.error('Get rider profile error:', error);
      return new Response(JSON.stringify({ success: false, error: error.message }), {
        status: 500,
        headers: { 'Content-Type': 'application/json', ...corsHeaders }
      });
    }
  }

  // =====================================================
  // UPDATE RIDER PROFILE (PUT)
  // =====================================================
  if (request.method === 'PUT') {
    try {
      const body = await request.json();
      const {
        rider_id,
        name,
        email,
        mobile,
        upi_id,
        dl_number,
        rc_number,
        assigned_area,
        fingerprint_data
      } = body;

      if (!rider_id) {
        return new Response(JSON.stringify({ success: false, error: 'Rider ID is required' }), {
          status: 400,
          headers: { 'Content-Type': 'application/json', ...corsHeaders }
        });
      }

      const supabase = createSupabaseClient();

      const updateData = {};
      if (name !== undefined) updateData.name = name;
      if (email !== undefined) updateData.email = email;
      if (mobile !== undefined) updateData.mobile = mobile;
      if (upi_id !== undefined) updateData.upi_id = upi_id;
      if (dl_number !== undefined) updateData.dl_number = dl_number;
      if (rc_number !== undefined) updateData.rc_number = rc_number;
      if (assigned_area !== undefined) updateData.assigned_area = assigned_area;
      if (fingerprint_data !== undefined) updateData.fingerprint_data = fingerprint_data;

      updateData.updated_at = new Date().toISOString();

      // Check if email already exists for another rider
      if (email) {
        const existingResult = await supabase
          .from('riders')
          .select('rider_id')
          .eq('email', email)
          .neq('rider_id', rider_id)
          .maybeSingle();

        if (existingResult.data) {
          return new Response(JSON.stringify({ success: false, error: 'Email already registered by another rider' }), {
            status: 400,
            headers: { 'Content-Type': 'application/json', ...corsHeaders }
          });
        }
      }

      const updateResult = await supabase
        .from('riders')
        .update(updateData)
        .eq('rider_id', rider_id)
        .select();

      if (updateResult.error) {
        console.error('Profile update error:', updateResult.error);
        return new Response(JSON.stringify({ success: false, error: updateResult.error.message }), {
          status: 500,
          headers: { 'Content-Type': 'application/json', ...corsHeaders }
        });
      }

      const updatedRider = updateResult.data;

      return new Response(JSON.stringify({
        success: true,
        message: 'Profile updated successfully',
        profile: {
          rider_id: updatedRider.rider_id,
          name: updatedRider.name,
          email: updatedRider.email,
          mobile: updatedRider.mobile,
          upi_id: updatedRider.upi_id ? maskUpi(updatedRider.upi_id) : null,
          dl_number: updatedRider.dl_number,
          rc_number: updatedRider.rc_number,
          assigned_area: updatedRider.assigned_area,
          updated_at: updatedRider.updated_at
        }
      }), {
        status: 200,
        headers: { 'Content-Type': 'application/json', ...corsHeaders }
      });

    } catch (error) {
      console.error('Update profile error:', error);
      return new Response(JSON.stringify({ success: false, error: error.message }), {
        status: 500,
        headers: { 'Content-Type': 'application/json', ...corsHeaders }
      });
    }
  }

  // =====================================================
  // UPDATE LOCATION (POST)
  // =====================================================
  if (request.method === 'POST') {
    try {
      const body = await request.json();
      const { rider_id, lat, lng, address } = body;

      if (!rider_id) {
        return new Response(JSON.stringify({ success: false, error: 'Rider ID is required' }), {
          status: 400,
          headers: { 'Content-Type': 'application/json', ...corsHeaders }
        });
      }

      const supabase = createSupabaseClient();
      const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
      const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

      await fetch(`${supabaseUrl}/rest/v1/riders?rider_id=eq.${rider_id}`, {
        method: 'PATCH',
        headers: {
          'apikey': supabaseKey,
          'Authorization': `Bearer ${supabaseKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          current_location: { lat, lng, address: address || null },
          last_location_update: new Date().toISOString(),
          updated_at: new Date().toISOString()
        })
      });

      return new Response(JSON.stringify({
        success: true,
        message: 'Location updated successfully',
        location: { lat, lng, address, updated_at: new Date().toISOString() }
      }), {
        status: 200,
        headers: { 'Content-Type': 'application/json', ...corsHeaders }
      });

    } catch (error) {
      console.error('Update location error:', error);
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