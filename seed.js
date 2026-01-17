
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const MONGODB_URI = 'mongodb://localhost:27017/gallery_app';

const UserSchema = new mongoose.Schema({
    username: { type: String, required: true, unique: true },
    password: { type: String, required: true },
    role: { type: String, enum: ['user', 'admin'], default: 'user' },
}, { timestamps: true });

const User = mongoose.models.User || mongoose.model('User', UserSchema);

async function seed() {
    await mongoose.connect(MONGODB_URI);
    console.log('Connected to DB');

    const adminExists = await User.findOne({ username: 'admin' });
    if (adminExists) {
        console.log('Admin already exists');
        process.exit(0);
    }

    const hashedPassword = await bcrypt.hash('admin123', 10);
    await User.create({
        username: 'admin',
        password: hashedPassword,
        role: 'admin'
    });

    console.log('Admin created: admin / admin123');

    // Create a normal user too
    const userExists = await User.findOne({ username: 'user' });
    if (!userExists) {
        const hashedUserPass = await bcrypt.hash('user123', 10);
        await User.create({
            username: 'user',
            password: hashedUserPass,
            role: 'user'
        });
        console.log('User created: user / user123');
    }

    process.exit(0);
}

seed();
