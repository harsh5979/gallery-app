
import { getSession } from '@/lib/auth';
import { getGalleryData } from '@/app/actions';
import GalleryClient from '@/components/GalleryClient';

export default async function Home({ searchParams }) {
  const session = await getSession();
  const { folder } = await searchParams; // Await searchParams in Next 15+

  // Fetch data based on view
  let folders = [];
  let imagesData = { images: [], hasMore: false };

  if (!folder) {
    // Root view
    const data = await getGalleryData('', 1);
    folders = data.folders;
    imagesData = data;
  } else {
    // Nested view
    const data = await getGalleryData(folder, 1);
    folders = data.folders;
    imagesData = data;
  }

  return (
    <GalleryClient
      key={folder || 'home'} // Force reset state when folder changes
      initialFolders={folders}
      initialImages={imagesData}
      role={session?.role} // Pass role to client to conditionally show admin tools
    />
  );
}
