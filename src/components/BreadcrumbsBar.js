'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';

export default function BreadcrumbsBar({ currentFolder }) {
    const [isHeaderVisible, setIsHeaderVisible] = useState(true);
    const [lastScrollY, setLastScrollY] = useState(0);

    // Breadcrumb Logic
    const breadcrumbs = currentFolder ? currentFolder.split('/') : [];

    useEffect(() => {
        const handleScroll = () => {
            const currentScrollY = window.scrollY;
            if (currentScrollY < lastScrollY || currentScrollY < 10) {
                setIsHeaderVisible(true);
            } else if (currentScrollY > lastScrollY && currentScrollY > 10) {
                setIsHeaderVisible(false);
            }
            setLastScrollY(currentScrollY);
        };
        window.addEventListener('scroll', handleScroll, { passive: true });
        return () => window.removeEventListener('scroll', handleScroll);
    }, [lastScrollY]);

    return (
        <div
            className={`sticky top-16 z-40 bg-black/80 backdrop-blur-md py-4 px-4 -mx-4 mb-4 border-b border-white/10 shadow-lg flex items-center gap-2 flex-wrap transition-transform duration-300 ${isHeaderVisible ? 'translate-y-0' : '-translate-y-[200%]'
                }`}
        >
            {currentFolder && (
                <Link
                    href={currentFolder.includes('/') ? `/?folder=${currentFolder.substring(0, currentFolder.lastIndexOf('/'))}` : '/'}
                    className="p-2 rounded-full glass-card hover:bg-white/10 transition"
                >
                    <ArrowLeft size={18} />
                </Link>
            )}
            <div className="flex items-center gap-2 text-lg md:text-2xl font-bold truncate max-w-full">
                <Link href="/" className="hover:text-purple-400 transition bg-clip-text text-transparent bg-linear-to-r from-blue-400 to-purple-400 shrink-0">Home</Link>
                {breadcrumbs.map((crumb, i) => {
                    const pathUntilHere = breadcrumbs.slice(0, i + 1).join('/');
                    const href = `/?folder=${pathUntilHere}`;
                    const isLast = i === breadcrumbs.length - 1;
                    return (
                        <span key={href} className="flex items-center gap-2 overflow-hidden">
                            <span className="text-gray-600 shrink-0">/</span>
                            {isLast ? (
                                <span className="text-white truncate">{crumb}</span>
                            ) : (
                                <Link href={href} className="text-gray-400 hover:text-white transition truncate">{crumb}</Link>
                            )}
                        </span>
                    );
                })}
            </div>
        </div>
    );
}
