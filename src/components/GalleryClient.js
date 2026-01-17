
'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import Link from 'next/link';
import { useSearchParams, useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import { Folder, Loader2 } from 'lucide-react';
import AdminTools from './AdminTools';
import Lightbox from './Lightbox';
import { getGalleryData } from '@/app/actions';
import BreadcrumbsBar from './BreadcrumbsBar';
import GridItem from './GridItem';
import DeleteConfirmation from './DeleteConfirmation';

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
    }, [loadingMore, hasMore, loadMore]);

    // Sync state with props when router.refresh() updates the data
    useEffect(() => {
        setImages(initialImages?.images || []);
        setFolders(initialFolders || []);
        setHasMore(initialImages?.hasMore || false);
        // We don't reset page here because if we are just refreshing data (e.g. upload), 
        // we might want to stay relatively stable, OR we might want to reset if the dataset changed drastically.
        // For new uploads appearing at the top/end, resetting to page 1 is safest to ensure consistency.
        setPage(1);
    }, [initialImages, initialFolders]);

    return (
        <div className="pb-20 pt-0">
            <BreadcrumbsBar currentFolder={currentFolder} />


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
                                {role === 'admin' && (
                                    <DeleteConfirmation
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
                                    role={role}
                                    onDelete={() => {
                                        setImages(prev => prev.filter(i => i !== img));
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
