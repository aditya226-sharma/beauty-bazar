require('dotenv').config();
const db = require('./lib/db');
const bcrypt = require('bcryptjs');

async function setup() {
    console.log('Starting database setup...');
    try {
        await db.init();
        console.log('Database initialized.');

        const existing = await db.getAdminByUsername('admin');
        if (!existing) {
            const hashedPassword = bcrypt.hashSync('admin123', 10);
            await db.createAdmin({ username: 'admin', password: hashedPassword, name: 'Administrator', role: 'admin' });
            console.log('Default admin created: admin/admin123');
            console.log('IMPORTANT: Change this password after login!');
        } else {
            console.log('Admin user already exists.');
        }

        console.log('Setup complete! Run "npm start" to start the server.');
    } catch (err) {
        console.error('Setup failed:', err);
    } finally {
        process.exit(0);
    }
}

setup();
