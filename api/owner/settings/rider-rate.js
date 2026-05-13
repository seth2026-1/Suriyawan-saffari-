// api/owner/settings/rider-rate.js
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
    'Access-Control-Allow-Methods': 'GET, PUT, POST, OPTIONS',
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
  // GET RIDER RATE SETTINGS
  // =====================================================
  if (request.method === 'GET') {
    try {
      const settingsKeys = [
        'rider_rate_per_parcel',
        'rider_pickup_rate',
        'rider_service_rate',
        'rider_incentive_enabled',
        'rider_incentive_min_deliveries',
        'rider_incentive_bonus',
        'rider_incentive_weekend_multiplier',
        'rider_incentive_night_multiplier',
        'rider_rating_bonus_enabled',
        'rider_rating_4_bonus',
        'rider_rating_5_bonus',
        'rider_fuel_reimbursement_rate',
        'rider_max_daily_hours',
        'rider_overtime_rate',
        'minimum_payout_amount_rider'
      ];

      const settingsUrl = `${supabaseUrl}/rest/v1/system_settings?setting_key=in.(${settingsKeys.join(',')})&select=*`;
      const settingsResponse = await fetch(settingsUrl, {
        headers: {
          'apikey': supabaseKey,
          'Authorization': `Bearer ${supabaseKey}`,
        },
      });
      const globalSettings = await settingsResponse.json();

      // Convert to object
      const riderSettings = {};
      globalSettings?.forEach(s => {
        riderSettings[s.setting_key] = s.setting_value;
      });

      // Set default values
      const defaultSettings = {
        rider_rate_per_parcel: '18',
        rider_pickup_rate: '10',
        rider_service_rate: '50',
        rider_incentive_enabled: 'true',
        rider_incentive_min_deliveries: '30',
        rider_incentive_bonus: '100',
        rider_incentive_weekend_multiplier: '1.2',
        rider_incentive_night_multiplier: '1.5',
        rider_rating_bonus_enabled: 'true',
        rider_rating_4_bonus: '50',
        rider_rating_5_bonus: '100',
        rider_fuel_reimbursement_rate: '2',
        rider_max_daily_hours: '8',
        rider_overtime_rate: '25',
        minimum_payout_amount_rider: '100'
      };

      const mergedSettings = { ...defaultSettings, ...riderSettings };

      // Get rider-wise custom rates
      const ridersUrl = `${supabaseUrl}/rest/v1/riders?select=rider_id,name,rating,rate_per_parcel,pickup_rate&is_active=eq.true&order=rating.desc`;
      const ridersResponse = await fetch(ridersUrl, {
        headers: {
          'apikey': supabaseKey,
          'Authorization': `Bearer ${supabaseKey}`,
        },
      });
      const riderRates = await ridersResponse.json();

      // Define incentive tiers
      const incentiveTiers = [
        { min_deliveries: 30, bonus: 100 },
        { min_deliveries: 50, bonus: 200 },
        { min_deliveries: 100, bonus: 500 },
        { min_deliveries: 200, bonus: 1500 }
      ];

      return new Response(JSON.stringify({
        success: true,
        global_settings: mergedSettings,
        rider_rates: riderRates || [],
        incentive_tiers: {
          enabled: mergedSettings.rider_incentive_enabled === 'true',
          tiers: incentiveTiers
        },
        multipliers: {
          weekend: parseFloat(mergedSettings.rider_incentive_weekend_multiplier),
          night: parseFloat(mergedSettings.rider_incentive_night_multiplier),
          rating_4: parseInt(mergedSettings.rider_rating_4_bonus),
          rating_5: parseInt(mergedSettings.rider_rating_5_bonus)
        }
      }), {
        status: 200,
        headers: { 'Content-Type': 'application/json', ...corsHeaders }
      });

    } catch (error) {
      console.error('Get rider rate settings error:', error);
      return new Response(JSON.stringify({ success: false, error: error.message }), {
        status: 500,
        headers: { 'Content-Type': 'application/json', ...corsHeaders }
      });
    }
  }

  // =====================================================
  // UPDATE GLOBAL RIDER RATES (PUT)
  // =====================================================
  if (request.method === 'PUT') {
    try {
      const body = await request.json();
      const type = body.type;

      // UPDATE GLOBAL RIDER RATES
      if (type === 'global') {
        const {
          rider_rate_per_parcel,
          rider_pickup_rate,
          rider_service_rate,
          rider_incentive_enabled,
          rider_incentive_min_deliveries,
          rider_incentive_bonus,
          rider_incentive_weekend_multiplier,
          rider_incentive_night_multiplier,
          rider_rating_bonus_enabled,
          rider_rating_4_bonus,
          rider_rating_5_bonus,
          rider_fuel_reimbursement_rate,
          rider_max_daily_hours,
          rider_overtime_rate,
          minimum_payout_amount_rider
        } = body;

        const updates = [];

        // Validation
        if (rider_rate_per_parcel !== undefined && parseInt(rider_rate_per_parcel) < 5) {
          return new Response(JSON.stringify({ success: false, error: 'Rider rate per parcel cannot be less than ₹5' }), {
            status: 400,
            headers: { 'Content-Type': 'application/json', ...corsHeaders }
          });
        }
        if (rider_pickup_rate !== undefined && parseInt(rider_pickup_rate) < 5) {
          return new Response(JSON.stringify({ success: false, error: 'Rider pickup rate cannot be less than ₹5' }), {
            status: 400,
            headers: { 'Content-Type': 'application/json', ...corsHeaders }
          });
        }
        if (rider_max_daily_hours !== undefined && parseInt(rider_max_daily_hours) < 4) {
          return new Response(JSON.stringify({ success: false, error: 'Maximum daily hours cannot be less than 4' }), {
            status: 400,
            headers: { 'Content-Type': 'application/json', ...corsHeaders }
          });
        }
        if (minimum_payout_amount_rider !== undefined && parseInt(minimum_payout_amount_rider) < 50) {
          return new Response(JSON.stringify({ success: false, error: 'Minimum payout amount cannot be less than ₹50' }), {
            status: 400,
            headers: { 'Content-Type': 'application/json', ...corsHeaders }
          });
        }

        if (rider_rate_per_parcel !== undefined) updates.push({ setting_key: 'rider_rate_per_parcel', setting_value: String(rider_rate_per_parcel) });
        if (rider_pickup_rate !== undefined) updates.push({ setting_key: 'rider_pickup_rate', setting_value: String(rider_pickup_rate) });
        if (rider_service_rate !== undefined) updates.push({ setting_key: 'rider_service_rate', setting_value: String(rider_service_rate) });
        if (rider_incentive_enabled !== undefined) updates.push({ setting_key: 'rider_incentive_enabled', setting_value: rider_incentive_enabled });
        if (rider_incentive_min_deliveries !== undefined) updates.push({ setting_key: 'rider_incentive_min_deliveries', setting_value: String(rider_incentive_min_deliveries) });
        if (rider_incentive_bonus !== undefined) updates.push({ setting_key: 'rider_incentive_bonus', setting_value: String(rider_incentive_bonus) });
        if (rider_incentive_weekend_multiplier !== undefined) updates.push({ setting_key: 'rider_incentive_weekend_multiplier', setting_value: String(rider_incentive_weekend_multiplier) });
        if (rider_incentive_night_multiplier !== undefined) updates.push({ setting_key: 'rider_incentive_night_multiplier', setting_value: String(rider_incentive_night_multiplier) });
        if (rider_rating_bonus_enabled !== undefined) updates.push({ setting_key: 'rider_rating_bonus_enabled', setting_value: rider_rating_bonus_enabled });
        if (rider_rating_4_bonus !== undefined) updates.push({ setting_key: 'rider_rating_4_bonus', setting_value: String(rider_rating_4_bonus) });
        if (rider_rating_5_bonus !== undefined) updates.push({ setting_key: 'rider_rating_5_bonus', setting_value: String(rider_rating_5_bonus) });
        if (rider_fuel_reimbursement_rate !== undefined) updates.push({ setting_key: 'rider_fuel_reimbursement_rate', setting_value: String(rider_fuel_reimbursement_rate) });
        if (rider_max_daily_hours !== undefined) updates.push({ setting_key: 'rider_max_daily_hours', setting_value: String(rider_max_daily_hours) });
        if (rider_overtime_rate !== undefined) updates.push({ setting_key: 'rider_overtime_rate', setting_value: String(rider_overtime_rate) });
        if (minimum_payout_amount_rider !== undefined) updates.push({ setting_key: 'minimum_payout_amount_rider', setting_value: String(minimum_payout_amount_rider) });

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
          message: 'Rider rate settings updated successfully',
          updated_fields: updates.map(u => u.setting_key)
        }), {
          status: 200,
          headers: { 'Content-Type': 'application/json', ...corsHeaders }
        });
      }

      // UPDATE SPECIFIC RIDER RATE
      if (type === 'rider') {
        const { rider_id, rate_per_parcel, pickup_rate } = body;

        if (!rider_id) {
          return new Response(JSON.stringify({ success: false, error: 'Rider ID is required' }), {
            status: 400,
            headers: { 'Content-Type': 'application/json', ...corsHeaders }
          });
        }

        const updateData = { updated_at: new Date().toISOString() };
        if (rate_per_parcel !== undefined) {
          if (parseInt(rate_per_parcel) < 5) {
            return new Response(JSON.stringify({ success: false, error: 'Rate per parcel cannot be less than ₹5' }), {
              status: 400,
              headers: { 'Content-Type': 'application/json', ...corsHeaders }
            });
          }
          updateData.rate_per_parcel = rate_per_parcel;
        }
        if (pickup_rate !== undefined) {
          if (parseInt(pickup_rate) < 5) {
            return new Response(JSON.stringify({ success: false, error: 'Pickup rate cannot be less than ₹5' }), {
              status: 400,
              headers: { 'Content-Type': 'application/json', ...corsHeaders }
            });
          }
          updateData.pickup_rate = pickup_rate;
        }

        await fetch(`${supabaseUrl}/rest/v1/riders?rider_id=eq.${rider_id}`, {
          method: 'PATCH',
          headers: {
            'apikey': supabaseKey,
            'Authorization': `Bearer ${supabaseKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(updateData)
        });

        return new Response(JSON.stringify({
          success: true,
          message: 'Rider rate updated successfully',
          rider_id: rider_id,
          rate_per_parcel: rate_per_parcel,
          pickup_rate: pickup_rate
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
      console.error('Update rider rates error:', error);
      return new Response(JSON.stringify({ success: false, error: error.message }), {
        status: 500,
        headers: { 'Content-Type': 'application/json', ...corsHeaders }
      });
    }
  }

  // =====================================================
  // BULK UPDATE RIDER RATES (POST)
  // =====================================================
  if (request.method === 'POST') {
    try {
      const body = await request.json();
      const type = body.type;

      if (type === 'bulk') {
        const { riders } = body;

        if (!riders || !Array.isArray(riders)) {
          return new Response(JSON.stringify({ success: false, error: 'Riders array is required' }), {
            status: 400,
            headers: { 'Content-Type': 'application/json', ...corsHeaders }
          });
        }

        const results = { success: 0, failed: 0 };

        for (const rider of riders) {
          const updateData = { updated_at: new Date().toISOString() };
          if (rider.rate_per_parcel) updateData.rate_per_parcel = rider.rate_per_parcel;
          if (rider.pickup_rate) updateData.pickup_rate = rider.pickup_rate;

          const response = await fetch(`${supabaseUrl}/rest/v1/riders?rider_id=eq.${rider.rider_id}`, {
            method: 'PATCH',
            headers: {
              'apikey': supabaseKey,
              'Authorization': `Bearer ${supabaseKey}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify(updateData)
          });

          if (response.ok) {
            results.success++;
          } else {
            results.failed++;
          }
        }

        return new Response(JSON.stringify({
          success: true,
          message: `Updated ${results.success} riders, ${results.failed} failed`,
          results: results
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
      console.error('Bulk update rider rates error:', error);
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