import { EventEmitter } from 'events';

// Use a global singleton to persist across reloads in dev (mostly for API routes)
// Note: In serverless, this might not work perfectly across lambdas, but for 'yarn dev' it works.
// For production serverless, we'd need Redis/Pusher.
if (!global.changeEmitter) {
    global.changeEmitter = new EventEmitter();
    global.changeEmitter.setMaxListeners(100); // Allow many clients
}

const changeEmitter = global.changeEmitter;

export function notifyChange(type = 'update') {
    changeEmitter.emit('change', { type, timestamp: Date.now() });
}

export function subscribeToChanges(callback) {
    changeEmitter.on('change', callback);
    return () => changeEmitter.off('change', callback);
}
