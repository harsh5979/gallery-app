import { NextResponse } from 'next/server';
import { readFileContent, getImageMeta } from '@/lib/storage';

// Dynamic route: /api/images/[...path]
// path will be an array, e.g. ['folder', 'subfolder', 'image.jpg']
// or just ['image.jpg'] for root

export async function GET(request, { params }) {
    const { path: pathSegments } = await params;

    if (!pathSegments || pathSegments.length === 0) {
        return new NextResponse("Missing path", { status: 400 });
    }

    // Decode all segments
    const decodedSegments = pathSegments.map(p => decodeURIComponent(p));

    // The last segment is the filename
    const filename = decodedSegments.pop();
    // The rest is the folder path
    const folder = decodedSegments.join('/') || '';

    // Handle "root" placeholder if it was passed explicitly (GridItem uses 'root' if empty)
    // Actually, GridItem sends `/api/images/root/img.jpg` if folder is empty.
    // So if folder is 'root', treat it as ''
    const effectiveFolder = folder === 'root' ? '' : folder;

    console.log(`[API] Serve Image: ${filename} from folder: '${effectiveFolder}' (raw: '${folder}')`);

    try {
        const fileBuffer = await readFileContent(effectiveFolder, filename);
        if (!fileBuffer) {
            return new NextResponse("File not found", { status: 404 });
        }

        // Determine MIME type (simple check)
        const ext = filename.split('.').pop().toLowerCase();
        let contentType = 'application/octet-stream';
        if (['jpg', 'jpeg'].includes(ext)) contentType = 'image/jpeg';
        else if (['png'].includes(ext)) contentType = 'image/png';
        else if (['gif'].includes(ext)) contentType = 'image/gif';
        else if (['webp'].includes(ext)) contentType = 'image/webp';
        else if (['mp4'].includes(ext)) contentType = 'video/mp4';
        else if (ext === 'pdf') contentType = 'application/pdf';

        // Serve file
        return new NextResponse(fileBuffer, {
            headers: {
                'Content-Type': contentType,
                'Cache-Control': 'public, max-age=31536000, immutable',
            },
        });
    } catch (error) {
        console.error("Error serving image:", error);
        return new NextResponse("Internal Server Error", { status: 500 });
    }
}
