import { useMutation, useQueryClient } from '@tanstack/react-query';
import { deleteItem, createNewFolder } from '@/app/actions';

/**
 * useGalleryMutations - Unified Hook for Gallery State Mutations
 * 
 * Handles optimistic updates and cache invalidation for file operations.
 * Centralizing this ensures that Socket-triggered updates and manual mutations
 * follow the same cache consistency rules.
 */
export function useGalleryMutations(currentFolder) {
    const queryClient = useQueryClient();
    const queryKey = ['gallery', currentFolder || 'root'];

    /**
     * Delete Mutation
     * Uses Optimistic Updates to instantly remove the item from UI while waiting for server.
     */
    const deleteMutation = useMutation({
        mutationFn: async (path) => {
            const res = await deleteItem(path);
            if (res.error) throw new Error(res.error);
            return path;
        },
        onMutate: async (deletedPath) => {
            // Cancel outgoing refetches to prevent race conditions
            await queryClient.cancelQueries({ queryKey });

            // Snapshot the previous state for rollback on error
            const previousData = queryClient.getQueryData(queryKey);

            // Optimistically update the cache
            queryClient.setQueryData(queryKey, (oldData) => {
                if (!oldData) return oldData;

                const newPages = oldData.pages.map(page => ({
                    ...page,
                    images: page.images.filter(img => {
                        const name = typeof img === 'string' ? img : img.name;
                        const myPath = currentFolder ? `${currentFolder}/${name}` : name;
                        return myPath !== deletedPath;
                    }),
                    folders: page.folders.filter(f => {
                        const myPath = currentFolder ? `${currentFolder}/${f}` : f;
                        return myPath !== deletedPath;
                    })
                }));

                return { ...oldData, pages: newPages };
            });

            return { previousData };
        },
        onError: (err, _, context) => {
            // Rollback on failure
            queryClient.setQueryData(queryKey, context.previousData);
            alert(`Delete failed: ${err.message}`);
        },
        onSettled: () => {
            // Always refetch to sync with server truth
            queryClient.invalidateQueries({ queryKey });
        },
    });

    /**
     * Create Folder Mutation
     */
    const createFolderMutation = useMutation({
        mutationFn: async (formData) => {
            const res = await createNewFolder(formData);
            if (res.error) throw new Error(res.error);
            return res;
        },
        onSettled: () => {
            queryClient.invalidateQueries({ queryKey });
        },
    });

    /**
     * Upload Mutation Wrapper
     * This wraps the batch upload process from AdminTools to trigger a refresh on completion.
     */
    const uploadMutation = useMutation({
        mutationFn: async ({ processBatch }) => {
            await processBatch();
        },
        onSettled: () => {
            queryClient.invalidateQueries({ queryKey });
        },
    });

    return {
        deleteItem: deleteMutation,
        createFolder: createFolderMutation,
        handleUpload: uploadMutation,
    };
}
