// Main Server Entry Point
// Sets up Express, Next.js, and Socket.io with production configurations.

const { loadEnvConfig } = require('@next/env');
loadEnvConfig(process.cwd()); // Load .env.local on startup

const express = require('express');
const next = require('next');
const { createServer } = require('http');
const { Server } = require('socket.io');
const socketHandler = require('./src/lib/socketHandler');

const dev = process.env.NODE_ENV !== 'production';
const app = next({ dev });
const handle = app.getRequestHandler();

const PORT = process.env.PORT || 3000;

/**
 * Initialize Server Environment
 */
app.prepare().then(() => {
    const server = express();
    const httpServer = createServer(server);

    // 1. Socket.io Setup
    // maxHttpBufferSize prevents payload errors on large transfers
    const io = new Server(httpServer, {
        maxHttpBufferSize: 1e9, // 1 GB limit for large batch transfers
        transports: ['websocket'], // Force pure WebSocket to eliminate HTTP polling overhead
        cors: {
            origin: "*",
            methods: ["GET", "POST"]
        }
    });

    // Share io instance globally for access in Next.js Server Actions
    global.io = io;

    // Delegate real-time event logic to modular handler
    socketHandler(io);

    // 2. Express Middleware & Routes
    server.use(express.json());

    // Health Check (Monitoring/Load Balancers)
    server.get('/health', (req, res) => res.status(200).send('OK'));

    // Secure bridge from Server Actions to Socket Clients
    server.post('/api/socket-notify', (req, res) => {
        const { event, roomId, data } = req.body;
        try {
            if (roomId) io.to(roomId).emit(event, data);
            else io.emit(event, data);
            res.status(200).json({ success: true });
        } catch (error) {
            console.error('[Bridge] Fail:', error);
            res.status(500).json({ error: 'Communication error' });
        }
    });

    // 3. Next.js Request Handling
    server.all(/(.*)/, (req, res) => handle(req, res));

    // 4. Lifecycle Management
    httpServer.listen(PORT, (err) => {
        if (err) throw err;
        console.log(`> Service active on port ${PORT} [Mode: ${process.env.NODE_ENV || 'development'}]`);
    });

    // Graceful Shutdown routines
    const handleShutdown = (signal) => {
        console.log(`Received ${signal}, terminating service...`);
        httpServer.close(() => {
            console.log('HTTP connection pool drained.');
            process.exit(0);
        });
    };

    process.on('SIGTERM', () => handleShutdown('SIGTERM'));
    process.on('SIGINT', () => handleShutdown('SIGINT'));

}).catch((err) => {
    console.error('Critical failure during startup:', err);
    process.exit(1);
});
