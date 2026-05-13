/**
 * Suriyawan Saffari - Cart Manager Module
 * Handles shopping cart operations, persistence, and synchronization
 */

// Cart storage key
const CART_STORAGE_KEY = 'suriyawan_cart';

// Cart state
let cartItems = [];
let cartListeners = [];
let isSyncing = false;

// =====================================================
// Cart Item Class
// =====================================================
class CartItem {
  constructor(data) {
    this.cart_id = data.cart_id || null;
    this.prod_id = data.prod_id;
    this.name = data.name;
    this.price = data.current_price || data.selling_price;
    this.mrp = data.mrp;
    this.quantity = data.quantity || 1;
    this.image = data.image || null;
    this.variation_id = data.variation_id || null;
    this.variation_details = data.variation_details || null;
    this.seller_id = data.seller_id;
    this.seller_name = data.seller_name;
    this.max_stock = data.max_stock || 999;
    this.is_cod_available = data.is_cod_available !== false;
    this.added_at = data.added_at || new Date().toISOString();
  }
  
  get total() {
    return this.price * this.quantity;
  }
  
  get discount() {
    return (this.mrp - this.price) * this.quantity;
  }
  
  get discountPercent() {
    return Math.round(((this.mrp - this.price) / this.mrp) * 100);
  }
}

// =====================================================
// Initialize Cart
// =====================================================
function initCart() {
  loadCartFromStorage();
  
  // Sync cart with server if user is logged in
  if (AuthService && AuthService.isAuthenticated()) {
    syncCartWithServer();
  }
  
  // Update cart count in UI
  updateCartCountDisplay();
}

// =====================================================
// Load Cart from Local Storage
// =====================================================
function loadCartFromStorage() {
  try {
    const stored = localStorage.getItem(CART_STORAGE_KEY);
    if (stored) {
      const parsed = JSON.parse(stored);
      cartItems = parsed.map(item => new CartItem(item));
    } else {
      cartItems = [];
    }
  } catch (e) {
    console.error('Error loading cart from storage:', e);
    cartItems = [];
  }
  notifyCartListeners();
}

// =====================================================
// Save Cart to Local Storage
// =====================================================
function saveCartToStorage() {
  try {
    localStorage.setItem(CART_STORAGE_KEY, JSON.stringify(cartItems));
  } catch (e) {
    console.error('Error saving cart to storage:', e);
  }
}

// =====================================================
// Sync Cart with Server
// =====================================================
async function syncCartWithServer() {
  if (isSyncing) return;
  isSyncing = true;
  
  try {
    const userId = getCurrentUserId();
    if (!userId) return;
    
    // Get server cart
    const response = await fetch(`/api/customer/cart?cust_id=${userId}`, {
      headers: AuthService.getAuthHeaders()
    });
    
    const data = await response.json();
    
    if (data.success && data.cart) {
      // Merge local cart with server cart
      const serverItems = data.cart;
      const mergedItems = [...cartItems];
      
      for (const serverItem of serverItems) {
        const existingIndex = mergedItems.findIndex(
          item => item.prod_id === serverItem.prod_id && 
                  item.variation_id === serverItem.variation_id
        );
        
        if (existingIndex >= 0) {
          // Use server quantity (more recent)
          mergedItems[existingIndex].quantity = serverItem.quantity;
          mergedItems[existingIndex].cart_id = serverItem.cart_id;
        } else {
          mergedItems.push(new CartItem(serverItem));
        }
      }
      
      cartItems = mergedItems;
      saveCartToStorage();
      notifyCartListeners();
      
      // Update server with merged cart
      await pushCartToServer();
    }
  } catch (error) {
    console.error('Error syncing cart:', error);
  } finally {
    isSyncing = false;
  }
}

