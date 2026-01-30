// Load environment variables from .env.local
const { loadEnvConfig } = require('@next/env');
loadEnvConfig(process.cwd());

const express = require('express');
const next = require('next');
const { createServer } = require('http');
const { Server } = require('socket.io');
const path = require('path');
const fs = require('fs');

const dev = process.env.NODE_ENV !== 'production';
const app = next({ dev });
const handle = app.getRequestHandler();

// Storage Root for Socket Uploads
const customStoragePath = process.env.GALLERY_STORAGE_PATH;
const STORAGE_ROOT = path.resolve(customStoragePath || path.join(process.cwd(), 'gallery_storage'));

console.log(`> Storage Root: ${STORAGE_ROOT}`);

app.prepare().then(() => {
    const server = express();
    const httpServer = createServer(server);
    const io = new Server(httpServer, {
        maxHttpBufferSize: 1e8 // 100 MB allow large chunks if needed, but we recommend smaller
    });

    // Make IO accessible globally (for Server Actions to use)
    // Note: In production with multiple instances, use Redis Adapter.
    global.io = io;

    io.on('connection', (socket) => {
        console.log('Client connected:', socket.id);

        // 1. Join User Room (for permissions)
        socket.on('join_user_room', (userId) => {
            if (userId) {
                console.log(`Socket ${socket.id} joined user room: ${userId}`);
                socket.join(`user:${userId}`);
            }
        });

        // 2. Upload Logic
        let currentUpload = {
            stream: null,
            path: null,
            bytesWritten: 0,
            roomId: null
        };

        socket.on('upload_start', async ({ folder, fileName, totalSize, roomId }) => {
            try {
                const targetDir = path.resolve(STORAGE_ROOT, folder || '');
                const relative = path.relative(STORAGE_ROOT, targetDir);
                if (relative.startsWith('..') || path.isAbsolute(relative)) {
                    socket.emit('upload_error', { message: 'Invalid path' });
                    return;
                }

                if (!fs.existsSync(targetDir)) {
                    fs.mkdirSync(targetDir, { recursive: true });
                }

                const filePath = path.join(targetDir, fileName);
                currentUpload.path = filePath;
                currentUpload.roomId = roomId;

                // Use a write stream for efficiency and low memory overhead
                currentUpload.stream = fs.createWriteStream(filePath);
                currentUpload.bytesWritten = 0;

                currentUpload.stream.on('error', (err) => {
                    console.error("[Upload Stream Error]", err);
                    socket.emit('upload_error', { message: `Stream error: ${err.message}` });
                });

                socket.emit('upload_ready');
            } catch (err) {
                console.error("[Upload Start Error]:", err);
                socket.emit('upload_error', { message: `Server error: ${err.message}` });
            }
        });

        socket.on('upload_chunk', (chunk) => {
            if (!currentUpload.stream) return;
            const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);

            const canWrite = currentUpload.stream.write(buffer);
            currentUpload.bytesWritten += buffer.length;

            if (!canWrite) {
                // Backpressure: wait for drain if buffer is full
                currentUpload.stream.once('drain', () => {
                    socket.emit('upload_ack');
                });
            } else {
                // Immediate ack for speed (pipelining)
                socket.emit('upload_ack');
            }
        });

        socket.on('upload_end', () => {
            if (currentUpload.stream) {
                currentUpload.stream.end();
                currentUpload.stream.once('finish', () => {
                    const finalPath = currentUpload.path;
                    const finalRoomId = currentUpload.roomId;

                    socket.emit('upload_complete', { path: finalPath });

                    // Notify everyone (or room) to refresh
                    const notifyData = { event: 'gallery:refresh', data: { path: finalPath } };
                    if (finalRoomId) {
                        io.to(finalRoomId).emit('gallery:refresh', notifyData.data);
                    } else {
                        io.emit('gallery:refresh', notifyData.data);
                    }

                    currentUpload.stream = null;
                });
            }
        });

        socket.on('disconnect', () => {
            if (currentUpload.stream) {
                currentUpload.stream.destroy();
                currentUpload.stream = null;
            }
            console.log('Client disconnected:', socket.id);
        });
    });

    // Internal API to trigger socket events from Server Actions
    server.use(express.json()); // Need JSON body parser
    server.post('/api/socket-notify', (req, res) => {
        const { event, roomId, data } = req.body;

        // Security: Maybe check a simplified secret or just allow localhost?
        // For now, assuming internal network trust (localhost).

        if (roomId) {
            console.log(`[API] Emitting ${event} to room ${roomId}`);
            io.to(roomId).emit(event, data);
        } else {
            console.log(`[API] Emitting ${event} globally`);
            io.emit(event, data);
        }

        res.status(200).json({ success: true });
    });

    // Use .use() to match all routes without regex issues
    server.use((req, res) => {
        return handle(req, res);
    });

    const PORT = 3000;
    httpServer.listen(PORT, (err) => {
        if (err) throw err;
        console.log(`> Ready on http://localhost:${PORT}`);
    });
});
