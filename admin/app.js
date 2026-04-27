// API Base URL
const API_BASE_URL = window.location.origin + '/api';

// State
let currentUser = null;
let authToken = localStorage.getItem('adminToken');
let currentPage = 'dashboard';
let bookingsChart = null;
let messagesChart = null;
let bookingsData = { data: [], pagination: {} };
let contactsData = { data: [], pagination: {} };

// DOM Elements
const loginPage = document.getElementById('loginPage');
const adminPage = document.getElementById('adminPage');
const loginForm = document.getElementById('loginForm');
const loginError = document.getElementById('loginError');
const logoutBtn = document.getElementById('logoutBtn');
const refreshBtn = document.getElementById('refreshBtn');
const toastContainer = document.getElementById('toastContainer');

// Initialize
document.addEventListener('DOMContentLoaded', () => {
    if (authToken) {
        verifyToken();
    }
    
    setupEventListeners();
});

// Event Listeners
function setupEventListeners() {
    // Login form
    loginForm.addEventListener('submit', handleLogin);
    
    // Logout
    logoutBtn.addEventListener('click', handleLogout);
    
    // Refresh
    refreshBtn.addEventListener('click', () => {
        refreshData();
        showToast('Data refreshed', 'success');
    });
    
    // Navigation
    document.querySelectorAll('.nav-link').forEach(link => {
        link.addEventListener('click', (e) => {
            e.preventDefault();
            const page = e.currentTarget.dataset.page;
            if (page) {
                navigateToPage(page);
            }
        });
    });
    
    // View all links
    document.querySelectorAll('.view-all').forEach(link => {
        link.addEventListener('click', (e) => {
            e.preventDefault();
            const page = e.currentTarget.dataset.page;
            if (page) {
                navigateToPage(page);
            }
        });
    });
    
    // Booking filters
    document.getElementById('bookingStatusFilter')?.addEventListener('change', () => loadBookings(1));
    document.getElementById('bookingDateFilter')?.addEventListener('change', () => loadBookings(1));
    document.getElementById('bookingSearch')?.addEventListener('input', debounce(() => loadBookings(1), 300));
    
    // Contact filters
    document.getElementById('contactStatusFilter')?.addEventListener('change', () => loadContacts(1));
    document.getElementById('contactSearch')?.addEventListener('input', debounce(() => loadContacts(1), 300));
    
    // Modal close buttons
    document.querySelectorAll('.modal-close').forEach(btn => {
        btn.addEventListener('click', closeModals);
    });
    
    // Close modal on background click
    document.querySelectorAll('.modal').forEach(modal => {
        modal.addEventListener('click', (e) => {
            if (e.target === modal) {
                closeModals();
            }
        });
    });
    
    // Modal action buttons
    document.querySelectorAll('.modal-footer button').forEach(btn => {
        btn.addEventListener('click', handleModalAction);
    });
}

// Authentication
async function handleLogin(e) {
    e.preventDefault();
    
    const username = document.getElementById('username').value;
    const password = document.getElementById('password').value;
    const submitBtn = loginForm.querySelector('.btn-login');
    
    submitBtn.classList.add('loading');
    submitBtn.disabled = true;
    loginError.classList.remove('visible');
    
    try {
        const response = await fetch(`${API_BASE_URL}/admin/login`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ username, password })
        });
        
        const data = await response.json();
        
        if (data.success) {
            authToken = data.token;
            currentUser = data.user;
            
            // Save token if remember me
            if (document.getElementById('rememberMe').checked) {
                localStorage.setItem('adminToken', authToken);
            } else {
                sessionStorage.setItem('adminToken', authToken);
            }
            
            showAdminPanel();
            showToast('Welcome back, ' + data.user.name, 'success');
        } else {
            loginError.textContent = data.message || 'Invalid credentials';
            loginError.classList.add('visible');
        }
    } catch (error) {
        loginError.textContent = 'Login failed. Please try again.';
        loginError.classList.add('visible');
    } finally {
        submitBtn.classList.remove('loading');
        submitBtn.disabled = false;
    }
}

