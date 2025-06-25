// Dashboard page JavaScript

// Socket.io connection
const socket = io({
  transports: ['websocket', 'polling'],
  timeout: 20000,
  reconnection: true,
  reconnectionDelay: 1000,
  reconnectionAttempts: 5,
  maxReconnectionAttempts: 5
});

let currentPage = 1;
let articlesPerPage = 10;
let isConnected = false;

// Initialize app
window.addEventListener('DOMContentLoaded', () => {
  initializeApp();
  setupEventListeners();
  loadInitialData();
});

function initializeApp() {
  socket.on('connect', () => {
    isConnected = true;
    addActivity('Connected to server', 'success');
    updateSocketStatus(true);
    updateStats();
  });

  socket.on('disconnect', (reason) => {
    isConnected = false;
    addActivity(`Disconnected: ${reason}`, 'error');
    updateSocketStatus(false);
  });

  socket.on('connect_error', (error) => {
    addActivity('Connection error occurred', 'error');
    updateSocketStatus(false);
  });

  socket.on('reconnect', (attemptNumber) => {
    addActivity(`Reconnected after ${attemptNumber} attempts`, 'success');
    updateSocketStatus(true);
    updateStats();
  });

  socket.on('reconnect_error', () => {
    addActivity('Reconnection failed', 'error');
  });

  socket.on('articleQueued', (data) => {
    addActivity(`Article queued: ${data.title} (ID: ${data.id})`, 'success');
    updateStats();
    refreshArticles();
  });

  socket.on('connected', (data) => {
    addActivity(data.message, 'info');
  });

  setInterval(() => {
    if (isConnected) {
      updateStats();
    }
  }, 30000);
}

function updateSocketStatus(connected) {
  const socketStatus = document.getElementById('socketStatus');
  const dot = socketStatus.querySelector('.status-dot');
  if (connected) {
    dot.classList.remove('offline');
    dot.classList.add('online');
  } else {
    dot.classList.remove('online');
    dot.classList.add('offline');
  }
}

function setupEventListeners() {
  const articleForm = document.getElementById('articleForm');
  if (articleForm) {
    articleForm.addEventListener('submit', handleArticleSubmit);
  }

  const uploadArea = document.getElementById('uploadArea');
  const fileInput = document.getElementById('fileInput');

  if (uploadArea && fileInput) {
    uploadArea.addEventListener('click', () => fileInput.click());
    uploadArea.addEventListener('dragover', handleDragOver);
    uploadArea.addEventListener('dragleave', handleDragLeave);
    uploadArea.addEventListener('drop', handleFileDrop);
    fileInput.addEventListener('change', handleFileSelect);
  }

  // Sidebar navigation
  const sidebarLinks = document.querySelectorAll('.sidebar-link');
  sidebarLinks.forEach(link => {
    link.addEventListener('click', (e) => {
      e.preventDefault();
      sidebarLinks.forEach(l => l.classList.remove('active'));
      link.classList.add('active');
      
      const target = link.getAttribute('href');
      if (target && target.startsWith('#')) {
        const section = document.querySelector(target);
        if (section) {
          section.scrollIntoView({ behavior: 'smooth' });
        }
      }
    });
  });

  window.switchTab = switchTab;
  window.clearActivity = clearActivity;
  window.refreshArticles = refreshArticles;
  window.updateStats = updateStats;
}

async function loadInitialData() {
  showLoading();
  try {
    await updateStats();
    await loadArticles();
  } catch (error) {
    showToast('Failed to load initial data', 'error');
  } finally {
    hideLoading();
  }
}

async function updateStats() {
  try {
    const response = await fetch('/api/status');
    const data = await response.json();

    // Animate stat numbers
    animateStatNumber('totalArticles', data.mongodb.totalArticles || 0);
    animateStatNumber('storylineArticles', data.mongodb.storylineArticles || 0);
    animateStatNumber('queuedMessages', data.rabbitmq.messagesInQueue || 0);
    animateStatNumber('activeConsumers', data.rabbitmq.activeConsumers || 0);

    updateStatusIndicator('mongoStatus', data.mongodb.connected);
    updateStatusIndicator('rabbitStatus', data.rabbitmq.connected);
  } catch {
    showToast('Failed to update statistics', 'error');
  }
}

function animateStatNumber(elementId, targetValue) {
  const element = document.getElementById(elementId);
  if (!element) return;
  
  const currentValue = parseInt(element.textContent) || 0;
  const increment = (targetValue - currentValue) / 20;
  let current = currentValue;
  
  const animate = () => {
    current += increment;
    if ((increment > 0 && current < targetValue) || (increment < 0 && current > targetValue)) {
      element.textContent = Math.floor(current);
      requestAnimationFrame(animate);
    } else {
      element.textContent = targetValue;
    }
  };
  
  if (increment !== 0) {
    animate();
  }
}

