
'use client';

import { useEffect, useState } from 'react';
import { syncFolders } from '@/app/adminActions';
import { Loader2, RefreshCw, CheckCircle, AlertTriangle } from 'lucide-react';

export default function AdminDashboard() {
    const [syncing, setSyncing] = useState(false);
    const [syncResult, setSyncResult] = useState(null);

    async function handleSync() {
        setSyncing(true);
        setSyncResult(null);
        const res = await syncFolders();
        setSyncResult(res);
        setSyncing(false);
    }

    return (
        <div>
            <h1 className="text-3xl font-bold mb-6 text-foreground">System Overview</h1>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Sync Card */}
                <div className="bg-foreground/5 rounded-xl p-6 border border-white/5">
                    <h3 className="text-xl font-bold mb-2 flex items-center gap-2">
                        <RefreshCw size={22} className={syncing ? "animate-spin" : ""} />
                        Storage Sync
                    </h3>
                    <p className="text-muted-foreground text-sm mb-6">
                        Synchronize the database folder structure with the physical storage. Run this if you manually added files or if folder permissions seem out of sync.
                    </p>

                    <button
                        onClick={handleSync}
                        disabled={syncing}
                        className="px-4 py-2 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 disabled:cursor-not-allowed rounded-lg text-white font-medium transition flex items-center gap-2"
                    >
                        {syncing ? 'Scanning...' : 'Run Sync'}
                    </button>

                    {syncResult && (
                        <div className={`mt-4 p-3 rounded-lg flex items-center gap-2 text-sm ${syncResult.success ? 'bg-green-500/10 text-green-400' : 'bg-red-500/10 text-red-400'}`}>
                            {syncResult.success ? <CheckCircle size={16} /> : <AlertTriangle size={16} />}
                            {syncResult.success ? 'Sync completed successfully' : syncResult.error}
                        </div>
                    )}
                </div>

                {/* Stats Card (Placeholder) */}
                <div className="bg-foreground/5 rounded-xl p-6 border border-white/5">
                    <h3 className="text-xl font-bold mb-2">Platform Health</h3>
                    <div className="space-y-4">
                        <div className="flex justify-between items-center py-2 border-b border-white/5">
                            <span className="text-muted-foreground">Database Status</span>
                            <span className="text-green-400 font-mono text-xs bg-green-500/10 px-2 py-1 rounded">CONNECTED</span>
                        </div>
                        <div className="flex justify-between items-center py-2 border-b border-white/5">
                            <span className="text-muted-foreground">Storage Driver</span>
                            <span className="text-blue-400 font-mono text-xs bg-blue-500/10 px-2 py-1 rounded">LOCAL FS</span>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
