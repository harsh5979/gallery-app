
'use client';

import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { useInfiniteQuery, useQueryClient } from '@tanstack/react-query';
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
import AccessRestricted from '../errors/AccessRestricted';

export default function GalleryClient({ initialFolders, initialImages, role }) {
    const searchParams = useSearchParams();
    const router = useRouter();
    const currentFolder = searchParams.get('io');

    // Local state for preview to avoid RSC requests on URL change
    const [selectedFilename, setSelectedFilename] = useState(searchParams.get('preview'));

    // Handle Browser Back/Forward
    useEffect(() => {
        const onPopState = () => {
            const params = new URLSearchParams(window.location.search);
            setSelectedFilename(params.get('preview'));
        };
        window.addEventListener('popstate', onPopState);
        return () => window.removeEventListener('popstate', onPopState);
    }, []);

    // Sync if router pushes new params internally (edge case safety)
    useEffect(() => {
        const p = searchParams.get('preview');
        if (p !== selectedFilename) {
            setSelectedFilename(p);
        }
    }, [searchParams]);

    // 1. Setup Infinite Query
    const {
        data,
        fetchNextPage,
        hasNextPage,
        isFetchingNextPage,
        status,
        refetch
    } = useInfiniteQuery({
        queryKey: ['gallery', currentFolder || 'root'],
        queryFn: async ({ pageParam = 1 }) => {
            const res = await getGalleryData(currentFolder || '', pageParam);
            return res;
        },
        getNextPageParam: (lastPage, allPages) => {
            return lastPage.hasMore ? allPages.length + 1 : undefined;
        },
        initialData: () => {
            // Only use initial data if it matches the current folder (mostly for first server render)
            // But since this component is remounted/reset when folder changes (key in page.js),
            // we can trust initialImages mostly.
            if (initialImages) {
                return {
                    pages: [initialImages],
                    pageParams: [1],
                };
            }
        },
    });

    // 2. Derive state from query data
    const folders = useMemo(() => data?.pages[0]?.folders || initialFolders || [], [data, initialFolders]);
    const images = useMemo(() => data?.pages.flatMap(page => page.images) || [], [data]);

    // 3. Derive selected image from local state
    const selectedImage = useMemo(() => {
        if (!selectedFilename) return null;
        const found = images.find(img => (typeof img === 'string' ? img : img.name) === selectedFilename);
        return found || selectedFilename;
    }, [selectedFilename, images]);

    // Helper to update URL without RSC trigger (Shallow)
    const updatePreviewUrl = useCallback((filename) => {
        const params = new URLSearchParams(window.location.search);
        if (filename) {
            params.set('preview', filename);
        } else {
            params.delete('preview');
        }

        const newUrl = `${window.location.pathname}?${params.toString()}`;
        window.history.pushState(null, '', newUrl);
        setSelectedFilename(filename);
    }, []);

    // Observer for infinite scroll
    const observer = useRef();
    const lastImageRef = useCallback(node => {
        if (isFetchingNextPage) return;
        if (observer.current) observer.current.disconnect();
        observer.current = new IntersectionObserver(entries => {
            if (entries[0].isIntersecting && hasNextPage) {
                fetchNextPage();
            }
        });
        if (node) observer.current.observe(node);
    }, [isFetchingNextPage, hasNextPage, fetchNextPage]);

    // Optimistic updates could be done via queryClient, but for now we rely on refetch/invalidation
    // when deleting items. 
    // Ideally, pass an onDelete handler that calls queryClient.setQueryData to remove item locally.

    // Handle Access Error (e.g. after immediate revocation and refetch)
    if (status === 'error') {
        return <AccessRestricted error="Access Revoked" />;
    }

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
                                        onDelete={async () => {
                                            // Ideally we invalidate query here
                                            // But for now router.refresh() + refetch()
                                            await refetch();
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
            {(images.length > 0 || isFetchingNextPage) && (
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
                                    onDelete={async () => {
                                        // Refetch to ensure sync
                                        await refetch();
                                        router.refresh();
                                    }}
                                />
                            );
                        })}
                    </div>
                    {isFetchingNextPage && <div className="text-center py-4"><Loader2 className="animate-spin inline" /> Loading more...</div>}
                </>
            )}
            {!isFetchingNextPage && images.length === 0 && folders.length === 0 && (
                <div className="text-center text-gray-500 py-20">This folder is empty.</div>
            )}

            {/* Lightbox / Modal */}
            <AnimatePresence>
                {selectedImage && (
                    <Lightbox
                        selectedImage={selectedImage}
                        images={images}
                        currentFolder={currentFolder}
                        hasMore={hasNextPage}
                        loadingMore={isFetchingNextPage}
                        onClose={() => updatePreviewUrl(null)}
                        onNext={() => {
                            const currentIndex = images.indexOf(selectedImage);
                            if (currentIndex < images.length - 1) {
                                const nextImg = images[currentIndex + 1];
                                updatePreviewUrl(typeof nextImg === 'string' ? nextImg : nextImg.name);
                            } else if (hasNextPage && !isFetchingNextPage) {
                                fetchNextPage();
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
