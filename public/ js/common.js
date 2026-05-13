/**
 * Suriyawan Saffari - Common JavaScript Functions
 * Shared utilities across all portals
 */

// =====================================================
// DOM Ready Event Handler
// =====================================================
document.addEventListener('DOMContentLoaded', function() {
  initCommon();
  attachGlobalEventListeners();
  setupMobileMenu();
  setupBackButton();
  setupToastContainer();
});

// =====================================================
// Initialize Common Components
// =====================================================
function initCommon() {
  // Set current year in footer
  const yearElements = document.querySelectorAll('.current-year');
  yearElements.forEach(el => {
    el.textContent = new Date().getFullYear();
  });
  
  // Initialize tooltips
  initTooltips();
  
  // Initialize dropdowns
  initDropdowns();
  
  // Initialize modals
  initModals();
  
  // Initialize loaders
  initLoaders();
}

// =====================================================
// Toast Notifications
// =====================================================
let toastContainer = null;

function setupToastContainer() {
  if (!document.querySelector('.toast-container')) {
    const container = document.createElement('div');
    container.className = 'toast-container';
    container.style.cssText = `
      position: fixed;
      bottom: 20px;
      right: 20px;
      z-index: 9999;
      display: flex;
      flex-direction: column;
      gap: 10px;
    `;
    document.body.appendChild(container);
    toastContainer = container;
  } else {
    toastContainer = document.querySelector('.toast-container');
  }
}

function showToast(message, type = 'success', duration = 3000) {
  const toast = document.createElement('div');
  toast.className = `toast-notification toast-${type}`;
  toast.style.cssText = `
    background: ${type === 'success' ? '#10b981' : type === 'error' ? '#ef4444' : type === 'warning' ? '#f59e0b' : '#3b82f6'};
    color: white;
    padding: 12px 20px;
    border-radius: 8px;
    font-size: 14px;
    font-weight: 500;
    box-shadow: 0 4px 12px rgba(0,0,0,0.15);
    animation: slideInRight 0.3s ease;
    cursor: pointer;
  `;
  toast.textContent = message;
  
  toast.addEventListener('click', () => {
    toast.remove();
  });
  
  toastContainer.appendChild(toast);
  
  setTimeout(() => {
    if (toast.parentNode) {
      toast.style.animation = 'slideOutRight 0.3s ease';
      setTimeout(() => toast.remove(), 300);
    }
  }, duration);
}

// =====================================================
// Loading States
// =====================================================
function showLoading(containerId) {
  const container = document.getElementById(containerId);
  if (container) {
    const loader = document.createElement('div');
    loader.className = 'loading-overlay';
    loader.id = `loader-${containerId}`;
    loader.style.cssText = `
      position: absolute;
      top: 0;
      left: 0;
      right: 0;
      bottom: 0;
      background: rgba(255,255,255,0.8);
      display: flex;
      align-items: center;
      justify-content: center;
      z-index: 100;
    `;
    loader.innerHTML = '<div class="loader"></div>';
    container.style.position = 'relative';
    container.appendChild(loader);
  }
}

function hideLoading(containerId) {
  const loader = document.getElementById(`loader-${containerId}`);
  if (loader) {
    loader.remove();
  }
}

function showPageLoader() {
  let loader = document.getElementById('page-loader');
  if (!loader) {
    loader = document.createElement('div');
    loader.id = 'page-loader';
    loader.style.cssText = `
      position: fixed;
      top: 0;
      left: 0;
      right: 0;
      bottom: 0;
      background: rgba(255,255,255,0.9);
      display: flex;
      align-items: center;
      justify-content: center;
      z-index: 99999;
    `;
    loader.innerHTML = '<div class="loader-lg"></div>';
    document.body.appendChild(loader);
  }
  loader.style.display = 'flex';
}

function hidePageLoader() {
  const loader = document.getElementById('page-loader');
  if (loader) {
    loader.style.display = 'none';
  }
}

// =====================================================
// Tooltips
// =====================================================
function initTooltips() {
  const tooltips = document.querySelectorAll('[data-tooltip]');
  tooltips.forEach(el => {
    el.addEventListener('mouseenter', showTooltip);
    el.addEventListener('mouseleave', hideTooltip);
  });
}

