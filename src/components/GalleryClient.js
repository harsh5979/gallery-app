
'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import Link from 'next/link';
import { useSearchParams, useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import Image from 'next/image';
import { Folder, Image as ImageIcon, ArrowLeft, Download, Expand, Loader2 } from 'lucide-react';
import AdminTools from './AdminTools';
import Lightbox from './Lightbox';
import { getGalleryData } from '@/app/actions';

export default function GalleryClient({ initialFolders, initialImages, role }) {
    const searchParams = useSearchParams();
    const router = useRouter();
    const currentFolder = searchParams.get('folder');

    const [images, setImages] = useState(initialImages?.images || []);
    const [folders, setFolders] = useState(initialFolders || []);
    const [hasMore, setHasMore] = useState(initialImages?.hasMore || false);
    const [page, setPage] = useState(1);
    const [loadingMore, setLoadingMore] = useState(false);
    const [selectedImage, setSelectedImage] = useState(null);
    const [isHeaderVisible, setIsHeaderVisible] = useState(true);
    const [lastScrollY, setLastScrollY] = useState(0);

    // Breadcrumb Logic
    const breadcrumbs = currentFolder ? currentFolder.split('/') : [];
    let breadcrumbPath = '';

    const loadMore = useCallback(async () => {
        setLoadingMore(true);
        const nextPage = page + 1;
        const res = await getGalleryData(currentFolder || '', nextPage);

        setImages(prev => {
            const newImages = [...prev, ...res.images];
            // If lightbox is open and we were at the end, the new image to show is the first one from the new batch
            // But we need to check if we are *actually* inside the lightbox and waiting for this.
            // A simple way is to use a ref or just rely on the user clicking next again or auto-advancing.
            // Better UX: if user triggered this via lightbox "next", we should probably auto-select the next image.
            // However, `selectedImage` is state. Updating it here based on `loadingMore` is tricky without extra state.
            return newImages;
        });

        // Auto-advance lightbox if it was open at the last image
        if (selectedImage && images.indexOf(selectedImage) === images.length - 1 && res.images.length > 0) {
            setSelectedImage(res.images[0]);
        }

        setHasMore(res.hasMore);
        setFolders(res.folders);
        setPage(nextPage);
        setLoadingMore(false);
    }, [page, currentFolder, selectedImage, images]);

    // Observer for infinite scroll
    const observer = useRef();
    const lastImageRef = useCallback(node => {
        if (loadingMore) return;
        if (observer.current) observer.current.disconnect();
        observer.current = new IntersectionObserver(entries => {
            if (entries[0].isIntersecting && hasMore) {
                loadMore();
            }
        });
        if (node) observer.current.observe(node);
    }, [loadingMore, hasMore]);

    // Reset when folder changes (handled by key in parent usually, but here just in case)
    useEffect(() => {
        setImages(initialImages?.images || []);
        setFolders(initialFolders || []);
        setHasMore(initialImages?.hasMore || false);
        setPage(1);
    }, [currentFolder, initialImages, initialFolders]);

    useEffect(() => {
        const handleScroll = () => {
            const currentScrollY = window.scrollY;
            if (currentScrollY < lastScrollY || currentScrollY < 10) {
                setIsHeaderVisible(true);
            } else if (currentScrollY > lastScrollY && currentScrollY > 10) {
                setIsHeaderVisible(false);
            }
            setLastScrollY(currentScrollY);
        };
        window.addEventListener('scroll', handleScroll, { passive: true });
        return () => window.removeEventListener('scroll', handleScroll);
    }, [lastScrollY]);


    return (
        <div className="pb-20 pt-0">
            {/* Header / Breadcrumb */}
            <div
                className={`sticky top-16 z-40 bg-black/80 backdrop-blur-md py-4 px-4 -mx-4 mb-4 border-b border-white/10 shadow-lg flex items-center gap-2 flex-wrap transition-transform duration-300 ${isHeaderVisible ? 'translate-y-0' : '-translate-y-[200%]'
                    }`}
            >
                {currentFolder && (
                    <Link href={currentFolder.includes('/') ? `/?folder=${currentFolder.substring(0, currentFolder.lastIndexOf('/'))}` : '/'} className="p-2 rounded-full glass-card hover:bg-white/10 transition">
                        <ArrowLeft size={18} />
                    </Link>
                )}
                <div className="flex items-center gap-2 text-lg md:text-2xl font-bold truncate max-w-full">
                    <Link href="/" className="hover:text-purple-400 transition bg-clip-text text-transparent bg-linear-to-r from-blue-400 to-purple-400 shrink-0">Home</Link>
                    {breadcrumbs.map((crumb, i) => {
                        const pathUntilHere = breadcrumbs.slice(0, i + 1).join('/');
                        const href = `/?folder=${pathUntilHere}`;
                        const isLast = i === breadcrumbs.length - 1;
                        return (
                            <span key={href} className="flex items-center gap-2 overflow-hidden">
                                <span className="text-gray-600 shrink-0">/</span>
                                {isLast ? (
                                    <span className="text-white truncate">{crumb}</span>
                                ) : (
                                    <Link href={href} className="text-gray-400 hover:text-white transition truncate">{crumb}</Link>
                                )}
                            </span>
                        );
                    })}
                </div>
            </div>


            {/* Folder List (Always show if present) */}
            {folders.length > 0 && (
                <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-4 mb-12">
                    {folders.map(folder => {
                        const href = currentFolder ? `/?folder=${currentFolder}/${folder}` : `/?folder=${folder}`;
                        return (
                            <Link
                                key={folder}
                                href={href}
                                className="group relative p-6 rounded-2xl glass-card border border-white/5 hover:border-purple-500/50 transition-all hover:scale-[1.02]"
                            >
                                <div className="flex flex-col items-center gap-3">
                                    <Folder size={48} className="text-purple-400 group-hover:text-purple-300 transition-colors" />
                                    <span className="font-medium text-lg text-gray-200 group-hover:text-white truncate w-full text-center">{folder}</span>
                                </div>
                            </Link>
                        );
                    })}
                </div>
            )}

            {/* Image Grid (Always show if present) */}
            {(images.length > 0 || loadingMore) && (
                <>
                    {/* Standard Grid Layout for L-R order */}
                    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                        {images.map((img, index) => {
                            const isLast = index === images.length - 1;
                            return (
                                <GridItem
                                    key={img + index}
                                    img={img}
                                    index={index}
                                    isLast={isLast}
                                    lastImageRef={lastImageRef}
                                    currentFolder={currentFolder}
                                    setSelectedImage={setSelectedImage}
                                />
                            );
                        })}
                    </div>
                    {loadingMore && <div className="text-center py-4"><Loader2 className="animate-spin inline" /> Loading more...</div>}
                </>
            )}
            {!loadingMore && images.length === 0 && folders.length === 0 && (
                <div className="text-center text-gray-500 py-20">This folder is empty.</div>
            )}

            {/* Lightbox / Modal */}
            <AnimatePresence>
                {selectedImage && (
                    <Lightbox
                        selectedImage={selectedImage}
                        images={images}
                        currentFolder={currentFolder}
                        hasMore={hasMore}
                        loadingMore={loadingMore}
                        onClose={() => setSelectedImage(null)}
                        onNext={() => {
                            const currentIndex = images.indexOf(selectedImage);
                            if (currentIndex < images.length - 1) {
                                setSelectedImage(images[currentIndex + 1]);
                            } else if (hasMore && !loadingMore) {
                                loadMore();
                            }
                        }}
                        onPrev={() => {
                            const currentIndex = images.indexOf(selectedImage);
                            if (currentIndex > 0) {
                                setSelectedImage(images[currentIndex - 1]);
                            }
                        }}
                    />
                )}
            </AnimatePresence>

            {/* Admin Tools */}
            {role === 'admin' && <AdminTools currentFolder={currentFolder} />}
        </div>
    );
}

function GridItem({ img, index, isLast, lastImageRef, currentFolder, setSelectedImage }) {
    const [isLoaded, setIsLoaded] = useState(false);

    // Fix path construction with proper encoding
    const encodedFolder = currentFolder ? currentFolder.split('/').map(p => encodeURIComponent(p)).join('/') : 'root';
    const encodedImg = encodeURIComponent(img);
    const imgSrc = `/api/images/${encodedFolder}/${encodedImg}`;

    const isVideo = /\.(mp4|webm|mov|mkv)$/i.test(img);

    return (
        <motion.div
            ref={isLast ? lastImageRef : null}
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.3 }}
            className="relative group rounded-xl overflow-hidden glass-card aspect-square bg-white/5"
        >
            {!isLoaded && !isVideo && (
                <div className="absolute inset-0 z-10 bg-white/10 animate-pulse" />
            )}

            {isVideo ? (
                <video
                    src={imgSrc}
                    className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110"
                    onClick={() => setSelectedImage(img)}
                    muted
                    loop
                    // onVideoLoadedMetadata could set loaded, but videos usually stream well.
                    // Let's just consider them loaded or add a specific handler if needed.
                    onLoadedData={() => setIsLoaded(true)}
                    onMouseOver={e => e.target.play()}
                    onMouseOut={e => e.target.pause()}
                />
            ) : (
                <Image
                    src={imgSrc}
                    alt={img}
                    fill
                    sizes="(max-width: 768px) 50vw, (max-width: 1200px) 33vw, 25vw"
                    className={`object-cover transition-all duration-500 group-hover:scale-110 ${isLoaded ? 'opacity-100 blur-0' : 'opacity-0 blur-sm'}`}
                    onLoad={() => setIsLoaded(true)}
                    onClick={() => setSelectedImage(img)}
                />
            )}

            {/* Hover Controls */}
            <div
                className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2 cursor-pointer z-20"
                onClick={() => setSelectedImage(img)}
            >
                <button
                    onClick={(e) => { e.stopPropagation(); setSelectedImage(img); }}
                    className="p-2 rounded-full bg-white/20 hover:bg-white/40 text-white backdrop-blur-md transition"
                >
                    <Expand size={20} />
                </button>
                <a
                    href={imgSrc}
                    download
                    className="p-2 rounded-full bg-white/20 hover:bg-white/40 text-white backdrop-blur-md transition"
                    onClick={(e) => e.stopPropagation()}
                >
                    <Download size={20} />
                </a>
            </div>
            {/* Filename Overlay */}
            <div className="absolute bottom-0 left-0 right-0 bg-linear-to-t from-black/80 to-transparent p-2 opacity-0 group-hover:opacity-100 transition-opacity text-xs truncate z-20">
                {img}
            </div>
        </motion.div>
    );
}