async function verifyToken() {
    try {
        const response = await fetch(`${API_BASE_URL}/admin/verify`, {
            headers: {
                'Authorization': `Bearer ${authToken}`
            }
        });
        
        const data = await response.json();
        
        if (data.success) {
            currentUser = data.user;
            showAdminPanel();
        } else {
            logout();
        }
    } catch (error) {
        logout();
    }
}

function handleLogout() {
    logout();
    showToast('Logged out successfully', 'info');
}

function logout() {
    authToken = null;
    currentUser = null;
    localStorage.removeItem('adminToken');
    sessionStorage.removeItem('adminToken');
    
    loginPage.style.display = 'flex';
    adminPage.style.display = 'none';
    loginForm.reset();
}

function showAdminPanel() {
    loginPage.style.display = 'none';
    adminPage.style.display = 'flex';
    
    document.getElementById('userName').textContent = currentUser?.name || 'Admin';
    
    refreshData();
}

// Navigation
function navigateToPage(page) {
    currentPage = page;
    
    // Update nav
    document.querySelectorAll('.nav-link').forEach(link => {
        link.classList.remove('active');
        if (link.dataset.page === page) {
            link.classList.add('active');
        }
    });
    
    // Update page title
    const titles = {
        dashboard: 'Dashboard',
        bookings: 'All Bookings',
        contacts: 'All Messages'
    };
    document.getElementById('pageTitle').textContent = titles[page] || 'Dashboard';
    
    // Show/hide pages
    document.getElementById('dashboardPage').style.display = page === 'dashboard' ? 'block' : 'none';
    document.getElementById('bookingsPage').style.display = page === 'bookings' ? 'block' : 'none';
    document.getElementById('contactsPage').style.display = page === 'contacts' ? 'block' : 'none';
    
    // Load data
    if (page === 'bookings') {
        loadBookings(1);
    } else if (page === 'contacts') {
        loadContacts(1);
    } else if (page === 'dashboard') {
        loadDashboardData();
    } else if (page === 'reports') {
        loadReportsData();
    }
}

function refreshData() {
    loadStats();
    
    if (currentPage === 'dashboard') {
        loadDashboardData();
    } else if (currentPage === 'bookings') {
        loadBookings();
    } else if (currentPage === 'contacts') {
        loadContacts();
    }
}

// API Functions
async function apiCall(endpoint, options = {}) {
    const defaultOptions = {
        headers: {
            'Authorization': `Bearer ${authToken}`,
            'Content-Type': 'application/json'
        }
    };
    
    const mergedOptions = {
        ...defaultOptions,
        ...options,
        headers: {
            ...defaultOptions.headers,
            ...options.headers
        }
    };
    
    const response = await fetch(`${API_BASE_URL}${endpoint}`, mergedOptions);
    return response.json();
}

// Stats
async function loadStats() {
    try {
        const data = await apiCall('/admin/stats');
        
        if (data.success) {
            document.getElementById('totalBookings').textContent = data.data.total_bookings || 0;
            document.getElementById('pendingBookings').textContent = data.data.pending_bookings || 0;
            document.getElementById('todayBookings').textContent = data.data.today_bookings || 0;
            document.getElementById('unreadMessages').textContent = data.data.unread_messages || 0;
            
            document.getElementById('bookingBadge').textContent = data.data.pending_bookings || 0;
            document.getElementById('messageBadge').textContent = data.data.unread_messages || 0;
        }
    } catch (error) {
        console.error('Failed to load stats:', error);
    }
}

// ============== REPORTS PAGE LOGIC ==============

