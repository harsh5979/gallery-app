'use client';

import { useState } from 'react';
import { MoreVertical, Trash2, Loader2, Expand, Download } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
// import { deleteItem } from '@/app/actions'; // Removed
import { useGalleryMutations } from '@/hooks/useGalleryMutations';
import ClientPortal from '../ui/ClientPortal';
import GlassButton from '../ui/GlassButton';

export default function ItemActionsMenu({
    path,
    isFolder = false,
    onDelete,
    onView,
    downloadUrl,
    filename
}) {
    const [isOpen, setIsOpen] = useState(false);
    const [isConfirmOpen, setIsConfirmOpen] = useState(false);
    // const [isDeleting, setIsDeleting] = useState(false); // Replaced by mutation status

    // We need currentFolder to initialize the hook correctly. 
    // Usually 'path' is "folder/item", so currentFolder is parent.
    // But simplest way is to accept currentFolder as prop or extract it.
    // For now, let's assume the parent can pass `deleteMutation` OR we infer context?
    // Actually, `useGalleryMutations` needs `currentFolder` to update the right cache.
    // `ItemActionsMenu` receives `path` (full path). 
    // We can parse `currentFolder` from `path`. 
    const currentFolder = path.includes('/') ? path.substring(0, path.lastIndexOf('/')) : '';

    // HOWEVER: If we are in root, path is just "image.jpg". currentFolder is empty.
    // If we are in "A", path is "A/image.jpg". currentFolder is "A".
    // This works.

    const { deleteItem: deleteMut } = useGalleryMutations(currentFolder);

    function handleDelete() {
        deleteMut.mutate(path, {
            onSuccess: () => {
                setIsOpen(false);
                setIsConfirmOpen(false);
                if (onDelete) onDelete(); // Call parent callback if needed (e.g. to close lightbox)
            }
        });
    }

    const isDeleting = deleteMut.isPending;

    return (
        <>
            <div className="absolute top-2 right-2 z-40" onClick={(e) => e.stopPropagation()}>
                <GlassButton
                    onClick={(e) => { e.preventDefault(); e.stopPropagation(); setIsOpen(!isOpen); }}
                    className="p-1.5 md:p-2"
                    title="Options"
                    aria-label="Options"
                >
                    <MoreVertical size={16} className="md:w-5 md:h-5 w-4 h-4" />
                </GlassButton>

                {isOpen && (
                    <>
                        <div className="fixed inset-0 z-20" onClick={(e) => { e.preventDefault(); e.stopPropagation(); setIsOpen(false); }} />
                        <div className="absolute right-0 mt-1 w-40 bg-[#1e1e1e]/95 border border-white/10 rounded-lg shadow-xl overflow-hidden z-30 backdrop-blur-md">
                            <div className="flex flex-col py-1">
                                {onView && (
                                    <button
                                        onClick={(e) => {
                                            e.preventDefault();
                                            e.stopPropagation();
                                            setIsOpen(false);
                                            onView();
                                        }}
                                        className="w-full text-left px-4 py-2.5 text-sm text-gray-200 hover:bg-white/10 flex items-center gap-2 transition-colors"
                                    >
                                        <Expand size={14} className="text-gray-400" />
                                        View
                                    </button>
                                )}

                                {downloadUrl && (
                                    <a
                                        href={downloadUrl}
                                        download={filename || true}
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            setIsOpen(false);
                                        }}
                                        className="w-full text-left px-4 py-2.5 text-sm text-gray-200 hover:bg-white/10 flex items-center gap-2 transition-colors"
                                    >
                                        <Download size={14} className="text-gray-400" />
                                        Download
                                    </a>
                                )}

                                {onDelete && (
                                    <>
                                        <div className="h-px bg-white/10 my-1" />
                                        <button
                                            onClick={(e) => {
                                                e.preventDefault();
                                                e.stopPropagation();
                                                setIsConfirmOpen(true);
                                                setIsOpen(false);
                                            }}
                                            className="w-full text-left px-4 py-2.5 text-sm text-red-400 hover:bg-red-500/10 flex items-center gap-2 transition-colors"
                                        >
                                            <Trash2 size={14} />
                                            Delete
                                        </button>
                                    </>
                                )}
                            </div>
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
                            className="fixed top-1/2 left-1/2 w-80 p-6 glass-card rounded-2xl border border-glass-border z-50 bg-[#1e1e1e] shadow-2xl"
                            onClick={(e) => { e.preventDefault(); e.stopPropagation(); }}
                        >
                            <h3 className="font-bold text-lg mb-2 text-foreground">Delete {isFolder ? 'Folder' : 'Item'}?</h3>
                            <p className="text-sm text-muted-foreground mb-6">
                                Are you sure you want to delete <span className="text-foreground font-medium">{path.split('/').pop()}</span>?
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
