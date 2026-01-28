
'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Users, FolderLock, Shield, LayoutDashboard, Home } from 'lucide-react';

export default function AdminLayout({ children }) {
    const pathname = usePathname();

    const NavItem = ({ href, icon: Icon, label }) => {
        const isActive = pathname === href;
        return (
            <Link
                href={href}
                className={`flex items-center gap-3 px-4 py-3 rounded-xl transition-all ${isActive
                    ? 'bg-purple-600 text-white shadow-lg shadow-purple-500/20'
                    : 'text-muted-foreground hover:bg-white/5 hover:text-foreground'
                    }`}
            >
                <Icon size={20} />
                <span className="font-medium">{label}</span>
            </Link>
        );
    };

    return (
        <div className="flex min-h-screen pt-20 pb-10 container mx-auto gap-8">
            {/* Sidebar */}
            <aside className="w-64 shrink-0 hidden md:block">
                <div className="sticky top-24 space-y-2">
                    <div className="px-4 py-2 mb-4">
                        <h2 className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Admin Console</h2>
                    </div>

                    <NavItem href="/admin" icon={LayoutDashboard} label="Overview" />
                    <NavItem href="/admin/users" icon={Users} label="Users" />
                    <NavItem href="/admin/groups" icon={Shield} label="Groups" />
                    <NavItem href="/admin/permissions" icon={FolderLock} label="Permissions" />

                    <div className="h-px bg-white/5 my-4 mx-4" />

                    <NavItem href="/" icon={Home} label="Back to Gallery" />
                </div>
            </aside>

            {/* Main Content */}
            <main className="flex-1 min-w-0">
                <div className="glass-card rounded-2xl border border-glass-border p-8 min-h-[600px]">
                    {children}
                </div>
            </main>
        </div>
    );
}
