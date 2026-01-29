'use client';

import { createContext, useContext, useEffect, useState } from 'react';
import { io } from 'socket.io-client';
import { useRouter } from 'next/navigation';
import { useQueryClient } from '@tanstack/react-query';

const SocketContext = createContext(null);

export const useSocket = () => {
    return useContext(SocketContext);
};

export function SocketProvider({ children, session }) {
    const [socket, setSocket] = useState(null);
    const router = useRouter();
    const queryClient = useQueryClient();

    useEffect(() => {
        // Connect to same host
        const socketInstance = io();

        socketInstance.on('connect', () => {
            console.log('Socket Connected:', socketInstance.id);
            if (session?.id) {
                console.log('Joining User Room:', session.id);
                socketInstance.emit('join_user_room', session.id);
            }
        });

        socketInstance.on('revoke:access', async (data) => {
            console.warn('Access Revoked:', data);

            // 1. Refetch client-side data (images/folders)
            await queryClient.invalidateQueries({ queryKey: ['gallery'] });

            // 2. Refresh Server Components (will show Access Denied if on restricted page)
            router.refresh();
        });

        socketInstance.on('permission:update', async (data) => {
            console.log('Permissions updated:', data);

            // 1. Target the specific folder if path is provided, otherwise refresh all gallery data
            if (data?.folderPath) {
                // Precise invalidation for the folder and its contents
                await queryClient.invalidateQueries({
                    queryKey: ['gallery', data.folderPath]
                });
                // Also invalidate the root/parent to show the status icon change
                const parent = data.folderPath.includes('/')
                    ? data.folderPath.substring(0, data.folderPath.lastIndexOf('/'))
                    : 'root';
                await queryClient.invalidateQueries({ queryKey: ['gallery', parent] });
            } else {
                await queryClient.invalidateQueries({ queryKey: ['gallery'] });
            }

            // 2. Refresh RSC only for layout/auth changes (router.refresh is usually slower/more disruptive)
            // If it's just a permission toggle on a folder, TanStack Query is enough.
            // Only refresh if it was a bulk update or specifically requested
            if (data?.isBulk || !data?.folderPath) {
                router.refresh();
            }
        });

        setSocket(socketInstance);

        return () => {
            socketInstance.disconnect();
        };
    }, [session?.id, router, queryClient]);

    return (
        <SocketContext.Provider value={socket}>
            {children}
        </SocketContext.Provider>
    );
}
