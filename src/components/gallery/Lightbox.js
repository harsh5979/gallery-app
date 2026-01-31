'use client';

import { motion, AnimatePresence } from 'framer-motion';
import { ArrowLeft, Download, X, Loader2, ZoomIn, ZoomOut, Info } from 'lucide-react';
import { TransformWrapper, TransformComponent } from 'react-zoom-pan-pinch';
import Image from 'next/image';
import { useState, useEffect, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { getImageDetails, getFileContent } from '@/app/actions';
import CodeViewer from './CodeViewer';
import LightboxControls from './LightboxControls';

/**
 * Lightbox Component: Handles full-screen preview of images, videos, and code.
 */
export default function Lightbox({ selectedImage, images, currentFolder, onClose, onNext, onPrev, role }) {
    const [showInfo, setShowInfo] = useState(false);

    // 1. Navigation Event Listeners
    useEffect(() => {
        const handleKeyDown = (e) => {
            if (e.key === 'ArrowRight') onNext?.();
            if (e.key === 'ArrowLeft') onPrev?.();
            if (e.key === 'Escape') onClose?.();
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [onNext, onPrev, onClose]);

    // 2. Body Scroll Lock
    useEffect(() => {
        document.body.style.overflow = 'hidden';
        return () => { document.body.style.overflow = 'unset'; };
    }, []);

    const imageParam = useMemo(() =>
        typeof selectedImage === 'string' ? selectedImage : selectedImage.name
        , [selectedImage]);

    // 3. React Query for Metadata (Cached)
    const { data: metaData } = useQuery({
        queryKey: ['file-meta', currentFolder, imageParam],
        queryFn: () => getImageDetails(currentFolder || '', imageParam),
        enabled: !!selectedImage,
        staleTime: 1000 * 60 * 5,
    });

    if (!selectedImage) return null;

    return (
        <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[100] bg-black/95 backdrop-blur-xl flex items-center justify-center p-4 overflow-hidden"
            onClick={onClose}
        >
            <div className="relative w-full h-full flex items-center justify-center" onClick={e => e.stopPropagation()}>
                <AnimatePresence mode="wait">
                    {/* 
                      * We use imageParam as key to ensure a fresh component mount 
                      * on every item change. This naturally resets child state (like loading).
                      */}
                    <MediaRenderer
                        key={imageParam}
                        imageParam={imageParam}
                        currentFolder={currentFolder}
                        selectedImage={selectedImage}
                        role={role}
                        onNext={onNext}
                        onPrev={onPrev}
                    />
                </AnimatePresence>
            </div>

            <LightboxControls
                showInfo={showInfo}
                setShowInfo={setShowInfo}
                src={getMediaSrc(currentFolder, imageParam)}
                onClose={onClose}
            />

            {/* Info Panel Section */}
            <AnimatePresence>
                {showInfo && (
                    <motion.div
                        initial={{ y: 20, opacity: 0 }}
                        animate={{ y: 0, opacity: 1 }}
                        exit={{ y: 20, opacity: 0 }}
                        className="absolute bottom-8 left-1/2 -translate-x-1/2 bg-black/80 backdrop-blur-md p-6 rounded-2xl border border-white/10 text-white z-50 text-center"
                        onClick={e => e.stopPropagation()}
                    >
                        <h3 className="font-bold mb-2">Details</h3>
                        <div className="grid grid-cols-[80px_1fr] gap-x-4 text-sm text-left">
                            <span className="text-white/50">Name:</span> <span className="truncate max-w-[250px]">{imageParam}</span>
                            {metaData && (
                                <>
                                    <span className="text-white/50">Modified:</span> <span>{new Date(metaData.modified).toLocaleString()}</span>
                                    <span className="text-white/50">Size:</span> <span>{(metaData.size / 1024).toFixed(1)} KB</span>
                                </>
                            )}
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>
        </motion.div>
    );
}

/**
 * Helper to determine Media Source URL
 */
function getMediaSrc(currentFolder, fileName) {
    const encodedFolder = currentFolder ? currentFolder.split('/').map(p => encodeURIComponent(p)).join('/') : 'root';
    const encodedImg = encodeURIComponent(fileName);
    return `/api/images/${encodedFolder}/${encodedImg}`;
}

/**
 * Sub-component to handle specific Media Type rendering.
 * Managed with a 'key' in parent to reset state on change.
 */
function MediaRenderer({ imageParam, currentFolder, selectedImage, role, onNext, onPrev }) {
    const [assetLoaded, setAssetLoaded] = useState(false);
    const src = getMediaSrc(currentFolder, imageParam);

    // File Type Detection
    const isImage = /\.(jpg|jpeg|png|gif|webp|svg|heic|heif|bmp|tiff|tif)$/i.test(imageParam);
    const isVideo = /\.(mp4|webm|mov|mkv)$/i.test(imageParam);
    const isPDF = /\.pdf$/i.test(imageParam);
    const isCode = /\.(js|jsx|ts|tsx|css|html|json|md|txt|py|java|c|cpp|h|go|rs|sql|xml|yaml|yml|log|ini|conf)$/i.test(imageParam);

    const { data: codeContent, isLoading: isCodeLoading } = useQuery({
        queryKey: ['file-content', currentFolder, imageParam],
        queryFn: () => getFileContent(currentFolder || '', imageParam),
        enabled: isCode,
        staleTime: 1000 * 60 * 5,
    });

    const swipeConfidenceThreshold = 10000;
    const swipePower = (offset, velocity) => Math.abs(offset) * velocity;

    return (
        <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 1.05 }}
            className="w-full h-full flex items-center justify-center p-2"
            drag={isImage ? "x" : false}
            dragConstraints={{ left: 0, right: 0 }}
            onDragEnd={(e, { offset, velocity }) => {
                const swipe = swipePower(offset.x, velocity.x);
                if (swipe < -swipeConfidenceThreshold) onNext?.();
                else if (swipe > swipeConfidenceThreshold) onPrev?.();
            }}
        >
            {isCode ? (
                <div className="w-full h-full flex items-center justify-center p-4">
                    {isCodeLoading ? <Loader2 className="animate-spin text-white" size={48} /> :
                        <CodeViewer content={codeContent} language={imageParam.split('.').pop()} isEditable={role === 'admin'} filename={imageParam} currentFolder={currentFolder} />}
                </div>
            ) : isVideo ? (
                <video src={src} controls autoPlay className="max-w-full max-h-[90vh] rounded-lg shadow-2xl" />
            ) : isImage ? (
                <TransformWrapper initialScale={1} centerOnInit>
                    {!assetLoaded && <div className="absolute inset-0 flex items-center justify-center"><Loader2 size={48} className="animate-spin text-purple-500" /></div>}
                    <TransformComponent wrapperClass="!w-full !h-full" contentClass="!w-full !h-full flex items-center justify-center">
                        <div className="relative w-full h-[85vh]">
                            <Image src={src} fill className={`object-contain transition-opacity duration-300 ${assetLoaded ? 'opacity-100' : 'opacity-0'}`} alt={imageParam} onLoad={() => setAssetLoaded(true)} priority />
                        </div>
                    </TransformComponent>
                </TransformWrapper>
            ) : isPDF ? (
                <iframe src={src} className="w-full h-[90vh] rounded-xl bg-white" title={imageParam} />
            ) : (
                <DownloadFallback src={src} fileName={imageParam} />
            )}

            {/* In-view Navigation Overlays */}
            {!isCode && (
                <>
                    <button className="absolute left-8 p-4 rounded-full bg-white/5 hover:bg-white/10 text-white hidden md:block" onClick={onPrev}><ArrowLeft size={32} /></button>
                    <button className="absolute right-8 p-4 rounded-full bg-white/5 hover:bg-white/10 text-white hidden md:block" onClick={onNext}><ArrowLeft size={32} className="rotate-180" /></button>
                </>
            )}
        </motion.div>
    );
}

function DownloadFallback({ src, fileName }) {
    return (
        <div className="flex flex-col items-center justify-center text-white gap-6 p-12 bg-white/5 rounded-3xl border border-white/10 glass-card">
            <Download size={64} className="opacity-20" />
            <div className="text-center">
                <h3 className="text-xl font-bold mb-2">Preview Unavailable</h3>
                <p className="text-muted-foreground mb-8">Download to view <span className="text-foreground">{fileName}</span></p>
                <a href={src} download className="px-8 py-3 bg-purple-600 hover:bg-purple-500 rounded-xl font-medium transition flex items-center gap-2 mx-auto w-fit">
                    <Download size={18} /> Download
                </a>
            </div>
        </div>
    );
}
