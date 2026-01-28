
import mongoose from 'mongoose';

const PermissionSchema = new mongoose.Schema({
    resource: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Folder',
        required: true,
    },
    user: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        default: null,
    },
    group: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Group',
        default: null,
    },
    access: {
        type: String,
        enum: ['read', 'write', 'admin'],
        required: true,
    },
}, { timestamps: true });

// Ensure unique permission per entity per resource
PermissionSchema.index({ resource: 1, user: 1 }, { unique: true, partialFilterExpression: { user: { $type: "objectId" } } });
PermissionSchema.index({ resource: 1, group: 1 }, { unique: true, partialFilterExpression: { group: { $type: "objectId" } } });

export default mongoose.models.Permission || mongoose.model('Permission', PermissionSchema);
