'use client';

import { useState, useEffect } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import toast from 'react-hot-toast';
import { format } from 'date-fns';
import type { MatchScore } from '@speakpoly/types';

interface MatchCandidate {
  id: string;
  pseudonym: string;
  profile: {
    nativeLanguages: string[];
    learningLanguage: string;
    learningLevel: string;
    motives: string[];
  };
  interests: {
    tags: string[];
  };
  qualification: {
    reliabilityScore: number;
    longevityWeeks: number;
  };
  matchScore: MatchScore;
}

export default function MatchesPage() {
  const { data: session } = useSession();
  const router = useRouter();
  const [matches, setMatches] = useState<MatchCandidate[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedMatch, setSelectedMatch] = useState<MatchCandidate | null>(null);
  const [requestMessage, setRequestMessage] = useState('');
  const [sendingRequest, setSendingRequest] = useState(false);

  useEffect(() => {
    if (!session?.user) {
      router.push('/auth/signin');
      return;
    }

    fetchMatches();
  }, [session]);

  const fetchMatches = async () => {
    try {
      const response = await fetch('/api/matches');
      if (!response.ok) throw new Error('Failed to fetch matches');
      const data = await response.json();
      setMatches(data.matches);
    } catch (error) {
      toast.error('Failed to load matches');
    } finally {
      setIsLoading(false);
    }
  };

  const sendMatchRequest = async () => {
    if (!selectedMatch) return;

    setSendingRequest(true);
    try {
      const response = await fetch('/api/matches/request', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          requestedId: selectedMatch.id,
          message: requestMessage,
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to send request');
      }

      toast.success('Match request sent!');
      setSelectedMatch(null);
      setRequestMessage('');

      // Remove this match from the list
      setMatches(matches.filter(m => m.id !== selectedMatch.id));
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to send request');
    } finally {
      setSendingRequest(false);
    }
  };

  const getScoreColor = (score: number) => {
    if (score >= 0.8) return 'text-success-600 bg-success-100';
    if (score >= 0.6) return 'text-primary-600 bg-primary-100';
    if (score >= 0.4) return 'text-warning-600 bg-warning-100';
    return 'text-neutral-600 bg-neutral-100';
  };

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-pulse text-primary-600">Finding compatible partners...</div>
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
                <a href="/dashboard" className="text-neutral-600 hover:text-primary-600">
                  Dashboard
                </a>
                <a href="/matches" className="text-primary-600 font-medium">
                  Find Partners
                </a>
                <a href="/chat" className="text-neutral-600 hover:text-primary-600">
                  Messages
                </a>
                <a href="/progress" className="text-neutral-600 hover:text-primary-600">
                  Progress
                </a>
              </nav>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="mb-8">
          <h2 className="text-2xl font-bold text-neutral-900 mb-2">
            Compatible Language Partners
          </h2>
          <p className="text-neutral-600">
            Native speakers learning your language, matched by availability and interests
          </p>
        </div>

        {matches.length === 0 ? (
          <div className="bg-white rounded-xl shadow-sm p-12 text-center">
            <svg className="w-16 h-16 text-neutral-400 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
            </svg>
            <h3 className="text-lg font-semibold text-neutral-900 mb-2">
              No matches available right now
            </h3>
            <p className="text-neutral-600 mb-4">
              Check back later as more language learners join
            </p>
            <button
              onClick={fetchMatches}
              className="btn-primary"
            >
              Refresh Matches
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {matches.map((match) => (
              <div
                key={match.id}
                className="bg-white rounded-xl shadow-sm overflow-hidden hover:shadow-lg transition-shadow"
              >
                <div className="p-6">
                  <div className="flex justify-between items-start mb-4">
                    <div>
                      <h3 className="text-xl font-semibold text-neutral-900">
                        {match.pseudonym}
                      </h3>
                      <p className="text-sm text-neutral-600">
                        Native {match.profile.nativeLanguages[0]?.toUpperCase()} speaker
                      </p>
                    </div>
                    <span className={`px-2 py-1 rounded-full text-xs font-medium ${getScoreColor(match.matchScore.score)}`}>
                      {Math.round(match.matchScore.score * 100)}% match
                    </span>
                  </div>

                  <div className="space-y-3 mb-4">
                    <div>
                      <p className="text-xs text-neutral-500 uppercase tracking-wide mb-1">
                        Learning
                      </p>
                      <p className="text-sm font-medium">
                        {match.profile.learningLanguage.toUpperCase()} - Level {match.profile.learningLevel}
                      </p>
                    </div>

                    <div>
                      <p className="text-xs text-neutral-500 uppercase tracking-wide mb-1">
                        Motivations
                      </p>
                      <div className="flex flex-wrap gap-1">
                        {match.profile.motives.map((motive) => (
                          <span
                            key={motive}
                            className="px-2 py-1 bg-neutral-100 text-neutral-700 text-xs rounded capitalize"
                          >
                            {motive}
                          </span>
                        ))}
                      </div>
                    </div>

                    <div>
                      <p className="text-xs text-neutral-500 uppercase tracking-wide mb-1">
                        Common Interests
                      </p>
                      <div className="flex flex-wrap gap-1">
                        {match.interests.tags.slice(0, 5).map((interest) => (
                          <span
                            key={interest}
                            className="px-2 py-1 bg-primary-50 text-primary-700 text-xs rounded capitalize"
                          >
                            {interest}
                          </span>
                        ))}
                        {match.interests.tags.length > 5 && (
                          <span className="text-xs text-neutral-500">
                            +{match.interests.tags.length - 5} more
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center justify-between text-xs text-neutral-500 mb-4">
                    <span>⏰ {Math.round(match.matchScore.components.timeOverlap * 10)} hrs overlap</span>
                    <span>⭐ {match.qualification.reliabilityScore}% reliable</span>
                  </div>

                  <button
                    onClick={() => setSelectedMatch(match)}
                    className="w-full btn-primary"
                  >
                    Send Request
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </main>

      {/* Match Request Modal */}
      {selectedMatch && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-xl shadow-xl p-6 w-full max-w-md">
            <h3 className="text-lg font-semibold text-neutral-900 mb-4">
              Send Match Request to {selectedMatch.pseudonym}
            </h3>

            <div className="mb-4">
              <label className="block text-sm font-medium text-neutral-700 mb-2">
                Optional Message
              </label>
              <textarea
                value={requestMessage}
                onChange={(e) => setRequestMessage(e.target.value)}
                placeholder="Introduce yourself and share why you'd like to practice together..."
                className="w-full p-3 border border-neutral-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
                rows={4}
                maxLength={200}
              />
              <p className="text-xs text-neutral-500 mt-1">
                {requestMessage.length}/200 characters
              </p>
            </div>

            <div className="flex gap-3">
              <button
                onClick={() => {
                  setSelectedMatch(null);
                  setRequestMessage('');
                }}
                className="flex-1 btn-outline"
                disabled={sendingRequest}
              >
                Cancel
              </button>
              <button
                onClick={sendMatchRequest}
                className="flex-1 btn-primary"
                disabled={sendingRequest}
              >
                {sendingRequest ? 'Sending...' : 'Send Request'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}