const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const bcrypt = require('bcryptjs');

const dbPath = path.join(__dirname, 'database.sqlite');
const db = new sqlite3.Database(dbPath);

db.get('SELECT * FROM admins WHERE username = ?', ['admin'], (err, row) => {
    if (err) {
        console.error('Error:', err);
        process.exit(1);
    }
    if (!row) {
        console.log('Admin user not found');
    } else {
        console.log('Admin found:', row.username);
        const match = bcrypt.compareSync('admin123', row.password);
        console.log('Password "admin123" matches:', match);
    }
    db.close();
});
