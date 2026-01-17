
import './globals.css';
import { Inter } from 'next/font/google'; // Or Geist as default
import Navbar from '@/components/Navbar'; // I'll create this later or now? I'll inline for now or better create it.
import Link from 'next/link';
import { getSession } from '@/lib/auth';

// I need to define local font or use google font. default was variable.
// I'll stick to default setup or imports from globals.css

export const metadata = {
  title: 'Gallery App',
  description: 'Modern Secure Gallery',
};

export default async function RootLayout({ children }) {
  return (
    <html lang="en" className="dark">
      <body className="bg-black text-white min-h-screen">
        <div className="fixed inset-0 bg-[url('/bg-gradient.svg')] bg-cover opacity-30 -z-10 pointer-events-none" />
        <Navbar />
        <main className="pt-20 px-4 min-h-screen">
          {children}
        </main>
      </body>
    </html>
  );
}
