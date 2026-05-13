// api/seller/coupons.js
// Edge Function for Vercel Deployment

export const config = {
  runtime: 'edge',
  regions: ['iad1', 'sfo1', 'fra1', 'sin1'],
};

// Helper function to generate Coupon ID
function generateCouponId() {
  const date = new Date();
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  const random = Math.random().toString(36).substring(2, 8).toUpperCase();
  return `CPN${year}${month}${day}${random}`;
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
            lt: (ltField, ltValue) => ({
              select: async () => {
                const finalUrl = `${url}&${field}=eq.${value}&${ltField}=lt.${ltValue}`;
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
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version, Authorization',
  };

  // Handle OPTIONS preflight
  if (request.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: corsHeaders });
  }

  const supabase = createSupabaseClient();
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  // =====================================================
  // GET COUPONS LIST
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

      let couponsUrl = `${supabaseUrl}/rest/v1/coupons?select=*&created_by=eq.${seller_id}&order=created_at.desc`;

      const todayStr = new Date().toISOString().split('T')[0];
      
      if (status === 'active') {
        couponsUrl += `&is_active=eq.true&expiry_date=gte.${todayStr}`;
      } else if (status === 'expired') {
        couponsUrl += `&expiry_date=lt.${todayStr}`;
      } else if (status === 'inactive') {
        couponsUrl += `&is_active=eq.false`;
      }

      const from = (page - 1) * limit;
      const to = from + limit - 1;
      couponsUrl += `&offset=${from}&limit=${limit}`;

      const couponsResponse = await fetch(couponsUrl, {
        headers: {
          'apikey': supabaseKey,
          'Authorization': `Bearer ${supabaseKey}`,
        },
      });
      const coupons = await couponsResponse.json();
      const count = parseInt(couponsResponse.headers.get('content-range')?.split('/')[1] || '0');

      // Get usage stats for each coupon
      const couponsWithStats = await Promise.all(coupons.map(async (coupon) => {
        const usageUrl = `${supabaseUrl}/rest/v1/user_coupons?coupon_id=eq.${coupon.coupon_id}&select=used_count`;
        const usageResponse = await fetch(usageUrl, {
          headers: {
            'apikey': supabaseKey,
            'Authorization': `Bearer ${supabaseKey}`,
          },
        });
        const usageData = await usageResponse.json();
        
        const usedCount = usageData?.length || 0;
        const usagePercent = coupon.usage_limit > 0 ? (usedCount / coupon.usage_limit) * 100 : 0;

        // Get revenue generated from orders using this coupon
        const ordersUrl = `${supabaseUrl}/rest/v1/orders?select=final_amount&seller_id=eq.${seller_id}&applied_coupons=cs.{${coupon.code}}`;
        const ordersResponse = await fetch(ordersUrl, {
          headers: {
            'apikey': supabaseKey,
            'Authorization': `Bearer ${supabaseKey}`,
          },
        });
        const ordersWithCoupon = await ordersResponse.json();

        const revenueGenerated = ordersWithCoupon?.reduce((sum, o) => sum + (o.final_amount || 0), 0) || 0;

        return {
          ...coupon,
          used_count: usedCount,
          usage_percent: Math.round(usagePercent),
          revenue_generated: revenueGenerated,
          is_expired: new Date(coupon.expiry_date) < new Date(),
          is_active_status: coupon.is_active && new Date(coupon.expiry_date) >= new Date()
        };
      }));

      // Get statistics for all coupons
      const allCouponsUrl = `${supabaseUrl}/rest/v1/coupons?select=is_active,expiry_date&created_by=eq.${seller_id}`;
      const allCouponsResponse = await fetch(allCouponsUrl, {
        headers: {
          'apikey': supabaseKey,
          'Authorization': `Bearer ${supabaseKey}`,
        },
      });
      const allCoupons = await allCouponsResponse.json();

      const totalCoupons = allCoupons?.length || 0;
      const activeCoupons = allCoupons?.filter(c => c.is_active && new Date(c.expiry_date) >= new Date()).length || 0;
      const expiredCoupons = allCoupons?.filter(c => new Date(c.expiry_date) < new Date()).length || 0;
      const totalUsage = couponsWithStats.reduce((sum, c) => sum + (c.used_count || 0), 0);

      return new Response(
        JSON.stringify({
          success: true,
          coupons: couponsWithStats,
          statistics: {
            total: totalCoupons,
            active: activeCoupons,
            expired: expiredCoupons,
            total_usage: totalUsage
          },
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
      console.error('Get coupons error:', error);
      return new Response(
        JSON.stringify({ success: false, error: error.message }),
        { status: 500, headers: { 'Content-Type': 'application/json', ...corsHeaders } }
      );
    }
  }

  // =====================================================
  // CREATE COUPON (POST)
  // =====================================================
  if (request.method === 'POST') {
    try {
      const body = await request.json();
      const {
        seller_id,
        code,
        discount_type,
        discount_value,
        min_order,
        max_discount,
        applicable_products,
        applicable_categories,
        usage_limit,
        per_user_limit,
        start_date,
        expiry_date,
        description
      } = body;

      if (!seller_id || !code || !discount_type || !discount_value || !expiry_date) {
        return new Response(
          JSON.stringify({
            success: false,
            error: 'Seller ID, code, discount type, discount value and expiry date are required'
          }),
          { status: 400, headers: { 'Content-Type': 'application/json', ...corsHeaders } }
        );
      }

      if (!['percentage', 'fixed'].includes(discount_type)) {
        return new Response(
          JSON.stringify({ success: false, error: 'Invalid discount type' }),
          { status: 400, headers: { 'Content-Type': 'application/json', ...corsHeaders } }
        );
      }

      if (discount_type === 'percentage' && discount_value > 90) {
        return new Response(
          JSON.stringify({ success: false, error: 'Percentage discount cannot exceed 90%' }),
          { status: 400, headers: { 'Content-Type': 'application/json', ...corsHeaders } }
        );
      }

      // Check if coupon code already exists
      const existingUrl = `${supabaseUrl}/rest/v1/coupons?code=eq.${encodeURIComponent(code.toUpperCase())}&select=code`;
      const existingResponse = await fetch(existingUrl, {
        headers: {
          'apikey': supabaseKey,
          'Authorization': `Bearer ${supabaseKey}`,
        },
      });
      const existingData = await existingResponse.json();
      const existingCoupon = existingData[0];

      if (existingCoupon) {
        return new Response(
          JSON.stringify({ success: false, error: 'Coupon code already exists' }),
          { status: 400, headers: { 'Content-Type': 'application/json', ...corsHeaders } }
        );
      }

      const couponId = generateCouponId();
      const todayStr = new Date().toISOString().split('T')[0];

      const couponInsert = await supabase
        .from('coupons')
        .insert({
          coupon_id: couponId,
          code: code.toUpperCase(),
          discount_type,
          discount_value: parseInt(discount_value),
          min_order: min_order ? parseInt(min_order) : 0,
          max_discount: max_discount ? parseInt(max_discount) : null,
          applicable_products: applicable_products || null,
          applicable_categories: applicable_categories || null,
          usage_limit: usage_limit ? parseInt(usage_limit) : null,
          per_user_limit: per_user_limit ? parseInt(per_user_limit) : 1,
          start_date: start_date || todayStr,
          expiry_date,
          description: description || null,
          is_active: true,
          created_by: seller_id,
          created_at: new Date().toISOString()
        })
        .select();

      if (couponInsert.error) {
        console.error('Coupon creation error:', couponInsert.error);
        return new Response(
          JSON.stringify({ success: false, error: couponInsert.error.message }),
          { status: 500, headers: { 'Content-Type': 'application/json', ...corsHeaders } }
        );
      }

      const coupon = couponInsert.data;

      return new Response(
        JSON.stringify({
          success: true,
          message: 'Coupon created successfully',
          coupon: {
            coupon_id: coupon.coupon_id,
            code: coupon.code,
            discount_type: coupon.discount_type,
            discount_value: coupon.discount_value,
            min_order: coupon.min_order,
            expiry_date: coupon.expiry_date,
            is_active: coupon.is_active,
            barcode_url: `/api/barcode/generate?text=${coupon.code}`,
            qr_url: `/api/barcode/generate-qr?text=${coupon.code}`
          },
          share_link: `/shop?coupon=${coupon.code}`
        }),
        { status: 200, headers: { 'Content-Type': 'application/json', ...corsHeaders } }
      );

    } catch (error) {
      console.error('Create coupon error:', error);
      return new Response(
        JSON.stringify({ success: false, error: error.message }),
        { status: 500, headers: { 'Content-Type': 'application/json', ...corsHeaders } }
      );
    }
  }

  // =====================================================
  // UPDATE COUPON (PUT)
  // =====================================================
  if (request.method === 'PUT') {
    try {
      const body = await request.json();
      const {
        coupon_id,
        seller_id,
        discount_value,
        min_order,
        max_discount,
        usage_limit,
        per_user_limit,
        expiry_date,
        is_active,
        description
      } = body;

      if (!coupon_id || !seller_id) {
        return new Response(
          JSON.stringify({
            success: false,
            error: 'Coupon ID and Seller ID are required'
          }),
          { status: 400, headers: { 'Content-Type': 'application/json', ...corsHeaders } }
        );
      }

      // Verify ownership
      const existingUrl = `${supabaseUrl}/rest/v1/coupons?coupon_id=eq.${coupon_id}&select=created_by`;
      const existingResponse = await fetch(existingUrl, {
        headers: {
          'apikey': supabaseKey,
          'Authorization': `Bearer ${supabaseKey}`,
        },
      });
      const existingData = await existingResponse.json();
      const existingCoupon = existingData[0];

      if (!existingCoupon) {
        return new Response(
          JSON.stringify({ success: false, error: 'Coupon not found' }),
          { status: 404, headers: { 'Content-Type': 'application/json', ...corsHeaders } }
        );
      }

      if (existingCoupon.created_by !== seller_id) {
        return new Response(
          JSON.stringify({ success: false, error: 'Unauthorized' }),
          { status: 403, headers: { 'Content-Type': 'application/json', ...corsHeaders } }
        );
      }

      const updateData = {};
      if (discount_value !== undefined) updateData.discount_value = parseInt(discount_value);
      if (min_order !== undefined) updateData.min_order = parseInt(min_order);
      if (max_discount !== undefined) updateData.max_discount = max_discount ? parseInt(max_discount) : null;
      if (usage_limit !== undefined) updateData.usage_limit = usage_limit ? parseInt(usage_limit) : null;
      if (per_user_limit !== undefined) updateData.per_user_limit = parseInt(per_user_limit);
      if (expiry_date !== undefined) updateData.expiry_date = expiry_date;
      if (is_active !== undefined) updateData.is_active = is_active;
      if (description !== undefined) updateData.description = description;

      updateData.updated_at = new Date().toISOString();

      const updateResult = await supabase
        .from('coupons')
        .update(updateData)
        .eq('coupon_id', coupon_id)
        .select();

      if (updateResult.error) {
        console.error('Coupon update error:', updateResult.error);
        return new Response(
          JSON.stringify({ success: false, error: updateResult.error.message }),
          { status: 500, headers: { 'Content-Type': 'application/json', ...corsHeaders } }
        );
      }

      const updatedCoupon = updateResult.data;

      return new Response(
        JSON.stringify({
          success: true,
          message: 'Coupon updated successfully',
          coupon: updatedCoupon
        }),
        { status: 200, headers: { 'Content-Type': 'application/json', ...corsHeaders } }
      );

    } catch (error) {
      console.error('Update coupon error:', error);
      return new Response(
        JSON.stringify({ success: false, error: error.message }),
        { status: 500, headers: { 'Content-Type': 'application/json', ...corsHeaders } }
      );
    }
  }

  // =====================================================
  // DELETE COUPON (DELETE)
  // =====================================================
  if (request.method === 'DELETE') {
    try {
      const url = new URL(request.url);
      const coupon_id = url.searchParams.get('coupon_id');
      const seller_id = url.searchParams.get('seller_id');

      if (!coupon_id || !seller_id) {
        return new Response(
          JSON.stringify({
            success: false,
            error: 'Coupon ID and Seller ID are required'
          }),
          { status: 400, headers: { 'Content-Type': 'application/json', ...corsHeaders } }
        );
      }

      // Verify ownership
      const existingUrl = `${supabaseUrl}/rest/v1/coupons?coupon_id=eq.${coupon_id}&select=created_by,code`;
      const existingResponse = await fetch(existingUrl, {
        headers: {
          'apikey': supabaseKey,
          'Authorization': `Bearer ${supabaseKey}`,
        },
      });
      const existingData = await existingResponse.json();
      const existingCoupon = existingData[0];

      if (!existingCoupon) {
        return new Response(
          JSON.stringify({ success: false, error: 'Coupon not found' }),
          { status: 404, headers: { 'Content-Type': 'application/json', ...corsHeaders } }
        );
      }

      if (existingCoupon.created_by !== seller_id) {
        return new Response(
          JSON.stringify({ success: false, error: 'Unauthorized' }),
          { status: 403, headers: { 'Content-Type': 'application/json', ...corsHeaders } }
        );
      }

      // Soft delete - deactivate coupon
      await fetch(`${supabaseUrl}/rest/v1/coupons?coupon_id=eq.${coupon_id}`, {
        method: 'PATCH',
        headers: {
          'apikey': supabaseKey,
          'Authorization': `Bearer ${supabaseKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          is_active: false,
          updated_at: new Date().toISOString()
        })
      });

      return new Response(
        JSON.stringify({
          success: true,
          message: 'Coupon deactivated successfully'
        }),
        { status: 200, headers: { 'Content-Type': 'application/json', ...corsHeaders } }
      );

    } catch (error) {
      console.error('Delete coupon error:', error);
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