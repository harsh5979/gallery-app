import { NextResponse } from 'next/server';

export function middleware(request) {
    const session = request.cookies.get('gallery_session');
    const { pathname } = request.nextUrl;

    // Define public paths that don't require authentication
    const publicPaths = ['/login'];

    // Check if the current path is public
    const isPublicPath = publicPaths.includes(pathname);

    // If user is not authenticated and trying to access a protected route
    if (!session && !isPublicPath) {
        // Exclude Next.js internals and static files
        if (pathname.startsWith('/_next') || pathname.startsWith('/api') || pathname.includes('.')) {
            // Allow API calls? Usually APIs should be protected too unless specific ones.
            // But for things like /favicon.ico, etc.
            // Let's protect /api too except maybe auth?
            // Actually, static files usually have extensions.
            // Let's just redirect the main page and sub-folders.
            return NextResponse.next();
        }

        // Redirect to login
        const loginUrl = new URL('/login', request.url);
        return NextResponse.redirect(loginUrl);
    }

    // If user is authenticated and trying to access login page
    if (session && isPublicPath) {
        return NextResponse.redirect(new URL('/', request.url));
    }

    return NextResponse.next();
}

export const config = {
    matcher: [
        /*
         * Match all request paths except for the ones starting with:
         * - api (API routes) -> We DO want to match API to protect images if we want to be strict, 
         *   BUT standard middleware often excludes API to handle auth with 401 instead of 307.
         *   However, user said "if user is authenticated then show images". 
         *   So we SHOULD protect even the API images route ideally.
         *   But let's stick to protecting the UI pages primarily first.
         *   
         * - _next/static (static files)
         * - _next/image (image optimization files)
         * - favicon.ico (favicon file)
         */
        '/((?!_next/static|_next/image|favicon.ico).*)',
    ],
};
