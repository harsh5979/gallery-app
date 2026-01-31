'use client';

import { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
    getAllFolders,
    getFolderPermissions,
    setPermission,
    getUsers,
    getGroups,
    bulkToggleFoldersPublic,
    updateFolderAccess
} from '@/app/adminActions';
import {
    FolderLock, Globe, Lock, Shield, ChevronRight, User,
    Users as UsersIcon, Plus, X, RefreshCw, Search,
    CheckSquare, Square, CheckCircle2, MoreVertical, Share2, Loader2
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import ConfirmDialog from '@/components/ui/ConfirmDialog';
import ClientPortal from '@/components/ui/ClientPortal';

/**
 * PermissionsClient - Interactive UI for Permission Management
 * Uses TanStack Query for caching and real-time state management.
 */
export default function PermissionsClient({ initialFolders = [], initialUsers = [], initialGroups = [] }) {
    const queryClient = useQueryClient();

    // 1. Core Data Queries
    const { data: folders = initialFolders, isLoading: isFoldersLoading, refetch: refetchFolders } = useQuery({
        queryKey: ['admin:folders'],
        queryFn: async () => {
            const res = await getAllFolders();
            if (!res.success) throw new Error(res.error);
            return res.data;
        },
        initialData: initialFolders,
    });

    const { data: users = initialUsers } = useQuery({
        queryKey: ['admin:users'],
        queryFn: async () => {
            const res = await getUsers();
            if (!res.success) throw new Error(res.error);
            return res.data;
        },
        initialData: initialUsers,
    });

    const { data: groups = initialGroups } = useQuery({
        queryKey: ['admin:groups'],
        queryFn: async () => {
            const res = await getGroups();
            if (!res.success) throw new Error(res.error);
            return res.data;
        },
        initialData: initialGroups,
    });

    // 2. Local State
    const [selectedFolderId, setSelectedFolderId] = useState(null);
    const [searchTerm, setSearchTerm] = useState('');
    const [selectedIds, setSelectedIds] = useState([]);
    const [expandedFolders, setExpandedFolders] = useState({});
    const [isRecursive, setIsRecursive] = useState(false);
    const [isAddOpen, setIsAddOpen] = useState(false);
    const [addType, setAddType] = useState('user');
    const [addTarget, setAddTarget] = useState('');
    const [addAccess, setAddAccess] = useState('read');
    const [actionLoading, setActionLoading] = useState(false);

    // Derived State: Current Selected Folder
    const selectedFolder = useMemo(() =>
        folders.find(f => f._id === selectedFolderId),
        [folders, selectedFolderId]);

    // Query for Permissions of selected folder
    const { data: permissions = [] } = useQuery({
        queryKey: ['admin:permissions', selectedFolderId],
        queryFn: async () => {
            if (!selectedFolderId) return [];
            const res = await getFolderPermissions(selectedFolderId);
            if (!res.success) throw new Error(res.error);
            return res.data;
        },
        enabled: !!selectedFolderId,
    });

    // 3. Confirm Dialog Logic
    const [confirm, setConfirm] = useState({
        isOpen: false, title: "", message: "", onConfirm: () => { }, type: "danger"
    });
    const closeConfirm = () => setConfirm(prev => ({ ...prev, isOpen: false }));

    // 4. Mutations & Handlers
    const invalidateGallery = () => {
        queryClient.invalidateQueries({ queryKey: ['admin:folders'] });
        queryClient.invalidateQueries({ queryKey: ['admin:permissions', selectedFolderId] });
    };

    const handleTogglePublic = async (newValue) => {
        const isPublic = newValue === 'public';
        setConfirm({
            isOpen: true,
            title: `Make folder ${isPublic ? 'Public' : 'Private'}?`,
            message: isRecursive ? "Recursive update will affect all children." : "Only this folder will be affected.",
            type: isPublic ? "primary" : "danger",
            onConfirm: async () => {
                setActionLoading(true);
                const res = await updateFolderAccess(selectedFolder._id, isPublic, selectedFolder.allowedUsers || [], isRecursive);
                if (res.success) {
                    invalidateGallery();
                    closeConfirm();
                } else alert(res.error);
                setActionLoading(false);
            }
        });
    };

    const handleShareUser = async (userId) => {
        if (!selectedFolder || (selectedFolder.allowedUsers || []).includes(userId)) return;
        setActionLoading(true);
        const nextAllowed = [...(selectedFolder.allowedUsers || []), userId];
        const res = await updateFolderAccess(selectedFolder._id, selectedFolder.isPublic, nextAllowed, isRecursive);
        if (res.success) invalidateGallery();
        setActionLoading(false);
    };

    const handleRemoveSharedUser = async (userId) => {
        if (!selectedFolder) return;
        setActionLoading(true);
        const nextAllowed = (selectedFolder.allowedUsers || []).filter(id => id !== userId);
        const res = await updateFolderAccess(selectedFolder._id, selectedFolder.isPublic, nextAllowed, isRecursive);
        if (res.success) invalidateGallery();
        setActionLoading(false);
    };

    const handleBulkTogglePublic = async (isPublic) => {
        if (selectedIds.length === 0) return;
        setConfirm({
            isOpen: true,
            title: `Update ${selectedIds.length} Folders`,
            message: `Set to ${isPublic ? 'PUBLIC' : 'PRIVATE'}?`,
            type: isPublic ? "primary" : "danger",
            onConfirm: async () => {
                closeConfirm();
                setActionLoading(true);
                const res = await bulkToggleFoldersPublic(selectedIds, isPublic, isRecursive);
                if (res.success) {
                    invalidateGallery();
                    setSelectedIds([]);
                } else alert(res.error);
                setActionLoading(false);
            }
        });
    };

    // 5. Derived Filtered View
    const filteredFolders = useMemo(() => {
        if (!searchTerm) return folders;
        const low = searchTerm.toLowerCase();
        return folders.filter(f => f.name.toLowerCase().includes(low) || f.path.toLowerCase().includes(low));
    }, [folders, searchTerm]);

    const folderTree = useMemo(() => {
        const root = [];
        const map = {};
        [...folders].sort((a, b) => a.path.length - b.path.length).forEach(f => {
            map[f.path] = { ...f, children: [] };
            const parts = f.path.split('/');
            if (parts.length === 1) root.push(map[f.path]);
            else {
                const parentPath = parts.slice(0, -1).join('/');
                if (map[parentPath]) map[parentPath].children.push(map[f.path]);
                else root.push(map[f.path]);
            }
        });
        return root;
    }, [folders]);

    // 6. Components
    const FolderItem = ({ folder, level = 0 }) => {
        const isExpanded = expandedFolders[folder.path];
        const hasChildren = folder.children && folder.children.length > 0;
        const isSelected = selectedFolderId === folder._id;

        return (
            <div className="flex flex-col">
                <div onClick={() => setSelectedFolderId(folder._id)} className={`group flex items-center justify-between p-3 rounded-xl cursor-pointer transition-all duration-200 ${isSelected ? 'bg-purple-600 text-white' : 'hover:bg-white/5 text-muted-foreground hover:text-foreground'}`} style={{ marginLeft: `${level * 24}px` }}>
                    <div className="flex items-center gap-3 min-w-0 flex-1">
                        <div onClick={(e) => { e.stopPropagation(); setExpandedFolders(prev => ({ ...prev, [folder.path]: !prev[folder.path] })); }} className={`p-1 hover:bg-white/10 rounded-lg transition-transform ${isExpanded ? 'rotate-90' : ''} ${!hasChildren ? 'opacity-0' : ''}`}><ChevronRight size={14} /></div>
                        <div onClick={(e) => { e.stopPropagation(); setSelectedIds(prev => prev.includes(folder._id) ? prev.filter(i => i !== folder._id) : [...prev, folder._id]); }} className="p-1 rounded-lg">
                            {selectedIds.includes(folder._id) ? <CheckSquare size={16} className="text-purple-400" /> : <Square size={16} className="opacity-0 group-hover:opacity-100" />}
                        </div>
                        {folder.isPublic ? <Globe size={16} className="text-green-400" /> : <Lock size={16} className="text-yellow-500" />}
                        <span className="font-medium truncate text-sm">{folder.name}</span>
                    </div>
                </div>
                <AnimatePresence>{isExpanded && hasChildren && (<motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden">{folder.children.map(child => <FolderItem key={child._id} folder={child} level={level + 1} />)}</motion.div>)}</AnimatePresence>
            </div>
        );
    };

    return (
        <div className="flex flex-col lg:flex-row h-auto lg:h-[calc(100vh-140px)] gap-6 antialiased">
            {/* Sidebar */}
            <div className="w-full lg:w-96 glass-card rounded-2xl flex flex-col overflow-hidden border border-white/10 shrink-0">
                <div className="p-4 border-b border-white/10 bg-white/5 flex justify-between items-center text-sm font-bold">
                    <span className="flex items-center gap-2"><FolderLock size={20} className="text-purple-400" /> Folders</span>
                    <button onClick={refetchFolders} className="p-1.5 hover:bg-white/10 rounded-lg text-muted-foreground"><RefreshCw size={14} className={isFoldersLoading ? "animate-spin" : ""} /></button>
                </div>
                <div className="p-3 bg-black/20 flex gap-2"><Search size={14} className="text-muted-foreground/50" /><input type="text" placeholder="Search..." className="bg-transparent text-sm w-full outline-none" value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} /></div>
                <div className="flex-1 overflow-y-auto p-2 custom-scrollbar">
                    {searchTerm ? filteredFolders.map(f => (
                        <div key={f._id} onClick={() => setSelectedFolderId(f._id)} className={`group flex items-center justify-between p-2.5 rounded-xl cursor-pointer ${selectedFolderId === f._id ? 'bg-purple-600 text-white' : 'hover:bg-white/5 opacity-80'}`}>
                            <div className="flex items-center gap-3 truncate text-sm"><Globe size={16} className={f.isPublic ? 'text-green-400' : 'text-yellow-500'} /> {f.name}</div>
                        </div>
                    )) : folderTree.map(f => <FolderItem key={f._id} folder={f} />)}
                </div>
            </div>

            {/* Main Content */}
            <div className="flex-1 glass-card rounded-2xl flex flex-col border border-white/10 overflow-hidden relative">
                {!selectedFolder ? (
                    <div className="flex-1 flex flex-col items-center justify-center opacity-20"><FolderLock size={64} /><p className="mt-4 font-bold uppercase tracking-widest text-xs">Select a folder to manage</p></div>
                ) : (
                    <>
                        <div className="p-8 border-b border-white/10 bg-white/5 flex flex-wrap justify-between items-center gap-6">
                            <div className="flex items-center gap-4">
                                <div className={`p-4 rounded-3xl border ${selectedFolder.isPublic ? 'border-green-500/20 bg-green-500/10 text-green-400' : 'border-yellow-500/20 bg-yellow-500/10 text-yellow-500'}`}>{selectedFolder.isPublic ? <Globe size={32} /> : <Lock size={32} />}</div>
                                <div><h2 className="text-2xl font-black tracking-tighter">{selectedFolder.name}</h2><p className="text-[10px] font-mono opacity-40">{selectedFolder.path}</p></div>
                            </div>
                            <div className="flex items-center gap-4">
                                <select value={selectedFolder.isPublic ? 'public' : 'private'} onChange={(e) => handleTogglePublic(e.target.value)} className="bg-white/5 border border-white/10 rounded-xl px-4 py-2 font-bold text-xs uppercase transition-all tracking-widest cursor-pointer outline-none">
                                    <option value="public" className="bg-zinc-900">Public</option>
                                    <option value="private" className="bg-zinc-900">Private</option>
                                </select>
                                <label className="flex items-center gap-3 px-4 py-2 bg-white/5 border border-white/10 rounded-xl cursor-pointer hover:bg-white/10 transition-all select-none group">
                                    <input type="checkbox" className="hidden" checked={isRecursive} onChange={e => setIsRecursive(e.target.checked)} />
                                    <div className={`w-4 h-4 border-2 rounded-md transition-all ${isRecursive ? 'bg-purple-600 border-purple-500' : 'border-white/20'}`}>{isRecursive && <CheckCircle2 size={12} className="text-white" />}</div>
                                    <span className="text-[10px] font-black uppercase text-muted-foreground group-hover:text-white">Recursive</span>
                                </label>
                            </div>
                        </div>

                        <div className="flex-1 overflow-y-auto p-8 custom-scrollbar space-y-12">
                            <section>
                                <div className="flex justify-between items-center mb-6">
                                    <h3 className="text-xs font-black uppercase tracking-[0.3em] text-muted-foreground flex items-center gap-2"><Shield size={16} /> Access Rules</h3>
                                    <button onClick={() => setIsAddOpen(true)} className="px-4 py-2 bg-purple-600 text-white rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-purple-500 transition-all shadow-lg active:scale-95">Add Rule</button>
                                </div>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    {permissions.map(p => (
                                        <div key={p._id} className="p-4 bg-white/5 rounded-2xl border border-white/5 hover:border-purple-500/30 transition-all flex justify-between items-center group">
                                            <div className="flex items-center gap-4">
                                                <div className="w-10 h-10 bg-white/10 rounded-xl flex items-center justify-center">{p.type === 'user' ? <User size={20} /> : <UsersIcon size={20} />}</div>
                                                <div><div className="font-black text-sm uppercase">{p.type === 'user' ? p.user?.username : p.group?.name}</div><div className="text-[9px] opacity-40 uppercase tracking-widest">{p.type} • {p.access}</div></div>
                                            </div>
                                            <button onClick={() => {
                                                setConfirm({
                                                    isOpen: true, title: "Remove Access?", message: `Revoke access for ${p.type === 'user' ? p.user?.username : p.group?.name}?`,
                                                    onConfirm: async () => {
                                                        closeConfirm(); setActionLoading(true);
                                                        await setPermission(selectedFolder._id, p.type === 'user' ? p.user?._id : p.group?._id, p.type, 'remove');
                                                        invalidateGallery(); setActionLoading(false);
                                                    }
                                                });
                                            }} className="p-2 text-muted-foreground hover:text-red-500 transition-all opacity-40 group-hover:opacity-100"><X size={16} /></button>
                                        </div>
                                    ))}
                                    {permissions.length === 0 && <div className="col-span-full py-12 text-center border-2 border-dashed border-white/5 rounded-3xl opacity-20 text-[10px] uppercase font-black">No rules defined</div>}
                                </div>
                            </section>

                            <section>
                                <h3 className="text-xs font-black uppercase tracking-[0.3em] text-muted-foreground flex items-center gap-2 mb-6"><Share2 size={16} /> Quick Sharing</h3>
                                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                                    {selectedFolder.allowedUsers?.map(userId => {
                                        const user = users.find(u => u._id === userId);
                                        return user && (
                                            <div key={userId} className="p-4 bg-blue-600/5 rounded-2xl border border-blue-500/10 flex justify-between items-center group hover:bg-blue-600/10 transition-all">
                                                <div className="flex items-center gap-3"><div className="w-8 h-8 bg-blue-500/20 text-blue-400 rounded-lg flex items-center justify-center"><User size={14} /></div><span className="text-[10px] font-black uppercase">{user.username}</span></div>
                                                <button onClick={() => handleRemoveSharedUser(userId)} className="text-red-400/40 hover:text-red-500 transition-all"><X size={14} /></button>
                                            </div>
                                        );
                                    })}
                                    <div className="p-4 bg-white/5 border border-dashed border-white/10 rounded-2xl flex items-center transition-all focus-within:border-blue-500/50">
                                        <select onChange={e => { if (e.target.value) { handleShareUser(e.target.value); e.target.value = ""; } }} className="bg-transparent text-[10px] font-black uppercase w-full outline-none cursor-pointer">
                                            <option value="" className="bg-zinc-900">Add User...</option>
                                            {users.filter(u => u.role !== 'admin' && !(selectedFolder.allowedUsers || []).includes(u._id)).map(u => <option key={u._id} value={u._id} className="bg-zinc-900">{u.username.toUpperCase()}</option>)}
                                        </select>
                                    </div>
                                </div>
                            </section>
                        </div>
                    </>
                )}

                {/* Overlays */}
                <AnimatePresence>
                    {actionLoading && (
                        <ClientPortal>
                            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 bg-black/80 backdrop-blur-md z-[200] flex flex-col items-center justify-center">
                                <Loader2 className="animate-spin text-purple-500 mb-6" size={48} />
                                <span className="text-lg font-black uppercase tracking-[0.3em]">Processing</span>
                            </motion.div>
                        </ClientPortal>
                    )}
                </AnimatePresence>

                <AnimatePresence>
                    {isAddOpen && (
                        <div className="fixed inset-0 bg-black/60 backdrop-blur-md z-100 flex items-center justify-center p-6">
                            <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }} className="bg-zinc-900 border border-white/10 p-8 rounded-3xl w-full max-w-md shadow-2xl relative">
                                <button onClick={() => setIsAddOpen(false)} className="absolute top-6 right-6 p-2 hover:bg-white/5 rounded-full"><X size={20} /></button>
                                <h3 className="text-xl font-black mb-8">Add Rule</h3>
                                <div className="space-y-6">
                                    <div className="flex bg-black/40 p-1 rounded-xl border border-white/5">
                                        {['user', 'group'].map(type => <button key={type} onClick={() => { setAddType(type); setAddTarget(''); }} className={`flex-1 py-3 rounded-lg text-[10px] font-black uppercase transition-all ${addType === type ? 'bg-purple-600' : 'hover:bg-white/5'}`}>{type}</button>)}
                                    </div>
                                    <select value={addTarget} onChange={e => setAddTarget(e.target.value)} className="w-full bg-black/40 border border-white/10 p-4 rounded-xl text-[10px] font-black uppercase outline-none focus:border-purple-500">
                                        <option value="" className="bg-zinc-900">Select...</option>
                                        {addType === 'user' ? users.map(u => <option key={u._id} value={u._id} className="bg-zinc-900">{u.username.toUpperCase()}</option>) : groups.map(g => <option key={g._id} value={g._id} className="bg-zinc-900">{g.name.toUpperCase()}</option>)}
                                    </select>
                                    <div className="flex gap-2">
                                        {['read', 'write', 'admin'].map(l => <button key={l} onClick={() => setAddAccess(l)} className={`flex-1 py-3 rounded-xl border-2 text-[9px] font-black uppercase transition-all ${addAccess === l ? 'border-purple-500 bg-purple-600/20' : 'border-white/5'}`}>{l}</button>)}
                                    </div>
                                    <button onClick={async () => {
                                        setActionLoading(true);
                                        await setPermission(selectedFolder._id, addTarget, addType, addAccess);
                                        invalidateGallery(); setIsAddOpen(false); setActionLoading(false);
                                    }} disabled={!addTarget} className="w-full py-4 bg-purple-600 rounded-2xl font-black uppercase text-[10px] tracking-widest shadow-lg shadow-purple-900/40 disabled:opacity-20 active:scale-95 transition-all">Apply</button>
                                </div>
                            </motion.div>
                        </div>
                    )}
                </AnimatePresence>

                <ConfirmDialog isOpen={confirm.isOpen} onClose={closeConfirm} onConfirm={confirm.onConfirm} title={confirm.title} message={confirm.message} type={confirm.type} loading={actionLoading} />
            </div>

            {/* Bulk Popover */}
            <AnimatePresence>
                {selectedIds.length > 0 && (
                    <motion.div initial={{ y: 50, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: 50, opacity: 0 }} className="fixed bottom-12 right-12 bg-zinc-900/90 border border-white/10 p-6 rounded-3xl flex flex-col gap-4 shadow-2xl z-50 backdrop-blur-2xl w-80">
                        <div className="flex justify-between items-center"><span className="text-[10px] font-black text-purple-400 uppercase tracking-widest">{selectedIds.length} Selected</span><button onClick={() => setSelectedIds([])} className="p-1 hover:bg-white/10 rounded-full"><X size={14} /></button></div>
                        <div className="grid grid-cols-2 gap-3">
                            <button onClick={() => handleBulkTogglePublic(true)} className="py-3 bg-green-600 rounded-2xl text-[10px] font-black uppercase text-white shadow-lg shadow-green-900/20">Public</button>
                            <button onClick={() => handleBulkTogglePublic(false)} className="py-3 bg-yellow-600 rounded-2xl text-[10px] font-black uppercase text-white shadow-lg shadow-yellow-900/20">Private</button>
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
}
