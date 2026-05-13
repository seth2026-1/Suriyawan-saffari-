// api/seller/rto-dispute.js
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

          if (queryModifiers.in && queryModifiers.in.values.length > 0) {
            finalUrl += `${finalUrl.includes('?') ? '&' : '?'}${queryModifiers.in.field}=in.(${queryModifiers.in.values.join(',')})`;
          }

          if (queryModifiers.not) {
            finalUrl += `${finalUrl.includes('?') ? '&' : '?'}${queryModifiers.not.field}=not.in.(${queryModifiers.not.values.join(',')})`;
          }

          if (queryModifiers.order) {
            finalUrl += `${finalUrl.includes('?') ? '&' : '?'}order=${queryModifiers.order.field}.${queryModifiers.order.ascending ? 'asc' : 'desc'}`;
          }

          if (queryModifiers.range) {
            finalUrl += `${finalUrl.includes('?') ? '&' : '?'}offset=${queryModifiers.range.from}&limit=${queryModifiers.range.to - queryModifiers.range.from + 1}`;
          }

          if (options.count === 'exact') {
            finalUrl += `${finalUrl.includes('?') ? '&' : '?'}select=*`;
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
            in: (inField, inValues) => ({
              not: (notField, notValues) => ({
                order: (orderField, { ascending }) => ({
                  range: async (from, to) => {
                    const result = await execute({
                      eq: { [field]: value },
                      in: { field: inField, values: inValues },
                      not: { field: notField, values: notValues },
                      order: { field: orderField, ascending },
                      range: { from, to }
                    });
                    return result;
                  }
                })
              })
            }),
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

function getDisputeStatusDisplay(status) {
  const statusMap = {
    'PENDING': 'Pending Review',
    'IN_REVIEW': 'Under Review',
    'RESOLVED': 'Resolved',
    'REJECTED': 'Rejected',
    'APPROVED': 'Approved'
  };
  return statusMap[status] || status;
}

export default async function handler(request) {
  // CORS Headers
  const corsHeaders = {
    'Access-Control-Allow-Credentials': 'true',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version, Authorization',
  };

  // Handle OPTIONS preflight
  if (request.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: corsHeaders });
  }

  const url = new URL(request.url);

  // =====================================================
  // GET RTO DISPUTES LIST
  // =====================================================
  if (request.method === 'GET') {
    try {
      const seller_id = url.searchParams.get('seller_id');
      const status = url.searchParams.get('status');
      const page = parseInt(url.searchParams.get('page') || '1');
      const limit = parseInt(url.searchParams.get('limit') || '20');

      if (!seller_id) {
        return new Response(JSON.stringify({ success: false, error: 'Seller ID is required' }), {
          status: 400,
          headers: { 'Content-Type': 'application/json', ...corsHeaders }
        });
      }

      const supabase = createSupabaseClient();
      const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
      const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

      // First, get disputed order IDs if needed
      let disputedIds = [];
      if (status === 'disputed' || status === 'no_dispute') {
        const disputesUrl = `${supabaseUrl}/rest/v1/disputes?select=book_id&seller_id=eq.${seller_id}&type=eq.rto`;
        const disputesResponse = await fetch(disputesUrl, {
          headers: {
            'apikey': supabaseKey,
            'Authorization': `Bearer ${supabaseKey}`,
          },
        });
        const disputesData = await disputesResponse.json();
        disputedIds = disputesData?.map(d => d.book_id) || [];
      }

      // Build RTO orders query
      let rtoOrdersUrl = `${supabaseUrl}/rest/v1/orders?select=book_id,cust_id,final_amount,placed_at,delivered_at,cancelled_at,cancel_reason,status,customers!inner(cust_id,name,mobile),order_items!inner(quantity,price_at_time,products!inner(prod_id,name,images))&seller_id=eq.${seller_id}&status=eq.RTO&order=cancelled_at.desc`;

      if (status === 'disputed' && disputedIds.length > 0) {
        rtoOrdersUrl += `&book_id=in.(${disputedIds.join(',')})`;
      } else if (status === 'no_dispute' && disputedIds.length > 0) {
        rtoOrdersUrl += `&book_id=not.in.(${disputedIds.join(',')})`;
      } else if (status === 'disputed' && disputedIds.length === 0) {
        rtoOrdersUrl += `&book_id=eq.NO_MATCH`;
      }

      const from = (page - 1) * limit;
      const to = from + limit - 1;
      rtoOrdersUrl += `&offset=${from}&limit=${limit}`;

      const rtoOrdersResponse = await fetch(rtoOrdersUrl, {
        headers: {
          'apikey': supabaseKey,
          'Authorization': `Bearer ${supabaseKey}`,
        },
      });
      const rtoOrdersData = await rtoOrdersResponse.json();
      const rtoOrders = rtoOrdersData || [];
      const count = parseInt(rtoOrdersResponse.headers.get('content-range')?.split('/')[1] || '0');

      // Get dispute status for each order
      let disputesMap = {};
      if (disputedIds.length > 0) {
        const disputesDetailUrl = `${supabaseUrl}/rest/v1/disputes?select=*&seller_id=eq.${seller_id}&type=eq.rto`;
        const disputesDetailResponse = await fetch(disputesDetailUrl, {
          headers: {
            'apikey': supabaseKey,
            'Authorization': `Bearer ${supabaseKey}`,
          },
        });
        const disputesDetail = await disputesDetailResponse.json();
        
        disputesDetail.forEach(d => {
          disputesMap[d.book_id] = d;
        });
      }

      // Get RTO statistics
      const allRtoOrdersUrl = `${supabaseUrl}/rest/v1/orders?select=final_amount&seller_id=eq.${seller_id}&status=eq.RTO`;
      const allRtoOrdersResponse = await fetch(allRtoOrdersUrl, {
        headers: {
          'apikey': supabaseKey,
          'Authorization': `Bearer ${supabaseKey}`,
        },
      });
      const allRtoOrders = await allRtoOrdersResponse.json();

      const totalRtoCount = allRtoOrders?.length || 0;
      const totalRtoAmount = allRtoOrders?.reduce((sum, o) => sum + (o.final_amount || 0), 0) || 0;

      const disputedCount = disputesDetail?.length || 0;
      const resolvedCount = disputesDetail?.filter(d => d.status === 'RESOLVED').length || 0;
      const pendingCount = disputesDetail?.filter(d => d.status === 'PENDING').length || 0;
      const inReviewCount = disputesDetail?.filter(d => d.status === 'IN_REVIEW').length || 0;
      const rejectedCount = disputesDetail?.filter(d => d.status === 'REJECTED').length || 0;

      // Format orders
      const formattedOrders = rtoOrders.map(order => {
        const dispute = disputesMap[order.book_id];
        const cancelledAt = order.cancelled_at || order.updated_at;
        const canDispute = !dispute && 
          cancelledAt && 
          new Date(cancelledAt) > new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

        return {
          book_id: order.book_id,
          final_amount: order.final_amount,
          placed_at: order.placed_at,
          cancelled_at: order.cancelled_at,
          cancel_reason: order.cancel_reason,
          customer: {
            cust_id: order.customers?.cust_id,
            name: order.customers?.name,
            mobile: order.customers?.mobile
          },
          items: (order.order_items || []).map(item => ({
            prod_id: item.products.prod_id,
            name: item.products.name,
            quantity: item.quantity,
            price: item.price_at_time,
            image: item.products.images?.[0] || null
          })),
          dispute: dispute ? {
            dispute_id: dispute.dispute_id,
            status: dispute.status,
            status_display: getDisputeStatusDisplay(dispute.status),
            reason: dispute.reason,
            photos: dispute.photos,
            created_at: dispute.created_at,
            resolution: dispute.resolution,
            resolved_at: dispute.resolved_at
          } : null,
          can_dispute: canDispute
        };
      });

      return new Response(JSON.stringify({
        success: true,
        rto_orders: formattedOrders,
        statistics: {
          total_rto: totalRtoCount,
          total_rto_amount: totalRtoAmount,
          disputed: disputedCount,
          in_review: inReviewCount,
          resolved: resolvedCount,
          rejected: rejectedCount,
          pending: pendingCount
        },
        pagination: {
          current_page: page,
          total_pages: Math.ceil(count / limit),
          total_items: count,
          items_per_page: limit
        }
      }), {
        status: 200,
        headers: { 'Content-Type': 'application/json', ...corsHeaders }
      });

    } catch (error) {
      console.error('Get RTO disputes error:', error);
      return new Response(JSON.stringify({ success: false, error: error.message }), {
        status: 500,
        headers: { 'Content-Type': 'application/json', ...corsHeaders }
      });
    }
  }

  // =====================================================
  // CREATE RTO DISPUTE (POST)
  // =====================================================
  if (request.method === 'POST') {
    try {
      const body = await request.json();
      const {
        seller_id,
        book_id,
        reason,
        description,
        photos,
        expected_resolution,
        amount_claimed
      } = body;

      if (!seller_id || !book_id || !reason) {
        return new Response(JSON.stringify({
          success: false,
          error: 'Seller ID, Order ID and reason are required'
        }), {
          status: 400,
          headers: { 'Content-Type': 'application/json', ...corsHeaders }
        });
      }

      const supabase = createSupabaseClient();
      const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
      const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

      // Verify order belongs to seller and is RTO
      const orderUrl = `${supabaseUrl}/rest/v1/orders?book_id=eq.${book_id}&seller_id=eq.${seller_id}&status=eq.RTO&select=*`;
      const orderResponse = await fetch(orderUrl, {
        headers: {
          'apikey': supabaseKey,
          'Authorization': `Bearer ${supabaseKey}`,
        },
      });
      const orderData = await orderResponse.json();
      const order = orderData[0];

      if (!order) {
        return new Response(JSON.stringify({
          success: false,
          error: 'RTO order not found or unauthorized'
        }), {
          status: 404,
          headers: { 'Content-Type': 'application/json', ...corsHeaders }
        });
      }

      // Check if dispute already exists
      const disputeCheckUrl = `${supabaseUrl}/rest/v1/disputes?book_id=eq.${book_id}&seller_id=eq.${seller_id}&select=dispute_id`;
      const disputeCheckResponse = await fetch(disputeCheckUrl, {
        headers: {
          'apikey': supabaseKey,
          'Authorization': `Bearer ${supabaseKey}`,
        },
      });
      const existingDisputeData = await disputeCheckResponse.json();
      const existingDispute = existingDisputeData[0];

      if (existingDispute) {
        return new Response(JSON.stringify({
          success: false,
          error: 'Dispute already raised for this order',
          dispute_id: existingDispute.dispute_id
        }), {
          status: 400,
          headers: { 'Content-Type': 'application/json', ...corsHeaders }
        });
      }

      // Check if within dispute window (7 days from RTO)
      const rtoDate = new Date(order.cancelled_at || order.updated_at);
      const now = new Date();
      const daysSinceRto = (now - rtoDate) / (1000 * 60 * 60 * 24);

      if (daysSinceRto > 7) {
        return new Response(JSON.stringify({
          success: false,
          error: 'Dispute can only be raised within 7 days of RTO'
        }), {
          status: 400,
          headers: { 'Content-Type': 'application/json', ...corsHeaders }
        });
      }

      // Get seller details
      const sellerResult = await supabase
        .from('sellers')
        .select('shop_name')
        .eq('seller_id', seller_id)
        .single();

      const sellerShopName = sellerResult.data?.shop_name || seller_id;

      // Create dispute
      const disputeInsert = await supabase
        .from('disputes')
        .insert({
          book_id,
          seller_id,
          type: 'rto',
          reason,
          description: description || null,
          photos: photos || null,
          amount_claimed: amount_claimed || order.final_amount,
          expected_resolution: expected_resolution || null,
          status: 'PENDING',
          created_at: new Date().toISOString()
        })
        .select();

      if (disputeInsert.error) {
        console.error('Dispute creation error:', disputeInsert.error);
        return new Response(JSON.stringify({ success: false, error: 'Failed to raise dispute' }), {
          status: 500,
          headers: { 'Content-Type': 'application/json', ...corsHeaders }
        });
      }

      const dispute = disputeInsert.data;

      // Send notification to owner
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
          title: '⚠️ New RTO Dispute',
          message: `${sellerShopName} raised a dispute for order #${book_id}. Reason: ${reason}`,
          type: 'dispute',
          priority: 'HIGH',
          data: {
            dispute_id: dispute.dispute_id,
            book_id,
            seller_id,
            reason
          },
          created_at: new Date().toISOString()
        })
      });

      // Send confirmation to seller
      await fetch(`${supabaseUrl}/rest/v1/notifications`, {
        method: 'POST',
        headers: {
          'apikey': supabaseKey,
          'Authorization': `Bearer ${supabaseKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          user_id: seller_id,
          user_type: 'seller',
          title: 'Dispute Raised Successfully',
          message: `Your dispute for order #${book_id} has been submitted. We will review and update within 3 days.`,
          type: 'dispute',
          data: { dispute_id: dispute.dispute_id, book_id },
          created_at: new Date().toISOString()
        })
      });

      return new Response(JSON.stringify({
        success: true,
        message: 'Dispute raised successfully',
        dispute: {
          dispute_id: dispute.dispute_id,
          book_id: dispute.book_id,
          status: dispute.status,
          reason: dispute.reason,
          created_at: dispute.created_at
        },
        next_steps: [
          'Owner will review your dispute',
          'You will be notified once decision is made',
          'Resolution typically takes 2-3 business days',
          'Check status in RTO Disputes section'
        ]
      }), {
        status: 200,
        headers: { 'Content-Type': 'application/json', ...corsHeaders }
      });

    } catch (error) {
      console.error('Create RTO dispute error:', error);
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