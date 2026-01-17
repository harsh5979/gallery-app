
'use client';

import { useState, useRef, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { createNewFolder, uploadImage } from '@/app/actions';
import { Plus, Upload, FolderPlus, Loader2, File } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import ClientPortal from './ClientPortal';

export default function AdminTools({ currentFolder }) {
    const router = useRouter();
    const [isMenuOpen, setIsMenuOpen] = useState(false);
    const containerRef = useRef(null);

    useEffect(() => {
        function handleClickOutside(event) {
            if (containerRef.current && !containerRef.current.contains(event.target)) {
                setIsMenuOpen(false);
            }
        }
        document.addEventListener("mousedown", handleClickOutside);
        return () => {
            document.removeEventListener("mousedown", handleClickOutside);
        };
    }, []);
    const [isFolderModalOpen, setIsFolderModalOpen] = useState(false);
    const [isUploadConfirmOpen, setIsUploadConfirmOpen] = useState(false);
    const [isPending, setIsPending] = useState(false);
    const [pendingFiles, setPendingFiles] = useState([]);
    const [pendingType, setPendingType] = useState('file'); // 'file' or 'folder'

    // We'll use hidden inputs ref to trigger them
    let fileInputRef = null;
    let folderInputRef = null;

    async function handleFileSelect(e, type) {
        const files = Array.from(e.target.files || []);
        if (files.length === 0) return;

        // Button Click Strategy:
        // - Folder: Browser forces prompt. Skip custom card to avoid double confirmation.
        // - File: Browser has no prompt. Show custom card.
        if (type === 'folder') {
            await processUpload(files, type);
        } else {
            setPendingFiles(files);
            setPendingType(type);
            setIsUploadConfirmOpen(true);
            setIsMenuOpen(false);
        }

        e.target.value = '';
    }

    async function processUpload(files, type) {
        setIsPending(true);
        const formData = new FormData();
        formData.append('folder', currentFolder || '');

        const paths = [];
        for (let i = 0; i < files.length; i++) {
            formData.append('files', files[i]);
            if (type === 'folder') {
                // Check for our custom property from drag-and-drop OR standard browser property
                paths.push(files[i].customPath || files[i].webkitRelativePath || files[i].name);
            } else {
                paths.push(files[i].name);
            }
        }

        // Append paths matching the files
        paths.forEach(p => formData.append('paths', p));

        try {
            const res = await uploadImage(formData);
            if (!res.success) {
                alert(res.error);
            } else {
                setIsUploadConfirmOpen(false);
                setPendingFiles([]);
                router.refresh();
            }
        } catch (err) {
            alert("Upload failed");
        } finally {
            setIsPending(false);
        }
    }

    async function confirmUpload() {
        await processUpload(pendingFiles, pendingType);
    }

    async function handleCreateFolder(formData) {
        setIsPending(true);
        const rawName = formData.get('folderName');
        const mkPath = rawName.split(',')
            .map(n => n.trim())
            .filter(Boolean)
            .map(n => currentFolder ? `${currentFolder}/${n}` : n)
            .join(',');

        formData.set('folderName', mkPath);

        const res = await createNewFolder(formData);
        setIsPending(false);
        if (res.success) {
            setIsFolderModalOpen(false);
            router.refresh();
        } else {
            alert(res.error);
        }
    }

    return (
        <div ref={containerRef} className="fixed bottom-8 right-8 z-40 flex flex-col items-end gap-4">
            {/* Menu Options */}
            <AnimatePresence>
                {isMenuOpen && (
                    <motion.div
                        initial={{ opacity: 0, y: 20, scale: 0.8 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        exit={{ opacity: 0, y: 20, scale: 0.8 }}
                        className="flex flex-col gap-2 items-end mb-2"
                    >
                        {/* New Folder */}
                        <button
                            onClick={() => { setIsFolderModalOpen(true); setIsMenuOpen(false); }}
                            className="flex items-center gap-2 px-4 py-2 bg-purple-600 text-white rounded-full shadow-lg hover:bg-purple-500 glass-card"
                        >
                            <span className="text-sm font-medium">New Folder</span>
                            <FolderPlus size={20} />
                        </button>

                        {/* Upload Files */}
                        <button
                            onClick={() => fileInputRef.click()}
                            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-full shadow-lg hover:bg-blue-500 glass-card"
                        >
                            <span className="text-sm font-medium">Upload Files</span>
                            <Upload size={20} />
                        </button>

                        {/* Upload Folder */}
                        <button
                            onClick={() => folderInputRef.click()}
                            className="flex items-center gap-2 px-4 py-2 bg-teal-600 text-white rounded-full shadow-lg hover:bg-teal-500 glass-card"
                        >
                            <span className="text-sm font-medium">Upload Folder</span>
                            <FolderPlus size={20} />
                        </button>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* Main FAB */}
            <motion.button
                whileHover={{ scale: 1.1 }}
                whileTap={{ scale: 0.9 }}
                onClick={() => setIsMenuOpen(!isMenuOpen)}
                className={`p-4 rounded-full text-white shadow-xl transition-colors ${isMenuOpen ? 'bg-red-500 rotate-45' : 'bg-white/20 backdrop-blur-md hover:bg-white/30'}`}
            >
                {isPending ? <Loader2 className="animate-spin" size={24} /> : <Plus size={24} />}
            </motion.button>

            {/* Hidden Inputs */}
            <input
                type="file"
                hidden
                multiple
                accept="image/*,video/*"
                ref={el => fileInputRef = el}
                onChange={(e) => handleFileSelect(e, 'file')}
            />
            <input
                type="file"
                hidden
                multiple
                webkitdirectory=""
                directory=""
                ref={el => folderInputRef = el}
                onChange={(e) => handleFileSelect(e, 'folder')}
            />

            {/* Folder Creation Modal */}
            <AnimatePresence>
                {isFolderModalOpen && (
                    <>
                        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50" onClick={() => setIsFolderModalOpen(false)} />
                        <motion.div
                            initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.9 }}
                            className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-80 p-6 glass-card rounded-2xl border border-white/10 z-50 bg-black/80"
                        >
                            <h3 className="font-bold text-xl mb-4 text-white">Create New Folder</h3>
                            <p className="text-xs text-gray-400 mb-4">You can create multiple folders by separating names with commas.</p>
                            <form action={async (formData) => {
                                setIsPending(true);
                                await handleCreateFolder(formData); // Re-use existing logic but adapted
                                setIsFolderModalOpen(false);
                                setIsPending(false);
                            }} className="flex flex-col gap-4">
                                <input name="folderName" placeholder="e.g. Vacation, Work" className="bg-white/10 rounded-lg px-4 py-2 text-white border border-white/10 focus:border-purple-500 outline-hidden" required autoFocus />
                                <div className="flex gap-2 justify-end">
                                    <button type="button" onClick={() => setIsFolderModalOpen(false)} className="px-4 py-2 rounded-lg text-gray-400 hover:text-white transition">Cancel</button>
                                    <button disabled={isPending} className="px-6 py-2 bg-purple-600 rounded-lg text-white font-medium hover:bg-purple-500 transition">Create</button>
                                </div>
                            </form>
                        </motion.div>
                    </>
                )}
            </AnimatePresence>

            {/* Upload Confirmation Modal */}
            <AnimatePresence>
                {isUploadConfirmOpen && (
                    <ClientPortal>
                        <motion.div
                            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                            className="fixed inset-0 bg-black/60 backdrop-blur-sm z-40"
                            onClick={() => !isPending && setIsUploadConfirmOpen(false)}
                        />
                        <motion.div
                            initial={{ opacity: 0, scale: 0.9, x: '-50%', y: '-50%' }}
                            animate={{ opacity: 1, scale: 1, x: '-50%', y: '-50%' }}
                            exit={{ opacity: 0, scale: 0.9, x: '-50%', y: '-50%' }}
                            className="fixed top-1/2 left-1/2 w-80 p-6 glass-card rounded-2xl border border-white/10 z-50 bg-[#0a0a0a] shadow-2xl"
                            onClick={(e) => { e.preventDefault(); e.stopPropagation(); }}
                        >
                            <h3 className="font-bold text-lg mb-2 text-white">Confirm Upload</h3>
                            <p className="text-sm text-gray-400 mb-6">
                                Uploading {pendingFiles.length} {pendingType === 'folder' ? 'files from folder' : 'files'} to <span className="text-white font-medium">{currentFolder || 'Home'}</span>?
                            </p>

                            {/* File Preview List - Limit to 3 */}
                            <div className="bg-white/5 rounded-lg p-3 mb-6 max-h-32 overflow-y-auto custom-scrollbar">
                                {pendingFiles.slice(0, 5).map((file, i) => (
                                    <div key={i} className="flex items-center gap-2 text-xs text-gray-300 py-1 border-b border-white/5 last:border-0">
                                        <File size={12} className="opacity-50" />
                                        <span className="truncate">{file.name}</span>
                                    </div>
                                ))}
                                {pendingFiles.length > 5 && (
                                    <div className="text-xs text-gray-500 text-center pt-2 italic">
                                        + {pendingFiles.length - 5} more...
                                    </div>
                                )}
                            </div>

                            <div className="flex gap-3 justify-end">
                                <button
                                    onClick={() => setIsUploadConfirmOpen(false)}
                                    disabled={isPending}
                                    className="px-4 py-2 rounded-lg text-gray-400 hover:text-white hover:bg-white/5 transition text-sm disabled:opacity-50"
                                >
                                    Cancel
                                </button>
                                <button
                                    onClick={confirmUpload}
                                    disabled={isPending}
                                    className="px-4 py-2 bg-blue-600/90 hover:bg-blue-600 rounded-lg text-white font-medium transition text-sm flex items-center gap-2 shadow-lg shadow-blue-900/20 disabled:opacity-70 disabled:cursor-not-allowed"
                                >
                                    {isPending ? <Loader2 size={14} className="animate-spin" /> : <Upload size={14} />}
                                    {isPending ? 'Uploading...' : 'Upload'}
                                </button>
                            </div>
                        </motion.div>
                    </ClientPortal>
                )}
            </AnimatePresence>
        </div>
    );
}

// Helper to recursively read entries
async function scanFiles(entry) {
    if (entry.isFile) {
        return new Promise((resolve) => {
            entry.file((file) => {
                // Use a SAFE custom property instead of trying to override the read-only webkitRelativePath
                file.customPath = entry.fullPath.substring(1); // Remove leading slash
                resolve([file]);
            });
        });
    } else if (entry.isDirectory) {
        const dirReader = entry.createReader();
        const entries = [];

        const readEntries = async () => {
            const results = await new Promise((resolve) => {
                dirReader.readEntries((e) => resolve(e), (err) => resolve([]));
            });

            if (results.length > 0) {
                entries.push(...results);
                await readEntries(); // Continue reading (browsers return in chunks)
            }
        };

        await readEntries();

        const filePromises = entries.map(e => scanFiles(e));
        const files = await Promise.all(filePromises);
        return files.flat();
    }
    return [];
}
