// Node.js imports are moved inside functions to prevent "Couldn't load fs" errors in client components

const getStorageDir = async () => {
    const path = await import('path');
    const customStoragePath = process.env.GALLERY_STORAGE_PATH;
    return path.resolve(customStoragePath || path.join(process.cwd(), 'gallery_storage'));
};

// Ensure storage dir exists (Initialization)
(async () => {
    try {
        const path = await import('path');
        const fs = await import('fs/promises');
        const dir = path.resolve(process.env.GALLERY_STORAGE_PATH || path.join(process.cwd(), 'gallery_storage'));
        await fs.access(dir).catch(() => fs.mkdir(dir, { recursive: true }));
    } catch (e) {
        console.error("Storage Initialization Error:", e);
    }
})();

export async function createFolder(folderName) {
    const path = await import('path');
    const fs = await import('fs/promises');
    const STORAGE_DIR = await getStorageDir();

    const folderPath = path.resolve(STORAGE_DIR, folderName);
    const relative = path.relative(STORAGE_DIR, folderPath);
    console.log(`[Storage] Creating folder: ${folderPath}`);

    if (relative.startsWith('..') || path.isAbsolute(relative)) {
        console.error(`[Storage] Path Blocked: ${folderPath} is outside ${STORAGE_DIR}`);
        throw new Error("Invalid path");
    }

    try {
        await fs.mkdir(folderPath, { recursive: true });
        console.log(`[Storage] Folder created successfully: ${folderPath}`);
    } catch (e) {
        console.error(`[Storage] mkdir Error: ${folderPath}`, e);
        throw e;
    }
}

export async function saveFile(folder, file, filename) {
    const path = await import('path');
    const fs = await import('fs/promises');
    const STORAGE_DIR = await getStorageDir();

    const folderPath = path.resolve(STORAGE_DIR, folder || '');
    const relative = path.relative(STORAGE_DIR, folderPath);
    if (relative.startsWith('..') || path.isAbsolute(relative)) throw new Error("Invalid path");

    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    await fs.writeFile(path.join(folderPath, filename), buffer);
}

export async function deletePath(relativePath) {
    const path = await import('path');
    const fs = await import('fs/promises');
    const STORAGE_DIR = await getStorageDir();

    const safePath = path.posix.normalize(relativePath).replace(/^(\.\.(\/|\\|$))+/, '');
    const absPath = path.resolve(STORAGE_DIR, safePath);
    const relative = path.relative(STORAGE_DIR, absPath);
    if (relative.startsWith('..') || path.isAbsolute(relative)) throw new Error("Invalid path");

    await fs.rm(absPath, { recursive: true, force: true });
}

// Combine chunks logic
export async function appendChunk(folder, filename, buffer, chunkIndex, totalChunks) {
    const path = await import('path');
    const fs = await import('fs/promises');
    const STORAGE_DIR = await getStorageDir();

    const folderPath = path.resolve(STORAGE_DIR, folder || '');
    const relative = path.relative(STORAGE_DIR, folderPath);
    if (relative.startsWith('..') || path.isAbsolute(relative)) throw new Error("Invalid path");

    if (chunkIndex === 0) {
        await fs.mkdir(folderPath, { recursive: true });
    }

    const partPath = path.join(folderPath, `${filename}.part`);
    const finalPath = path.join(folderPath, filename);

    if (chunkIndex === 0) {
        await fs.writeFile(partPath, buffer);
    } else {
        await fs.appendFile(partPath, buffer);
    }

    if (chunkIndex === totalChunks - 1) {
        await fs.rename(partPath, finalPath);
    }
}

export async function listDirectoryContents(relativePath = '', page = 1, limit = 30) {
    try {
        const path = await import('path');
        const fs = await import('fs/promises');
        const STORAGE_DIR = await getStorageDir();

        const safePath = path.posix.normalize(relativePath).replace(/^(\.\.(\/|\\|$))+/, '');
        const absPath = path.resolve(STORAGE_DIR, safePath);
        const relative = path.relative(STORAGE_DIR, absPath);

        if (relative.startsWith('..') || path.isAbsolute(relative)) {
            throw new Error("Invalid path");
        }

        await fs.access(absPath);
        const items = await fs.readdir(absPath, { withFileTypes: true });

        const folders = items
            .filter(item => item.isDirectory())
            .map(item => item.name);

        const formatSize = (bytes) => {
            if (bytes === 0) return '0 B';
            const k = 1024;
            const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
            const i = Math.floor(Math.log(bytes) / Math.log(k));
            return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
        };

        const imageFiles = await Promise.all(items
            .filter(item => !item.isDirectory() && !item.name.startsWith('.'))
            .map(async (item) => {
                const filePath = path.join(absPath, item.name);
                const stat = await fs.stat(filePath);
                return {
                    name: item.name,
                    size: formatSize(stat.size),
                    sizeBytes: stat.size,
                    modified: stat.mtime.toISOString(),
                    created: stat.birthtime.toISOString(),
                    type: item.name.split('.').pop().toLowerCase()
                };
            }));

        imageFiles.sort((a, b) => new Date(b.created) - new Date(a.created));

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
        const path = await import('path');
        const fs = await import('fs/promises');
        const exifr = await import('exifr');
        const STORAGE_DIR = await getStorageDir();

        const folderPath = path.resolve(STORAGE_DIR, folder || '');
        const filePath = path.resolve(folderPath, filename);

        const relative = path.relative(STORAGE_DIR, filePath);
        if (relative.startsWith('..') || path.isAbsolute(relative)) throw new Error("Invalid path");
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
        const path = await import('path');
        const fs = await import('fs/promises');
        const STORAGE_DIR = await getStorageDir();

        const folderPath = path.resolve(STORAGE_DIR, folder || '');
        const filePath = path.resolve(folderPath, filename);

        const relative = path.relative(STORAGE_DIR, filePath);
        if (relative.startsWith('..') || path.isAbsolute(relative)) throw new Error("Invalid path");
        await fs.access(filePath);

        const content = await fs.readFile(filePath);
        return content;
    } catch (e) {
        console.error("Read File Error:", e);
        return null;
    }
}

export async function saveFileContent(folder, filename, content) {
    try {
        const path = await import('path');
        const fs = await import('fs/promises');
        const STORAGE_DIR = await getStorageDir();

        const folderPath = path.resolve(STORAGE_DIR, folder || '');
        const filePath = path.resolve(folderPath, filename);

        const relative = path.relative(STORAGE_DIR, filePath);
        if (relative.startsWith('..') || path.isAbsolute(relative)) throw new Error("Invalid path");

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
