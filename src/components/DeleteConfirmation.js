'use client';

import { useState } from 'react';
import { MoreVertical, Trash2, Loader2 } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { deleteItem } from '@/app/actions';
import ClientPortal from './ClientPortal';

export default function DeleteConfirmation({ path, isFolder = false, onDelete }) {
    const [isOpen, setIsOpen] = useState(false);
    const [isConfirmOpen, setIsConfirmOpen] = useState(false);
    const [isDeleting, setIsDeleting] = useState(false);

    async function handleDelete() {
        setIsDeleting(true);
        const res = await deleteItem(path);
        setIsDeleting(false);
        if (res.error) {
            alert(res.error);
        } else {
            setIsOpen(false);
            setIsConfirmOpen(false);
            if (onDelete) onDelete();
        }
    }

    return (
        <>
            <div className="absolute top-2 right-2 z-30">
                <button
                    onClick={(e) => { e.preventDefault(); e.stopPropagation(); setIsOpen(!isOpen); }}
                    className="p-1 rounded-full bg-black/50 text-white hover:bg-black/70 transition"
                    title="Options"
                >
                    <MoreVertical size={16} />
                </button>

                {isOpen && (
                    <>
                        <div className="fixed inset-0 z-20" onClick={(e) => { e.preventDefault(); e.stopPropagation(); setIsOpen(false); }} />
                        <div className="absolute right-0 mt-1 w-32 bg-black/90 border border-white/10 rounded-lg shadow-xl overflow-hidden z-30 backdrop-blur-md">
                            <button
                                onClick={(e) => { e.preventDefault(); e.stopPropagation(); setIsConfirmOpen(true); setIsOpen(false); }}
                                className="w-full text-left px-4 py-2 text-sm text-red-400 hover:bg-white/10 flex items-center gap-2 transition-colors"
                            >
                                <Trash2 size={14} />
                                Delete
                            </button>
                        </div>
                    </>
                )}
            </div>

            <AnimatePresence>
                {isConfirmOpen && (
                    <ClientPortal>
                        <motion.div
                            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                            className="fixed inset-0 bg-black/60 backdrop-blur-sm z-40"
                            onClick={(e) => { e.preventDefault(); e.stopPropagation(); setIsConfirmOpen(false); }}
                        />
                        <motion.div
                            initial={{ opacity: 0, scale: 0.9, x: '-50%', y: '-50%' }}
                            animate={{ opacity: 1, scale: 1, x: '-50%', y: '-50%' }}
                            exit={{ opacity: 0, scale: 0.9, x: '-50%', y: '-50%' }}
                            className="fixed top-1/2 left-1/2 w-80 p-6 glass-card rounded-2xl border border-white/10 z-50 bg-[#0a0a0a] shadow-2xl"
                            onClick={(e) => { e.preventDefault(); e.stopPropagation(); }}
                        >
                            <h3 className="font-bold text-lg mb-2 text-white">Delete {isFolder ? 'Folder' : 'Item'}?</h3>
                            <p className="text-sm text-gray-400 mb-6">
                                Are you sure you want to delete <span className="text-white font-medium">{path.split('/').pop()}</span>?
                                {isFolder && " This will delete all contents inside."}
                                <br />This action cannot be undone.
                            </p>
                            <div className="flex gap-3 justify-end">
                                <button
                                    onClick={(e) => { e.preventDefault(); e.stopPropagation(); setIsConfirmOpen(false); }}
                                    className="px-4 py-2 rounded-lg text-gray-400 hover:text-white hover:bg-white/5 transition text-sm"
                                >
                                    Cancel
                                </button>
                                <button
                                    onClick={(e) => { e.preventDefault(); e.stopPropagation(); handleDelete(); }}
                                    disabled={isDeleting}
                                    className="px-4 py-2 bg-red-600/90 hover:bg-red-600 rounded-lg text-white font-medium transition text-sm flex items-center gap-2 shadow-lg shadow-red-900/20"
                                >
                                    {isDeleting && <Loader2 size={14} className="animate-spin" />}
                                    Delete
                                </button>
                            </div>
                        </motion.div>
                    </ClientPortal>
                )}
            </AnimatePresence>
        </>
    );
}
