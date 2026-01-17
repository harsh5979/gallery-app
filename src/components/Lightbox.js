'use client';

import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { TransformWrapper, TransformComponent } from 'react-zoom-pan-pinch';
import { ArrowLeft, Download, X, Loader2, ZoomIn, ZoomOut } from 'lucide-react';

export default function Lightbox({ selectedImage, images, currentFolder, onClose, onNext, onPrev, hasMore, loadingMore }) {


    const currentIndex = images.indexOf(selectedImage);
    const canPrev = currentIndex > 0;
    const canNext = currentIndex < images.length - 1 || (hasMore && !loadingMore);
    const isLoadingNext = currentIndex === images.length - 1 && loadingMore;

    // Prevent scrolling when lightbox is open
    useEffect(() => {
        document.body.style.overflow = 'hidden';
        return () => {
            document.body.style.overflow = 'unset';
        };
    }, []);

    // Keyboard Navigation
    useEffect(() => {
        const handleKeyDown = (e) => {
            if (e.key === 'ArrowLeft' && canPrev) onPrev();
            if (e.key === 'ArrowRight' && (canNext || isLoadingNext)) onNext(); // Allow hitting next to trigger load
            if (e.key === 'Escape') onClose();
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [canPrev, canNext, isLoadingNext, onPrev, onNext, onClose]);

    const imageSrc = currentFolder
        ? `/api/images/${currentFolder.split('/').map(p => encodeURIComponent(p)).join('/')}/${encodeURIComponent(selectedImage)}`
        : `/api/images/root/${encodeURIComponent(selectedImage)}`;

    const isVideo = /\.(mp4|webm|mov|mkv)$/i.test(selectedImage);

    // We don't need manual scale state anymore for drag logic, 
    // but we might want it for UI controls visibility.
    // However, simplest integration is to let the library handle it 
    // and just use the render props to access state for UI.
    // To keep it simple and performant, we'll assume buttons are always visible unless we use the render prop.
    // Let's use the render prop pattern.

    // Use a tracker for the currently loaded image to handle switching
    const [loadedImage, setLoadedImage] = useState(null);
    const isImageLoaded = loadedImage === selectedImage;

    return (
        <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-[100] bg-black/95 backdrop-blur-xl flex items-center justify-center p-4 overflow-hidden"
            onClick={onClose}
        >
            {isVideo ? (
                // ... Video Player remains same ...
                <div className="relative w-full h-full flex items-center justify-center" onClick={(e) => e.stopPropagation()}>
                    <video
                        src={imageSrc}
                        className="max-w-full max-h-[90vh] rounded-lg shadow-2xl"
                        controls
                        autoPlay
                    />
                    {/* Controls for video */}
                    <div className="absolute top-0 left-0 right-0 p-6 flex justify-between items-start pointer-events-none z-50">
                        <button
                            className="pointer-events-auto p-4 text-white/50 hover:text-white transition flex items-center gap-2"
                            onClick={(e) => { e.stopPropagation(); onClose(); }}
                        >
                            <X size={24} />
                            <span className="hidden sm:inline">Close (Esc)</span>
                        </button>
                        <a
                            href={imageSrc}
                            download
                            className="pointer-events-auto p-4 rounded-full bg-white/10 hover:bg-white/20 text-white transition"
                            onClick={(e) => e.stopPropagation()}
                        >
                            <Download size={24} />
                        </a>
                    </div>
                </div>
            ) : (
                <TransformWrapper
                    initialScale={1}
                    minScale={1}
                    maxScale={4}
                    centerOnInit
                    wheel={{ step: 0.2 }}
                    doubleClick={{ disabled: true }} // We'll custom handle or let it be. Library default double click zooms.
                >
                    {({ zoomIn, zoomOut, resetTransform, state }) => {
                        const scale = state?.scale ?? 1;
                        return (
                            <>
                                {/* Content */}
                                <div className="relative w-full h-full flex items-center justify-center" onClick={(e) => e.stopPropagation()}>
                                    {!isImageLoaded && (
                                        <div className="absolute inset-0 flex items-center justify-center z-10">
                                            <Loader2 size={48} className="animate-spin text-purple-500" />
                                        </div>
                                    )}
                                    <TransformComponent
                                        wrapperClass="!w-full !h-full flex items-center justify-center"
                                        contentClass="!w-full !h-full flex items-center justify-center"
                                    >
                                        <img
                                            src={imageSrc}
                                            className={`max-w-full max-h-[90vh] rounded-lg shadow-2xl object-contain bg-black/50 transition-opacity duration-300 ${isImageLoaded ? 'opacity-100' : 'opacity-0'}`}
                                            alt={selectedImage}
                                            onLoad={() => setLoadedImage(selectedImage)}
                                        />
                                    </TransformComponent>
                                </div>

                                {/* Previous Button - Hide when zoomed (scale > 1.1 to be safe) */}
                                {canPrev && scale <= 1.1 && (
                                    <button
                                        className="absolute left-4 top-1/2 -translate-y-1/2 p-4 rounded-full bg-white/10 hover:bg-white/20 text-white transition z-50 group"
                                        onClick={(e) => { e.stopPropagation(); onPrev(); }}
                                    >
                                        <ArrowLeft size={32} className="group-hover:-translate-x-1 transition-transform" />
                                    </button>
                                )}

                                {/* Next Button - Hide when zoomed */}
                                {(canNext || isLoadingNext) && scale <= 1.1 && (
                                    <button
                                        className="absolute right-4 top-1/2 -translate-y-1/2 p-4 rounded-full bg-white/10 hover:bg-white/20 text-white transition z-50 group flex items-center justify-center"
                                        onClick={(e) => { e.stopPropagation(); if (!isLoadingNext) onNext(); }}
                                        disabled={isLoadingNext}
                                    >
                                        {isLoadingNext ? (
                                            <Loader2 size={32} className="animate-spin text-purple-400" />
                                        ) : (
                                            <ArrowLeft size={32} className="rotate-180 group-hover:translate-x-1 transition-transform" />
                                        )}
                                    </button>
                                )}

                                {/* Controls */}
                                <div className="absolute top-0 left-0 right-0 p-6 flex justify-between items-start pointer-events-none z-50">
                                    <button
                                        className="pointer-events-auto p-4 text-white/50 hover:text-white transition flex items-center gap-2"
                                        onClick={(e) => { e.stopPropagation(); onClose(); }}
                                    >
                                        <X size={24} />
                                        <span className="hidden sm:inline">Close (Esc)</span>
                                    </button>

                                    <div className="flex gap-4">
                                        <button
                                            className="pointer-events-auto p-4 rounded-full bg-white/10 hover:bg-white/20 text-white transition"
                                            onClick={(e) => { e.stopPropagation(); scale > 1 ? resetTransform() : zoomIn(); }}
                                        >
                                            {scale > 1 ? <ZoomOut size={24} /> : <ZoomIn size={24} />}
                                        </button>

                                        <a
                                            href={imageSrc}
                                            download
                                            className="pointer-events-auto p-4 rounded-full bg-white/10 hover:bg-white/20 text-white transition"
                                            onClick={(e) => e.stopPropagation()}
                                        >
                                            <Download size={24} />
                                        </a>
                                    </div>
                                </div>
                            </>
                        )
                    }}
                </TransformWrapper>
            )}
        </motion.div>
    );
}