function showTooltip(e) {
  const tooltipText = e.target.getAttribute('data-tooltip');
  if (!tooltipText) return;
  
  const tooltip = document.createElement('div');
  tooltip.className = 'custom-tooltip';
  tooltip.textContent = tooltipText;
  tooltip.style.cssText = `
    position: absolute;
    background: #1f2937;
    color: white;
    padding: 4px 8px;
    border-radius: 4px;
    font-size: 12px;
    white-space: nowrap;
    z-index: 1000;
    pointer-events: none;
  `;
  
  const rect = e.target.getBoundingClientRect();
  tooltip.style.top = `${rect.top - 30 + window.scrollY}px`;
  tooltip.style.left = `${rect.left + (rect.width / 2) - (tooltip.offsetWidth / 2)}px`;
  
  document.body.appendChild(tooltip);
  e.target._tooltip = tooltip;
}

function hideTooltip(e) {
  if (e.target._tooltip) {
    e.target._tooltip.remove();
    delete e.target._tooltip;
  }
}

// =====================================================
// Dropdowns
// =====================================================
function initDropdowns() {
  const dropdowns = document.querySelectorAll('.dropdown');
  dropdowns.forEach(dropdown => {
    const trigger = dropdown.querySelector('.dropdown-trigger');
    const menu = dropdown.querySelector('.dropdown-menu');
    
    if (trigger && menu) {
      trigger.addEventListener('click', (e) => {
        e.stopPropagation();
        menu.classList.toggle('show');
      });
    }
  });
  
  // Close dropdowns when clicking outside
  document.addEventListener('click', () => {
    document.querySelectorAll('.dropdown-menu.show').forEach(menu => {
      menu.classList.remove('show');
    });
  });
}

// =====================================================
// Modals
// =====================================================
function initModals() {
  const modals = document.querySelectorAll('.modal');
  modals.forEach(modal => {
    const closeBtn = modal.querySelector('.modal-close, .close-modal');
    if (closeBtn) {
      closeBtn.addEventListener('click', () => closeModal(modal.id));
    }
  });
}

function openModal(modalId) {
  const modal = document.getElementById(modalId);
  if (modal) {
    modal.classList.add('active');
    document.body.style.overflow = 'hidden';
  }
}

function closeModal(modalId) {
  const modal = document.getElementById(modalId);
  if (modal) {
    modal.classList.remove('active');
    document.body.style.overflow = '';
  }
}

// =====================================================
// Loaders
// =====================================================
function initLoaders() {
  // Auto-hide loaders after content loads
  const loaders = document.querySelectorAll('.auto-hide-loader');
  loaders.forEach(loader => {
    setTimeout(() => {
      loader.style.display = 'none';
    }, 1000);
  });
}

// =====================================================
// Mobile Menu
// =====================================================
function setupMobileMenu() {
  const menuToggle = document.querySelector('.mobile-menu-toggle');
  const mobileMenu = document.querySelector('.mobile-menu');
  
  if (menuToggle && mobileMenu) {
    menuToggle.addEventListener('click', () => {
      mobileMenu.classList.toggle('active');
      document.body.classList.toggle('menu-open');
    });
  }
}

// =====================================================
// Back Button
// =====================================================
function setupBackButton() {
  const backButtons = document.querySelectorAll('.back-button');
  backButtons.forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.preventDefault();
      if (document.referrer && document.referrer.includes(window.location.host)) {
        window.history.back();
      } else {
        window.location.href = '/';
      }
    });
  });
}

// =====================================================
// Global Event Listeners
// =====================================================
function attachGlobalEventListeners() {
  // Handle ESC key to close modals
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      document.querySelectorAll('.modal.active').forEach(modal => {
        closeModal(modal.id);
      });
    }
  });
  
  // Handle form submissions with loading state
  const forms = document.querySelectorAll('form[data-loading]');
  forms.forEach(form => {
    form.addEventListener('submit', () => {
      const submitBtn = form.querySelector('button[type="submit"]');
      if (submitBtn) {
        submitBtn.disabled = true;
        submitBtn.innerHTML = '<span class="loader-sm"></span> Loading...';
      }
    });
  });
}

// =====================================================
// Form Validation
// =====================================================
function validateEmail(email) {
  const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return re.test(email);
}

function validateMobile(mobile) {
  const re = /^[6-9]\d{9}$/;
  return re.test(mobile);
}

