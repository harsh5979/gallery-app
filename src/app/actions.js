
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

    const folderName = formData.get('folderName');
    if (!folderName) return { error: 'Folder name required' };

    try {
        await createFolder(folderName);

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
    const file = formData.get('file');

    if (!folder || !file) return { error: 'Missing data' };

    try {
        await saveFile(folder, file, file.name);

        revalidatePath(`/?folder=${folder}`);
        revalidateTag('gallery');
        return { success: true };
    } catch (e) {
        return { error: e.message };
    }
}
