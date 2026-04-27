const mongoProvider = require('./providers/mongodb');

/**
 * Unified Database Interface - SQLite Implementation
 */
const db = {
    // Initialization
    init: () => mongoProvider.init(),

    // Bookings
    createBooking: (data) => mongoProvider.createBooking(data),
    checkAvailability: (date, time) => mongoProvider.checkAvailability(date, time),
    getBookings: (filters) => mongoProvider.getBookings(filters),
    getBookingById: (id) => mongoProvider.getBookingById(id),
    updateBookingStatus: (id, status) => mongoProvider.updateBookingStatus(id, status),
    deleteBooking: (id) => mongoProvider.deleteBooking(id),

    // Contacts
    createContact: (data) => mongoProvider.createContact(data),
    getContacts: (filters) => mongoProvider.getContacts(filters),
    getContactById: (id) => mongoProvider.getContactById(id),
    updateContactStatus: (id, status) => mongoProvider.updateContactStatus(id, status),
    deleteContact: (id) => mongoProvider.deleteContact(id),

    // Admins
    getAdminByUsername: (username) => mongoProvider.getAdminByUsername(username),
    updateAdminPassword: (id, newPassword) => mongoProvider.updateAdminPassword(id, newPassword),
    updateLastLogin: (id) => mongoProvider.updateLastLogin(id),
    createAdmin: (data) => mongoProvider.createAdmin(data),

    // Reports & Stats
    getDashboardStats: () => mongoProvider.getDashboardStats(),
    getReportData: () => mongoProvider.getReportData(),
};

module.exports = db;

