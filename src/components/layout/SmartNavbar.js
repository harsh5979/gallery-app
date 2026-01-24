'use client';

import Link from 'next/link';
import { logout } from '@/app/actions';
import Image from 'next/image';

export default function SmartNavbar({ session }) {
    return (
        <nav
            className="w-full h-16 glass flex items-center justify-between px-6 mb-4"
        >
            <Link href="/" className="flex items-center gap-2 group">
                <Image src="/white_logo.svg" alt="Logo" width={32} height={32} className="w-8 h-8 group-hover:scale-110 transition-transform duration-300" />
                <span className="text-xl font-bold bg-clip-text text-transparent bg-linear-to-r from-blue-400 to-purple-600">
                    Gallery
                </span>
                <span className="text-yellow-500">✨</span>
            </Link>
            <div className="flex items-center gap-4">
                {session ? (
                    <>
                        <span className="text-sm font-medium text-foreground/80">
                            {session.role === 'admin' ? 'Admin' : 'User'}
                        </span>
                        <button
                            onClick={() => logout()}
                            className="px-4 py-2 text-sm rounded-full glass-card hover:bg-foreground/10 transition"
                        >
                            Logout
                        </button>
                    </>
                ) : (
                    <Link href="/login" className="px-4 py-2 text-sm rounded-full glass-card hover:bg-foreground/10 transition">
                        Login
                    </Link>
                )}
            </div>
        </nav>
    );
}
