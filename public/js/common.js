// Common utilities and functions shared across pages
class CommonUtils {
  constructor() {
    this.init();
  }

  init() {
    this.setupGlobalEventListeners();
    this.initializeAnimations();
  }

  setupGlobalEventListeners() {
    // Mobile navigation toggle
    const navToggle = document.getElementById('navToggle');
    const navMenu = document.getElementById('navMenu');
    
    if (navToggle && navMenu) {
      navToggle.addEventListener('click', () => {
        navMenu.classList.toggle('active');
        navToggle.classList.toggle('active');
      });
    }

    // Smooth scrolling for anchor links
    document.querySelectorAll('a[href^="#"]').forEach(anchor => {
      anchor.addEventListener('click', function (e) {
        e.preventDefault();
        const target = document.querySelector(this.getAttribute('href'));
        if (target) {
          target.scrollIntoView({
            behavior: 'smooth',
            block: 'start'
          });
        }
      });
    });

    // Close mobile menu when clicking outside
    document.addEventListener('click', (e) => {
      if (navMenu && navToggle && !navMenu.contains(e.target) && !navToggle.contains(e.target)) {
        navMenu.classList.remove('active');
        navToggle.classList.remove('active');
      }
    });
  }

  initializeAnimations() {
    // Intersection Observer for fade-in animations
    const observerOptions = {
      threshold: 0.1,
      rootMargin: '0px 0px -50px 0px'
    };

    const observer = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          entry.target.style.opacity = '1';
          entry.target.style.transform = 'translateY(0)';
        }
      });
    }, observerOptions);

    // Observe elements with fade-in class
    document.querySelectorAll('.fade-in').forEach(el => {
      el.style.opacity = '0';
      el.style.transform = 'translateY(30px)';
      el.style.transition = 'opacity 0.6s ease, transform 0.6s ease';
      observer.observe(el);
    });
  }

  // Toast notification system
  showToast(message, type = 'info', duration = 5000) {
    const toastContainer = this.getOrCreateToastContainer();
    
    const iconMap = {
      success: 'fas fa-check-circle',
      warning: 'fas fa-exclamation-triangle',
      error: 'fas fa-times-circle',
      info: 'fas fa-info-circle'
    };

    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    toast.innerHTML = `
      <i class="${iconMap[type]}"></i>
      <span>${message}</span>
      <button class="toast-close" onclick="this.parentElement.remove()">
        <i class="fas fa-times"></i>
      </button>
    `;

    // Add close button styles
    const closeBtn = toast.querySelector('.toast-close');
    if (closeBtn) {
      closeBtn.style.cssText = `
        background: none;
        border: none;
        color: inherit;
        cursor: pointer;
        padding: 0;
        margin-left: auto;
        opacity: 0.7;
        transition: opacity 0.2s;
      `;
      closeBtn.addEventListener('mouseenter', () => closeBtn.style.opacity = '1');
      closeBtn.addEventListener('mouseleave', () => closeBtn.style.opacity = '0.7');
    }

    toastContainer.appendChild(toast);

    // Auto remove after duration
    setTimeout(() => {
      if (toast.parentNode) {
        toast.style.animation = 'slideIn 0.3s ease reverse';
        setTimeout(() => {
          if (toast.parentNode) {
            toast.parentNode.removeChild(toast);
          }
        }, 300);
      }
    }, duration);

    return toast;
  }

  getOrCreateToastContainer() {
    let container = document.getElementById('toastContainer');
    if (!container) {
      container = document.createElement('div');
      container.id = 'toastContainer';
      container.className = 'toast-container';
      document.body.appendChild(container);
    }
    return container;
  }

  // Loading overlay
  showLoading(message = 'Processing...') {
    const overlay = this.getOrCreateLoadingOverlay();
    const messageEl = overlay.querySelector('.loading-message');
    if (messageEl) {
      messageEl.textContent = message;
    }
    overlay.classList.remove('hidden');
  }

  hideLoading() {
    const overlay = this.getOrCreateLoadingOverlay();
    overlay.classList.add('hidden');
  }

  getOrCreateLoadingOverlay() {
    let overlay = document.getElementById('loadingOverlay');
    if (!overlay) {
      overlay = document.createElement('div');
      overlay.id = 'loadingOverlay';
      overlay.className = 'loading-overlay hidden';
      overlay.innerHTML = `
        <div class="loading-content">
          <div class="spinner"></div>
          <h3 class="loading-message">Processing...</h3>
        </div>
      `;
      document.body.appendChild(overlay);
    }
    return overlay;
  }
}

// Initialize common utils
const commonUtils = new CommonUtils();

// Expose globally
window.showToast = (msg, type) => commonUtils.showToast(msg, type);
window.showLoading = (msg) => commonUtils.showLoading(msg);
window.hideLoading = () => commonUtils.hideLoading();
