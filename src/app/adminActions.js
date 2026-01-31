
'use server';

import dbConnect from '@/lib/db';
import User from '@/models/User';
import Group from '@/models/Group';
import Permission from '@/models/Permission';
import Folder from '@/models/Folder';
import { isAdmin, getSession } from '@/lib/auth';
import { revalidatePath, revalidateTag } from 'next/cache';
import { notifyChange } from '@/lib/events';

// --- Folder Management & Sync ---

// --- Folder Management & Sync ---

async function emitSocketEvent(event, roomId, data) {
    const APP_URL = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
    try {
        await fetch(`${APP_URL}/api/socket-notify`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ event, roomId, data })
        });
    } catch (e) {
        // Silent fail for production socket notifications
    }
}

export async function syncFolders() {
    if (!await isAdmin()) return { error: 'Unauthorized' };
    await dbConnect();

    const fs = await import('fs/promises');
    const path = await import('path');
    const mongoose = (await import('mongoose')).default;

    const session = await getSession();
    const STORAGE_ROOT = path.resolve(process.env.GALLERY_STORAGE_PATH || path.join(process.cwd(), 'gallery_storage'));

    try {
        await fs.access(STORAGE_ROOT);
    } catch (e) {
        return { error: 'Storage root not accessible.' };
    }

    const existingFolders = await Folder.find({});
    const folderMap = new Map();
    existingFolders.forEach(f => folderMap.set(f.path, f));

    const foundPaths = new Set();
    const newFolders = [];
    const movedFolders = [];
    const pathToIdMap = new Map();
    existingFolders.forEach(f => pathToIdMap.set(f.path, f._id.toString()));

    async function walk(dir, parentId = null, parentRelPath = "") {
        let entries;
        try {
            entries = await fs.readdir(dir, { withFileTypes: true });
        } catch (e) { return; }

        for (const entry of entries) {
            if (entry.isDirectory()) {
                const fullPath = path.join(dir, entry.name);
                const relPath = parentRelPath ? `${parentRelPath}/${entry.name}` : entry.name;
                foundPaths.add(relPath);

                let folderObj = folderMap.get(relPath);
                let currentId;

                if (!folderObj) {
                    const newId = new mongoose.Types.ObjectId();
                    newFolders.push({
                        _id: newId,
                        name: entry.name,
                        path: relPath,
                        parent: parentId,
                        owner: session.id,
                        isPublic: true,
                    });
                    pathToIdMap.set(relPath, newId.toString());
                    currentId = newId;
                } else {
                    currentId = folderObj._id;
                    const dbParent = folderObj.parent ? folderObj.parent.toString() : null;
                    const expectedParent = parentId ? parentId.toString() : null;

                    if (dbParent !== expectedParent) {
                        movedFolders.push({ id: currentId, parent: parentId });
                    }
                    pathToIdMap.set(relPath, currentId.toString());
                }
                await walk(fullPath, currentId, relPath);
            }
        }
    }

    try {
        await walk(STORAGE_ROOT);

        if (newFolders.length > 0) await Folder.insertMany(newFolders);

        if (movedFolders.length > 0) {
            const bulkOps = movedFolders.map(m => ({
                updateOne: {
                    filter: { _id: m.id },
                    update: { parent: m.parent }
                }
            }));
            await Folder.bulkWrite(bulkOps);
        }

        const idsToDelete = [];
        for (const [path, folder] of folderMap) {
            if (!foundPaths.has(path)) idsToDelete.push(folder._id);
        }

        if (idsToDelete.length > 0) {
            await Folder.deleteMany({ _id: { $in: idsToDelete } });
        }

        revalidatePath('/admin');
        revalidatePath('/');
        revalidateTag('gallery');

        return { success: true, added: newFolders.length, updated: movedFolders.length, removed: idsToDelete.length };
    } catch (e) {
        return { error: e.message };
    }
}

