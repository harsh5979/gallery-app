'use client';

import { useState } from 'react';
import { useSocket } from '@/providers/SocketProvider';
import { Button } from '@/components/ui/button'; // Assuming we have UI components
import { Progress } from '@/components/ui/progress'; // Assuming
import { Upload, X } from 'lucide-react';

export default function SocketUploader({ currentPath, onComplete }) {
    const socket = useSocket();
    const [uploading, setUploading] = useState(false);
    const [progress, setProgress] = useState(0);
    const [status, setStatus] = useState('');

    const handleFileSelect = async (e) => {
        const selectedFiles = Array.from(e.target.files);
        if (selectedFiles.length === 0 || !socket) return;

        setUploading(true);
        setStatus(`Preparing ${selectedFiles.length} files...`);
        setProgress(0);

        try {
            for (let fIdx = 0; fIdx < selectedFiles.length; fIdx++) {
                const file = selectedFiles[fIdx];
                // Maintain folder structure if webkitRelativePath is available
                // e.g. "myfolder/inner/file.jpg"
                const relativePath = file.webkitRelativePath || file.name;
                const fileName = relativePath.split('/').pop();
                const subPath = relativePath.split('/').slice(0, -1).join('/');

                // Final destination folder combining currentPath and subPath
                const targetFolder = subPath ? (currentPath ? `${currentPath}/${subPath}` : subPath) : currentPath;

                setStatus(`Uploading [${fIdx + 1}/${selectedFiles.length}] ${fileName}...`);

                // Chunk size: 1MB
                const CHUNK_SIZE = 1 * 1024 * 1024;
                const totalChunks = Math.ceil(file.size / CHUNK_SIZE);

                await new Promise((resolve, reject) => {
                    socket.emit('upload_start', {
                        folder: targetFolder,
                        fileName: fileName,
                        totalSize: file.size
                    });

                    const readyHandler = () => {
                        socket.off('upload_ready', readyHandler);
                        socket.off('upload_error', errorHandler);
                        resolve();
                    };
                    const errorHandler = (err) => {
                        socket.off('upload_ready', readyHandler);
                        socket.off('upload_error', errorHandler);
                        reject(new Error(err.message || 'Error starting upload'));
                    };
                    socket.on('upload_ready', readyHandler);
                    socket.on('upload_error', errorHandler);
                });

                const maxInFlight = 8;
                let inFlight = 0;
                let chunksSent = 0;

                const uploadNextChunk = async () => {
                    if (chunksSent >= totalChunks) return;

                    const chunkIdx = chunksSent++;
                    const start = chunkIdx * CHUNK_SIZE;
                    const end = Math.min(start + CHUNK_SIZE, file.size);
                    const chunk = file.slice(start, end);
                    const buffer = await chunk.arrayBuffer();

                    inFlight++;
                    socket.emit('upload_chunk', buffer);

                    // If we have room in the window, send next one immediately
                    if (inFlight < maxInFlight) {
                        uploadNextChunk();
                    }
                };

                await new Promise((resolve, reject) => {
                    const ackHandler = () => {
                        inFlight--;
                        const overallProgress = Math.round(((fIdx + (chunksSent - inFlight) / totalChunks) / selectedFiles.length) * 100);
                        setProgress(overallProgress);

                        if (chunksSent < totalChunks) {
                            uploadNextChunk();
                        } else if (inFlight === 0) {
                            // All chunks sent and acknowledged, now tell server to wrap up
                            socket.emit('upload_end');
                        }
                    };

                    const onFinished = () => {
                        cleanup();
                        resolve();
                    };

                    const onStartupError = (err) => {
                        cleanup();
                        reject(new Error(err.message || 'Upload failed'));
                    };

                    const cleanup = () => {
                        socket.off('upload_ack', ackHandler);
                        socket.off('upload_complete', onFinished);
                        socket.off('upload_error', onStartupError);
                    };

                    socket.on('upload_ack', ackHandler);
                    socket.on('upload_complete', onFinished);
                    socket.on('upload_error', onStartupError);

                    uploadNextChunk();
                });
            }

            setStatus('All uploads completed!');
            setTimeout(() => {
                setUploading(false);
                if (onComplete) onComplete();
            }, 500); // Shorter delay

        } catch (err) {
            console.error(err);
            setStatus('Error: ' + err.message);
            setUploading(false);
        }
    };

    // Listen for complete
    // UseEffect to bind listeners
    // ... For brevity, inline listeners above might leak if not careful, 
    // but in a loop with 'once' or manual off is okay.

    // Better: Global listener for completion
    // useEffect(() => {
    //     if (!socket) return;
    //     socket.on('upload_complete', () => { ... });
    // }, [socket]);

    return (
        <div className="p-4 border rounded bg-white/5 backdrop-blur">
            <div className="flex items-center gap-4">
                <input
                    type="file"
                    onChange={handleFileSelect}
                    disabled={uploading}
                    webkitdirectory="true"
                    directory="true"
                    multiple
                    className="file:bg-blue-600 file:border-none file:text-white file:px-4 file:py-2 file:rounded hover:file:bg-blue-700"
                />
                {uploading && (
                    <div className="flex-1">
                        <div className="h-2 bg-gray-700 rounded-full overflow-hidden">
                            <div
                                className="h-full bg-blue-500 transition-all duration-300"
                                style={{ width: `${progress}%` }}
                            />
                        </div>
                        <p className="text-xs text-gray-400 mt-1">{status}</p>
                    </div>
                )}
            </div>
        </div>
    );
}
