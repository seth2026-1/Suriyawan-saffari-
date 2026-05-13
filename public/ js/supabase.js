/**
 * Suriyawan Saffari - Supabase Client Configuration
 */

// Supabase configuration - Vercel environment variables
let SUPABASE_CONFIG = {
  url: null,
  anonKey: null,
  serviceRoleKey: null
};

// Try to get config from meta tags
const urlMeta = document.querySelector('meta[name="supabase-url"]');
const anonMeta = document.querySelector('meta[name="supabase-anon-key"]');

if (urlMeta && anonMeta) {
  SUPABASE_CONFIG.url = urlMeta.content;
  SUPABASE_CONFIG.anonKey = anonMeta.content;
} else {
  // These will be replaced by Vercel at build time via env variables
  SUPABASE_CONFIG.url = '%%NEXT_PUBLIC_SUPABASE_URL%%';
  SUPABASE_CONFIG.anonKey = '%%NEXT_PUBLIC_SUPABASE_ANON_KEY%%';
  SUPABASE_CONFIG.serviceRoleKey = '%%SUPABASE_SERVICE_ROLE_KEY%%';
}

let supabaseClient = null;
let supabaseAdmin = null;

function initSupabase() {
  if (!supabaseClient && typeof supabase !== 'undefined') {
    if (SUPABASE_CONFIG.url.startsWith('%%') || SUPABASE_CONFIG.url === 'https://your-project.supabase.co') {
      console.error('❌ Supabase URL not configured properly!');
      console.error('URL value:', SUPABASE_CONFIG.url);
      console.error('Please set NEXT_PUBLIC_SUPABASE_URL in Vercel environment variables');
      return null;
    }
    
    console.log('✅ Initializing Supabase with URL:', SUPABASE_CONFIG.url.substring(0, 30) + '...');
    
    supabaseClient = supabase.createClient(SUPABASE_CONFIG.url, SUPABASE_CONFIG.anonKey, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
        storage: localStorage
      },
      realtime: {
        params: {
          eventsPerSecond: 10
        }
      }
    });
  }
  return supabaseClient;
}

function initSupabaseAdmin() {
  if (!supabaseAdmin && typeof supabase !== 'undefined' && SUPABASE_CONFIG.serviceRoleKey) {
    if (!SUPABASE_CONFIG.serviceRoleKey.startsWith('%%')) {
      supabaseAdmin = supabase.createClient(SUPABASE_CONFIG.url, SUPABASE_CONFIG.serviceRoleKey, {
        auth: {
          autoRefreshToken: false,
          persistSession: false
        }
      });
    }
  }
  return supabaseAdmin;
}

async function getCurrentSession() {
  const client = initSupabase();
  if (!client) return null;
  const { data: { session }, error } = await client.auth.getSession();
  if (error) {
    console.error('Error getting session:', error);
    return null;
  }
  return session;
}

async function getCurrentUser() {
  const client = initSupabase();
  if (!client) return null;
  const { data: { user }, error } = await client.auth.getUser();
  if (error) {
    console.error('Error getting user:', error);
    return null;
  }
  return user;
}

async function signIn(email, password) {
  const client = initSupabase();
  if (!client) throw new Error('Supabase client not initialized');
  const { data, error } = await client.auth.signInWithPassword({ email, password });
  if (error) throw error;
  return data;
}

async function signUp(email, password, metadata = {}) {
  const client = initSupabase();
  if (!client) throw new Error('Supabase client not initialized');
  const { data, error } = await client.auth.signUp({
    email,
    password,
    options: { data: metadata }
  });
  if (error) throw error;
  return data;
}

async function signOut() {
  const client = initSupabase();
  if (!client) throw new Error('Supabase client not initialized');
  const { error } = await client.auth.signOut();
  if (error) throw error;
}

async function resetPassword(email) {
  const client = initSupabase();
  if (!client) throw new Error('Supabase client not initialized');
  const { data, error } = await client.auth.resetPasswordForEmail(email);
  if (error) throw error;
  return data;
}

async function updatePassword(newPassword) {
  const client = initSupabase();
  if (!client) throw new Error('Supabase client not initialized');
  const { data, error } = await client.auth.updateUser({ password: newPassword });
  if (error) throw error;
  return data;
}

async function updateUserMetadata(metadata) {
  const client = initSupabase();
  if (!client) throw new Error('Supabase client not initialized');
  const { data, error } = await client.auth.updateUser({ data: metadata });
  if (error) throw error;
  return data;
}

