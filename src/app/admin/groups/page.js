
'use client';

import { useState, useEffect } from 'react';
import { getGroups, createGroup, deleteGroup } from '@/app/adminActions';
import { Users, Plus, Trash2, Shield } from 'lucide-react';

export default function GroupManagementPage() {
    const [groups, setGroups] = useState([]);
    const [loading, setLoading] = useState(true);
    const [isCreateOpen, setIsCreateOpen] = useState(false);

    async function loadGroups() {
        setLoading(true);
        const res = await getGroups();
        if (res.success) setGroups(res.data);
        setLoading(false);
    }

    useEffect(() => {
        loadGroups();
    }, []);

    async function handleCreate(formData) {
        const name = formData.get('name');
        if (!name) return;

        const res = await createGroup(name);
        if (res.error) {
            alert(res.error);
        } else {
            setIsCreateOpen(false);
            loadGroups();
        }
    }

    async function handleDelete(id) {
        if (confirm('Delete this group? This will verify permissions for all members.')) {
            await deleteGroup(id);
            loadGroups();
        }
    }

    if (loading) return <div className="p-8 text-center">Loading groups...</div>;

    return (
        <div>
            <div className="flex justify-between items-center mb-6">
                <h1 className="text-2xl font-bold flex items-center gap-2">
                    <Shield className="text-teal-400" />
                    Group Management
                </h1>
                <button
                    onClick={() => setIsCreateOpen(true)}
                    className="flex items-center gap-2 px-4 py-2 bg-teal-600 hover:bg-teal-500 text-white rounded-lg transition shadow-lg shadow-teal-900/20"
                >
                    <Plus size={18} />
                    Create Group
                </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {groups.map(group => (
                    <div key={group._id} className="bg-white/5 rounded-xl border border-white/5 p-5 hover:border-white/10 transition-colors group relative">
                        <div className="flex justify-between items-start mb-3">
                            <h3 className="text-lg font-bold">{group.name}</h3>
                            <button
                                onClick={() => handleDelete(group._id)}
                                className="opacity-0 group-hover:opacity-100 p-2 text-red-400 hover:bg-red-500/10 rounded-full transition"
                            >
                                <Trash2 size={16} />
                            </button>
                        </div>

                        <div className="text-sm text-muted-foreground mb-4">
                            {group.members.length} Members
                        </div>

                        {/* Member avatars or list preview could go here */}
                        <div className="flex -space-x-2 overflow-hidden py-1">
                            {group.members.slice(0, 5).map((m, i) => (
                                <div key={i} className="inline-block h-6 w-6 rounded-full ring-2 ring-[#0f0f0f] bg-blue-500/50 flex items-center justify-center text-[10px] font-bold text-white uppercase" title={m.username}>
                                    {m.username[0]}
                                </div>
                            ))}
                            {group.members.length > 5 && (
                                <div className="h-6 w-6 rounded-full ring-2 ring-[#0f0f0f] bg-gray-700 flex items-center justify-center text-[8px] text-white">
                                    +{group.members.length - 5}
                                </div>
                            )}
                        </div>
                    </div>
                ))}

                {groups.length === 0 && (
                    <div className="col-span-full py-12 text-center text-muted-foreground border-2 border-dashed border-white/5 rounded-xl">
                        No groups created yet.
                    </div>
                )}
            </div>

            {/* Create Group Modal */}
            {isCreateOpen && (
                <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center" onClick={() => setIsCreateOpen(false)}>
                    <div className="bg-[#1a1a1a] border border-white/10 p-6 rounded-2xl w-96 shadow-2xl" onClick={e => e.stopPropagation()}>
                        <h3 className="text-xl font-bold mb-4">Create New Group</h3>
                        <form action={handleCreate} className="flex flex-col gap-4">
                            <input
                                name="name"
                                placeholder="Group Name (e.g. Editors)"
                                className="bg-white/5 border border-white/10 rounded-lg px-4 py-2 text-white outline-none focus:border-teal-500 transition"
                                autoFocus
                                required
                            />
                            <div className="flex justify-end gap-3 mt-2">
                                <button type="button" onClick={() => setIsCreateOpen(false)} className="px-4 py-2 text-muted-foreground hover:text-white">Cancel</button>
                                <button className="px-4 py-2 bg-teal-600 hover:bg-teal-500 text-white rounded-lg font-medium">Create</button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
}
