import { NextResponse } from 'next/server';

/**
 * Middleware to handle Authentication and Route Protection
 * 
 * Logic:
 * 1. Identify public paths (like /login)
 * 2. If NO session and NOT public: redirect to /login (allow static assets)
 * 3. IF session and IS public: redirect to /
 */
export function middleware(request) {
    const session = request.cookies.get('gallery_session');
    const { pathname } = request.nextUrl;

    // Configuration
    const PUBLIC_PATHS = ['/login'];
    const isPublicPath = PUBLIC_PATHS.includes(pathname);

    // Case A: Unauthenticated access to protected regions
    if (!session && !isPublicPath) {
        // Allow Next.js internal files, API routes, and static assets (extensions)
        const isInternalFile = pathname.startsWith('/_next') ||
            pathname.startsWith('/api') ||
            pathname.includes('.');

        if (!isInternalFile) {
            const loginUrl = new URL('/login', request.url);
            return NextResponse.redirect(loginUrl);
        }
    }

    // Case B: Authenticated user attempting to visit login page
    if (session && isPublicPath) {
        return NextResponse.redirect(new URL('/', request.url));
    }

    return NextResponse.next();
}

/**
 * Matcher ensures middleware only runs on meaningful routes
 */
export const config = {
    matcher: [
        /*
         * Match all request paths except for:
         * - _next/static (static files)
         * - _next/image (image optimization files)
         * - favicon.ico (favicon file)
         */
        '/((?!_next/static|_next/image|favicon.ico).*)',
    ],
};
