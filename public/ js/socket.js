/**
 * Suriyawan Saffari - WebSocket/Realtime Module
 * Handles real-time updates for orders, tracking, and notifications
 */

// Supabase realtime subscription manager
let activeSubscriptions = [];
let notificationCallbacks = [];

// =====================================================
// Initialize Realtime Subscriptions
// =====================================================
function initRealtime(userId, userType) {
  if (!userId || !userType) return;
  
  // Subscribe to notifications
  subscribeToNotifications(userId, userType);
  
  // Subscribe to order updates
  subscribeToOrderUpdates(userId, userType);
  
  // If rider, subscribe to runsheet updates
  if (userType === 'rider') {
    subscribeToRunsheetUpdates(userId);
  }
  
  // If customer, subscribe to delivery tracking
  if (userType === 'customer') {
    subscribeToDeliveryTracking(userId);
  }
  
  // If hub, subscribe to inbound/outbound updates
  if (userType === 'hub') {
    subscribeToHubUpdates(userId);
  }
}

// =====================================================
// Subscribe to Notifications
// =====================================================
function subscribeToNotifications(userId, userType) {
  if (!window.SupabaseService) return;
  
  const subscription = window.SupabaseService.subscribeToNotifications(
    userId, 
    userType,
    (notification) => {
      // Show toast notification
      showNotificationToast(notification);
      
      // Trigger callbacks
      notificationCallbacks.forEach(cb => cb(notification));
      
      // Update notification badge
      updateNotificationBadge();
    }
  );
  
  if (subscription) {
    activeSubscriptions.push(subscription);
  }
}

// =====================================================
// Subscribe to Order Updates
// =====================================================
function subscribeToOrderUpdates(userId, userType) {
  if (!window.SupabaseService) return;
  
  let filterField = '';
  switch (userType) {
    case 'customer':
      filterField = 'cust_id';
      break;
    case 'seller':
      filterField = 'seller_id';
      break;
    case 'rider':
      filterField = 'rider_id';
      break;
  }
  
  if (!filterField) return;
  
  const subscription = window.SupabaseService.subscribeToTable(
    'orders',
    'UPDATE',
    (payload) => {
      if (payload.new[filterField] === userId) {
        handleOrderStatusUpdate(payload.new);
        
        // Trigger custom event
        window.dispatchEvent(new CustomEvent('order-updated', {
          detail: { order: payload.new }
        }));
      }
    }
  );
  
  if (subscription) {
    activeSubscriptions.push(subscription);
  }
}

// =====================================================
// Subscribe to Runsheet Updates (for Riders)
// =====================================================
function subscribeToRunsheetUpdates(riderId) {
  if (!window.SupabaseService) return;
  
  const subscription = window.SupabaseService.subscribeToTable(
    'runsheets',
    'UPDATE',
    (payload) => {
      if (payload.new.rider_id === riderId) {
        window.dispatchEvent(new CustomEvent('runsheet-updated', {
          detail: { runsheet: payload.new }
        }));
        
        showNotificationToast({
          title: 'Runsheet Updated',
          message: `Your runsheet status has been updated to ${payload.new.status}`,
          type: 'info'
        });
      }
    }
  );
  
  if (subscription) {
    activeSubscriptions.push(subscription);
  }
}

// =====================================================
// Subscribe to Delivery Tracking (for Customers)
// =====================================================
function subscribeToDeliveryTracking(customerId) {
  if (!window.SupabaseService) return;
  
  // Subscribe to order updates for this customer
  const subscription = window.SupabaseService.subscribeToTable(
    'orders',
    'UPDATE',
    (payload) => {
      if (payload.new.cust_id === customerId && 
          payload.new.status === 'OUT_FOR_DELIVERY') {
        
        // Subscribe to rider location
        if (payload.new.rider_id) {
          subscribeToRiderLocation(payload.new.rider_id, payload.new.book_id);
        }
      }
    }
  );
  
  if (subscription) {
    activeSubscriptions.push(subscription);
  }
}

// =====================================================
// Subscribe to Rider Location Updates
// =====================================================
let riderLocationSubscription = null;