export async function toggleFolderPublic(folderIdOrPath, isPublic) {
    if (!await isAdmin()) return { error: 'Unauthorized' };
    await dbConnect();

    const mongoose = (await import('mongoose')).default;
    const query = mongoose.Types.ObjectId.isValid(folderIdOrPath) ? { _id: folderIdOrPath } : { path: folderIdOrPath };
    const updated = await Folder.findOneAndUpdate(query, { isPublic }, { new: true });

    if (!updated) return { error: 'Folder not found' };

    revalidatePath('/admin/permissions');
    revalidatePath('/');
    revalidateTag('gallery');
    emitSocketEvent('permission:update', null, { folderPath: updated.path });

    return { success: true };
}

export async function updateFolderAccess(folderId, isPublic, allowedUsers = [], recursive = false) {
    if (!await isAdmin()) return { error: 'Unauthorized' };
    await dbConnect();

    const updated = await Folder.findByIdAndUpdate(folderId, { isPublic, allowedUsers }, { new: true });
    if (!updated) return { error: 'Folder not found' };

    if (recursive) {
        const escapedPath = updated.path.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        await Folder.updateMany(
            { path: new RegExp(`^${escapedPath}/`) },
            { isPublic, allowedUsers }
        );
    }

    revalidatePath('/admin/permissions');
    revalidatePath('/');
    revalidateTag('gallery');

    emitSocketEvent('permission:update', null, { folderPath: updated.path, folderId, isRecursive: recursive });
    notifyChange('permission');

    return { success: true };
}

export async function bulkToggleFoldersPublic(folderIds, isPublic, recursive = false) {
    if (!await isAdmin()) return { error: 'Unauthorized' };

    try {
        await dbConnect();

        if (!folderIds || folderIds.length === 0) {
            return { error: 'No folders selected' };
        }

        console.log(`[BulkAction] Updating ${folderIds.length} folders to isPublic=${isPublic} (Recursive: ${recursive})`);

        if (recursive) {
            // Fetch paths to apply recursion
            const folders = await Folder.find({ _id: { $in: folderIds } }).select('path');
            const paths = folders.map(f => f.path);

            // Batch the recursive updates to avoid giant regex / query limits
            const BATCH_SIZE = 30;
            for (let i = 0; i < paths.length; i += BATCH_SIZE) {
                const batchPaths = paths.slice(i, i + BATCH_SIZE);

                // Construct regex for children: starts with path/
                const conditions = batchPaths.map(p => ({
                    path: new RegExp('^' + p.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '/')
                }));

                // Update the folders themselves + their children
                await Folder.updateMany(
                    {
                        $or: [
                            { _id: { $in: folderIds.slice(i, i + BATCH_SIZE) } },
                            ...conditions
                        ]
                    },
                    { $set: { isPublic } }
                );
            }
        } else {
            // Simple non-recursive update in large batches
            const BATCH_SIZE = 100;
            for (let i = 0; i < folderIds.length; i += BATCH_SIZE) {
                const batch = folderIds.slice(i, i + BATCH_SIZE);
                await Folder.updateMany({ _id: { $in: batch } }, { $set: { isPublic } });
            }
        }

        // Global Synchronization
        revalidatePath('/admin/permissions');
        revalidatePath('/');
        revalidateTag('gallery');

        // Notify via socket
        await emitSocketEvent('permission:update', null, { isBulk: true, isPublic });
        notifyChange('permission');

        console.log(`[BulkAction] Success: ${folderIds.length} folders processed`);
        return { success: true };
    } catch (e) {
        console.error('[BulkAction] Failure:', e);
        return { error: `Permission update failed: ${e.message}` };
    }
}

export async function getAllFolders() {
    if (!await isAdmin()) return { error: 'Unauthorized' };
    await dbConnect();
    const folders = await Folder.find({}).sort({ path: 1 }).lean();
    return { success: true, data: JSON.parse(JSON.stringify(folders)) };
}


// --- User Management ---

export async function getUsers() {
    if (!await isAdmin()) return { error: 'Unauthorized' };
    await dbConnect();
    const users = await User.find({}).select('-password').populate('groups');
    // Sanitize for client
    return { success: true, data: JSON.parse(JSON.stringify(users)) };
}

export async function updateUserGroups(userId, groupIds) {
    if (!await isAdmin()) return { error: 'Unauthorized' };
    await dbConnect();
    await User.findByIdAndUpdate(userId, { groups: groupIds });
    revalidatePath('/admin');
    return { success: true };
}

