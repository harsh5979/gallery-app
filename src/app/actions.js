
'use server';

import { redirect } from 'next/navigation';
import { loginUser, logoutUser, isAdmin } from '@/lib/auth';
import { listDirectoryContents, createFolder, saveFile } from '@/lib/storage';
import { revalidatePath, revalidateTag } from 'next/cache';

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
    return await getCachedGalleryData(folder, page);
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

        revalidatePath('/'); // Refresh gallery list
        revalidateTag('gallery');
        return { success: true };
    } catch (e) {
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

        revalidatePath(`/?folder=${folder}`);
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
