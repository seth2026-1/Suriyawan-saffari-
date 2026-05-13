// api/logistics/rider/return-pickup.js
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
            }),
            order: (orderField, { ascending }) => ({
              select: async () => {
                const sortOrder = ascending ? 'asc' : 'desc';
                const finalUrl = `${url}&${field}=eq.${value}&order=${orderField}.${sortOrder}`;
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
            }),
            order: (orderField, { ascending }) => ({
              select: async () => {
                const sortOrder = ascending ? 'asc' : 'desc';
                const finalUrl = `${url}&${field}=eq.${value}&order=${orderField}.${sortOrder}`;
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
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version, Authorization',
  };

  // Handle OPTIONS preflight
  if (request.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: corsHeaders });
  }

  const url = new URL(request.url);

  // =====================================================
  // GET PENDING RETURNS FOR TODAY
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

      // Get pending return requests
      const returnsSelect = `return_id,book_id,reason,reason_detail,product_photo,refund_amount,status,created_at,orders!inner(book_id,final_amount,address,customers!inner(cust_id,name,mobile,address),order_items!inner(quantity,products!inner(prod_id,name,images)))`;
      const returnsUrl = `${supabaseUrl}/rest/v1/returns?select=${encodeURIComponent(returnsSelect)}&status=eq.PENDING&order=created_at.asc`;
      const returnsResponse = await fetch(returnsUrl, {
        headers: {
          'apikey': supabaseKey,
          'Authorization': `Bearer ${supabaseKey}`,
        },
      });
      const returns = await returnsResponse.json();

      // Get pending exchange requests
      const exchangesSelect = `exchange_id,old_book_id,new_book_id,price_difference,reason,status,created_at,old_order:orders!old_book_id(book_id,final_amount,address,customers!inner(cust_id,name,mobile),order_items!inner(quantity,products!inner(prod_id,name,images))),new_order:orders!new_book_id(book_id,final_amount,order_items!inner(quantity,products!inner(prod_id,name)))`;
      const exchangesUrl = `${supabaseUrl}/rest/v1/exchanges?select=${encodeURIComponent(exchangesSelect)}&status=eq.PENDING&order=created_at.asc`;
      const exchangesResponse = await fetch(exchangesUrl, {
        headers: {
          'apikey': supabaseKey,
          'Authorization': `Bearer ${supabaseKey}`,
        },
      });
      const exchanges = await exchangesResponse.json();

      const pendingReturns = returns?.map(r => ({
        return_id: r.return_id,
        book_id: r.book_id,
        reason: r.reason,
        reason_detail: r.reason_detail,
        refund_amount: r.refund_amount,
        customer_name: r.orders?.customers?.name,
        customer_mobile: r.orders?.customers?.mobile,
        address: r.orders?.address,
        items: r.orders?.order_items?.map(i => ({
          name: i.products?.name,
          quantity: i.quantity,
          image: i.products?.images?.[0] || null
        })) || [],
        product_photo: r.product_photo,
        created_at: r.created_at
      })) || [];

      const pendingExchanges = exchanges?.map(e => ({
        exchange_id: e.exchange_id,
        old_book_id: e.old_book_id,
        new_book_id: e.new_book_id,
        price_difference: e.price_difference,
        reason: e.reason,
        customer_name: e.old_order?.customers?.name,
        customer_mobile: e.old_order?.customers?.mobile,
        address: e.old_order?.address,
        old_items: e.old_order?.order_items?.map(i => ({
          name: i.products?.name,
          quantity: i.quantity,
          image: i.products?.images?.[0] || null
        })) || [],
        new_items: e.new_order?.order_items?.map(i => ({
          name: i.products?.name,
          quantity: i.quantity
        })) || [],
        created_at: e.created_at
      })) || [];

      return new Response(JSON.stringify({
        success: true,
        pending_returns: pendingReturns,
        pending_exchanges: pendingExchanges,
        total_returns: pendingReturns.length,
        total_exchanges: pendingExchanges.length,
        has_pending: pendingReturns.length > 0 || pendingExchanges.length > 0
      }), {
        status: 200,
        headers: { 'Content-Type': 'application/json', ...corsHeaders }
      });

    } catch (error) {
      console.error('Get pending returns error:', error);
      return new Response(JSON.stringify({ success: false, error: error.message }), {
        status: 500,
        headers: { 'Content-Type': 'application/json', ...corsHeaders }
      });
    }
  }

  // =====================================================
  // PROCESS RETURN PICKUP (POST)
  // =====================================================
  if (request.method === 'POST') {
    try {
      const body = await request.json();
      const {
        rider_id,
        return_id,
        exchange_id,
        book_id,
        product_photo,
        product_condition,
        customer_signature,
        location,
        notes,
        cash_collected
      } = body;

      if (!rider_id) {
        return new Response(JSON.stringify({ success: false, error: 'Rider ID is required' }), {
          status: 400,
          headers: { 'Content-Type': 'application/json', ...corsHeaders }
        });
      }

      const supabase = createSupabaseClient();
      const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
      const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

      // Process Return
      if (return_id) {
        const returnSelect = `*,orders!inner(book_id,final_amount,cust_id,seller_id,order_items!inner(prod_id,quantity,price_at_time))`;
        const returnUrl = `${supabaseUrl}/rest/v1/returns?select=${encodeURIComponent(returnSelect)}&return_id=eq.${return_id}`;
        const returnResponse = await fetch(returnUrl, {
          headers: {
            'apikey': supabaseKey,
            'Authorization': `Bearer ${supabaseKey}`,
          },
        });
        const returnData = await returnResponse.json();
        const returnItem = returnData[0];

        if (!returnItem) {
          return new Response(JSON.stringify({ success: false, error: 'Return request not found' }), {
            status: 404,
            headers: { 'Content-Type': 'application/json', ...corsHeaders }
          });
        }

        if (returnItem.status !== 'PENDING') {
          return new Response(JSON.stringify({ success: false, error: 'Return request already processed' }), {
            status: 400,
            headers: { 'Content-Type': 'application/json', ...corsHeaders }
          });
        }

        // Update return status
        await fetch(`${supabaseUrl}/rest/v1/returns?return_id=eq.${return_id}`, {
          method: 'PATCH',
          headers: {
            'apikey': supabaseKey,
            'Authorization': `Bearer ${supabaseKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            status: 'COMPLETED',
            rider_id: rider_id,
            picked_up_at: new Date().toISOString(),
            product_condition: product_condition || 'good',
            pickup_photo: product_photo || null,
            customer_signature: customer_signature || null,
            completed_at: new Date().toISOString()
          })
        });

        // Update order status
        await fetch(`${supabaseUrl}/rest/v1/orders?book_id=eq.${returnItem.book_id}`, {
          method: 'PATCH',
          headers: {
            'apikey': supabaseKey,
            'Authorization': `Bearer ${supabaseKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            status: 'RETURNED',
            updated_at: new Date().toISOString()
          })
        });

        // Add tracking entry
        await fetch(`${supabaseUrl}/rest/v1/shipment_tracking`, {
          method: 'POST',
          headers: {
            'apikey': supabaseKey,
            'Authorization': `Bearer ${supabaseKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            book_id: returnItem.book_id,
            status: 'RETURN_PICKUP_COMPLETED',
            location: location || 'Customer Address',
            rider_id: rider_id,
            notes: notes || `Return pickup completed. Reason: ${returnItem.reason}`,
            photo: product_photo || null,
            created_at: new Date().toISOString()
          })
        });

        // Restock product
        for (const item of returnItem.orders?.order_items || []) {
          const productUrl = `${supabaseUrl}/rest/v1/products?prod_id=eq.${item.prod_id}&select=stock`;
          const productResponse = await fetch(productUrl, {
            headers: {
              'apikey': supabaseKey,
              'Authorization': `Bearer ${supabaseKey}`,
            },
          });
          const productData = await productResponse.json();
          const currentStock = productData[0]?.stock || 0;

          await fetch(`${supabaseUrl}/rest/v1/products?prod_id=eq.${item.prod_id}`, {
            method: 'PATCH',
            headers: {
              'apikey': supabaseKey,
              'Authorization': `Bearer ${supabaseKey}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({ stock: currentStock + item.quantity })
          });
        }

        // Add rider earning for return pickup (₹15 per return)
        const returnPickupRate = 15;

        const riderUrl = `${supabaseUrl}/rest/v1/riders?select=wallet_balance&rider_id=eq.${rider_id}`;
        const riderResponse = await fetch(riderUrl, {
          headers: {
            'apikey': supabaseKey,
            'Authorization': `Bearer ${supabaseKey}`,
          },
        });
        const riderData = await riderResponse.json();
        const currentBalance = riderData[0]?.wallet_balance || 0;

        await fetch(`${supabaseUrl}/rest/v1/wallet_transactions`, {
          method: 'POST',
          headers: {
            'apikey': supabaseKey,
            'Authorization': `Bearer ${supabaseKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            user_id: rider_id,
            user_type: 'rider',
            amount: returnPickupRate,
            type: 'credit',
            reason: `Return pickup for order ${returnItem.book_id}`,
            reference_id: returnItem.book_id,
            created_at: new Date().toISOString()
          })
        });

        await fetch(`${supabaseUrl}/rest/v1/riders?rider_id=eq.${rider_id}`, {
          method: 'PATCH',
          headers: {
            'apikey': supabaseKey,
            'Authorization': `Bearer ${supabaseKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ wallet_balance: currentBalance + returnPickupRate })
        });

        // Send notification to customer
        await fetch(`${supabaseUrl}/rest/v1/notifications`, {
          method: 'POST',
          headers: {
            'apikey': supabaseKey,
            'Authorization': `Bearer ${supabaseKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            user_id: returnItem.orders?.cust_id,
            user_type: 'customer',
            title: 'Return Pickup Completed',
            message: `Your return for order ${returnItem.book_id} has been picked up. Refund will be processed shortly.`,
            type: 'return',
            data: { return_id: return_id, book_id: returnItem.book_id },
            created_at: new Date().toISOString()
          })
        });

        // Send notification to seller
        await fetch(`${supabaseUrl}/rest/v1/notifications`, {
          method: 'POST',
          headers: {
            'apikey': supabaseKey,
            'Authorization': `Bearer ${supabaseKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            user_id: returnItem.orders?.seller_id,
            user_type: 'seller',
            title: 'Return Pickup Completed',
            message: `Return for order ${returnItem.book_id} has been picked up by rider.`,
            type: 'return',
            data: { return_id: return_id, book_id: returnItem.book_id },
            created_at: new Date().toISOString()
          })
        });

        return new Response(JSON.stringify({
          success: true,
          message: 'Return pickup completed successfully',
          type: 'return',
          data: {
            return_id: return_id,
            book_id: returnItem.book_id,
            refund_amount: returnItem.refund_amount,
            picked_up_at: new Date().toISOString(),
            rider_earning: returnPickupRate
          }
        }), {
          status: 200,
          headers: { 'Content-Type': 'application/json', ...corsHeaders }
        });
      }

      // Process Exchange
      if (exchange_id) {
        const exchangeSelect = `*,old_order:orders!old_book_id(book_id,final_amount,cust_id,seller_id,address),new_order:orders!new_book_id(book_id,final_amount)`;
        const exchangeUrl = `${supabaseUrl}/rest/v1/exchanges?select=${encodeURIComponent(exchangeSelect)}&exchange_id=eq.${exchange_id}`;
        const exchangeResponse = await fetch(exchangeUrl, {
          headers: {
            'apikey': supabaseKey,
            'Authorization': `Bearer ${supabaseKey}`,
          },
        });
        const exchangeData = await exchangeResponse.json();
        const exchangeItem = exchangeData[0];

        if (!exchangeItem) {
          return new Response(JSON.stringify({ success: false, error: 'Exchange request not found' }), {
            status: 404,
            headers: { 'Content-Type': 'application/json', ...corsHeaders }
          });
        }

        if (exchangeItem.status !== 'PENDING') {
          return new Response(JSON.stringify({ success: false, error: 'Exchange request already processed' }), {
            status: 400,
            headers: { 'Content-Type': 'application/json', ...corsHeaders }
          });
        }

        // Update exchange status
        await fetch(`${supabaseUrl}/rest/v1/exchanges?exchange_id=eq.${exchange_id}`, {
          method: 'PATCH',
          headers: {
            'apikey': supabaseKey,
            'Authorization': `Bearer ${supabaseKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            status: 'COMPLETED',
            rider_id: rider_id,
            picked_up_at: new Date().toISOString(),
            delivered_at: new Date().toISOString(),
            pickup_photo: product_photo || null,
            customer_signature: customer_signature || null,
            completed_at: new Date().toISOString()
          })
        });

        // Update old order status
        await fetch(`${supabaseUrl}/rest/v1/orders?book_id=eq.${exchangeItem.old_book_id}`, {
          method: 'PATCH',
          headers: {
            'apikey': supabaseKey,
            'Authorization': `Bearer ${supabaseKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ status: 'EXCHANGED', updated_at: new Date().toISOString() })
        });

        // Update new order status (if exists)
        if (exchangeItem.new_book_id) {
          await fetch(`${supabaseUrl}/rest/v1/orders?book_id=eq.${exchangeItem.new_book_id}`, {
            method: 'PATCH',
            headers: {
              'apikey': supabaseKey,
              'Authorization': `Bearer ${supabaseKey}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({ status: 'DELIVERED', delivered_at: new Date().toISOString() })
          });
        }

        // Add rider earning for exchange (₹20 per exchange)
        const exchangeRate = 20;

        const riderUrl = `${supabaseUrl}/rest/v1/riders?select=wallet_balance&rider_id=eq.${rider_id}`;
        const riderResponse = await fetch(riderUrl, {
          headers: {
            'apikey': supabaseKey,
            'Authorization': `Bearer ${supabaseKey}`,
          },
        });
        const riderData = await riderResponse.json();
        const currentBalance = riderData[0]?.wallet_balance || 0;

        await fetch(`${supabaseUrl}/rest/v1/wallet_transactions`, {
          method: 'POST',
          headers: {
            'apikey': supabaseKey,
            'Authorization': `Bearer ${supabaseKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            user_id: rider_id,
            user_type: 'rider',
            amount: exchangeRate,
            type: 'credit',
            reason: `Exchange for order ${exchangeItem.old_book_id}`,
            reference_id: exchangeItem.old_book_id,
            created_at: new Date().toISOString()
          })
        });

        await fetch(`${supabaseUrl}/rest/v1/riders?rider_id=eq.${rider_id}`, {
          method: 'PATCH',
          headers: {
            'apikey': supabaseKey,
            'Authorization': `Bearer ${supabaseKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ wallet_balance: currentBalance + exchangeRate })
        });

        // Handle cash collection for price difference
        if (exchangeItem.price_difference > 0 && cash_collected) {
          await fetch(`${supabaseUrl}/rest/v1/cod_payments`, {
            method: 'POST',
            headers: {
              'apikey': supabaseKey,
              'Authorization': `Bearer ${supabaseKey}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              rider_id: rider_id,
              book_id: exchangeItem.new_book_id,
              amount: exchangeItem.price_difference,
              payment_method: 'cash',
              customer_signature: customer_signature || null,
              notes: `Price difference for exchange from order ${exchangeItem.old_book_id}`,
              date: new Date().toISOString().split('T')[0],
              created_at: new Date().toISOString()
            })
          });
        }

        // Send notification to customer
        await fetch(`${supabaseUrl}/rest/v1/notifications`, {
          method: 'POST',
          headers: {
            'apikey': supabaseKey,
            'Authorization': `Bearer ${supabaseKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            user_id: exchangeItem.old_order?.cust_id,
            user_type: 'customer',
            title: 'Exchange Completed',
            message: `Your exchange for order ${exchangeItem.old_book_id} has been completed.`,
            type: 'exchange',
            data: { exchange_id: exchange_id, old_book_id: exchangeItem.old_book_id },
            created_at: new Date().toISOString()
          })
        });

        return new Response(JSON.stringify({
          success: true,
          message: 'Exchange completed successfully',
          type: 'exchange',
          data: {
            exchange_id: exchange_id,
            old_book_id: exchangeItem.old_book_id,
            new_book_id: exchangeItem.new_book_id,
            price_difference: exchangeItem.price_difference,
            cash_collected: cash_collected || 0,
            rider_earning: exchangeRate
          }
        }), {
          status: 200,
          headers: { 'Content-Type': 'application/json', ...corsHeaders }
        });
      }

      return new Response(JSON.stringify({ success: false, error: 'Return ID or Exchange ID is required' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json', ...corsHeaders }
      });

    } catch (error) {
      console.error('Process return pickup error:', error);
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