function validatePincode(pincode) {
  const re = /^[1-9][0-9]{5}$/;
  return re.test(pincode);
}

function validatePan(pan) {
  const re = /^[A-Z]{5}[0-9]{4}[A-Z]{1}$/;
  return re.test(pan);
}

function validateGst(gst) {
  const re = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/;
  return re.test(gst);
}

// =====================================================
// Formatting Functions
// =====================================================
function formatPrice(amount) {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0
  }).format(amount);
}

function formatDate(date, format = 'DD/MM/YYYY') {
  const d = new Date(date);
  const day = String(d.getDate()).padStart(2, '0');
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const year = d.getFullYear();
  
  return format
    .replace('DD', day)
    .replace('MM', month)
    .replace('YYYY', year);
}

function formatDateTime(date) {
  return formatDate(date, 'DD/MM/YYYY') + ' ' + new Date(date).toLocaleTimeString('en-IN');
}

function formatRelativeTime(date) {
  const now = new Date();
  const diff = now - new Date(date);
  const minutes = Math.floor(diff / 60000);
  const hours = Math.floor(diff / 3600000);
  const days = Math.floor(diff / 86400000);
  
  if (minutes < 1) return 'Just now';
  if (minutes < 60) return `${minutes} minute${minutes > 1 ? 's' : ''} ago`;
  if (hours < 24) return `${hours} hour${hours > 1 ? 's' : ''} ago`;
  if (days < 7) return `${days} day${days > 1 ? 's' : ''} ago`;
  return formatDate(date);
}

// =====================================================
// Number Formatting
// =====================================================
function formatNumber(num) {
  if (num >= 10000000) return (num / 10000000).toFixed(1) + 'Cr';
  if (num >= 100000) return (num / 100000).toFixed(1) + 'L';
  if (num >= 1000) return (num / 1000).toFixed(1) + 'K';
  return num.toString();
}

// =====================================================
// Copy to Clipboard
// =====================================================
async function copyToClipboard(text) {
  try {
    await navigator.clipboard.writeText(text);
    showToast('Copied to clipboard!', 'success');
    return true;
  } catch (err) {
    console.error('Copy failed:', err);
    showToast('Failed to copy', 'error');
    return false;
  }
}

// =====================================================
// Debounce Function
// =====================================================
function debounce(func, wait) {
  let timeout;
  return function executedFunction(...args) {
    const later = () => {
      clearTimeout(timeout);
      func(...args);
    };
    clearTimeout(timeout);
    timeout = setTimeout(later, wait);
  };
}

// =====================================================
// Throttle Function
// =====================================================
function throttle(func, limit) {
  let inThrottle;
  return function(...args) {
    if (!inThrottle) {
      func.apply(this, args);
      inThrottle = true;
      setTimeout(() => inThrottle = false, limit);
    }
  };
}

// =====================================================
// Get Query Parameter
// =====================================================
function getQueryParam(param) {
  const urlParams = new URLSearchParams(window.location.search);
  return urlParams.get(param);
}

// =====================================================
// Set Query Parameter
// =====================================================
function setQueryParam(param, value) {
  const url = new URL(window.location.href);
  url.searchParams.set(param, value);
  window.history.pushState({}, '', url);
}

// =====================================================
// Remove Query Parameter
// =====================================================
function removeQueryParam(param) {
  const url = new URL(window.location.href);
  url.searchParams.delete(param);
  window.history.pushState({}, '', url);
}

// =====================================================
// Scroll to Top
// =====================================================
function scrollToTop() {
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

// =====================================================
// Scroll to Element
// =====================================================
function scrollToElement(elementId) {
  const element = document.getElementById(elementId);
  if (element) {
    element.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }
}

// =====================================================
// Export functions
// =====================================================
window.CommonUtils = {
  showToast,
  showLoading,
  hideLoading,
  showPageLoader,
  hidePageLoader,
  openModal,
  closeModal,
  validateEmail,
  validateMobile,
  validatePincode,
  validatePan,
  validateGst,
  formatPrice,
  formatDate,
  formatDateTime,
  formatRelativeTime,
  formatNumber,
  copyToClipboard,
  debounce,
  throttle,
  getQueryParam,
  setQueryParam,
  removeQueryParam,
  scrollToTop,
  scrollToElement
};