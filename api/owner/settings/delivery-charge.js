// api/owner/settings/delivery-charge.js
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
          in: (field, values) => ({
            select: async () => {
              const finalUrl = `${url}&${field}=in.(${values.join(',')})`;
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
            select: async () => {
              const finalUrl = `${url}&${field}=eq.${value}`;
              const response = await fetch(finalUrl, {
                headers: {
                  'apikey': supabaseKey,
                  'Authorization': `Bearer ${supabaseKey}`,
                },
              });
              const data = await response.json();
              return { data, error: null };
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
          }),
          order: (orderField, { ascending }) => ({
            select: async () => {
              const sortOrder = ascending ? 'asc' : 'desc';
              const finalUrl = `${url}&order=${orderField}.${sortOrder}`;
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
      upsert: (data) => ({
        select: async () => {
          const response = await fetch(`${supabaseUrl}/rest/v1/${table}`, {
            method: 'POST',
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
  };
}

export default async function handler(request) {
  // CORS Headers
  const corsHeaders = {
    'Access-Control-Allow-Credentials': 'true',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, PUT, POST, DELETE, OPTIONS',
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
  // GET DELIVERY CHARGE SETTINGS
  // =====================================================
  if (request.method === 'GET') {
    try {
      const settingsKeys = [
        'delivery_charge',
        'free_delivery_min',
        'delivery_charge_pincode_based',
        'delivery_charge_by_weight',
        'delivery_charge_weight_slab_1',
        'delivery_charge_weight_slab_2',
        'delivery_charge_weight_slab_3',
        'delivery_charge_same_city',
        'delivery_charge_other_city',
        'delivery_charge_remote_area',
        'delivery_time_slot_enabled',
        'delivery_time_slot_1_start',
        'delivery_time_slot_1_end',
        'delivery_time_slot_2_start',
        'delivery_time_slot_2_end',
        'delivery_time_slot_3_start',
        'delivery_time_slot_3_end',
        'max_delivery_distance_km',
        'delivery_charge_per_extra_km'
      ];

      const settingsUrl = `${supabaseUrl}/rest/v1/system_settings?setting_key=in.(${settingsKeys.join(',')})&select=*`;
      const settingsResponse = await fetch(settingsUrl, {
        headers: {
          'apikey': supabaseKey,
          'Authorization': `Bearer ${supabaseKey}`,
        },
      });
      const settings = await settingsResponse.json();

      // Convert to object
      const chargeSettings = {};
      settings?.forEach(s => {
        chargeSettings[s.setting_key] = s.setting_value;
      });

      // Set default values
      const defaultSettings = {
        delivery_charge: '40',
        free_delivery_min: '499',
        delivery_charge_pincode_based: 'false',
        delivery_charge_by_weight: 'false',
        delivery_charge_weight_slab_1: '0.5,30',
        delivery_charge_weight_slab_2: '2,50',
        delivery_charge_weight_slab_3: '5,80',
        delivery_charge_same_city: '30',
        delivery_charge_other_city: '60',
        delivery_charge_remote_area: '100',
        delivery_time_slot_enabled: 'true',
        delivery_time_slot_1_start: '09:00',
        delivery_time_slot_1_end: '12:00',
        delivery_time_slot_2_start: '12:00',
        delivery_time_slot_2_end: '15:00',
        delivery_time_slot_3_start: '15:00',
        delivery_time_slot_3_end: '18:00',
        max_delivery_distance_km: '50',
        delivery_charge_per_extra_km: '5'
      };

      const mergedSettings = { ...defaultSettings, ...chargeSettings };

      // Get pincode-based delivery charges
      let pincodeCharges = [];
      if (mergedSettings.delivery_charge_pincode_based === 'true') {
        const pincodeUrl = `${supabaseUrl}/rest/v1/delivery_charges?select=*&is_active=eq.true&order=pincode.asc`;
        const pincodeResponse = await fetch(pincodeUrl, {
          headers: {
            'apikey': supabaseKey,
            'Authorization': `Bearer ${supabaseKey}`,
          },
        });
        const pincodeData = await pincodeResponse.json();
        pincodeCharges = pincodeData || [];
      }

      // Parse weight slabs
      const weightSlabs = [
        { max_weight: 0.5, charge: 30 },
        { max_weight: 2, charge: 50 },
        { max_weight: 5, charge: 80 }
      ];

      if (mergedSettings.delivery_charge_weight_slab_1) {
        const [weight, charge] = mergedSettings.delivery_charge_weight_slab_1.split(',');
        weightSlabs[0] = { max_weight: parseFloat(weight), charge: parseInt(charge) };
      }
      if (mergedSettings.delivery_charge_weight_slab_2) {
        const [weight, charge] = mergedSettings.delivery_charge_weight_slab_2.split(',');
        weightSlabs[1] = { max_weight: parseFloat(weight), charge: parseInt(charge) };
      }
      if (mergedSettings.delivery_charge_weight_slab_3) {
        const [weight, charge] = mergedSettings.delivery_charge_weight_slab_3.split(',');
        weightSlabs[2] = { max_weight: parseFloat(weight), charge: parseInt(charge) };
      }

      // Get time slots
      const timeSlots = [];
      if (mergedSettings.delivery_time_slot_enabled === 'true') {
        if (mergedSettings.delivery_time_slot_1_start) {
          timeSlots.push({
            start: mergedSettings.delivery_time_slot_1_start,
            end: mergedSettings.delivery_time_slot_1_end,
            slot: 'Morning'
          });
        }
        if (mergedSettings.delivery_time_slot_2_start) {
          timeSlots.push({
            start: mergedSettings.delivery_time_slot_2_start,
            end: mergedSettings.delivery_time_slot_2_end,
            slot: 'Afternoon'
          });
        }
        if (mergedSettings.delivery_time_slot_3_start) {
          timeSlots.push({
            start: mergedSettings.delivery_time_slot_3_start,
            end: mergedSettings.delivery_time_slot_3_end,
            slot: 'Evening'
          });
        }
      }

      return new Response(JSON.stringify({
        success: true,
        settings: mergedSettings,
        weight_slabs: weightSlabs,
        time_slots: timeSlots,
        pincode_charges: pincodeCharges
      }), {
        status: 200,
        headers: { 'Content-Type': 'application/json', ...corsHeaders }
      });

    } catch (error) {
      console.error('Get delivery charge settings error:', error);
      return new Response(JSON.stringify({ success: false, error: error.message }), {
        status: 500,
        headers: { 'Content-Type': 'application/json', ...corsHeaders }
      });
    }
  }

  // =====================================================
  // UPDATE DELIVERY CHARGE SETTINGS (PUT)
  // =====================================================
  if (request.method === 'PUT') {
    try {
      const body = await request.json();
      const type = body.type;

      if (type === 'global') {
        const {
          delivery_charge,
          free_delivery_min,
          delivery_charge_pincode_based,
          delivery_charge_by_weight,
          delivery_charge_weight_slab_1,
          delivery_charge_weight_slab_2,
          delivery_charge_weight_slab_3,
          delivery_charge_same_city,
          delivery_charge_other_city,
          delivery_charge_remote_area,
          delivery_time_slot_enabled,
          delivery_time_slot_1_start,
          delivery_time_slot_1_end,
          delivery_time_slot_2_start,
          delivery_time_slot_2_end,
          delivery_time_slot_3_start,
          delivery_time_slot_3_end,
          max_delivery_distance_km,
          delivery_charge_per_extra_km
        } = body;

        const updates = [];

        // Validation
        if (delivery_charge !== undefined && parseInt(delivery_charge) < 0) {
          return new Response(JSON.stringify({ success: false, error: 'Delivery charge cannot be negative' }), {
            status: 400,
            headers: { 'Content-Type': 'application/json', ...corsHeaders }
          });
        }
        if (free_delivery_min !== undefined && parseInt(free_delivery_min) < 0) {
          return new Response(JSON.stringify({ success: false, error: 'Free delivery minimum cannot be negative' }), {
            status: 400,
            headers: { 'Content-Type': 'application/json', ...corsHeaders }
          });
        }
        if (max_delivery_distance_km !== undefined && parseInt(max_delivery_distance_km) < 0) {
          return new Response(JSON.stringify({ success: false, error: 'Maximum delivery distance cannot be negative' }), {
            status: 400,
            headers: { 'Content-Type': 'application/json', ...corsHeaders }
          });
        }

        if (delivery_charge !== undefined) updates.push({ setting_key: 'delivery_charge', setting_value: String(delivery_charge) });
        if (free_delivery_min !== undefined) updates.push({ setting_key: 'free_delivery_min', setting_value: String(free_delivery_min) });
        if (delivery_charge_pincode_based !== undefined) updates.push({ setting_key: 'delivery_charge_pincode_based', setting_value: delivery_charge_pincode_based });
        if (delivery_charge_by_weight !== undefined) updates.push({ setting_key: 'delivery_charge_by_weight', setting_value: delivery_charge_by_weight });
        if (delivery_charge_weight_slab_1 !== undefined) updates.push({ setting_key: 'delivery_charge_weight_slab_1', setting_value: delivery_charge_weight_slab_1 });
        if (delivery_charge_weight_slab_2 !== undefined) updates.push({ setting_key: 'delivery_charge_weight_slab_2', setting_value: delivery_charge_weight_slab_2 });
        if (delivery_charge_weight_slab_3 !== undefined) updates.push({ setting_key: 'delivery_charge_weight_slab_3', setting_value: delivery_charge_weight_slab_3 });
        if (delivery_charge_same_city !== undefined) updates.push({ setting_key: 'delivery_charge_same_city', setting_value: String(delivery_charge_same_city) });
        if (delivery_charge_other_city !== undefined) updates.push({ setting_key: 'delivery_charge_other_city', setting_value: String(delivery_charge_other_city) });
        if (delivery_charge_remote_area !== undefined) updates.push({ setting_key: 'delivery_charge_remote_area', setting_value: String(delivery_charge_remote_area) });
        if (delivery_time_slot_enabled !== undefined) updates.push({ setting_key: 'delivery_time_slot_enabled', setting_value: delivery_time_slot_enabled });
        if (delivery_time_slot_1_start !== undefined) updates.push({ setting_key: 'delivery_time_slot_1_start', setting_value: delivery_time_slot_1_start });
        if (delivery_time_slot_1_end !== undefined) updates.push({ setting_key: 'delivery_time_slot_1_end', setting_value: delivery_time_slot_1_end });
        if (delivery_time_slot_2_start !== undefined) updates.push({ setting_key: 'delivery_time_slot_2_start', setting_value: delivery_time_slot_2_start });
        if (delivery_time_slot_2_end !== undefined) updates.push({ setting_key: 'delivery_time_slot_2_end', setting_value: delivery_time_slot_2_end });
        if (delivery_time_slot_3_start !== undefined) updates.push({ setting_key: 'delivery_time_slot_3_start', setting_value: delivery_time_slot_3_start });
        if (delivery_time_slot_3_end !== undefined) updates.push({ setting_key: 'delivery_time_slot_3_end', setting_value: delivery_time_slot_3_end });
        if (max_delivery_distance_km !== undefined) updates.push({ setting_key: 'max_delivery_distance_km', setting_value: String(max_delivery_distance_km) });
        if (delivery_charge_per_extra_km !== undefined) updates.push({ setting_key: 'delivery_charge_per_extra_km', setting_value: String(delivery_charge_per_extra_km) });

        for (const update of updates) {
          await fetch(`${supabaseUrl}/rest/v1/system_settings`, {
            method: 'POST',
            headers: {
              'apikey': supabaseKey,
              'Authorization': `Bearer ${supabaseKey}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              setting_key: update.setting_key,
              setting_value: update.setting_value,
              updated_at: new Date().toISOString(),
              updated_by: 'OWN001'
            })
          });
        }

        return new Response(JSON.stringify({
          success: true,
          message: 'Delivery charge settings updated successfully',
          updated_fields: updates.map(u => u.setting_key)
        }), {
          status: 200,
          headers: { 'Content-Type': 'application/json', ...corsHeaders }
        });
      }

      return new Response(JSON.stringify({ success: false, error: 'Invalid type parameter' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json', ...corsHeaders }
      });

    } catch (error) {
      console.error('Update delivery charge settings error:', error);
      return new Response(JSON.stringify({ success: false, error: error.message }), {
        status: 500,
        headers: { 'Content-Type': 'application/json', ...corsHeaders }
      });
    }
  }

  // =====================================================
  // ADD/UPDATE PINCODE DELIVERY CHARGE (POST)
  // =====================================================
  if (request.method === 'POST') {
    try {
      const body = await request.json();
      const { pincode, delivery_charge, estimated_days, is_active } = body;

      if (!pincode) {
        return new Response(JSON.stringify({ success: false, error: 'Pincode is required' }), {
          status: 400,
          headers: { 'Content-Type': 'application/json', ...corsHeaders }
        });
      }

      if (delivery_charge !== undefined && parseInt(delivery_charge) < 0) {
        return new Response(JSON.stringify({ success: false, error: 'Delivery charge cannot be negative' }), {
          status: 400,
          headers: { 'Content-Type': 'application/json', ...corsHeaders }
        });
      }

      // Check if exists
      const existingUrl = `${supabaseUrl}/rest/v1/delivery_charges?pincode=eq.${pincode}&select=id`;
      const existingResponse = await fetch(existingUrl, {
        headers: {
          'apikey': supabaseKey,
          'Authorization': `Bearer ${supabaseKey}`,
        },
      });
      const existingData = await existingResponse.json();
      const existing = existingData[0];

      let result;
      if (existing) {
        const updateResult = await supabase
          .from('delivery_charges')
          .update({
            delivery_charge: delivery_charge,
            estimated_days: estimated_days,
            is_active: is_active !== undefined ? is_active : true,
            updated_at: new Date().toISOString()
          })
          .eq('pincode', pincode)
          .select();

        if (updateResult.error) throw updateResult.error;
        result = updateResult.data;
      } else {
        const insertResult = await supabase
          .from('delivery_charges')
          .insert({
            pincode,
            delivery_charge: delivery_charge || 40,
            estimated_days: estimated_days || 3,
            is_active: true,
            created_at: new Date().toISOString()
          })
          .select();

        if (insertResult.error) throw insertResult.error;
        result = insertResult.data;
      }

      return new Response(JSON.stringify({
        success: true,
        message: 'Pincode delivery charge saved successfully',
        data: result
      }), {
        status: 200,
        headers: { 'Content-Type': 'application/json', ...corsHeaders }
      });

    } catch (error) {
      console.error('Save pincode delivery charge error:', error);
      return new Response(JSON.stringify({ success: false, error: error.message }), {
        status: 500,
        headers: { 'Content-Type': 'application/json', ...corsHeaders }
      });
    }
  }

  // =====================================================
  // DELETE PINCODE DELIVERY CHARGE (DELETE)
  // =====================================================
  if (request.method === 'DELETE') {
    try {
      const url = new URL(request.url);
      const pincode = url.searchParams.get('pincode');

      if (!pincode) {
        return new Response(JSON.stringify({ success: false, error: 'Pincode is required' }), {
          status: 400,
          headers: { 'Content-Type': 'application/json', ...corsHeaders }
        });
      }

      await fetch(`${supabaseUrl}/rest/v1/delivery_charges?pincode=eq.${pincode}`, {
        method: 'DELETE',
        headers: {
          'apikey': supabaseKey,
          'Authorization': `Bearer ${supabaseKey}`,
        },
      });

      return new Response(JSON.stringify({
        success: true,
        message: 'Pincode delivery charge deleted successfully'
      }), {
        status: 200,
        headers: { 'Content-Type': 'application/json', ...corsHeaders }
      });

    } catch (error) {
      console.error('Delete pincode delivery charge error:', error);
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