/**
 * Suriyawan Saffari - Authentication Module
 * Handles user authentication, session management, and role-based access
 */

// User types
const USER_TYPES = {
  CUSTOMER: 'customer',
  SELLER: 'seller',
  RIDER: 'rider',
  HUB: 'hub',
  OWNER: 'owner',
  ADMIN: 'admin'
};

// Storage keys
const STORAGE_KEYS = {
  USER: 'suriyawan_user',
  TOKEN: 'suriyawan_token',
  USER_TYPE: 'suriyawan_user_type',
  REMEMBER_ME: 'suriyawan_remember_me'
};

// Auth state
let currentUser = null;
let currentUserType = null;
let authListeners = [];

/**
 * Get stored user from localStorage
 * @returns {Object|null} Stored user data
 */
function getStoredUser() {
  try {
    const user = localStorage.getItem(STORAGE_KEYS.USER);
    const token = localStorage.getItem(STORAGE_KEYS.TOKEN);
    const userType = localStorage.getItem(STORAGE_KEYS.USER_TYPE);
    
    if (user && token) {
      return {
        user: JSON.parse(user),
        token,
        userType
      };
    }
  } catch (e) {
    console.error('Error reading stored user:', e);
  }
  return null;
}

/**
 * Store user data in localStorage
 * @param {Object} userData - User data to store
 */
function storeUser(userData) {
  if (userData && userData.user && userData.token) {
    localStorage.setItem(STORAGE_KEYS.USER, JSON.stringify(userData.user));
    localStorage.setItem(STORAGE_KEYS.TOKEN, userData.token);
    if (userData.userType) {
      localStorage.setItem(STORAGE_KEYS.USER_TYPE, userData.userType);
    }
    currentUser = userData.user;
    currentUserType = userData.userType;
  }
}

/**
 * Clear stored user data
 */
function clearStoredUser() {
  localStorage.removeItem(STORAGE_KEYS.USER);
  localStorage.removeItem(STORAGE_KEYS.TOKEN);
  localStorage.removeItem(STORAGE_KEYS.USER_TYPE);
  currentUser = null;
  currentUserType = null;
}

/**
 * Get auth headers for API requests
 * @returns {Object} Headers object
 */
function getAuthHeaders() {
  const token = localStorage.getItem(STORAGE_KEYS.TOKEN);
  if (token) {
    return {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    };
  }
  return { 'Content-Type': 'application/json' };
}

/**
 * Check if user is authenticated
 * @returns {boolean} Authentication status
 */
function isAuthenticated() {
  return !!localStorage.getItem(STORAGE_KEYS.TOKEN);
}

/**
 * Check if user has specific role
 * @param {string} role - Role to check
 * @returns {boolean} Whether user has the role
 */
function hasRole(role) {
  const userType = localStorage.getItem(STORAGE_KEYS.USER_TYPE);
  return userType === role;
}

/**
 * Check if user is customer
 * @returns {boolean}
 */
function isCustomer() {
  return hasRole(USER_TYPES.CUSTOMER);
}

/**
 * Check if user is seller
 * @returns {boolean}
 */
function isSeller() {
  return hasRole(USER_TYPES.SELLER);
}

/**
 * Check if user is rider
 * @returns {boolean}
 */
function isRider() {
  return hasRole(USER_TYPES.RIDER);
}

/**
 * Check if user is hub manager
 * @returns {boolean}
 */
function isHub() {
  return hasRole(USER_TYPES.HUB);
}

/**
 * Check if user is owner
 * @returns {boolean}
 */
function isOwner() {
  return hasRole(USER_TYPES.OWNER);
}

/**
 * Get current user data
 * @returns {Object|null} Current user data
 */
function getCurrentUser() {
  try {
    const user = localStorage.getItem(STORAGE_KEYS.USER);
    return user ? JSON.parse(user) : null;
  } catch (e) {
    return null;
  }
}

/**
 * Get current user type
 * @returns {string|null} Current user type
 */
function getCurrentUserType() {
  return localStorage.getItem(STORAGE_KEYS.USER_TYPE);
}

/**
 * Get authentication token
 * @returns {string|null} Auth token
 */
function getToken() {
  return localStorage.getItem(STORAGE_KEYS.TOKEN);
}

