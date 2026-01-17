'use client';

import { useActionState } from 'react';
import { login } from '@/app/actions'; // Import server action
import { motion } from 'framer-motion';

export default function LoginForm() {
    const [state, formAction, isPending] = useActionState(login, null);

    return (
        <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            className="w-full max-w-md p-8 rounded-2xl glass-card border border-white/10"
        >
            <h1 className="text-3xl font-bold mb-6 text-center bg-clip-text text-transparent bg-linear-to-r from-blue-500 to-purple-500">
                Welcome Back
            </h1>

            <form action={formAction} className="space-y-4">
                <div>
                    <label className="block text-sm text-gray-400 mb-1">Username</label>
                    <input
                        name="username"
                        type="text"
                        required
                        className="w-full bg-black/50 border border-white/10 rounded-lg px-4 py-3 focus:outline-none focus:ring-2 focus:ring-purple-500 text-white placeholder-gray-600"
                        placeholder="Enter username"
                    />
                </div>

                <div>
                    <label className="block text-sm text-gray-400 mb-1">Password</label>
                    <input
                        name="password"
                        type="password"
                        required
                        className="w-full bg-black/50 border border-white/10 rounded-lg px-4 py-3 focus:outline-none focus:ring-2 focus:ring-purple-500 text-white placeholder-gray-600"
                        placeholder="Enter password"
                    />
                </div>

                {state?.error && (
                    <p className="text-red-400 text-sm text-center">{state.error}</p>
                )}

                <button
                    disabled={isPending}
                    className="w-full bg-linear-to-r from-blue-600 to-purple-600 text-white font-bold py-3 rounded-lg hover:opacity-90 transition disabled:opacity-50"
                >
                    {isPending ? 'Logging in...' : 'Login'}
                </button>

                <p className="text-xs text-center text-gray-500 mt-4">
                    (Demo: Create a user via seeding or DB access first)
                </p>
            </form>
        </motion.div>
    );
}
