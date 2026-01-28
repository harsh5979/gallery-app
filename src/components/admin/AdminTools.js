'use client';

import { useState, useRef, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { uploadChunk, uploadImage } from '@/app/actions';
import { revalidateGallery, syncFolders } from '@/app/adminActions'; // Import revalidate and sync
import { useGalleryMutations } from '@/hooks/useGalleryMutations';
import { useSocket } from '@/providers/SocketProvider';
import { FolderPlus, Upload, Loader2, Plus, Check, LayoutDashboard } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import ClientPortal from '@/components/ui/ClientPortal';

function formatSize(bytes) {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

export default function AdminTools({ currentFolder }) {
    const router = useRouter();
    const [isMenuOpen, setIsMenuOpen] = useState(false);
    const containerRef = useRef(null);
    const { createFolder, handleUpload } = useGalleryMutations(currentFolder);
    const socket = useSocket(); // Use the socket instance

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

    // Upload State
    const [isUploading, setIsUploading] = useState(false);
    const [uploadProgress, setUploadProgress] = useState({
        total: 0,
        current: 0,
        success: 0,
        failed: 0,
        currentFile: ''
    });

    const [pendingFiles, setPendingFiles] = useState([]);
    const [pendingType, setPendingType] = useState('file'); // 'file' or 'folder'

    const fileInputRef = useRef(null);
    const folderInputRef = useRef(null);

    // UI State for Preview
    const [selectedIndices, setSelectedIndices] = useState(new Set());
    const [visibleLimit, setVisibleLimit] = useState(10); // Start with 10

    async function handleFileSelect(e, type) {
        const files = Array.from(e.target.files || []);
        if (files.length === 0) return;

        // Reset progress
        setUploadProgress({ total: 0, current: 0, success: 0, failed: 0, currentFile: '' });

        if (type === 'folder') {
            await prepareUpload(files, type);
        } else {
            setPendingFiles(files);
            // Select all by default
            const allIndices = new Set(files.map((_, i) => i));
            setSelectedIndices(allIndices);
            setVisibleLimit(10);
            setPendingType(type);
            setIsUploadConfirmOpen(true);
            setIsMenuOpen(false);
        }

        e.target.value = '';
    }

    async function prepareUpload(files, type) {
        setPendingFiles(files);
        // Select all by default
        const allIndices = new Set(files.map((_, i) => i));
        setSelectedIndices(allIndices);
        setVisibleLimit(10);
        setPendingType(type);
        setIsUploadConfirmOpen(true);
        setIsMenuOpen(false);
    }

    // Helper to toggle selection
    const toggleSelection = (index) => {
        const newSet = new Set(selectedIndices);
        if (newSet.has(index)) {
            newSet.delete(index);
        } else {
            newSet.add(index);
        }
        setSelectedIndices(newSet);
    };

    // Helper to select/deselect all
    const toggleAll = () => {
        if (selectedIndices.size === pendingFiles.length) {
            setSelectedIndices(new Set());
        } else {
            setSelectedIndices(new Set(pendingFiles.map((_, i) => i)));
        }
    };

    // Helper to load more
    const showMore = () => {
        setVisibleLimit(prev => Math.min(prev + 50, pendingFiles.length)); // Load 50 more
    };

    async function startBatchUpload() {
        setIsUploadConfirmOpen(false);
        // setIsUploading(true); // Handled by mutation status if we want, or keep local for granular progress UI

        handleUpload.mutate({
            processBatch: async () => {
                setIsUploading(true);
                // ... Existing logic ...
                // Re-pasting the core logic here is necessary or we extract it.
                // Let's call a separate function `executeUploads`.
                await executeUploads();

                // Finalize: Revalidate Cache so images show up
                await revalidateGallery(currentFolder);

                // If we uploaded a folder, sync DB so it shows in Permissions
                if (pendingType === 'folder') {
                    await syncFolders();
                }
            }
        }, {
            onSettled: () => {
                setIsUploading(false);
                router.refresh();
                // Mutation hook handles invalidation.
            }
        });
    }

    async function executeUploads() {
        // Filter only selected files
        const filesToUpload = pendingFiles.filter((_, i) => selectedIndices.has(i));

        if (filesToUpload.length === 0) {
            alert("No files selected!");
            return;
        }

        const totalFiles = filesToUpload.length;
        setUploadProgress(prev => ({ ...prev, total: totalFiles, current: 0 }));

        const CHUNK_SIZE = 5 * 1024 * 1024; // 5MB

        // Clear cache for this folder so new files show up
        const cacheKey = `gallery_cache_${currentFolder || 'root'}`;
        sessionStorage.removeItem(cacheKey);

        const CONCURRENCY_LIMIT = 3;


        // Helper to process a single file via Socket
        const processFileSocket = async (file) => {
            return new Promise((resolve, reject) => {
                if (!socket) return reject(new Error("Socket not connected"));

                // Determine relative path
                let relativePath = file.name;
                if (pendingType === 'folder') {
                    relativePath = file.customPath || file.webkitRelativePath || file.name;
                } else {
                    relativePath = file.name;
                }

                const parts = relativePath.split('/');
                const actualFileName = parts.pop();
                const subDir = parts.join('/');
                const targetFolder = subDir ? (currentFolder ? `${currentFolder}/${subDir}` : subDir) : (currentFolder || '');

                setUploadProgress(prev => ({
                    ...prev,
                    currentFile: `${file.name} (${formatSize(file.size)})`
                }));

                const CHUNK_SIZE = 1024 * 1024; // 1MB chunks
                const totalChunks = Math.ceil(file.size / CHUNK_SIZE);

                // Handlers
                const onReady = async () => {
                    try {
                        for (let i = 0; i < totalChunks; i++) {
                            const start = i * CHUNK_SIZE;
                            const end = Math.min(start + CHUNK_SIZE, file.size);
                            const chunk = file.slice(start, end);
                            const arrayBuffer = await chunk.arrayBuffer();

                            socket.emit('upload_chunk', arrayBuffer);

                            // Simple backpressure: wait for ack
                            await new Promise(r => socket.once('upload_ack', r));

                            setUploadProgress(prev => ({
                                ...prev,
                                currentFile: `${file.name} (${formatSize(end)} / ${formatSize(file.size)})`
                            }));
                        }
                        socket.emit('upload_end');
                    } catch (e) {
                        cleanup();
                        reject(e);
                    }
                };

                const onComplete = () => {
                    cleanup();
                    setUploadProgress(prev => ({ ...prev, current: prev.current + 1, success: prev.success + 1 }));
                    resolve();
                };

                const onError = (err) => {
                    cleanup();
                    console.error("Socket Upload Error:", err);
                    setUploadProgress(prev => ({ ...prev, failed: prev.failed + 1 }));
                    // Don't reject entire batch, just this file
                    resolve();
                };

                const cleanup = () => {
                    socket.off('upload_ready', onReady);
                    socket.off('upload_complete', onComplete);
                    socket.off('upload_error', onError);
                };

                // Listeners
                socket.on('upload_ready', onReady);
                socket.on('upload_complete', onComplete);
                socket.on('upload_error', onError);

                // Start
                socket.emit('upload_start', {
                    folder: targetFolder,
                    fileName: actualFileName,
                    totalSize: file.size
                });
            });
        };

        // Fallback or unused HTTP processFile removed for brevity if replacing completely.
        // But let's keep logic simple: we replace the loops below.

        // Execute Sequentially for Socket (Single Channel)
        for (const file of filesToUpload) {
            await processFileSocket(file);
        }

        // setIsUploading(false); // Handled by mutation settled
        // router.refresh();
    }

    async function handleCreateFolder(formData) {
        setIsUploading(true);
        // ... (existing folder creation logic, just using isUploading instead of isPending)
        const rawName = formData.get('folderName');
        const mkPath = rawName.split(',')
            .map(n => n.trim())
            .filter(Boolean)
            .map(n => currentFolder ? `${currentFolder}/${n}` : n)
            .join(',');

        formData.set('folderName', mkPath);

        formData.set('folderName', mkPath);

        try {
            await createFolder.mutateAsync(formData);
            // Success handled by hook (invalidation)
            setIsFolderModalOpen(false);
            // router.refresh(); // Hook does invalidation, but router refresh is also good for server components if any.
        } catch (e) {
            alert(e.message);
        }
        setIsUploading(false);
    }

    return (
        <div ref={containerRef} className="fixed bottom-8 right-8 z-40 flex flex-col items-end gap-4">
            {/* Menu Options */}
            <AnimatePresence>
                {isMenuOpen && !isUploading && (
                    <motion.div
                        initial={{ opacity: 0, y: 20, scale: 0.8 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        exit={{ opacity: 0, y: 20, scale: 0.8 }}
                        className="flex flex-col gap-2 items-end mb-2"
                    >
                        {/* New Folder */}
                        <button
                            onClick={() => { setIsFolderModalOpen(true); setIsMenuOpen(false); }}
                            className="flex items-center gap-2 px-4 py-2 bg-purple-600 text-white rounded-full shadow-lg hover:bg-purple-500 glass-card cursor-pointer"
                        >
                            <span className="text-sm font-medium">New Folder</span>
                            <FolderPlus size={20} />
                        </button>

                        {/* Dashboard Link */}
                        <button
                            onClick={() => router.push('/admin')}
                            className="flex items-center gap-2 px-4 py-2 bg-gray-800 text-white rounded-full shadow-lg hover:bg-gray-700 glass-card cursor-pointer"
                        >
                            <span className="text-sm font-medium">Dashboard</span>
                            <LayoutDashboard size={20} />
                        </button>

                        {/* Upload Files */}
                        <label
                            htmlFor="admin-file-upload"
                            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-full shadow-lg hover:bg-blue-500 glass-card cursor-pointer select-none"
                        >
                            <span className="text-sm font-medium">Upload Files</span>
                            <Upload size={20} />
                        </label>

                        {/* Upload Folder */}
                        <label
                            htmlFor="admin-folder-upload"
                            className="flex items-center gap-2 px-4 py-2 bg-teal-600 text-white rounded-full shadow-lg hover:bg-teal-500 glass-card cursor-pointer select-none"
                        >
                            <span className="text-sm font-medium">Upload Folder</span>
                            <FolderPlus size={20} />
                        </label>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* Main FAB */}
            <motion.button
                whileHover={{ scale: 1.1 }}
                whileTap={{ scale: 0.9 }}
                onClick={() => !isUploading && setIsMenuOpen(!isMenuOpen)}
                className={`p-4 rounded-full text-white shadow-xl transition-colors cursor-pointer ${isMenuOpen ? 'bg-red-500 rotate-45' : 'bg-black/20 backdrop-blur-md hover:bg-black/30 dark:bg-white/20 dark:hover:bg-white/30 text-foreground'} ${isUploading ? 'cursor-not-allowed opacity-80' : ''}`}
            >
                {isUploading ? <Loader2 className="animate-spin" size={24} /> : <Plus size={24} className="text-foreground" />}
            </motion.button>

            {/* Hidden Inputs */}
            <input
                id="admin-file-upload"
                hidden
                multiple
                type="file" // Explicitly add type="file" just in case
                // Accept any file type for full quality/backup
                onChange={(e) => handleFileSelect(e, 'file')}
            />
            <input
                id="admin-folder-upload"
                hidden
                multiple
                type="file"
                ref={(node) => {
                    // folderInputRef.current = node; // We don't strictly need the ref since we use ID, but for webkitdirectory setup...
                    // Oh wait, we need ref callback to set attributes!
                    if (node) {
                        node.setAttribute("webkitdirectory", "");
                        node.setAttribute("directory", "");
                    }
                }}
                onChange={(e) => handleFileSelect(e, 'folder')}
            />

            {/* Folder Creation Modal */}
            <AnimatePresence>
                {isFolderModalOpen && (
                    <>
                        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50" onClick={() => setIsFolderModalOpen(false)} />
                        <motion.div
                            initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.9 }}
                            className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-80 p-6 glass-card rounded-2xl border border-glass-border z-50 bg-background/80"
                        >
                            <h3 className="font-bold text-xl mb-4 text-foreground">Create New Folder</h3>
                            <form action={handleCreateFolder} className="flex flex-col gap-4">
                                <input name="folderName" placeholder="e.g. Vacation" className="bg-foreground/5 rounded-lg px-4 py-2 text-foreground border border-foreground/10 focus:border-purple-500 outline-hidden" required autoFocus />
                                <div className="flex gap-2 justify-end">
                                    <button type="button" onClick={() => setIsFolderModalOpen(false)} className="px-4 py-2 rounded-lg text-muted-foreground hover:text-foreground transition">Cancel</button>
                                    <button disabled={isUploading} className="px-6 py-2 bg-purple-600 rounded-lg text-white font-medium hover:bg-purple-500 transition">Create</button>
                                </div>
                            </form>
                        </motion.div>
                    </>
                )}
            </AnimatePresence>

            {/* Upload Modal (Unified: Confirm -> Progress -> Result) */}
            <AnimatePresence>
                {(isUploadConfirmOpen || isUploading || uploadProgress.total > 0 && uploadProgress.current === uploadProgress.total) && (
                    <ClientPortal>
                        <motion.div
                            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                            className="fixed inset-0 bg-black/60 backdrop-blur-sm z-40"
                            onClick={() => {
                                // Only allow close if not actively uploading
                                if (!isUploading) {
                                    setIsUploadConfirmOpen(false);
                                    // Reset if finished
                                    if (uploadProgress.total > 0 && uploadProgress.current === uploadProgress.total) {
                                        setUploadProgress({ total: 0, current: 0, success: 0, failed: 0, currentFile: '' });
                                        setPendingFiles([]);
                                    }
                                }
                            }}
                        />
                        <motion.div
                            initial={{ opacity: 0, scale: 0.9, x: '-50%', y: '-50%' }}
                            animate={{ opacity: 1, scale: 1, x: '-50%', y: '-50%' }}
                            exit={{ opacity: 0, scale: 0.9, x: '-50%', y: '-50%' }}
                            className="fixed top-1/2 left-1/2 w-96 p-6 glass-card rounded-2xl border border-glass-border z-50 bg-background shadow-2xl"
                            onClick={(e) => { e.preventDefault(); e.stopPropagation(); }}
                        >
                            {/* State 1: Finished (Success Report) */}
                            {!isUploading && uploadProgress.total > 0 && uploadProgress.current === uploadProgress.total ? (
                                <div className="flex flex-col gap-4 items-center text-center">
                                    <div className="w-16 h-16 rounded-full bg-green-500/20 flex items-center justify-center mb-2">
                                        <Upload className="w-8 h-8 text-green-500" />
                                    </div>
                                    <h3 className="font-bold text-xl text-foreground">Upload Complete!</h3>
                                    <div className="text-sm text-muted-foreground">
                                        <p>Successfully uploaded <span className="text-foreground font-medium">{uploadProgress.success}</span> files.</p>
                                        {uploadProgress.failed > 0 && (
                                            <p className="text-red-400 mt-1">Failed to upload {uploadProgress.failed} files.</p>
                                        )}
                                    </div>
                                    <button
                                        onClick={() => {
                                            setUploadProgress({ total: 0, current: 0, success: 0, failed: 0, currentFile: '' });
                                            setPendingFiles([]);
                                            setIsUploadConfirmOpen(false);
                                        }}
                                        className="mt-4 px-6 py-2 bg-foreground text-background font-medium rounded-full cursor-pointer hover:bg-muted-foreground/20 transition"
                                    >
                                        Done
                                    </button>
                                </div>
                            ) : isUploading ? (
                                // State 2: Uploading Progress
                                <div className="flex flex-col gap-4">
                                    <h3 className="font-bold text-lg text-foreground flex items-center gap-2">
                                        <Loader2 className="animate-spin text-blue-500" />
                                        Uploading...
                                    </h3>
                                    <p className="text-sm text-muted-foreground">
                                        Processing {pendingFiles.length} files. Please keep this tab open.
                                    </p>

                                    {/* Progress Bar */}
                                    <div className="w-full bg-foreground/10 rounded-full h-4 overflow-hidden">
                                        <motion.div
                                            className="bg-blue-600 h-full"
                                            initial={{ width: 0 }}
                                            animate={{ width: `${(uploadProgress.current / uploadProgress.total) * 100}%` }}
                                            transition={{ type: "spring", stiffness: 50 }}
                                        />
                                    </div>

                                    <div className="flex justify-between text-xs text-muted-foreground font-mono">
                                        <span>{uploadProgress.current} / {uploadProgress.total}</span>
                                        <span>{Math.round((uploadProgress.current / uploadProgress.total) * 100)}%</span>
                                    </div>

                                    <div className="bg-foreground/5 p-2 rounded text-xs text-muted-foreground truncate">
                                        {uploadProgress.currentFile || "Preparing..."}
                                    </div>
                                </div>
                            ) : (
                                // State 3: Confirmation (Start)
                                <>
                                    <h3 className="font-bold text-lg mb-2 text-foreground">Confirm Upload</h3>
                                    <p className="text-sm text-muted-foreground mb-4">
                                        Uploading <span className="text-foreground font-bold">{selectedIndices.size}</span> of {pendingFiles.length} files to <span className="text-foreground font-medium">{currentFolder || 'Home'}</span>
                                    </p>

                                    {/* Selection Controls */}
                                    <div className="flex justify-between items-center mb-2 px-1">
                                        <button
                                            onClick={toggleAll}
                                            className="text-xs font-medium text-blue-400 hover:text-blue-300 transition"
                                        >
                                            {selectedIndices.size === pendingFiles.length ? 'Deselect All' : 'Select All'}
                                        </button>
                                        <span className="text-xs text-muted-foreground">
                                            {selectedIndices.size} selected
                                        </span>
                                    </div>

                                    {/* File List */}
                                    <div className="bg-foreground/5 rounded-lg p-3 mb-6 max-h-32 overflow-y-auto custom-scrollbar flex flex-col gap-1">
                                        {pendingFiles.slice(0, visibleLimit).map((file, i) => {
                                            const isSelected = selectedIndices.has(i);
                                            return (
                                                <div
                                                    key={i}
                                                    onClick={() => toggleSelection(i)}
                                                    className={`flex items-center gap-3 text-xs py-2 px-2 rounded-md cursor-pointer transition-colors ${isSelected ? 'bg-blue-500/10 hover:bg-blue-500/20' : 'hover:bg-white/5 opacity-50'}`}
                                                >
                                                    <div className={`w-4 h-4 rounded border flex items-center justify-center transition-colors ${isSelected ? 'bg-blue-500 border-blue-500' : 'border-white/20'}`}>
                                                        {isSelected && <Check size={12} strokeWidth={3} className="text-white" />}
                                                    </div>

                                                    <div className="flex-1 min-w-0">
                                                        <div className={`truncate font-medium ${isSelected ? 'text-foreground' : 'text-muted-foreground'}`}>{file.name}</div>
                                                        <div className="text-[10px] text-muted-foreground opacity-70">{formatSize(file.size)}</div>
                                                    </div>
                                                </div>
                                            );
                                        })}

                                        {/* Show More Button */}
                                        {pendingFiles.length > visibleLimit && (
                                            <button
                                                onClick={(e) => { e.stopPropagation(); showMore(); }}
                                                className="w-full py-2 mt-2 text-xs text-muted-foreground hover:text-foreground hover:bg-white/5 rounded-md transition-colors border border-dashed border-white/10"
                                            >
                                                Show {Math.min(50, pendingFiles.length - visibleLimit)} More ({pendingFiles.length - visibleLimit} remaining)
                                            </button>
                                        )}
                                    </div>

                                    <div className="flex gap-3 justify-end">
                                        <button
                                            onClick={() => setIsUploadConfirmOpen(false)}
                                            className="px-4 py-2 rounded-lg text-muted-foreground hover:text-foreground hover:bg-foreground/5 transition text-sm cursor-pointer"
                                        >
                                            Cancel
                                        </button>
                                        <button
                                            onClick={startBatchUpload}
                                            className="px-4 py-2 bg-blue-600/90 hover:bg-blue-600 rounded-lg text-white font-medium transition text-sm flex items-center gap-2 shadow-lg shadow-blue-900/20 cursor-pointer"
                                        >
                                            <Upload size={14} />
                                            Start Upload
                                        </button>
                                    </div>
                                </>
                            )}
                        </motion.div>
                    </ClientPortal>
                )}
            </AnimatePresence>
        </div>
    );
}


