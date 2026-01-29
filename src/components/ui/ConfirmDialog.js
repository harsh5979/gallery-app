'use client';

import { motion, AnimatePresence } from 'framer-motion';
import { Loader2, AlertCircle } from 'lucide-react';
import { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';

export default function ConfirmDialog({
    isOpen,
    onClose,
    onConfirm,
    title = "Are you sure?",
    message = "This action cannot be undone.",
    confirmText = "Confirm",
    cancelText = "Cancel",
    loading = false,
    type = "danger" // 'danger' or 'primary'
}) {
    const [mounted, setMounted] = useState(false);
    useEffect(() => setMounted(true), []);

    if (!mounted) return null;

    return createPortal(
        <AnimatePresence>
            {isOpen && (
                <>
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50"
                        onClick={onClose}
                    />
                    <motion.div
                        initial={{ opacity: 0, scale: 0.95, x: '-50%', y: '-40%' }}
                        animate={{ opacity: 1, scale: 1, x: '-50%', y: '-50%' }}
                        exit={{ opacity: 0, scale: 0.95, x: '-50%', y: '-40%' }}
                        className="fixed top-1/2 left-1/2 w-[90%] max-w-sm glass-card p-6 rounded-3xl border border-white/10 z-50 shadow-2xl overflow-hidden"
                    >
                        <div className="flex items-start gap-4 mb-4">
                            <div className={`p-3 rounded-2xl ${type === 'danger' ? 'bg-red-500/10 text-red-500' : 'bg-purple-500/10 text-purple-500'}`}>
                                <AlertCircle size={24} />
                            </div>
                            <div className="min-w-0">
                                <h3 className="text-lg font-bold text-white mb-1">{title}</h3>
                                <p className="text-sm text-muted-foreground leading-relaxed">{message}</p>
                            </div>
                        </div>

                        <div className="flex gap-3 mt-8">
                            <button
                                onClick={onClose}
                                disabled={loading}
                                className="flex-1 py-3 px-4 rounded-2xl text-xs font-bold uppercase tracking-widest text-muted-foreground hover:text-white hover:bg-white/5 border border-white/5 transition-all outline-none"
                            >
                                {cancelText}
                            </button>
                            <button
                                onClick={(e) => { e.stopPropagation(); onConfirm(); }}
                                disabled={loading}
                                className={`flex-1 py-3 px-4 rounded-2xl text-xs font-bold uppercase tracking-widest text-white transition-all flex items-center justify-center gap-2 shadow-lg outline-none ${type === 'danger'
                                        ? 'bg-red-600 hover:bg-red-500 shadow-red-900/20'
                                        : 'bg-purple-600 hover:bg-purple-500 shadow-purple-900/20'
                                    }`}
                            >
                                {loading && <Loader2 size={14} className="animate-spin" />}
                                {confirmText}
                            </button>
                        </div>
                    </motion.div>
                </>
            )}
        </AnimatePresence>,
        document.body
    );
}
