// api/owner/reports/export.js
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
            gte: (gteField, gteValue) => ({
              lte: (lteField, lteValue) => ({
                limit: async (limit) => {
                  let finalUrl = `${url}&${field}=eq.${value}&${gteField}=gte.${gteValue}&${lteField}=lte.${lteValue}&limit=${limit}`;
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
            limit: async (limit) => {
              let finalUrl = `${url}&${field}=eq.${value}&limit=${limit}`;
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
          eq: (field, value) => ({
            gte: (gteField, gteValue) => ({
              lte: (lteField, lteValue) => ({
                limit: async (limit) => {
                  let finalUrl = `${url}&${field}=eq.${value}&${gteField}=gte.${gteValue}&${lteField}=lte.${lteValue}&limit=${limit}`;
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
            limit: async (limit) => {
              let finalUrl = `${url}&${field}=eq.${value}&limit=${limit}`;
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
              const finalUrl = `${supabaseUrl}/rest/v1/${table}?select=${columns || '*'}&${field}=in.(${values.join(',')})`;
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
      }
    })
  };
}

export default async function handler(request) {
  // CORS Headers
  const corsHeaders = {
    'Access-Control-Allow-Credentials': 'true',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, OPTIONS',
    'Access-Control-Allow-Headers': 'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version, Authorization',
  };

  // Handle OPTIONS preflight
  if (request.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: corsHeaders });
  }

  if (request.method !== 'GET') {
    return new Response(JSON.stringify({ success: false, error: 'Method not allowed' }), {
      status: 405,
      headers: { 'Content-Type': 'application/json', ...corsHeaders }
    });
  }

  try {
    const url = new URL(request.url);
    const export_type = url.searchParams.get('export_type');
    const format = url.searchParams.get('format') || 'csv';
    const from_date = url.searchParams.get('from_date');
    const to_date = url.searchParams.get('to_date');
    const seller_id = url.searchParams.get('seller_id');
    const status = url.searchParams.get('status');
    const limit = parseInt(url.searchParams.get('limit') || '10000');

    if (!export_type) {
      return new Response(JSON.stringify({ success: false, error: 'Export type is required' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json', ...corsHeaders }
      });
    }

    const supabase = createSupabaseClient();
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

    // Set date range
    let startDate, endDate;
    if (from_date && to_date) {
      startDate = new Date(from_date);
      endDate = new Date(to_date);
    } else {
      const now = new Date();
      startDate = new Date(now.getFullYear(), now.getMonth(), 1);
      endDate = new Date();
    }

    const startDateStr = startDate.toISOString();
    const endDateStr = endDate.toISOString();

    let data = [];
    let filename = '';
    let headers = [];

    // =====================================================
    // EXPORT ORDERS
    // =====================================================
    if (export_type === 'orders') {
      const ordersSelect = `book_id,tracking_id,cancel_code,status,total_amount,delivery_charge,discount_amount,final_amount,payment_method,address,placed_at,delivered_at,cancelled_at,cancel_reason,customers!inner(cust_id,name,email,mobile),sellers!inner(seller_id,shop_name),riders!left(rider_id,name as rider_name)`;
      let ordersUrl = `${supabaseUrl}/rest/v1/orders?select=${encodeURIComponent(ordersSelect)}&placed_at=gte.${startDateStr}&placed_at=lte.${endDateStr}&limit=${limit}`;

      if (seller_id) {
        ordersUrl += `&seller_id=eq.${seller_id}`;
      }
      if (status) {
        ordersUrl += `&status=eq.${status}`;
      }

      const ordersResponse = await fetch(ordersUrl, {
        headers: {
          'apikey': supabaseKey,
          'Authorization': `Bearer ${supabaseKey}`,
        },
      });
      const orders = await ordersResponse.json();

      data = orders?.map(order => ({
        'Order ID': order.book_id,
        'Tracking ID': order.tracking_id,
        'Cancel Code': order.cancel_code,
        'Status': order.status,
        'Total Amount': order.total_amount,
        'Delivery Charge': order.delivery_charge,
        'Discount': order.discount_amount,
        'Final Amount': order.final_amount,
        'Payment Method': order.payment_method,
        'Customer Name': order.customers?.name,
        'Customer Mobile': order.customers?.mobile,
        'Customer Email': order.customers?.email,
        'Seller Name': order.sellers?.shop_name,
        'Rider Name': order.riders?.rider_name,
        'Placed At': order.placed_at,
        'Delivered At': order.delivered_at || '',
        'Cancelled At': order.cancelled_at || '',
        'Cancel Reason': order.cancel_reason || '',
        'Address': typeof order.address === 'object' ? JSON.stringify(order.address) : order.address
      })) || [];

      headers = Object.keys(data[0] || {});
      filename = `orders_export_${startDateStr.split('T')[0]}_${endDateStr.split('T')[0]}.${format}`;
    }

    // =====================================================
    // EXPORT PRODUCTS
    // =====================================================
    else if (export_type === 'products') {
      const productsSelect = `prod_id,name,description,mrp,selling_price,stock,tags,is_active,total_sold,total_views,rating,created_at,sellers!inner(seller_id,shop_name),categories!left(name as category_name)`;
      const productsUrl = `${supabaseUrl}/rest/v1/products?select=${encodeURIComponent(productsSelect)}&limit=${limit}`;
      const productsResponse = await fetch(productsUrl, {
        headers: {
          'apikey': supabaseKey,
          'Authorization': `Bearer ${supabaseKey}`,
        },
      });
      const products = await productsResponse.json();

      data = products?.map(product => ({
        'Product ID': product.prod_id,
        'Name': product.name,
        'Description': product.description,
        'MRP': product.mrp,
        'Selling Price': product.selling_price,
        'Stock': product.stock,
        'Tags': product.tags?.join(', '),
        'Is Active': product.is_active,
        'Total Sold': product.total_sold || 0,
        'Total Views': product.total_views || 0,
        'Rating': product.rating || 0,
        'Seller': product.sellers?.shop_name,
        'Category': product.categories?.category_name,
        'Created At': product.created_at
      })) || [];

      headers = Object.keys(data[0] || {});
      filename = `products_export_${new Date().toISOString().split('T')[0]}.${format}`;
    }

    // =====================================================
    // EXPORT CUSTOMERS
    // =====================================================
    else if (export_type === 'customers') {
      const customersSelect = `cust_id,name,email,mobile,trust_score,cod_status,wallet_balance,coins,is_active,created_at`;
      const customersUrl = `${supabaseUrl}/rest/v1/customers?select=${customersSelect}&limit=${limit}`;
      const customersResponse = await fetch(customersUrl, {
        headers: {
          'apikey': supabaseKey,
          'Authorization': `Bearer ${supabaseKey}`,
        },
      });
      const customers = await customersResponse.json();

      data = customers?.map(customer => ({
        'Customer ID': customer.cust_id,
        'Name': customer.name,
        'Email': customer.email,
        'Mobile': customer.mobile,
        'Trust Score': customer.trust_score,
        'COD Status': customer.cod_status,
        'Wallet Balance': customer.wallet_balance,
        'Coins': customer.coins,
        'Is Active': customer.is_active,
        'Created At': customer.created_at
      })) || [];

      headers = Object.keys(data[0] || {});
      filename = `customers_export_${new Date().toISOString().split('T')[0]}.${format}`;
    }

    // =====================================================
    // EXPORT SELLERS
    // =====================================================
    else if (export_type === 'sellers') {
      const sellersSelect = `seller_id,shop_name,owner_name,email,mobile,upi_id,gst_number,kyc_status,commission_rate,rating,wallet_balance,is_active,created_at`;
      const sellersUrl = `${supabaseUrl}/rest/v1/sellers?select=${sellersSelect}&limit=${limit}`;
      const sellersResponse = await fetch(sellersUrl, {
        headers: {
          'apikey': supabaseKey,
          'Authorization': `Bearer ${supabaseKey}`,
        },
      });
      const sellers = await sellersResponse.json();

      data = sellers?.map(seller => ({
        'Seller ID': seller.seller_id,
        'Shop Name': seller.shop_name,
        'Owner Name': seller.owner_name,
        'Email': seller.email,
        'Mobile': seller.mobile,
        'UPI ID': seller.upi_id,
        'GST Number': seller.gst_number || '',
        'KYC Status': seller.kyc_status,
        'Commission Rate': seller.commission_rate,
        'Rating': seller.rating || 0,
        'Wallet Balance': seller.wallet_balance,
        'Is Active': seller.is_active,
        'Created At': seller.created_at
      })) || [];

      headers = Object.keys(data[0] || {});
      filename = `sellers_export_${new Date().toISOString().split('T')[0]}.${format}`;
    }

    // =====================================================
    // EXPORT RIDERS
    // =====================================================
    else if (export_type === 'riders') {
      const ridersSelect = `rider_id,name,email,mobile,upi_id,assigned_area,rate_per_parcel,rating,total_deliveries,total_pickups,wallet_balance,is_online,is_active,created_at`;
      const ridersUrl = `${supabaseUrl}/rest/v1/riders?select=${ridersSelect}&limit=${limit}`;
      const ridersResponse = await fetch(ridersUrl, {
        headers: {
          'apikey': supabaseKey,
          'Authorization': `Bearer ${supabaseKey}`,
        },
      });
      const riders = await ridersResponse.json();

      data = riders?.map(rider => ({
        'Rider ID': rider.rider_id,
        'Name': rider.name,
        'Email': rider.email,
        'Mobile': rider.mobile,
        'UPI ID': rider.upi_id,
        'Assigned Area': rider.assigned_area || '',
        'Rate Per Parcel': rider.rate_per_parcel,
        'Rating': rider.rating || 0,
        'Total Deliveries': rider.total_deliveries || 0,
        'Total Pickups': rider.total_pickups || 0,
        'Wallet Balance': rider.wallet_balance,
        'Is Online': rider.is_online,
        'Is Active': rider.is_active,
        'Created At': rider.created_at
      })) || [];

      headers = Object.keys(data[0] || {});
      filename = `riders_export_${new Date().toISOString().split('T')[0]}.${format}`;
    }

    // =====================================================
    // EXPORT PAYOUTS
    // =====================================================
    else if (export_type === 'payouts') {
      let payoutsUrl = `${supabaseUrl}/rest/v1/payouts?select=payout_id,amount,tds_amount,net_amount,upi_id,utr_number,status,requested_at,completed_at,user_id,user_type&limit=${limit}`;

      if (from_date && to_date) {
        payoutsUrl += `&requested_at=gte.${startDateStr}&requested_at=lte.${endDateStr}`;
      }

      const payoutsResponse = await fetch(payoutsUrl, {
        headers: {
          'apikey': supabaseKey,
          'Authorization': `Bearer ${supabaseKey}`,
        },
      });
      const payouts = await payoutsResponse.json();

      data = payouts?.map(payout => ({
        'Payout ID': payout.payout_id,
        'User ID': payout.user_id,
        'User Type': payout.user_type,
        'Amount': payout.amount,
        'TDS Amount': payout.tds_amount || 0,
        'Net Amount': payout.net_amount || payout.amount,
        'UPI ID': payout.upi_id,
        'UTR Number': payout.utr_number || '',
        'Status': payout.status,
        'Requested At': payout.requested_at,
        'Completed At': payout.completed_at || ''
      })) || [];

      headers = Object.keys(data[0] || {});
      filename = `payouts_export_${startDateStr.split('T')[0]}_${endDateStr.split('T')[0]}.${format}`;
    }

    // =====================================================
    // EXPORT RTO
    // =====================================================
    else if (export_type === 'rto') {
      const rtoSelect = `book_id,final_amount,cancel_reason,cancelled_at,customers!inner(name,mobile),sellers!inner(shop_name)`;
      const rtoUrl = `${supabaseUrl}/rest/v1/orders?select=${encodeURIComponent(rtoSelect)}&status=eq.RTO&cancelled_at=gte.${startDateStr}&cancelled_at=lte.${endDateStr}&limit=${limit}`;
      const rtoResponse = await fetch(rtoUrl, {
        headers: {
          'apikey': supabaseKey,
          'Authorization': `Bearer ${supabaseKey}`,
        },
      });
      const rtoOrders = await rtoResponse.json();

      data = rtoOrders?.map(order => ({
        'Order ID': order.book_id,
        'Amount': order.final_amount,
        'Reason': order.cancel_reason || '',
        'Customer Name': order.customers?.name,
        'Customer Mobile': order.customers?.mobile,
        'Seller Name': order.sellers?.shop_name,
        'RTO Date': order.cancelled_at
      })) || [];

      headers = Object.keys(data[0] || {});
      filename = `rto_export_${startDateStr.split('T')[0]}_${endDateStr.split('T')[0]}.${format}`;
    }

    else {
      return new Response(JSON.stringify({ success: false, error: 'Invalid export type' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json', ...corsHeaders }
      });
    }

    // =====================================================
    // GENERATE CSV
    // =====================================================
    if (format === 'csv') {
      const csvRows = [];

      if (headers.length > 0) {
        csvRows.push(headers.join(','));
      } else if (data.length > 0) {
        csvRows.push(Object.keys(data[0]).join(','));
      }

      for (const row of data) {
        const values = Object.values(row).map(value => {
          if (value === null || value === undefined) return '';
          if (typeof value === 'object') return JSON.stringify(value).replace(/,/g, ';');
          return String(value).replace(/,/g, ' ');
        });
        csvRows.push(values.join(','));
      }

      const csvString = csvRows.join('\n');
      return new Response(csvString, {
        status: 200,
        headers: {
          'Content-Type': 'text/csv',
          'Content-Disposition': `attachment; filename=${filename}`,
          ...corsHeaders
        }
      });
    }

    // =====================================================
    // GENERATE JSON
    // =====================================================
    return new Response(JSON.stringify({
      success: true,
      export_type: export_type,
      generated_at: new Date().toISOString(),
      total_records: data.length,
      data: data
    }), {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        'Content-Disposition': `attachment; filename=${filename.replace('.csv', '.json')}`,
        ...corsHeaders
      }
    });

  } catch (error) {
    console.error('Export error:', error);
    return new Response(JSON.stringify({
      success: false,
      error: error.message || 'Internal server error'
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json', ...corsHeaders }
    });
  }
}