function updateStatusIndicator(elementId, isConnected) {
  const element = document.getElementById(elementId);
  if (!element) return;
  const dot = element.querySelector('.status-dot');
  if (!dot) return;
  if (isConnected) {
    dot.classList.remove('offline');
    dot.classList.add('online');
  } else {
    dot.classList.remove('online');
    dot.classList.add('offline');
  }
}

async function handleArticleSubmit(e) {
  e.preventDefault();
  const formData = new FormData(e.target);
  const articleData = Object.fromEntries(formData.entries());
  articleData.id = parseInt(articleData.id);
  
  if (articleData.type !== 'storyline') {
    showToast('Only storyline articles are accepted', 'warning');
    return;
  }
  
  showLoading();
  try {
    const response = await fetch('/api/article', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(articleData)
    });
    const result = await response.json();
    if (response.ok) {
      showToast('Article queued successfully!', 'success');
      e.target.reset();
      addActivity(`Manual article added: ${articleData.title}`, 'success');
    } else {
      showToast(result.error || 'Failed to queue article', 'error');
    }
  } catch {
    showToast('Network error. Please try again.', 'error');
  } finally {
    hideLoading();
  }
}

function handleDragOver(e) {
  e.preventDefault();
  e.currentTarget.classList.add('dragover');
}

function handleDragLeave(e) {
  e.preventDefault();
  e.currentTarget.classList.remove('dragover');
}

function handleFileDrop(e) {
  e.preventDefault();
  e.currentTarget.classList.remove('dragover');
  const files = e.dataTransfer.files;
  if (files.length > 0) {
    handleFileUpload(files[0]);
  }
}

function handleFileSelect(e) {
  const file = e.target.files[0];
  if (file) {
    handleFileUpload(file);
  }
}

async function handleFileUpload(file) {
  if (!file.name.endsWith('.json')) {
    showToast('Please select a JSON file', 'error');
    return;
  }
  
  const formData = new FormData();
  formData.append('jsonFile', file);
  const uploadProgress = document.getElementById('uploadProgress');
  uploadProgress.classList.remove('hidden');
  const progressFill = uploadProgress.querySelector('.progress-fill');
  progressFill.style.width = '0%';
  
  setTimeout(() => { progressFill.style.width = '100%'; }, 100);
  
  try {
    const response = await fetch('/api/upload', { method: 'POST', body: formData });
    const result = await response.json();
    if (response.ok) {
      showToast(`File processed: ${result.processed} articles queued, ${result.skipped} skipped`, 'success');
      addActivity(`File uploaded: ${result.processed} storyline articles queued`, 'success');
      if (result.skipped > 0) {
        addActivity(`${result.skipped} non-storyline articles skipped`, 'warning');
      }
    } else {
      showToast(result.error || 'Failed to process file', 'error');
    }
  } catch {
    showToast('Upload failed. Please try again.', 'error');
  } finally {
    setTimeout(() => { 
      uploadProgress.classList.add('hidden'); 
      progressFill.style.width = '0%'; 
    }, 1000);
  }
}

async function loadArticles(page = 1) {
  try {
    const response = await fetch(`/api/articles?page=${page}&limit=${articlesPerPage}`);
    const data = await response.json();
    displayArticles(data.articles);
    updatePagination(data.pagination);
    currentPage = page;
  } catch {
    showToast('Failed to load articles', 'error');
    const tbody = document.getElementById('articlesTableBody');
    tbody.innerHTML = '<tr><td colspan="6" class="no-data">Failed to load articles</td></tr>';
  }
}

function displayArticles(articles) {
  const tbody = document.getElementById('articlesTableBody');
  if (!articles || articles.length === 0) {
    tbody.innerHTML = `
      <tr>
        <td colspan="6" class="no-data">
          <div class="empty-state">
            <i class="fas fa-inbox"></i>
            <h3>No articles found</h3>
            <p>Start by adding some articles to see them here</p>
          </div>
        </td>
      </tr>
    `;
    return;
  }
  
  tbody.innerHTML = articles.map(article => `
    <tr>
      <td>${article.id}</td>
      <td>${article.title || 'N/A'}</td>
      <td><span class="status-badge ${article.type === 'storyline' ? 'processed' : 'failed'}">${article.type || 'N/A'}</span></td>
      <td>${new Date(article.processedAt).toLocaleString()}</td>
      <td><span class="status-badge processed"><i class="fas fa-check"></i> Processed</span></td>
      <td>
        <button class="btn btn-sm btn-secondary" onclick="viewArticle('${article.id}')">
          <i class="fas fa-eye"></i>
        </button>
      </td>
    </tr>
  `).join('');
}

