require('dotenv').config();
const express = require('express');
const path = require('path');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const { body, validationResult } = require('express-validator');
const db = require('./lib/db');

const app = express();
const PORT = process.env.PORT || 3000;

// Initialize Database
db.init().then(() => {
    console.log('Database system initialized');
}).catch(err => {
    console.error('Database initialization failed:', err);
});

// Service Price Mapping
const SERVICE_PRICES = {
  'Haircut': 500,
  'Facial': 1200,
  'Manicure': 800,
  'Pedicure': 900,
  'Makeup': 2500,
  'Spa': 3000,
  'default': 1000
};

// Middleware
app.use(helmet({
  contentSecurityPolicy: false, // Disable for development
}));

app.use(cors({
  origin: true, // Allow all origins in development
  credentials: true
}));

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// Rate limiting
const limiter = rateLimit({
  windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS) || 15 * 60 * 1000, // 15 minutes
  max: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS) || 100,
  message: {
    success: false,
    message: 'Too many requests, please try again later.'
  }
});
app.use('/api/', limiter);

// Stricter rate limit for auth endpoints
const authLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 10,
  message: {
    success: false,
    message: 'Too many login attempts, please try again later.'
  }
});

// Authentication middleware
const authenticateToken = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({
      success: false,
      message: 'Access denied. No token provided.'
    });
  }

  jwt.verify(token, process.env.JWT_SECRET || 'fallback-secret', (err, user) => {
    if (err) {
      return res.status(403).json({
        success: false,
        message: 'Invalid or expired token.'
      });
    }
    req.user = user;
    next();
  });
};

// Validation middleware
const handleValidationErrors = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      success: false,
      message: 'Validation failed',
      errors: errors.array()
    });
  }
  next();
};

// ===== PUBLIC API ENDPOINTS =====

// Create booking
app.post('/api/bookings',
  [
    body('name').trim().isLength({ min: 2, max: 100 }).withMessage('Name must be 2-100 characters'),
    body('phone').trim().matches(/^[0-9+\-\s()]{10,20}$/).withMessage('Invalid phone number'),
    body('email').optional({ nullable: true }).isEmail().withMessage('Invalid email'),
    body('service').trim().isLength({ min: 1, max: 100 }).withMessage('Service is required'),
    body('sub_service').optional({ nullable: true }).trim(),
    body('appointment_date').isDate().withMessage('Invalid date format'),
    body('appointment_time').matches(/^([01]?[0-9]|2[0-3]):[0-5][0-9]$/).withMessage('Invalid time format'),
    body('notes').optional({ nullable: true }).trim().isLength({ max: 500 }).withMessage('Notes too long')
  ],
  handleValidationErrors,
  async (req, res) => {
    const { name, phone, email, service, sub_service, appointment_date, appointment_time, notes } = req.body;

    try {
        // Smart Booking: Prevent double bookings for the same date and time
        const existingBooking = await db.checkAvailability(appointment_date, appointment_time);

        if (existingBooking) {
            return res.status(409).json({
                success: false,
                message: 'Sorry, this time slot is already booked. Please select a different time or date.'
            });
        }

        const price = SERVICE_PRICES[service] || SERVICE_PRICES['default'];
        const bookingData = { 
            name, phone, email, service, sub_service, 
            appointment_date, appointment_time, notes, price 
        };

        const result = await db.createBooking(bookingData);

        res.status(201).json({
            success: true,
            message: 'Booking created successfully',
            data: result
        });
    } catch (err) {
        console.error('Booking error:', err);
        res.status(500).json({
            success: false,
            message: 'Failed to create booking'
        });
    }
  }
);

// Create contact
app.post('/api/contacts',
  [
    body('name').trim().isLength({ min: 2, max: 100 }).withMessage('Name must be 2-100 characters'),
    body('email').isEmail().withMessage('Invalid email'),
    body('phone').optional({ nullable: true }).trim().matches(/^[0-9+\-\s()]{0,20}$/).withMessage('Invalid phone number'),
    body('subject').trim().isLength({ min: 1, max: 100 }).withMessage('Subject is required'),
    body('message').trim().isLength({ min: 10, max: 2000 }).withMessage('Message must be 10-2000 characters')
  ],
  handleValidationErrors,
  async (req, res) => {
    try {
        const result = await db.createContact(req.body);
        res.status(201).json({
            success: true,
            message: 'Message sent successfully',
            data: result
        });
    } catch (err) {
        console.error('Contact error:', err);
        res.status(500).json({
            success: false,
            message: 'Failed to send message'
        });
    }
  }
);

// ===== ADMIN AUTHENTICATION ENDPOINTS =====

// Admin login
app.post('/api/admin/login', authLimiter, async (req, res) => {
  const { username, password } = req.body;

  if (!username || !password) {
    return res.status(400).json({
      success: false,
      message: 'Username and password are required'
    });
  }

  try {
    const user = await db.getAdminByUsername(username);

    if (!user || !bcrypt.compareSync(password, user.password)) {
      return res.status(401).json({
        success: false,
        message: 'Invalid credentials'
      });
    }

    // Update last login
    await db.updateLastLogin(user.id);

    // Generate JWT token
    const token = jwt.sign(
      { id: user.id, username: user.username, role: user.role },
      process.env.JWT_SECRET || 'fallback-secret',
      { expiresIn: process.env.ADMIN_TOKEN_EXPIRES || '24h' }
    );

    res.json({
      success: true,
      message: 'Login successful',
      token,
      user: {
        id: user.id,
        username: user.username,
        name: user.name,
        role: user.role
      }
    });
  } catch (err) {
    console.error('Login error:', err);
    res.status(500).json({
        success: false,
        message: 'Login failed'
    });
  }
});

