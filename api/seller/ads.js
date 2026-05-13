// api/seller/ads.js
// Edge Function for Vercel Deployment

export const config = {
  runtime: 'edge',
  regions: ['iad1', 'sfo1', 'fra1', 'sin1'],
};

// Helper function to generate Ad ID
function generateAdId() {
  const date = new Date();
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  const random = Math.random().toString(36).substring(2, 8).toUpperCase();
  return `AD${year}${month}${day}${random}`;
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
            gte: (gteField, gteValue) => ({
              select: async () => {
                const finalUrl = `${url}&${field}=eq.${value}&${gteField}=gte.${gteValue}`;
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
                let finalUrl = `${url}&${field}=eq.${value}&order=${orderField}.${sortOrder}&offset=${from}&limit=${to - from + 1}`;
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
              },
              body: JSON.stringify(data)
            });
            return { error: null };
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

  // =====================================================
  // GET ADS DASHBOARD
  // =====================================================
  if (request.method === 'GET') {
    try {
      const url = new URL(request.url);
      const seller_id = url.searchParams.get('seller_id');
      const status = url.searchParams.get('status');
      const page = parseInt(url.searchParams.get('page') || '1');
      const limit = parseInt(url.searchParams.get('limit') || '20');

      if (!seller_id) {
        return new Response(
          JSON.stringify({ success: false, error: 'Seller ID is required' }),
          { status: 400, headers: { 'Content-Type': 'application/json', ...corsHeaders } }
        );
      }

      const supabase = createSupabaseClient();
      const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
      const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

      // Build query for ads
      let adsUrl = `${supabaseUrl}/rest/v1/product_ads?select=*,products!inner(prod_id,name,selling_price,images,stock)&seller_id=eq.${seller_id}&order=created_at.desc`;

      if (status === 'active') {
        adsUrl += `&status=eq.ACTIVE&start_date=lte.${new Date().toISOString()}&end_date=gte.${new Date().toISOString()}`;
      } else if (status === 'ended') {
        adsUrl += `&or=(status.eq.ENDED,end_date.lt.${new Date().toISOString()})`;
      } else if (status === 'pending') {
        adsUrl += `&status=eq.PENDING`;
      }

      const from = (page - 1) * limit;
      const to = from + limit - 1;
      adsUrl += `&offset=${from}&limit=${limit}`;

      const adsResponse = await fetch(adsUrl, {
        headers: {
          'apikey': supabaseKey,
          'Authorization': `Bearer ${supabaseKey}`,
        },
      });
      const ads = await adsResponse.json();
      const count = parseInt(adsResponse.headers.get('content-range')?.split('/')[1] || '0');

      // Calculate ad performance stats
      const adStats = await Promise.all(ads.map(async (ad) => {
        const productUrl = `${supabaseUrl}/rest/v1/products?prod_id=eq.${ad.prod_id}&select=total_views`;
        const productResponse = await fetch(productUrl, {
          headers: {
            'apikey': supabaseKey,
            'Authorization': `Bearer ${supabaseKey}`,
          },
        });
        const productData = await productResponse.json();
        const product = productData[0];

        const cartUrl = `${supabaseUrl}/rest/v1/cart?prod_id=eq.${ad.prod_id}&added_at=gte.${ad.start_date}&added_at=lte.${ad.end_date || new Date().toISOString()}&select=cart_id`;
        const cartResponse = await fetch(cartUrl, {
          headers: {
            'apikey': supabaseKey,
            'Authorization': `Bearer ${supabaseKey}`,
          },
        });
        const cartData = await cartResponse.json();
        const cartClicks = cartData || [];

        const ordersUrl = `${supabaseUrl}/rest/v1/order_items?prod_id=eq.${ad.prod_id}${ad.start_date ? `&created_at=gte.${ad.start_date}` : ''}&select=book_id,quantity,price_at_time`;
        const ordersResponse = await fetch(ordersUrl, {
          headers: {
            'apikey': supabaseKey,
            'Authorization': `Bearer ${supabaseKey}`,
          },
        });
        const orders = await ordersResponse.json();

        const impressions = (product?.total_views || 0) - (ad.initial_views || 0);
        const clicks = cartClicks?.length || 0;
        const ordersCount = orders?.length || 0;
        const revenue = orders?.reduce((sum, o) => sum + (o.price_at_time * o.quantity), 0) || 0;
        const ctr = impressions > 0 ? (clicks / impressions) * 100 : 0;
        const conversionRate = clicks > 0 ? (ordersCount / clicks) * 100 : 0;
        const roas = ad.budget > 0 ? revenue / ad.budget : 0;

        return {
          ...ad,
          impressions,
          clicks,
          orders: ordersCount,
          revenue,
          ctr: ctr.toFixed(2),
          conversion_rate: conversionRate.toFixed(2),
          roas: roas.toFixed(2),
          cost_per_click: clicks > 0 ? ad.budget / clicks : 0,
          cost_per_order: ordersCount > 0 ? ad.budget / ordersCount : 0
        };
      }));

      // Get seller wallet balance
      const sellerResult = await supabase
        .from('sellers')
        .select('wallet_balance')
        .eq('seller_id', seller_id)
        .single();

      // Get available products for ads
      const productsUrl = `${supabaseUrl}/rest/v1/products?seller_id=eq.${seller_id}&is_active=eq.true&is_approved=eq.true&order=total_sold.desc&limit=20&select=prod_id,name,selling_price,stock,images,total_sold,rating`;
      const productsResponse = await fetch(productsUrl, {
        headers: {
          'apikey': supabaseKey,
          'Authorization': `Bearer ${supabaseKey}`,
        },
      });
      const availableProducts = await productsResponse.json();

      // Ad plans
      const adPlans = [
        { plan_id: 1, name: 'Starter', daily_budget: 100, duration_days: 7, total_budget: 700, impressions_estimate: 5000, clicks_estimate: 100 },
        { plan_id: 2, name: 'Popular', daily_budget: 250, duration_days: 14, total_budget: 3500, impressions_estimate: 20000, clicks_estimate: 400 },
        { plan_id: 3, name: 'Premium', daily_budget: 500, duration_days: 30, total_budget: 15000, impressions_estimate: 100000, clicks_estimate: 2000 },
        { plan_id: 4, name: 'Enterprise', daily_budget: 1000, duration_days: 30, total_budget: 30000, impressions_estimate: 250000, clicks_estimate: 5000 }
      ];

      // Get all ads for stats
      const allAdsUrl = `${supabaseUrl}/rest/v1/product_ads?seller_id=eq.${seller_id}&select=budget,status`;
      const allAdsResponse = await fetch(allAdsUrl, {
        headers: {
          'apikey': supabaseKey,
          'Authorization': `Bearer ${supabaseKey}`,
        },
      });
      const allAds = await allAdsResponse.json();

      const totalSpent = allAds?.reduce((sum, ad) => sum + (ad.budget || 0), 0) || 0;
      const activeBudget = allAds?.filter(ad => ad.status === 'ACTIVE').reduce((sum, ad) => sum + (ad.budget || 0), 0) || 0;
      const topAds = [...adStats].sort((a, b) => parseFloat(b.roas) - parseFloat(a.roas)).slice(0, 5);

      return new Response(
        JSON.stringify({
          success: true,
          wallet_balance: sellerResult.data?.wallet_balance || 0,
          ad_plans: adPlans,
          available_products: availableProducts?.map(p => ({
            prod_id: p.prod_id,
            name: p.name,
            selling_price: p.selling_price,
            stock: p.stock,
            image: p.images?.[0] || null,
            total_sold: p.total_sold || 0,
            rating: p.rating || 0
          })) || [],
          active_ads: adStats.filter(ad => ad.status === 'ACTIVE' && new Date(ad.end_date) >= new Date()),
          ad_history: adStats,
          statistics: {
            total_spent: totalSpent,
            active_budget: activeBudget,
            total_ads: adStats.length,
            active_ads_count: adStats.filter(ad => ad.status === 'ACTIVE').length,
            total_clicks: adStats.reduce((sum, ad) => sum + (ad.clicks || 0), 0),
            total_impressions: adStats.reduce((sum, ad) => sum + (ad.impressions || 0), 0),
            total_orders: adStats.reduce((sum, ad) => sum + (ad.orders || 0), 0),
            total_revenue: adStats.reduce((sum, ad) => sum + (ad.revenue || 0), 0),
            avg_roas: adStats.length > 0 ? (adStats.reduce((sum, ad) => sum + parseFloat(ad.roas || 0), 0) / adStats.length).toFixed(2) : 0
          },
          top_performing_ads: topAds,
          pagination: {
            current_page: page,
            total_pages: Math.ceil(count / limit),
            total_items: count,
            items_per_page: limit
          }
        }),
        { status: 200, headers: { 'Content-Type': 'application/json', ...corsHeaders } }
      );

    } catch (error) {
      console.error('Get ads error:', error);
      return new Response(
        JSON.stringify({ success: false, error: error.message }),
        { status: 500, headers: { 'Content-Type': 'application/json', ...corsHeaders } }
      );
    }
  }

  // =====================================================
  // CREATE AD CAMPAIGN (POST)
  // =====================================================
  if (request.method === 'POST') {
    try {
      const body = await request.json();
      const {
        seller_id,
        prod_id,
        plan_id,
        daily_budget,
        duration_days,
        keywords,
        target_categories,
        start_date
      } = body;

      if (!seller_id || !prod_id || !daily_budget || !duration_days) {
        return new Response(
          JSON.stringify({
            success: false,
            error: 'Seller ID, Product ID, daily budget and duration are required'
          }),
          { status: 400, headers: { 'Content-Type': 'application/json', ...corsHeaders } }
        );
      }

      const supabase = createSupabaseClient();
      const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
      const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

      // Get seller details
      const sellerResult = await supabase
        .from('sellers')
        .select('wallet_balance, shop_name')
        .eq('seller_id', seller_id)
        .single();

      if (sellerResult.error || !sellerResult.data) {
        return new Response(
          JSON.stringify({ success: false, error: 'Seller not found' }),
          { status: 404, headers: { 'Content-Type': 'application/json', ...corsHeaders } }
        );
      }

      const seller = sellerResult.data;
      const totalBudget = daily_budget * duration_days;

      if (seller.wallet_balance < totalBudget) {
        return new Response(
          JSON.stringify({
            success: false,
            error: `Insufficient balance. Required: ₹${totalBudget}, Available: ₹${seller.wallet_balance}`
          }),
          { status: 400, headers: { 'Content-Type': 'application/json', ...corsHeaders } }
        );
      }

      // Get product details
      const productResult = await supabase
        .from('products')
        .select('prod_id, name, total_views')
        .eq('prod_id', prod_id)
        .eq('seller_id', seller_id)
        .single();

      if (productResult.error || !productResult.data) {
        return new Response(
          JSON.stringify({ success: false, error: 'Product not found or unauthorized' }),
          { status: 404, headers: { 'Content-Type': 'application/json', ...corsHeaders } }
        );
      }

      const product = productResult.data;
      const adId = generateAdId();
      const startDate = start_date ? new Date(start_date) : new Date();
      const endDate = new Date(startDate);
      endDate.setDate(endDate.getDate() + duration_days);
      const initialViews = product.total_views || 0;

      // Create ad campaign
      const adInsert = await supabase
        .from('product_ads')
        .insert({
          ad_id: adId,
          seller_id,
          prod_id,
          plan_id: plan_id || null,
          daily_budget: daily_budget,
          duration_days: duration_days,
          total_budget: totalBudget,
          keywords: keywords || null,
          target_categories: target_categories || null,
          initial_views: initialViews,
          start_date: startDate.toISOString(),
          end_date: endDate.toISOString(),
          status: 'PENDING',
          created_at: new Date().toISOString()
        })
        .select();

      if (adInsert.error) {
        console.error('Ad creation error:', adInsert.error);
        return new Response(
          JSON.stringify({ success: false, error: adInsert.error.message }),
          { status: 500, headers: { 'Content-Type': 'application/json', ...corsHeaders } }
        );
      }

      const ad = adInsert.data;

      // Deduct amount from wallet
      await fetch(`${supabaseUrl}/rest/v1/sellers?seller_id=eq.${seller_id}`, {
        method: 'PATCH',
        headers: {
          'apikey': supabaseKey,
          'Authorization': `Bearer ${supabaseKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ wallet_balance: seller.wallet_balance - totalBudget })
      });

      // Record wallet transaction
      await fetch(`${supabaseUrl}/rest/v1/wallet_transactions`, {
        method: 'POST',
        headers: {
          'apikey': supabaseKey,
          'Authorization': `Bearer ${supabaseKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          user_id: seller_id,
          user_type: 'seller',
          amount: totalBudget,
          type: 'debit',
          reason: `Ad campaign for ${product.name}`,
          reference_id: adId,
          created_at: new Date().toISOString()
        })
      });

      // Notify owner
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
          title: '📢 New Ad Campaign Pending Approval',
          message: `${seller.shop_name} created an ad campaign for ${product.name} with budget ₹${totalBudget}`,
          type: 'advertising',
          data: { ad_id: adId, seller_id, prod_id, budget: totalBudget },
          created_at: new Date().toISOString()
        })
      });

      // Notify seller
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
          title: 'Ad Campaign Created',
          message: `Your ad campaign for "${product.name}" has been created and is pending approval.`,
          type: 'advertising',
          data: { ad_id: adId, prod_id },
          created_at: new Date().toISOString()
        })
      });

      return new Response(
        JSON.stringify({
          success: true,
          message: 'Ad campaign created successfully. Waiting for approval.',
          ad: {
            ad_id: ad.ad_id,
            prod_id: ad.prod_id,
            daily_budget: ad.daily_budget,
            total_budget: ad.total_budget,
            duration_days: ad.duration_days,
            start_date: ad.start_date,
            end_date: ad.end_date,
            status: ad.status
          },
          wallet_balance: seller.wallet_balance - totalBudget,
          next_steps: [
            'Owner will review your ad campaign',
            'Approval typically takes 24 hours',
            'You will be notified once approved',
            'Ad will start running from the start date'
          ]
        }),
        { status: 200, headers: { 'Content-Type': 'application/json', ...corsHeaders } }
      );

    } catch (error) {
      console.error('Create ad error:', error);
      return new Response(
        JSON.stringify({ success: false, error: error.message }),
        { status: 500, headers: { 'Content-Type': 'application/json', ...corsHeaders } }
      );
    }
  }

  // =====================================================
  // UPDATE/CANCEL AD CAMPAIGN (PUT)
  // =====================================================
  if (request.method === 'PUT') {
    try {
      const body = await request.json();
      const { ad_id, seller_id, action } = body;

      if (!ad_id || !seller_id || !action) {
        return new Response(
          JSON.stringify({
            success: false,
            error: 'Ad ID, Seller ID and action are required'
          }),
          { status: 400, headers: { 'Content-Type': 'application/json', ...corsHeaders } }
        );
      }

      const supabase = createSupabaseClient();
      const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
      const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

      // Get ad details
      const adUrl = `${supabaseUrl}/rest/v1/product_ads?ad_id=eq.${ad_id}&seller_id=eq.${seller_id}&select=*,products(name)`;
      const adResponse = await fetch(adUrl, {
        headers: {
          'apikey': supabaseKey,
          'Authorization': `Bearer ${supabaseKey}`,
        },
      });
      const adData = await adResponse.json();
      const ad = adData[0];

      if (!ad) {
        return new Response(
          JSON.stringify({ success: false, error: 'Ad campaign not found or unauthorized' }),
          { status: 404, headers: { 'Content-Type': 'application/json', ...corsHeaders } }
        );
      }

      let updateData = {};
      let message = '';

      switch (action) {
        case 'pause':
          if (ad.status !== 'ACTIVE') {
            return new Response(
          JSON.stringify({ success: false, error: 'Only active ads can be paused' }),
          { status: 400, headers: { 'Content-Type': 'application/json', ...corsHeaders } }
            );
          }
          updateData.status = 'PAUSED';
          message = 'Ad campaign paused successfully';
          break;

        case 'resume':
          if (ad.status !== 'PAUSED') {
            return new Response(
          JSON.stringify({ success: false, error: 'Only paused ads can be resumed' }),
          { status: 400, headers: { 'Content-Type': 'application/json', ...corsHeaders } }
            );
          }
          updateData.status = 'ACTIVE';
          message = 'Ad campaign resumed successfully';
          break;

        case 'cancel':
          if (!['PENDING', 'ACTIVE', 'PAUSED'].includes(ad.status)) {
            return new Response(
          JSON.stringify({ success: false, error: 'This ad cannot be cancelled' }),
          { status: 400, headers: { 'Content-Type': 'application/json', ...corsHeaders } }
            );
          }
          updateData.status = 'CANCELLED';
          updateData.end_date = new Date().toISOString();
          message = 'Ad campaign cancelled successfully';

          if (ad.status === 'ACTIVE' || ad.status === 'PAUSED') {
            const startDate = new Date(ad.start_date);
            const endDate = new Date(ad.end_date);
            const totalDays = Math.ceil((endDate - startDate) / (1000 * 60 * 60 * 24));
            const usedDays = Math.ceil((new Date() - startDate) / (1000 * 60 * 60 * 24));
            const unusedDays = Math.max(0, totalDays - usedDays);
            const refundAmount = ad.daily_budget * unusedDays;

            if (refundAmount > 0) {
              // Get current wallet balance
              const sellerWalletUrl = `${supabaseUrl}/rest/v1/sellers?seller_id=eq.${seller_id}&select=wallet_balance`;
              const sellerWalletResponse = await fetch(sellerWalletUrl, {
                headers: {
                  'apikey': supabaseKey,
                  'Authorization': `Bearer ${supabaseKey}`,
                },
              });
              const sellerWalletData = await sellerWalletResponse.json();
              const currentBalance = sellerWalletData[0]?.wallet_balance || 0;

              await fetch(`${supabaseUrl}/rest/v1/sellers?seller_id=eq.${seller_id}`, {
                method: 'PATCH',
                headers: {
                  'apikey': supabaseKey,
                  'Authorization': `Bearer ${supabaseKey}`,
                  'Content-Type': 'application/json',
                },
                body: JSON.stringify({ wallet_balance: currentBalance + refundAmount })
              });

              await fetch(`${supabaseUrl}/rest/v1/wallet_transactions`, {
                method: 'POST',
                headers: {
                  'apikey': supabaseKey,
                  'Authorization': `Bearer ${supabaseKey}`,
                  'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                  user_id: seller_id,
                  user_type: 'seller',
                  amount: refundAmount,
                  type: 'credit',
                  reason: `Ad campaign refund for ${ad.products?.name}`,
                  reference_id: ad_id,
                  created_at: new Date().toISOString()
                })
              });

              updateData.refund_amount = refundAmount;
              message += ` Refund of ₹${refundAmount} credited to wallet.`;
            }
          }
          break;

        default:
          return new Response(
            JSON.stringify({ success: false, error: 'Invalid action' }),
            { status: 400, headers: { 'Content-Type': 'application/json', ...corsHeaders } }
          );
      }

      updateData.updated_at = new Date().toISOString();

      await fetch(`${supabaseUrl}/rest/v1/product_ads?ad_id=eq.${ad_id}`, {
        method: 'PATCH',
        headers: {
          'apikey': supabaseKey,
          'Authorization': `Bearer ${supabaseKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(updateData)
      });

      return new Response(
        JSON.stringify({
          success: true,
          message: message,
          ad: {
            ad_id: ad_id,
            status: updateData.status || ad.status,
            updated_at: updateData.updated_at
          }
        }),
        { status: 200, headers: { 'Content-Type': 'application/json', ...corsHeaders } }
      );

    } catch (error) {
      console.error('Update ad error:', error);
      return new Response(
        JSON.stringify({ success: false, error: error.message }),
        { status: 500, headers: { 'Content-Type': 'application/json', ...corsHeaders } }
      );
    }
  }

  return new Response(
    JSON.stringify({ success: false, error: 'Method not allowed' }),
    { status: 405, headers: { 'Content-Type': 'application/json', ...corsHeaders } }
  );
}