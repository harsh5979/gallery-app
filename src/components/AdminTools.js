
'use client';

import { useState } from 'react';
import { createNewFolder, uploadImage } from '@/app/actions';
import { Plus, Upload, FolderPlus, Loader2 } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

export default function AdminTools({ currentFolder }) {
    const [isUploadOpen, setIsUploadOpen] = useState(false);
    const [isFolderOpen, setIsFolderOpen] = useState(false);
    const [isPending, setIsPending] = useState(false);

    async function handleUpload(formData) {
        setIsPending(true);
        const res = await uploadImage(formData);
        setIsPending(false);
        if (res.success) {
            setIsUploadOpen(false);
            // Ideally trigger refresh in parent or use router.refresh() 
            // In Server Actions with revalidatePath, the parent SC refreshes, but client state might need reset.
        } else {
            alert(res.error);
        }
    }

    async function handleCreateFolder(formData) {
        setIsPending(true);
        const rawName = formData.get('folderName');
        const mkPath = currentFolder ? `${currentFolder}/${rawName}` : rawName;
        formData.set('folderName', mkPath);

        const res = await createNewFolder(formData);
        setIsPending(false);
        if (res.success) {
            setIsFolderOpen(false);
        } else {
            alert(res.error);
        }
    }

    return (
        <div className="fixed bottom-8 right-8 flex flex-col gap-4 z-40">
            {/* FABs */}
            <motion.button
                whileHover={{ scale: 1.1 }}
                whileTap={{ scale: 0.9 }}
                onClick={() => setIsFolderOpen(!isFolderOpen)}
                className="p-4 rounded-full bg-purple-600 text-white shadow-lg glass-card hover:bg-purple-500 transition"
                title="New Folder"
            >
                <FolderPlus size={24} />
            </motion.button>

            {currentFolder && (
                <motion.button
                    whileHover={{ scale: 1.1 }}
                    whileTap={{ scale: 0.9 }}
                    onClick={() => setIsUploadOpen(!isUploadOpen)}
                    className="p-4 rounded-full bg-blue-600 text-white shadow-lg glass-card hover:bg-blue-500 transition"
                    title="Upload Image"
                >
                    <Upload size={24} />
                </motion.button>
            )}

            {/* Modals - Simplified as conditional renders for speed */}
            <AnimatePresence>
                {isFolderOpen && (
                    <motion.div
                        initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 20 }}
                        className="absolute bottom-20 right-0 w-72 p-4 glass rounded-xl border border-white/10"
                    >
                        <h3 className="font-bold mb-2">Create Folder</h3>
                        <form action={handleCreateFolder} className="flex gap-2">
                            <input name="folderName" placeholder="Name" className="flex-1 bg-black/40 rounded px-2 py-1 text-sm border border-white/10" required />
                            <button disabled={isPending} className="bg-purple-600 px-3 rounded text-sm disabled:opacity-50">
                                {isPending ? <Loader2 className="animate-spin" size={16} /> : <Plus size={16} />}
                            </button>
                        </form>
                    </motion.div>
                )}
            </AnimatePresence>

            <AnimatePresence>
                {isUploadOpen && (
                    <motion.div
                        initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 20 }}
                        className="absolute bottom-20 right-0 w-72 p-4 glass rounded-xl border border-white/10"
                    >
                        <h3 className="font-bold mb-2">Upload to {currentFolder}</h3>
                        <form action={handleUpload} className="flex flex-col gap-2">
                            <input type="hidden" name="folder" value={currentFolder} />
                            <input type="file" name="file" accept="image/*" className="text-sm text-gray-400 file:mr-2 file:py-1 file:px-2 file:rounded-full file:border-0 file:text-xs file:bg-blue-500/20 file:text-blue-400 hover:file:bg-blue-500/30" required />
                            <button disabled={isPending} className="bg-blue-600 py-1 rounded text-sm disabled:opacity-50 flex justify-center">
                                {isPending ? <Loader2 className="animate-spin" size={16} /> : 'Upload'}
                            </button>
                        </form>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
}
