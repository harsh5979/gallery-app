
import mongoose from 'mongoose';

const GroupSchema = new mongoose.Schema({
    name: {
        type: String,
        required: [true, 'Please provide a group name'],
        unique: true,
        trim: true,
    },
    members: [{
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
    }],
    description: {
        type: String,
        trim: true,
    }
}, { timestamps: true });

export default mongoose.models.Group || mongoose.model('Group', GroupSchema);
