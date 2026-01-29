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
            fd: null,
            path: null,
            bytesWritten: 0
        };

        socket.on('upload_start', async ({ folder, fileName, totalSize }) => {
            try {
                // Ensure directory exists
                const targetDir = path.resolve(STORAGE_ROOT, folder || '');
                console.log(`[Upload] Preparing destination: ${targetDir}`);

                // Security check: ensure we don't traverse out of storage
                const relative = path.relative(STORAGE_ROOT, targetDir);
                if (relative.startsWith('..') || path.isAbsolute(relative)) {
                    console.error(`[Upload] Path Blocked: ${targetDir} is outside ${STORAGE_ROOT}`);
                    socket.emit('upload_error', { message: 'Invalid path' });
                    return;
                }

                if (!fs.existsSync(targetDir)) {
                    console.log(`[Upload] Creating directory: ${targetDir}`);
                    fs.mkdirSync(targetDir, { recursive: true });
                }

                const filePath = path.join(targetDir, fileName);
                console.log(`[Upload] Target file: ${filePath}`);
                currentUpload.path = filePath;

                // Open file for writing (flag 'w')
                currentUpload.fd = fs.openSync(filePath, 'w');
                currentUpload.bytesWritten = 0;

                console.log(`[Upload] File opened successfully: ${filePath}`);
                socket.emit('upload_ready');
            } catch (err) {
                console.error("[Upload] Start Error:", err);
                socket.emit('upload_error', { message: `Server error: ${err.code || err.message}` });
            }
        });

        socket.on('upload_chunk', async (chunk) => {
            if (!currentUpload.fd) return;
            try {
                // Determine buffer
                const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);

                fs.writeSync(currentUpload.fd, buffer);
                currentUpload.bytesWritten += buffer.length;

                socket.emit('upload_progress', { written: currentUpload.bytesWritten });
                socket.emit('upload_ack'); // Acknowledge receipt so client sends next
            } catch (err) {
                console.error("Upload Chunk Error:", err);
                socket.emit('upload_error', { message: err.message });
            }
        });

        socket.on('upload_end', () => {
            if (currentUpload.fd) {
                fs.closeSync(currentUpload.fd);
                currentUpload.fd = null;
                console.log("Upload finished:", currentUpload.path);

                // Notify completion
                socket.emit('upload_complete', { path: currentUpload.path });

                // Trigger revalidation if possible within next? 
                // Hard to trigger 'revalidatePath' from here easily without API call.
                // We'll let the client trigger a refresh or call a server action to finalize.
            }
        });

        socket.on('disconnect', () => {
            if (currentUpload.fd) {
                fs.closeSync(currentUpload.fd);
                currentUpload.fd = null;
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
