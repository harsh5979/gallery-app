'use client';

import { SocketProvider } from '@/providers/SocketProvider';
// SocketProvider is 'use client' so we can just use it.
// We receive session as prop. 
// Wait, `layout.js` is server component. It can pass session.
// But I need a wrapper to be a Client Component calling SocketProvider.
// Actually SocketProvider IS 'use client'.
// So I can just import it in layout.js? No, layout is server.
// I can import Client Components in Server Components.

// But wait, I need the session data. 
// In layout.js (Server), I can await getSession().

export default function SocketProviderWrapper({ children, session }) {
    return (
        <SocketProvider session={session}>
            {children}
        </SocketProvider>
    );
}
