const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const dbPath = path.join(__dirname, '../../database.sqlite');
const db = new sqlite3.Database(dbPath);

const sqliteProvider = {
    init: () => {
        return new Promise((resolve, reject) => {
            db.serialize(() => {
                db.run(`CREATE TABLE IF NOT EXISTS bookings (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    name TEXT NOT NULL,
                    phone TEXT NOT NULL,
                    email TEXT,
                    service TEXT NOT NULL,
                    sub_service TEXT,
                    appointment_date TEXT NOT NULL,
                    appointment_time TEXT NOT NULL,
                    notes TEXT,
                    status TEXT DEFAULT 'pending',
                    price REAL DEFAULT 0,
                    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
                )`);

                db.run(`CREATE TABLE IF NOT EXISTS contacts (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    name TEXT NOT NULL,
                    email TEXT NOT NULL,
                    phone TEXT,
                    subject TEXT NOT NULL,
                    message TEXT NOT NULL,
                    status TEXT DEFAULT 'unread',
                    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
                )`);

                db.run(`CREATE TABLE IF NOT EXISTS admins (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    username TEXT NOT NULL UNIQUE,
                    password TEXT NOT NULL,
                    name TEXT NOT NULL,
                    role TEXT DEFAULT 'admin',
                    last_login DATETIME,
                    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
                )`, (err) => {
                    if (err) reject(err);
                    else resolve();
                });
            });
        });
    },

    // Bookings
    createBooking: (data) => {
        return new Promise((resolve, reject) => {
            const { name, phone, email, service, sub_service, appointment_date, appointment_time, notes, price } = data;
            const query = `INSERT INTO bookings (name, phone, email, service, sub_service, appointment_date, appointment_time, notes, price) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`;
            db.run(query, [name, phone, email, service, sub_service, appointment_date, appointment_time, notes, price], function(err) {
                if (err) reject(err);
                else resolve({ id: this.lastID, ...data });
            });
        });
    },

    checkAvailability: (date, time) => {
        return new Promise((resolve, reject) => {
            db.get("SELECT id FROM bookings WHERE appointment_date = ? AND appointment_time = ? AND status != 'cancelled'", [date, time], (err, row) => {
                if (err) reject(err);
                else resolve(row);
            });
        });
    },

    getBookings: (filters = {}) => {
        return new Promise((resolve, reject) => {
            const { status, date_from, date_to, search, page = 1, limit = 20 } = filters;
            let sql = 'SELECT * FROM bookings WHERE 1=1';
            let countSql = 'SELECT COUNT(*) as total FROM bookings WHERE 1=1';
            const params = [];
            const countParams = [];

            if (status) {
                sql += ' AND status = ?';
                countSql += ' AND status = ?';
                params.push(status);
                countParams.push(status);
            }
            if (date_from) {
                sql += ' AND appointment_date >= ?';
                countSql += ' AND appointment_date >= ?';
                params.push(date_from);
                countParams.push(date_from);
            }
            if (date_to) {
                sql += ' AND appointment_date <= ?';
                countSql += ' AND appointment_date <= ?';
                params.push(date_to);
                countParams.push(date_to);
            }
            if (search) {
                const p = `%${search}%`;
                sql += ' AND (name LIKE ? OR phone LIKE ? OR service LIKE ?)';
                countSql += ' AND (name LIKE ? OR phone LIKE ? OR service LIKE ?)';
                params.push(p, p, p);
                countParams.push(p, p, p);
            }

            sql += ' ORDER BY created_at DESC LIMIT ? OFFSET ?';
            params.push(parseInt(limit), (parseInt(page) - 1) * parseInt(limit));

            db.get(countSql, countParams, (err, countRow) => {
                if (err) return reject(err);
                db.all(sql, params, (err, rows) => {
                    if (err) return reject(err);
                    resolve({
                        data: rows,
                        total: countRow.total,
                        pages: Math.ceil(countRow.total / limit)
                    });
                });
            });
        });
    },

    getBookingById: (id) => {
        return new Promise((resolve, reject) => {
            db.get("SELECT * FROM bookings WHERE id = ?", [id], (err, row) => {
                if (err) reject(err);
                else resolve(row);
            });
        });
    },

    updateBookingStatus: (id, status) => {
        return new Promise((resolve, reject) => {
            db.run("UPDATE bookings SET status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?", [status, id], function(err) {
                if (err) reject(err);
                else resolve({ id, status, changes: this.changes });
            });
        });
    },

    deleteBooking: (id) => {
        return new Promise((resolve, reject) => {
            db.run("DELETE FROM bookings WHERE id = ?", [id], function(err) {
                if (err) reject(err);
                else resolve({ changes: this.changes });
            });
        });
    },

    getDashboardStats: () => {
        return new Promise((resolve, reject) => {
            const today = new Date().toISOString().split('T')[0];
            const queries = {
                total_bookings: "SELECT COUNT(*) as total FROM bookings",
                pending_bookings: "SELECT COUNT(*) as total FROM bookings WHERE status = 'pending'",
                total_contacts: "SELECT COUNT(*) as total FROM contacts",
                unread_messages: "SELECT COUNT(*) as total FROM contacts WHERE status = 'unread'",
                today_bookings: `SELECT COUNT(*) as total FROM bookings WHERE appointment_date = '${today}'`
            };

            const stats = {};
            const keys = Object.keys(queries);
            let completed = 0;

            keys.forEach(key => {
                db.get(queries[key], [], (err, row) => {
                    if (err) return reject(err);
                    stats[key] = row.total;
                    completed++;
                    if (completed === keys.length) resolve(stats);
                });
            });
        });
    },

    getReportData: () => {
        return new Promise((resolve, reject) => {
            const queries = {
                service_performance: "SELECT service, SUM(price) as revenue, COUNT(*) as count FROM bookings WHERE status != 'cancelled' GROUP BY service",
                status_breakdown: "SELECT status, COUNT(*) as count FROM bookings GROUP BY status",
                bookings_by_day: `
                    SELECT appointment_date as day, COUNT(*) as count 
                    FROM bookings 
                    WHERE appointment_date >= date('now', '-30 days')
                    GROUP BY appointment_date ORDER BY appointment_date ASC
                `,
                message_status: "SELECT status, COUNT(*) as count FROM contacts GROUP BY status",
                totals: `
                    SELECT 
                        (SELECT COUNT(*) FROM bookings) as bookings,
                        (SELECT COUNT(*) FROM contacts) as messages,
                        (SELECT SUM(price) FROM bookings WHERE status != 'cancelled') as revenue
                `
            };

            const data = {};
            const keys = Object.keys(queries);
            let completed = 0;

            keys.forEach(key => {
                db.all(queries[key], [], (err, rows) => {
                    if (err) return reject(err);
                    
                    if (key === 'totals') {
                        data[key] = rows[0] || { bookings: 0, messages: 0, revenue: 0 };
                        if (!data[key].revenue) data[key].revenue = 0;
                    } else if (key === 'status_breakdown') {
                        const total = rows.reduce((sum, r) => sum + r.count, 0);
                        data[key] = rows.map(r => ({
                            ...r,
                            percentage: total > 0 ? Math.round((r.count / total) * 100) : 0
                        }));
                    } else {
                        data[key] = rows;
                    }
                    
                    completed++;
                    if (completed === keys.length) resolve(data);
                });
            });
        });
    },

    // Contacts
    createContact: (data) => {
        return new Promise((resolve, reject) => {
            const { name, email, phone, subject, message } = data;
            const query = `INSERT INTO contacts (name, email, phone, subject, message) VALUES (?, ?, ?, ?, ?)`;
            db.run(query, [name, email, phone, subject, message], function(err) {
                if (err) reject(err);
                else resolve({ id: this.lastID, ...data });
            });
        });
    },

    getContacts: (filters = {}) => {
        return new Promise((resolve, reject) => {
            const { status, search, page = 1, limit = 20 } = filters;
            let sql = 'SELECT * FROM contacts WHERE 1=1';
            let countSql = 'SELECT COUNT(*) as total FROM contacts WHERE 1=1';
            const params = [];
            const countParams = [];

            if (status) {
                sql += ' AND status = ?';
                countSql += ' AND status = ?';
                params.push(status);
                countParams.push(status);
            }
            if (search) {
                const p = `%${search}%`;
                sql += ' AND (name LIKE ? OR email LIKE ? OR subject LIKE ?)';
                countSql += ' AND (name LIKE ? OR email LIKE ? OR subject LIKE ?)';
                params.push(p, p, p);
                countParams.push(p, p, p);
            }

            sql += ' ORDER BY created_at DESC LIMIT ? OFFSET ?';
            params.push(parseInt(limit), (parseInt(page) - 1) * parseInt(limit));

            db.get(countSql, countParams, (err, countRow) => {
                if (err) return reject(err);
                db.all(sql, params, (err, rows) => {
                    if (err) return reject(err);
                    resolve({
                        data: rows,
                        total: countRow.total,
                        pages: Math.ceil(countRow.total / limit)
                    });
                });
            });
        });
    },

    getContactById: (id) => {
        return new Promise((resolve, reject) => {
            db.get("SELECT * FROM contacts WHERE id = ?", [id], (err, row) => {
                if (err) reject(err);
                else resolve(row);
            });
        });
    },

    updateContactStatus: (id, status) => {
        return new Promise((resolve, reject) => {
            db.run("UPDATE contacts SET status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?", [status, id], function(err) {
                if (err) reject(err);
                else resolve({ id, status, changes: this.changes });
            });
        });
    },

    deleteContact: (id) => {
        return new Promise((resolve, reject) => {
            db.run("DELETE FROM contacts WHERE id = ?", [id], function(err) {
                if (err) reject(err);
                else resolve({ changes: this.changes });
            });
        });
    },

    // Admins
    getAdminByUsername: (username) => {
        return new Promise((resolve, reject) => {
            db.get("SELECT * FROM admins WHERE username = ?", [username], (err, row) => {
                if (err) reject(err);
                else resolve(row);
            });
        });
    },

    updateAdminPassword: (id, newPassword) => {
        return new Promise((resolve, reject) => {
            db.run("UPDATE admins SET password = ? WHERE id = ?", [newPassword, id], function(err) {
                if (err) reject(err);
                else resolve({ id });
            });
        });
    },

    updateLastLogin: (id) => {
        return new Promise((resolve, reject) => {
            db.run("UPDATE admins SET last_login = CURRENT_TIMESTAMP WHERE id = ?", [id], function(err) {
                if (err) reject(err);
                else resolve({ id });
            });
        });
    }
};

module.exports = sqliteProvider;
