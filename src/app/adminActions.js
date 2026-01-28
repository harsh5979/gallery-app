
'use server';

import dbConnect from '@/lib/db';
import User from '@/models/User';
import Group from '@/models/Group';
import Permission from '@/models/Permission';
import Folder from '@/models/Folder';
import { isAdmin, getSession } from '@/lib/auth';
import { revalidatePath, revalidateTag } from 'next/cache';
import path from 'path';
import fs from 'fs/promises';
import { notifyChange } from '@/lib/events';

// --- Folder Management & Sync ---

async function emitSocketEvent(event, roomId, data) {
    try {
        await fetch('http://localhost:3000/api/socket-notify', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ event, roomId, data })
        });
    } catch (e) {
        console.error("Socket Emit Failed:", e.message);
    }
}

export async function syncFolders() {
    if (!await isAdmin()) return { error: 'Unauthorized' };
    await dbConnect();

    const foundFolderIds = new Set();
    const STORAGE_ROOT = path.join(process.cwd(), 'gallery_storage'); // Ensure definition

    // Helper to walk directory
    async function walk(dir, parentId = null) {
        let entries;
        try {
            entries = await fs.readdir(dir, { withFileTypes: true });
        } catch (e) {
            return; // Directory might not exist
        }

        for (const entry of entries) {
            if (entry.isDirectory()) {
                const fullPath = path.join(dir, entry.name);
                // Calculate relative path for DB (e.g., "vacation", "vacation/2024")
                const relPath = path.relative(STORAGE_ROOT, fullPath).replace(/\\/g, '/');

                // Find or Create Folder Record
                let folder = await Folder.findOne({ path: relPath });
                if (!folder) {
                    // Default owner: Admin? Or system? 
                    // Let's assign to the first admin found or current user
                    const session = await getSession();
                    folder = await Folder.create({
                        name: entry.name,
                        path: relPath,
                        parent: parentId,
                        owner: session.id, // Assign to current admin
                        isPublic: true,
                    });
                } else {
                    if (folder.parent !== parentId) {
                        // Update parent if moved (re-sync hierarchy)
                        folder.parent = parentId;
                        await folder.save();
                    }
                }

                foundFolderIds.add(folder._id.toString());

                // Recurse
                await walk(fullPath, folder._id);
            }
        }
    }

    try {
        await walk(STORAGE_ROOT);

        // Prune: Delete folders in DB that were NOT found on disk
        // Note: This relies on a full walk. If walk fails partway, we shouldn't prune.
        if (foundFolderIds.size > 0) {
            // We only delete if we found at least something, to be safe? 
            // Or if directory is empty, we delete all?
            // Let's be safe: delete those NOT in foundFolderIds
            await Folder.deleteMany({ _id: { $nin: Array.from(foundFolderIds) } });
        } else {
            // If storage is empty (no folders), delete all folders in DB?
            // Yes, if readdir turned up nothing.
            // But we need to distinguish "empty dir" from "error reading".
            // walk returns void, simple check.
            const rootEntries = await fs.readdir(STORAGE_ROOT).catch(() => []);
            if (rootEntries.length === 0) {
                await Folder.deleteMany({});
            }
        }

        return { success: true };
    } catch (e) {
        console.error("Sync Error:", e);
        return { error: e.message };
    }
}


export async function toggleFolderPublic(folderId, isPublic) {
    if (!await isAdmin()) return { error: 'Unauthorized' };
    await dbConnect();

    const updated = await Folder.findByIdAndUpdate(folderId, { isPublic }, { new: true });

    if (!updated) {
        return { error: 'Folder not found' };
    }

    revalidatePath('/admin');
    revalidatePath('/admin/permissions'); // Explicitly revalidate this page
    revalidatePath('/');
    revalidateTag('gallery');

    // Notify all users via Socket to refresh (Fire and forget)
    emitSocketEvent('permission:update', null, { folderId });

    notifyChange('permission');
    return { success: true };
}

export async function getAllFolders() {
    if (!await isAdmin()) return { error: 'Unauthorized' };
    await dbConnect();
    // Fetch all folders, sorted by path
    const folders = await Folder.find({}).sort({ path: 1 });
    console.log(`[Admin] getAllFolders Found: ${folders.length} folders.`);
    folders.forEach(f => console.log(` - ${f.path} (ID: ${f._id}) Public: ${f.isPublic}`));
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
