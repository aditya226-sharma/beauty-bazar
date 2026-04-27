# Beauty Bazar - Backend API & Admin Panel

A secure Node.js/Express backend API with SQLite database and an admin panel for managing bookings and contact messages.

## Features

### Backend API
- ✅ RESTful API for bookings and contacts
- ✅ SQLite database with automatic schema creation
- ✅ JWT-based authentication for admin panel
- ✅ Rate limiting and input validation
- ✅ Helmet.js security headers
- ✅ CORS enabled

### Admin Panel
- ✅ Secure login with JWT tokens
- ✅ Dashboard with statistics
- ✅ View all bookings with filtering and pagination
- ✅ View all messages with filtering and pagination
- ✅ Update booking status (pending, confirmed, completed, cancelled)
- ✅ Update message status (unread, read, replied, archived)
- ✅ Delete bookings and messages
- ✅ Responsive design

## Quick Start

### Prerequisites
- Node.js 14+ installed

### Installation

1. Install dependencies:
```bash
npm install
```

2. Create environment file:
```bash
cp .env.example .env
```

3. Initialize the database:
```bash
npm run setup
```

4. Start the server:
```bash
npm start
```

For development with auto-reload:
```bash
npm run dev
```

### Default Admin Credentials

- **Username:** admin
- **Password:** admin123

⚠️ **Important:** Change the default password immediately after first login!

### Access Points

- **Website:** http://localhost:3000
- **Admin Panel:** http://localhost:3000/admin
- **API Base:** http://localhost:3000/api

## API Endpoints

### Public Endpoints

#### Create Booking
```http
POST /api/bookings
Content-Type: application/json

{
  "name": "John Doe",
  "phone": "1234567890",
  "email": "john@example.com",
  "service": "Makeup",
  "sub_service": "Bridal Makeup",
  "appointment_date": "2024-01-15",
  "appointment_time": "14:00",
  "notes": "Special requests here"
}
```

#### Create Contact
```http
POST /api/contacts
Content-Type: application/json

{
  "name": "John Doe",
  "email": "john@example.com",
  "phone": "1234567890",
  "subject": "Booking Inquiry",
  "message": "Your message here"
}
```

### Admin Endpoints (Requires Authentication)

All admin endpoints require a Bearer token in the Authorization header:
```http
Authorization: Bearer YOUR_JWT_TOKEN
```

#### Authentication
- `POST /api/admin/login` - Login and get JWT token
- `GET /api/admin/verify` - Verify token validity

#### Bookings Management
- `GET /api/admin/bookings` - Get all bookings (with filters)
- `GET /api/admin/bookings/:id` - Get single booking
- `PUT /api/admin/bookings/:id` - Update booking status
- `DELETE /api/admin/bookings/:id` - Delete booking

#### Contacts Management
- `GET /api/admin/contacts` - Get all contacts (with filters)
- `GET /api/admin/contacts/:id` - Get single contact
- `PUT /api/admin/contacts/:id` - Update contact status
- `DELETE /api/admin/contacts/:id` - Delete contact

#### Statistics
- `GET /api/admin/stats` - Get dashboard statistics

## Query Parameters

### Bookings
- `status` - Filter by status (pending, confirmed, completed, cancelled)
- `date_from` - Filter from date (YYYY-MM-DD)
- `date_to` - Filter to date (YYYY-MM-DD)
- `search` - Search in name, phone, or service
- `page` - Page number (default: 1)
- `limit` - Items per page (default: 20)

### Contacts
- `status` - Filter by status (unread, read, replied, archived)
- `search` - Search in name, email, or subject
- `page` - Page number (default: 1)
- `limit` - Items per page (default: 20)

## Database Schema

### Bookings Table
```sql
CREATE TABLE bookings (
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
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
```

### Contacts Table
```sql
CREATE TABLE contacts (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  email TEXT NOT NULL,
  phone TEXT,
  subject TEXT NOT NULL,
  message TEXT NOT NULL,
  status TEXT DEFAULT 'unread',
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
```

### Admins Table
```sql
CREATE TABLE admins (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  username TEXT NOT NULL UNIQUE,
  password TEXT NOT NULL,
  name TEXT NOT NULL,
  role TEXT DEFAULT 'admin',
  last_login DATETIME,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
```

## Security Features

1. **Password Hashing** - All passwords are hashed with bcrypt
2. **JWT Tokens** - Secure authentication with expiring tokens
3. **Rate Limiting** - Prevents brute force attacks
4. **Input Validation** - Express-validator for all inputs
5. **Security Headers** - Helmet.js for secure headers
6. **CORS** - Configurable cross-origin resource sharing
7. **SQL Injection Protection** - Parameterized queries

## Project Structure

```
new1/
├── server.js              # Main Express server
├── setup.js              # Database initialization
├── package.json          # Node.js dependencies
├── .env                  # Environment variables
├── .env.example          # Example environment file
├── database.sqlite       # SQLite database (auto-created)
├── admin/
│   ├── index.html        # Admin panel HTML
│   ├── styles.css        # Admin panel styles
│   └── app.js            # Admin panel JavaScript
├── booking.html          # Booking form (updated for API)
├── contact.html          # Contact form (updated for API)
└── ... (other frontend files)
```

## Environment Variables

```env
PORT=3000                          # Server port
NODE_ENV=development               # Environment mode
JWT_SECRET=your-secret-key         # JWT signing secret
ADMIN_TOKEN_EXPIRES=24h           # Token expiration
RATE_LIMIT_WINDOW_MS=900000       # Rate limit window (15 min)
RATE_LIMIT_MAX_REQUESTS=100       # Max requests per window
```

## Production Deployment

1. Set secure JWT_SECRET in `.env`
2. Change default admin password immediately
3. Set `NODE_ENV=production`
4. Use a reverse proxy (nginx) for HTTPS
5. Enable firewall rules
6. Regular database backups

## Troubleshooting

### Port already in use
Change the PORT in `.env` file or use:
```bash
PORT=3001 npm start
```

### Database locked
Stop the server and delete `database.sqlite`, then run `npm run setup` again.

### CORS issues
Check that the API_BASE_URL in your frontend matches your server URL.

## License

MIT License - Feel free to use for your projects!
