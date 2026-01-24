import { NextResponse } from 'next/server';
import fsPromises from 'fs/promises';
import fs from 'fs';
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

    // Video Streaming Logic (Range Support)
    const stat = await fsPromises.stat(filePath);
    const fileSize = stat.size;
    const range = request.headers.get('range');

    const ext = path.extname(filename).toLowerCase();
    let contentType = 'application/octet-stream';
    if (ext === '.mp4') contentType = 'video/mp4';
    else if (ext === '.webm') contentType = 'video/webm';
    else if (ext === '.mov') contentType = 'video/quicktime';
    else if (ext === '.mkv') contentType = 'video/x-matroska';
    else if (ext === '.jpg' || ext === '.jpeg') contentType = 'image/jpeg';
    else if (ext === '.png') contentType = 'image/png';
    else if (ext === '.gif') contentType = 'image/gif';
    else if (ext === '.webp') contentType = 'image/webp';
    else if (ext === '.svg') contentType = 'image/svg+xml';

    if (range && contentType.startsWith('video/')) {
        const parts = range.replace(/bytes=/, "").split("-");
        const start = parseInt(parts[0], 10);
        const end = parts[1] ? parseInt(parts[1], 10) : fileSize - 1;
        const chunksize = (end - start) + 1;

        const fileStream = fs.createReadStream(filePath, { start, end });

        // Convert Node stream to Web Stream for Next.js
        const stream = new ReadableStream({
            start(controller) {
                fileStream.on('data', chunk => controller.enqueue(chunk));
                fileStream.on('end', () => controller.close());
                fileStream.on('error', (err) => controller.error(err));
            }
        });

        return new NextResponse(stream, {
            status: 206,
            headers: {
                'Content-Range': `bytes ${start}-${end}/${fileSize}`,
                'Accept-Ranges': 'bytes',
                'Content-Length': chunksize,
                'Content-Type': contentType,
                'Cache-Control': 'no-cache', // Important for partial content generally
            },
        });
    } else {
        // Standard full file response (images or full video download)
        const fileBuffer = await fsPromises.readFile(filePath);
        return new NextResponse(fileBuffer, {
            headers: {
                'Content-Type': contentType,
                'Content-Length': fileSize,
                'Cache-Control': 'public, max-age=31536000, immutable',
                'Accept-Ranges': 'bytes', // Advertise range support
            },
        });
    }
}
