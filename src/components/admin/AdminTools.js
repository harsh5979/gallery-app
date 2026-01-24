'use client';

import { useState, useRef, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { createNewFolder, uploadChunk, uploadImage, deleteItem } from '@/app/actions';
import { FolderPlus, Upload, Trash2, X, Loader2, FileUp, CheckCircle, AlertCircle, Plus, File } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import DeleteConfirmation from './DeleteConfirmation';
// ClientPortal is in ../ui/ClientPortal now
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

    async function handleFileSelect(e, type) {
        const files = Array.from(e.target.files || []);
        if (files.length === 0) return;

        // Reset progress
        setUploadProgress({ total: 0, current: 0, success: 0, failed: 0, currentFile: '' });

        if (type === 'folder') {
            await prepareUpload(files, type);
        } else {
            setPendingFiles(files);
            setPendingType(type);
            setIsUploadConfirmOpen(true);
            setIsMenuOpen(false);
        }

        e.target.value = '';
    }

    async function prepareUpload(files, type) {
        setPendingFiles(files);
        setPendingType(type);
        setIsUploadConfirmOpen(true);
        setIsMenuOpen(false);
    }

    async function startBatchUpload() {
        setIsUploading(true);
        setIsUploadConfirmOpen(false);

        const totalFiles = pendingFiles.length;
        setUploadProgress(prev => ({ ...prev, total: totalFiles, current: 0 }));

        const CHUNK_SIZE = 5 * 1024 * 1024; // 5MB

        // Clear cache for this folder so new files show up
        const cacheKey = `gallery_cache_${currentFolder || 'root'}`;
        sessionStorage.removeItem(cacheKey);

        const CONCURRENCY_LIMIT = 3;


        // Helper to process a single file
        const processFile = async (file) => {
            // Determine relative path
            let relativePath = file.name;
            if (pendingType === 'folder') {
                relativePath = file.customPath || file.webkitRelativePath || file.name;
            } else {
                relativePath = file.name;
            }

            const totalChunks = Math.ceil(file.size / CHUNK_SIZE);

            setUploadProgress(prev => ({
                ...prev,
                currentFile: `${file.name} (${formatSize(file.size)})`
            }));

            let fileSuccess = false;
            let attempts = 0;

            while (!fileSuccess && attempts < 3) {
                try {
                    if (totalChunks > 1) {
                        // Chunked Upload for Large Files
                        for (let chunkIndex = 0; chunkIndex < totalChunks; chunkIndex++) {
                            const start = chunkIndex * CHUNK_SIZE;
                            const end = Math.min(start + CHUNK_SIZE, file.size);
                            const chunk = file.slice(start, end);

                            setUploadProgress(prev => ({
                                ...prev,
                                currentFile: `${file.name} (${formatSize(start)} / ${formatSize(file.size)} - ${Math.round((start / file.size) * 100)}%)`
                            }));

                            const chunkFormData = new FormData();
                            // Target folder calculation...
                            const parts = relativePath.split('/');
                            const actualFileName = parts.pop();
                            const subDir = parts.join('/');
                            const targetFolder = subDir ? (currentFolder ? `${currentFolder}/${subDir}` : subDir) : (currentFolder || '');

                            chunkFormData.append('folder', targetFolder);
                            chunkFormData.append('fileName', actualFileName);
                            chunkFormData.append('chunk', chunk);
                            chunkFormData.append('chunkIndex', chunkIndex);
                            chunkFormData.append('totalChunks', totalChunks);

                            const res = await uploadChunk(chunkFormData);
                            if (res.error) throw new Error(res.error);
                        }
                        fileSuccess = true;
                    } else {
                        // Standard Upload
                        const formData = new FormData();
                        formData.append('folder', currentFolder || '');
                        formData.append('files', file); // actions.js expects 'files' (array) but works with single if looped? 
                        // Wait, actions.js iterates `files`. If we send one, it works.
                        formData.append('paths', relativePath);

                        const res = await uploadImage(formData);
                        if (res.error) throw new Error(res.error); // Fix: uploadImage returns {error} not {success:false} sometimes
                        fileSuccess = true;
                    }
                } catch (e) {
                    console.error(`Upload error ${file.name} (Attempt ${attempts + 1}):`, e);
                    attempts++;
                    if (attempts === 3) {
                        setUploadProgress(prev => ({ ...prev, failed: prev.failed + 1 }));
                    } else {
                        await new Promise(r => setTimeout(r, 1000));
                    }
                }
            }
            if (fileSuccess) {
                setUploadProgress(prev => ({ ...prev, current: prev.current + 1, success: prev.success + 1 }));
            }
        };

        // Concurrency Pool Execution
        const pool = [];
        const filesToUpload = [...pendingFiles]; // Copy

        // Execute
        // We can't use simple map because we need to wait for slots.
        // Simple implementation:
        for (let i = 0; i < filesToUpload.length; i += CONCURRENCY_LIMIT) {
            const batch = filesToUpload.slice(i, i + CONCURRENCY_LIMIT);
            await Promise.all(batch.map(f => processFile(f)));
        }

        setIsUploading(false);
        router.refresh();
        // alert call removed. UI handles it via uploadProgress state check.
        // We do NOT clear pendingFiles here, because we want the modal to show the success state.
        // It will be cleared when the user clicks "Done" in the modal.
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

        const res = await createNewFolder(formData);
        setIsUploading(false);
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
                                    <p className="text-sm text-muted-foreground mb-6">
                                        Uploading {pendingFiles.length} {pendingType === 'folder' ? 'files from folder' : 'files'} to <span className="text-foreground font-medium">{currentFolder || 'Home'}</span>?
                                    </p>

                                    <div className="bg-foreground/5 rounded-lg p-3 mb-6 max-h-32 overflow-y-auto custom-scrollbar">
                                        {pendingFiles.slice(0, 5).map((file, i) => (
                                            <div key={i} className="flex items-center gap-2 text-xs text-muted-foreground py-1 border-b border-foreground/5 last:border-0">
                                                <File size={12} className="opacity-50" />
                                                <span className="truncate">{file.name}</span>
                                            </div>
                                        ))}
                                        {pendingFiles.length > 5 && (
                                            <div className="text-xs text-muted-foreground text-center pt-2 italic">
                                                + {pendingFiles.length - 5} more...
                                            </div>
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
