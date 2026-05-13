// api/customer/return-exchange.js
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
            neq: (neqField, neqValue) => ({
              limit: async (limit) => {
                const finalUrl = `${url}&${field}=eq.${value}&${neqField}=neq.${neqValue}&limit=${limit}`;
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
    'Access-Control-Allow-Methods': 'POST, GET, OPTIONS',
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
    // GET RETURN/EXCHANGE ELIGIBILITY
    // =====================================================
    if (request.method === 'GET') {
      const url = new URL(request.url);
      const book_id = url.searchParams.get('book_id');
      const prod_id = url.searchParams.get('prod_id');
      const cust_id = url.searchParams.get('cust_id');

      if (!book_id) {
        return new Response(
          JSON.stringify({ success: false, error: 'Order ID is required' }),
          { status: 400, headers: { 'Content-Type': 'application/json', ...corsHeaders } }
        );
      }

      // Get order details with items and products
      const orderSelect = `*,
        order_items (
          item_id,
          quantity,
          price_at_time,
          products (
            prod_id,
            name,
            images
          )
        )`;
      const orderUrl = `${supabaseUrl}/rest/v1/orders?select=${encodeURIComponent(orderSelect)}&book_id=eq.${book_id}`;
      const orderResponse = await fetch(orderUrl, {
        headers: {
          'apikey': supabaseKey,
          'Authorization': `Bearer ${supabaseKey}`,
        },
      });
      const orderData = await orderResponse.json();
      const order = orderData[0];

      if (!order) {
        return new Response(
          JSON.stringify({ success: false, error: 'Order not found' }),
          { status: 404, headers: { 'Content-Type': 'application/json', ...corsHeaders } }
        );
      }

      // Verify ownership
      if (cust_id && order.cust_id !== cust_id) {
        return new Response(
          JSON.stringify({ success: false, error: 'Unauthorized' }),
          { status: 403, headers: { 'Content-Type': 'application/json', ...corsHeaders } }
        );
      }

      // Check if return is eligible (within 7 days of delivery)
      let returnEligible = false;
      let returnWindowEnds = null;
      let exchangeEligible = false;
      let exchangeWindowEnds = null;

      if (order.status === 'DELIVERED' && order.delivered_at) {
        const deliveryDate = new Date(order.delivered_at);
        const returnDeadline = new Date(deliveryDate);
        returnDeadline.setDate(returnDeadline.getDate() + 7);
        returnEligible = new Date() <= returnDeadline;
        returnWindowEnds = returnDeadline;

        exchangeEligible = returnEligible;
        exchangeWindowEnds = returnDeadline;
      }

      // Get return reasons from settings
      const reasonsUrl = `${supabaseUrl}/rest/v1/system_settings?setting_key=eq.return_reasons&select=setting_value`;
      const reasonsResponse = await fetch(reasonsUrl, {
        headers: {
          'apikey': supabaseKey,
          'Authorization': `Bearer ${supabaseKey}`,
        },
      });
      const reasonsData = await reasonsResponse.json();
      const reasonsSetting = reasonsData[0];

      let returnReasons = [
        'Product damaged/defective',
        'Wrong product delivered',
        'Size/color not matching',
        'Product not as described',
        'Quality issue',
        'Missing parts/accessories',
        'Expired product',
        'Other'
      ];

      if (reasonsSetting && reasonsSetting.setting_value) {
        try {
          returnReasons = JSON.parse(reasonsSetting.setting_value);
        } catch (e) {}
      }

      // Get exchange reasons
      let exchangeReasons = [
        'Size exchange needed',
        'Color exchange needed',
        'Different variant wanted',
        'Product not suitable',
        'Other'
      ];

      // Get available exchange products (same seller, similar category)
      let exchangeOptions = [];
      const targetProdId = prod_id || (order.order_items && order.order_items[0]?.prod_id);
      
      if (exchangeEligible && targetProdId) {
        const currentProductUrl = `${supabaseUrl}/rest/v1/products?prod_id=eq.${targetProdId}&select=seller_id,category_id,selling_price`;
        const currentProductResponse = await fetch(currentProductUrl, {
          headers: {
            'apikey': supabaseKey,
            'Authorization': `Bearer ${supabaseKey}`,
          },
        });
        const currentProductData = await currentProductResponse.json();
        const currentProduct = currentProductData[0];

        if (currentProduct) {
          const similarProductsUrl = `${supabaseUrl}/rest/v1/products?select=prod_id,name,selling_price,mrp,images&seller_id=eq.${currentProduct.seller_id}&category_id=eq.${currentProduct.category_id}&is_active=eq.true&is_approved=eq.true&prod_id=neq.${targetProdId}&limit=10`;
          const similarProductsResponse = await fetch(similarProductsUrl, {
            headers: {
              'apikey': supabaseKey,
              'Authorization': `Bearer ${supabaseKey}`,
            },
          });
          const similarProducts = await similarProductsResponse.json();

          exchangeOptions = (similarProducts || []).map(p => ({
            prod_id: p.prod_id,
            name: p.name,
            selling_price: p.selling_price,
            mrp: p.mrp,
            price_difference: p.selling_price - currentProduct.selling_price,
            image: p.images?.[0] || null
          }));
        }
      }

      // Check if already returned/exchanged
      const existingReturnUrl = `${supabaseUrl}/rest/v1/returns?book_id=eq.${book_id}&prod_id=eq.${targetProdId}&select=return_id,status`;
      const existingReturnResponse = await fetch(existingReturnUrl, {
        headers: {
          'apikey': supabaseKey,
          'Authorization': `Bearer ${supabaseKey}`,
        },
      });
      const existingReturnData = await existingReturnResponse.json();
      const existingReturn = existingReturnData[0];

      const existingExchangeUrl = `${supabaseUrl}/rest/v1/exchanges?old_book_id=eq.${book_id}&select=exchange_id,status`;
      const existingExchangeResponse = await fetch(existingExchangeUrl, {
        headers: {
          'apikey': supabaseKey,
          'Authorization': `Bearer ${supabaseKey}`,
        },
      });
      const existingExchangeData = await existingExchangeResponse.json();
      const existingExchange = existingExchangeData[0];

      const alreadyReturned = existingReturn && existingReturn.status !== 'REJECTED';
      const alreadyExchanged = existingExchange && existingExchange.status !== 'REJECTED';

      // Format order items safely
      const formattedItems = (order.order_items || []).map(item => ({
        prod_id: item.products?.prod_id,
        name: item.products?.name,
        quantity: item.quantity,
        price: item.price_at_time,
        image: item.products?.images?.[0] || null
      }));

      return new Response(
        JSON.stringify({
          success: true,
          return_eligible: returnEligible && !alreadyReturned,
          exchange_eligible: exchangeEligible && !alreadyExchanged,
          return_window_ends: returnWindowEnds ? returnWindowEnds.toISOString() : null,
          exchange_window_ends: exchangeWindowEnds ? exchangeWindowEnds.toISOString() : null,
          already_returned: alreadyReturned,
          already_exchanged: alreadyExchanged,
          return_reasons: returnReasons,
          exchange_reasons: exchangeReasons,
          exchange_options: exchangeOptions,
          order_details: {
            book_id: order.book_id,
            placed_at: order.placed_at,
            delivered_at: order.delivered_at,
            final_amount: order.final_amount,
            items: formattedItems
          }
        }),
        { status: 200, headers: { 'Content-Type': 'application/json', ...corsHeaders } }
      );
    }

    // =====================================================
    // CREATE RETURN REQUEST (POST)
    // =====================================================
    if (request.method === 'POST') {
      const body = await request.json();
      const { type, ...rest } = body;

      // CREATE RETURN REQUEST
      if (type === 'return') {
        const {
          book_id,
          prod_id,
          cust_id,
          reason,
          reason_detail,
          product_photo,
          product_video
        } = rest;

        if (!book_id || !prod_id || !reason) {
          return new Response(
            JSON.stringify({ success: false, error: 'Order ID, Product ID and reason are required' }),
            { status: 400, headers: { 'Content-Type': 'application/json', ...corsHeaders } }
          );
        }

        // Get order details with customer info
        const orderSelect = `*, customers!inner(cust_id, name, mobile)`;
        const orderUrl = `${supabaseUrl}/rest/v1/orders?select=${encodeURIComponent(orderSelect)}&book_id=eq.${book_id}`;
        const orderResponse = await fetch(orderUrl, {
          headers: {
            'apikey': supabaseKey,
            'Authorization': `Bearer ${supabaseKey}`,
          },
        });
        const orderData = await orderResponse.json();
        const order = orderData[0];

        if (!order) {
          return new Response(
            JSON.stringify({ success: false, error: 'Order not found' }),
            { status: 404, headers: { 'Content-Type': 'application/json', ...corsHeaders } }
          );
        }

        // Verify ownership
        if (order.cust_id !== cust_id) {
          return new Response(
            JSON.stringify({ success: false, error: 'Unauthorized' }),
            { status: 403, headers: { 'Content-Type': 'application/json', ...corsHeaders } }
          );
        }

        // Check return eligibility
        if (order.status !== 'DELIVERED') {
          return new Response(
            JSON.stringify({ success: false, error: 'Return only possible after delivery' }),
            { status: 400, headers: { 'Content-Type': 'application/json', ...corsHeaders } }
          );
        }

        const deliveryDate = new Date(order.delivered_at);
        const now = new Date();
        const daysSinceDelivery = (now - deliveryDate) / (1000 * 60 * 60 * 24);

        if (daysSinceDelivery > 7) {
          return new Response(
            JSON.stringify({ success: false, error: 'Return window has expired (7 days only)' }),
            { status: 400, headers: { 'Content-Type': 'application/json', ...corsHeaders } }
          );
        }

        // Check if return already exists
        const existingReturnUrl = `${supabaseUrl}/rest/v1/returns?book_id=eq.${book_id}&prod_id=eq.${prod_id}&select=return_id`;
        const existingReturnResponse = await fetch(existingReturnUrl, {
          headers: {
            'apikey': supabaseKey,
            'Authorization': `Bearer ${supabaseKey}`,
          },
        });
        const existingReturnData = await existingReturnResponse.json();
        const existingReturn = existingReturnData[0];

        if (existingReturn) {
          return new Response(
            JSON.stringify({ success: false, error: 'Return request already exists' }),
            { status: 400, headers: { 'Content-Type': 'application/json', ...corsHeaders } }
          );
        }

        // Get product details for refund amount
        const orderItemUrl = `${supabaseUrl}/rest/v1/order_items?book_id=eq.${book_id}&prod_id=eq.${prod_id}&select=price_at_time,quantity`;
        const orderItemResponse = await fetch(orderItemUrl, {
          headers: {
            'apikey': supabaseKey,
            'Authorization': `Bearer ${supabaseKey}`,
          },
        });
        const orderItemData = await orderItemResponse.json();
        const orderItem = orderItemData[0];

        const refundAmount = orderItem ? orderItem.price_at_time * orderItem.quantity : 0;

        // Create return request
        const returnInsert = await supabase
          .from('returns')
          .insert({
            book_id,
            prod_id,
            reason,
            reason_detail: reason_detail || null,
            product_photo: product_photo || null,
            product_video: product_video || null,
            refund_amount: refundAmount,
            status: 'PENDING',
            created_at: new Date().toISOString()
          })
          .select();

        if (returnInsert.error) {
          console.error('Return creation error:', returnInsert.error);
          return new Response(
            JSON.stringify({ success: false, error: 'Failed to create return request' }),
            { status: 500, headers: { 'Content-Type': 'application/json', ...corsHeaders } }
          );
        }

        const returnRequest = returnInsert.data;

        // Notify seller
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
            title: 'Return Request Received',
            message: `Customer has requested return for order #${book_id}. Reason: ${reason}`,
            type: 'return',
            data: { return_id: returnRequest.return_id, order_id: book_id },
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
            title: 'Return Request Pending',
            message: `Return request #${returnRequest.return_id} for order #${book_id} needs approval`,
            type: 'return',
            data: { return_id: returnRequest.return_id, order_id: book_id },
            created_at: new Date().toISOString()
          })
        });

        return new Response(
          JSON.stringify({
            success: true,
            message: 'Return request submitted successfully',
            return_id: returnRequest.return_id,
            refund_amount: refundAmount,
            status: 'PENDING',
            next_steps: 'Rider will be assigned for pickup. Please keep the product ready with original packaging.'
          }),
          { status: 200, headers: { 'Content-Type': 'application/json', ...corsHeaders } }
        );
      }

      // =====================================================
      // CREATE EXCHANGE REQUEST
      // =====================================================
      if (type === 'exchange') {
        const {
          book_id,
          old_prod_id,
          new_prod_id,
          cust_id,
          reason,
          reason_detail,
          product_photo,
          price_difference
        } = rest;

        if (!book_id || !old_prod_id || !new_prod_id || !reason) {
          return new Response(
            JSON.stringify({ success: false, error: 'Order ID, old product, new product and reason are required' }),
            { status: 400, headers: { 'Content-Type': 'application/json', ...corsHeaders } }
          );
        }

        // Get order details with customer info
        const orderSelect = `*, customers!inner(cust_id, name, mobile)`;
        const orderUrl = `${supabaseUrl}/rest/v1/orders?select=${encodeURIComponent(orderSelect)}&book_id=eq.${book_id}`;
        const orderResponse = await fetch(orderUrl, {
          headers: {
            'apikey': supabaseKey,
            'Authorization': `Bearer ${supabaseKey}`,
          },
        });
        const orderData = await orderResponse.json();
        const order = orderData[0];

        if (!order) {
          return new Response(
            JSON.stringify({ success: false, error: 'Order not found' }),
            { status: 404, headers: { 'Content-Type': 'application/json', ...corsHeaders } }
          );
        }

        // Verify ownership
        if (order.cust_id !== cust_id) {
          return new Response(
            JSON.stringify({ success: false, error: 'Unauthorized' }),
            { status: 403, headers: { 'Content-Type': 'application/json', ...corsHeaders } }
          );
        }

        // Check exchange eligibility
        if (order.status !== 'DELIVERED') {
          return new Response(
            JSON.stringify({ success: false, error: 'Exchange only possible after delivery' }),
            { status: 400, headers: { 'Content-Type': 'application/json', ...corsHeaders } }
          );
        }

        const deliveryDate = new Date(order.delivered_at);
        const now = new Date();
        const daysSinceDelivery = (now - deliveryDate) / (1000 * 60 * 60 * 24);

        if (daysSinceDelivery > 7) {
          return new Response(
            JSON.stringify({ success: false, error: 'Exchange window has expired (7 days only)' }),
            { status: 400, headers: { 'Content-Type': 'application/json', ...corsHeaders } }
          );
        }

        // Get new product details
        const newProductUrl = `${supabaseUrl}/rest/v1/products?prod_id=eq.${new_prod_id}&select=selling_price,name,seller_id,stock`;
        const newProductResponse = await fetch(newProductUrl, {
          headers: {
            'apikey': supabaseKey,
            'Authorization': `Bearer ${supabaseKey}`,
          },
        });
        const newProductData = await newProductResponse.json();
        const newProduct = newProductData[0];

        if (!newProduct) {
          return new Response(
            JSON.stringify({ success: false, error: 'Exchange product not found' }),
            { status: 404, headers: { 'Content-Type': 'application/json', ...corsHeaders } }
          );
        }

        // Check stock availability
        if (newProduct.stock < 1) {
          return new Response(
            JSON.stringify({ success: false, error: 'Exchange product is out of stock' }),
            { status: 400, headers: { 'Content-Type': 'application/json', ...corsHeaders } }
          );
        }

        // Get old product price from order
        const oldOrderItemUrl = `${supabaseUrl}/rest/v1/order_items?book_id=eq.${book_id}&prod_id=eq.${old_prod_id}&select=price_at_time`;
        const oldOrderItemResponse = await fetch(oldOrderItemUrl, {
          headers: {
            'apikey': supabaseKey,
            'Authorization': `Bearer ${supabaseKey}`,
          },
        });
        const oldOrderItemData = await oldOrderItemResponse.json();
        const oldOrderItem = oldOrderItemData[0];

        const oldPrice = oldOrderItem?.price_at_time || 0;
        const finalPriceDifference = price_difference || (newProduct.selling_price - oldPrice);

        // Check if exchange already exists
        const existingExchangeUrl = `${supabaseUrl}/rest/v1/exchanges?old_book_id=eq.${book_id}&select=exchange_id`;
        const existingExchangeResponse = await fetch(existingExchangeUrl, {
          headers: {
            'apikey': supabaseKey,
            'Authorization': `Bearer ${supabaseKey}`,
          },
        });
        const existingExchangeData = await existingExchangeResponse.json();
        const existingExchange = existingExchangeData[0];

        if (existingExchange) {
          return new Response(
            JSON.stringify({ success: false, error: 'Exchange request already exists' }),
            { status: 400, headers: { 'Content-Type': 'application/json', ...corsHeaders } }
          );
        }

        // Create new order for exchange product (will be COD for difference)
        let newBookId = null;
        if (finalPriceDifference > 0) {
          const exchangeBookId = 'EXC' + Date.now() + Math.random().toString(36).substring(2, 6).toUpperCase();
          const newOrderInsert = await supabase
            .from('orders')
            .insert({
              book_id: exchangeBookId,
              cust_id,
              seller_id: newProduct.seller_id,
              total_amount: finalPriceDifference,
              delivery_charge: 0,
              final_amount: finalPriceDifference,
              payment_method: 'COD',
              address: order.address,
              status: 'PENDING',
              placed_at: new Date().toISOString()
            })
            .select();

          if (!newOrderInsert.error && newOrderInsert.data) {
            newBookId = newOrderInsert.data.book_id;
          }
        }

        // Create exchange request
        const exchangeInsert = await supabase
          .from('exchanges')
          .insert({
            old_book_id: book_id,
            new_book_id: newBookId,
            old_prod_id,
            new_prod_id,
            price_difference: finalPriceDifference,
            reason,
            status: 'PENDING',
            created_at: new Date().toISOString()
          })
          .select();

        if (exchangeInsert.error) {
          console.error('Exchange creation error:', exchangeInsert.error);
          return new Response(
            JSON.stringify({ success: false, error: 'Failed to create exchange request' }),
            { status: 500, headers: { 'Content-Type': 'application/json', ...corsHeaders } }
          );
        }

        const exchangeRequest = exchangeInsert.data;

        // Notify seller
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
            title: 'Exchange Request Received',
            message: `Customer has requested exchange for order #${book_id}. New product: ${newProduct.name}`,
            type: 'exchange',
            data: { exchange_id: exchangeRequest.exchange_id, order_id: book_id },
            created_at: new Date().toISOString()
          })
        });

        return new Response(
          JSON.stringify({
            success: true,
            message: 'Exchange request submitted successfully',
            exchange_id: exchangeRequest.exchange_id,
            price_difference: finalPriceDifference,
            additional_payment_required: finalPriceDifference > 0 ? finalPriceDifference : 0,
            status: 'PENDING',
            next_steps: finalPriceDifference > 0 
              ? `Please pay ₹${finalPriceDifference} to rider at the time of exchange pickup.`
              : 'Rider will pick up old product and deliver new product.'
          }),
          { status: 200, headers: { 'Content-Type': 'application/json', ...corsHeaders } }
        );
      }
    }

    return new Response(
      JSON.stringify({ success: false, error: 'Method not allowed' }),
      { status: 405, headers: { 'Content-Type': 'application/json', ...corsHeaders } }
    );

  } catch (error) {
    console.error('Return/Exchange error:', error);
    return new Response(
      JSON.stringify({ success: false, error: error.message || 'Internal server error' }),
      { status: 500, headers: { 'Content-Type': 'application/json', ...corsHeaders } }
    );
  }
}