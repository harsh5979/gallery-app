import fs from 'fs/promises';
import path from 'path';
import exifr from 'exifr';

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

export async function deletePath(relativePath) {
    const safePath = path.posix.normalize(relativePath).replace(/^(\.\.(\/|\\|$))+/, '');
    const absPath = path.join(STORAGE_DIR, safePath);
    if (!absPath.startsWith(STORAGE_DIR)) throw new Error("Invalid path");

    await fs.rm(absPath, { recursive: true, force: true });
}

// Combine chunks logic
export async function appendChunk(folder, filename, buffer, chunkIndex, totalChunks) {
    const folderPath = path.join(STORAGE_DIR, folder || '');
    if (!folderPath.startsWith(STORAGE_DIR)) throw new Error("Invalid path");

    // Ensure folder exists (mainly for first chunk)
    if (chunkIndex === 0) {
        await fs.mkdir(folderPath, { recursive: true });
    }

    const partPath = path.join(folderPath, `${filename}.part`);
    const finalPath = path.join(folderPath, filename);

    if (chunkIndex === 0) {
        // Start fresh for first chunk
        await fs.writeFile(partPath, buffer);
    } else {
        // Append for subsequent chunks
        await fs.appendFile(partPath, buffer);
    }

    // If last chunk, rename to final
    if (chunkIndex === totalChunks - 1) {
        await fs.rename(partPath, finalPath);
    }
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

        // Helper to format file size
        const formatSize = (bytes) => {
            if (bytes === 0) return '0 B';
            const k = 1024;
            const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
            const i = Math.floor(Math.log(bytes) / Math.log(k));
            return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
        };

        const imageFiles = await Promise.all(items
            .filter(item => !item.isDirectory() && /\.(jpg|jpeg|png|gif|webp|svg|mp4|webm|mov|mkv|avi|heic|heif|dng|cr2|arw|tiff|tif|bmp|js|jsx|ts|tsx|css|html|json|md|txt|py|java|c|cpp|h|go|rs|sql|xml|yaml|yml|log|ini|conf)$/i.test(item.name))
            .map(async (item) => {
                const filePath = path.join(absPath, item.name);
                const stat = await fs.stat(filePath);

                let createdDate = stat.birthtime;


                return {
                    name: item.name,
                    size: formatSize(stat.size),
                    sizeBytes: stat.size,
                    modified: stat.mtime.toISOString(),
                    created: stat.birthtime.toISOString(), // Basic created time (upload time usually)
                    type: item.name.split('.').pop().toLowerCase()
                };
            }));

        // Sort by created date (newest first)
        imageFiles.sort((a, b) => new Date(b.created) - new Date(a.created));

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

export async function getImageMeta(folder, filename) {
    try {
        const folderPath = path.join(STORAGE_DIR, folder || '');
        const filePath = path.join(folderPath, filename);

        if (!filePath.startsWith(STORAGE_DIR)) throw new Error("Invalid path");
        await fs.access(filePath);

        const stat = await fs.stat(filePath);
        let createdDate = stat.birthtime;
        let exifData = null;

        // Try EXIF
        try {
            if (/\.(jpg|jpeg|png|heic|heif|dng|cr2|arw|tiff|tif)$/i.test(filename)) {
                exifData = await exifr.parse(filePath);
                if (exifData && (exifData.DateTimeOriginal || exifData.CreateDate)) {
                    createdDate = exifData.DateTimeOriginal || exifData.CreateDate;
                }
            }
        } catch (e) {
            console.error("EXIF Parse Error:", e);
        }

        return {
            name: filename,
            sizeBytes: stat.size,
            modified: stat.mtime.toISOString(),
            created: createdDate.toISOString(),
            exif: exifData ? JSON.parse(JSON.stringify(exifData)) : null // sanitize for client
        };

    } catch (e) {
        console.error("Meta Error:", e);
        return null;
    }
}

export async function readFileContent(folder, filename) {
    try {
        const folderPath = path.join(STORAGE_DIR, folder || '');
        const filePath = path.join(folderPath, filename);

        if (!filePath.startsWith(STORAGE_DIR)) throw new Error("Invalid path");
        await fs.access(filePath);

        const content = await fs.readFile(filePath, 'utf-8');
        return content;
    } catch (e) {
        console.error("Read File Error:", e);
        return null;
    }
}

export async function saveFileContent(folder, filename, content) {
    try {
        const folderPath = path.join(STORAGE_DIR, folder || '');
        const filePath = path.join(folderPath, filename);

        if (!filePath.startsWith(STORAGE_DIR)) throw new Error("Invalid path");

        // Ensure the file exists before writing to prevent creating new files via this endpoint if desired,
        // or just write it. For editing, it should exist.
        await fs.access(filePath);

        await fs.writeFile(filePath, content, 'utf-8');
        return { success: true };
    } catch (e) {
        console.error("Save File Error:", e);
        return { success: false, error: e.message };
    }
}
