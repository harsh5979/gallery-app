'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Lock } from 'lucide-react';
import Link from 'next/link';

export default function AccessRestricted({ error }) {
    const router = useRouter();

    // Listen for Server-Sent Events to auto-restore access
    useEffect(() => {
        const eventSource = new EventSource('/api/stream');

        eventSource.onmessage = (event) => {
            if (event.data === 'connected') return;
            // Refresh to see if we have access now
            router.refresh();
        };

        return () => {
            eventSource.close();
        };
    }, [router]);


    return (
        <div className="min-h-screen bg-[#0a0a0a] text-white flex flex-col items-center justify-center p-4">
            <div className="bg-red-500/10 p-6 rounded-full text-red-500 mb-6 animate-pulse">
                <Lock size={64} />
            </div>
            <h1 className="text-3xl font-bold mb-2">Access Restricted</h1>
            <p className="text-muted-foreground mb-8 text-center max-w-md">
                {error === "Access Denied"
                    ? "You do not have permission to view this folder. Waiting for access..."
                    : `An error occurred: ${error}`}
            </p>
            <Link
                href="/"
                className="px-8 py-3 bg-white text-black rounded-full font-bold hover:scale-105 transition"
            >
                Return to Gallery
            </Link>
        </div>
    );
}
