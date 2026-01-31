import { getAllFolders, getUsers, getGroups } from '@/app/adminActions';
import PermissionsClient from './PermissionsClient';
import { isAdmin } from '@/lib/auth';
import { redirect } from 'next/navigation';

export default async function PermissionsPage() {
    // Security check on server
    if (!await isAdmin()) {
        redirect('/');
    }

    // Parallel data fetching on the server
    const [foldersRes, usersRes, groupsRes] = await Promise.all([
        getAllFolders(),
        getUsers(),
        getGroups()
    ]);

    return (
        <PermissionsClient
            initialFolders={foldersRes.success ? foldersRes.data : []}
            initialUsers={usersRes.success ? usersRes.data : []}
            initialGroups={groupsRes.success ? groupsRes.data : []}
        />
    );
}
