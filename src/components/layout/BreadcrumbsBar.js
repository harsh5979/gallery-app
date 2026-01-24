'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';

export default function BreadcrumbsBar({ currentFolder }) {
    const [isVisible, setIsVisible] = useState(true);

    useEffect(() => {
        let timeoutId;

        const handleScroll = () => {
            setIsVisible(true);
            clearTimeout(timeoutId);
            timeoutId = setTimeout(() => {
                if (window.scrollY > 100) { // Only auto-hide if scrolled down
                    setIsVisible(false);
                }
            }, 4000);
        };

        window.addEventListener('scroll', handleScroll, { passive: true });
        return () => {
            window.removeEventListener('scroll', handleScroll);
            clearTimeout(timeoutId);
        };
    }, []);

    // Breadcrumb Logic
    const breadcrumbs = currentFolder ? currentFolder.split('/') : [];

    return (
        <div
            className={`sticky top-0 z-40 bg-background/90 backdrop-blur-md py-4 px-4 -mx-4 mb-4 shadow-sm flex items-center gap-2 flex-wrap transition-transform duration-500 ${isVisible ? 'translate-y-0' : '-translate-y-full'}`}
        >
            {currentFolder && (
                <Link
                    href={currentFolder.includes('/') ? `/?io=${currentFolder.substring(0, currentFolder.lastIndexOf('/'))}` : '/'}
                    className="p-2 rounded-full glass-card hover:bg-foreground/10 transition"
                >
                    <ArrowLeft size={18} />
                </Link>
            )}
            <div className="flex items-center gap-2 text-lg md:text-2xl font-bold truncate max-w-full">
                <Link href="/" className="hover:text-purple-400 transition bg-clip-text text-transparent bg-linear-to-r from-blue-400 to-purple-400 shrink-0">Home</Link>
                {breadcrumbs.map((crumb, i) => {
                    const pathUntilHere = breadcrumbs.slice(0, i + 1).join('/');
                    const href = `/?io=${pathUntilHere}`;
                    const isLast = i === breadcrumbs.length - 1;
                    return (
                        <span key={href} className="flex items-center gap-2 overflow-hidden">
                            <span className="text-muted-foreground shrink-0">/</span>
                            {isLast ? (
                                <span className="text-foreground truncate">{crumb}</span>
                            ) : (
                                <Link href={href} className="text-muted-foreground hover:text-foreground transition truncate">{crumb}</Link>
                            )}
                        </span>
                    );
                })}
            </div>
        </div>
    );
}
