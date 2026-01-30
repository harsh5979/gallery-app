
import dbConnect from './db';
import User from '@/models/User';
import Group from '@/models/Group';
import Permission from '@/models/Permission';
import Folder from '@/models/Folder';

/**
 * Check if a user has access to a resource
 * @param {string} userId
 * @param {string|Object} resource - Folder path string or Folder object
 * @param {string} accessType - 'read', 'write', 'admin'
 * @returns {Promise<boolean>}
 */
export async function checkPermission(userId, resource, accessType = 'read') {
    if (!userId) return false;
    await dbConnect();

    const user = await User.findById(userId).populate('groups');
    if (!user) return false;

    // 1. Admin Override
    if (user.role === 'admin') return true;

    // Resolve Folder
    let folder;
    if (typeof resource === 'string') {
        const normalizedPath = resource.replace(/\\/g, '/').replace(/^\/+|\/+$/g, '');
        // If root
        if (normalizedPath === '') {
            // Access to root? Maybe allow read default? 
            // System policy: Root is public-ish or handled by specific root perm?
            // Let's assume Root is restricted unless permitted.
            folder = await Folder.findOne({ path: '' });
        } else {
            folder = await Folder.findOne({ path: normalizedPath });
        }
    } else {
        folder = resource;
    }

    // If folder doesn't exist in DB (e.g. physical only), safe default is DENY.
    // Unless it's root and we want to show it.
    if (!folder) {
        // Fallback: Check if it's actually root
        if (resource === '' || resource === '/') return true; // Allow root listing generally? Or maybe check strict.
        return false;
    }

    // 2. Owner Access
    if (folder.owner && folder.owner.toString() === userId) return true;

    // 3. Allowed Users Check (Direct access)
    if (folder.allowedUsers && folder.allowedUsers.some(id => id.toString() === userId)) return true;

    // 4. Public Access (Read Only)
    if (accessType === 'read' && folder.isPublic) return true;

    // 5. Explicit Permission Check
    // Hierarchy: Admin > Write > Read
    const levels = { 'read': 1, 'write': 2, 'admin': 3 };
    const requiredLevel = levels[accessType];

    // Get all permissions for this folder
    const relevantPerms = await Permission.find({ resource: folder._id });

    // Check User Specific
    const userPerm = relevantPerms.find(p => p.user && p.user.toString() === userId);
    if (userPerm && levels[userPerm.access] >= requiredLevel) return true;

    // Check Group Specific
    if (user.groups && user.groups.length > 0) {
        const groupIds = user.groups.map(g => g._id.toString());
        const groupPerm = relevantPerms.find(p => p.group && groupIds.includes(p.group.toString()));
        if (groupPerm && levels[groupPerm.access] >= requiredLevel) return true;
    }

    return false;
}

/**
 * Bulk check permissions for a list of relative paths
 * @param {string} userId 
 * @param {string[]} paths - relative paths of subfolders
 * @returns {Promise<string[]>} - list of accessible paths
 */
export async function filterAccessibleFolders(userId, paths) {
    if (!userId) return [];
    if (!paths || paths.length === 0) return [];

    await dbConnect();
    const user = await User.findById(userId).populate('groups');
    if (!user) return [];
    if (user.role === 'admin') return paths;

    // Fetch all folder docs
    const folders = await Folder.find({ path: { $in: paths } });

    // If folder not in DB, it's effectively "hidden" or "new". 
    // Policy: Hidden if not in DB? Or User owns it? 
    // If not in DB, sync hasn't run. Safe default: Hide.

    // Optimization: Get all permissions for these folders
    const folderIds = folders.map(f => f._id);
    const allPerms = await Permission.find({ resource: { $in: folderIds } });

    const accessiblePaths = [];

    for (const pathStr of paths) {
        const folder = folders.find(f => f.path === pathStr);
        if (!folder) continue; // Skip if not in DB 

        let hasAccess = false;
        // 1. Owner
        if (folder.owner && folder.owner.toString() === userId) hasAccess = true;
        // 2. Allowed Users
        else if (folder.allowedUsers && folder.allowedUsers.some(id => id.toString() === userId)) hasAccess = true;
        // 3. Public
        else if (folder.isPublic) hasAccess = true;
        else {
            // 4. Permissions
            const perms = allPerms.filter(p => p.resource.toString() === folder._id.toString());

            // Check User Perm
            if (perms.some(p => p.user && p.user.toString() === userId)) hasAccess = true;

            // Check Group Perm
            else if (user.groups && user.groups.length > 0) {
                const groupIds = user.groups.map(g => g._id.toString());
                if (perms.some(p => p.group && groupIds.includes(p.group.toString()))) hasAccess = true;
            }
        }

        if (hasAccess) accessiblePaths.push(pathStr);
    }

    return accessiblePaths;
}
