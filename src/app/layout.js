
import './globals.css';
import { Inter } from 'next/font/google'; // Or Geist as default
import Navbar from '@/components/layout/Navbar'; // I'll create this later or now? I'll inline for now or better create it.
import Link from 'next/link';
import { getSession } from '@/lib/auth';
import Providers from './providers';
import SocketProviderWrapper from '@/components/auth/SocketProviderWrapper';

// I need to define local font or use google font. default was variable.
// I'll stick to default setup or imports from globals.css

export const metadata = {
  title: {
    default: 'Gallery ✨',
    template: '%s | Gallery ✨'
  },
  description: 'A high-performance, secure, and aesthetic file manager and media gallery application built with Next.js.',
  keywords: ['gallery', 'file manager', 'media viewer', 'secure storage', 'nextjs', 'react', 'glassmorphism'],
  authors: [{ name: 'iomd team', url: 'https://github.com/harsh5979' }], // Optional URL
  creator: 'Harsh Prajapati',
  openGraph: {
    type: 'website',
    locale: 'en_US',
    title: 'Gallery ✨ - Modern Media Manager',
    description: 'Securely manage and view your photos, videos, and code with a beautiful glassmorphism interface.',
    siteName: 'Gallery ✨',
    images: [
      {
        url: '/icon.svg',
        width: 800,
        height: 600,
        alt: 'Gallery App Logo',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Gallery ✨',
    description: 'Modern Secure Gallery & File Manager',
    images: ['/icon.svg'],
  },
  icons: {
    icon: '/icon.svg',
    shortcut: '/icon.svg',
    apple: '/icon.svg',
  },
};

export default async function RootLayout({ children }) {
  const session = await getSession();

  return (
    <html lang="en" className="dark">
      <body className="min-h-screen">
        <div className="fixed inset-0 bg-[url('/bg-gradient.svg')] bg-cover opacity-30 -z-10 pointer-events-none" />
        <Providers>
          <SocketProviderWrapper session={session}>
            <Navbar />
            <main className="px-4 min-h-screen">
              {children}
            </main>
          </SocketProviderWrapper>
        </Providers>
      </body>
    </html>
  );
}
