import Link from 'next/link';
import { config } from '@speakpoly/config';

export default function HomePage() {
  return (
    <div className="min-h-screen">
      {/* Navigation */}
      <nav className="fixed top-0 w-full bg-white/80 backdrop-blur-md border-b border-neutral-200 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center">
              <h1 className="text-2xl font-bold text-primary-600">
                {config.app.name}
              </h1>
            </div>
            <div className="flex items-center gap-4">
              <Link
                href="/auth/signin"
                className="text-neutral-700 hover:text-primary-600 font-medium transition-colors"
              >
                Sign In
              </Link>
              <Link
                href="/auth/signup"
                className="btn-primary"
              >
                Get Started
              </Link>
            </div>
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="pt-24 pb-12 px-4 bg-gradient-to-br from-primary-50 via-white to-secondary-50">
        <div className="max-w-7xl mx-auto">
          <div className="text-center py-20">
            <h2 className="text-5xl sm:text-6xl font-bold text-neutral-900 mb-6">
              {config.app.tagline}
            </h2>
            <p className="text-xl text-neutral-600 max-w-3xl mx-auto mb-10">
              Connect with native speakers who want to learn your language.
              Build lasting language partnerships through real conversations,
              not quick matches.
            </p>
            <div className="flex gap-4 justify-center">
              <Link
                href="/auth/signup"
                className="btn-primary text-lg px-8 py-3"
              >
                Start Learning Free
              </Link>
              <Link
                href="#how-it-works"
                className="btn-outline text-lg px-8 py-3"
              >
                How It Works
              </Link>
            </div>
            <p className="mt-4 text-sm text-neutral-500">
              Adults only (18+) • No credit card required
            </p>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section className="py-20 px-4 bg-white">
        <div className="max-w-7xl mx-auto">
          <h3 className="text-3xl font-bold text-center text-neutral-900 mb-12">
            Why Choose SpeakPoly?
          </h3>
          <div className="grid md:grid-cols-3 gap-8">
            <div className="text-center">
              <div className="w-16 h-16 bg-primary-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <svg className="w-8 h-8 text-primary-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                </svg>
              </div>
              <h4 className="text-xl font-semibold mb-2">Strict Native Matching</h4>
              <p className="text-neutral-600">
                Only connect with native speakers learning your language.
                Perfect language exchange balance.
              </p>
            </div>
            <div className="text-center">
              <div className="w-16 h-16 bg-secondary-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <svg className="w-8 h-8 text-secondary-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                </svg>
              </div>
              <h4 className="text-xl font-semibold mb-2">Safe & Secure</h4>
              <p className="text-neutral-600">
                All conversations stay on platform. Contact information
                automatically protected. Adults only (18+).
              </p>
            </div>
            <div className="text-center">
              <div className="w-16 h-16 bg-accent-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <svg className="w-8 h-8 text-accent-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                </svg>
              </div>
              <h4 className="text-xl font-semibold mb-2">AI-Powered Learning</h4>
              <p className="text-neutral-600">
                Smart topic suggestions, session summaries, and progress
                tracking to accelerate your learning.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* How It Works Section */}
      <section id="how-it-works" className="py-20 px-4 bg-neutral-50">
        <div className="max-w-7xl mx-auto">
          <h3 className="text-3xl font-bold text-center text-neutral-900 mb-12">
            How It Works
          </h3>
          <div className="grid md:grid-cols-4 gap-8">
            <div className="text-center">
              <div className="text-4xl font-bold text-primary-500 mb-4">1</div>
              <h4 className="font-semibold mb-2">Sign Up & Verify</h4>
              <p className="text-sm text-neutral-600">
                Create your profile and verify your age (18+)
              </p>
            </div>
            <div className="text-center">
              <div className="text-4xl font-bold text-primary-500 mb-4">2</div>
              <h4 className="font-semibold mb-2">Take Language Test</h4>
              <p className="text-sm text-neutral-600">
                Quick 3-5 minute test to assess your level
              </p>
            </div>
            <div className="text-center">
              <div className="text-4xl font-bold text-primary-500 mb-4">3</div>
              <h4 className="font-semibold mb-2">Get Matched</h4>
              <p className="text-sm text-neutral-600">
                Connect with compatible native speakers
              </p>
            </div>
            <div className="text-center">
              <div className="text-4xl font-bold text-primary-500 mb-4">4</div>
              <h4 className="font-semibold mb-2">Start Talking</h4>
              <p className="text-sm text-neutral-600">
                Chat, voice notes, and calls to practice
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Languages Section */}
      <section className="py-20 px-4 bg-white">
        <div className="max-w-7xl mx-auto text-center">
          <h3 className="text-3xl font-bold text-neutral-900 mb-8">
            Languages Available at Launch
          </h3>
          <div className="flex justify-center gap-8 flex-wrap">
            <div className="flex items-center gap-2">
              <span className="text-4xl">🇬🇧</span>
              <span className="text-lg font-medium">English</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-4xl">🇫🇷</span>
              <span className="text-lg font-medium">French</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-4xl">🇪🇸</span>
              <span className="text-lg font-medium">Spanish</span>
            </div>
          </div>
          <p className="mt-8 text-neutral-600">
            More languages coming soon!
          </p>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-20 px-4 bg-gradient-to-r from-primary-600 to-secondary-600">
        <div className="max-w-4xl mx-auto text-center">
          <h3 className="text-4xl font-bold text-white mb-6">
            Ready to Start Your Language Journey?
          </h3>
          <p className="text-xl text-white/90 mb-8">
            Join thousands of language learners building real connections
          </p>
          <Link
            href="/auth/signup"
            className="inline-block bg-white text-primary-600 px-8 py-3 rounded-lg font-semibold hover:bg-neutral-100 transition-colors"
          >
            Get Started Free
          </Link>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-12 px-4 bg-neutral-900 text-white">
        <div className="max-w-7xl mx-auto">
          <div className="grid md:grid-cols-4 gap-8">
            <div>
              <h5 className="text-xl font-bold mb-4">{config.app.name}</h5>
              <p className="text-neutral-400 text-sm">
                Safe language exchange for adults
              </p>
            </div>
            <div>
              <h6 className="font-semibold mb-3">Product</h6>
              <ul className="space-y-2 text-sm text-neutral-400">
                <li><Link href="/features" className="hover:text-white">Features</Link></li>
                <li><Link href="/pricing" className="hover:text-white">Pricing</Link></li>
                <li><Link href="/languages" className="hover:text-white">Languages</Link></li>
              </ul>
            </div>
            <div>
              <h6 className="font-semibold mb-3">Company</h6>
              <ul className="space-y-2 text-sm text-neutral-400">
                <li><Link href="/about" className="hover:text-white">About</Link></li>
                <li><Link href="/blog" className="hover:text-white">Blog</Link></li>
                <li><Link href="/careers" className="hover:text-white">Careers</Link></li>
              </ul>
            </div>
            <div>
              <h6 className="font-semibold mb-3">Legal</h6>
              <ul className="space-y-2 text-sm text-neutral-400">
                <li><Link href="/terms" className="hover:text-white">Terms</Link></li>
                <li><Link href="/privacy" className="hover:text-white">Privacy</Link></li>
                <li><Link href="/safety" className="hover:text-white">Safety</Link></li>
              </ul>
            </div>
          </div>
          <div className="mt-8 pt-8 border-t border-neutral-800 text-center text-sm text-neutral-400">
            © 2024 {config.app.name}. All rights reserved.
          </div>
        </div>
      </footer>
    </div>
  );
}