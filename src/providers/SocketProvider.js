'use client';

import { createContext, useContext, useEffect, useState } from 'react';
import { io } from 'socket.io-client';
import { useRouter } from 'next/navigation';
import { useQueryClient } from '@tanstack/react-query';

const SocketContext = createContext(null);

/**
 * Hook to access the global socket instance
 */
export const useSocket = () => useContext(SocketContext);

/**
 * SocketProvider - Root wrapper for real-time capabilities
 * Manages socket lifecycle, room joining, and project-wide event listeners.
 */
export function SocketProvider({ children, session }) {
    const [socket, setSocket] = useState(null);
    const router = useRouter();
    const queryClient = useQueryClient();

    useEffect(() => {
        // Initialize socket connection to the current host
        // Force pure WebSocket transport to eliminate HTTP polling overhead
        const socketInstance = io({
            transports: ['websocket']
        });

        // 1. Connection Event
        socketInstance.on('connect', () => {
            console.log('[Socket] Connected as:', socketInstance.id);
            // Move state update to async listener to avoid React cascading render warnings
            setSocket(socketInstance);

            if (session?.id) {
                console.log('[Socket] Authing session:', session.id);
                socketInstance.emit('join_user_room', session.id);
            }
        });

        // 2. Error Handling
        socketInstance.on('connect_error', (err) => {
            console.error('[Socket] Connection failed:', err.message);
        });

        // 3. Permission Revocation Listener
        socketInstance.on('revoke:access', async (data) => {
            console.warn('[Socket] Security Alert: Access Revoked', data);

            // Wipe all gallery cache to ensure no unauthorized data persists in UI
            await queryClient.invalidateQueries({ queryKey: ['gallery'] });

            // Force re-evaluation of Server Components (RSC)
            router.refresh();
        });

        // 4. Targeted Permission Updates
        socketInstance.on('permission:update', async (data) => {
            console.log('[Socket] Permissions updated:', data);

            // If a specific folder path is involved, target that query key specifically
            if (data?.folderPath) {
                const normalized = String(data.folderPath).replace(/\\/g, '/').replace(/^\/+|\/+$/g, '');

                // Invalidate the folder itself and its contents
                await queryClient.invalidateQueries({
                    queryKey: ['gallery', normalized || 'root']
                });

                // Invalidate the parent to update status icons (Global vs Lock icons)
                const parent = normalized.includes('/')
                    ? normalized.substring(0, normalized.lastIndexOf('/'))
                    : 'root';
                await queryClient.invalidateQueries({ queryKey: ['gallery', parent] });
            } else {
                // Broad update (batch change)
                await queryClient.invalidateQueries({ queryKey: ['gallery'] });
            }

            // Refresh RSC if it's a bulk operation or affects layout-level auth
            if (data?.isBulk || !data?.folderPath) {
                router.refresh();
            }
        });

        // 5. Broad Refresh Trigger
        socketInstance.on('gallery:refresh', (data) => {
            console.log('[Socket] Broad gallery refresh triggered:', data);
            // Targeted invalidation can happen here, but usually mutations handle it.
        });

        // Cleanup on unmount or session change
        return () => {
            socketInstance.disconnect();
            setSocket(null);
        };
    }, [session?.id, router, queryClient]);

    return (
        <SocketContext.Provider value={socket}>
            {children}
        </SocketContext.Provider>
    );
}