// --- Group Management ---

export async function getGroups() {
    if (!await isAdmin()) return { error: 'Unauthorized' };
    await dbConnect();
    const groups = await Group.find({}).populate('members', 'username');
    return { success: true, data: JSON.parse(JSON.stringify(groups)) };
}

export async function createGroup(name) {
    if (!await isAdmin()) return { error: 'Unauthorized' };
    await dbConnect();
    try {
        await Group.create({ name });
        revalidatePath('/admin');
        return { success: true };
    } catch (e) {
        return { error: e.message };
    }
}

export async function deleteGroup(groupId) {
    if (!await isAdmin()) return { error: 'Unauthorized' };
    await dbConnect();

    // Clean up User references
    await User.updateMany({ groups: groupId }, { $pull: { groups: groupId } });
    await Permission.deleteMany({ group: groupId });
    await Group.findByIdAndDelete(groupId);

    revalidatePath('/admin');
    return { success: true };
}

export async function addMemberToGroup(groupId, userId) {
    if (!await isAdmin()) return { error: 'Unauthorized' };
    await dbConnect();

    const group = await Group.findById(groupId);
    if (!group.members.includes(userId)) {
        group.members.push(userId);
        await group.save();

        // Also update User side
        await User.findByIdAndUpdate(userId, { $addToSet: { groups: groupId } });
    }

    revalidatePath('/admin');
    revalidatePath('/');
    revalidateTag('gallery');
    return { success: true };
}

export async function removeMemberFromGroup(groupId, userId) {
    if (!await isAdmin()) return { error: 'Unauthorized' };
    await dbConnect();

    // Remove from Group
    await Group.findByIdAndUpdate(groupId, { $pull: { members: userId } });

    // Remove from User
    await User.findByIdAndUpdate(userId, { $pull: { groups: groupId } });

    revalidatePath('/admin');
    revalidatePath('/');
    revalidateTag('gallery');
    return { success: true };
}

// --- Permission Management ---

export async function getFolderPermissions(folderId) {
    if (!await isAdmin()) return { error: 'Unauthorized' };
    await dbConnect();

    const perms = await Permission.find({ resource: folderId })
        .populate('user', 'username')
        .populate('group', 'name');

    return { success: true, data: JSON.parse(JSON.stringify(perms)) };
}

export async function setPermission(folderId, targetId, targetType, access) {
    // targetType: 'user' or 'group'
    if (!await isAdmin()) return { error: 'Unauthorized' };
    await dbConnect();

    const query = { resource: folderId };
    if (targetType === 'user') query.user = targetId;
    else query.group = targetId;

    if (access === 'remove') {
        const removedPerm = await Permission.findOneAndDelete(query);
        // Emit Revoke Event
        // Emit Revoke Event
        if (removedPerm) {
            const userId = removedPerm.user?.toString();
            if (userId) {
                emitSocketEvent('revoke:access', `user:${userId}`, { folderId });
            }
            // If group, need to find members? Implementation for group revocation:
            if (removedPerm.group) {
                // Fetch group members and emit to each? Or emit to group room if we had one.
                // For now, let's just emit a global or iterate. 
                // Simpler: Just emit to all or handle efficiently.
                // We will skip group complex logic for now and rely on revalidate/refresh for them, 
                // unless user specifically asked for group revocation too. 
                // User said "If a user’s permission is removed".
            }
        }
    } else {
        await Permission.findOneAndUpdate(query, {
            ...query,
            access,
            type: targetType
        }, { upsert: true, new: true });

        // Notify Grant/Update
        if (targetType === 'user') {
            emitSocketEvent('permission:update', `user:${targetId}`, { folderId });
        }
    }

    revalidatePath('/admin');
    revalidatePath('/');
    revalidateTag('gallery');
    return { success: true };
}

export async function revalidateGallery(folderPath) {
    if (!await isAdmin()) return { error: 'Unauthorized' };

    // Invalidate cache tags
    revalidateTag('gallery');

    // Invalidate paths
    revalidatePath('/'); // Home
    if (folderPath) {
        revalidatePath(`/?io=${folderPath}`);
    }

    return { success: true };
}