async function loadReportsData() {
    try {
        const response = await apiCall('/admin/reports');
        
        if (!response.success) throw new Error(response.message || 'Failed to fetch reports');

        const { totals, bookings_by_day, service_performance, status_breakdown, message_status } = response.data;

        // Update UI - Stats
        document.getElementById('reportTotalBookings').textContent = totals.bookings;
        document.getElementById('reportTotalMessages').textContent = totals.messages;
        document.getElementById('reportTotalRevenue').textContent = `$${totals.revenue.toLocaleString()}`;

        // Update UI - Service Table
        const serviceTableBody = document.getElementById('serviceReportTable');
        if (serviceTableBody) {
            serviceTableBody.innerHTML = service_performance
                .map(item => `
                    <tr>
                        <td style="text-transform: capitalize;">${item.service}</td>
                        <td>${item.count}</td>
                        <td class="revenue-cell">$${item.revenue.toLocaleString()}</td>
                    </tr>
                `).join('') || '<tr><td colspan="3" class="text-center">No service data available</td></tr>';
        }

        // Update UI - Status List
        const statusList = document.getElementById('statusBreakdownList');
        if (statusList) {
            const statusColors = {
                'pending': 'var(--warning)',
                'confirmed': 'var(--info)',
                'completed': 'var(--success)',
                'cancelled': 'var(--danger)'
            };

            statusList.innerHTML = status_breakdown
                .map(item => `
                    <div class="status-item">
                        <div class="status-label">
                            <span class="status-dot" style="background: ${statusColors[item.status] || 'var(--gray-400)'}"></span>
                            <span style="text-transform: capitalize;">${item.status}</span>
                        </div>
                        <div class="status-value">
                            <span class="count">${item.count}</span>
                            <span class="percentage">${item.percentage}%</span>
                        </div>
                    </div>
                `).join('') || '<p>No status data available</p>';
        }

        // Render Charts
        renderCharts(bookings_by_day, message_status);

    } catch (error) {
        console.error('Error loading reports:', error);
        showToast('Error loading report data', 'error');
    }
}

