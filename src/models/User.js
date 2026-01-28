
import mongoose from 'mongoose';

if (process.env.NODE_ENV === 'development') {
    delete mongoose.models.User;
}

const UserSchema = new mongoose.Schema({
    username: {
        type: String,
        required: [true, 'Please provide a username'],
        unique: true,
    },
    name: {
        type: String,
        default: function () { return this.username; }
    },
    password: {
        type: String,
        required: [true, 'Please provide a password'],
    },
    role: {
        type: String,
        enum: ['user', 'admin'],
        default: 'user',
    },
    groups: [{
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Group',
    }],
}, { timestamps: true });

export default mongoose.models.User || mongoose.model('User', UserSchema);
