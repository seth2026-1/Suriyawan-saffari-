// api/logistics/rider/attendance.js
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
    'Access-Control-Allow-Methods': 'GET, POST, PUT, OPTIONS',
    'Access-Control-Allow-Headers': 'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version, Authorization',
  };

  // Handle OPTIONS preflight
  if (request.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: corsHeaders });
  }

  const url = new URL(request.url);

  // =====================================================
  // GET ATTENDANCE RECORDS
  // =====================================================
  if (request.method === 'GET') {
    try {
      const rider_id = url.searchParams.get('rider_id');
      const month = url.searchParams.get('month');
      const year = url.searchParams.get('year');
      const page = parseInt(url.searchParams.get('page') || '1');
      const limit = parseInt(url.searchParams.get('limit') || '30');

      if (!rider_id) {
        return new Response(JSON.stringify({ success: false, error: 'Rider ID is required' }), {
          status: 400,
          headers: { 'Content-Type': 'application/json', ...corsHeaders }
        });
      }

      const supabase = createSupabaseClient();
      const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
      const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

      const targetMonth = month ? parseInt(month) : new Date().getMonth() + 1;
      const targetYear = year ? parseInt(year) : new Date().getFullYear();

      // Get attendance records for the month
      const attendanceUrl = `${supabaseUrl}/rest/v1/rider_attendance?select=*&rider_id=eq.${rider_id}&month=eq.${targetMonth}&year=eq.${targetYear}&order=date.asc`;
      const attendanceResponse = await fetch(attendanceUrl, {
        headers: {
          'apikey': supabaseKey,
          'Authorization': `Bearer ${supabaseKey}`,
        },
      });
      const attendance = await attendanceResponse.json();

      // Get attendance statistics
      const allAttendanceUrl = `${supabaseUrl}/rest/v1/rider_attendance?select=status,date&rider_id=eq.${rider_id}`;
      const allAttendanceResponse = await fetch(allAttendanceUrl, {
        headers: {
          'apikey': supabaseKey,
          'Authorization': `Bearer ${supabaseKey}`,
        },
      });
      const allAttendance = await allAttendanceResponse.json();

      const stats = {
        total_days: allAttendance?.length || 0,
        present: allAttendance?.filter(a => a.status === 'present').length || 0,
        absent: allAttendance?.filter(a => a.status === 'absent').length || 0,
        late: allAttendance?.filter(a => a.status === 'late').length || 0,
        half_day: allAttendance?.filter(a => a.status === 'half_day').length || 0,
        holiday: allAttendance?.filter(a => a.status === 'holiday').length || 0,
        leave: allAttendance?.filter(a => a.status === 'leave').length || 0
      };

      // Get today's attendance status
      const today = new Date().toISOString().split('T')[0];
      const todayAttendanceUrl = `${supabaseUrl}/rest/v1/rider_attendance?select=*&rider_id=eq.${rider_id}&date=eq.${today}`;
      const todayAttendanceResponse = await fetch(todayAttendanceUrl, {
        headers: {
          'apikey': supabaseKey,
          'Authorization': `Bearer ${supabaseKey}`,
        },
      });
      const todayAttendanceData = await todayAttendanceResponse.json();
      const todayAttendance = todayAttendanceData[0];

      // Get rider details
      const riderUrl = `${supabaseUrl}/rest/v1/riders?select=name,is_online,current_location,last_location_update&rider_id=eq.${rider_id}`;
      const riderResponse = await fetch(riderUrl, {
        headers: {
          'apikey': supabaseKey,
          'Authorization': `Bearer ${supabaseKey}`,
        },
      });
      const riderData = await riderResponse.json();
      const rider = riderData[0];

      // Get duty logs for today
      const dutyLogsUrl = `${supabaseUrl}/rest/v1/rider_duty_logs?select=*&rider_id=eq.${rider_id}&date=eq.${today}&order=created_at.desc`;
      const dutyLogsResponse = await fetch(dutyLogsUrl, {
        headers: {
          'apikey': supabaseKey,
          'Authorization': `Bearer ${supabaseKey}`,
        },
      });
      const dutyLogs = await dutyLogsResponse.json();

      // Generate calendar data for the month
      const daysInMonth = new Date(targetYear, targetMonth, 0).getDate();
      const calendar = [];

      for (let i = 1; i <= daysInMonth; i++) {
        const dateStr = `${targetYear}-${String(targetMonth).padStart(2, '0')}-${String(i).padStart(2, '0')}`;
        const existingRecord = attendance?.find(a => a.date === dateStr);

        calendar.push({
          date: dateStr,
          day: i,
          status: existingRecord?.status || 'pending',
          check_in_time: existingRecord?.check_in_time,
          check_out_time: existingRecord?.check_out_time,
          working_hours: existingRecord?.working_hours,
          notes: existingRecord?.notes
        });
      }

      return new Response(JSON.stringify({
        success: true,
        rider: {
          rider_id: rider_id,
          name: rider?.name,
          is_online: rider?.is_online || false
        },
        today: {
          has_marked: !!todayAttendance,
          status: todayAttendance?.status,
          check_in_time: todayAttendance?.check_in_time,
          check_out_time: todayAttendance?.check_out_time,
          can_check_in: !todayAttendance?.check_in_time,
          can_check_out: todayAttendance?.check_in_time && !todayAttendance?.check_out_time
        },
        calendar: calendar,
        stats: stats,
        duty_logs: dutyLogs || [],
        month: targetMonth,
        year: targetYear,
        current_time: new Date().toISOString()
      }), {
        status: 200,
        headers: { 'Content-Type': 'application/json', ...corsHeaders }
      });

    } catch (error) {
      console.error('Get attendance error:', error);
      return new Response(JSON.stringify({ success: false, error: error.message }), {
        status: 500,
        headers: { 'Content-Type': 'application/json', ...corsHeaders }
      });
    }
  }

  // =====================================================
  // CHECK-IN (POST)
  // =====================================================
  if (request.method === 'POST') {
    try {
      const body = await request.json();
      const {
        rider_id,
        location,
        lat,
        lng,
        selfie_photo,
        notes
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

      const today = new Date().toISOString().split('T')[0];
      const now = new Date();
      const currentTime = now.toTimeString().split(' ')[0];

      // Check if already checked in today
      const existingUrl = `${supabaseUrl}/rest/v1/rider_attendance?select=attendance_id,check_in_time&rider_id=eq.${rider_id}&date=eq.${today}`;
      const existingResponse = await fetch(existingUrl, {
        headers: {
          'apikey': supabaseKey,
          'Authorization': `Bearer ${supabaseKey}`,
        },
      });
      const existingData = await existingResponse.json();
      const existingCheckin = existingData[0];

      if (existingCheckin && existingCheckin.check_in_time) {
        return new Response(JSON.stringify({
          success: false,
          error: 'You have already checked in today',
          check_in_time: existingCheckin.check_in_time
        }), {
          status: 400,
          headers: { 'Content-Type': 'application/json', ...corsHeaders }
        });
      }

      // Determine if late (after 9:30 AM)
      const checkInHour = parseInt(currentTime.split(':')[0]);
      const checkInMinute = parseInt(currentTime.split(':')[1]);
      const isLate = (checkInHour > 9) || (checkInHour === 9 && checkInMinute > 30);
      const status = isLate ? 'late' : 'present';

      // Get current month and year
      const month = now.getMonth() + 1;
      const year = now.getFullYear();

      let attendanceData;
      let attendanceId;

      if (existingCheckin) {
        // Update existing record
        const updateResult = await supabase
          .from('rider_attendance')
          .update({
            check_in_time: currentTime,
            status: status,
            check_in_location: location || null,
            check_in_lat: lat || null,
            check_in_lng: lng || null,
            check_in_photo: selfie_photo || null,
            notes: notes || null,
            updated_at: new Date().toISOString()
          })
          .eq('attendance_id', existingCheckin.attendance_id)
          .select();

        if (updateResult.error) throw updateResult.error;
        attendanceData = updateResult.data;
        attendanceId = existingCheckin.attendance_id;
      } else {
        // Create new record
        const insertResult = await supabase
          .from('rider_attendance')
          .insert({
            rider_id,
            date: today,
            month,
            year,
            check_in_time: currentTime,
            status: status,
            check_in_location: location || null,
            check_in_lat: lat || null,
            check_in_lng: lng || null,
            check_in_photo: selfie_photo || null,
            notes: notes || null,
            created_at: new Date().toISOString()
          })
          .select();

        if (insertResult.error) throw insertResult.error;
        attendanceData = insertResult.data;
        attendanceId = attendanceData.attendance_id;
      }

      // Update rider online status
      await fetch(`${supabaseUrl}/rest/v1/riders?rider_id=eq.${rider_id}`, {
        method: 'PATCH',
        headers: {
          'apikey': supabaseKey,
          'Authorization': `Bearer ${supabaseKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          is_online: true,
          current_location: location ? { lat, lng, address: location } : null,
          last_location_update: new Date().toISOString(),
          updated_at: new Date().toISOString()
        })
      });

      // Log duty entry
      await fetch(`${supabaseUrl}/rest/v1/rider_duty_logs`, {
        method: 'POST',
        headers: {
          'apikey': supabaseKey,
          'Authorization': `Bearer ${supabaseKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          rider_id,
          date: today,
          action: 'check_in',
          time: currentTime,
          location: location || null,
          lat: lat || null,
          lng: lng || null,
          notes: notes || null,
          created_at: new Date().toISOString()
        })
      });

      // Send notification
      await fetch(`${supabaseUrl}/rest/v1/notifications`, {
        method: 'POST',
        headers: {
          'apikey': supabaseKey,
          'Authorization': `Bearer ${supabaseKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          user_id: rider_id,
          user_type: 'rider',
          title: isLate ? '⚠️ Late Check-in' : '✅ Check-in Successful',
          message: isLate ? `You checked in late at ${currentTime}.` : `You checked in at ${currentTime}. Have a great day!`,
          type: 'attendance',
          data: { check_in_time: currentTime, status: status },
          created_at: new Date().toISOString()
        })
      });

      return new Response(JSON.stringify({
        success: true,
        message: isLate ? 'Checked in late' : 'Check-in successful',
        attendance: {
          attendance_id: attendanceId,
          date: today,
          check_in_time: currentTime,
          status: status,
          is_late: isLate
        },
        is_online: true
      }), {
        status: 200,
        headers: { 'Content-Type': 'application/json', ...corsHeaders }
      });

    } catch (error) {
      console.error('Check-in error:', error);
      return new Response(JSON.stringify({ success: false, error: error.message }), {
        status: 500,
        headers: { 'Content-Type': 'application/json', ...corsHeaders }
      });
    }
  }

  // =====================================================
  // CHECK-OUT (PUT)
  // =====================================================
  if (request.method === 'PUT') {
    try {
      const body = await request.json();
      const {
        rider_id,
        location,
        lat,
        lng,
        notes
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

      const today = new Date().toISOString().split('T')[0];
      const now = new Date();
      const currentTime = now.toTimeString().split(' ')[0];

      // Get today's attendance record
      const attendanceUrl = `${supabaseUrl}/rest/v1/rider_attendance?select=attendance_id,check_in_time,status&rider_id=eq.${rider_id}&date=eq.${today}`;
      const attendanceResponse = await fetch(attendanceUrl, {
        headers: {
          'apikey': supabaseKey,
          'Authorization': `Bearer ${supabaseKey}`,
        },
      });
      const attendanceData = await attendanceResponse.json();
      const attendance = attendanceData[0];

      if (!attendance) {
        return new Response(JSON.stringify({
          success: false,
          error: 'No check-in record found for today. Please check in first.'
        }), {
          status: 400,
          headers: { 'Content-Type': 'application/json', ...corsHeaders }
        });
      }

      if (attendance.check_out_time) {
        return new Response(JSON.stringify({
          success: false,
          error: 'You have already checked out today',
          check_out_time: attendance.check_out_time
        }), {
          status: 400,
          headers: { 'Content-Type': 'application/json', ...corsHeaders }
        });
      }

      // Calculate working hours
      const checkInTime = attendance.check_in_time;
      const checkInHour = parseInt(checkInTime.split(':')[0]);
      const checkInMinute = parseInt(checkInTime.split(':')[1]);
      const checkOutHour = parseInt(currentTime.split(':')[0]);
      const checkOutMinute = parseInt(currentTime.split(':')[1]);

      let workingHours = (checkOutHour * 60 + checkOutMinute) - (checkInHour * 60 + checkInMinute);
      workingHours = Math.max(0, workingHours / 60);

      // Update attendance record
      const updateResult = await supabase
        .from('rider_attendance')
        .update({
          check_out_time: currentTime,
          working_hours: workingHours.toFixed(2),
          check_out_location: location || null,
          check_out_lat: lat || null,
          check_out_lng: lng || null,
          notes: notes || null,
          updated_at: new Date().toISOString()
        })
        .eq('attendance_id', attendance.attendance_id)
        .select();

      if (updateResult.error) throw updateResult.error;
      const updatedAttendance = updateResult.data;

      // Update rider online status to offline
      await fetch(`${supabaseUrl}/rest/v1/riders?rider_id=eq.${rider_id}`, {
        method: 'PATCH',
        headers: {
          'apikey': supabaseKey,
          'Authorization': `Bearer ${supabaseKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          is_online: false,
          current_location: location ? { lat, lng, address: location } : null,
          last_location_update: new Date().toISOString(),
          updated_at: new Date().toISOString()
        })
      });

      // Log duty exit
      await fetch(`${supabaseUrl}/rest/v1/rider_duty_logs`, {
        method: 'POST',
        headers: {
          'apikey': supabaseKey,
          'Authorization': `Bearer ${supabaseKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          rider_id,
          date: today,
          action: 'check_out',
          time: currentTime,
          location: location || null,
          lat: lat || null,
          lng: lng || null,
          notes: `Working hours: ${workingHours.toFixed(2)} hrs`,
          created_at: new Date().toISOString()
        })
      });

      // Send notification
      await fetch(`${supabaseUrl}/rest/v1/notifications`, {
        method: 'POST',
        headers: {
          'apikey': supabaseKey,
          'Authorization': `Bearer ${supabaseKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          user_id: rider_id,
          user_type: 'rider',
          title: '✅ Check-out Successful',
          message: `You checked out at ${currentTime}. Total working hours: ${workingHours.toFixed(2)} hrs.`,
          type: 'attendance',
          data: { check_out_time: currentTime, working_hours: workingHours.toFixed(2) },
          created_at: new Date().toISOString()
        })
      });

      return new Response(JSON.stringify({
        success: true,
        message: 'Check-out successful',
        attendance: {
          attendance_id: attendance.attendance_id,
          date: today,
          check_in_time: attendance.check_in_time,
          check_out_time: currentTime,
          working_hours: workingHours.toFixed(2)
        },
        is_online: false
      }), {
        status: 200,
        headers: { 'Content-Type': 'application/json', ...corsHeaders }
      });

    } catch (error) {
      console.error('Check-out error:', error);
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