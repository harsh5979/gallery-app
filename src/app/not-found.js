'use client';

import Link from 'next/link';
import { FileQuestion, Home } from 'lucide-react';
import { motion } from 'framer-motion';

export default function NotFound() {
    return (
        <div className="flex flex-col items-center justify-center min-h-screen bg-[#0a0a0a] text-white p-4">
            <motion.div
                initial={{ scale: 0.8, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                transition={{ duration: 0.5 }}
                className="flex flex-col items-center text-center space-y-6 max-w-md"
            >
                <div className="relative">
                    <div className="absolute inset-0 bg-purple-500/20 blur-3xl rounded-full" />
                    <div className="relative bg-white/5 p-8 rounded-3xl border border-white/10 backdrop-blur-sm">
                        <FileQuestion size={64} className="text-purple-400" />
                    </div>
                </div>

                <div className="space-y-2">
                    <h1 className="text-4xl font-bold bg-gradient-to-r from-white to-white/60 bg-clip-text text-transparent">
                        Page Not Found
                    </h1>
                    <p className="text-muted-foreground">
                        The page you are looking for does not exist or you do not have permission to view it.
                    </p>
                </div>

                <Link
                    href="/"
                    className="flex items-center gap-2 px-8 py-3 bg-white text-black rounded-full font-bold hover:scale-105 active:scale-95 transition-all duration-200 shadow-[0_0_20px_rgba(255,255,255,0.3)] hover:shadow-[0_0_30px_rgba(255,255,255,0.5)]"
                >
                    <Home size={18} />
                    Back to Home
                </Link>
            </motion.div>
        </div>
    );
}
