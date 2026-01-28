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

        socketInstance.on('permission:update', async () => {
            console.log('Permissions updated, refreshing...');
            await queryClient.invalidateQueries({ queryKey: ['gallery'] });
            router.refresh();
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
