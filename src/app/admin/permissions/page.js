'use client';

import { useState, useEffect } from 'react';
import { getAllFolders, getFolderPermissions, setPermission, getUsers, getGroups, toggleFolderPublic, syncFolders } from '@/app/adminActions';
import { FolderLock, Globe, Lock, Shield, ChevronRight, User, Users as UsersIcon, Plus, X, RefreshCw } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

export default function PermissionsPage() {
    const [folders, setFolders] = useState([]);
    const [selectedFolder, setSelectedFolder] = useState(null);
    const [permissions, setPermissions] = useState([]);
    const [users, setUsers] = useState([]);
    const [groups, setGroups] = useState([]);

    // Add Perm State
    const [isAddOpen, setIsAddOpen] = useState(false);
    const [addType, setAddType] = useState('user'); // 'user' or 'group'
    const [addTarget, setAddTarget] = useState('');
    const [addAccess, setAddAccess] = useState('read');

    const [loading, setLoading] = useState(true);



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
        // Load permissions
        const res = await getFolderPermissions(folder._id);
        if (res.success) setPermissions(res.data);
    }

    async function handleTogglePublic(newValue) {
        const isPublic = newValue === 'public';
        const res = await toggleFolderPublic(selectedFolder._id, isPublic);

        if (res.success) {
            loadFolders();
            // Update local state
            setSelectedFolder(prev => ({ ...prev, isPublic }));
        } else {
            alert(res.error || "Failed");
        }
    }



    async function handleAddPermission() {
        if (!addTarget || !selectedFolder) return;

        await setPermission(selectedFolder._id, addTarget, addType, addAccess);

        // Refresh
        const res = await getFolderPermissions(selectedFolder._id);
        if (res.success) setPermissions(res.data);
        setIsAddOpen(false);
        setAddTarget('');
    }

    async function handleRemovePermission(p) {
        if (!confirm('Remove this permission?')) return;

        const targetId = p.type === 'user' ? p.user?._id : p.group?._id;
        await setPermission(selectedFolder._id, targetId, p.type, 'remove');

        // Refresh
        const res = await getFolderPermissions(selectedFolder._id);
        if (res.success) setPermissions(res.data);
    }

    return (
        <div className="flex h-[calc(100vh-120px)] gap-6">
            {/* Folder List */}
            <div className="w-1/3 bg-white/5 rounded-xl border border-white/5 flex flex-col overflow-hidden">
                <div className="p-4 border-b border-white/5 flex justify-between items-center">
                    <h2 className="font-bold flex items-center gap-2">
                        <FolderLock size={20} className="text-yellow-400" />
                        Folders
                    </h2>
                    <button
                        onClick={async (e) => {
                            e.stopPropagation();
                            setLoading(true);
                            await syncFolders();
                            await loadFolders(); // Reload list
                            setLoading(false);
                        }}
                        className="p-1.5 bg-white/5 hover:bg-white/10 rounded-md text-muted-foreground hover:text-white transition"
                        title="Sync Folders from Disk to DB"
                    >
                        <RefreshCw size={14} className={loading ? "animate-spin" : ""} />
                    </button>
                </div>
                <div className="flex-1 overflow-y-auto p-2 space-y-1 custom-scrollbar">
                    {folders.map(f => (
                        <div
                            key={f._id}
                            onClick={() => handleSelectFolder(f)}
                            className={`flex items-center justify-between p-3 rounded-lg cursor-pointer transition ${selectedFolder?._id === f._id ? 'bg-purple-600 text-white' : 'hover:bg-white/5 text-muted-foreground hover:text-foreground'}`}
                        >
                            <div className="flex items-center gap-3 min-w-0">
                                {f.isPublic ? <Globe size={16} className="shrink-0" /> : <Lock size={16} className="shrink-0" />}
                                <div className="min-w-0">
                                    <span className="block font-medium truncate text-sm">{f.name}</span>
                                    {f.path !== f.name && <span className="block text-xs text-muted-foreground truncate">{f.path}</span>}
                                </div>
                            </div>
                            <ChevronRight size={16} className={`transition-transform ${selectedFolder?._id === f._id ? 'rotate-90' : ''}`} />
                        </div>
                    ))}
                </div>
            </div>

            {/* Permission Detail */}
            <div className="flex-1 bg-white/5 rounded-xl border border-white/5 flex flex-col overflow-hidden relative">
                {!selectedFolder ? (
                    <div className="flex-1 flex flex-col items-center justify-center text-muted-foreground opacity-50">
                        <FolderLock size={48} className="mb-4" />
                        <p>Select a folder to manage permissions</p>
                    </div>
                ) : (
                    <>
                        <div className="p-6 border-b border-white/5 flex justify-between items-start">
                            <div className="min-w-0 flex-1 mr-4">
                                <h2 className="text-2xl font-bold mb-1 truncate">{selectedFolder.name}</h2>
                                <p className="text-sm text-muted-foreground truncate">{selectedFolder.path}</p>
                            </div>

                            <div className="flex items-center gap-4 bg-black/20 p-2 rounded-lg">
                                <span className="text-sm text-muted-foreground">Access:</span>
                                <select
                                    value={selectedFolder.isPublic ? 'public' : 'private'}
                                    onChange={(e) => handleTogglePublic(e.target.value)}
                                    className={`bg-transparent font-medium outline-none px-2 py-1 rounded cursor-pointer ${selectedFolder.isPublic ? 'text-green-400' : 'text-yellow-400'
                                        }`}
                                >
                                    <option value="public" className="bg-[#1a1a1a] text-green-400">Public (Visible to All)</option>
                                    <option value="private" className="bg-[#1a1a1a] text-yellow-400">Private (Restricted)</option>
                                </select>
                                {selectedFolder.isPublic ? <Globe size={16} className="text-green-400" /> : <Lock size={16} className="text-yellow-400" />}
                            </div>
                        </div>

                        <div className="flex-1 overflow-y-auto p-6">
                            <div className="flex justify-between items-center mb-4">
                                <h3 className="font-bold flex items-center gap-2">
                                    <Shield size={18} className="text-purple-400" />
                                    Access Rules
                                </h3>
                                <button
                                    onClick={() => setIsAddOpen(true)}
                                    className="flex items-center gap-2 px-3 py-1.5 bg-purple-600 hover:bg-purple-500 rounded-lg text-sm font-medium transition"
                                >
                                    <Plus size={16} />
                                    Add Rule
                                </button>
                            </div>

                            <div className="space-y-3">
                                {permissions.length === 0 && (
                                    <div className="text-center py-8 text-muted-foreground text-sm border-2 border-dashed border-white/5 rounded-xl">
                                        No explicit permissions set.
                                        {selectedFolder.isPublic ? " Visible to everyone." : " Only visible to Owner & Admins."}
                                    </div>
                                )}

                                {permissions.map(p => (
                                    <div key={p._id} className="flex justify-between items-center p-4 bg-white/5 rounded-xl border border-white/5">
                                        <div className="flex items-center gap-4">
                                            <div className={`w-10 h-10 rounded-full flex items-center justify-center ${p.type === 'user' ? 'bg-blue-500/20 text-blue-400' : 'bg-teal-500/20 text-teal-400'}`}>
                                                {p.type === 'user' ? <User size={20} /> : <UsersIcon size={20} />}
                                            </div>
                                            <div>
                                                <div className="font-bold">{p.type === 'user' ? p.user?.username : p.group?.name}</div>
                                                <div className="text-xs text-muted-foreground uppercase tracking-wider">{p.type}</div>
                                            </div>
                                        </div>

                                        <div className="flex items-center gap-4">
                                            <div className="px-3 py-1 rounded-full bg-white/10 text-xs font-mono uppercase">
                                                {p.access}
                                            </div>
                                            <button
                                                onClick={() => handleRemovePermission(p)}
                                                className="p-2 text-muted-foreground hover:text-red-400 hover:bg-red-400/10 rounded-full transition"
                                            >
                                                <X size={18} />
                                            </button>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>

                        {/* Add Rule Modal Overlay */}
                        <AnimatePresence>
                            {isAddOpen && (
                                <div className="absolute inset-0 bg-black/80 backdrop-blur-sm z-10 flex items-center justify-center p-8">
                                    <motion.div
                                        initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.9 }}
                                        className="bg-[#1a1a1a] border border-white/10 p-6 rounded-2xl w-full max-w-md shadow-2xl"
                                    >
                                        <h3 className="font-bold text-lg mb-4">Add Access Rule</h3>

                                        <div className="space-y-4">
                                            {/* Type Selector */}
                                            <div className="flex bg-white/5 rounded-lg p-1">
                                                <button
                                                    onClick={() => { setAddType('user'); setAddTarget(''); }}
                                                    className={`flex-1 py-1.5 text-sm font-medium rounded-md transition ${addType === 'user' ? 'bg-white/10 text-white' : 'text-muted-foreground hover:text-white'}`}
                                                >
                                                    User
                                                </button>
                                                <button
                                                    onClick={() => { setAddType('group'); setAddTarget(''); }}
                                                    className={`flex-1 py-1.5 text-sm font-medium rounded-md transition ${addType === 'group' ? 'bg-white/10 text-white' : 'text-muted-foreground hover:text-white'}`}
                                                >
                                                    Group
                                                </button>
                                            </div>

                                            {/* Target Selector */}
                                            <select
                                                className="w-full bg-white/5 border border-white/10 px-3 py-2 rounded-lg outline-none"
                                                value={addTarget}
                                                onChange={(e) => setAddTarget(e.target.value)}
                                            >
                                                <option value="">Select {addType}...</option>
                                                {addType === 'user' ? (
                                                    users.map(u => <option key={u._id} value={u._id}>{u.username}</option>)
                                                ) : (
                                                    groups.map(g => <option key={g._id} value={g._id}>{g.name}</option>)
                                                )}
                                            </select>

                                            {/* Access Level */}
                                            <div>
                                                <p className="text-xs text-muted-foreground mb-2 font-bold uppercase">Permissions</p>
                                                <div className="flex gap-2">
                                                    {['read', 'write', 'admin'].map(lvl => (
                                                        <button
                                                            key={lvl}
                                                            onClick={() => setAddAccess(lvl)}
                                                            className={`flex-1 py-2 rounded-lg text-sm border transition ${addAccess === lvl ? 'border-purple-500 bg-purple-500/20 text-purple-400' : 'border-white/10 bg-white/5 text-muted-foreground'}`}
                                                        >
                                                            {lvl.charAt(0).toUpperCase() + lvl.slice(1)}
                                                        </button>
                                                    ))}
                                                </div>
                                            </div>

                                            <div className="flex gap-3 justify-end mt-4">
                                                <button onClick={() => setIsAddOpen(false)} className="px-4 py-2 text-muted-foreground hover:text-white">Cancel</button>
                                                <button
                                                    onClick={handleAddPermission}
                                                    disabled={!addTarget}
                                                    className="px-6 py-2 bg-purple-600 hover:bg-purple-500 rounded-lg text-white font-medium disabled:opacity-50"
                                                >
                                                    Save Rule
                                                </button>
                                            </div>
                                        </div>
                                    </motion.div>
                                </div>
                            )}
                        </AnimatePresence>
                    </>
                )}
            </div>
        </div>
    );
}
