'use client';

import { useState, useEffect, useMemo } from 'react';
import { getAllFolders, getFolderPermissions, setPermission, getUsers, getGroups, syncFolders, bulkToggleFoldersPublic, updateFolderAccess } from '@/app/adminActions';
import { FolderLock, Globe, Lock, Shield, ChevronRight, User, Users as UsersIcon, Plus, X, RefreshCw, Search, CheckSquare, Square, CheckCircle2, MoreVertical, Share2, Loader2 } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import ConfirmDialog from '@/components/ui/ConfirmDialog';
import ClientPortal from '@/components/ui/ClientPortal';

export default function PermissionsPage() {
    const [folders, setFolders] = useState([]);
    const [selectedFolder, setSelectedFolder] = useState(null);
    const [permissions, setPermissions] = useState([]);
    const [users, setUsers] = useState([]);
    const [groups, setGroups] = useState([]);

    // Search & Bulk State
    const [searchTerm, setSearchTerm] = useState('');
    const [selectedIds, setSelectedIds] = useState([]);

    // Add Perm State
    const [isAddOpen, setIsAddOpen] = useState(false);
    const [addType, setAddType] = useState('user');
    const [addTarget, setAddTarget] = useState('');
    const [addAccess, setAddAccess] = useState('read');

    const [loading, setLoading] = useState(true);
    const [actionLoading, setActionLoading] = useState(false);
    const [expandedFolders, setExpandedFolders] = useState({});
    const [isRecursive, setIsRecursive] = useState(false);

    // Confirm Dialog State
    const [confirm, setConfirm] = useState({
        isOpen: false,
        title: "",
        message: "",
        onConfirm: () => { },
        type: "danger"
    });

    const closeConfirm = () => setConfirm(prev => ({ ...prev, isOpen: false }));

    function toggleExpand(path, e) {
        if (e) e.stopPropagation();
        setExpandedFolders(prev => ({ ...prev, [path]: !prev[path] }));
    }

    async function loadFolders() {
        setLoading(true);
        const res = await getAllFolders();
        if (res.success) setFolders(res.data);
        setLoading(false);
    }

    async function loadResources() {
        const [uRes, gRes] = await Promise.all([getUsers(), getGroups()]);
        if (uRes.success) setUsers(uRes.data);
        if (gRes.success) setGroups(gRes.data);
    }

    useEffect(() => {
        loadFolders();
        loadResources();
    }, []);

    async function handleSelectFolder(folder) {
        setSelectedFolder(folder);
        const res = await getFolderPermissions(folder._id);
        if (res.success) setPermissions(res.data);
    }

    async function handleTogglePublic(newValue) {
        const isPublic = newValue === 'public';
        setConfirm({
            isOpen: true,
            title: `Make folder ${isPublic ? 'Public' : 'Private'}?`,
            message: isRecursive
                ? "This will recursively update all child folders. This might take a moment."
                : "This will only change the visibility of this specific folder.",
            type: isPublic ? "primary" : "danger",
            onConfirm: async () => {
                setActionLoading(true);
                const res = await updateFolderAccess(selectedFolder._id, isPublic, selectedFolder.allowedUsers || [], isRecursive);
                if (res.success) {
                    await loadFolders();
                    setSelectedFolder(prev => ({ ...prev, isPublic }));
                    closeConfirm();
                } else {
                    alert(res.error || "Failed");
                }
                setActionLoading(false);
            }
        });
    }

    async function handleShareUser(userId) {
        if (!selectedFolder) return;
        const currentAllowed = selectedFolder.allowedUsers || [];
        if (currentAllowed.includes(userId)) return;

        setActionLoading(true);
        const nextAllowed = [...currentAllowed, userId];
        const res = await updateFolderAccess(selectedFolder._id, selectedFolder.isPublic, nextAllowed, isRecursive);
        if (res.success) {
            await loadFolders();
            setSelectedFolder(prev => ({ ...prev, allowedUsers: nextAllowed }));
        }
        setActionLoading(false);
    }

    async function handleRemoveSharedUser(userId) {
        if (!selectedFolder) return;
        setActionLoading(true);
        const nextAllowed = (selectedFolder.allowedUsers || []).filter(id => id !== userId);
        const res = await updateFolderAccess(selectedFolder._id, selectedFolder.isPublic, nextAllowed, isRecursive);
        if (res.success) {
            await loadFolders();
            setSelectedFolder(prev => ({ ...prev, allowedUsers: nextAllowed }));
        }
        setActionLoading(false);
    }

    const filteredFolders = useMemo(() => {
        if (!searchTerm) return folders;
        const low = searchTerm.toLowerCase();
        return folders.filter(f =>
            f.name.toLowerCase().includes(low) ||
            f.path.toLowerCase().includes(low)
        );
    }, [folders, searchTerm]);

    function toggleSelectAll() {
        if (selectedIds.length === filteredFolders.length) {
            setSelectedIds([]);
        } else {
            setSelectedIds(filteredFolders.map(f => f._id));
        }
    }

    function toggleSelectOne(id, e) {
        e.stopPropagation();
        setSelectedIds(prev =>
            prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]
        );
    }

    async function handleBulkTogglePublic(isPublic) {
        setConfirm({
            isOpen: true,
            title: `Set ${selectedIds.length} folders to ${isPublic ? 'Public' : 'Private'}?`,
            message: isRecursive
                ? "This will recursively update all child folders. Proceed with caution."
                : "This will only update the selected folders.",
            type: isPublic ? "primary" : "danger",
            onConfirm: async () => {
                setActionLoading(true);
                const res = await bulkToggleFoldersPublic(selectedIds, isPublic, isRecursive);
                if (res.success) {
                    await loadFolders();
                    setSelectedIds([]);
                    closeConfirm();
                } else {
                    alert(res.error);
                }
                setActionLoading(false);
            }
        });
    }

    const folderTree = useMemo(() => {
        const root = [];
        const map = {};
        const sorted = [...folders].sort((a, b) => a.path.length - b.path.length);
        sorted.forEach(f => {
            map[f.path] = { ...f, children: [] };
            const parts = f.path.split('/');
            if (parts.length === 1) {
                root.push(map[f.path]);
            } else {
                const parentPath = parts.slice(0, -1).join('/');
                if (map[parentPath]) {
                    map[parentPath].children.push(map[f.path]);
                } else {
                    root.push(map[f.path]);
                }
            }
        });
        return root;
    }, [folders]);

    const FolderItem = ({ folder, level = 0 }) => {
        const isExpanded = expandedFolders[folder.path];
        const hasChildren = folder.children && folder.children.length > 0;
        const isSelected = selectedFolder?._id === folder._id;

        return (
            <div className="flex flex-col">
                <div
                    onClick={() => handleSelectFolder(folder)}
                    className={`group flex items-center justify-between p-3 rounded-xl cursor-pointer transition-all duration-200 ${isSelected ? 'bg-purple-600 text-white shadow-md' : 'hover:bg-white/5 text-muted-foreground hover:text-foreground'}`}
                    style={{ marginLeft: `${level * 24}px` }}
                >
                    <div className="flex items-center gap-3 min-w-0 flex-1">
                        <div
                            onClick={(e) => toggleExpand(folder.path, e)}
                            className={`p-1 hover:bg-white/10 rounded-lg transition-transform ${isExpanded ? 'rotate-90' : ''} ${!hasChildren ? 'opacity-0 pointer-events-none' : ''}`}
                        >
                            <ChevronRight size={14} />
                        </div>
                        <div
                            onClick={(e) => toggleSelectOne(folder._id, e)}
                            className={`p-1 rounded-lg hover:bg-white/10 ${selectedIds.includes(folder._id) ? 'text-purple-400' : 'text-muted-foreground'}`}
                        >
                            {selectedIds.includes(folder._id) ? <CheckSquare size={16} /> : <Square size={16} className="opacity-0 group-hover:opacity-100 transition-opacity" />}
                        </div>
                        {folder.isPublic ? <Globe size={16} className="shrink-0 text-green-400" /> : <Lock size={16} className="shrink-0 text-yellow-500" />}
                        <span className="font-medium truncate text-sm">{folder.name}</span>
                    </div>
                </div>
                <AnimatePresence>
                    {isExpanded && hasChildren && (
                        <motion.div
                            initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }}
                            className="overflow-hidden"
                        >
                            {folder.children.map(child => <FolderItem key={child._id} folder={child} level={level + 1} />)}
                        </motion.div>
                    )}
                </AnimatePresence>
            </div>
        );
    };

    async function handleAddPermission() {
        if (!addTarget || !selectedFolder) return;
        setActionLoading(true);
        await setPermission(selectedFolder._id, addTarget, addType, addAccess);
        const res = await getFolderPermissions(selectedFolder._id);
        if (res.success) setPermissions(res.data);
        setIsAddOpen(false);
        setAddTarget('');
        setActionLoading(false);
    }

    async function handleRemovePermission(p) {
        setConfirm({
            isOpen: true,
            title: "Remove Access Rule?",
            message: `Are you sure you want to revoke access for ${p.type === 'user' ? p.user?.username : p.group?.name}?`,
            type: "danger",
            onConfirm: async () => {
                setActionLoading(true);
                const targetId = p.type === 'user' ? p.user?._id : p.group?._id;
                await setPermission(selectedFolder._id, targetId, p.type, 'remove');
                const res = await getFolderPermissions(selectedFolder._id);
                if (res.success) setPermissions(res.data);
                closeConfirm();
                setActionLoading(false);
            }
        });
    }

    return (
        <div className="flex flex-col lg:flex-row h-auto lg:h-[calc(100vh-140px)] gap-6 antialiased">
            {/* Folder List Sidebar */}
            <div className="w-full lg:w-96 xl:w-1/3 glass-card rounded-2xl flex flex-col overflow-hidden relative border border-white/10 shrink-0">
                <div className="p-4 border-b border-white/10 flex justify-between items-center bg-white/5">
                    <h2 className="font-semibold flex items-center gap-2 text-base tracking-tight">
                        <FolderLock size={20} className="text-purple-400" />
                        Folders
                    </h2>
                    <button
                        onClick={async (e) => {
                            e.stopPropagation();
                            setLoading(true);
                            await syncFolders();
                            await loadFolders();
                            setLoading(false);
                        }}
                        className="p-1.5 bg-white/5 hover:bg-white/10 rounded-lg text-muted-foreground transition-all"
                        title="Sync Folders"
                    >
                        <RefreshCw size={14} className={loading ? "animate-spin" : ""} />
                    </button>
                </div>

                <div className="p-3 border-b border-white/10 flex items-center gap-2 bg-black/20">
                    <Search size={14} className="text-muted-foreground/50" />
                    <input
                        type="text"
                        placeholder="Search folders..."
                        className="bg-transparent text-sm w-full outline-none placeholder:text-muted-foreground/30"
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                    />
                </div>

                <div className="px-4 py-2 border-b border-white/10 flex items-center justify-between">
                    <div className="flex items-center gap-2 cursor-pointer select-none group" onClick={toggleSelectAll}>
                        <div className="transition-transform active:scale-90">
                            {selectedIds.length === filteredFolders.length && filteredFolders.length > 0 ? (
                                <CheckSquare size={16} className="text-purple-400" />
                            ) : (
                                <Square size={16} className="text-muted-foreground" />
                            )}
                        </div>
                        <span className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground group-hover:text-foreground">Select All</span>
                    </div>
                </div>

                <div className="flex-1 overflow-y-auto p-2 space-y-1 custom-scrollbar">
                    {searchTerm ? (
                        filteredFolders.map(f => (
                            <div
                                key={f._id}
                                onClick={() => handleSelectFolder(f)}
                                className={`group flex items-center justify-between p-2.5 rounded-xl cursor-pointer transition-all ${selectedFolder?._id === f._id ? 'bg-purple-600 text-white' : 'hover:bg-white/5 text-muted-foreground hover:text-foreground'}`}
                            >
                                <div className="flex items-center gap-3 min-w-0 flex-1">
                                    <div onClick={(e) => toggleSelectOne(f._id, e)} className="p-1 rounded hover:bg-white/10">
                                        {selectedIds.includes(f._id) ? <CheckSquare size={16} className="text-purple-400" /> : <Square size={16} className="opacity-0 group-hover:opacity-100 transition-opacity" />}
                                    </div>
                                    {f.isPublic ? <Globe size={16} className="shrink-0 text-green-400" /> : <Lock size={16} className="shrink-0 text-yellow-500" />}
                                    <div className="min-w-0">
                                        <span className="block font-medium truncate text-sm">{f.name}</span>
                                        {f.path !== f.name && <span className="block text-[10px] opacity-40 truncate">{f.path}</span>}
                                    </div>
                                </div>
                                <button className="p-1 opacity-0 group-hover:opacity-100 transition-opacity"><MoreVertical size={14} /></button>
                            </div>
                        ))
                    ) : (
                        folderTree.map(f => <FolderItem key={f._id} folder={f} />)
                    )}
                </div>

                {/* Bulk Actions Mobile Popover */}
                <AnimatePresence>
                    {selectedIds.length > 0 && (
                        <motion.div
                            initial={{ y: 50, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: 50, opacity: 0 }}
                            className="absolute bottom-4 inset-x-4 bg-[#111] border border-white/10 p-3 rounded-2xl flex flex-col gap-2 shadow-[0_10px_30px_rgba(0,0,0,0.5)] z-20 backdrop-blur-xl"
                        >
                            <div className="flex items-center justify-between px-1">
                                <span className="text-[10px] font-black uppercase tracking-widest text-white/70">{selectedIds.length} Selected</span>
                                <div className="flex items-center gap-2">
                                    <label className="flex items-center gap-1.5 cursor-pointer group">
                                        <input type="checkbox" checked={isRecursive} onChange={(e) => setIsRecursive(e.target.checked)} className="sr-only" />
                                        <div className={`w-3.5 h-3.5 border rounded flex items-center justify-center transition-all ${isRecursive ? 'bg-purple-500 border-purple-400' : 'border-white/20'}`}>
                                            {isRecursive && <CheckCircle2 size={10} className="text-white" />}
                                        </div>
                                        <span className="text-[9px] font-bold uppercase text-muted-foreground/50 group-hover:text-purple-400 transition-colors">Recurse</span>
                                    </label>
                                    <button onClick={() => setSelectedIds([])} className="p-1 hover:bg-white/10 rounded-lg text-muted-foreground"><X size={14} /></button>
                                </div>
                            </div>
                            <div className="grid grid-cols-2 gap-2 mt-1">
                                <button onClick={() => handleBulkTogglePublic(true)} className="py-2 bg-green-600/90 hover:bg-green-500 rounded-xl text-[10px] font-black uppercase tracking-widest text-white transition-all">Public</button>
                                <button onClick={() => handleBulkTogglePublic(false)} className="py-2 bg-yellow-600/90 hover:bg-yellow-500 rounded-xl text-[10px] font-black uppercase tracking-widest text-white transition-all">Private</button>
                            </div>
                        </motion.div>
                    )}
                </AnimatePresence>
            </div>

            {/* Main Content Area */}
            <div className="flex-1 glass-card rounded-2xl flex flex-col overflow-hidden relative border border-white/10">
                {!selectedFolder ? (
                    <div className="flex-1 flex flex-col items-center justify-center text-muted-foreground/30 p-12 text-center">
                        <FolderLock size={48} className="mb-4 opacity-10" />
                        <h3 className="text-xl font-semibold text-white mb-2">Select a folder</h3>
                        <p className="max-w-xs text-sm">Choose a folder from the left to configure access and permissions.</p>
                    </div>
                ) : (
                    <>
                        {/* Header */}
                        <div className="p-6 lg:p-8 border-b border-white/10 bg-white/5">
                            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
                                <div className="flex items-center gap-4 min-w-0">
                                    <div className={`p-3 rounded-2xl border ${selectedFolder.isPublic ? 'border-green-500/20 bg-green-500/10 text-green-400' : 'border-yellow-500/20 bg-yellow-500/10 text-yellow-500'}`}>
                                        {selectedFolder.isPublic ? <Globe size={28} /> : <Lock size={28} />}
                                    </div>
                                    <div className="min-w-0">
                                        <h2 className="text-2xl font-bold truncate tracking-tight">{selectedFolder.name}</h2>
                                        <p className="text-[10px] text-muted-foreground/60 font-mono mt-1 px-2 py-0.5 bg-black/40 rounded-md inline-block max-w-full truncate">{selectedFolder.path}</p>
                                    </div>
                                </div>

                                <div className="flex items-center gap-3 w-full md:w-auto">
                                    <div className={`flex-1 md:flex-none flex items-center p-1 rounded-xl bg-black/40 border ${selectedFolder.isPublic ? 'border-green-500/20' : 'border-yellow-500/20'}`}>
                                        <select
                                            value={selectedFolder.isPublic ? 'public' : 'private'}
                                            onChange={(e) => handleTogglePublic(e.target.value)}
                                            className={`bg-transparent font-bold text-xs uppercase tracking-wider outline-none px-4 py-2 rounded-lg cursor-pointer transition-all ${selectedFolder.isPublic ? 'text-green-400' : 'text-yellow-400'}`}
                                        >
                                            <option value="public" className="bg-[#1a1a1a]">Public</option>
                                            <option value="private" className="bg-[#1a1a1a]">Private</option>
                                        </select>
                                    </div>

                                    <label className="flex items-center gap-2 cursor-pointer group px-4 py-2.5 bg-white/5 hover:bg-white/10 border border-white/10 rounded-xl transition-all">
                                        <input type="checkbox" checked={isRecursive} onChange={(e) => setIsRecursive(e.target.checked)} className="sr-only" />
                                        <div className={`w-4 h-4 border rounded flex items-center justify-center transition-all ${isRecursive ? 'bg-purple-500 border-purple-400' : 'border-white/20'}`}>
                                            {isRecursive && <CheckCircle2 size={12} className="text-white" />}
                                        </div>
                                        <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground group-hover:text-foreground">Apply Recursively</span>
                                    </label>
                                </div>
                            </div>
                        </div>

                        {/* Content Scroll Area */}
                        <div className="flex-1 overflow-y-auto p-6 lg:p-8 custom-scrollbar space-y-12">
                            {/* Detailed Rules */}
                            <section>
                                <div className="flex justify-between items-center mb-6">
                                    <div className="flex items-center gap-3">
                                        <Shield size={18} className="text-purple-400" />
                                        <h3 className="text-sm font-bold uppercase tracking-widest text-muted-foreground">Access Rules</h3>
                                    </div>
                                    <button onClick={() => setIsAddOpen(true)} className="flex items-center gap-2 px-4 py-2 bg-purple-600 hover:bg-purple-500 text-white rounded-xl text-xs font-bold uppercase tracking-widest transition-all shadow-lg active:scale-95">
                                        <Plus size={16} /> Add Rule
                                    </button>
                                </div>

                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    {permissions.length === 0 && (
                                        <div className="col-span-full py-12 text-center text-muted-foreground/30 text-xs font-bold uppercase tracking-widest border-2 border-dashed border-white/5 rounded-2xl">
                                            No special rules configured
                                        </div>
                                    )}
                                    {permissions.map(p => (
                                        <div key={p._id} className="flex justify-between items-center p-4 glass-card rounded-2xl border-white/10 hover:border-purple-500/40 transition-all group">
                                            <div className="flex items-center gap-3">
                                                <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${p.type === 'user' ? 'bg-blue-600/10 text-blue-400' : 'bg-teal-600/10 text-teal-400'}`}>
                                                    {p.type === 'user' ? <User size={20} /> : <UsersIcon size={20} />}
                                                </div>
                                                <div>
                                                    <div className="font-bold text-white text-sm uppercase tracking-tight">{p.type === 'user' ? p.user?.username : p.group?.name}</div>
                                                    <div className="text-[10px] text-muted-foreground/60 font-bold uppercase tracking-widest mt-0.5">{p.type}</div>
                                                </div>
                                            </div>
                                            <div className="flex items-center gap-3">
                                                <div className="px-2 py-1 rounded-md bg-black/30 border border-white/5 text-[9px] font-bold uppercase tracking-widest text-muted-foreground">
                                                    {p.access}
                                                </div>
                                                <button onClick={() => handleRemovePermission(p)} className="p-1.5 text-muted-foreground/40 hover:text-red-400 hover:bg-red-400/10 rounded-lg transition-all">
                                                    <X size={16} />
                                                </button>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </section>

                            {/* Divider */}
                            <div className="h-px bg-white/5" />

                            {/* Simple Sharing */}
                            <section>
                                <div className="flex items-center gap-3 mb-6">
                                    <Share2 size={18} className="text-blue-400" />
                                    <h3 className="text-sm font-bold uppercase tracking-widest text-muted-foreground">Direct User Access</h3>
                                </div>

                                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                                    {selectedFolder.allowedUsers?.map(userId => {
                                        const user = users.find(u => u._id === userId);
                                        if (!user) return null;
                                        return (
                                            <motion.div layout initial={{ opacity: 0 }} animate={{ opacity: 1 }} key={userId} className="flex items-center justify-between p-4 bg-blue-500/5 border border-blue-500/10 rounded-2xl hover:bg-blue-500/10 transition-all group">
                                                <div className="flex items-center gap-3">
                                                    <div className="w-10 h-10 bg-blue-500/10 text-blue-400 rounded-xl flex items-center justify-center">
                                                        <User size={18} />
                                                    </div>
                                                    <span className="text-xs font-bold text-white uppercase truncate">{user.username}</span>
                                                </div>
                                                <button onClick={() => handleRemoveSharedUser(userId)} className="p-1.5 text-blue-400/30 hover:text-red-500 hover:bg-red-400/10 rounded-lg transition-all">
                                                    <X size={14} />
                                                </button>
                                            </motion.div>
                                        );
                                    })}

                                    <div className="p-4 bg-white/5 border border-white/10 border-dashed rounded-2xl flex items-center gap-3 transition-all focus-within:border-blue-500/50 group">
                                        <Plus size={18} className="text-muted-foreground/30 group-hover:text-blue-400 transition-colors" />
                                        <select
                                            className="bg-transparent text-[11px] font-bold uppercase tracking-[0.05em] w-full outline-none focus:ring-0 cursor-pointer text-muted-foreground hover:text-white"
                                            onChange={(e) => {
                                                if (e.target.value) {
                                                    handleShareUser(e.target.value);
                                                    e.target.value = "";
                                                }
                                            }}
                                        >
                                            <option value="" className="bg-[#1a1a1a]">Select User...</option>
                                            {users.filter(u => u.role !== 'admin' && !(selectedFolder.allowedUsers || []).includes(u._id))
                                                .map(u => <option key={u._id} value={u._id} className="bg-[#1a1a1a]">{u.username.toUpperCase()}</option>)}
                                        </select>
                                    </div>
                                </div>
                            </section>
                        </div>

                        {/* Modal Overlay */}
                        <AnimatePresence>
                            {isAddOpen && (
                                <div className="fixed inset-0 bg-black/60 backdrop-blur-md z-[100] flex items-center justify-center p-6">
                                    <motion.div
                                        initial={{ opacity: 0, scale: 0.95, y: 10 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.95, y: 10 }}
                                        className="bg-[#1a1a1a] border border-white/10 p-8 rounded-3xl w-full max-w-md shadow-2xl relative"
                                    >
                                        <button onClick={() => setIsAddOpen(false)} className="absolute top-6 right-6 p-2 hover:bg-white/5 rounded-full transition-all text-muted-foreground">
                                            <X size={20} />
                                        </button>

                                        <h3 className="text-xl font-bold mb-8">Add Access Rule</h3>

                                        <div className="space-y-6 text-[11px] font-black uppercase tracking-widest text-muted-foreground">
                                            <div>
                                                <p className="mb-3">Type</p>
                                                <div className="flex bg-black/40 p-1 rounded-xl border border-white/5">
                                                    <button onClick={() => { setAddType('user'); setAddTarget(''); }} className={`flex-1 py-3 rounded-lg transition-all ${addType === 'user' ? 'bg-purple-600 text-white' : 'hover:text-white'}`}>User</button>
                                                    <button onClick={() => { setAddType('group'); setAddTarget(''); }} className={`flex-1 py-3 rounded-lg transition-all ${addType === 'group' ? 'bg-purple-600 text-white' : 'hover:text-white'}`}>Group</button>
                                                </div>
                                            </div>

                                            <div>
                                                <p className="mb-3">Select {addType}</p>
                                                <select
                                                    className="w-full bg-black/40 border border-white/5 px-4 py-3 rounded-xl outline-none text-white focus:border-purple-500 transition-all uppercase"
                                                    value={addTarget}
                                                    onChange={(e) => setAddTarget(e.target.value)}
                                                >
                                                    <option value="" className="bg-[#1a1a1a]">Choose...</option>
                                                    {addType === 'user' ? users.map(u => <option key={u._id} value={u._id} className="bg-[#1a1a1a]">{u.username.toUpperCase()}</option>)
                                                        : groups.map(g => <option key={g._id} value={g._id} className="bg-[#1a1a1a]">{g.name.toUpperCase()}</option>)}
                                                </select>
                                            </div>

                                            <div>
                                                <p className="mb-3">Permissions</p>
                                                <div className="flex gap-2">
                                                    {['read', 'write', 'admin'].map(lvl => (
                                                        <button key={lvl} onClick={() => setAddAccess(lvl)} className={`flex-1 py-3 rounded-xl border-2 transition-all ${addAccess === lvl ? 'border-purple-500 bg-purple-600/20 text-purple-400' : 'border-white/5 bg-transparent hover:border-white/20'}`}>{lvl}</button>
                                                    ))}
                                                </div>
                                            </div>

                                            <button onClick={handleAddPermission} disabled={!addTarget || actionLoading} className="w-full py-4 bg-purple-600 hover:bg-purple-500 text-white rounded-2xl font-bold tracking-[0.2em] transition-all active:scale-[0.98] disabled:opacity-20 mt-4 shadow-lg shadow-purple-900/40 flex items-center justify-center gap-2">
                                                {actionLoading && <Loader2 size={16} className="animate-spin" />}
                                                Apply Rule
                                            </button>
                                        </div>
                                    </motion.div>
                                </div>
                            )}
                        </AnimatePresence>

                        {/* Action Overlay Loader */}
                        <AnimatePresence>
                            {actionLoading && !isAddOpen && !confirm.isOpen && (
                                <ClientPortal>
                                    <motion.div
                                        initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                                        className="fixed inset-0 bg-black/20 backdrop-blur-[2px] z-50 flex items-center justify-center pointer-events-auto"
                                    >
                                        <div className="bg-background/80 p-4 rounded-2xl border border-white/10 shadow-2xl flex items-center gap-3">
                                            <Loader2 size={24} className="animate-spin text-purple-500" />
                                            <span className="text-sm font-bold uppercase tracking-widest">Processing...</span>
                                        </div>
                                    </motion.div>
                                </ClientPortal>
                            )}
                        </AnimatePresence>

                        {/* Custom Confirm Dialog */}
                        <ConfirmDialog
                            isOpen={confirm.isOpen}
                            onClose={closeConfirm}
                            onConfirm={confirm.onConfirm}
                            title={confirm.title}
                            message={confirm.message}
                            type={confirm.type}
                            loading={actionLoading}
                        />
                    </>
                )}
            </div>
        </div>
    );
}