function subscribeToTable(table, event, callback) {
  const client = initSupabase();
  if (!client) throw new Error('Supabase client not initialized');
  const subscription = client
    .channel(`${table}-changes`)
    .on('postgres_changes', { event, schema: 'public', table }, (payload) => {
      callback(payload);
    })
    .subscribe();
  return subscription;
}

function subscribeToOrder(orderId, callback) {
  return subscribeToTable('orders', 'UPDATE', (payload) => {
    if (payload.new.book_id === orderId) {
      callback(payload);
    }
  });
}

function subscribeToRiderLocation(riderId, callback) {
  const client = initSupabase();
  if (!client) throw new Error('Supabase client not initialized');
  const subscription = client
    .channel(`rider-${riderId}-location`)
    .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'riders' }, (payload) => {
      if (payload.new.rider_id === riderId && payload.new.current_location) {
        callback(payload.new.current_location);
      }
    })
    .subscribe();
  return subscription;
}

function subscribeToNotifications(userId, userType, callback) {
  return subscribeToTable('notifications', 'INSERT', (payload) => {
    if (payload.new.user_id === userId || payload.new.user_id === 'ALL') {
      callback(payload.new);
    }
  });
}

async function fetchData(table, filters = {}, options = {}) {
  const client = initSupabase();
  if (!client) throw new Error('Supabase client not initialized');
  
  let query = client.from(table).select('*', { count: 'exact' });
  
  Object.entries(filters).forEach(([key, value]) => {
    if (value !== undefined && value !== null) {
      if (typeof value === 'object' && value.operator) {
        query = query.filter(key, value.operator, value.value);
      } else {
        query = query.eq(key, value);
      }
    }
  });
  
  if (options.page && options.limit) {
    const from = (options.page - 1) * options.limit;
    const to = from + options.limit - 1;
    query = query.range(from, to);
  } else if (options.limit) {
    query = query.limit(options.limit);
  }
  
  if (options.orderBy) {
    query = query.order(options.orderBy, { ascending: options.orderDirection === 'asc' });
  }
  
  const { data, error, count } = await query;
  if (error) throw error;
  return { data, count, error: null };
}

async function insertData(table, data) {
  const client = initSupabase();
  if (!client) throw new Error('Supabase client not initialized');
  const { data: result, error } = await client.from(table).insert(data).select();
  if (error) throw error;
  return result;
}

async function updateData(table, data, match) {
  const client = initSupabase();
  if (!client) throw new Error('Supabase client not initialized');
  let query = client.from(table).update(data);
  Object.entries(match).forEach(([key, value]) => {
    query = query.eq(key, value);
  });
  const { data: result, error } = await query.select();
  if (error) throw error;
  return result;
}

async function deleteData(table, match) {
  const client = initSupabase();
  if (!client) throw new Error('Supabase client not initialized');
  let query = client.from(table).delete();
  Object.entries(match).forEach(([key, value]) => {
    query = query.eq(key, value);
  });
  const { data, error } = await query.select();
  if (error) throw error;
  return data;
}

async function callRPC(functionName, params = {}) {
  const client = initSupabase();
  if (!client) throw new Error('Supabase client not initialized');
  const { data, error } = await client.rpc(functionName, params);
  if (error) throw error;
  return data;
}

async function uploadFile(bucket, path, file) {
  const client = initSupabase();
  if (!client) throw new Error('Supabase client not initialized');
  const { data, error } = await client.storage.from(bucket).upload(path, file);
  if (error) throw error;
  return data;
}

function getFileUrl(bucket, path) {
  const client = initSupabase();
  if (!client) return '';
  const { data } = client.storage.from(bucket).getPublicUrl(path);
  return data.publicUrl;
}

async function deleteFile(bucket, path) {
  const client = initSupabase();
  if (!client) throw new Error('Supabase client not initialized');
  const { data, error } = await client.storage.from(bucket).remove([path]);
  if (error) throw error;
  return data;
}

window.SupabaseService = {
  initSupabase,
  initSupabaseAdmin,
  getCurrentSession,
  getCurrentUser,
  signIn,
  signUp,
  signOut,
  resetPassword,
  updatePassword,
  updateUserMetadata,
  subscribeToTable,
  subscribeToOrder,
  subscribeToRiderLocation,
  subscribeToNotifications,
  fetchData,
  insertData,
  updateData,
  deleteData,
  callRPC,
  uploadFile,
  getFileUrl,
  deleteFile
};

document.addEventListener('DOMContentLoaded', () => {
  console.log('🔧 Initializing Supabase service...');
  initSupabase();
});