// =====================================================
// Push Cart to Server
// =====================================================
async function pushCartToServer() {
  const userId = getCurrentUserId();
  if (!userId) return;
  
  try {
    // Clear server cart first
    await fetch(`/api/customer/cart?cust_id=${userId}`, {
      method: 'DELETE',
      headers: AuthService.getAuthHeaders()
    });
    
    // Add each item to server cart
    for (const item of cartItems) {
      await fetch('/api/customer/cart', {
        method: 'POST',
        headers: AuthService.getAuthHeaders(),
        body: JSON.stringify({
          cust_id: userId,
          prod_id: item.prod_id,
          quantity: item.quantity,
          variation_id: item.variation_id
        })
      });
    }
  } catch (error) {
    console.error('Error pushing cart to server:', error);
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
// Get Cart Items
// =====================================================
function getCartItems() {
  return [...cartItems];
}

// =====================================================
// Get Cart Item Count
// =====================================================
function getCartCount() {
  return cartItems.reduce((total, item) => total + item.quantity, 0);
}

// =====================================================
// Get Cart Total
// =====================================================
function getCartTotal() {
  return cartItems.reduce((total, item) => total + item.total, 0);
}

// =====================================================
// Get Cart Subtotal (without delivery)
// =====================================================
function getCartSubtotal() {
  return getCartTotal();
}

// =====================================================
// Get Cart Discount
// =====================================================
function getCartDiscount() {
  return cartItems.reduce((total, item) => total + item.discount, 0);
}

// =====================================================
// Check if Cart is Empty
// =====================================================
function isCartEmpty() {
  return cartItems.length === 0;
}

// =====================================================
// Add Item to Cart
// =====================================================
async function addToCart(product, quantity = 1, variationId = null) {
  const userId = getCurrentUserId();
  
  // Check if item already exists
  const existingIndex = cartItems.findIndex(
    item => item.prod_id === product.prod_id && 
            item.variation_id === variationId
  );
  
  let cartId = null;
  let newQuantity = quantity;
  
  if (existingIndex >= 0) {
    newQuantity = cartItems[existingIndex].quantity + quantity;
    if (newQuantity > cartItems[existingIndex].max_stock) {
      showToast(`Only ${cartItems[existingIndex].max_stock} items available`, 'warning');
      newQuantity = cartItems[existingIndex].max_stock;
    }
    cartItems[existingIndex].quantity = newQuantity;
    cartId = cartItems[existingIndex].cart_id;
  } else {
    const cartItem = new CartItem({
      prod_id: product.prod_id,
      name: product.name,
      price: product.current_price || product.selling_price,
      mrp: product.mrp,
      quantity: quantity,
      image: product.images?.[0] || null,
      variation_id: variationId,
      variation_details: product.variation_details || null,
      seller_id: product.seller_id,
      seller_name: product.seller_name,
      max_stock: product.stock,
      is_cod_available: product.is_cod_available
    });
    cartItems.push(cartItem);
    cartId = null;
  }
  
  // Update server if user is logged in
  if (userId) {
    try {
      if (existingIndex >= 0 && cartId) {
        // Update existing cart item
        await fetch('/api/customer/cart', {
          method: 'PUT',
          headers: AuthService.getAuthHeaders(),
          body: JSON.stringify({
            cart_id: cartId,
            quantity: newQuantity,
            cust_id: userId
          })
        });
      } else {
        // Add new cart item
        await fetch('/api/customer/cart', {
          method: 'POST',
          headers: AuthService.getAuthHeaders(),
          body: JSON.stringify({
            cust_id: userId,
            prod_id: product.prod_id,
            quantity: quantity,
            variation_id: variationId
          })
        });
      }
    } catch (error) {
      console.error('Error updating server cart:', error);
    }
  }
  
  saveCartToStorage();
  notifyCartListeners();
  updateCartCountDisplay();
  showToast('Added to cart', 'success');
  
  return true;
}

// =====================================================
// Update Cart Item Quantity
// =====================================================
async function updateCartQuantity(index, quantity) {
  if (index < 0 || index >= cartItems.length) return false;
  
  const item = cartItems[index];
  const userId = getCurrentUserId();
  
  if (quantity <= 0) {
    return removeCartItem(index);
  }
  
  if (quantity > item.max_stock) {
    showToast(`Only ${item.max_stock} items available`, 'warning');
    quantity = item.max_stock;
  }
  
  item.quantity = quantity;
  
  // Update server
  if (userId && item.cart_id) {
    try {
      await fetch('/api/customer/cart', {
        method: 'PUT',
        headers: AuthService.getAuthHeaders(),
        body: JSON.stringify({
          cart_id: item.cart_id,
          quantity: quantity,
          cust_id: userId
        })
      });
    } catch (error) {
      console.error('Error updating cart quantity:', error);
    }
  }
  
  saveCartToStorage();
  notifyCartListeners();
  updateCartCountDisplay();
  
  return true;
}

// =====================================================
// Remove Item from Cart
// =====================================================
async function removeCartItem(index) {
  if (index < 0 || index >= cartItems.length) return false;
  
  const item = cartItems[index];
  const userId = getCurrentUserId();
  
  // Remove from server
  if (userId && item.cart_id) {
    try {
      await fetch(`/api/customer/cart?cart_id=${item.cart_id}&cust_id=${userId}`, {
        method: 'DELETE',
        headers: AuthService.getAuthHeaders()
      });
    } catch (error) {
      console.error('Error removing cart item:', error);
    }
  }
  
  cartItems.splice(index, 1);
  
  saveCartToStorage();
  notifyCartListeners();
  updateCartCountDisplay();
  showToast('Item removed from cart', 'info');
  
  return true;
}

// =====================================================
// Clear Cart
// =====================================================
async function clearCart() {
  const userId = getCurrentUserId();
  
  // Clear from server
  if (userId) {
    try {
      await fetch(`/api/customer/cart?cust_id=${userId}`, {
        method: 'DELETE',
        headers: AuthService.getAuthHeaders()
      });
    } catch (error) {
      console.error('Error clearing server cart:', error);
    }
  }
  
  cartItems = [];
  saveCartToStorage();
  notifyCartListeners();
  updateCartCountDisplay();
}

// =====================================================
// Update Cart Count Display
// =====================================================
function updateCartCountDisplay() {
  const count = getCartCount();
  const cartBadges = document.querySelectorAll('.cart-count, .cart-badge');
  cartBadges.forEach(badge => {
    if (count > 0) {
      badge.textContent = count;
      badge.style.display = 'flex';
    } else {
      badge.style.display = 'none';
    }
  });
}

// =====================================================
// Add Cart Listener
// =====================================================
function addCartListener(listener) {
  cartListeners.push(listener);
}

// =====================================================
// Remove Cart Listener
// =====================================================
function removeCartListener(listener) {
  cartListeners = cartListeners.filter(l => l !== listener);
}

// =====================================================
// Notify Cart Listeners
// =====================================================
function notifyCartListeners() {
  cartListeners.forEach(listener => {
    try {
      listener(cartItems);
    } catch (e) {
      console.error('Cart listener error:', e);
    }
  });
}

// =====================================================
// Render Cart Page
// =====================================================
function renderCartPage(containerId) {
  const container = document.getElementById(containerId);
  if (!container) return;
  
  if (isCartEmpty()) {
    container.innerHTML = `
      <div class="empty-cart text-center py-8">
        <i class="fa-solid fa-cart-shopping text-6xl text-gray-300 mb-4"></i>
        <h3 class="text-xl font-bold text-gray-700 mb-2">Your cart is empty</h3>
        <p class="text-gray-500 mb-4">Looks like you haven't added anything to your cart yet</p>
        <a href="/shop.html" class="btn btn-primary">Continue Shopping</a>
      </div>
    `;
    return;
  }
  
  let itemsHtml = '';
  let subtotal = 0;
  
  cartItems.forEach((item, index) => {
    subtotal += item.total;
    itemsHtml += `
      <div class="cart-item mb-4" data-index="${index}">
        <div class="cart-item-image">
          <img src="${item.image || 'https://via.placeholder.com/80'}" alt="${item.name}">
        </div>
        <div class="cart-item-details">
          <div class="cart-item-title">${item.name}</div>
          ${item.variation_details ? `<div class="cart-item-variant text-sm text-gray-500">${item.variation_details.size || ''} ${item.variation_details.color || ''}</div>` : ''}
          <div class="cart-item-price">${formatPrice(item.price)}</div>
          <div class="cart-item-quantity">
            <button class="quantity-decrease" data-index="${index}">-</button>
            <span class="quantity-value">${item.quantity}</span>
            <button class="quantity-increase" data-index="${index}">+</button>
            <button class="cart-item-remove ml-4" data-index="${index}">
              <i class="fa-solid fa-trash-can"></i> Remove
            </button>
          </div>
        </div>
        <div class="cart-item-total text-right">
          <div class="font-bold text-blue-900">${formatPrice(item.total)}</div>
          <div class="text-sm text-green-600">${item.discountPercent}% OFF</div>
        </div>
      </div>
    `;
  });
  
  const deliveryCharge = subtotal >= 499 ? 0 : 40;
  const total = subtotal + deliveryCharge;
  
  container.innerHTML = `
    <div class="cart-container">
      <div class="cart-items">
        ${itemsHtml}
      </div>
      <div class="cart-summary">
        <h3 class="font-bold text-lg mb-4">Order Summary</h3>
        <div class="summary-row">
          <span>Subtotal</span>
          <span>${formatPrice(subtotal)}</span>
        </div>
        <div class="summary-row">
          <span>Delivery Charge</span>
          <span>${deliveryCharge === 0 ? 'FREE' : formatPrice(deliveryCharge)}</span>
        </div>
        <div class="summary-row total">
          <span>Total</span>
          <span>${formatPrice(total)}</span>
        </div>
        <button class="btn btn-primary btn-block checkout-btn mt-4">
          Proceed to Checkout
        </button>
      </div>
    </div>
  `;
  
  // Attach event listeners
  container.querySelectorAll('.quantity-decrease').forEach(btn => {
    btn.addEventListener('click', () => {
      const idx = parseInt(btn.dataset.index);
      const item = cartItems[idx];
      if (item.quantity > 1) {
        updateCartQuantity(idx, item.quantity - 1);
        renderCartPage(containerId);
      }
    });
  });
  
  container.querySelectorAll('.quantity-increase').forEach(btn => {
    btn.addEventListener('click', () => {
      const idx = parseInt(btn.dataset.index);
      const item = cartItems[idx];
      if (item.quantity < item.max_stock) {
        updateCartQuantity(idx, item.quantity + 1);
        renderCartPage(containerId);
      }
    });
  });
  
  container.querySelectorAll('.cart-item-remove').forEach(btn => {
    btn.addEventListener('click', () => {
      const idx = parseInt(btn.dataset.index);
      removeCartItem(idx).then(() => renderCartPage(containerId));
    });
  });
  
  const checkoutBtn = container.querySelector('.checkout-btn');
  if (checkoutBtn) {
    checkoutBtn.addEventListener('click', () => {
      window.location.href = '/customer/checkout.html';
    });
  }
}

// =====================================================
// Export functions
// =====================================================
window.CartManager = {
  initCart,
  getCartItems,
  getCartCount,
  getCartTotal,
  getCartSubtotal,
  getCartDiscount,
  isCartEmpty,
  addToCart,
  updateCartQuantity,
  removeCartItem,
  clearCart,
  addCartListener,
  removeCartListener,
  renderCartPage,
  syncCartWithServer
};

// Initialize on load
document.addEventListener('DOMContentLoaded', () => {
  initCart();
});