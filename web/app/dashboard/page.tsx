'use client';

import { useSession } from 'next-auth/react';
import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import toast from 'react-hot-toast';
import { format } from 'date-fns';

interface DashboardData {
  user: any;
  profile: any;
  activePairs: any[];
  pendingRequests: any[];
  stats: {
    totalHours: number;
    wordsLearned: number;
    currentStreak: number;
    pairsFormed: number;
  };
}

export default function DashboardPage() {
  const { data: session } = useSession();
  const router = useRouter();
  const [data, setData] = useState<DashboardData | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (!session?.user) {
      router.push('/auth/signin');
      return;
    }

    fetchDashboardData();
  }, [session]);

  const fetchDashboardData = async () => {
    try {
      const response = await fetch('/api/dashboard');
      if (!response.ok) throw new Error('Failed to fetch dashboard data');
      const dashboardData = await response.json();
      setData(dashboardData);
    } catch (error) {
      toast.error('Failed to load dashboard');
    } finally {
      setIsLoading(false);
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-pulse text-primary-600">Loading...</div>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-neutral-900 mb-4">
            Complete Your Profile
          </h1>
          <p className="text-neutral-600 mb-6">
            Please complete your profile to start matching with language partners
          </p>
          <Link href="/onboarding/language-test" className="btn-primary">
            Complete Profile
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-neutral-50">
      {/* Header */}
      <header className="bg-white border-b border-neutral-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center gap-8">
              <h1 className="text-xl font-bold text-primary-600">SpeakPoly</h1>
              <nav className="hidden md:flex gap-6">
                <Link href="/dashboard" className="text-primary-600 font-medium">
                  Dashboard
                </Link>
                <Link href="/matches" className="text-neutral-600 hover:text-primary-600">
                  Find Partners
                </Link>
                <Link href="/chat" className="text-neutral-600 hover:text-primary-600">
                  Messages
                </Link>
                <Link href="/progress" className="text-neutral-600 hover:text-primary-600">
                  Progress
                </Link>
              </nav>
            </div>
            <div className="flex items-center gap-4">
              <span className="text-sm text-neutral-600">
                {data.user?.pseudonym}
              </span>
              <button
                onClick={() => router.push('/settings')}
                className="p-2 hover:bg-neutral-100 rounded-lg"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
              </button>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Welcome Section */}
        <div className="bg-white rounded-xl shadow-sm p-6 mb-8">
          <h2 className="text-2xl font-bold text-neutral-900 mb-2">
            Welcome back, {data.user?.pseudonym}!
          </h2>
          <p className="text-neutral-600">
            Learning {data.profile?.learningLanguage?.toUpperCase()} at level {data.profile?.learningLevel}
          </p>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
          <div className="bg-white rounded-xl shadow-sm p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-neutral-600">Total Hours</p>
                <p className="text-2xl font-bold text-neutral-900">
                  {data.stats.totalHours}
                </p>
              </div>
              <div className="p-3 bg-primary-100 rounded-lg">
                <svg className="w-6 h-6 text-primary-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-xl shadow-sm p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-neutral-600">Words Learned</p>
                <p className="text-2xl font-bold text-neutral-900">
                  {data.stats.wordsLearned}
                </p>
              </div>
              <div className="p-3 bg-secondary-100 rounded-lg">
                <svg className="w-6 h-6 text-secondary-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
                </svg>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-xl shadow-sm p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-neutral-600">Current Streak</p>
                <p className="text-2xl font-bold text-neutral-900">
                  {data.stats.currentStreak} days
                </p>
              </div>
              <div className="p-3 bg-accent-100 rounded-lg">
                <svg className="w-6 h-6 text-accent-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 18.657A8 8 0 016.343 7.343S7 9 9 10c0-2 .5-5 2.986-7C14 5 16.09 5.777 17.656 7.343A7.975 7.975 0 0120 13a7.975 7.975 0 01-2.343 5.657z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.879 16.121A3 3 0 1012.015 11L11 14H9c0 .768.293 1.536.879 2.121z" />
                </svg>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-xl shadow-sm p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-neutral-600">Partners</p>
                <p className="text-2xl font-bold text-neutral-900">
                  {data.stats.pairsFormed}
                </p>
              </div>
              <div className="p-3 bg-success-100 rounded-lg">
                <svg className="w-6 h-6 text-success-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                </svg>
              </div>
            </div>
          </div>
        </div>

        {/* Active Pairs and Pending Requests */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Active Pairs */}
          <div className="bg-white rounded-xl shadow-sm p-6">
            <h3 className="text-lg font-semibold text-neutral-900 mb-4">
              Active Language Partners
            </h3>
            {data.activePairs.length === 0 ? (
              <div className="text-center py-8">
                <p className="text-neutral-600 mb-4">No active partners yet</p>
                <Link href="/matches" className="btn-primary">
                  Find Partners
                </Link>
              </div>
            ) : (
              <div className="space-y-4">
                {data.activePairs.map((pair) => (
                  <div
                    key={pair.id}
                    className="flex items-center justify-between p-4 border border-neutral-200 rounded-lg hover:bg-neutral-50"
                  >
                    <div>
                      <p className="font-medium text-neutral-900">
                        {pair.partner.pseudonym}
                      </p>
                      <p className="text-sm text-neutral-600">
                        Native {pair.partner.profile?.nativeLanguages[0]?.toUpperCase()} speaker
                      </p>
                      <p className="text-xs text-neutral-500">
                        Paired {format(new Date(pair.startedAt), 'MMM d, yyyy')}
                      </p>
                    </div>
                    <Link
                      href={`/chat/${pair.id}`}
                      className="btn-primary text-sm"
                    >
                      Chat
                    </Link>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Pending Requests */}
          <div className="bg-white rounded-xl shadow-sm p-6">
            <h3 className="text-lg font-semibold text-neutral-900 mb-4">
              Pending Match Requests
            </h3>
            {data.pendingRequests.length === 0 ? (
              <div className="text-center py-8">
                <p className="text-neutral-600">No pending requests</p>
              </div>
            ) : (
              <div className="space-y-4">
                {data.pendingRequests.map((request) => (
                  <div
                    key={request.id}
                    className="p-4 border border-neutral-200 rounded-lg"
                  >
                    <div className="flex items-center justify-between mb-2">
                      <p className="font-medium text-neutral-900">
                        {request.requester.pseudonym}
                      </p>
                      <span className="text-xs text-neutral-500">
                        {format(new Date(request.createdAt), 'MMM d')}
                      </span>
                    </div>
                    <p className="text-sm text-neutral-600 mb-3">
                      Learning {request.requester.profile?.learningLanguage?.toUpperCase()} at {request.requester.profile?.learningLevel}
                    </p>
                    {request.message && (
                      <p className="text-sm text-neutral-700 italic mb-3">
                        "{request.message}"
                      </p>
                    )}
                    <div className="flex gap-2">
                      <button
                        onClick={() => handleAcceptRequest(request.id)}
                        className="flex-1 btn-primary text-sm"
                      >
                        Accept
                      </button>
                      <button
                        onClick={() => handleRejectRequest(request.id)}
                        className="flex-1 btn-outline text-sm"
                      >
                        Decline
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  );

  async function handleAcceptRequest(requestId: string) {
    try {
      const response = await fetch('/api/matches/accept', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ requestId }),
      });

      if (!response.ok) throw new Error('Failed to accept request');

      toast.success('Match request accepted!');
      fetchDashboardData();
    } catch (error) {
      toast.error('Failed to accept request');
    }
  }

  async function handleRejectRequest(requestId: string) {
    try {
      const response = await fetch('/api/matches/reject', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ requestId }),
      });

      if (!response.ok) throw new Error('Failed to reject request');

      toast.success('Request declined');
      fetchDashboardData();
    } catch (error) {
      toast.error('Failed to decline request');
    }
  }
}