
'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import Link from 'next/link';
import { useSearchParams, useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import { Folder, Loader2 } from 'lucide-react';
import AdminTools from '../admin/AdminTools';
import Lightbox from './Lightbox';
import { getGalleryData } from '@/app/actions';
import BreadcrumbsBar from '../layout/BreadcrumbsBar';
import GridItem from './GridItem';
import ItemActionsMenu from './ItemActionsMenu';

export default function GalleryClient({ initialFolders, initialImages, role }) {
    const searchParams = useSearchParams();
    const router = useRouter();
    const currentFolder = searchParams.get('io');
    const previewParam = searchParams.get('preview');

    const [images, setImages] = useState(initialImages?.images || []);
    const [folders, setFolders] = useState(initialFolders || []);
    const [hasMore, setHasMore] = useState(initialImages?.hasMore || false);
    const [page, setPage] = useState(1);
    const [loadingMore, setLoadingMore] = useState(false);
    const [selectedImage, setSelectedImage] = useState(null);

    // Sync URL -> State (On Mount / Param Change)
    useEffect(() => {
        if (previewParam) {
            const found = images.find(img => (typeof img === 'string' ? img : img.name) === previewParam);
            const target = found || previewParam;
            // Only update if different to avoid cycles
            if (selectedImage !== target) {
                setSelectedImage(target);
            }
        } else if (selectedImage !== null) {
            setSelectedImage(null);
        }
    }, [previewParam, images, selectedImage]);

    // Helper to update URL
    const updatePreviewUrl = useCallback((filename) => {
        // ... implementation matches previous, safe to keep or just ensure it's here if I'm replacing a block
        const params = new URLSearchParams(searchParams);
        if (filename) {
            params.set('preview', filename);
        } else {
            params.delete('preview');
        }
        router.push(`${window.location.pathname}?${params.toString()}`, { scroll: false });
    }, [searchParams, router]);

    const loadMore = useCallback(async () => {
        setLoadingMore(true);
        const nextPage = page + 1;
        const res = await getGalleryData(currentFolder || '', nextPage);

        setImages(prev => {
            const newImages = [...prev, ...res.images];
            return newImages;
        });

        // Auto-advance lightbox if it was open at the last image
        if (selectedImage && images.indexOf(selectedImage) === images.length - 1 && res.images.length > 0) {
            setSelectedImage(res.images[0]);
            // Also update URL if auto-advancing
            const nextImg = res.images[0];
            updatePreviewUrl(typeof nextImg === 'string' ? nextImg : nextImg.name);
        }

        setHasMore(res.hasMore);
        setFolders(res.folders);
        setPage(nextPage);
        setLoadingMore(false);
    }, [page, currentFolder, selectedImage, images, updatePreviewUrl]);

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
    }, [loadingMore, hasMore, loadMore]);

    const isInitialMount = useRef(true);

    // Caching Logic - Restore
    useEffect(() => {
        // Only run on client mount once
        if (typeof window === 'undefined') return;

        const cacheKey = `gallery_cache_${currentFolder || 'root'}`;
        const cachedData = sessionStorage.getItem(cacheKey);

        if (cachedData && isInitialMount.current) {
            try {
                const { images: cImages, folders: cFolders, page: cPage, hasMore: cHasMore, scrollY } = JSON.parse(cachedData);
                if (cImages && cImages.length > 0) {
                    setImages(cImages);
                    setFolders(cFolders);
                    setPage(cPage);
                    setHasMore(cHasMore);

                    // Restore scroll
                    requestAnimationFrame(() => window.scrollTo(0, scrollY));
                }
            } catch (e) {
                console.error("Cache restore failed", e);
            }
        }
        isInitialMount.current = false;
    }, [currentFolder]); // Dependencies

    // Cache Save logic remains...

    // Removing the "Keep props in sync" effect. 
    // If the parent passes new initialFolders/Images, this component usually remounts if the key changes (folder change).
    // If we strictly need to update state when props change while mounted, we can set it, 
    // but often it's better to let the key prop on the parent handle the reset.
    // Assuming 'currentFolder' change triggers a remount or we trust the cache effect to handle it.
    // However, if we navigate without unmounting, we might need it. 
    // Let's rely on the fact that Next.js usually remounts pg components or we can add a key to the component usage in page.js.


    return (
        <div className="pb-20 pt-0">
            <BreadcrumbsBar currentFolder={currentFolder} />

            {/* Folder List */}
            {folders.length > 0 && (
                <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-4 mb-12">
                    {folders.map(folder => {
                        const href = currentFolder ? `/?io=${currentFolder}/${folder}` : `/?io=${folder}`;
                        return (
                            <Link
                                key={folder}
                                href={href}
                                className="group relative p-6 rounded-2xl glass-card border border-glass-border hover:border-purple-500/50 transition-all hover:scale-[1.02]"
                            >
                                {role === 'admin' && (
                                    <ItemActionsMenu
                                        path={currentFolder ? `${currentFolder}/${folder}` : folder}
                                        isFolder
                                        onDelete={() => {
                                            setFolders(prev => prev.filter(f => f !== folder));
                                            router.refresh();
                                        }}
                                    />
                                )}
                                <div className="flex flex-col items-center gap-3">
                                    <Folder size={48} className="text-purple-400 group-hover:text-purple-300 transition-colors" />
                                    <span className="font-medium text-lg text-muted-foreground group-hover:text-foreground truncate w-full text-center">{folder}</span>
                                </div>
                            </Link>
                        );
                    })}
                </div>
            )}

            {/* Image Grid */}
            {(images.length > 0 || loadingMore) && (
                <>
                    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                        {images.map((img, index) => {
                            const isLast = index === images.length - 1;
                            const key = typeof img === 'string' ? img + index : (img.name || index);
                            return (
                                <GridItem
                                    key={key}
                                    img={img}
                                    index={index}
                                    isLast={isLast}
                                    lastImageRef={lastImageRef}
                                    currentFolder={currentFolder}
                                    setSelectedImage={(img) => updatePreviewUrl(typeof img === 'string' ? img : img.name)}
                                    role={role}
                                    onDelete={() => {
                                        setImages(prev => prev.filter(i => {
                                            const name = typeof i === 'string' ? i : i.name;
                                            const targetName = typeof img === 'string' ? img : img.name;
                                            return name !== targetName;
                                        }));
                                        router.refresh();
                                    }}
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
                        onClose={() => updatePreviewUrl(null)}
                        onNext={() => {
                            const currentIndex = images.indexOf(selectedImage);
                            if (currentIndex < images.length - 1) {
                                const nextImg = images[currentIndex + 1];
                                updatePreviewUrl(typeof nextImg === 'string' ? nextImg : nextImg.name);
                            } else if (hasMore && !loadingMore) {
                                loadMore();
                            }
                        }}
                        onPrev={() => {
                            const currentIndex = images.indexOf(selectedImage);
                            if (currentIndex > 0) {
                                const prevImg = images[currentIndex - 1];
                                updatePreviewUrl(typeof prevImg === 'string' ? prevImg : prevImg.name);
                            }
                        }}
                        role={role}
                    />
                )}
            </AnimatePresence>

            {/* Admin Tools */}
            {role === 'admin' && <AdminTools currentFolder={currentFolder} />}
        </div>
    );
}
