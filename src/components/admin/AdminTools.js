'use client';

import { useState, useRef, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { revalidateGallery, syncFolders } from '@/app/adminActions';
import { useGalleryMutations } from '@/hooks/useGalleryMutations';
import { useSocket } from '@/providers/SocketProvider';
import { FolderPlus, Upload, Loader2, Plus, Check, LayoutDashboard } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import ClientPortal from '@/components/ui/ClientPortal';

/**
 * Utility: Converts bytes to human-readable strings.
 */
function formatSize(bytes) {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

/**
 * AdminTools Component
 * Provides UI for folder creation and batch file/folder uploads using Socket.io.
 */
export default function AdminTools({ currentFolder }) {
    const router = useRouter();
    const [isMenuOpen, setIsMenuOpen] = useState(false);
    const containerRef = useRef(null);
    const { createFolder, handleUpload } = useGalleryMutations(currentFolder);
    const socket = useSocket();

    // UI & Modal States
    const [isFolderModalOpen, setIsFolderModalOpen] = useState(false);
    const [isUploadConfirmOpen, setIsUploadConfirmOpen] = useState(false);
    const [isUploading, setIsUploading] = useState(false);
    const [pendingFiles, setPendingFiles] = useState([]);
    const [pendingType, setPendingType] = useState('file'); // 'file' | 'folder'
    const [selectedIndices, setSelectedIndices] = useState(new Set());
    const [visibleLimit, setVisibleLimit] = useState(10);
    const [uploadProgress, setUploadProgress] = useState({
        total: 0, current: 0, success: 0, failed: 0, currentFile: ''
    });

    // Handle clicks outside menu to close it
    useEffect(() => {
        function handleClickOutside(event) {
            if (containerRef.current && !containerRef.current.contains(event.target)) {
                setIsMenuOpen(false);
            }
        }
        document.addEventListener("mousedown", handleClickOutside);
        return () => document.removeEventListener("mousedown", handleClickOutside);
    }, []);

    // Auto-reset upload state after successful completion
    useEffect(() => {
        if (!isUploading && uploadProgress.total > 0 && uploadProgress.current === uploadProgress.total && uploadProgress.failed === 0) {
            const timer = setTimeout(() => {
                setUploadProgress({ total: 0, current: 0, success: 0, failed: 0, currentFile: '' });
                setPendingFiles([]);
            }, 3000);
            return () => clearTimeout(timer);
        }
    }, [isUploading, uploadProgress]);

    /**
     * Triggered when files/folders are selected from local disk.
     */
    async function handleFileSelect(e, type) {
        const files = Array.from(e.target.files || []);
        if (files.length === 0) return;

        setUploadProgress({ total: 0, current: 0, success: 0, failed: 0, currentFile: '' });
        const filesToUpload = files;
        setPendingFiles(filesToUpload);
        setSelectedIndices(new Set(filesToUpload.map((_, i) => i)));

        // Start upload immediately (Windows picker is the only confirmation)
        setIsUploading(true);
        executeUploads(filesToUpload, type);

        e.target.value = ''; // Reset input for re-selection
    }

    /**
     * Core Upload Loop: Processes files sequentially over a single socket channel.
     */
    async function executeUploads(filesToUpload, type) {
        if (!filesToUpload || filesToUpload.length === 0) {
            setIsUploading(false);
            return;
        }

        setUploadProgress(prev => ({ ...prev, total: filesToUpload.length, current: 0 }));

        for (const file of filesToUpload) {
            await processFileSocket(file, type);
        }

        // Post-upload synchronization
        await revalidateGallery(currentFolder);

        setIsUploading(false);
        router.refresh();
    }

    /**
     * Handles single file streaming via chunked Socket.io events.
     */
    const processFileSocket = (file, type) => {
        return new Promise((resolve) => {
            if (!socket) return resolve();

            // 1. Path Normalization
            let relativePath = file.name;
            if (type === 'folder') {
                relativePath = file.customPath || file.webkitRelativePath || file.name;
            }

            const normalizedPath = relativePath.replace(/\\/g, '/');
            const parts = normalizedPath.split('/');
            const actualFileName = parts.pop();
            const subDir = parts.join('/');

            // Calculate nested target folder
            let targetFolder = currentFolder || '';
            if (subDir) {
                targetFolder = targetFolder ? `${targetFolder}/${subDir}` : subDir;
            }

            // 2. State & Chunk Config
            const CHUNK_SIZE = 1024 * 1024; // 1MB chunks
            const totalChunks = Math.ceil(file.size / CHUNK_SIZE);
            let ackHandler;

            // 3. Socket Event Handlers
            const onReady = async () => {
                const maxInFlight = 8; // Concurrency control within a single file
                let inFlight = 0;
                let chunksSent = 0;

                const uploadNextChunk = async () => {
                    if (chunksSent >= totalChunks) {
                        if (inFlight === 0) socket.emit('upload_end');
                        return;
                    }

                    const start = chunksSent++ * CHUNK_SIZE;
                    const chunk = file.slice(start, Math.min(start + CHUNK_SIZE, file.size));
                    const arrayBuffer = await chunk.arrayBuffer();

                    inFlight++;
                    socket.emit('upload_chunk', arrayBuffer);
                    if (inFlight < maxInFlight) uploadNextChunk();
                };

                ackHandler = () => {
                    inFlight--;
                    const sentSize = Math.min(chunksSent * CHUNK_SIZE, file.size);
                    setUploadProgress(prev => ({
                        ...prev,
                        currentFile: `${file.name} (${formatSize(sentSize)} / ${formatSize(file.size)})`
                    }));
                    if (chunksSent < totalChunks) uploadNextChunk();
                    else if (inFlight === 0) socket.emit('upload_end');
                };

                socket.on('upload_ack', ackHandler);
                uploadNextChunk();
            };

            const onComplete = () => {
                cleanup();
                setUploadProgress(prev => ({ ...prev, current: prev.current + 1, success: prev.success + 1 }));
                resolve();
            };

            const onError = (err) => {
                cleanup();
                console.error("[Upload] Error:", err);
                setUploadProgress(prev => ({ ...prev, current: prev.current + 1, failed: prev.failed + 1 }));
                resolve();
            };

            const cleanup = () => {
                socket.off('upload_ready', onReady);
                socket.off('upload_complete', onComplete);
                socket.off('upload_error', onError);
                if (ackHandler) socket.off('upload_ack', ackHandler);
            };

            // Register global listeners and initiate
            socket.on('upload_ready', onReady);
            socket.on('upload_complete', onComplete);
            socket.on('upload_error', onError);

            socket.emit('upload_start', {
                folder: targetFolder,
                fileName: actualFileName,
                totalSize: file.size
            });
        });
    };

    /**
     * Folder Creation Handler
     */
    async function handleCreateFolder(formData) {
        setIsUploading(true);
        const rawName = formData.get('folderName');
        const mkPath = rawName.split(',').map(n => n.trim()).filter(Boolean)
            .map(n => currentFolder ? `${currentFolder}/${n}` : n).join(',');

        formData.set('folderName', mkPath);
        try {
            await createFolder.mutateAsync(formData);
            setIsFolderModalOpen(false);
        } catch (e) {
            alert(e.message);
        }
        setIsUploading(false);
    }

    return (
        <div ref={containerRef} className="fixed bottom-8 right-8 z-40 flex flex-col items-end gap-4">
            <AnimatePresence>
                {isMenuOpen && !isUploading && (
                    <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 20 }} className="flex flex-col gap-2 items-end mb-2">
                        <button onClick={() => { setIsFolderModalOpen(true); setIsMenuOpen(false); }} className="flex items-center gap-2 px-4 py-2 bg-purple-600 text-white rounded-full glass-card hover:bg-purple-500 transition">
                            <span className="text-sm font-medium">New Folder</span>
                            <FolderPlus size={20} />
                        </button>
                        <button onClick={() => router.push('/admin')} className="flex items-center gap-2 px-4 py-2 bg-gray-800 text-white rounded-full glass-card hover:bg-gray-700 transition">
                            <span className="text-sm font-medium">Dashboard</span>
                            <LayoutDashboard size={20} />
                        </button>
                        <label htmlFor="admin-file-upload" className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-full glass-card hover:bg-blue-500 cursor-pointer">
                            <span className="text-sm font-medium">Upload Files</span>
                            <Upload size={20} />
                        </label>
                        <label htmlFor="admin-folder-upload" className="flex items-center gap-2 px-4 py-2 bg-teal-600 text-white rounded-full glass-card hover:bg-teal-500 cursor-pointer">
                            <span className="text-sm font-medium">Upload Folder</span>
                            <FolderPlus size={20} />
                        </label>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* Hidden Inputs */}
            <input id="admin-file-upload" hidden multiple type="file" onChange={(e) => handleFileSelect(e, 'file')} />
            <input id="admin-folder-upload" hidden multiple type="file" ref={node => { if (node) { node.setAttribute("webkitdirectory", ""); node.setAttribute("directory", ""); } }} onChange={(e) => handleFileSelect(e, 'folder')} />

            <motion.button whileHover={{ scale: 1.1 }} whileTap={{ scale: 0.9 }} onClick={() => !isUploading && setIsMenuOpen(!isMenuOpen)} className={`p-4 rounded-full text-white shadow-xl transition-colors ${isMenuOpen ? 'bg-red-500 rotate-45' : 'bg-white/10 backdrop-blur-md hover:bg-white/20 text-foreground'} ${isUploading ? 'opacity-50 cursor-not-allowed' : ''}`}>
                {isUploading ? <Loader2 className="animate-spin" size={24} /> : <Plus size={24} />}
            </motion.button>

            {/* Unified Upload Status Modal */}
            <AnimatePresence>
                {(isUploading || (uploadProgress.total > 0 && uploadProgress.current === uploadProgress.total)) && (
                    <ClientPortal>
                        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 bg-black/60 backdrop-blur-sm z-40" />
                        <motion.div initial={{ opacity: 0, scale: 0.9, x: '-50%', y: '-50%' }} animate={{ opacity: 1, scale: 1, x: '-50%', y: '-50%' }} exit={{ opacity: 0, scale: 0.9, x: '-50%', y: '-50%' }} className="fixed top-1/2 left-1/2 w-96 p-8 glass-card rounded-3xl border border-white/10 z-50 bg-background/95 shadow-2xl overflow-hidden">
                            {/* State 1: Finished */}
                            {!isUploading && uploadProgress.total > 0 && uploadProgress.current === uploadProgress.total ? (
                                <div className="flex flex-col items-center text-center gap-4">
                                    <div className="w-16 h-16 rounded-full bg-green-500/20 flex items-center justify-center"><Check className="text-green-500" size={32} /></div>
                                    <h3 className="text-xl font-bold">Upload Complete!</h3>
                                    <p className="text-sm text-muted-foreground">Successfully processed {uploadProgress.success} files.</p>
                                    <button onClick={() => { setUploadProgress({ total: 0, current: 0, success: 0, failed: 0, currentFile: '' }); }} className="mt-4 px-8 py-2 bg-foreground text-background rounded-full font-bold">Done</button>
                                </div>
                            ) : (
                                /* State 2: Progress */
                                <div className="space-y-6">
                                    <div className="flex items-center gap-3"><Loader2 className="animate-spin text-blue-500" /> <span className="font-bold">Uploading Assets...</span></div>
                                    <div className="w-full bg-white/10 rounded-full h-3 overflow-hidden">
                                        <motion.div className="bg-blue-600 h-full" animate={{ width: `${(uploadProgress.current / (uploadProgress.total || 1)) * 100}%` }} />
                                    </div>
                                    <div className="flex justify-between text-xs font-mono text-muted-foreground"><span>{uploadProgress.current} / {uploadProgress.total} Files</span> <span>{Math.round((uploadProgress.current / (uploadProgress.total || 1)) * 100)}%</span></div>
                                    <div className="p-3 bg-white/5 rounded-xl text-xs truncate text-muted-foreground">{uploadProgress.currentFile || "Readying..."}</div>
                                </div>
                            )}
                        </motion.div>
                    </ClientPortal>
                )}
            </AnimatePresence>

            {/* Folder Modal */}
            <AnimatePresence>
                {isFolderModalOpen && (
                    <>
                        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50" onClick={() => setIsFolderModalOpen(false)} />
                        <motion.div initial={{ opacity: 0, scale: 0.9, x: '-50%', y: '-50%' }} animate={{ opacity: 1, scale: 1, x: '-50%', y: '-50%' }} exit={{ opacity: 0, scale: 0.9, x: '-50%', y: '-50%' }} className="fixed top-1/2 left-1/2 w-80 p-8 glass-card rounded-3xl border border-white/10 z-50 bg-background/95 shadow-2xl">
                            <h3 className="text-xl font-bold mb-6">New Folder</h3>
                            <form action={handleCreateFolder} className="space-y-4">
                                <input name="folderName" placeholder="Folder Name..." className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 outline-hidden focus:border-purple-500 transition" required autoFocus />
                                <div className="flex gap-2 justify-end">
                                    <button type="button" onClick={() => setIsFolderModalOpen(false)} className="px-4 py-2 text-sm text-muted-foreground">Cancel</button>
                                    <button disabled={isUploading} className="px-6 py-2 bg-purple-600 rounded-xl text-white font-bold text-sm shadow-lg shadow-purple-500/20">Create</button>
                                </div>
                            </form>
                        </motion.div>
                    </>
                )}
            </AnimatePresence>
        </div>
    );
}
