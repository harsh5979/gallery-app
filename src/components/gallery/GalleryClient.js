
'use client';

import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { useInfiniteQuery, useQueryClient } from '@tanstack/react-query';
import Link from 'next/link';
import { useSearchParams, useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import { Folder, Loader2, Globe, Lock } from 'lucide-react';
import AdminTools from '../admin/AdminTools';
import Lightbox from './Lightbox';
import { getGalleryData } from '@/app/actions';
import { useSocket } from '@/providers/SocketProvider';
import BreadcrumbsBar from '../layout/BreadcrumbsBar';
import GridItem from './GridItem';
import ItemActionsMenu from './ItemActionsMenu';
import AccessRestricted from '../errors/AccessRestricted';

export default function GalleryClient({ initialFolders, initialImages, role }) {
    const socket = useSocket();
    const queryClient = useQueryClient();
    const searchParams = useSearchParams();
    const router = useRouter();
    const currentFolder = useMemo(() => {
        const io = searchParams.get('io');
        if (!io) return '';
        return io.replace(/\\/g, '/').replace(/^\/+|\/+$/g, '');
    }, [searchParams]);

    // Local state for preview to avoid RSC requests on URL change
    const [selectedFilename, setSelectedFilename] = useState(searchParams.get('preview'));

    // 1. Setup Infinite Query
    const query = useInfiniteQuery({
        queryKey: ['gallery', currentFolder || 'root'],
        queryFn: async ({ pageParam = 1 }) => {
            const res = await getGalleryData(currentFolder || '', pageParam);
            return res;
        },
        getNextPageParam: (lastPage, allPages) => {
            return lastPage.hasMore ? allPages.length + 1 : undefined;
        },
        initialData: () => {
            if (initialImages) {
                return {
                    pages: [initialImages],
                    pageParams: [1],
                };
            }
        },
    });

    const {
        data,
        fetchNextPage,
        hasNextPage,
        isFetchingNextPage,
        status,
        refetch
    } = query;

    // Real-time updates via socket
    useEffect(() => {
        if (!socket) return;
        const onRefresh = () => {
            console.log("Real-time refresh triggered");
            refetch();
        };
        socket.on('gallery:refresh', onRefresh);
        return () => socket.off('gallery:refresh', onRefresh);
    }, [socket, refetch]);

    // Handle Browser Back/Forward
    useEffect(() => {
        const onPopState = () => {
            const params = new URLSearchParams(window.location.search);
            setSelectedFilename(params.get('preview'));
        };
        window.addEventListener('popstate', onPopState);
        return () => window.removeEventListener('popstate', onPopState);
    }, []);

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

    // Observer for infinite scroll: Triggers NEXT page load BEFORE user reaches bottom (Prefetching)
    const observer = useRef();
    const lastImageRef = useCallback(node => {
        if (isFetchingNextPage) return;
        if (observer.current) observer.current.disconnect();

        // rootMargin '600px' means start loading 600px before the last item enters view
        observer.current = new IntersectionObserver(entries => {
            if (entries[0].isIntersecting && hasNextPage) {
                fetchNextPage();
            }
        }, { rootMargin: '600px' });

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
                        const name = typeof folder === 'string' ? folder : folder.name;
                        const relPath = typeof folder === 'string' ? (currentFolder ? `${currentFolder}/${folder}` : folder) : folder.path;
                        const isPublic = typeof folder === 'string' ? null : folder.isPublic;

                        const href = `/?io=${relPath}`;

                        return (
                            <div key={relPath} className="relative group">
                                <Link
                                    href={href}
                                    className="flex flex-col items-center gap-3 p-6 rounded-2xl glass-card border border-glass-border hover:border-purple-500/50 transition-all hover:scale-[1.02] h-full"
                                >
                                    <div className="relative">
                                        <Folder size={48} className="text-purple-400 group-hover:text-purple-300 transition-colors" />
                                        {/* Status Icon at bottom of card */}
                                        <div className="absolute -bottom-1 -right-1 bg-black/40 backdrop-blur-md p-1 rounded-full border border-white/10">
                                            {isPublic ? <Globe size={12} className="text-green-400" title="Public" /> : <Lock size={12} className="text-yellow-500" title="Private" />}
                                        </div>
                                    </div>
                                    <span className="font-medium text-lg text-muted-foreground group-hover:text-foreground truncate w-full text-center">{name}</span>

                                    {/* Small indicator text at bottom */}
                                    <span className={`text-[10px] uppercase tracking-widest font-bold ${isPublic ? 'text-green-500/70' : 'text-yellow-500/70'}`}>
                                        {isPublic ? 'Public' : 'Private'}
                                    </span>
                                </Link>

                                {role === 'admin' && (
                                    <div className="absolute top-2 right-2 z-10">
                                        <ItemActionsMenu
                                            path={relPath}
                                            isFolder
                                            isPublic={isPublic}
                                            onDelete={async () => {
                                                await refetch();
                                                router.refresh();
                                            }}
                                        />
                                    </div>
                                )}
                            </div>
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
