// api/customer/order.js
// Edge Function for Vercel Deployment

export const config = {
  runtime: 'edge',
  regions: ['iad1', 'sfo1', 'fra1', 'sin1'],
};

// Helper function to create Supabase client in Edge environment
function createSupabaseClient(useServiceRole = false) {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  let supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  
  if (useServiceRole) {
    const serviceRole = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (serviceRole) {
      supabaseKey = serviceRole;
    }
  }
  
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
            return { data: result[0] || result, error: null };
          }
        })
      }),
      delete: () => ({
        eq: (field, value) => ({
          select: async () => {
            const response = await fetch(`${supabaseUrl}/rest/v1/${table}?${field}=eq.${value}`, {
              method: 'DELETE',
              headers: {
                'apikey': supabaseKey,
                'Authorization': `Bearer ${supabaseKey}`,
              },
            });
            return { error: null };
          }
        })
      }),
      rpc: async (functionName, params) => {
        const response = await fetch(`${supabaseUrl}/rest/v1/rpc/${functionName}`, {
          method: 'POST',
          headers: {
            'apikey': supabaseKey,
            'Authorization': `Bearer ${supabaseKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(params)
        });
        const result = await response.json();
        return { data: result, error: null };
      }
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

  try {
    const supabase = createSupabaseClient(false);
    const supabaseAdmin = createSupabaseClient(true);
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

    // =====================================================
    // GET ORDERS LIST
    // =====================================================
    if (request.method === 'GET') {
      const url = new URL(request.url);
      const cust_id = url.searchParams.get('cust_id');
      const status = url.searchParams.get('status');
      const page = parseInt(url.searchParams.get('page') || '1');
      const limit = parseInt(url.searchParams.get('limit') || '20');

      if (!cust_id) {
        return new Response(
          JSON.stringify({ success: false, error: 'Customer ID is required' }),
          { status: 400, headers: { 'Content-Type': 'application/json', ...corsHeaders } }
        );
      }

      const orderSelect = `*,
        order_items (
          item_id,
          quantity,
          price_at_time,
          products!inner (
            prod_id,
            name,
            images
          )
        ),
        sellers!inner (
          seller_id,
          shop_name
        )`;

      let ordersUrl = `${supabaseUrl}/rest/v1/orders?select=${encodeURIComponent(orderSelect)}&cust_id=eq.${cust_id}&order=placed_at.desc`;
      if (status && status !== 'all') {
        ordersUrl += `&status=eq.${status}`;
      }

      const from = (page - 1) * limit;
      const to = from + limit - 1;
      ordersUrl += `&offset=${from}&limit=${limit}`;

      const ordersResponse = await fetch(ordersUrl, {
        headers: {
          'apikey': supabaseKey,
          'Authorization': `Bearer ${supabaseKey}`,
        },
      });
      const orders = await ordersResponse.json();
      const count = parseInt(ordersResponse.headers.get('content-range')?.split('/')[1] || '0');

      const formattedOrders = (orders || []).map(order => ({
        book_id: order.book_id,
        tracking_id: order.tracking_id,
        cancel_code: order.cancel_code,
        cancel_code_expiry: order.cancel_code_expiry,
        status: order.status,
        total_amount: order.total_amount,
        delivery_charge: order.delivery_charge,
        discount_amount: order.discount_amount,
        final_amount: order.final_amount,
        address: order.address,
        placed_at: order.placed_at,
        delivered_at: order.delivered_at,
        items: (order.order_items || []).map(item => ({
          prod_id: item.products.prod_id,
          name: item.products.name,
          quantity: item.quantity,
          price: item.price_at_time,
          image: item.products.images?.[0] || null
        })),
        seller: {
          seller_id: order.sellers.seller_id,
          shop_name: order.sellers.shop_name
        },
        can_cancel: order.status === 'PENDING' || order.status === 'ACCEPTED',
        can_return: order.status === 'DELIVERED' && 
                    new Date(order.delivered_at) > new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)
      }));

      return new Response(
        JSON.stringify({
          success: true,
          orders: formattedOrders,
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
    // PLACE ORDER (COD ONLY)
    // =====================================================
    if (request.method === 'POST') {
      const body = await request.json();
      const {
        cust_id,
        items,
        address,
        total_amount,
        delivery_charge,
        discount_amount,
        final_amount,
        use_coins,
        use_wallet
      } = body;

      // Validation
      if (!cust_id || !items || !items.length || !address) {
        return new Response(
          JSON.stringify({
            success: false,
            error: 'Customer ID, items, and address are required'
          }),
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

      // Check COD status
      if (customer.cod_status === 'BLOCKED') {
        return new Response(
          JSON.stringify({
            success: false,
            error: `COD is blocked for your account until ${customer.cod_block_until}. Reason: ${customer.cod_block_reason}`
          }),
          { status: 403, headers: { 'Content-Type': 'application/json', ...corsHeaders } }
        );
      }

      // Group items by seller and validate stock
      const sellerGroups = {};
      for (const item of items) {
        const productUrl = `${supabaseUrl}/rest/v1/products?prod_id=eq.${item.prod_id}&select=seller_id,stock,name`;
        const productResponse = await fetch(productUrl, {
          headers: {
            'apikey': supabaseKey,
            'Authorization': `Bearer ${supabaseKey}`,
          },
        });
        const productData = await productResponse.json();
        const product = productData[0];

        if (!product) {
          return new Response(
            JSON.stringify({ success: false, error: `Product ${item.prod_id} not found` }),
            { status: 404, headers: { 'Content-Type': 'application/json', ...corsHeaders } }
          );
        }

        if (product.stock < item.quantity) {
          return new Response(
            JSON.stringify({
              success: false,
              error: `Insufficient stock for ${product.name}. Available: ${product.stock}`
            }),
            { status: 400, headers: { 'Content-Type': 'application/json', ...corsHeaders } }
          );
        }

        if (!sellerGroups[product.seller_id]) {
          sellerGroups[product.seller_id] = [];
        }
        sellerGroups[product.seller_id].push({
          ...item,
          product_name: product.name
        });
      }

      // Process wallet/coins if used
      let walletDeduction = 0;
      let coinDeduction = 0;
      let finalFinalAmount = final_amount || total_amount + (delivery_charge || 40) - (discount_amount || 0);

      if (use_wallet && customer.wallet_balance > 0) {
        walletDeduction = Math.min(customer.wallet_balance, finalFinalAmount);
        finalFinalAmount -= walletDeduction;

        await fetch(`${supabaseUrl}/rest/v1/wallet_transactions`, {
          method: 'POST',
          headers: {
            'apikey': supabaseKey,
            'Authorization': `Bearer ${supabaseKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            user_id: cust_id,
            user_type: 'customer',
            amount: walletDeduction,
            type: 'debit',
            reason: 'Order payment',
            created_at: new Date().toISOString()
          })
        });

        await fetch(`${supabaseUrl}/rest/v1/customers?cust_id=eq.${cust_id}`, {
          method: 'PATCH',
          headers: {
            'apikey': supabaseKey,
            'Authorization': `Bearer ${supabaseKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ wallet_balance: customer.wallet_balance - walletDeduction })
        });
      }

      if (use_coins && customer.coins > 0 && finalFinalAmount > 0) {
        coinDeduction = Math.min(customer.coins, finalFinalAmount);
        finalFinalAmount -= coinDeduction;

        await fetch(`${supabaseUrl}/rest/v1/coin_transactions`, {
          method: 'POST',
          headers: {
            'apikey': supabaseKey,
            'Authorization': `Bearer ${supabaseKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            cust_id: cust_id,
            coins: coinDeduction,
            type: 'debit',
            reason: 'Order payment',
            created_at: new Date().toISOString()
          })
        });

        const currentCustomerUrl = `${supabaseUrl}/rest/v1/customers?cust_id=eq.${cust_id}&select=coins`;
        const currentCustomerResponse = await fetch(currentCustomerUrl, {
          headers: {
            'apikey': supabaseKey,
            'Authorization': `Bearer ${supabaseKey}`,
          },
        });
        const currentCustomerData = await currentCustomerResponse.json();
        const currentCoins = currentCustomerData[0]?.coins || 0;

        await fetch(`${supabaseUrl}/rest/v1/customers?cust_id=eq.${cust_id}`, {
          method: 'PATCH',
          headers: {
            'apikey': supabaseKey,
            'Authorization': `Bearer ${supabaseKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ coins: currentCoins - coinDeduction })
        });
      }

      // Create orders for each seller
      const placedOrders = [];
      let allOrderSuccess = true;

      for (const [sellerId, sellerItems] of Object.entries(sellerGroups)) {
        const sellerTotal = sellerItems.reduce((sum, item) => sum + (item.price * item.quantity), 0);
        const sellerDeliveryCharge = delivery_charge || 40;
        const sellerFinalAmount = sellerTotal + sellerDeliveryCharge;

        // Generate tracking ID and cancel code
        const trackingId = 'TRK' + Date.now() + Math.random().toString(36).substring(2, 8).toUpperCase();
        const cancelCode = Math.random().toString(36).substring(2, 10).toUpperCase();
        const cancelCodeExpiry = new Date();
        cancelCodeExpiry.setDate(cancelCodeExpiry.getDate() + 2);

        const orderBookId = 'ORD' + Date.now() + Math.random().toString(36).substring(2, 6).toUpperCase();

        // Insert order
        const orderInsertResponse = await fetch(`${supabaseUrl}/rest/v1/orders`, {
          method: 'POST',
          headers: {
            'apikey': supabaseKey,
            'Authorization': `Bearer ${supabaseKey}`,
            'Content-Type': 'application/json',
            'Prefer': 'return=representation'
          },
          body: JSON.stringify({
            book_id: orderBookId,
            cust_id,
            seller_id: sellerId,
            total_amount: sellerTotal,
            delivery_charge: sellerDeliveryCharge,
            discount_amount: 0,
            final_amount: sellerFinalAmount,
            payment_method: 'COD',
            address: JSON.stringify(address),
            status: 'PENDING',
            tracking_id: trackingId,
            cancel_code: cancelCode,
            cancel_code_expiry: cancelCodeExpiry.toISOString(),
            placed_at: new Date().toISOString()
          })
        });
        
        const orderInsertData = await orderInsertResponse.json();
        const newOrder = orderInsertData[0];

        if (!newOrder) {
          console.error('Order creation error');
          allOrderSuccess = false;
          continue;
        }

        // Create order items
        for (const item of sellerItems) {
          await fetch(`${supabaseUrl}/rest/v1/order_items`, {
            method: 'POST',
            headers: {
              'apikey': supabaseKey,
              'Authorization': `Bearer ${supabaseKey}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              book_id: newOrder.book_id,
              prod_id: item.prod_id,
              quantity: item.quantity,
              price_at_time: item.price,
              variation_id: item.variation_id || null
            })
          });

          // Update product stock - manual update
          const productStockUrl = `${supabaseUrl}/rest/v1/products?prod_id=eq.${item.prod_id}&select=stock`;
          const productStockResponse = await fetch(productStockUrl, {
            headers: {
              'apikey': supabaseKey,
              'Authorization': `Bearer ${supabaseKey}`,
            },
          });
          const productStockData = await productStockResponse.json();
          const productStock = productStockData[0];

          if (productStock) {
            await fetch(`${supabaseUrl}/rest/v1/products?prod_id=eq.${item.prod_id}`, {
              method: 'PATCH',
              headers: {
                'apikey': supabaseKey,
                'Authorization': `Bearer ${supabaseKey}`,
                'Content-Type': 'application/json',
              },
              body: JSON.stringify({ stock: productStock.stock - item.quantity })
            });
          }
        }

        placedOrders.push(newOrder);
      }

      // Clear cart items for this customer
      await fetch(`${supabaseUrl}/rest/v1/cart?cust_id=eq.${cust_id}`, {
        method: 'DELETE',
        headers: {
          'apikey': supabaseKey,
          'Authorization': `Bearer ${supabaseKey}`,
        },
      });

      if (!allOrderSuccess && placedOrders.length === 0) {
        return new Response(
          JSON.stringify({ success: false, error: 'Failed to place orders' }),
          { status: 500, headers: { 'Content-Type': 'application/json', ...corsHeaders } }
        );
      }

      // Send notifications
      for (const order of placedOrders) {
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
            title: 'Order Confirmed',
            message: `Your order #${order.book_id} has been placed successfully. Cancel Code: ${order.cancel_code}`,
            type: 'order',
            data: { order_id: order.book_id, cancel_code: order.cancel_code },
            created_at: new Date().toISOString()
          })
        });

        await fetch(`${supabaseUrl}/rest/v1/notifications`, {
          method: 'POST',
          headers: {
            'apikey': supabaseKey,
            'Authorization': `Bearer ${supabaseKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            user_id: order.seller_id,
            user_type: 'seller',
            title: 'New Order Received',
            message: `You have received a new order #${order.book_id}`,
            type: 'order',
            data: { order_id: order.book_id },
            created_at: new Date().toISOString()
          })
        });
      }

      return new Response(
        JSON.stringify({
          success: true,
          message: 'Order placed successfully',
          orders: placedOrders.map(order => ({
            book_id: order.book_id,
            tracking_id: order.tracking_id,
            cancel_code: order.cancel_code,
            cancel_code_expiry: order.cancel_code_expiry,
            status: order.status,
            final_amount: order.final_amount,
            placed_at: order.placed_at
          })),
          wallet_used: walletDeduction,
          coins_used: coinDeduction,
          final_payable: finalFinalAmount,
          payment_method: 'COD'
        }),
        { status: 200, headers: { 'Content-Type': 'application/json', ...corsHeaders } }
      );
    }

    return new Response(
      JSON.stringify({ success: false, error: 'Method not allowed' }),
      { status: 405, headers: { 'Content-Type': 'application/json', ...corsHeaders } }
    );

  } catch (error) {
    console.error('Order error:', error);
    return new Response(
      JSON.stringify({ success: false, error: error.message || 'Internal server error' }),
      { status: 500, headers: { 'Content-Type': 'application/json', ...corsHeaders } }
    );
  }
}