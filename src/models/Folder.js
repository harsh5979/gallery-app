
import mongoose from 'mongoose';

const FolderSchema = new mongoose.Schema({
    name: {
        type: String,
        required: true,
        trim: true,
    },
    path: {
        type: String, // Absolute virtual path, e.g. "/vacation/2024"
        required: true,
        unique: true,
    },
    parent: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Folder',
        default: null, // Root folders have null parent
    },
    owner: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true,
    },
    isPublic: {
        type: Boolean,
        default: false,
    }
}, { timestamps: true });

// Ensure we can quickly find children of a folder
FolderSchema.index({ parent: 1 });
FolderSchema.index({ path: 1 });

export default mongoose.models.Folder || mongoose.model('Folder', FolderSchema);