/**
 * Set remember me preference
 * @param {boolean} remember - Remember me status
 */
function setRememberMe(remember) {
  localStorage.setItem(STORAGE_KEYS.REMEMBER_ME, remember);
}

/**
 * Get remember me preference
 * @returns {boolean} Remember me status
 */
function getRememberMe() {
  return localStorage.getItem(STORAGE_KEYS.REMEMBER_ME) === 'true';
}

/**
 * Login with email and password
 * @param {string} email - User email
 * @param {string} password - User password
 * @param {string} userType - User type
 * @returns {Promise<Object>} Login response
 */
async function login(email, password, userType) {
  try {
    const response = await fetch('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password, user_type: userType })
    });
    
    const data = await response.json();
    
    if (data.success) {
      storeUser({
        user: data.data.user,
        token: data.data.auth?.access_token,
        userType: userType
      });
      
      // Notify listeners
      notifyAuthListeners('login', data.data.user);
      
      return { success: true, data: data.data };
    } else {
      return { success: false, error: data.error };
    }
  } catch (error) {
    console.error('Login error:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Login with fingerprint
 * @param {string} fingerprintData - Fingerprint data
 * @param {string} userType - User type
 * @returns {Promise<Object>} Login response
 */
async function loginWithFingerprint(fingerprintData, userType) {
  try {
    const response = await fetch('/api/auth/fingerprint', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ fingerprint_data: fingerprintData, user_type: userType })
    });
    
    const data = await response.json();
    
    if (data.success) {
      storeUser({
        user: data.data.user,
        token: data.data.auth?.access_token,
        userType: userType
      });
      
      notifyAuthListeners('login', data.data.user);
      return { success: true, data: data.data };
    } else {
      return { success: false, error: data.error };
    }
  } catch (error) {
    console.error('Fingerprint login error:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Register fingerprint for current user
 * @param {string} fingerprintData - Fingerprint data
 * @returns {Promise<Object>} Registration response
 */
async function registerFingerprint(fingerprintData) {
  const userId = getCurrentUser()?.cust_id || getCurrentUser()?.seller_id || getCurrentUser()?.rider_id;
  const userType = getCurrentUserType();
  
  if (!userId || !userType) {
    return { success: false, error: 'User not logged in' };
  }
  
  try {
    const response = await fetch('/api/auth/fingerprint', {
      method: 'POST',
      headers: getAuthHeaders(),
      body: JSON.stringify({
        user_id: userId,
        user_type: userType,
        fingerprint_data: fingerprintData
      })
    });
    
    const data = await response.json();
    return data;
  } catch (error) {
    console.error('Register fingerprint error:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Signup new customer
 * @param {Object} userData - User registration data
 * @returns {Promise<Object>} Signup response
 */
async function signup(userData) {
  try {
    const response = await fetch('/api/auth/signup', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(userData)
    });
    
    const data = await response.json();
    
    if (data.success) {
      storeUser({
        user: data.data,
        token: data.auth?.access_token,
        userType: USER_TYPES.CUSTOMER
      });
      
      notifyAuthListeners('signup', data.data);
      return { success: true, data: data.data };
    } else {
      return { success: false, error: data.error };
    }
  } catch (error) {
    console.error('Signup error:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Logout current user
 * @returns {Promise<Object>} Logout response
 */
async function logout() {
  try {
    const token = getToken();
    
    if (token) {
      await fetch('/api/auth/logout', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` }
      });
    }
    
    clearStoredUser();
    notifyAuthListeners('logout', null);
    
    return { success: true };
  } catch (error) {
    console.error('Logout error:', error);
    clearStoredUser();
    return { success: true };
  }
}

/**
 * Verify current token and get user info
 * @returns {Promise<Object>} Verification response
 */
async function verifyToken() {
  const token = getToken();
  if (!token) {
    return { success: false, isAuthenticated: false };
  }
  
  try {
    const response = await fetch('/api/auth/verify', {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    
    const data = await response.json();
    
    if (data.is_authenticated) {
      // Update stored user info if needed
      if (data.user) {
        localStorage.setItem(STORAGE_KEYS.USER, JSON.stringify(data.user));
        if (data.user_type) {
          localStorage.setItem(STORAGE_KEYS.USER_TYPE, data.user_type);
          currentUserType = data.user_type;
        }
        currentUser = data.user;
      }
    } else {
      clearStoredUser();
    }
    
    return data;
  } catch (error) {
    console.error('Token verification error:', error);
    return { success: false, isAuthenticated: false };
  }
}

/**
 * Add auth state change listener
 * @param {Function} listener - Callback function
 */
function addAuthListener(listener) {
  authListeners.push(listener);
}

/**
 * Remove auth state change listener
 * @param {Function} listener - Callback function to remove
 */
function removeAuthListener(listener) {
  authListeners = authListeners.filter(l => l !== listener);
}

/**
 * Notify all auth listeners of state change
 * @param {string} event - Event type
 * @param {Object} user - User data
 */
function notifyAuthListeners(event, user) {
  authListeners.forEach(listener => {
    try {
      listener(event, user);
    } catch (e) {
      console.error('Auth listener error:', e);
    }
  });
}

/**
 * Redirect to appropriate dashboard based on user type
 */
function redirectToDashboard() {
  const userType = getCurrentUserType();
  
  if (!userType) {
    window.location.href = '/';
    return;
  }
  
  const dashboards = {
    [USER_TYPES.CUSTOMER]: '/customer/index.html',
    [USER_TYPES.SELLER]: '/seller/index.html',
    [USER_TYPES.RIDER]: '/logistics/rider/index.html',
    [USER_TYPES.HUB]: '/logistics/hub/index.html',
    [USER_TYPES.OWNER]: '/owner/index.html',
    [USER_TYPES.ADMIN]: '/owner/index.html'
  };
  
  const dashboard = dashboards[userType];
  if (dashboard && window.location.pathname !== dashboard) {
    window.location.href = dashboard;
  }
}

/**
 * Check if user has access to current page
 * @returns {boolean} Access status
 */
function checkPageAccess() {
  const path = window.location.pathname;
  const userType = getCurrentUserType();
  
  // Public pages accessible to all
  const publicPages = ['/index.html', '/login.html', '/signup.html', '/forgot-password.html'];
  if (publicPages.some(page => path.includes(page))) {
    return true;
  }
  
  // Restricted pages
  if (path.includes('/customer/') && userType !== USER_TYPES.CUSTOMER) {
    return false;
  }
  if (path.includes('/seller/') && userType !== USER_TYPES.SELLER) {
    return false;
  }
  if (path.includes('/logistics/rider/') && userType !== USER_TYPES.RIDER) {
    return false;
  }
  if (path.includes('/logistics/hub/') && userType !== USER_TYPES.HUB) {
    return false;
  }
  if (path.includes('/owner/') && userType !== USER_TYPES.OWNER && userType !== USER_TYPES.ADMIN) {
    return false;
  }
  
  return true;
}

/**
 * Initialize auth module on page load
 */
function initAuth() {
  // Verify token on page load
  verifyToken().then(data => {
    if (!data.is_authenticated && !checkPublicPage()) {
      // Redirect to login if not authenticated
      window.location.href = '/login.html';
    }
  });
  
  // Check page access
  if (!checkPageAccess()) {
    window.location.href = '/';
    return;
  }
}

/**
 * Check if current page is public
 * @returns {boolean} Whether page is public
 */
function checkPublicPage() {
  const publicPages = ['/login.html', '/signup.html', '/forgot-password.html', '/reset-password.html'];
  return publicPages.some(page => window.location.pathname.includes(page));
}

// Export functions
window.AuthService = {
  USER_TYPES,
  getStoredUser,
  storeUser,
  clearStoredUser,
  getAuthHeaders,
  isAuthenticated,
  hasRole,
  isCustomer,
  isSeller,
  isRider,
  isHub,
  isOwner,
  getCurrentUser,
  getCurrentUserType,
  getToken,
  setRememberMe,
  getRememberMe,
  login,
  loginWithFingerprint,
  registerFingerprint,
  signup,
  logout,
  verifyToken,
  addAuthListener,
  removeAuthListener,
  redirectToDashboard,
  checkPageAccess,
  initAuth
};

// Auto-initialize on page load
document.addEventListener('DOMContentLoaded', () => {
  initAuth();
});