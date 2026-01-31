import { cookies } from 'next/headers';
import dbConnect from './db';
import User from '@/models/User';
import bcrypt from 'bcryptjs';

/**
 * Basic Authentication Utility Wrapper
 * 
 * Note: Uses a simple "id:role" session cookie for simplicity.
 * Recommendation for Production: Use Signed JWT or Session Store.
 */

const SESSION_COOKIE = 'gallery_session';

/**
 * Retrieves the current session from cookies
 */
export async function getSession() {
    const cookieStore = await cookies();
    const session = cookieStore.get(SESSION_COOKIE);
    if (!session?.value) return null;

    try {
        const [id, role] = session.value.split(':');
        if (!id || !role) return null;

        return { id, role };
    } catch (e) {
        return null;
    }
}

/**
 * Validates user credentials and sets a persistent session cookie
 */
export async function loginUser(username, password) {
    await dbConnect();
    const user = await User.findOne({ username });

    if (!user) return { error: 'User not found' };

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) return { error: 'Invalid credentials' };

    // Set Session Cookie
    const cookieStore = await cookies();

    // Cookie Options:
    // - httpOnly: Protects against XSS
    // - secure: false (Allowed for IP-based access without HTTPS)
    // - maxAge: 1 week (Persistence)
    cookieStore.set(SESSION_COOKIE, `${user._id}:${user.role}`, {
        httpOnly: true,
        secure: false,
        maxAge: 60 * 60 * 24 * 7,
        path: '/',
    });

    return { success: true, role: user.role };
}

/**
 * Clears the session cookie
 */
export async function logoutUser() {
    const cookieStore = await cookies();
    cookieStore.delete(SESSION_COOKIE);
}

/**
 * Helper to check if current session belongs to an admin
 */
export async function isAdmin() {
    const session = await getSession();
    return session?.role === 'admin';
}