function subscribeToRiderLocation(riderId, orderId) {
  if (riderLocationSubscription) {
    riderLocationSubscription.unsubscribe();
  }
  
  if (!window.SupabaseService) return;
  
  riderLocationSubscription = window.SupabaseService.subscribeToRiderLocation(
    riderId,
    (location) => {
      window.dispatchEvent(new CustomEvent('rider-location-updated', {
        detail: { orderId, location }
      }));
    }
  );
  
  if (riderLocationSubscription) {
    activeSubscriptions.push(riderLocationSubscription);
  }
}

// =====================================================
// Subscribe to Hub Updates
// =====================================================
function subscribeToHubUpdates(hubId) {
  if (!window.SupabaseService) return;
  
  // Subscribe to inbound shipments
  const subscription = window.SupabaseService.subscribeToTable(
    'shipment_tracking',
    'INSERT',
    (payload) => {
      if (payload.new.hub_id === hubId) {
        window.dispatchEvent(new CustomEvent('inbound-shipment', {
          detail: { tracking: payload.new }
        }));
      }
    }
  );
  
  if (subscription) {
    activeSubscriptions.push(subscription);
  }
}

// =====================================================
// Handle Order Status Update
// =====================================================
function handleOrderStatusUpdate(order) {
  const statusMessages = {
    'ACCEPTED': 'Your order has been accepted by the seller',
    'PACKED': 'Your order has been packed and is ready for pickup',
    'SHIPPED': 'Your order has been shipped',
    'OUT_FOR_DELIVERY': 'Your order is out for delivery!',
    'DELIVERED': 'Your order has been delivered successfully!',
    'CANCELLED': 'Your order has been cancelled'
  };
  
  const message = statusMessages[order.status];
  if (message) {
    showNotificationToast({
      title: 'Order Update',
      message: message,
      type: order.status === 'DELIVERED' ? 'success' : 'info',
      orderId: order.book_id
    });
  }
  
  // Update tracking page if open
  if (window.location.pathname.includes('track-order.html')) {
    const urlParams = new URLSearchParams(window.location.search);
    const bookId = urlParams.get('book_id');
    if (bookId === order.book_id) {
      location.reload();
    }
  }
}

// =====================================================
// Show Notification Toast
// =====================================================
function showNotificationToast(notification) {
  const toast = document.createElement('div');
  toast.className = `notification-toast toast-${notification.type || 'info'}`;
  toast.style.cssText = `
    position: fixed;
    bottom: 20px;
    right: 20px;
    background: white;
    border-left: 4px solid ${getNotificationColor(notification.type)};
    padding: 12px 16px;
    border-radius: 8px;
    box-shadow: 0 4px 12px rgba(0,0,0,0.15);
    z-index: 10000;
    max-width: 350px;
    animation: slideInRight 0.3s ease;
    cursor: pointer;
  `;
  
  toast.innerHTML = `
    <div style="font-weight: 600; margin-bottom: 4px;">${notification.title || 'Notification'}</div>
    <div style="font-size: 14px; color: #666;">${notification.message}</div>
    ${notification.orderId ? `<div style="font-size: 12px; color: #999; margin-top: 8px;">Order: ${notification.orderId}</div>` : ''}
  `;
  
  toast.addEventListener('click', () => {
    if (notification.orderId) {
      window.location.href = `/customer/track-order.html?book_id=${notification.orderId}`;
    }
    toast.remove();
  });
  
  document.body.appendChild(toast);
  
  setTimeout(() => {
    if (toast.parentNode) {
      toast.style.animation = 'slideOutRight 0.3s ease';
      setTimeout(() => toast.remove(), 300);
    }
  }, 5000);
}

// =====================================================
// Get Notification Color
// =====================================================
function getNotificationColor(type) {
  switch (type) {
    case 'success': return '#10b981';
    case 'error': return '#ef4444';
    case 'warning': return '#f59e0b';
    default: return '#3b82f6';
  }
}

