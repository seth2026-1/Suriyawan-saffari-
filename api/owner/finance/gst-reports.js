// api/owner/finance/gst-reports.js
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
            gte: (gteField, gteValue) => ({
              lte: (lteField, lteValue) => ({
                select: async () => {
                  const finalUrl = `${url}&${field}=eq.${value}&${gteField}=gte.${gteValue}&${lteField}=lte.${lteValue}`;
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
            is: (isField, isValue) => ({
              gte: (gteField, gteValue) => ({
                lte: (lteField, lteValue) => ({
                  select: async () => {
                    const finalUrl = `${url}&${field}=eq.${value}&${isField}=is.${isValue}&${gteField}=gte.${gteValue}&${lteField}=lte.${lteValue}`;
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
            gte: (gteField, gteValue) => ({
              lte: (lteField, lteValue) => ({
                select: async () => {
                  const finalUrl = `${url}&${field}=eq.${value}&${gteField}=gte.${gteValue}&${lteField}=lte.${lteValue}`;
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
            is: (isField, isValue) => ({
              gte: (gteField, gteValue) => ({
                lte: (lteField, lteValue) => ({
                  select: async () => {
                    const finalUrl = `${url}&${field}=eq.${value}&${isField}=is.${isValue}&${gteField}=gte.${gteValue}&${lteField}=lte.${lteValue}`;
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
    const month = url.searchParams.get('month');
    const year = url.searchParams.get('year');
    const return_type = url.searchParams.get('return_type') || 'GSTR1';
    const seller_id = url.searchParams.get('seller_id');
    const export_format = url.searchParams.get('export_format') || 'json';
    const page = parseInt(url.searchParams.get('page') || '1');
    const limit = parseInt(url.searchParams.get('limit') || '100');

    const targetMonth = month ? parseInt(month) : new Date().getMonth() + 1;
    const targetYear = year ? parseInt(year) : new Date().getFullYear();

    const startDate = `${targetYear}-${String(targetMonth).padStart(2, '0')}-01`;
    const endDate = new Date(targetYear, targetMonth, 0).toISOString().split('T')[0];

    const supabase = createSupabaseClient();
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

    // Get GST settings
    const settingsUrl = `${supabaseUrl}/rest/v1/system_settings?setting_key=in.(gst_percentage,gst_type,gst_state_code)&select=setting_key,setting_value`;
    const settingsResponse = await fetch(settingsUrl, {
      headers: {
        'apikey': supabaseKey,
        'Authorization': `Bearer ${supabaseKey}`,
      },
    });
    const settings = await settingsResponse.json();

    const gstPercentage = parseInt(settings.find(s => s.setting_key === 'gst_percentage')?.setting_value || 18);
    const gstType = settings.find(s => s.setting_key === 'gst_type')?.setting_value || 'regular';
    const gstStateCode = settings.find(s => s.setting_key === 'gst_state_code')?.setting_value || '09';

    // =====================================================
    // GET B2B INVOICES (Business to Business - Customers with GST)
    // =====================================================
    const b2bSelect = `book_id,invoice_id,final_amount,gst_amount,cgst_amount,sgst_amount,igst_amount,placed_at,delivered_at,customers!inner(cust_id,name,email,gst_number,address),sellers!inner(seller_id,shop_name,gst_number as seller_gst,email as seller_email),order_items!inner(quantity,price_at_time,products!inner(prod_id,name,hsn_code,gst_percentage))`;
    let b2bUrl = `${supabaseUrl}/rest/v1/orders?select=${encodeURIComponent(b2bSelect)}&status=eq.DELIVERED&delivered_at=gte.${startDate}T00:00:00&delivered_at=lte.${endDate}T23:59:59&customers.gst_number=not.is.null`;

    if (seller_id) {
      b2bUrl += `&seller_id=eq.${seller_id}`;
    }

    const b2bResponse = await fetch(b2bUrl, {
      headers: {
        'apikey': supabaseKey,
        'Authorization': `Bearer ${supabaseKey}`,
      },
    });
    const b2bInvoices = await b2bResponse.json();

    // =====================================================
    // GET B2C INVOICES (Business to Consumer - Customers without GST)
    // =====================================================
    let b2cUrl = `${supabaseUrl}/rest/v1/orders?select=${encodeURIComponent(b2bSelect)}&status=eq.DELIVERED&delivered_at=gte.${startDate}T00:00:00&delivered_at=lte.${endDate}T23:59:59&customers.gst_number=is.null`;

    if (seller_id) {
      b2cUrl += `&seller_id=eq.${seller_id}`;
    }

    const b2cResponse = await fetch(b2cUrl, {
      headers: {
        'apikey': supabaseKey,
        'Authorization': `Bearer ${supabaseKey}`,
      },
    });
    const b2cInvoices = await b2cResponse.json();

    // =====================================================
    // GET HSN WISE SUMMARY
    // =====================================================
    const allItems = [...(b2bInvoices || []), ...(b2cInvoices || [])];
    const hsnSummary = {};

    allItems.forEach(order => {
      (order.order_items || []).forEach(item => {
        const hsnCode = item.products?.hsn_code || '9983';
        const taxableValue = item.price_at_time * item.quantity;
        const gstRate = item.products?.gst_percentage || gstPercentage;
        const cgst = (taxableValue * gstRate) / 200;
        const sgst = (taxableValue * gstRate) / 200;
        const igst = (taxableValue * gstRate) / 100;

        if (!hsnSummary[hsnCode]) {
          hsnSummary[hsnCode] = {
            hsn_code: hsnCode,
            description: item.products?.name?.substring(0, 100),
            uqc: 'NOS',
            total_quantity: 0,
            total_taxable_value: 0,
            total_cgst: 0,
            total_sgst: 0,
            total_igst: 0,
            total_cess: 0
          };
        }
        hsnSummary[hsnCode].total_quantity += item.quantity;
        hsnSummary[hsnCode].total_taxable_value += taxableValue;
        hsnSummary[hsnCode].total_cgst += cgst;
        hsnSummary[hsnCode].total_sgst += sgst;
        hsnSummary[hsnCode].total_igst += igst;
      });
    });

    // Calculate totals for summary
    const totalInvoices = (b2bInvoices?.length || 0) + (b2cInvoices?.length || 0);
    const totalTaxableValue = allItems.reduce((sum, order) => sum + (order.final_amount || 0), 0);
    const totalGstAmount = allItems.reduce((sum, order) => sum + (order.gst_amount || 0), 0);
    const totalCgst = allItems.reduce((sum, order) => sum + (order.cgst_amount || 0), 0);
    const totalSgst = allItems.reduce((sum, order) => sum + (order.sgst_amount || 0), 0);
    const totalIgst = allItems.reduce((sum, order) => sum + (order.igst_amount || 0), 0);
    const totalOutwardSupply = totalTaxableValue;
    const totalOutwardTax = totalGstAmount;

    // Get seller-wise GST summary
    const sellerWiseGST = {};
    allItems.forEach(order => {
      const sellerId = order.sellers?.seller_id;
      if (sellerId) {
        if (!sellerWiseGST[sellerId]) {
          sellerWiseGST[sellerId] = {
            seller_id: sellerId,
            shop_name: order.sellers?.shop_name,
            gst_number: order.sellers?.seller_gst,
            total_sales: 0,
            total_gst: 0,
            total_cgst: 0,
            total_sgst: 0,
            invoice_count: 0
          };
        }
        sellerWiseGST[sellerId].total_sales += order.final_amount || 0;
        sellerWiseGST[sellerId].total_gst += order.gst_amount || 0;
        sellerWiseGST[sellerId].total_cgst += order.cgst_amount || 0;
        sellerWiseGST[sellerId].total_sgst += order.sgst_amount || 0;
        sellerWiseGST[sellerId].invoice_count++;
      }
    });

    // =====================================================
    // PREPARE GSTR1 DATA
    // =====================================================
    const gstr1 = {
      gstin: `${gstStateCode}XXXXXXXXXXXXX`,
      fp: `${targetYear}${String(targetMonth).padStart(2, '0')}`,
      version: 'GST1.0',
      b2b: (b2bInvoices || []).map(order => ({
        ctin: order.customers?.gst_number || 'URP',
        cfs: 'Y',
        cfs_type: 'OE',
        inv: [{
          inum: order.invoice_id || order.book_id,
          idt: order.delivered_at?.split('T')[0],
          val: order.final_amount,
          pos: gstStateCode,
          rchrg: 'N',
          inv_typ: 'R',
          itms: (order.order_items || []).map(item => ({
            num: item.quantity,
            itm_det: {
              txval: item.price_at_time * item.quantity,
              rt: item.products?.gst_percentage || gstPercentage,
              camt: (item.price_at_time * item.quantity * (item.products?.gst_percentage || gstPercentage)) / 200,
              samt: (item.price_at_time * item.quantity * (item.products?.gst_percentage || gstPercentage)) / 200,
              iamt: 0,
              csamt: 0
            }
          }))
        }]
      })),
      b2cl: (b2cInvoices || []).map(order => ({
        pos: gstStateCode,
        inv: [{
          inum: order.invoice_id || order.book_id,
          idt: order.delivered_at?.split('T')[0],
          val: order.final_amount,
          itms: (order.order_items || []).map(item => ({
            num: item.quantity,
            itm_det: {
              txval: item.price_at_time * item.quantity,
              rt: item.products?.gst_percentage || gstPercentage,
              camt: (item.price_at_time * item.quantity * (item.products?.gst_percentage || gstPercentage)) / 200,
              samt: (item.price_at_time * item.quantity * (item.products?.gst_percentage || gstPercentage)) / 200,
              iamt: 0,
              csamt: 0
            }
          }))
        }]
      })),
      hsn: Object.values(hsnSummary).map(hsn => ({
        hsn_sc: hsn.hsn_code,
        desc: hsn.description,
        uqc: hsn.uqc,
        qty: hsn.total_quantity,
        val: Math.round(hsn.total_taxable_value),
        txval: Math.round(hsn.total_taxable_value),
        iamt: Math.round(hsn.total_igst),
        camt: Math.round(hsn.total_cgst),
        samt: Math.round(hsn.total_sgst),
        csamt: Math.round(hsn.total_cess)
      }))
    };

    // =====================================================
    // PREPARE GSTR3B DATA
    // =====================================================
    const gstr3b = {
      gstin: `${gstStateCode}XXXXXXXXXXXXX`,
      fp: `${targetYear}${String(targetMonth).padStart(2, '0')}`,
      version: 'GST3B1.0',
      summary: {
        outward_supply: {
          total_taxable_value: Math.round(totalOutwardSupply),
          total_tax: Math.round(totalOutwardTax),
          cgst: Math.round(totalCgst),
          sgst: Math.round(totalSgst),
          igst: Math.round(totalIgst),
          cess: 0
        },
        inward_supply: {
          total_taxable_value: 0,
          total_tax: 0,
          cgst: 0,
          sgst: 0,
          igst: 0,
          cess: 0
        },
        net_tax_payable: {
          cgst: Math.round(totalCgst),
          sgst: Math.round(totalSgst),
          igst: Math.round(totalIgst),
          cess: 0
        }
      }
    };

    // If export format is CSV
    if (export_format === 'csv') {
      let csvData = [];

      if (return_type === 'GSTR1') {
        csvData.push(['Invoice No', 'Invoice Date', 'Customer Name', 'Customer GST', 'Taxable Value', 'CGST', 'SGST', 'IGST', 'Total']);
        (b2bInvoices || []).forEach(order => {
          csvData.push([
            order.invoice_id || order.book_id,
            order.delivered_at?.split('T')[0],
            order.customers?.name,
            order.customers?.gst_number || 'URP',
            (order.final_amount || 0).toString(),
            (order.cgst_amount || 0).toFixed(2),
            (order.sgst_amount || 0).toFixed(2),
            (order.igst_amount || 0).toFixed(2),
            ((order.final_amount || 0) + (order.gst_amount || 0)).toFixed(2)
          ]);
        });
      } else if (return_type === 'GSTR3B') {
        csvData.push(['Particulars', 'Taxable Value', 'CGST', 'SGST', 'IGST', 'Cess']);
        csvData.push(['Outward Supply', totalOutwardSupply.toString(), totalCgst.toFixed(2), totalSgst.toFixed(2), totalIgst.toFixed(2), '0']);
        csvData.push(['Net Tax Payable', '0', totalCgst.toFixed(2), totalSgst.toFixed(2), totalIgst.toFixed(2), '0']);
      } else if (return_type === 'HSN') {
        csvData.push(['HSN Code', 'Description', 'UQC', 'Quantity', 'Taxable Value', 'CGST', 'SGST', 'IGST']);
        Object.values(hsnSummary).forEach(hsn => {
          csvData.push([
            hsn.hsn_code,
            hsn.description || '',
            hsn.uqc,
            hsn.total_quantity.toString(),
            hsn.total_taxable_value.toFixed(2),
            hsn.total_cgst.toFixed(2),
            hsn.total_sgst.toFixed(2),
            hsn.total_igst.toFixed(2)
          ]);
        });
      }

      const csvString = csvData.map(row => row.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(',')).join('\n');
      return new Response(csvString, {
        status: 200,
        headers: {
          'Content-Type': 'text/csv',
          'Content-Disposition': `attachment; filename=gst_${return_type}_${targetYear}_${targetMonth}.csv`,
          ...corsHeaders
        }
      });
    }

    return new Response(JSON.stringify({
      success: true,
      report_type: return_type,
      period: {
        month: targetMonth,
        year: targetYear,
        from: startDate,
        to: endDate
      },
      settings: {
        gst_percentage: gstPercentage,
        gst_type: gstType,
        gst_state_code: gstStateCode
      },
      summary: {
        total_invoices: totalInvoices,
        total_taxable_value: Math.round(totalTaxableValue),
        total_gst_amount: Math.round(totalGstAmount),
        total_cgst: Math.round(totalCgst),
        total_sgst: Math.round(totalSgst),
        total_igst: Math.round(totalIgst),
        b2b_count: b2bInvoices?.length || 0,
        b2c_count: b2cInvoices?.length || 0
      },
      seller_wise_summary: Object.values(sellerWiseGST),
      gstr1: gstr1,
      gstr3b: gstr3b,
      hsn_summary: Object.values(hsnSummary),
      export_links: {
        csv_gstr1: `/api/owner/finance/gst-reports?month=${targetMonth}&year=${targetYear}&return_type=GSTR1&export_format=csv`,
        csv_gstr3b: `/api/owner/finance/gst-reports?month=${targetMonth}&year=${targetYear}&return_type=GSTR3B&export_format=csv`,
        csv_hsn: `/api/owner/finance/gst-reports?month=${targetMonth}&year=${targetYear}&return_type=HSN&export_format=csv`
      },
      generated_at: new Date().toISOString()
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json', ...corsHeaders }
    });

  } catch (error) {
    console.error('GST reports error:', error);
    return new Response(JSON.stringify({
      success: false,
      error: error.message || 'Internal server error'
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json', ...corsHeaders }
    });
  }
}