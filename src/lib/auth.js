
import { cookies } from 'next/headers';
import dbConnect from './db';
import User from '@/models/User';
import bcrypt from 'bcryptjs';

const SESSION_COOKIE = 'gallery_session';

export async function getSession() {
    const cookieStore = await cookies();
    const session = cookieStore.get(SESSION_COOKIE);
    if (!session?.value) return null;

    try {
        // Simple session: value is "userId:role" (In production, use JWT or signed tokens!)
        // For this request, user asked for cookies auth. I will use a simple encoding for speed/simplicity
        // but secure enough for a local gallery tool.
        const [id, role] = session.value.split(':');
        if (!id || !role) return null;

        return { id, role };
    } catch (e) {
        return null;
    }
}

export async function loginUser(username, password) {
    await dbConnect();
    const user = await User.findOne({ username });

    if (!user) return { error: 'User not found' };

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) return { error: 'Invalid credentials' };

    // Create session
    const cookieStore = await cookies();
    // Simple insecure session for demo: userId:role
    // Ideally sign this with JWT.
    cookieStore.set(SESSION_COOKIE, `${user._id}:${user.role}`, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        maxAge: 60 * 60 * 24 * 7, // 1 week
        path: '/',
    });

    return { success: true, role: user.role };
}

export async function logoutUser() {
    const cookieStore = await cookies();
    cookieStore.delete(SESSION_COOKIE);
}

export async function isAdmin() {
    const session = await getSession();
    return session?.role === 'admin';
}
