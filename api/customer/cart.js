// api/customer/cart.js
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
          
          if (options.count === 'exact' && options.head) {
            finalUrl += `${finalUrl.includes('?') ? '&' : '?'}select=*`;
          }
          
          const response = await fetch(finalUrl, {
            method: options.head ? 'HEAD' : 'GET',
            headers: {
              'apikey': supabaseKey,
              'Authorization': `Bearer ${supabaseKey}`,
            },
          });
          
          if (options.head) {
            const count = response.headers.get('content-range')?.split('/')[1];
            return { count: count ? parseInt(count) : 0, error: null };
          }
          
          const data = await response.json();
          return { data, error: null };
        };
        
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
      })
    })
  };
}

export default async function handler(request) {
  // CORS Headers
  const corsHeaders = {
    'Access-Control-Allow-Credentials': 'true',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version, Authorization',
  };

  // Handle OPTIONS preflight
  if (request.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: corsHeaders });
  }

  try {
    const supabase = createSupabaseClient();

    // =====================================================
    // GET CART
    // =====================================================
    if (request.method === 'GET') {
      const url = new URL(request.url);
      const cust_id = url.searchParams.get('cust_id');

      if (!cust_id) {
        return new Response(
          JSON.stringify({ success: false, error: 'Customer ID is required' }),
          { status: 400, headers: { 'Content-Type': 'application/json', ...corsHeaders } }
        );
      }

      const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
      const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

      // Get cart items with product details
      const cartUrl = `${supabaseUrl}/rest/v1/cart?cust_id=eq.${cust_id}&select=cart_id,cust_id,quantity,added_at,products!inner(prod_id,name,description,selling_price,mrp,flash_price,flash_start,flash_end,images,stock,is_cod_available,sellers!inner(seller_id,shop_name)),product_variations(var_id,size,color,material,price_adjustment,sku)`;
      
      const cartResponse = await fetch(cartUrl, {
        headers: {
          'apikey': supabaseKey,
          'Authorization': `Bearer ${supabaseKey}`,
        },
      });
      
      const cartItems = await cartResponse.json();

      // Calculate cart totals
      let subtotal = 0;
      let totalDiscount = 0;
      let totalItems = 0;
      let codAvailable = true;
      let outOfStockItems = [];

      const cartWithDetails = (cartItems || []).map(item => {
        const product = item.products;
        const variation = item.product_variations;

        // Determine current price (check flash sale)
        let currentPrice = product.selling_price;
        let isFlashSale = false;

        if (product.flash_price && product.flash_start && product.flash_end) {
          const now = new Date();
          const flashStart = new Date(product.flash_start);
          const flashEnd = new Date(product.flash_end);

          if (now >= flashStart && now <= flashEnd) {
            currentPrice = product.flash_price;
            isFlashSale = true;
          }
        }

        // Apply variation price adjustment
        if (variation && variation.price_adjustment) {
          currentPrice += variation.price_adjustment;
        }

        const itemTotal = currentPrice * item.quantity;
        const itemDiscount = (product.mrp - currentPrice) * item.quantity;

        subtotal += itemTotal;
        totalDiscount += itemDiscount;
        totalItems += item.quantity;

        // Check stock status
        if (product.stock < item.quantity) {
          outOfStockItems.push({
            prod_id: product.prod_id,
            name: product.name,
            available: product.stock,
            requested: item.quantity
          });
        }

        // Check COD availability
        if (!product.is_cod_available) {
          codAvailable = false;
        }

        return {
          cart_id: item.cart_id,
          prod_id: product.prod_id,
          name: product.name,
          description: product.description,
          seller_id: product.sellers?.seller_id,
          seller_name: product.sellers?.shop_name,
          quantity: item.quantity,
          max_stock: product.stock,
          mrp: product.mrp,
          selling_price: product.selling_price,
          current_price: currentPrice,
          is_flash_sale: isFlashSale,
          flash_price: product.flash_price,
          discount_percent: Math.round(((product.mrp - currentPrice) / product.mrp) * 100),
          item_total: itemTotal,
          image: product.images?.[0] || null,
          variation_id: variation?.var_id || null,
          variation_details: variation ? {
            size: variation.size,
            color: variation.color,
            material: variation.material,
            sku: variation.sku
          } : null,
          is_cod_available: product.is_cod_available,
          added_at: item.added_at
        };
      });

      // Get COD settings from system_settings
      const settingsUrl = `${supabaseUrl}/rest/v1/system_settings?setting_key=in.(free_delivery_min,delivery_charge,cod_min_amount,cod_max_amount)&select=setting_key,setting_value`;
      const settingsResponse = await fetch(settingsUrl, {
        headers: {
          'apikey': supabaseKey,
          'Authorization': `Bearer ${supabaseKey}`,
        },
      });
      const codSettings = await settingsResponse.json();

      const freeDeliveryMin = parseInt(codSettings.find(s => s.setting_key === 'free_delivery_min')?.setting_value || 499);
      const codMinAmount = parseInt(codSettings.find(s => s.setting_key === 'cod_min_amount')?.setting_value || 200);
      const codMaxAmount = parseInt(codSettings.find(s => s.setting_key === 'cod_max_amount')?.setting_value || 50000);
      const deliveryCharge = 40;

      let finalTotal = subtotal + deliveryCharge;

      // Apply free delivery if subtotal >= freeDeliveryMin
      let appliedDeliveryCharge = deliveryCharge;
      if (subtotal >= freeDeliveryMin) {
        appliedDeliveryCharge = 0;
        finalTotal = subtotal;
      }

      return new Response(
        JSON.stringify({
          success: true,
          cart: cartWithDetails,
          summary: {
            total_items: totalItems,
            subtotal: subtotal,
            total_discount: totalDiscount,
            delivery_charge: appliedDeliveryCharge,
            total: finalTotal,
            cod_available: codAvailable && subtotal >= codMinAmount && subtotal <= codMaxAmount,
            cod_min_amount: codMinAmount,
            cod_max_amount: codMaxAmount,
            free_delivery_min: freeDeliveryMin,
            out_of_stock_items: outOfStockItems,
            has_out_of_stock: outOfStockItems.length > 0
          }
        }),
        { status: 200, headers: { 'Content-Type': 'application/json', ...corsHeaders } }
      );
    }

    // =====================================================
    // ADD TO CART (POST)
    // =====================================================
    if (request.method === 'POST') {
      const body = await request.json();
      const { cust_id, prod_id, quantity, variation_id } = body;

      if (!cust_id || !prod_id) {
        return new Response(
          JSON.stringify({ success: false, error: 'Customer ID and Product ID are required' }),
          { status: 400, headers: { 'Content-Type': 'application/json', ...corsHeaders } }
        );
      }

      const finalQuantity = quantity || 1;
      const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
      const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

      // Check if product exists and has stock
      let productStock = 0;
      let productName = '';
      let isActive = true;
      let isApproved = true;

      if (variation_id) {
        const variationUrl = `${supabaseUrl}/rest/v1/product_variations?var_id=eq.${variation_id}&select=stock,prod_id,products!inner(name,selling_price,is_active,is_approved)`;
        const variationResponse = await fetch(variationUrl, {
          headers: {
            'apikey': supabaseKey,
            'Authorization': `Bearer ${supabaseKey}`,
          },
        });
        const variationData = await variationResponse.json();
        const productVariation = variationData[0];
        
        if (!productVariation) {
          return new Response(
            JSON.stringify({ success: false, error: 'Product not found' }),
            { status: 404, headers: { 'Content-Type': 'application/json', ...corsHeaders } }
          );
        }
        
        productStock = productVariation.stock;
        productName = productVariation.products?.name;
        isActive = productVariation.products?.is_active;
        isApproved = productVariation.products?.is_approved;
      } else {
        const productUrl = `${supabaseUrl}/rest/v1/products?prod_id=eq.${prod_id}&select=stock,name,selling_price,is_active,is_approved`;
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
            JSON.stringify({ success: false, error: 'Product not found' }),
            { status: 404, headers: { 'Content-Type': 'application/json', ...corsHeaders } }
          );
        }
        
        productStock = product.stock;
        productName = product.name;
        isActive = product.is_active;
        isApproved = product.is_approved;
      }

      if (!isActive || !isApproved) {
        return new Response(
          JSON.stringify({ success: false, error: 'Product is not available' }),
          { status: 400, headers: { 'Content-Type': 'application/json', ...corsHeaders } }
        );
      }

      if (productStock < finalQuantity) {
        return new Response(
          JSON.stringify({ success: false, error: `Only ${productStock} items available in stock` }),
          { status: 400, headers: { 'Content-Type': 'application/json', ...corsHeaders } }
        );
      }

      // Check if item already in cart
      let existingUrl = `${supabaseUrl}/rest/v1/cart?cust_id=eq.${cust_id}&prod_id=eq.${prod_id}&select=cart_id,quantity`;
      if (variation_id) {
        existingUrl += `&variation_id=eq.${variation_id}`;
      }
      
      const existingResponse = await fetch(existingUrl, {
        headers: {
          'apikey': supabaseKey,
          'Authorization': `Bearer ${supabaseKey}`,
        },
      });
      const existingData = await existingResponse.json();
      const existingItem = existingData[0];

      let result;
      if (existingItem) {
        // Update existing cart item
        const newQuantity = existingItem.quantity + finalQuantity;

        if (newQuantity > productStock) {
          return new Response(
            JSON.stringify({ success: false, error: `Cannot add ${finalQuantity} more. Only ${productStock - existingItem.quantity} left in stock` }),
            { status: 400, headers: { 'Content-Type': 'application/json', ...corsHeaders } }
          );
        }

        const updateResponse = await fetch(`${supabaseUrl}/rest/v1/cart?cart_id=eq.${existingItem.cart_id}`, {
          method: 'PATCH',
          headers: {
            'apikey': supabaseKey,
            'Authorization': `Bearer ${supabaseKey}`,
            'Content-Type': 'application/json',
            'Prefer': 'return=representation'
          },
          body: JSON.stringify({ quantity: newQuantity, added_at: new Date().toISOString() })
        });
        
        const updateData = await updateResponse.json();
        result = updateData[0];
      } else {
        // Insert new cart item
        const insertResponse = await fetch(`${supabaseUrl}/rest/v1/cart`, {
          method: 'POST',
          headers: {
            'apikey': supabaseKey,
            'Authorization': `Bearer ${supabaseKey}`,
            'Content-Type': 'application/json',
            'Prefer': 'return=representation'
          },
          body: JSON.stringify({
            cust_id,
            prod_id,
            quantity: finalQuantity,
            variation_id: variation_id || null,
            added_at: new Date().toISOString()
          })
        });
        
        const insertData = await insertResponse.json();
        result = insertData[0];
      }

      // Get updated cart count
      const countUrl = `${supabaseUrl}/rest/v1/cart?cust_id=eq.${cust_id}&select=cart_id`;
      const countResponse = await fetch(countUrl, {
        method: 'HEAD',
        headers: {
          'apikey': supabaseKey,
          'Authorization': `Bearer ${supabaseKey}`,
        },
      });
      const cartCount = parseInt(countResponse.headers.get('content-range')?.split('/')[1] || '0');

      return new Response(
        JSON.stringify({
          success: true,
          message: 'Product added to cart',
          cart_item: result,
          cart_count: cartCount
        }),
        { status: 200, headers: { 'Content-Type': 'application/json', ...corsHeaders } }
      );
    }

    // =====================================================
    // UPDATE CART ITEM QUANTITY (PUT)
    // =====================================================
    if (request.method === 'PUT') {
      const body = await request.json();
      const { cart_id, quantity, cust_id, prod_id, variation_id } = body;

      if (!cart_id && (!cust_id || !prod_id)) {
        return new Response(
          JSON.stringify({ success: false, error: 'Cart ID or (Customer ID + Product ID) is required' }),
          { status: 400, headers: { 'Content-Type': 'application/json', ...corsHeaders } }
        );
      }

      const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
      const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

      let targetCartId = cart_id;

      // If cart_id not provided, find it
      if (!targetCartId && cust_id && prod_id) {
        let findUrl = `${supabaseUrl}/rest/v1/cart?cust_id=eq.${cust_id}&prod_id=eq.${prod_id}&select=cart_id,quantity`;
        if (variation_id) {
          findUrl += `&variation_id=eq.${variation_id}`;
        }
        
        const findResponse = await fetch(findUrl, {
          headers: {
            'apikey': supabaseKey,
            'Authorization': `Bearer ${supabaseKey}`,
          },
        });
        const findData = await findResponse.json();
        const cartItem = findData[0];

        if (!cartItem) {
          return new Response(
            JSON.stringify({ success: false, error: 'Cart item not found' }),
            { status: 404, headers: { 'Content-Type': 'application/json', ...corsHeaders } }
          );
        }

        targetCartId = cartItem.cart_id;
      }

      // Get product stock
      const cartDataUrl = `${supabaseUrl}/rest/v1/cart?cart_id=eq.${targetCartId}&select=prod_id,variation_id,quantity`;
      const cartDataResponse = await fetch(cartDataUrl, {
        headers: {
          'apikey': supabaseKey,
          'Authorization': `Bearer ${supabaseKey}`,
        },
      });
      const cartDataArray = await cartDataResponse.json();
      const cartData = cartDataArray[0];

      let productStock = 0;
      
      if (cartData) {
        if (cartData.variation_id) {
          const stockUrl = `${supabaseUrl}/rest/v1/product_variations?var_id=eq.${cartData.variation_id}&select=stock`;
          const stockResponse = await fetch(stockUrl, {
            headers: {
              'apikey': supabaseKey,
              'Authorization': `Bearer ${supabaseKey}`,
            },
          });
          const stockData = await stockResponse.json();
          productStock = stockData[0]?.stock || 0;
        } else {
          const stockUrl = `${supabaseUrl}/rest/v1/products?prod_id=eq.${cartData.prod_id}&select=stock`;
          const stockResponse = await fetch(stockUrl, {
            headers: {
              'apikey': supabaseKey,
              'Authorization': `Bearer ${supabaseKey}`,
            },
          });
          const stockData = await stockResponse.json();
          productStock = stockData[0]?.stock || 0;
        }
      }

      // Check if quantity is valid
      if (quantity <= 0) {
        // Delete item if quantity is 0
        await fetch(`${supabaseUrl}/rest/v1/cart?cart_id=eq.${targetCartId}`, {
          method: 'DELETE',
          headers: {
            'apikey': supabaseKey,
            'Authorization': `Bearer ${supabaseKey}`,
          },
        });

        return new Response(
          JSON.stringify({ success: true, message: 'Item removed from cart', action: 'removed' }),
          { status: 200, headers: { 'Content-Type': 'application/json', ...corsHeaders } }
        );
      }

      if (quantity > productStock) {
        return new Response(
          JSON.stringify({ success: false, error: `Only ${productStock} items available in stock` }),
          { status: 400, headers: { 'Content-Type': 'application/json', ...corsHeaders } }
        );
      }

      // Update quantity
      const updateResponse = await fetch(`${supabaseUrl}/rest/v1/cart?cart_id=eq.${targetCartId}`, {
        method: 'PATCH',
        headers: {
          'apikey': supabaseKey,
          'Authorization': `Bearer ${supabaseKey}`,
          'Content-Type': 'application/json',
          'Prefer': 'return=representation'
        },
        body: JSON.stringify({ quantity: quantity, added_at: new Date().toISOString() })
      });
      
      const updateData = await updateResponse.json();
      const result = updateData[0];

      return new Response(
        JSON.stringify({ success: true, message: 'Cart updated', cart_item: result, action: 'updated' }),
        { status: 200, headers: { 'Content-Type': 'application/json', ...corsHeaders } }
      );
    }

    // =====================================================
    // REMOVE FROM CART (DELETE)
    // =====================================================
    if (request.method === 'DELETE') {
      const url = new URL(request.url);
      const cart_id = url.searchParams.get('cart_id');
      const cust_id = url.searchParams.get('cust_id');
      const prod_id = url.searchParams.get('prod_id');
      const variation_id = url.searchParams.get('variation_id');

      if (!cart_id && (!cust_id || !prod_id)) {
        return new Response(
          JSON.stringify({ success: false, error: 'Cart ID or (Customer ID + Product ID) is required' }),
          { status: 400, headers: { 'Content-Type': 'application/json', ...corsHeaders } }
        );
      }

      const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
      const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

      let targetCartId = cart_id;

      // If cart_id not provided, find it
      if (!targetCartId && cust_id && prod_id) {
        let findUrl = `${supabaseUrl}/rest/v1/cart?cust_id=eq.${cust_id}&prod_id=eq.${prod_id}&select=cart_id`;
        if (variation_id) {
          findUrl += `&variation_id=eq.${variation_id}`;
        }
        
        const findResponse = await fetch(findUrl, {
          headers: {
            'apikey': supabaseKey,
            'Authorization': `Bearer ${supabaseKey}`,
          },
        });
        const findData = await findResponse.json();
        const cartItem = findData[0];

        if (!cartItem) {
          return new Response(
            JSON.stringify({ success: false, error: 'Cart item not found' }),
            { status: 404, headers: { 'Content-Type': 'application/json', ...corsHeaders } }
          );
        }

        targetCartId = cartItem.cart_id;
      }

      await fetch(`${supabaseUrl}/rest/v1/cart?cart_id=eq.${targetCartId}`, {
        method: 'DELETE',
        headers: {
          'apikey': supabaseKey,
          'Authorization': `Bearer ${supabaseKey}`,
        },
      });

      // Get updated cart count
      let cartCount = 0;
      if (cust_id) {
        const countUrl = `${supabaseUrl}/rest/v1/cart?cust_id=eq.${cust_id}&select=cart_id`;
        const countResponse = await fetch(countUrl, {
          method: 'HEAD',
          headers: {
            'apikey': supabaseKey,
            'Authorization': `Bearer ${supabaseKey}`,
          },
        });
        cartCount = parseInt(countResponse.headers.get('content-range')?.split('/')[1] || '0');
      }

      return new Response(
        JSON.stringify({ success: true, message: 'Item removed from cart', cart_count: cartCount }),
        { status: 200, headers: { 'Content-Type': 'application/json', ...corsHeaders } }
      );
    }

    return new Response(
      JSON.stringify({ success: false, error: 'Method not allowed' }),
      { status: 405, headers: { 'Content-Type': 'application/json', ...corsHeaders } }
    );

  } catch (error) {
    console.error('Cart error:', error);
    return new Response(
      JSON.stringify({ success: false, error: error.message || 'Internal server error' }),
      { status: 500, headers: { 'Content-Type': 'application/json', ...corsHeaders } }
    );
  }
}