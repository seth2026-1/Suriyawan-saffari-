// api/seller/payouts.js
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
              maybeSingle: async () => {
                const finalUrl = `${url}&${field}=eq.${value}&${field2}=in.(${values.join(',')})`;
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
            }),
            gte: (gteField, gteValue) => ({
              lte: (lteField, lteValue) => ({
                order: (orderField, { ascending }) => ({
                  select: async () => {
                    const sortOrder = ascending ? 'asc' : 'desc';
                    const finalUrl = `${url}&${field}=eq.${value}&${gteField}=gte.${gteValue}&${lteField}=lte.${lteValue}&order=${orderField}.${sortOrder}`;
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
            order: (orderField, { ascending }) => {
              const sortOrder = ascending ? 'asc' : 'desc';
              return {
                range: async (from, to) => {
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
              };
            },
            limit: async (limit) => {
              const finalUrl = `${url}&${field}=eq.${value}&limit=${limit}`;
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
          in: (field, values) => ({
            select: async (columns) => {
              const finalUrl = `${url}?${field}=in.(${values.join(',')})&select=${columns || '*'}`;
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
            return { data: result, error: null };
          }
        })
      })
    })
  };
}

// Main handler
export default async function handler(request) {
  // CORS headers
  const corsHeaders = {
    'Access-Control-Allow-Credentials': 'true',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET,POST,OPTIONS',
    'Access-Control-Allow-Headers': 'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version, Authorization',
  };

  // Handle OPTIONS request
  if (request.method === 'OPTIONS') {
    return new Response(null, {
      status: 204,
      headers: corsHeaders,
    });
  }

  const url = new URL(request.url);

  // =====================================================
  // GET PAYOUTS AND WALLET DETAILS
  // =====================================================
  if (request.method === 'GET') {
    try {
      const seller_id = url.searchParams.get('seller_id');
      const period = url.searchParams.get('period') || 'all';
      const page = parseInt(url.searchParams.get('page') || '1');
      const limit = parseInt(url.searchParams.get('limit') || '20');

      if (!seller_id) {
        return new Response(JSON.stringify({ 
          success: false, 
          error: 'Seller ID is required' 
        }), {
          status: 400,
          headers: { 'Content-Type': 'application/json', ...corsHeaders }
        });
      }

      const supabase = createSupabaseClient();

      // Get seller details
      const sellerResult = await supabase
        .from('sellers')
        .select('seller_id, shop_name, upi_id, wallet_balance, commission_rate, email, mobile')
        .eq('seller_id', seller_id)
        .single();

      if (sellerResult.error || !sellerResult.data) {
        return new Response(JSON.stringify({ 
          success: false, 
          error: 'Seller not found' 
        }), {
          status: 404,
          headers: { 'Content-Type': 'application/json', ...corsHeaders }
        });
      }

      const seller = sellerResult.data;

      // Get wallet transactions
      let walletQuery = await supabase
        .from('wallet_transactions')
        .select('*')
        .eq('user_id', seller_id);

      let walletTransactions = walletQuery.data || [];

      // Get payout requests
      const payoutsResult = await supabase
        .from('payouts')
        .select('*')
        .eq('user_id', seller_id);

      let allPayouts = payoutsResult.data || [];

      // Pagination
      const from = (page - 1) * limit;
      const to = from + limit - 1;
      const payouts = allPayouts.slice(from, to + 1);
      const totalCount = allPayouts.length;

      // Get delivered and RTO orders
      const deliveredResult = await supabase
        .from('orders')
        .select('final_amount, placed_at, delivered_at, status')
        .eq('seller_id', seller_id);

      const deliveredOrders = deliveredResult.data?.filter(o => o.status === 'DELIVERED') || [];

      const rtoResult = await supabase
        .from('orders')
        .select('final_amount, status')
        .eq('seller_id', seller_id);

      const rtoOrders = rtoResult.data?.filter(o => o.status === 'RTO') || [];

      // Commission calculation
      const commissionRate = seller.commission_rate || 10;
      const totalSales = deliveredOrders.reduce((sum, o) => sum + (o.final_amount || 0), 0);
      const totalCommission = (totalSales * commissionRate) / 100;
      const totalRtoLoss = rtoOrders.reduce((sum, o) => sum + (o.final_amount || 0), 0);
      const netEarnings = totalSales - totalCommission - totalRtoLoss;

      // Period wise earnings
      const now = new Date();
      const thisMonthStart = new Date(now.getFullYear(), now.getMonth(), 1);
      const lastMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      const lastMonthEnd = new Date(now.getFullYear(), now.getMonth(), 0);

      const thisMonthSales = deliveredOrders.filter(o => new Date(o.delivered_at) >= thisMonthStart)
        .reduce((sum, o) => sum + (o.final_amount || 0), 0);

      const lastMonthSales = deliveredOrders.filter(o => {
        const deliveredDate = new Date(o.delivered_at);
        return deliveredDate >= lastMonthStart && deliveredDate <= lastMonthEnd;
      }).reduce((sum, o) => sum + (o.final_amount || 0), 0);

      // Wallet summary
      const totalCredited = walletTransactions.filter(t => t.type === 'credit').reduce((sum, t) => sum + t.amount, 0);
      const totalDebited = walletTransactions.filter(t => t.type === 'debit').reduce((sum, t) => sum + t.amount, 0);
      const pendingPayouts = allPayouts.filter(p => p.status === 'PENDING').reduce((sum, p) => sum + p.amount, 0);
      const processingPayouts = allPayouts.filter(p => p.status === 'PROCESSING').reduce((sum, p) => sum + p.amount, 0);
      const completedPayouts = allPayouts.filter(p => p.status === 'COMPLETED').reduce((sum, p) => sum + p.amount, 0);
      const availableForPayout = seller.wallet_balance;

      // System settings
      const settingsResult = await supabase
        .from('system_settings')
        .select('setting_key, setting_value')
        .in('setting_key', ['min_payout_amount', 'tds_percentage', 'payout_processing_days']);

      const settings = settingsResult.data || [];
      const minPayoutAmount = parseInt(settings.find(s => s.setting_key === 'min_payout_amount')?.setting_value || 500);
      const tdsPercentage = parseInt(settings.find(s => s.setting_key === 'tds_percentage')?.setting_value || 1);
      const processingDays = parseInt(settings.find(s => s.setting_key === 'payout_processing_days')?.setting_value || 2);

      // TDS calculation
      const estimatedTds = Math.ceil((seller.wallet_balance * tdsPercentage) / 100);
      const estimatedNetPayout = seller.wallet_balance - estimatedTds;
      const canRequestPayout = seller.wallet_balance >= minPayoutAmount && seller.upi_id;

      // Recent orders
      const recentOrdersResult = await supabase
        .from('orders')
        .select('book_id, final_amount, status, delivered_at, placed_at')
        .eq('seller_id', seller_id)
        .limit(10);

      const recentOrders = (recentOrdersResult.data || []).filter(o => o.status === 'DELIVERED');

      return new Response(JSON.stringify({
        success: true,
        seller: {
          seller_id: seller.seller_id,
          shop_name: seller.shop_name,
          upi_id: seller.upi_id,
          wallet_balance: seller.wallet_balance,
          commission_rate: seller.commission_rate
        },
        wallet: {
          balance: seller.wallet_balance,
          total_credited: totalCredited,
          total_debited: totalDebited,
          pending_payouts: pendingPayouts,
          processing_payouts: processingPayouts,
          completed_payouts: completedPayouts,
          available_for_payout: availableForPayout
        },
        earnings: {
          total_sales: totalSales,
          total_commission: Math.round(totalCommission),
          total_rto_loss: totalRtoLoss,
          net_earnings: Math.round(netEarnings),
          this_month: Math.round(thisMonthSales * (1 - commissionRate / 100)),
          last_month: Math.round(lastMonthSales * (1 - commissionRate / 100)),
          commission_rate: commissionRate
        },
        transactions: walletTransactions.map(t => ({
          transaction_id: t.trans_id,
          amount: t.amount,
          type: t.type,
          reason: t.reason,
          reference_id: t.reference_id,
          created_at: t.created_at
        })),
        payouts: payouts.map(p => ({
          payout_id: p.payout_id,
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
          notes: p.notes
        })),
        payout_eligibility: {
          can_request: canRequestPayout,
          min_amount: minPayoutAmount,
          current_balance: seller.wallet_balance,
          shortfall: canRequestPayout ? 0 : minPayoutAmount - seller.wallet_balance,
          has_upi: !!seller.upi_id,
          upi_id: seller.upi_id,
          tds_percentage: tdsPercentage,
          estimated_tds: estimatedTds,
          estimated_net_payout: estimatedNetPayout,
          processing_days: processingDays
        },
        recent_orders: recentOrders.map(o => ({
          book_id: o.book_id,
          amount: o.final_amount,
          commission: Math.round(o.final_amount * commissionRate / 100),
          earnings: Math.round(o.final_amount * (1 - commissionRate / 100)),
          date: o.delivered_at || o.placed_at
        })),
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
      console.error('Get payouts error:', error);
      return new Response(JSON.stringify({ 
        success: false, 
        error: error.message 
      }), {
        status: 500,
        headers: { 'Content-Type': 'application/json', ...corsHeaders }
      });
    }
  }

  // =====================================================
  // REQUEST PAYOUT (POST)
  // =====================================================
  if (request.method === 'POST') {
    try {
      const body = await request.json();
      const { seller_id, amount, upi_id } = body;

      if (!seller_id || !amount) {
        return new Response(JSON.stringify({
          success: false,
          error: 'Seller ID and amount are required'
        }), {
          status: 400,
          headers: { 'Content-Type': 'application/json', ...corsHeaders }
        });
      }

      const supabase = createSupabaseClient();

      // Get seller details
      const sellerResult = await supabase
        .from('sellers')
        .select('wallet_balance, upi_id as saved_upi_id, shop_name, email, commission_rate')
        .eq('seller_id', seller_id)
        .single();

      if (sellerResult.error || !sellerResult.data) {
        return new Response(JSON.stringify({ 
          success: false, 
          error: 'Seller not found' 
        }), {
          status: 404,
          headers: { 'Content-Type': 'application/json', ...corsHeaders }
        });
      }

      const seller = sellerResult.data;

      // System settings
      const settingsResult = await supabase
        .from('system_settings')
        .select('setting_key, setting_value')
        .in('setting_key', ['min_payout_amount', 'tds_percentage']);

      const settings = settingsResult.data || [];
      const minPayoutAmount = parseInt(settings.find(s => s.setting_key === 'min_payout_amount')?.setting_value || 500);
      const tdsPercentage = parseInt(settings.find(s => s.setting_key === 'tds_percentage')?.setting_value || 1);

      // Amount validation
      if (amount < minPayoutAmount) {
        return new Response(JSON.stringify({
          success: false,
          error: `Minimum payout amount is ₹${minPayoutAmount}`
        }), {
          status: 400,
          headers: { 'Content-Type': 'application/json', ...corsHeaders }
        });
      }

      if (amount > seller.wallet_balance) {
        return new Response(JSON.stringify({
          success: false,
          error: `Insufficient balance. Available: ₹${seller.wallet_balance}`
        }), {
          status: 400,
          headers: { 'Content-Type': 'application/json', ...corsHeaders }
        });
      }

      const finalUpiId = upi_id || seller.saved_upi_id;

      if (!finalUpiId) {
        return new Response(JSON.stringify({
          success: false,
          error: 'UPI ID is required. Please add UPI ID in profile settings.'
        }), {
          status: 400,
          headers: { 'Content-Type': 'application/json', ...corsHeaders }
        });
      }

      // Check for existing pending payout
      const pendingResult = await supabase
        .from('payouts')
        .select('payout_id, status')
        .eq('user_id', seller_id);

      const hasPending = (pendingResult.data || []).some(p => ['PENDING', 'PROCESSING'].includes(p.status));

      if (hasPending) {
        return new Response(JSON.stringify({
          success: false,
          error: 'You already have a pending payout request. Please wait for it to be processed.'
        }), {
          status: 400,
          headers: { 'Content-Type': 'application/json', ...corsHeaders }
        });
      }

      // Calculate TDS
      const tdsAmount = Math.ceil((amount * tdsPercentage) / 100);
      const netAmount = amount - tdsAmount;

      // Create payout request
      const payoutInsert = await supabase
        .from('payouts')
        .insert({
          user_id: seller_id,
          user_type: 'seller',
          amount: amount,
          upi_id: finalUpiId,
          tds_amount: tdsAmount,
          net_amount: netAmount,
          status: 'PENDING',
          notes: `Payout request from ${seller.shop_name}`,
          requested_at: new Date().toISOString()
        });

      if (payoutInsert.error) {
        console.error('Payout creation error:', payoutInsert.error);
        return new Response(JSON.stringify({ 
          success: false, 
          error: 'Failed to create payout request' 
        }), {
          status: 500,
          headers: { 'Content-Type': 'application/json', ...corsHeaders }
        });
      }

      const payout = payoutInsert.data;

      // Deduct amount from wallet
      await supabase
        .from('sellers')
        .update({ 
          wallet_balance: seller.wallet_balance - amount,
          updated_at: new Date().toISOString()
        })
        .eq('seller_id', seller_id);

      // Record wallet transaction
      await supabase
        .from('wallet_transactions')
        .insert({
          user_id: seller_id,
          user_type: 'seller',
          amount: amount,
          type: 'debit',
          reason: `Payout request #${payout.payout_id}`,
          reference_id: payout.payout_id,
          created_at: new Date().toISOString()
        });

      // Send notification to seller
      await supabase
        .from('notifications')
        .insert({
          user_id: seller_id,
          user_type: 'seller',
          title: 'Payout Request Submitted',
          message: `Your payout request of ₹${amount} has been submitted. TDS deducted: ₹${tdsAmount}. Net amount: ₹${netAmount}.`,
          type: 'payment',
          data: { payout_id: payout.payout_id, amount, net_amount: netAmount }
        });

      // Send notification to owner
      await supabase
        .from('notifications')
        .insert({
          user_id: 'OWN001',
          user_type: 'owner',
          title: 'New Seller Payout Request',
          message: `${seller.shop_name} requested payout of ₹${amount}. Payout ID: ${payout.payout_id}`,
          type: 'payment',
          data: { payout_id: payout.payout_id, seller_id, amount }
        });

      return new Response(JSON.stringify({
        success: true,
        message: 'Payout request submitted successfully',
        payout: {
          payout_id: payout.payout_id,
          requested_amount: amount,
          tds_amount: tdsAmount,
          net_amount: netAmount,
          upi_id: finalUpiId,
          status: 'PENDING',
          requested_at: payout.requested_at
        },
        wallet_balance: seller.wallet_balance - amount,
        note: `Amount will be credited to your UPI ID (${maskUpi(finalUpiId)}) within 2-3 business days after approval.`
      }), {
        status: 200,
        headers: { 'Content-Type': 'application/json', ...corsHeaders }
      });

    } catch (error) {
      console.error('Request payout error:', error);
      return new Response(JSON.stringify({ 
        success: false, 
        error: error.message 
      }), {
        status: 500,
        headers: { 'Content-Type': 'application/json', ...corsHeaders }
      });
    }
  }

  // Method not allowed
  return new Response(JSON.stringify({ 
    success: false, 
    error: 'Method not allowed' 
  }), {
    status: 405,
    headers: { 'Content-Type': 'application/json', ...corsHeaders }
  });
}

// Helper functions
function getPayoutStatusDisplay(status) {
  const statusMap = {
    'PENDING': 'Pending',
    'PROCESSING': 'Processing',
    'COMPLETED': 'Completed',
    'FAILED': 'Failed'
  };
  return statusMap[status] || status;
}

function maskUpi(upiId) {
  if (!upiId) return '';
  if (upiId.length <= 6) return '***' + upiId.slice(-3);
  return upiId.slice(0, 3) + '***' + upiId.slice(-4);
}