function updatePagination(pagination) {
  const paginationContainer = document.getElementById('pagination');
  if (!pagination || pagination.pages <= 1) {
    paginationContainer.innerHTML = '';
    return;
  }
  
  let paginationHTML = '';
  paginationHTML += `<button onclick="loadArticles(${pagination.page - 1})" ${pagination.page === 1 ? 'disabled' : ''}><i class="fas fa-chevron-left"></i> Previous</button>`;
  
  for (let i = 1; i <= pagination.pages; i++) {
    if (i === pagination.page) {
      paginationHTML += `<button class="active">${i}</button>`;
    } else {
      paginationHTML += `<button onclick="loadArticles(${i})">${i}</button>`;
    }
  }
  
  paginationHTML += `<button onclick="loadArticles(${pagination.page + 1})" ${pagination.page === pagination.pages ? 'disabled' : ''}>Next <i class="fas fa-chevron-right"></i></button>`;
  paginationContainer.innerHTML = paginationHTML;
}

async function refreshArticles() {
  await loadArticles(currentPage);
  showToast('Articles refreshed', 'info');
}

function addActivity(message, type = 'info') {
  const activityFeed = document.getElementById('activityFeed');
  const timestamp = new Date().toLocaleTimeString();
  const iconMap = {
    success: 'fas fa-check-circle',
    warning: 'fas fa-exclamation-triangle',
    error: 'fas fa-times-circle',
    info: 'fas fa-info-circle'
  };
  
  const activityItem = document.createElement('div');
  activityItem.className = `activity-item ${type}`;
  activityItem.innerHTML = `
    <div class="activity-icon">
      <i class="${iconMap[type]}"></i>
    </div>
    <div class="activity-content">
      <div class="activity-header">
        <h4>${type.charAt(0).toUpperCase() + type.slice(1)}</h4>
        <span class="activity-time">${timestamp}</span>
      </div>
      <p>${message}</p>
    </div>
  `;
  
  activityFeed.insertBefore(activityItem, activityFeed.firstChild);
  
  while (activityFeed.children.length > 50) {
    activityFeed.removeChild(activityFeed.lastChild);
  }
  
  activityFeed.scrollTop = 0;
}

function clearActivity() {
  const activityFeed = document.getElementById('activityFeed');
  activityFeed.innerHTML = `
    <div class="activity-item info">
      <div class="activity-icon">
        <i class="fas fa-info-circle"></i>
      </div>
      <div class="activity-content">
        <div class="activity-header">
          <h4>System</h4>
          <span class="activity-time">Just now</span>
        </div>
        <p>Activity feed cleared</p>
      </div>
    </div>
  `;
}

function switchTab(tabName) {
  document.querySelectorAll('.tab-btn').forEach(btn => btn.classList.remove('active'));
  event.target.classList.add('active');
  document.querySelectorAll('.tab-content').forEach(content => content.classList.remove('active'));
  document.getElementById(tabName + 'Tab').classList.add('active');
}

function viewArticle(articleId) {
  showToast(`Viewing article ${articleId}`, 'info');
  // Add your article viewing logic here
}

function showToast(message, type = 'info') {
  const toastContainer = document.getElementById('toastContainer');
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
  `;
  
  toastContainer.appendChild(toast);
  
  setTimeout(() => {
    toast.style.animation = 'slideIn 0.3s ease reverse';
    setTimeout(() => {
      if (toast.parentNode) {
        toast.parentNode.removeChild(toast);
      }
    }, 300);
  }, 5000);
}

function showLoading() {
  document.getElementById('loadingOverlay').classList.remove('hidden');
}

function hideLoading() {
  document.getElementById('loadingOverlay').classList.add('hidden');
}

// Error handling
window.addEventListener('error', (e) => {
  showToast('An unexpected error occurred', 'error');
});

window.addEventListener('unhandledrejection', (e) => {
  showToast('An unexpected error occurred', 'error');
});

// Real-time clock
function updateClock() {
  const now = new Date();
  const timeString = now.toLocaleTimeString();
  const clockElement = document.querySelector('.dashboard-clock');
  if (clockElement) {
    clockElement.textContent = timeString;
  }
}

setInterval(updateClock, 1000);
updateClock();
