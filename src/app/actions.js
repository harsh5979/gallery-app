
'use server';

import { redirect } from 'next/navigation';
import { loginUser, logoutUser, isAdmin, getSession } from '@/lib/auth';
import { listDirectoryContents, createFolder, saveFile } from '@/lib/storage';
import { revalidatePath, revalidateTag } from 'next/cache';
import { syncFolders } from '@/app/adminActions';

// --- Auth Actions ---

export async function login(prevState, formData) {
    const username = formData.get('username');
    const password = formData.get('password');

    const result = await loginUser(username, password);

    if (result.error) {
        return { error: result.error };
    }

    // Redirect based on role? Or just refresh.
    // Usually admin goes to dashboard, user goes to gallery.
    redirect('/');
}

export async function logout() {
    await logoutUser();
    redirect('/login');
}

// --- Gallery Actions ---

import { unstable_cache } from 'next/cache';

const getCachedGalleryData = unstable_cache(
    async (folder, page) => listDirectoryContents(folder, page),
    ['gallery-data'],
    { tags: ['gallery'] }
);

export async function getGalleryData(folder = '', page = 1) {
    const session = await getSession();
    if (!session) {
        // Allow public access? For now strict auth.
        // Actually, we might want public access later.
        // If not logged in, session is null.
        // For now, let's keep it strict or check public root.
        // The original code threw Unauthorized.
        throw new Error("Unauthorized");
    }

    // 1. Check access to CURRENT folder
    const { checkPermission, filterAccessibleFolders } = await import('@/lib/permissions');
    const canRead = await checkPermission(session.id, folder, 'read');
    if (!canRead) {
        throw new Error("Access Denied");
    }

    // 2. Get Data from Storage (FS)
    const data = await getCachedGalleryData(folder, page);

    // 3. Filter Subfolders
    // data.folders is array of strings (names) or objects? 
    // listDirectoryContents returns names usually or objects with names.
    // Let's assume listDirectoryContents returns { folders: [{name: 'foo', ...}], images: [...] }
    // We need to construct full relative paths for the filter

    // Wait, listDirectoryContents usage in storage.js:
    // returns { folders: [{ name, path, ... }], images: ... }
    // Actually typically just name or relative path.
    // I need to check listDirectoryContents output format.
    // But assuming it returns objects with 'name', the relative path is `${folder}/${name}` (cleanly joined).

    // data.folders is an array of strings (folder names) from storage.js
    const subfolderPaths = data.folders.map(name => folder ? `${folder}/${name}` : name);
    const accessiblePaths = await filterAccessibleFolders(session.id, subfolderPaths);

    // Filter the data.folders array
    // We only keep folders whose relative path is in accessiblePaths
    data.folders = data.folders.filter((name, i) => accessiblePaths.includes(subfolderPaths[i]));

    return data;
}

export async function getImageDetails(folder, filename) {
    const storage = await import('@/lib/storage');
    return await storage.getImageMeta(folder, filename);
}


export async function getFileContent(folder, filename) {
    const storage = await import('@/lib/storage');
    return await storage.readFileContent(folder, filename);
}

export async function saveFileContent(folder, filename, content) {
    const storage = await import('@/lib/storage');
    return await storage.saveFileContent(folder, filename, content);
}

// --- Admin Actions ---

export async function createNewFolder(formData) {
    const isUserAdmin = await isAdmin();
    if (!isUserAdmin) {
        return { error: 'Unauthorized' };
    }

    const folderNamesInput = formData.get('folderName');
    if (!folderNamesInput) return { error: 'Folder name required' };

    // Support multiple folders (comma separated)
    const folderNames = folderNamesInput.split(',').map(n => n.trim()).filter(Boolean);

    try {
        for (const name of folderNames) {
            await createFolder(name);
        }

        // Sync to DB so rights can be assigned
        await syncFolders();

        revalidatePath('/'); // Refresh gallery list
        revalidateTag('gallery');
        return { success: true };
    } catch (e) {
        return { error: e.message };
    }
}

export async function deleteItem(path) {
    const isUserAdmin = await isAdmin();
    if (!isUserAdmin) return { error: 'Unauthorized' };

    try {
        await import('@/lib/storage').then(mod => mod.deletePath(path));

        // revalidatePath('/', 'layout'); // Too aggressive, causes full reload feeling
        revalidateTag('gallery'); // Target specific cache tag for data
        return { success: true };
    } catch (e) {
        return { error: e.message };
    }
}

// --- Chunked Upload Action ---

export async function uploadChunk(formData) {
    const isUserAdmin = await isAdmin();
    if (!isUserAdmin) return { error: 'Unauthorized' };

    const folder = formData.get('folder');
    const fileName = formData.get('fileName');
    const chunk = formData.get('chunk');
    const chunkIndex = parseInt(formData.get('chunkIndex'));
    const totalChunks = parseInt(formData.get('totalChunks'));

    if (!fileName || !chunk) return { error: 'Missing data' };

    try {
        const buffer = Buffer.from(await chunk.arrayBuffer());

        // Use a safe temp directory or the final folder with a .part extension
        // For simplicity and knowing our storage structure, we'll delegate to a secure helper in storage.js
        // But since we can't export dynamic functions easily, we'll perform logic here or import logic.

        const storageMod = await import('@/lib/storage');
        await storageMod.appendChunk(folder, fileName, buffer, chunkIndex, totalChunks);

        if (chunkIndex === totalChunks - 1) {
            // Final chunk received and appended
            revalidatePath(`/?io=${folder}`);
            revalidateTag('gallery');
            return { success: true, completed: true };
        }

        return { success: true, completed: false };
    } catch (e) {
        console.error("Chunk upload error:", e);
        return { error: e.message };
    }
}

export async function uploadImage(formData) {
    const isUserAdmin = await isAdmin();
    if (!isUserAdmin) {
        return { error: 'Unauthorized' };
    }

    const folder = formData.get('folder');
    const files = formData.getAll('files');
    const paths = formData.getAll('paths'); // Matching relative paths

    if (folder === null || files.length === 0) return { error: 'Missing data' };

    try {
        for (let i = 0; i < files.length; i++) {
            const file = files[i];
            const relativePath = paths[i] || file.name;

            // Determine subfolder from relative path
            // e.g., "vacation/day1/img.jpg" -> "vacation/day1"
            // If just "img.jpg", dirname is "."

            // We want to combine current 'folder' + relative directory
            // Note: path module isn't available in Edge runtime normally, 
            // but we are in Node runtime here ('use server' default).
            // Manually splitting is safer if path might be browser-style forward slashes.
            const parts = relativePath.split('/');
            const fileName = parts.pop();
            const subDir = parts.join('/'); // "vacation/day1"

            const targetFolder = subDir ? (folder ? `${folder}/${subDir}` : subDir) : folder;

            if (targetFolder) {
                await createFolder(targetFolder);
            }

            await saveFile(targetFolder || '', file, fileName);
        }

        revalidatePath(`/?io=${folder}`);
        revalidateTag('gallery');
        return { success: true };
    } catch (e) {
        return { error: e.message };
    }
}


