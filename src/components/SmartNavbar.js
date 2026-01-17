'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { logout } from '@/app/actions';

export default function SmartNavbar({ session }) {
    const [isVisible, setIsVisible] = useState(true);
    const [lastScrollY, setLastScrollY] = useState(0);

    useEffect(() => {
        const handleScroll = () => {
            const currentScrollY = window.scrollY;

            // Show navbar if scrolling up or at the very top
            if (currentScrollY < lastScrollY || currentScrollY < 10) {
                setIsVisible(true);
            } else if (currentScrollY > lastScrollY && currentScrollY > 10) {
                // Hide if scrolling down and not at top
                setIsVisible(false);
            }

            setLastScrollY(currentScrollY);
        };

        window.addEventListener('scroll', handleScroll, { passive: true });
        return () => window.removeEventListener('scroll', handleScroll);
    }, [lastScrollY]);

    return (
        <nav
            className={`fixed top-0 left-0 right-0 z-50 h-16 glass flex items-center justify-between px-6 transition-transform duration-300 ${isVisible ? 'translate-y-0' : '-translate-y-full'
                }`}
        >
            <Link href="/" className="text-xl font-bold bg-clip-text text-transparent bg-linear-to-r from-blue-400 to-purple-600">
                Gallery
            </Link>
            <div className="flex items-center gap-4">
                {session ? (
                    <>
                        <span className="text-sm font-medium text-white/80">
                            {session.role === 'admin' ? 'Admin' : 'User'}
                        </span>
                        <button
                            onClick={() => logout()}
                            className="px-4 py-2 text-sm rounded-full glass-card hover:bg-white/10 transition"
                        >
                            Logout
                        </button>
                    </>
                ) : (
                    <Link href="/login" className="px-4 py-2 text-sm rounded-full glass-card hover:bg-white/10 transition">
                        Login
                    </Link>
                )}
            </div>
        </nav>
    );
}
