import { useMutation, useQueryClient } from '@tanstack/react-query';
import { deleteItem, createNewFolder, uploadChunk, uploadImage } from '@/app/actions';

export function useGalleryMutations(currentFolder) {
    const queryClient = useQueryClient();
    const queryKey = ['gallery', currentFolder || 'root'];

    // --- Delete Mutation ---
    const deleteMutation = useMutation({
        mutationFn: async (path) => {
            const res = await deleteItem(path);
            if (res.error) throw new Error(res.error);
            return path;
        },
        onMutate: async (deletedPath) => {
            // Cancel any outgoing refetches so they don't overwrite our optimistic update
            await queryClient.cancelQueries({ queryKey });

            // Snapshot the previous value
            const previousData = queryClient.getQueryData(queryKey);

            // Optimistically update to the new value
            queryClient.setQueryData(queryKey, (oldData) => {
                if (!oldData) return oldData;

                // Handle Infinite Query Structure (oldData.pages)
                const newPages = oldData.pages.map(page => ({
                    ...page,
                    images: page.images.filter(img => {
                        const name = typeof img === 'string' ? img : img.name;
                        const fullPath = currentFolder ? `${currentFolder}/${name}` : name;
                        // Simple check: if path ends with name (exact match logic tricky without full objects, but standard here)
                        // Actually, 'deletedPath' is like "folder/image.jpg"
                        // Our images array just has "image.jpg" or object.

                        // Let's assume input path is fully qualified.
                        // We need to match it against current folder + image name.
                        const myPath = currentFolder ? `${currentFolder}/${name}` : name;
                        return myPath !== deletedPath;
                    }),
                    folders: page.folders.filter(f => {
                        const myPath = currentFolder ? `${currentFolder}/${f}` : f;
                        return myPath !== deletedPath;
                    })
                }));

                return {
                    ...oldData,
                    pages: newPages,
                };
            });

            // Return a context object with the snapshotted value
            return { previousData };
        },
        onError: (err, newTodo, context) => {
            queryClient.setQueryData(queryKey, context.previousData);
            alert(`Failed to delete: ${err.message}`);
        },
        onSettled: () => {
            queryClient.invalidateQueries({ queryKey });
        },
    });

    // --- Create Folder Mutation ---
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

    // --- Upload Mutation ---
    // This is a "wrapper" mutation. The actual complex progress logic stays in component for now
    // or we can move it here if we want to be very functional, but `AdminTools` has heavy UI state.
    // We'll expose a mutation that handles the *invalidation*.
    const uploadMutation = useMutation({
        mutationFn: async ({ processBatch }) => {
            // processBatch is a function passed from component that does the work
            await processBatch();
        },
        onSettled: () => {
            queryClient.invalidateQueries({ queryKey });
        },
    });

    return {
        deleteItem: deleteMutation,
        createFolder: createFolderMutation,
        handleUpload: uploadMutation, // Use this to wrap the batch process
    };
}
