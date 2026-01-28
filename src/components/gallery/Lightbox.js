'use client';

import { motion, AnimatePresence } from 'framer-motion';
import { ArrowLeft, Download, X, Loader2, ZoomIn, ZoomOut, Info } from 'lucide-react';
import { TransformWrapper, TransformComponent } from 'react-zoom-pan-pinch';
import Image from 'next/image';
import { useLightbox } from '@/hooks/useLightbox';
import { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { getImageDetails, getFileContent } from '@/app/actions';
import CodeViewer from './CodeViewer';
import LightboxControls from './LightboxControls';

export default function Lightbox({ selectedImage, images, currentFolder, onClose, onNext, onPrev, hasMore, loadMore, role }) {
    const [loaded, setLoaded] = useState(false);
    const [showInfo, setShowInfo] = useState(false);
    const [headerControls, setHeaderControls] = useState(true);

    // Keyboard Navigation
    useEffect(() => {
        const handleKeyDown = (e) => {
            if (e.key === 'ArrowRight') onNext && onNext();
            if (e.key === 'ArrowLeft') onPrev && onPrev();
            if (e.key === 'Escape') onClose && onClose();
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [onNext, onPrev, onClose]);

    // Scroll Lock
    useEffect(() => {
        document.body.style.overflow = 'hidden';
        return () => { document.body.style.overflow = 'unset'; };
    }, []);

    const imageParam = typeof selectedImage === 'string' ? selectedImage : selectedImage.name;

    // React Query for Metadata
    const { data: metaData } = useQuery({
        queryKey: ['file-meta', currentFolder, imageParam],
        queryFn: () => getImageDetails(currentFolder || '', imageParam),
        enabled: !!selectedImage,
        staleTime: 1000 * 60 * 5, // 5 min cache
    });

    // React Query for Code Content
    const isCodeFile = /\.(js|jsx|ts|tsx|css|html|json|md|txt|py|java|c|cpp|h|go|rs|sql|xml|yaml|yml|log|ini|conf)$/i.test(imageParam);
    const { data: codeContent, isLoading: isCodeLoading } = useQuery({
        queryKey: ['file-content', currentFolder, imageParam],
        queryFn: () => getFileContent(currentFolder || '', imageParam),
        enabled: !!selectedImage && isCodeFile,
        staleTime: 1000 * 60 * 5,
    });

    useEffect(() => {
        setLoaded(false);
        setShowInfo(false);
    }, [selectedImage]); // Only reset UI state, data handled by Query

    if (!selectedImage) return null;

    const encodedFolder = currentFolder ? currentFolder.split('/').map(p => encodeURIComponent(p)).join('/') : 'root';
    const encodedImg = encodeURIComponent(imageParam);
    const src = `/api/images/${encodedFolder}/${encodedImg}`;

    const isVideo = /\.(mp4|webm|mov|mkv)$/i.test(imageParam);
    const isImage = /\.(jpg|jpeg|png|gif|webp|svg|heic|heif|bmp|tiff|tif)$/i.test(imageParam);
    // isCodeFile already computed

    const codeLanguage = imageParam.split('.').pop();
    const imageObj = typeof selectedImage === 'string' ? { name: selectedImage } : selectedImage;

    // Determine direction for animation based on index change? 
    // Simplified: always 0 or just fade. Or we can track prev index. 
    // For now, let's keep it simple with fade or slide.
    const direction = 0;

    const swipeConfidenceThreshold = 10000;
    const swipePower = (offset, velocity) => {
        return Math.abs(offset) * velocity;
    };

    return (
        <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-[100] bg-black/95 backdrop-blur-xl flex items-center justify-center p-4 overflow-hidden"
            onClick={onClose}
        >
            {/* Main Content Area */}
            <div className="relative w-full h-full flex items-center justify-center" onClick={(e) => e.stopPropagation()}>
                <AnimatePresence mode="wait" initial={false}>
                    <motion.div
                        key={imageParam}
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        transition={{ duration: 0.2 }}
                        className="relative w-full h-full flex items-center justify-center touch-none"
                        drag={!isCodeFile && !isVideo && isImage ? "x" : false} // Disable drag for non-images
                        dragConstraints={{ left: 0, right: 0 }}
                        dragElastic={1}
                        onDragEnd={(e, { offset, velocity }) => {
                            const swipe = swipePower(offset.x, velocity.x);

                            if (swipe < -swipeConfidenceThreshold) {
                                // Swipe Left -> Next
                                onNext && onNext();
                            } else if (swipe > swipeConfidenceThreshold) {
                                // Swipe Right -> Prev
                                onPrev && onPrev();
                            }
                        }}
                    >
                        {isCodeFile ? (
                            <div className="relative w-full h-full flex items-center justify-center p-4 z-50">
                                {isCodeLoading ? (
                                    <Loader2 className="animate-spin text-white" size={48} />
                                ) : (
                                    <CodeViewer
                                        content={codeContent}
                                        language={codeLanguage}
                                        filename={imageObj.name}
                                        currentFolder={currentFolder}
                                        // onSave needs to invalidate query or update local cache
                                        onSave={(newContent) => {
                                            // Ideally call mutation. For now manual update?
                                            // The Query data is immutable directly. 
                                            // We rely on revalidate or queryClient.setQueryData if we had access here.
                                            // Simple: just re-fetch or let CodeViewer handle save + we refetch?
                                            // CodeViewer calls server action. We need to update this view?
                                            // Actually CodeViewer manages its own editing state.
                                        }}
                                        isEditable={role === 'admin'}
                                    />
                                )}
                            </div>
                        ) : isVideo ? (
                            <div className="relative w-full h-full flex items-center justify-center">
                                <video src={src} controls autoPlay className="max-w-full max-h-[90vh] rounded-lg shadow-2xl z-20" />
                            </div>
                        ) : isImage ? (
                            <TransformWrapper initialScale={1} minScale={1} maxScale={4} centerOnInit>
                                {!loaded && (
                                    <div className="absolute inset-0 flex items-center justify-center z-10">
                                        <Loader2 size={48} className="animate-spin text-purple-500" />
                                    </div>
                                )}
                                <TransformComponent
                                    wrapperClass="!w-full !h-full flex items-center justify-center"
                                    contentClass="!w-full !h-full flex items-center justify-center relative"
                                >
                                    <div className="relative w-full h-[90vh]">
                                        <Image
                                            key={src}
                                            src={src}
                                            fill
                                            sizes="100vw"
                                            className={`object-contain transition-opacity duration-300 ${loaded ? 'opacity-100' : 'opacity-0'}`}
                                            alt={imageParam}
                                            onLoad={() => setLoaded(true)}
                                            priority
                                        />
                                    </div>
                                </TransformComponent>
                            </TransformWrapper>
                        ) : (
                            // Fallback for non-previewable files (ISO, etc.)
                            <div className="flex flex-col items-center justify-center text-white gap-6 p-8 bg-white/5 rounded-2xl border border-white/10">
                                <Download size={64} className="opacity-50" />
                                <div className="text-center">
                                    <h3 className="text-xl font-bold mb-2">Preview Unavailable</h3>
                                    <p className="text-muted-foreground mb-6">This file type cannot be previewed.</p>
                                    <a
                                        href={src}
                                        download
                                        className="px-6 py-3 bg-purple-600 hover:bg-purple-500 rounded-lg font-medium transition flex items-center gap-2"
                                        onClick={(e) => e.stopPropagation()}
                                    >
                                        <Download size={18} />
                                        Download File
                                    </a>
                                </div>
                            </div>
                        )}
                    </motion.div>
                </AnimatePresence>
            </div>

            {/* Navigation Buttons (Hide if isCode or generic) */}
            {!isCodeFile && isImage && (
                <>
                    <button className="absolute left-4 p-4 rounded-full bg-white/10 hover:bg-white/20 text-white z-50 transition" onClick={(e) => { e.stopPropagation(); onPrev && onPrev(); }}>
                        <ArrowLeft size={32} />
                    </button>
                    <button className="absolute right-4 p-4 rounded-full bg-white/10 hover:bg-white/20 text-white z-50 transition" onClick={(e) => { e.stopPropagation(); onNext && onNext(); }}>
                        <ArrowLeft size={32} className="rotate-180" />
                    </button>
                </>
            )}

            {/* Controls Overlay */}
            <LightboxControls
                showInfo={showInfo}
                setShowInfo={setShowInfo}
                src={src}
                onClose={onClose}
            />

            {/* Info Panel */}
            <AnimatePresence>
                {showInfo && (
                    <motion.div
                        initial={{ y: 20, opacity: 0 }}
                        animate={{ y: 0, opacity: 1 }}
                        exit={{ y: 20, opacity: 0 }}
                        className="absolute bottom-8 left-1/2 -translate-x-1/2 bg-black/80 backdrop-blur-md p-6 rounded-2xl border border-white/10 text-white z-50"
                        onClick={e => e.stopPropagation()}
                    >
                        <h3 className="font-bold mb-2">Details</h3>
                        <div className="grid grid-cols-[80px_1fr] gap-2 text-sm">
                            <span className="text-white/50">Name:</span> <span className="truncate max-w-[200px]">{imageParam}</span>
                            {metaData && (
                                <>
                                    <span className="text-white/50">Details:</span> <span>{new Date(metaData.modified).toLocaleDateString()}</span>
                                </>
                            )}
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>
        </motion.div>
    );
}
