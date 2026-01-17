import { NextResponse } from 'next/server';
import fs from 'fs/promises';
import path from 'path';

const STORAGE_DIR = path.join(process.cwd(), 'gallery_storage');

export async function GET(request, { params }) {
    const { path: pathParams } = await params;

    // Support for root images using 'root' keyword
    // Pattern: /api/images/root/filename.jpg -> pathParams: ['root', 'filename.jpg']
    // Pattern: /api/images/folder/sub/file.jpg -> pathParams: ['folder', 'sub', 'file.jpg']

    let folderPath = '';
    let filename = '';

    if (pathParams[0] === 'root') {
        // Handle root special case
        folderPath = '';
        filename = pathParams[pathParams.length - 1];
    } else {
        // Handle nested paths
        // Join all parts except the last one for the folder path
        filename = pathParams[pathParams.length - 1];
        folderPath = pathParams.slice(0, -1).join(path.sep);
    }

    // Security check
    if (folderPath.includes('..') || filename.includes('..')) {
        return new NextResponse('Invalid Path', { status: 400 });
    }

    // Decode properly to handle spaces/special chars that might have survived or been double encoded
    try {
        folderPath = decodeURIComponent(folderPath);
        filename = decodeURIComponent(filename);
    } catch (e) {
        // ignore decoding errors, proceed with raw
    }

    const filePath = path.join(STORAGE_DIR, folderPath, filename);

    try {
        await fs.access(filePath);
        // Create read stream for better performance with large files (videos)
        // Note: readFile buffers entire file, createReadStream is better but NextResponse with buffer is easier for images.
        // For videos, Range requests support is ideal but let's stick to buffer for now or switch to stream if simple.
        // Actually, for 16k pics, standard buffer is fine. Usage of stream for video is better.
        // Let's stick to simple buffer for consistency unless user complains of video load fail.
        const fileBuffer = await fs.readFile(filePath);

        // Simple mime type detection
        const ext = path.extname(filename).toLowerCase();
        let contentType = 'application/octet-stream';
        // Images
        if (ext === '.jpg' || ext === '.jpeg') contentType = 'image/jpeg';
        else if (ext === '.png') contentType = 'image/png';
        else if (ext === '.gif') contentType = 'image/gif';
        else if (ext === '.webp') contentType = 'image/webp';
        else if (ext === '.svg') contentType = 'image/svg+xml';
        // Videos
        else if (ext === '.mp4') contentType = 'video/mp4';
        else if (ext === '.webm') contentType = 'video/webm';
        else if (ext === '.mov') contentType = 'video/quicktime';
        else if (ext === '.mkv') contentType = 'video/x-matroska';

        return new NextResponse(fileBuffer, {
            headers: {
                'Content-Type': contentType,
                'Cache-Control': 'public, max-age=31536000, immutable',
            },
        });
    } catch (e) {
        return new NextResponse('File Not Found', { status: 404 });
    }
}