function renderCharts(bookingTrends, messageStatus) {
    // Bookings Trend Chart
    const ctxBookings = document.getElementById('bookingsChart');
    if (ctxBookings) {
        if (bookingsChart) bookingsChart.destroy();
        
        bookingsChart = new Chart(ctxBookings, {
            type: 'line',
            data: {
                labels: bookingTrends.map(d => formatDate(d.day)),
                datasets: [{
                    label: 'Bookings',
                    data: bookingTrends.map(d => d.count),
                    borderColor: '#7c3aed',
                    backgroundColor: 'rgba(124, 58, 237, 0.1)',
                    borderWidth: 2,
                    fill: true,
                    tension: 0.4
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: { display: false }
                },
                scales: {
                    y: {
                        beginAtZero: true,
                        ticks: { stepSize: 1 }
                    }
                }
            }
        });
    }

    // Messages Pie Chart
    const ctxMessages = document.getElementById('messagesChart');
    if (ctxMessages) {
        if (messagesChart) messagesChart.destroy();
        
        messagesChart = new Chart(ctxMessages, {
            type: 'doughnut',
            data: {
                labels: messageStatus.map(m => m.status.charAt(0).toUpperCase() + m.status.slice(1)),
                datasets: [{
                    data: messageStatus.map(m => m.count),
                    backgroundColor: [
                        '#f59e0b', // warning/unread
                        '#3b82f6', // info/read
                        '#10b981', // success/replied
                        '#6b7280'  // gray/archived
                    ]
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        position: 'bottom'
                    }
                },
                cutout: '70%'
            }
        });
    }
}

// Dashboard
async function loadDashboardData() {
    await loadStats();
    
    // Load recent bookings
    try {
        const data = await apiCall('/admin/bookings?limit=5');
        if (data.success) {
            renderRecentBookings(data.data);
        }
    } catch (error) {
        console.error('Failed to load recent bookings:', error);
    }
    
    // Load recent messages
    try {
        const data = await apiCall('/admin/contacts?limit=5');
        if (data.success) {
            renderRecentMessages(data.data);
        }
    } catch (error) {
        console.error('Failed to load recent messages:', error);
    }
}

function renderRecentBookings(bookings) {
    const tbody = document.querySelector('#recentBookingsTable tbody');
    
    if (bookings.length === 0) {
        tbody.innerHTML = `
            <tr>
                <td colspan="5" class="empty-state">
                    <i class="fas fa-inbox"></i>
                    <p>No bookings yet</p>
                </td>
            </tr>
        `;
        return;
    }
    
    tbody.innerHTML = bookings.map(booking => `
        <tr>
            <td>#${booking.id}</td>
            <td>${escapeHtml(booking.name)}</td>
            <td>${escapeHtml(booking.service)}</td>
            <td>${formatDate(booking.appointment_date)} ${booking.appointment_time}</td>
            <td><span class="status-badge ${booking.status}">${booking.status}</span></td>
        </tr>
    `).join('');
}

function renderRecentMessages(messages) {
    const container = document.getElementById('recentMessagesList');
    
    if (messages.length === 0) {
        container.innerHTML = `
            <div class="empty-state">
                <i class="fas fa-inbox"></i>
                <p>No messages yet</p>
            </div>
        `;
        return;
    }
    
    container.innerHTML = messages.map(msg => `
        <div class="message-item ${msg.status === 'unread' ? 'unread' : ''}" data-id="${msg.id}">
            <div class="message-avatar">
                <i class="fas fa-user"></i>
            </div>
            <div class="message-content">
                <div class="message-header">
                    <h4>${escapeHtml(msg.name)}</h4>
                    <span class="time">${formatDateTime(msg.created_at)}</span>
                </div>
                <div class="message-subject">${escapeHtml(msg.subject)}</div>
                <div class="message-preview">${escapeHtml(msg.message.substring(0, 100))}...</div>
            </div>
        </div>
    `).join('');
    
    // Add click handlers
    container.querySelectorAll('.message-item').forEach(item => {
        item.addEventListener('click', () => {
            const id = item.dataset.id;
            openContactModal(id);
        });
    });
}

// Bookings
async function loadBookings(page = 1) {
    const status = document.getElementById('bookingStatusFilter')?.value || '';
    const date = document.getElementById('bookingDateFilter')?.value || '';
    const search = document.getElementById('bookingSearch')?.value || '';
    
    let url = `/admin/bookings?page=${page}&limit=10`;
    if (status) url += `&status=${encodeURIComponent(status)}`;
    if (date) url += `&date_from=${date}&date_to=${date}`;
    if (search) url += `&search=${encodeURIComponent(search)}`;
    
    try {
        const data = await apiCall(url);
        if (data.success) {
            bookingsData = data;
            renderBookingsTable(data.data);
            renderPagination('bookingsPagination', data.pagination, loadBookings);
        }
    } catch (error) {
        showToast('Failed to load bookings', 'error');
    }
}

function renderBookingsTable(bookings) {
    const tbody = document.querySelector('#bookingsTable tbody');
    
    if (bookings.length === 0) {
        tbody.innerHTML = `
            <tr>
                <td colspan="8" class="empty-state">
                    <i class="fas fa-inbox"></i>
                    <p>No bookings found</p>
                </td>
            </tr>
        `;
        return;
    }
    
    tbody.innerHTML = bookings.map(booking => `
        <tr>
            <td>#${booking.id}</td>
            <td>${escapeHtml(booking.name)}</td>
            <td>${escapeHtml(booking.phone)}<br>${escapeHtml(booking.email || '-')}</td>
            <td>${escapeHtml(booking.service)}</td>
            <td>${formatDate(booking.appointment_date)}</td>
            <td>${booking.appointment_time}</td>
            <td><span class="status-badge ${booking.status}">${booking.status}</span></td>
            <td>
                <button class="btn-action btn-view" data-id="${booking.id}" data-type="booking">
                    <i class="fas fa-eye"></i> View
                </button>
                <button class="btn-action btn-delete" data-id="${booking.id}" data-type="booking">
                    <i class="fas fa-trash"></i>
                </button>
            </td>
        </tr>
    `).join('');
    
    // Add click handlers
    tbody.querySelectorAll('.btn-view').forEach(btn => {
        btn.addEventListener('click', () => {
            openBookingModal(btn.dataset.id);
        });
    });
    
    tbody.querySelectorAll('.btn-delete').forEach(btn => {
        btn.addEventListener('click', () => {
            if (confirm('Are you sure you want to delete this booking?')) {
                deleteBooking(btn.dataset.id);
            }
        });
    });
}

// Contacts
async function loadContacts(page = 1) {
    const status = document.getElementById('contactStatusFilter')?.value || '';
    const search = document.getElementById('contactSearch')?.value || '';
    
    let url = `/admin/contacts?page=${page}&limit=10`;
    if (status) url += `&status=${encodeURIComponent(status)}`;
    if (search) url += `&search=${encodeURIComponent(search)}`;
    
    try {
        const data = await apiCall(url);
        if (data.success) {
            contactsData = data;
            renderContactsTable(data.data);
            renderPagination('contactsPagination', data.pagination, loadContacts);
        }
    } catch (error) {
        showToast('Failed to load messages', 'error');
    }
}

function renderContactsTable(contacts) {
    const tbody = document.querySelector('#contactsTable tbody');
    
    if (contacts.length === 0) {
        tbody.innerHTML = `
            <tr>
                <td colspan="7" class="empty-state">
                    <i class="fas fa-inbox"></i>
                    <p>No messages found</p>
                </td>
            </tr>
        `;
        return;
    }
    
    tbody.innerHTML = contacts.map(contact => `
        <tr class="${contact.status === 'unread' ? 'unread' : ''}">
            <td>#${contact.id}</td>
            <td>${escapeHtml(contact.name)}</td>
            <td>${escapeHtml(contact.email)}</td>
            <td>${escapeHtml(contact.subject)}</td>
            <td>${formatDateTime(contact.created_at)}</td>
            <td><span class="status-badge ${contact.status}">${contact.status}</span></td>
            <td>
                <button class="btn-action btn-view" data-id="${contact.id}" data-type="contact">
                    <i class="fas fa-eye"></i> View
                </button>
                <button class="btn-action btn-delete" data-id="${contact.id}" data-type="contact">
                    <i class="fas fa-trash"></i>
                </button>
            </td>
        </tr>
    `).join('');
    
    // Add click handlers
    tbody.querySelectorAll('.btn-view').forEach(btn => {
        btn.addEventListener('click', () => {
            openContactModal(btn.dataset.id);
        });
    });
    
    tbody.querySelectorAll('.btn-delete').forEach(btn => {
        btn.addEventListener('click', () => {
            if (confirm('Are you sure you want to delete this message?')) {
                deleteContact(btn.dataset.id);
            }
        });
    });
}

// Modals
let currentModalItem = null;
let currentModalType = null;

async function openBookingModal(id) {
    try {
        const data = await apiCall(`/admin/bookings/${id}`);
        if (data.success) {
            currentModalItem = data.data;
            currentModalType = 'booking';
            
            const modal = document.getElementById('bookingModal');
            const content = document.getElementById('bookingModalContent');
            
            content.innerHTML = `
                <div class="detail-grid">
                    <div class="detail-row">
                        <div class="detail-label">Booking ID</div>
                        <div class="detail-value">#${data.data.id}</div>
                    </div>
                    <div class="detail-row">
                        <div class="detail-label">Customer</div>
                        <div class="detail-value">${escapeHtml(data.data.name)}</div>
                    </div>
                    <div class="detail-row">
                        <div class="detail-label">Phone</div>
                        <div class="detail-value">${escapeHtml(data.data.phone)}</div>
                    </div>
                    <div class="detail-row">
                        <div class="detail-label">Email</div>
                        <div class="detail-value">${escapeHtml(data.data.email || '-')}</div>
                    </div>
                    <div class="detail-row">
                        <div class="detail-label">Service</div>
                        <div class="detail-value">${escapeHtml(data.data.service)}</div>
                    </div>
                    <div class="detail-row">
                        <div class="detail-label">Sub Service</div>
                        <div class="detail-value">${escapeHtml(data.data.sub_service || '-')}</div>
                    </div>
                    <div class="detail-row">
                        <div class="detail-label">Appointment Date</div>
                        <div class="detail-value">${formatDate(data.data.appointment_date)}</div>
                    </div>
                    <div class="detail-row">
                        <div class="detail-label">Appointment Time</div>
                        <div class="detail-value">${data.data.appointment_time}</div>
                    </div>
                    <div class="detail-row">
                        <div class="detail-label">Status</div>
                        <div class="detail-value"><span class="status-badge ${data.data.status}">${data.data.status}</span></div>
                    </div>
                    <div class="detail-row">
                        <div class="detail-label">Notes</div>
                        <div class="detail-value">${escapeHtml(data.data.notes || '-')}</div>
                    </div>
                    <div class="detail-row">
                        <div class="detail-label">Created At</div>
                        <div class="detail-value">${formatDateTime(data.data.created_at)}</div>
                    </div>
                </div>
            `;
            
            modal.classList.add('visible');
        }
    } catch (error) {
        showToast('Failed to load booking details', 'error');
    }
}

async function openContactModal(id) {
    try {
        const data = await apiCall(`/admin/contacts/${id}`);
        if (data.success) {
            currentModalItem = data.data;
            currentModalType = 'contact';
            
            const modal = document.getElementById('contactModal');
            const content = document.getElementById('contactModalContent');
            
            content.innerHTML = `
                <div class="detail-grid">
                    <div class="detail-row">
                        <div class="detail-label">Message ID</div>
                        <div class="detail-value">#${data.data.id}</div>
                    </div>
                    <div class="detail-row">
                        <div class="detail-label">From</div>
                        <div class="detail-value">${escapeHtml(data.data.name)}</div>
                    </div>
                    <div class="detail-row">
                        <div class="detail-label">Email</div>
                        <div class="detail-value">${escapeHtml(data.data.email)}</div>
                    </div>
                    <div class="detail-row">
                        <div class="detail-label">Phone</div>
                        <div class="detail-value">${escapeHtml(data.data.phone || '-')}</div>
                    </div>
                    <div class="detail-row">
                        <div class="detail-label">Subject</div>
                        <div class="detail-value">${escapeHtml(data.data.subject)}</div>
                    </div>
                    <div class="detail-row">
                        <div class="detail-label">Message</div>
                    </div>
                    <div class="detail-row">
                        <div class="detail-value message-content">${escapeHtml(data.data.message)}</div>
                    </div>
                    <div class="detail-row">
                        <div class="detail-label">Status</div>
                        <div class="detail-value"><span class="status-badge ${data.data.status}">${data.data.status}</span></div>
                    </div>
                    <div class="detail-row">
                        <div class="detail-label">Received</div>
                        <div class="detail-value">${formatDateTime(data.data.created_at)}</div>
                    </div>
                </div>
            `;
            
            // Update badges
            loadStats();
            
            modal.classList.add('visible');
        }
    } catch (error) {
        showToast('Failed to load message details', 'error');
    }
}

function closeModals() {
    document.querySelectorAll('.modal').forEach(modal => {
        modal.classList.remove('visible');
    });
    currentModalItem = null;
    currentModalType = null;
}

async function handleModalAction(e) {
    if (!currentModalItem || !currentModalType) return;
    
    const status = e.target.dataset.status;
    const id = currentModalItem.id;
    
    if (currentModalType === 'booking') {
        await updateBookingStatus(id, status);
    } else {
        await updateContactStatus(id, status);
    }
    
    closeModals();
}

async function updateBookingStatus(id, status) {
    try {
        const data = await apiCall(`/admin/bookings/${id}`, {
            method: 'PUT',
            body: JSON.stringify({ status })
        });
        
        if (data.success) {
            showToast('Booking status updated', 'success');
            loadBookings();
            loadStats();
        } else {
            showToast(data.message || 'Failed to update booking', 'error');
        }
    } catch (error) {
        showToast('Failed to update booking', 'error');
    }
}

async function updateContactStatus(id, status) {
    try {
        const data = await apiCall(`/admin/contacts/${id}`, {
            method: 'PUT',
            body: JSON.stringify({ status })
        });
        
        if (data.success) {
            showToast('Message status updated', 'success');
            loadContacts();
            loadStats();
        } else {
            showToast(data.message || 'Failed to update message', 'error');
        }
    } catch (error) {
        showToast('Failed to update message', 'error');
    }
}

async function deleteBooking(id) {
    try {
        const data = await apiCall(`/admin/bookings/${id}`, {
            method: 'DELETE'
        });
        
        if (data.success) {
            showToast('Booking deleted', 'success');
            loadBookings();
            loadStats();
        } else {
            showToast(data.message || 'Failed to delete booking', 'error');
        }
    } catch (error) {
        showToast('Failed to delete booking', 'error');
    }
}

async function deleteContact(id) {
    try {
        const data = await apiCall(`/admin/contacts/${id}`, {
            method: 'DELETE'
        });
        
        if (data.success) {
            showToast('Message deleted', 'success');
            loadContacts();
            loadStats();
        } else {
            showToast(data.message || 'Failed to delete message', 'error');
        }
    } catch (error) {
        showToast('Failed to delete message', 'error');
    }
}

// Pagination
function renderPagination(containerId, pagination, callback) {
    const container = document.getElementById(containerId);
    if (!container || pagination.pages <= 1) {
        if (container) container.innerHTML = '';
        return;
    }
    
    let html = `
        <button ${pagination.page === 1 ? 'disabled' : ''} data-page="${pagination.page - 1}">
            <i class="fas fa-chevron-left"></i>
        </button>
    `;
    
    for (let i = 1; i <= pagination.pages; i++) {
        html += `
            <button class="${i === pagination.page ? 'active' : ''}" data-page="${i}">
                ${i}
            </button>
        `;
    }
    
    html += `
        <button ${pagination.page === pagination.pages ? 'disabled' : ''} data-page="${pagination.page + 1}">
            <i class="fas fa-chevron-right"></i>
        </button>
    `;
    
    html += `<span class="pagination-info">Page ${pagination.page} of ${pagination.pages}</span>`;
    
    container.innerHTML = html;
    
    container.querySelectorAll('button').forEach(btn => {
        btn.addEventListener('click', () => {
            const page = parseInt(btn.dataset.page);
            if (page && page !== pagination.page) {
                callback(page);
            }
        });
    });
}

// Utilities
function escapeHtml(text) {
    if (!text) return '-';
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

function formatDate(dateString) {
    if (!dateString) return '-';
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric'
    });
}

function formatDateTime(dateString) {
    if (!dateString) return '-';
    const date = new Date(dateString);
    return date.toLocaleString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
    });
}

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

function showToast(message, type = 'info') {
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    
    const icons = {
        success: 'check-circle',
        error: 'exclamation-circle',
        warning: 'exclamation-triangle',
        info: 'info-circle'
    };
    
    toast.innerHTML = `
        <div class="toast-icon">
            <i class="fas fa-${icons[type]}"></i>
        </div>
        <div class="toast-message">${message}</div>
        <button class="toast-close">
            <i class="fas fa-times"></i>
        </button>
    `;
    
    toastContainer.appendChild(toast);
    
    // Auto remove
    setTimeout(() => {
        toast.remove();
    }, 5000);
    
    // Close button
    toast.querySelector('.toast-close').addEventListener('click', () => {
        toast.remove();
    });
}
