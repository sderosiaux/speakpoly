import { withAuth } from 'next-auth/middleware';
import { NextResponse } from 'next/server';

export default withAuth(
  function middleware(req) {
    const token = req.nextauth.token;
    const path = req.nextUrl.pathname;

    // Check if user is authenticated
    if (!token) {
      if (path.startsWith('/dashboard') || path.startsWith('/chat') || path.startsWith('/matches')) {
        return NextResponse.redirect(new URL('/auth/signin', req.url));
      }
    }

    // Check age verification for authenticated users
    if (token && !token.ageVerified) {
      if (!path.startsWith('/onboarding/age-gate') && !path.startsWith('/auth')) {
        return NextResponse.redirect(new URL('/onboarding/age-gate', req.url));
      }
    }

    // Check if user has completed onboarding
    if (token && token.ageVerified) {
      // This will be expanded to check for profile completion
      if (path === '/') {
        return NextResponse.redirect(new URL('/dashboard', req.url));
      }
    }

    return NextResponse.next();
  },
  {
    callbacks: {
      authorized: () => true, // We handle auth in the middleware function
    },
  }
);

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - api/auth (auth endpoints)
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - public folder
     */
    '/((?!api/auth|_next/static|_next/image|favicon.ico|public).*)',
  ],
};