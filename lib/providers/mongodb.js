const mongoose = require('mongoose');

const bookingSchema = new mongoose.Schema({
    name: { type: String, required: true },
    phone: { type: String, required: true },
    email: String,
    service: { type: String, required: true },
    sub_service: String,
    appointment_date: { type: String, required: true },
    appointment_time: { type: String, required: true },
    notes: String,
    status: { type: String, default: 'pending' },
    price: { type: Number, default: 0 }
}, { timestamps: true });

const contactSchema = new mongoose.Schema({
    name: { type: String, required: true },
    email: { type: String, required: true },
    phone: String,
    subject: { type: String, required: true },
    message: { type: String, required: true },
    status: { type: String, default: 'unread' }
}, { timestamps: true });

const adminSchema = new mongoose.Schema({
    username: { type: String, required: true, unique: true },
    password: { type: String, required: true },
    name: { type: String, required: true },
    role: { type: String, default: 'admin' },
    last_login: Date
}, { timestamps: true });

const Booking = mongoose.model('Booking', bookingSchema);
const Contact = mongoose.model('Contact', contactSchema);
const Admin = mongoose.model('Admin', adminSchema);

const mongoProvider = {
    init: async () => {
        await mongoose.connect(process.env.MONGODB_URI);
        console.log('MongoDB connected');
    },

    createBooking: async (data) => {
        const doc = await Booking.create(data);
        return { id: doc._id, ...data };
    },

    checkAvailability: (date, time) =>
        Booking.findOne({ appointment_date: date, appointment_time: time, status: { $ne: 'cancelled' } }),

    getBookings: async (filters = {}) => {
        const { status, date_from, date_to, search, page = 1, limit = 20 } = filters;
        const query = {};
        if (status) query.status = status;
        if (date_from || date_to) {
            query.appointment_date = {};
            if (date_from) query.appointment_date.$gte = date_from;
            if (date_to) query.appointment_date.$lte = date_to;
        }
        if (search) {
            const r = new RegExp(search, 'i');
            query.$or = [{ name: r }, { phone: r }, { service: r }];
        }
        const total = await Booking.countDocuments(query);
        const data = await Booking.find(query)
            .sort({ createdAt: -1 })
            .skip((page - 1) * limit)
            .limit(parseInt(limit))
            .lean();
        return { data: data.map(d => ({ ...d, id: d._id })), total, pages: Math.ceil(total / limit) };
    },

    getBookingById: async (id) => {
        const doc = await Booking.findById(id).lean();
        return doc ? { ...doc, id: doc._id } : null;
    },

    updateBookingStatus: async (id, status) => {
        await Booking.findByIdAndUpdate(id, { status });
        return { id, status };
    },

    deleteBooking: async (id) => {
        const r = await Booking.findByIdAndDelete(id);
        return { changes: r ? 1 : 0 };
    },

    createContact: async (data) => {
        const doc = await Contact.create(data);
        return { id: doc._id, ...data };
    },

    getContacts: async (filters = {}) => {
        const { status, search, page = 1, limit = 20 } = filters;
        const query = {};
        if (status) query.status = status;
        if (search) {
            const r = new RegExp(search, 'i');
            query.$or = [{ name: r }, { email: r }, { subject: r }];
        }
        const total = await Contact.countDocuments(query);
        const data = await Contact.find(query)
            .sort({ createdAt: -1 })
            .skip((page - 1) * limit)
            .limit(parseInt(limit))
            .lean();
        return { data: data.map(d => ({ ...d, id: d._id })), total, pages: Math.ceil(total / limit) };
    },

    getContactById: async (id) => {
        const doc = await Contact.findById(id).lean();
        return doc ? { ...doc, id: doc._id } : null;
    },

    updateContactStatus: async (id, status) => {
        await Contact.findByIdAndUpdate(id, { status });
        return { id, status };
    },

    deleteContact: async (id) => {
        const r = await Contact.findByIdAndDelete(id);
        return { changes: r ? 1 : 0 };
    },

    getAdminByUsername: (username) => Admin.findOne({ username }).lean(),

    updateAdminPassword: async (id, newPassword) => {
        await Admin.findByIdAndUpdate(id, { password: newPassword });
        return { id };
    },

    updateLastLogin: async (id) => {
        await Admin.findByIdAndUpdate(id, { last_login: new Date() });
        return { id };
    },

    createAdmin: (data) => Admin.create(data),

    getDashboardStats: async () => {
        const today = new Date().toISOString().split('T')[0];
        const [total_bookings, pending_bookings, total_contacts, unread_messages, today_bookings] = await Promise.all([
            Booking.countDocuments(),
            Booking.countDocuments({ status: 'pending' }),
            Contact.countDocuments(),
            Contact.countDocuments({ status: 'unread' }),
            Booking.countDocuments({ appointment_date: today })
        ]);
        return { total_bookings, pending_bookings, total_contacts, unread_messages, today_bookings };
    },

    getReportData: async () => {
        const thirtyDaysAgo = new Date();
        thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
        const thirtyDaysAgoStr = thirtyDaysAgo.toISOString().split('T')[0];

        const [service_performance, status_breakdown, bookings_by_day, message_status, totals] = await Promise.all([
            Booking.aggregate([
                { $match: { status: { $ne: 'cancelled' } } },
                { $group: { _id: '$service', revenue: { $sum: '$price' }, count: { $sum: 1 } } },
                { $project: { service: '$_id', revenue: 1, count: 1, _id: 0 } }
            ]),
            Booking.aggregate([
                { $group: { _id: '$status', count: { $sum: 1 } } },
                { $project: { status: '$_id', count: 1, _id: 0 } }
            ]),
            Booking.aggregate([
                { $match: { appointment_date: { $gte: thirtyDaysAgoStr } } },
                { $group: { _id: '$appointment_date', count: { $sum: 1 } } },
                { $sort: { _id: 1 } },
                { $project: { day: '$_id', count: 1, _id: 0 } }
            ]),
            Contact.aggregate([
                { $group: { _id: '$status', count: { $sum: 1 } } },
                { $project: { status: '$_id', count: 1, _id: 0 } }
            ]),
            Promise.all([
                Booking.countDocuments(),
                Contact.countDocuments(),
                Booking.aggregate([{ $match: { status: { $ne: 'cancelled' } } }, { $group: { _id: null, revenue: { $sum: '$price' } } }])
            ])
        ]);

        const total = status_breakdown.reduce((s, r) => s + r.count, 0);
        return {
            service_performance,
            status_breakdown: status_breakdown.map(r => ({ ...r, percentage: total > 0 ? Math.round((r.count / total) * 100) : 0 })),
            bookings_by_day,
            message_status,
            totals: { bookings: totals[0], messages: totals[1], revenue: totals[2][0]?.revenue || 0 }
        };
    }
};

module.exports = mongoProvider;
