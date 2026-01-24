import { useState, useEffect, useCallback } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';

export function useLightbox({ images, currentFolder, onClose, hasMore, loadMore }) {
    const router = useRouter();
    const searchParams = useSearchParams();
    const [selectedImage, setSelectedImage] = useState(null);
    const [direction, setDirection] = useState(0); // -1 for prev, 1 for next

    // Sync from URL on mount
    useEffect(() => {
        const imageParam = searchParams.get('image');
        if (imageParam && !selectedImage && images.length > 0) {
            const found = images.find(img => (typeof img === 'string' ? img : img.name) === imageParam);
            if (found) setSelectedImage(found);
        }
    }, [images, searchParams, selectedImage]);

    // Handle Image Selection & URL Sync
    const selectImage = useCallback((image, dir = 0) => {
        setDirection(dir);
        setSelectedImage(image);

        if (image) {
            const name = typeof image === 'string' ? image : image.name;
            const params = new URLSearchParams(searchParams.toString());
            params.set('image', name);
            window.history.replaceState(null, '', `?${params.toString()}`);
        } else {
            const params = new URLSearchParams(searchParams.toString());
            params.delete('image');
            const newPath = params.toString() ? `/?${params.toString()}` : currentFolder ? `/?io=${currentFolder}` : '/';
            window.history.replaceState(null, '', newPath);
        }
    }, [searchParams, currentFolder]);

    // Navigation
    const currentIndex = selectedImage ? images.indexOf(selectedImage) : -1;
    const canPrev = currentIndex > 0;
    const canNext = currentIndex < images.length - 1 || hasMore;

    const next = useCallback(() => {
        if (currentIndex < images.length - 1) {
            selectImage(images[currentIndex + 1], 1);
        } else if (hasMore && loadMore) {
            loadMore().then(() => {
                // Determine logic if loadMore updates images immediately or requires event
                // This is tricky if loadMore is async and doesn't return the new items directly
            });
        }
    }, [currentIndex, images, hasMore, loadMore, selectImage]);

    const prev = useCallback(() => {
        if (currentIndex > 0) {
            selectImage(images[currentIndex - 1], -1);
        }
    }, [currentIndex, images, selectImage]);

    // Keyboard
    useEffect(() => {
        if (!selectedImage) return;
        const handleKeyDown = (e) => {
            if (e.key === 'ArrowRight') next();
            if (e.key === 'ArrowLeft') prev();
            if (e.key === 'Escape') {
                selectImage(null);
                onClose && onClose();
            }
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [selectedImage, next, prev, selectImage, onClose]);

    // Scroll Lock
    useEffect(() => {
        if (selectedImage) {
            document.body.style.overflow = 'hidden';
        } else {
            document.body.style.overflow = 'unset';
        }
        return () => { document.body.style.overflow = 'unset'; };
    }, [selectedImage]);

    return {
        selectedImage,
        setSelectedImage: (img) => selectImage(img, 0),
        next,
        prev,
        canNext,
        canPrev,
        direction,
        currentIndex,
        close: () => {
            selectImage(null);
            onClose && onClose();
        }
    };
}