// =====================================================
// Update Notification Badge
// =====================================================
async function updateNotificationBadge() {
  const userId = getCurrentUserId();
  if (!userId) return;
  
  try {
    const response = await fetch(`/api/customer/notifications?user_id=${userId}&unread_only=true`, {
      headers: AuthService.getAuthHeaders()
    });
    
    const data = await response.json();
    const unreadCount = data.notifications?.filter(n => !n.is_read).length || 0;
    
    const badge = document.querySelector('.notification-badge');
    if (badge) {
      if (unreadCount > 0) {
        badge.textContent = unreadCount > 9 ? '9+' : unreadCount;
        badge.style.display = 'flex';
      } else {
        badge.style.display = 'none';
      }
    }
  } catch (error) {
    console.error('Error updating notification badge:', error);
  }
}

// =====================================================
// Get Current User ID
// =====================================================
function getCurrentUserId() {
  if (!AuthService) return null;
  const user = AuthService.getCurrentUser();
  return user?.cust_id || user?.seller_id || user?.rider_id || null;
}

// =====================================================
// Get Current User Type
// =====================================================
function getCurrentUserType() {
  if (!AuthService) return null;
  return AuthService.getCurrentUserType();
}

// =====================================================
// Add Notification Callback
// =====================================================
function addNotificationCallback(callback) {
  notificationCallbacks.push(callback);
}

// =====================================================
// Remove Notification Callback
// =====================================================
function removeNotificationCallback(callback) {
  notificationCallbacks = notificationCallbacks.filter(cb => cb !== callback);
}

// =====================================================
// Cleanup All Subscriptions
// =====================================================
function cleanupSubscriptions() {
  activeSubscriptions.forEach(sub => {
    try {
      if (sub && typeof sub.unsubscribe === 'function') {
        sub.unsubscribe();
      }
    } catch (e) {
      console.error('Error unsubscribing:', e);
    }
  });
  activeSubscriptions = [];
}

// =====================================================
// Track Rider Location on Map
// =====================================================
let map = null;
let riderMarker = null;
let orderMarker = null;

function initTrackingMap(mapElementId, riderLocation, destinationLocation) {
  if (!window.google || !window.google.maps) {
    console.error('Google Maps not loaded');
    return;
  }
  
  const mapElement = document.getElementById(mapElementId);
  if (!mapElement) return;
  
  map = new google.maps.Map(mapElement, {
    center: riderLocation,
    zoom: 14,
    styles: [
      {
        featureType: 'poi',
        stylers: [{ visibility: 'off' }]
      }
    ]
  });
  
  riderMarker = new google.maps.Marker({
    position: riderLocation,
    map: map,
    title: 'Rider Location',
    icon: {
      url: 'https://maps.google.com/mapfiles/ms/icons/truck.png',
      scaledSize: new google.maps.Size(40, 40)
    }
  });
  
  orderMarker = new google.maps.Marker({
    position: destinationLocation,
    map: map,
    title: 'Delivery Location',
    icon: {
      url: 'https://maps.google.com/mapfiles/ms/icons/red-dot.png',
      scaledSize: new google.maps.Size(40, 40)
    }
  });
  
  // Draw route
  const directionsService = new google.maps.DirectionsService();
  const directionsRenderer = new google.maps.DirectionsRenderer({
    map: map,
    suppressMarkers: true
  });
  
  directionsService.route({
    origin: riderLocation,
    destination: destinationLocation,
    travelMode: google.maps.TravelMode.DRIVING
  }, (result, status) => {
    if (status === 'OK') {
      directionsRenderer.setDirections(result);
    }
  });
}

function updateRiderLocation(riderLocation) {
  if (riderMarker) {
    riderMarker.setPosition(riderLocation);
    map.setCenter(riderLocation);
  }
}

// =====================================================
// Export functions
// =====================================================
window.RealtimeService = {
  initRealtime,
  subscribeToNotifications,
  subscribeToOrderUpdates,
  subscribeToRiderLocation,
  addNotificationCallback,
  removeNotificationCallback,
  cleanupSubscriptions,
  updateNotificationBadge,
  initTrackingMap,
  updateRiderLocation
};

// Initialize on load if user is logged in
document.addEventListener('DOMContentLoaded', () => {
  if (AuthService && AuthService.isAuthenticated()) {
    const userId = getCurrentUserId();
    const userType = getCurrentUserType();
    if (userId && userType) {
      initRealtime(userId, userType);
    }
  }
});

// Cleanup on page unload
window.addEventListener('beforeunload', () => {
  cleanupSubscriptions();
});