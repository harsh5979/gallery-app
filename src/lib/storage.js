
import fs from 'fs/promises';
import path from 'path';

const STORAGE_DIR = path.join(process.cwd(), 'gallery_storage');

// Ensure storage dir exists
(async () => {
    try {
        await fs.access(STORAGE_DIR);
    } catch {
        await fs.mkdir(STORAGE_DIR, { recursive: true });
    }
})();

export async function createFolder(folderName) {
    // folderName can be "path/to/folder"
    const folderPath = path.join(STORAGE_DIR, folderName);
    if (!folderPath.startsWith(STORAGE_DIR)) throw new Error("Invalid path");
    await fs.mkdir(folderPath, { recursive: true });
}

export async function saveFile(folder, file, filename) {
    const folderPath = path.join(STORAGE_DIR, folder);
    if (!folderPath.startsWith(STORAGE_DIR)) throw new Error("Invalid path");

    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    await fs.writeFile(path.join(folderPath, filename), buffer);
}

// Unified function to get contents of a directory (folders + images)
export async function listDirectoryContents(relativePath = '', page = 1, limit = 18) {
    try {
        // Normalize path and prevent traversal
        const safePath = path.posix.normalize(relativePath).replace(/^(\.\.(\/|\\|$))+/, '');
        const absPath = path.join(STORAGE_DIR, safePath);

        if (!absPath.startsWith(STORAGE_DIR)) {
            throw new Error("Invalid path");
        }

        await fs.access(absPath);

        const items = await fs.readdir(absPath, { withFileTypes: true });

        // Separete folders and images
        const folders = items
            .filter(item => item.isDirectory())
            .map(item => item.name);

        const imageFiles = items
            .filter(item => !item.isDirectory() && /\.(jpg|jpeg|png|gif|webp|svg|mp4|webm|mov|mkv)$/i.test(item.name))
            .map(item => item.name);

        // Pagination logic (only for images, folders always show all at top)
        const start = (page - 1) * limit;
        const end = start + limit;
        const paginatedImages = imageFiles.slice(start, end);

        return {
            folders,
            images: paginatedImages,
            hasMore: end < imageFiles.length,
            totalImages: imageFiles.length
        };
    } catch (error) {
        console.error(`Error listing contents in ${relativePath}:`, error);
        return { folders: [], images: [], hasMore: false, totalImages: 0 };
    }
}
