
import { getSession } from '@/lib/auth';
import { getGalleryData } from '@/app/actions';
import GalleryClient from '@/components/gallery/GalleryClient';
import SmartNavbar from '@/components/layout/SmartNavbar';
import BreadcrumbsBar from '@/components/layout/BreadcrumbsBar';

import { Lock } from 'lucide-react';
import Link from 'next/link';
import AccessRestricted from '@/components/errors/AccessRestricted';

export default async function Home({ searchParams }) {
  const session = await getSession();
  const { io: folder } = await searchParams; // Wait for searchParams

  let folders = [];
  let imagesData = { images: [], hasMore: false };
  let error = null;

  try {
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
  } catch (e) {
    error = e.message;
  }

  if (error) {
    return <AccessRestricted error={error} />;
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
