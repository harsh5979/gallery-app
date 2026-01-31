const fs = require('fs');
const fsPromises = require('fs/promises');
const path = require('path');

/**
 * Socket.io Handler Module
 * Manages real-time events including chunked file uploads and room-based notifications.
 */

// Central Storage configuration
const customStoragePath = process.env.GALLERY_STORAGE_PATH;
const STORAGE_ROOT = path.resolve(customStoragePath || path.join(process.cwd(), 'gallery_storage'));

// Helper to get DB models in CommonJS context
async function getModels() {
    const dbConnect = (await import('./db.js')).default;
    const Folder = (await import('../models/Folder.js')).default;
    await dbConnect();
    return { Folder };
}

module.exports = function socketHandler(io) {
    io.on('connection', (socket) => {
        console.log(`[Socket] Client connected: ${socket.id}`);

        /**
         * 1. Multi-User Engagement
         * Users join rooms based on their ID to receive targeted permission updates.
         */
        socket.on('join_user_room', (userId) => {
            if (userId) {
                console.log(`[Socket] ${socket.id} joined user: ${userId}`);
                socket.join(`user:${userId}`);
                socket.userId = userId; // Track for incremental DB sync
            }
        });

        /**
         * 2. Chunked File Upload Logic
         * Handles streaming large files to disk via Socket.io chunks.
         */
        let currentUpload = {
            stream: null,
            path: null,
            bytesWritten: 0,
            roomId: null
        };

        // Initialize Upload Session
        socket.on('upload_start', async ({ folder, fileName, totalSize, roomId }) => {
            try {
                // Ensure targetDir is contained within STORAGE_ROOT for security
                const targetDir = path.resolve(STORAGE_ROOT, folder || '');

                if (!targetDir.startsWith(STORAGE_ROOT)) {
                    console.error(`[Upload] Forbidden path: ${targetDir}`);
                    socket.emit('upload_error', { message: 'Invalid path' });
                    return;
                }

                // Create folder recursively if it doesn't exist
                await fsPromises.mkdir(targetDir, { recursive: true });

                // Incremental DB Registration
                const { Folder } = await getModels();
                const pathParts = folder ? folder.split('/') : [];
                let currentPath = "";
                let parentId = null;

                for (const part of pathParts) {
                    currentPath = currentPath ? `${currentPath}/${part}` : part;
                    let dbFolder = await Folder.findOne({ path: currentPath });

                    if (!dbFolder) {
                        dbFolder = await Folder.create({
                            name: part,
                            path: currentPath,
                            parent: parentId,
                            owner: socket.userId || null,
                            isPublic: true // Default to public for new uploads
                        });
                    }
                    parentId = dbFolder._id;
                }

                const filePath = path.join(targetDir, fileName);
                console.log(`[Upload] Staging: ${fileName}`);

                // Initialize clean upload state
                currentUpload.path = filePath;
                currentUpload.roomId = roomId;
                currentUpload.stream = fs.createWriteStream(filePath);
                currentUpload.bytesWritten = 0;

                // Error listener for the file stream
                currentUpload.stream.on('error', (err) => {
                    console.error("[Upload] Stream failure:", err);
                    socket.emit('upload_error', { message: `Write error: ${err.message}` });
                });

                socket.emit('upload_ready');
            } catch (err) {
                console.error("[Upload] Start failed:", err);
                socket.emit('upload_error', { message: `System error: ${err.message}` });
            }
        });

        // Handle incoming data chunks
        socket.on('upload_chunk', (chunk) => {
            if (!currentUpload.stream) return;
            const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);

            // Write and manage backpressure
            const canWrite = currentUpload.stream.write(buffer);
            currentUpload.bytesWritten += buffer.length;

            if (!canWrite) {
                currentUpload.stream.once('drain', () => socket.emit('upload_ack'));
            } else {
                socket.emit('upload_ack');
            }
        });

        // Finalize Upload
        socket.on('upload_end', () => {
            if (currentUpload.stream) {
                const finalPath = currentUpload.path;
                const finalRoomId = currentUpload.roomId;

                currentUpload.stream.end();
                currentUpload.stream.once('finish', () => {
                    console.log(`[Upload] Successfully saved: ${path.basename(finalPath)}`);
                    socket.emit('upload_complete', { path: finalPath });

                    // Broadcast refresh event to appropriate scope
                    const notify = { path: finalPath };
                    if (finalRoomId) io.to(finalRoomId).emit('gallery:refresh', notify);
                    else io.emit('gallery:refresh', notify);

                    // Reset local upload state
                    currentUpload.stream = null;
                    currentUpload.path = null;
                });
            }
        });

        /**
         * 3. Cleanup on Disconnect
         */
        socket.on('disconnect', () => {
            if (currentUpload.stream) {
                console.log(`[Upload] Cleanup after drop: ${currentUpload.path}`);
                currentUpload.stream.destroy();
                currentUpload.stream = null;
            }
            console.log(`[Socket] Disconnected: ${socket.id}`);
        });
    });
};