// Verify token
app.get('/api/admin/verify', authenticateToken, (req, res) => {
  res.json({
    success: true,
    user: req.user
  });
});

// ===== PROTECTED ADMIN ENDPOINTS =====

// Get all bookings
app.get('/api/admin/bookings', authenticateToken, async (req, res) => {
  try {
    const result = await db.getBookings(req.query);
    res.json({
        success: true,
        data: result.data,
        pagination: {
            page: parseInt(req.query.page) || 1,
            limit: parseInt(req.query.limit) || 20,
            total: result.total,
            pages: result.pages
        }
    });
  } catch (err) {
    console.error('Fetch bookings error:', err);
    res.status(500).json({
        success: false,
        message: 'Failed to fetch bookings'
    });
  }
});

// Get single booking
app.get('/api/admin/bookings/:id', authenticateToken, async (req, res) => {
  try {
    const booking = await db.getBookingById(req.params.id);
    if (!booking) {
        return res.status(404).json({ success: false, message: 'Booking not found' });
    }
    res.json({ success: true, data: booking });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Failed to fetch booking' });
  }
});

// Update booking status
app.put('/api/admin/bookings/:id', authenticateToken, async (req, res) => {
  const { id } = req.params;
  const { status } = req.body;

  try {
    await db.updateBookingStatus(id, status);
    res.json({ success: true, message: 'Booking updated successfully' });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Failed to update booking' });
  }
});

// Delete booking
app.delete('/api/admin/bookings/:id', authenticateToken, async (req, res) => {
  try {
    await db.deleteBooking(req.params.id);
    res.json({ success: true, message: 'Booking deleted successfully' });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Failed to delete booking' });
  }
});

// Get all contacts
app.get('/api/admin/contacts', authenticateToken, async (req, res) => {
  try {
    const result = await db.getContacts(req.query);
    res.json({
        success: true,
        data: result.data,
        pagination: {
            page: parseInt(req.query.page) || 1,
            limit: parseInt(req.query.limit) || 20,
            total: result.total,
            pages: result.pages
        }
    });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Failed to fetch contacts' });
  }
});

// Get single contact
app.get('/api/admin/contacts/:id', authenticateToken, async (req, res) => {
  try {
    const contact = await db.getContactById(req.params.id);
    if (!contact) {
        return res.status(404).json({ success: false, message: 'Contact not found' });
    }
    // Mark as read
    if (contact.status === 'unread') {
        await db.updateContactStatus(req.params.id, 'read');
    }
    res.json({ success: true, data: contact });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Failed to fetch contact' });
  }
});

// Update contact status
app.put('/api/admin/contacts/:id', authenticateToken, async (req, res) => {
  try {
    await db.updateContactStatus(req.params.id, req.body.status);
    res.json({ success: true, message: 'Contact updated successfully' });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Failed to update contact' });
  }
});

// Delete contact
app.delete('/api/admin/contacts/:id', authenticateToken, async (req, res) => {
  try {
    await db.deleteContact(req.params.id);
    res.json({ success: true, message: 'Contact deleted successfully' });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Failed to delete contact' });
  }
});

// Get dashboard statistics
app.get('/api/admin/stats', authenticateToken, async (req, res) => {
  try {
    const stats = await db.getDashboardStats();
    res.json({ success: true, data: stats });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Failed to fetch stats' });
  }
});

// Get business reports
app.get('/api/admin/reports', authenticateToken, async (req, res) => {
  try {
    const data = await db.getReportData();
    res.json({ success: true, data });
  } catch (err) {
    console.error('Fetch reports error:', err);
    res.status(500).json({ success: false, message: 'Failed to fetch report data' });
  }
});

// Change admin password
app.post('/api/admin/change-password', authenticateToken, async (req, res) => {
  const { current_password, new_password } = req.body;

  try {
    const user = await db.getAdminByUsername(req.user.username);
    if (!user || !bcrypt.compareSync(current_password, user.password)) {
      return res.status(401).json({ success: false, message: 'Current password is incorrect' });
    }

    const hashedPassword = bcrypt.hashSync(new_password, 10);
    await db.updateAdminPassword(user.id, hashedPassword);
    res.json({ success: true, message: 'Password changed successfully' });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Failed to change password' });
  }
});

// Static files & SPA routing
app.use('/admin', express.static(path.join(__dirname, 'admin')));
app.get('/admin*', (req, res) => {
  res.sendFile(path.join(__dirname, 'admin', 'index.html'));
});

app.use(express.static(path.join(__dirname)));
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

// Error handling
app.use((err, req, res, next) => {
  console.error('Server error:', err);
  res.status(500).json({ success: false, message: 'Internal server error' });
});

// Start server
app.listen(PORT, () => {
  console.log(`Server running on: http://localhost:${PORT}`);
});
