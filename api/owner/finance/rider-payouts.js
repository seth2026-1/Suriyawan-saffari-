// api/owner/finance/rider-payouts.js
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

function getPayoutStatusDisplay(status) {
  const statusMap = {
    'PENDING': 'Pending',
    'PROCESSING': 'Processing',
    'COMPLETED': 'Completed',
    'FAILED': 'Failed',
    'REJECTED': 'Rejected'
  };
  return statusMap[status] || status;
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

          if (queryModifiers.gte) {
            const [field, value] = Object.entries(queryModifiers.gte)[0];
            finalUrl += `${finalUrl.includes('?') ? '&' : '?'}${field}=gte.${value}`;
          }

          if (queryModifiers.lte) {
            const [field, value] = Object.entries(queryModifiers.lte)[0];
            finalUrl += `${finalUrl.includes('?') ? '&' : '?'}${field}=lte.${value}`;
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
            gte: (gteField, gteValue) => ({
              lte: (lteField, lteValue) => ({
                order: (orderField, { ascending }) => ({
                  range: async (from, to) => {
                    const result = await execute({
                      eq: { [field]: value },
                      gte: { [gteField]: gteValue },
                      lte: { [lteField]: lteValue },
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

  const url = new URL(request.url);
  const supabase = createSupabaseClient();
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  // =====================================================
  // GET RIDER PAYOUTS
  // =====================================================
  if (request.method === 'GET') {
    try {
      const status = url.searchParams.get('status');
      const rider_id = url.searchParams.get('rider_id');
      const from_date = url.searchParams.get('from_date');
      const to_date = url.searchParams.get('to_date');
      const page = parseInt(url.searchParams.get('page') || '1');
      const limit = parseInt(url.searchParams.get('limit') || '20');
      const sort_by = url.searchParams.get('sort_by') || 'requested_at';
      const sort_order = url.searchParams.get('sort_order') || 'desc';

      const payoutsSelect = `*, riders!inner(rider_id,name,email,mobile,upi_id,rating,total_deliveries,total_pickups)`;
      let payoutsUrl = `${supabaseUrl}/rest/v1/payouts?select=${encodeURIComponent(payoutsSelect)}&user_type=eq.rider&order=${sort_by}.${sort_order}`;

      if (status && status !== 'all') {
        payoutsUrl += `&status=eq.${status.toUpperCase()}`;
      }

      if (rider_id) {
        payoutsUrl += `&user_id=eq.${rider_id}`;
      }

      if (from_date) {
        payoutsUrl += `&requested_at=gte.${from_date}`;
      }

      if (to_date) {
        payoutsUrl += `&requested_at=lte.${to_date}`;
      }

      const from = (page - 1) * limit;
      const to = from + limit - 1;
      payoutsUrl += `&offset=${from}&limit=${limit}`;

      const payoutsResponse = await fetch(payoutsUrl, {
        headers: {
          'apikey': supabaseKey,
          'Authorization': `Bearer ${supabaseKey}`,
        },
      });
      const payouts = await payoutsResponse.json();
      const count = parseInt(payoutsResponse.headers.get('content-range')?.split('/')[1] || '0');

      // Get statistics for all payouts
      const allPayoutsUrl = `${supabaseUrl}/rest/v1/payouts?select=amount,status,requested_at&user_type=eq.rider`;
      const allPayoutsResponse = await fetch(allPayoutsUrl, {
        headers: {
          'apikey': supabaseKey,
          'Authorization': `Bearer ${supabaseKey}`,
        },
      });
      const allPayouts = await allPayoutsResponse.json();

      const now = new Date();
      const monthAgo = new Date(now.setMonth(now.getMonth() - 1));

      const stats = {
        total_requested: allPayouts?.reduce((sum, p) => sum + (p.amount || 0), 0) || 0,
        total_pending: allPayouts?.filter(p => p.status === 'PENDING').reduce((sum, p) => sum + (p.amount || 0), 0) || 0,
        total_processing: allPayouts?.filter(p => p.status === 'PROCESSING').reduce((sum, p) => sum + (p.amount || 0), 0) || 0,
        total_completed: allPayouts?.filter(p => p.status === 'COMPLETED').reduce((sum, p) => sum + (p.amount || 0), 0) || 0,
        total_failed: allPayouts?.filter(p => p.status === 'FAILED').reduce((sum, p) => sum + (p.amount || 0), 0) || 0,
        pending_count: allPayouts?.filter(p => p.status === 'PENDING').length || 0,
        processing_count: allPayouts?.filter(p => p.status === 'PROCESSING').length || 0,
        completed_count: allPayouts?.filter(p => p.status === 'COMPLETED').length || 0,
        this_month: {
          count: allPayouts?.filter(p => new Date(p.requested_at) >= monthAgo).length || 0,
          amount: allPayouts?.filter(p => new Date(p.requested_at) >= monthAgo).reduce((sum, p) => sum + (p.amount || 0), 0) || 0
        }
      };

      // Get total wallet balance of all riders
      const ridersUrl = `${supabaseUrl}/rest/v1/riders?select=wallet_balance`;
      const ridersResponse = await fetch(ridersUrl, {
        headers: {
          'apikey': supabaseKey,
          'Authorization': `Bearer ${supabaseKey}`,
        },
      });
      const riders = await ridersResponse.json();
      const totalWalletBalance = riders?.reduce((sum, r) => sum + (r.wallet_balance || 0), 0) || 0;

      return new Response(JSON.stringify({
        success: true,
        payouts: payouts?.map(p => ({
          payout_id: p.payout_id,
          rider: {
            rider_id: p.riders?.rider_id,
            name: p.riders?.name,
            email: p.riders?.email,
            mobile: p.riders?.mobile,
            upi_id: maskUpi(p.riders?.upi_id),
            upi_id_full: p.riders?.upi_id,
            rating: p.riders?.rating,
            total_deliveries: p.riders?.total_deliveries,
            total_pickups: p.riders?.total_pickups
          },
          amount: p.amount,
          tds_amount: p.tds_amount,
          net_amount: p.net_amount,
          upi_id: p.upi_id,
          utr_number: p.utr_number,
          status: p.status,
          status_display: getPayoutStatusDisplay(p.status),
          requested_at: p.requested_at,
          processed_at: p.processed_at,
          completed_at: p.completed_at,
          notes: p.notes,
          failed_reason: p.failed_reason
        })) || [],
        stats: stats,
        total_wallet_balance: totalWalletBalance,
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
      console.error('Get rider payouts error:', error);
      return new Response(JSON.stringify({ success: false, error: error.message }), {
        status: 500,
        headers: { 'Content-Type': 'application/json', ...corsHeaders }
      });
    }
  }

  // =====================================================
  // PROCESS RIDER PAYOUT (POST)
  // =====================================================
  if (request.method === 'POST') {
    try {
      const body = await request.json();
      const {
        payout_id,
        action,
        utr_number,
        notes,
        failed_reason
      } = body;

      if (!payout_id || !action) {
        return new Response(JSON.stringify({
          success: false,
          error: 'Payout ID and action are required'
        }), {
          status: 400,
          headers: { 'Content-Type': 'application/json', ...corsHeaders }
        });
      }

      if (!['approve', 'reject', 'complete', 'fail'].includes(action)) {
        return new Response(JSON.stringify({ success: false, error: 'Invalid action' }), {
          status: 400,
          headers: { 'Content-Type': 'application/json', ...corsHeaders }
        });
      }

      const supabase = createSupabaseClient();
      const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
      const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

      // Get payout details with rider info
      const payoutSelect = `*, riders!inner(rider_id, name, email, mobile, upi_id, wallet_balance)`;
      const payoutUrl = `${supabaseUrl}/rest/v1/payouts?select=${encodeURIComponent(payoutSelect)}&payout_id=eq.${payout_id}`;
      const payoutResponse = await fetch(payoutUrl, {
        headers: {
          'apikey': supabaseKey,
          'Authorization': `Bearer ${supabaseKey}`,
        },
      });
      const payoutData = await payoutResponse.json();
      const payout = payoutData[0];

      if (!payout) {
        return new Response(JSON.stringify({ success: false, error: 'Payout not found' }), {
          status: 404,
          headers: { 'Content-Type': 'application/json', ...corsHeaders }
        });
      }

      let newStatus;
      let updateData = { updated_at: new Date().toISOString() };
      let notificationMessage = '';
      let notificationTitle = '';

      switch (action) {
        case 'approve':
          newStatus = 'PROCESSING';
          updateData.processed_at = new Date().toISOString();
          updateData.processed_by = 'OWN001';
          notificationTitle = 'Payout Request Approved';
          notificationMessage = `Your payout request of ₹${payout.amount} has been approved and is being processed.`;
          break;

        case 'reject':
          newStatus = 'REJECTED';
          updateData.failed_reason = failed_reason || 'Rejected by admin';
          notificationTitle = 'Payout Request Rejected';
          notificationMessage = `Your payout request of ₹${payout.amount} has been rejected. Reason: ${failed_reason || 'Please contact support'}`;

          // Get current wallet balance
          const riderUrl = `${supabaseUrl}/rest/v1/riders?select=wallet_balance&rider_id=eq.${payout.user_id}`;
          const riderResponse = await fetch(riderUrl, {
            headers: {
              'apikey': supabaseKey,
              'Authorization': `Bearer ${supabaseKey}`,
            },
          });
          const riderData = await riderResponse.json();
          const currentBalance = riderData[0]?.wallet_balance || 0;

          // Refund amount back to rider wallet
          await fetch(`${supabaseUrl}/rest/v1/riders?rider_id=eq.${payout.user_id}`, {
            method: 'PATCH',
            headers: {
              'apikey': supabaseKey,
              'Authorization': `Bearer ${supabaseKey}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({ wallet_balance: currentBalance + payout.amount })
          });

          await fetch(`${supabaseUrl}/rest/v1/wallet_transactions`, {
            method: 'POST',
            headers: {
              'apikey': supabaseKey,
              'Authorization': `Bearer ${supabaseKey}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              user_id: payout.user_id,
              user_type: 'rider',
              amount: payout.amount,
              type: 'credit',
              reason: `Reversed payout request ${payout_id}`,
              reference_id: payout_id,
              created_at: new Date().toISOString()
            })
          });
          break;

        case 'complete':
          if (payout.status !== 'PROCESSING') {
            return new Response(JSON.stringify({ success: false, error: 'Payout must be in processing status to complete' }), {
              status: 400,
              headers: { 'Content-Type': 'application/json', ...corsHeaders }
            });
          }
          newStatus = 'COMPLETED';
          updateData.completed_at = new Date().toISOString();
          updateData.utr_number = utr_number || null;
          notificationTitle = 'Payout Completed';
          notificationMessage = `Your payout request of ₹${payout.net_amount} has been successfully credited to your UPI ID ${maskUpi(payout.upi_id)}. UTR: ${utr_number || 'N/A'}`;
          break;

        case 'fail':
          if (payout.status !== 'PROCESSING') {
            return new Response(JSON.stringify({ success: false, error: 'Payout must be in processing status to mark as failed' }), {
              status: 400,
              headers: { 'Content-Type': 'application/json', ...corsHeaders }
            });
          }
          newStatus = 'FAILED';
          updateData.failed_reason = failed_reason || 'Transaction failed';
          notificationTitle = 'Payout Failed';
          notificationMessage = `Your payout request of ₹${payout.amount} has failed. Reason: ${failed_reason || 'Technical issue'}. Amount will be refunded to your wallet.`;

          // Get current wallet balance for refund
          const riderBalanceUrl = `${supabaseUrl}/rest/v1/riders?select=wallet_balance&rider_id=eq.${payout.user_id}`;
          const riderBalanceResponse = await fetch(riderBalanceUrl, {
            headers: {
              'apikey': supabaseKey,
              'Authorization': `Bearer ${supabaseKey}`,
            },
          });
          const riderBalanceData = await riderBalanceResponse.json();
          const currentRiderBalance = riderBalanceData[0]?.wallet_balance || 0;

          // Refund amount back to rider wallet
          await fetch(`${supabaseUrl}/rest/v1/riders?rider_id=eq.${payout.user_id}`, {
            method: 'PATCH',
            headers: {
              'apikey': supabaseKey,
              'Authorization': `Bearer ${supabaseKey}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({ wallet_balance: currentRiderBalance + payout.amount })
          });

          await fetch(`${supabaseUrl}/rest/v1/wallet_transactions`, {
            method: 'POST',
            headers: {
              'apikey': supabaseKey,
              'Authorization': `Bearer ${supabaseKey}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              user_id: payout.user_id,
              user_type: 'rider',
              amount: payout.amount,
              type: 'credit',
              reason: `Failed payout reversal - ${payout_id}`,
              reference_id: payout_id,
              created_at: new Date().toISOString()
            })
          });
          break;

        default:
          return new Response(JSON.stringify({ success: false, error: 'Invalid action' }), {
            status: 400,
            headers: { 'Content-Type': 'application/json', ...corsHeaders }
          });
      }

      updateData.status = newStatus;
      if (notes) updateData.notes = notes;

      const updateResult = await supabase
        .from('payouts')
        .update(updateData)
        .eq('payout_id', payout_id)
        .select();

      if (updateResult.error) {
        console.error('Payout update error:', updateResult.error);
        return new Response(JSON.stringify({ success: false, error: updateResult.error.message }), {
          status: 500,
          headers: { 'Content-Type': 'application/json', ...corsHeaders }
        });
      }

      const updatedPayout = updateResult.data;

      // Send notification to rider
      await fetch(`${supabaseUrl}/rest/v1/notifications`, {
        method: 'POST',
        headers: {
          'apikey': supabaseKey,
          'Authorization': `Bearer ${supabaseKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          user_id: payout.user_id,
          user_type: 'rider',
          title: notificationTitle,
          message: notificationMessage,
          type: 'payment',
          data: { payout_id, amount: payout.amount, status: newStatus, utr_number },
          created_at: new Date().toISOString()
        })
      });

      // Log audit
      await fetch(`${supabaseUrl}/rest/v1/audit_logs`, {
        method: 'POST',
        headers: {
          'apikey': supabaseKey,
          'Authorization': `Bearer ${supabaseKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          table_name: 'payouts',
          record_id: payout_id,
          action: `PAYOUT_${action.toUpperCase()}`,
          new_data: { status: newStatus, utr_number, notes },
          changed_by: 'OWN001',
          changed_at: new Date().toISOString()
        })
      });

      return new Response(JSON.stringify({
        success: true,
        message: `Payout ${action}d successfully`,
        payout: {
          payout_id: updatedPayout.payout_id,
          status: updatedPayout.status,
          amount: updatedPayout.amount,
          net_amount: updatedPayout.net_amount,
          utr_number: updatedPayout.utr_number,
          updated_at: updatedPayout.updated_at
        }
      }), {
        status: 200,
        headers: { 'Content-Type': 'application/json', ...corsHeaders }
      });

    } catch (error) {
      console.error('Process rider payout error:', error);
      return new Response(JSON.stringify({ success: false, error: error.message }), {
        status: 500,
        headers: { 'Content-Type': 'application/json', ...corsHeaders }
      });
    }
  }

  // =====================================================
  // BULK APPROVE PAYOUTS (PUT)
  // =====================================================
  if (request.method === 'PUT') {
    try {
      const body = await request.json();
      const { payout_ids, action } = body;

      if (!payout_ids || !Array.isArray(payout_ids) || payout_ids.length === 0) {
        return new Response(JSON.stringify({ success: false, error: 'Payout IDs array is required' }), {
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

      const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
      const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

      const results = {
        success: [],
        failed: []
      };

      for (const payout_id of payout_ids) {
        try {
          const payoutUrl = `${supabaseUrl}/rest/v1/payouts?select=*,riders!inner(rider_id,name)&payout_id=eq.${payout_id}`;
          const payoutResponse = await fetch(payoutUrl, {
            headers: {
              'apikey': supabaseKey,
              'Authorization': `Bearer ${supabaseKey}`,
            },
          });
          const payoutData = await payoutResponse.json();
          const payout = payoutData[0];

          if (!payout) {
            results.failed.push({ payout_id, error: 'Payout not found' });
            continue;
          }

          if (payout.status !== 'PENDING') {
            results.failed.push({ payout_id, error: `Payout is not pending (current: ${payout.status})` });
            continue;
          }

          const newStatus = action === 'approve' ? 'PROCESSING' : 'REJECTED';
          const updateData = {
            status: newStatus,
            processed_at: new Date().toISOString(),
            processed_by: 'OWN001',
            updated_at: new Date().toISOString()
          };

          if (action === 'reject') {
            updateData.failed_reason = 'Bulk rejection by admin';
            // Refund amount back to rider wallet
            const riderUrl = `${supabaseUrl}/rest/v1/riders?select=wallet_balance&rider_id=eq.${payout.user_id}`;
            const riderResponse = await fetch(riderUrl, {
              headers: {
                'apikey': supabaseKey,
                'Authorization': `Bearer ${supabaseKey}`,
              },
            });
            const riderData = await riderResponse.json();
            const currentBalance = riderData[0]?.wallet_balance || 0;

            await fetch(`${supabaseUrl}/rest/v1/riders?rider_id=eq.${payout.user_id}`, {
              method: 'PATCH',
              headers: {
                'apikey': supabaseKey,
                'Authorization': `Bearer ${supabaseKey}`,
                'Content-Type': 'application/json',
              },
              body: JSON.stringify({ wallet_balance: currentBalance + payout.amount })
            });
          }

          await fetch(`${supabaseUrl}/rest/v1/payouts?payout_id=eq.${payout_id}`, {
            method: 'PATCH',
            headers: {
              'apikey': supabaseKey,
              'Authorization': `Bearer ${supabaseKey}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify(updateData)
          });

          results.success.push({ payout_id, amount: payout.amount });

          // Send notification
          await fetch(`${supabaseUrl}/rest/v1/notifications`, {
            method: 'POST',
            headers: {
              'apikey': supabaseKey,
              'Authorization': `Bearer ${supabaseKey}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              user_id: payout.user_id,
              user_type: 'rider',
              title: action === 'approve' ? 'Payout Request Approved' : 'Payout Request Rejected',
              message: action === 'approve'
                ? `Your payout request of ₹${payout.amount} has been approved and is being processed.`
                : `Your payout request of ₹${payout.amount} has been rejected.`,
              type: 'payment',
              data: { payout_id, status: newStatus },
              created_at: new Date().toISOString()
            })
          });

        } catch (err) {
          results.failed.push({ payout_id, error: err.message });
        }
      }

      return new Response(JSON.stringify({
        success: true,
        message: `Bulk ${action} completed: ${results.success.length} successful, ${results.failed.length} failed`,
        results: results
      }), {
        status: 200,
        headers: { 'Content-Type': 'application/json', ...corsHeaders }
      });

    } catch (error) {
      console.error('Bulk payout action error:', error);
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