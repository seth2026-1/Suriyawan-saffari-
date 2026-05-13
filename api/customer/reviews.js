// api/customer/reviews.js
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
            }),
            order: (orderField, { ascending }) => ({
              range: async (from, to) => {
                const sortOrder = ascending ? 'asc' : 'desc';
                let finalUrl = `${url}&${field}=eq.${value}&order=${orderField}.${sortOrder}`;
                
                if (options.count === 'exact') {
                  finalUrl += `&offset=${from}&limit=${to - from + 1}`;
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
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

    // =====================================================
    // GET PRODUCT REVIEWS
    // =====================================================
    if (request.method === 'GET') {
      const url = new URL(request.url);
      const prod_id = url.searchParams.get('prod_id');
      const page = parseInt(url.searchParams.get('page') || '1');
      const limit = parseInt(url.searchParams.get('limit') || '10');
      const rating_filter = url.searchParams.get('rating_filter');
      const sort = url.searchParams.get('sort') || 'recent';

      if (!prod_id) {
        return new Response(
          JSON.stringify({ success: false, error: 'Product ID is required' }),
          { status: 400, headers: { 'Content-Type': 'application/json', ...corsHeaders } }
        );
      }

      // Build query URL
      let reviewsUrl = `${supabaseUrl}/rest/v1/reviews?select=*,customers(cust_id,name,photo)&prod_id=eq.${prod_id}&is_verified=eq.true`;

      // Filter by rating
      if (rating_filter) {
        reviewsUrl += `&rating=eq.${parseInt(rating_filter)}`;
      }

      // Sorting
      switch (sort) {
        case 'recent':
          reviewsUrl += `&order=created_at.desc`;
          break;
        case 'oldest':
          reviewsUrl += `&order=created_at.asc`;
          break;
        case 'highest_rating':
          reviewsUrl += `&order=rating.desc`;
          break;
        case 'lowest_rating':
          reviewsUrl += `&order=rating.asc`;
          break;
        case 'helpful':
          reviewsUrl += `&order=likes.desc`;
          break;
        default:
          reviewsUrl += `&order=created_at.desc`;
      }

      // Pagination
      const from = (page - 1) * limit;
      const to = from + limit - 1;
      reviewsUrl += `&offset=${from}&limit=${limit}`;

      const reviewsResponse = await fetch(reviewsUrl, {
        headers: {
          'apikey': supabaseKey,
          'Authorization': `Bearer ${supabaseKey}`,
        },
      });
      const reviews = await reviewsResponse.json();
      const count = parseInt(reviewsResponse.headers.get('content-range')?.split('/')[1] || '0');

      // Get all reviews for rating distribution
      const allReviewsUrl = `${supabaseUrl}/rest/v1/reviews?select=rating&prod_id=eq.${prod_id}`;
      const allReviewsResponse = await fetch(allReviewsUrl, {
        headers: {
          'apikey': supabaseKey,
          'Authorization': `Bearer ${supabaseKey}`,
        },
      });
      const allReviews = await allReviewsResponse.json();

      const ratingDistribution = { 5: 0, 4: 0, 3: 0, 2: 0, 1: 0 };
      let totalRating = 0;

      if (allReviews && allReviews.length > 0) {
        allReviews.forEach(review => {
          if (review.rating >= 1 && review.rating <= 5) {
            ratingDistribution[review.rating]++;
            totalRating += review.rating;
          }
        });
      }

      const averageRating = allReviews && allReviews.length > 0 
        ? (totalRating / allReviews.length).toFixed(1) 
        : 0;

      // Get product rating summary
      const productUrl = `${supabaseUrl}/rest/v1/products?prod_id=eq.${prod_id}&select=rating,total_reviews`;
      const productResponse = await fetch(productUrl, {
        headers: {
          'apikey': supabaseKey,
          'Authorization': `Bearer ${supabaseKey}`,
        },
      });
      const productData = await productResponse.json();
      const product = productData[0];

      // Format reviews
      const formattedReviews = (reviews || []).map(review => ({
        review_id: review.review_id,
        rating: review.rating,
        title: review.title,
        comment: review.comment,
        photo: review.photo,
        video: review.video,
        likes: review.likes || 0,
        customer: {
          cust_id: review.customers?.cust_id,
          name: review.customers?.name,
          photo: review.customers?.photo
        },
        created_at: review.created_at,
        is_verified: review.is_verified
      }));

      return new Response(
        JSON.stringify({
          success: true,
          reviews: formattedReviews,
          summary: {
            average_rating: parseFloat(averageRating),
            total_reviews: count || 0,
            rating_distribution: ratingDistribution,
            product_rating: product?.rating || 0,
            product_total_reviews: product?.total_reviews || 0
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
    }

    // =====================================================
    // ADD/SUBMIT REVIEW (POST)
    // =====================================================
    if (request.method === 'POST') {
      const body = await request.json();
      const {
        cust_id,
        prod_id,
        order_id,
        rating,
        title,
        comment,
        photo,
        video
      } = body;

      // Validation
      if (!cust_id || !prod_id || !rating) {
        return new Response(
          JSON.stringify({ success: false, error: 'Customer ID, Product ID and rating are required' }),
          { status: 400, headers: { 'Content-Type': 'application/json', ...corsHeaders } }
        );
      }

      if (rating < 1 || rating > 5) {
        return new Response(
          JSON.stringify({ success: false, error: 'Rating must be between 1 and 5' }),
          { status: 400, headers: { 'Content-Type': 'application/json', ...corsHeaders } }
        );
      }

      // Check if customer has purchased this product
      let hasPurchased = false;
      let verifiedOrderId = order_id;

      if (!verifiedOrderId) {
        // Get order items for this product
        const orderItemsUrl = `${supabaseUrl}/rest/v1/order_items?prod_id=eq.${prod_id}&select=book_id`;
        const orderItemsResponse = await fetch(orderItemsUrl, {
          headers: {
            'apikey': supabaseKey,
            'Authorization': `Bearer ${supabaseKey}`,
          },
        });
        const orderItems = await orderItemsResponse.json();

        if (orderItems && orderItems.length > 0) {
          const orderIds = orderItems.map(oi => oi.book_id);
          const orderIdsParam = orderIds.join(',');
          
          const ordersUrl = `${supabaseUrl}/rest/v1/orders?cust_id=eq.${cust_id}&book_id=in.(${orderIdsParam})&status=eq.DELIVERED&select=book_id`;
          const ordersResponse = await fetch(ordersUrl, {
            headers: {
              'apikey': supabaseKey,
              'Authorization': `Bearer ${supabaseKey}`,
            },
          });
          const orders = await ordersResponse.json();

          if (orders && orders.length > 0) {
            hasPurchased = true;
            verifiedOrderId = orders[0].book_id;
          }
        }
      } else {
        // Verify the order belongs to customer and is delivered
        const orderUrl = `${supabaseUrl}/rest/v1/orders?book_id=eq.${verifiedOrderId}&cust_id=eq.${cust_id}&status=eq.DELIVERED&select=book_id`;
        const orderResponse = await fetch(orderUrl, {
          headers: {
            'apikey': supabaseKey,
            'Authorization': `Bearer ${supabaseKey}`,
          },
        });
        const orderData = await orderResponse.json();
        const order = orderData[0];

        if (order) {
          hasPurchased = true;
        }
      }

      // Check if already reviewed this product
      const existingReviewUrl = `${supabaseUrl}/rest/v1/reviews?cust_id=eq.${cust_id}&prod_id=eq.${prod_id}&select=review_id`;
      const existingReviewResponse = await fetch(existingReviewUrl, {
        headers: {
          'apikey': supabaseKey,
          'Authorization': `Bearer ${supabaseKey}`,
        },
      });
      const existingReviewData = await existingReviewResponse.json();
      const existingReview = existingReviewData[0];

      if (existingReview) {
        return new Response(
          JSON.stringify({
            success: false,
            error: 'You have already reviewed this product',
            existing_review_id: existingReview.review_id
          }),
          { status: 400, headers: { 'Content-Type': 'application/json', ...corsHeaders } }
        );
      }

      // Submit review
      const reviewInsert = await supabase
        .from('reviews')
        .insert({
          cust_id,
          prod_id,
          order_id: verifiedOrderId,
          rating,
          title: title || null,
          comment: comment || null,
          photo: photo || null,
          video: video || null,
          is_verified: hasPurchased,
          created_at: new Date().toISOString()
        })
        .select();

      if (reviewInsert.error) {
        return new Response(
          JSON.stringify({ success: false, error: reviewInsert.error.message }),
          { status: 500, headers: { 'Content-Type': 'application/json', ...corsHeaders } }
        );
      }

      const newReview = reviewInsert.data;

      // Update product rating and review count
      const allReviewsUrl = `${supabaseUrl}/rest/v1/reviews?select=rating&prod_id=eq.${prod_id}`;
      const allReviewsResponse = await fetch(allReviewsUrl, {
        headers: {
          'apikey': supabaseKey,
          'Authorization': `Bearer ${supabaseKey}`,
        },
      });
      const allReviewsData = await allReviewsResponse.json();
      const allReviews = allReviewsData || [];

      let newAvgRating = 0;
      if (allReviews && allReviews.length > 0) {
        const total = allReviews.reduce((sum, r) => sum + r.rating, 0);
        newAvgRating = total / allReviews.length;
      }

      await fetch(`${supabaseUrl}/rest/v1/products?prod_id=eq.${prod_id}`, {
        method: 'PATCH',
        headers: {
          'apikey': supabaseKey,
          'Authorization': `Bearer ${supabaseKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          rating: parseFloat(newAvgRating.toFixed(1)),
          total_reviews: allReviews?.length || 1
        })
      });

      // Add coins for review (only if verified purchase)
      let coinsEarned = 0;
      if (hasPurchased) {
        const coinSettingUrl = `${supabaseUrl}/rest/v1/system_settings?setting_key=eq.coins_per_review&select=setting_value`;
        const coinSettingResponse = await fetch(coinSettingUrl, {
          headers: {
            'apikey': supabaseKey,
            'Authorization': `Bearer ${supabaseKey}`,
          },
        });
        const coinSettingData = await coinSettingResponse.json();
        const coinSetting = coinSettingData[0];

        coinsEarned = coinSetting ? parseInt(coinSetting.setting_value) : 10;

        await fetch(`${supabaseUrl}/rest/v1/coin_transactions`, {
          method: 'POST',
          headers: {
            'apikey': supabaseKey,
            'Authorization': `Bearer ${supabaseKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            cust_id,
            coins: coinsEarned,
            type: 'credit',
            reason: `Product review for ${prod_id}`,
            reference_id: String(newReview.review_id),
            created_at: new Date().toISOString()
          })
        });

        // Get current coins for update
        const currentCustomerUrl = `${supabaseUrl}/rest/v1/customers?cust_id=eq.${cust_id}&select=coins`;
        const currentCustomerResponse = await fetch(currentCustomerUrl, {
          headers: {
            'apikey': supabaseKey,
            'Authorization': `Bearer ${supabaseKey}`,
          },
        });
        const currentCustomerData = await currentCustomerResponse.json();
        const currentCustomer = currentCustomerData[0];

        await fetch(`${supabaseUrl}/rest/v1/customers?cust_id=eq.${cust_id}`, {
          method: 'PATCH',
          headers: {
            'apikey': supabaseKey,
            'Authorization': `Bearer ${supabaseKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ coins: (currentCustomer?.coins || 0) + coinsEarned })
        });
      }

      return new Response(
        JSON.stringify({
          success: true,
          message: 'Review submitted successfully',
          review: {
            review_id: newReview.review_id,
            rating: newReview.rating,
            title: newReview.title,
            comment: newReview.comment,
            created_at: newReview.created_at,
            is_verified: newReview.is_verified,
            coins_earned: coinsEarned
          }
        }),
        { status: 200, headers: { 'Content-Type': 'application/json', ...corsHeaders } }
      );
    }

    // =====================================================
    // UPDATE REVIEW (PUT)
    // =====================================================
    if (request.method === 'PUT') {
      const body = await request.json();
      const { review_id, cust_id, rating, title, comment, photo, video } = body;

      if (!review_id || !cust_id) {
        return new Response(
          JSON.stringify({ success: false, error: 'Review ID and Customer ID are required' }),
          { status: 400, headers: { 'Content-Type': 'application/json', ...corsHeaders } }
        );
      }

      // Check if review exists and belongs to customer
      const existingReviewUrl = `${supabaseUrl}/rest/v1/reviews?review_id=eq.${review_id}&select=review_id,cust_id,prod_id`;
      const existingReviewResponse = await fetch(existingReviewUrl, {
        headers: {
          'apikey': supabaseKey,
          'Authorization': `Bearer ${supabaseKey}`,
        },
      });
      const existingReviewData = await existingReviewResponse.json();
      const existingReview = existingReviewData[0];

      if (!existingReview) {
        return new Response(
          JSON.stringify({ success: false, error: 'Review not found' }),
          { status: 404, headers: { 'Content-Type': 'application/json', ...corsHeaders } }
        );
      }

      if (existingReview.cust_id !== cust_id) {
        return new Response(
          JSON.stringify({ success: false, error: 'You can only update your own reviews' }),
          { status: 403, headers: { 'Content-Type': 'application/json', ...corsHeaders } }
        );
      }

      // Update the review
      const updateData = {};
      if (rating) updateData.rating = rating;
      if (title) updateData.title = title;
      if (comment) updateData.comment = comment;
      if (photo) updateData.photo = photo;
      if (video) updateData.video = video;
      updateData.updated_at = new Date().toISOString();

      const updateResult = await supabase
        .from('reviews')
        .update(updateData)
        .eq('review_id', review_id)
        .select();

      if (updateResult.error) {
        return new Response(
          JSON.stringify({ success: false, error: updateResult.error.message }),
          { status: 500, headers: { 'Content-Type': 'application/json', ...corsHeaders } }
        );
      }

      const updatedReview = updateResult.data;

      // Recalculate product rating
      const allReviewsUrl = `${supabaseUrl}/rest/v1/reviews?select=rating&prod_id=eq.${existingReview.prod_id}`;
      const allReviewsResponse = await fetch(allReviewsUrl, {
        headers: {
          'apikey': supabaseKey,
          'Authorization': `Bearer ${supabaseKey}`,
        },
      });
      const allReviewsData = await allReviewsResponse.json();
      const allReviews = allReviewsData || [];

      if (allReviews && allReviews.length > 0) {
        const total = allReviews.reduce((sum, r) => sum + r.rating, 0);
        const newAvgRating = total / allReviews.length;

        await fetch(`${supabaseUrl}/rest/v1/products?prod_id=eq.${existingReview.prod_id}`, {
          method: 'PATCH',
          headers: {
            'apikey': supabaseKey,
            'Authorization': `Bearer ${supabaseKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ rating: parseFloat(newAvgRating.toFixed(1)) })
        });
      }

      return new Response(
        JSON.stringify({
          success: true,
          message: 'Review updated successfully',
          review: {
            review_id: updatedReview.review_id,
            rating: updatedReview.rating,
            title: updatedReview.title,
            comment: updatedReview.comment,
            updated_at: updatedReview.updated_at
          }
        }),
        { status: 200, headers: { 'Content-Type': 'application/json', ...corsHeaders } }
      );
    }

    // =====================================================
    // DELETE REVIEW (DELETE)
    // =====================================================
    if (request.method === 'DELETE') {
      const url = new URL(request.url);
      const review_id = url.searchParams.get('review_id');
      const cust_id = url.searchParams.get('cust_id');

      if (!review_id || !cust_id) {
        return new Response(
          JSON.stringify({ success: false, error: 'Review ID and Customer ID are required' }),
          { status: 400, headers: { 'Content-Type': 'application/json', ...corsHeaders } }
        );
      }

      // Check if review exists and belongs to customer
      const existingReviewUrl = `${supabaseUrl}/rest/v1/reviews?review_id=eq.${review_id}&select=review_id,cust_id,prod_id`;
      const existingReviewResponse = await fetch(existingReviewUrl, {
        headers: {
          'apikey': supabaseKey,
          'Authorization': `Bearer ${supabaseKey}`,
        },
      });
      const existingReviewData = await existingReviewResponse.json();
      const existingReview = existingReviewData[0];

      if (!existingReview) {
        return new Response(
          JSON.stringify({ success: false, error: 'Review not found' }),
          { status: 404, headers: { 'Content-Type': 'application/json', ...corsHeaders } }
        );
      }

      if (existingReview.cust_id !== cust_id) {
        return new Response(
          JSON.stringify({ success: false, error: 'You can only delete your own reviews' }),
          { status: 403, headers: { 'Content-Type': 'application/json', ...corsHeaders } }
        );
      }

      // Delete the review
      await fetch(`${supabaseUrl}/rest/v1/reviews?review_id=eq.${review_id}`, {
        method: 'DELETE',
        headers: {
          'apikey': supabaseKey,
          'Authorization': `Bearer ${supabaseKey}`,
        },
      });

      // Recalculate product rating
      const allReviewsUrl = `${supabaseUrl}/rest/v1/reviews?select=rating&prod_id=eq.${existingReview.prod_id}`;
      const allReviewsResponse = await fetch(allReviewsUrl, {
        headers: {
          'apikey': supabaseKey,
          'Authorization': `Bearer ${supabaseKey}`,
        },
      });
      const allReviewsData = await allReviewsResponse.json();
      const allReviews = allReviewsData || [];

      if (allReviews && allReviews.length > 0) {
        const total = allReviews.reduce((sum, r) => sum + r.rating, 0);
        const newAvgRating = total / allReviews.length;

        await fetch(`${supabaseUrl}/rest/v1/products?prod_id=eq.${existingReview.prod_id}`, {
          method: 'PATCH',
          headers: {
            'apikey': supabaseKey,
            'Authorization': `Bearer ${supabaseKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            rating: parseFloat(newAvgRating.toFixed(1)),
            total_reviews: allReviews.length
          })
        });
      } else {
        await fetch(`${supabaseUrl}/rest/v1/products?prod_id=eq.${existingReview.prod_id}`, {
          method: 'PATCH',
          headers: {
            'apikey': supabaseKey,
            'Authorization': `Bearer ${supabaseKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ rating: 0, total_reviews: 0 })
        });
      }

      return new Response(
        JSON.stringify({ success: true, message: 'Review deleted successfully' }),
        { status: 200, headers: { 'Content-Type': 'application/json', ...corsHeaders } }
      );
    }

    return new Response(
      JSON.stringify({ success: false, error: 'Method not allowed' }),
      { status: 405, headers: { 'Content-Type': 'application/json', ...corsHeaders } }
    );

  } catch (error) {
    console.error('Reviews error:', error);
    return new Response(
      JSON.stringify({ success: false, error: error.message || 'Internal server error' }),
      { status: 500, headers: { 'Content-Type': 'application/json', ...corsHeaders } }
    );
  }
}