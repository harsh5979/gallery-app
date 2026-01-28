
'use client';

import { useState, useEffect } from 'react';
import { getUsers, getGroups, updateUserGroups } from '@/app/adminActions';
import { Users, Shield, User as UserIcon, Check } from 'lucide-react';

export default function UserManagementPage() {
    const [users, setUsers] = useState([]);
    const [groups, setGroups] = useState([]);
    const [loading, setLoading] = useState(true);
    const [editingUser, setEditingUser] = useState(null);

    async function loadData() {
        setLoading(true);
        const [uRes, gRes] = await Promise.all([getUsers(), getGroups()]);
        if (uRes.success) setUsers(uRes.data);
        if (gRes.success) setGroups(gRes.data);
        setLoading(false);
    }

    useEffect(() => {
        loadData();
    }, []);

    async function handleSaveGroups(userId, newGroupIds) {
        await updateUserGroups(userId, newGroupIds);
        setEditingUser(null);
        loadData();
    }

    if (loading) return <div className="p-8 text-center">Loading users...</div>;

    return (
        <div>
            <div className="flex justify-between items-center mb-6">
                <h1 className="text-2xl font-bold flex items-center gap-2">
                    <Users className="text-purple-400" />
                    User Management
                </h1>
                {/* Future: Add User Button */}
            </div>

            <div className="overflow-x-auto rounded-xl border border-white/5 bg-black/20">
                <table className="w-full text-left p-4">
                    <thead className="bg-white/5 text-muted-foreground uppercase text-xs">
                        <tr>
                            <th className="p-4 rounded-tl-xl">User</th>
                            <th className="p-4">Role</th>
                            <th className="p-4">Groups</th>
                            <th className="p-4 rounded-tr-xl">Actions</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-white/5">
                        {users.map(user => (
                            <tr key={user._id} className="hover:bg-white/5 transition-colors">
                                <td className="p-4">
                                    <div className="flex items-center gap-3">
                                        <div className="w-8 h-8 rounded-full bg-blue-500/20 flex items-center justify-center">
                                            <UserIcon size={14} className="text-blue-400" />
                                        </div>
                                        <div>
                                            <div className="font-medium">{user.username}</div>
                                            <div className="text-xs text-muted-foreground">ID: {user._id}</div>
                                        </div>
                                    </div>
                                </td>
                                <td className="p-4">
                                    <span className={`px-2 py-1 rounded text-xs font-mono uppercase ${user.role === 'admin' ? 'bg-purple-500/20 text-purple-300' : 'bg-gray-500/20 text-gray-400'}`}>
                                        {user.role}
                                    </span>
                                </td>
                                <td className="p-4">
                                    <div className="flex flex-wrap gap-2">
                                        {user.groups && user.groups.length > 0 ? user.groups.map(g => (
                                            <span key={g._id} className="px-2 py-0.5 rounded-full bg-blue-500/10 text-blue-300 text-xs border border-blue-500/20">
                                                {g.name}
                                            </span>
                                        )) : (
                                            <span className="text-muted-foreground text-xs italic">No groups</span>
                                        )}
                                    </div>
                                </td>
                                <td className="p-4">
                                    <button
                                        onClick={() => setEditingUser(user)}
                                        className="text-sm text-blue-400 hover:text-blue-300 transition"
                                    >
                                        Edit Groups
                                    </button>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>

            {/* Edit User Groups Modal */}
            {editingUser && (
                <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center" onClick={() => setEditingUser(null)}>
                    <div className="bg-[#1a1a1a] border border-white/10 p-6 rounded-2xl w-96 shadow-2xl" onClick={e => e.stopPropagation()}>
                        <h3 className="text-xl font-bold mb-4">Edit Groups for {editingUser.username}</h3>
                        <div className="space-y-2 mb-6 max-h-60 overflow-y-auto">
                            {groups.map(group => {
                                const isSelected = editingUser.groups.some(g => g._id === group._id);
                                return (
                                    <label key={group._id} className="flex items-center gap-3 p-3 rounded-lg hover:bg-white/5 cursor-pointer transition">
                                        <div className={`w-5 h-5 rounded border flex items-center justify-center transition ${isSelected ? 'bg-blue-600 border-blue-600' : 'border-white/20'}`}>
                                            {isSelected && <Check size={12} />}
                                        </div>
                                        {/* Handle checkbox state locally or via temp state? For simplicity, we toggle on save? 
                                            Actually better to have local state here.
                                            Let's use a simpler approach: Just rerender the list with a toggle handler on the parent state for *editingUser* 
                                            Wait, editingUser needs to be mutable state.
                                        */}
                                        <span>{group.name}</span>
                                        <input
                                            type="checkbox"
                                            hidden
                                            checked={isSelected}
                                            onChange={() => {
                                                const newGroups = isSelected
                                                    ? editingUser.groups.filter(g => g._id !== group._id)
                                                    : [...editingUser.groups, group];
                                                setEditingUser({ ...editingUser, groups: newGroups });
                                            }}
                                        />
                                    </label>
                                );
                            })}
                        </div>
                        <div className="flex justify-end gap-3">
                            <button onClick={() => setEditingUser(null)} className="px-4 py-2 text-muted-foreground hover:text-white">Cancel</button>
                            <button
                                onClick={() => handleSaveGroups(editingUser._id, editingUser.groups.map(g => g._id))}
                                className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-lg"
                            >
                                Save Changes
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
