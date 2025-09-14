'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useSession } from 'next-auth/react';
import toast from 'react-hot-toast';
import { config } from '@speakpoly/config';

export default function AgeGatePage() {
  const router = useRouter();
  const { data: session, update } = useSession();
  const [isLoading, setIsLoading] = useState(false);
  const [birthDate, setBirthDate] = useState('');

  const calculateAge = (birthDate: string): number => {
    const today = new Date();
    const birth = new Date(birthDate);
    let age = today.getFullYear() - birth.getFullYear();
    const monthDiff = today.getMonth() - birth.getMonth();

    if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birth.getDate())) {
      age--;
    }

    return age;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!birthDate) {
      toast.error('Please enter your date of birth');
      return;
    }

    const age = calculateAge(birthDate);

    if (age < config.app.minAge) {
      setIsLoading(true);

      // Track age gate failure
      await fetch('/api/analytics/track', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          event: config.analytics.events.AGE_GATE_FAILED,
          data: { age },
        }),
      }).catch(() => {});

      toast.error(`Sorry, you must be ${config.app.minAge} or older to use ${config.app.name}`);

      // Sign out and redirect
      setTimeout(() => {
        window.location.href = '/';
      }, 2000);

      return;
    }

    setIsLoading(true);

    try {
      const response = await fetch('/api/onboarding/age-verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ birthDate }),
      });

      if (!response.ok) {
        throw new Error('Failed to verify age');
      }

      // Track age gate success
      await fetch('/api/analytics/track', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          event: config.analytics.events.AGE_GATE_PASSED,
          data: { age },
        }),
      }).catch(() => {});

      // Update session
      await update();

      toast.success('Age verified successfully!');
      router.push('/onboarding/language-test');
    } catch (error) {
      toast.error('Failed to verify age. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-primary-50 to-secondary-50">
      <div className="bg-white rounded-2xl shadow-xl p-8 w-full max-w-md">
        <div className="text-center mb-8">
          <div className="w-20 h-20 bg-primary-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <svg
              className="w-10 h-10 text-primary-600"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"
              />
            </svg>
          </div>

          <h1 className="text-3xl font-bold text-neutral-900 mb-2">
            Age Verification Required
          </h1>
          <p className="text-neutral-600">
            {config.app.name} is for adults only. You must be {config.app.minAge} or older to continue.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          <div>
            <label
              htmlFor="birthDate"
              className="block text-sm font-medium text-neutral-700 mb-2"
            >
              Date of Birth
            </label>
            <input
              type="date"
              id="birthDate"
              value={birthDate}
              onChange={(e) => setBirthDate(e.target.value)}
              max={new Date().toISOString().split('T')[0]}
              className="input"
              disabled={isLoading}
              required
            />
            <p className="mt-2 text-xs text-neutral-500">
              We use this to verify you meet our age requirements. Your exact birthdate is not stored.
            </p>
          </div>

          <div className="bg-warning-50 border border-warning-200 rounded-lg p-4">
            <p className="text-sm text-warning-800">
              <strong>Important:</strong> By continuing, you confirm that you are {config.app.minAge} years or older and agree to our age verification policy.
            </p>
          </div>

          <button
            type="submit"
            disabled={isLoading}
            className="w-full btn-primary"
          >
            {isLoading ? 'Verifying...' : 'Verify Age'}
          </button>
        </form>

        <div className="mt-6 text-center">
          <p className="text-sm text-neutral-600">
            Why do we need this?{' '}
            <a
              href="/safety"
              target="_blank"
              className="text-primary-600 hover:text-primary-500"
            >
              Learn about our safety measures
            </a>
          </p>
        </div>
      </div>
    </div>
  );
}