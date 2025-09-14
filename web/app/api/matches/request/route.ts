import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { MatchingAlgorithm } from '@/services/matching/algorithm';
import { config } from '@speakpoly/config';

export async function POST(request: Request) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.id) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const body = await request.json();
    const { requestedId, message } = body;

    if (!requestedId) {
      return NextResponse.json(
        { error: 'Requested user ID is required' },
        { status: 400 }
      );
    }

    // Create match request using the algorithm
    const matchingAlgorithm = new MatchingAlgorithm();
    const matchRequest = await matchingAlgorithm.createMatchRequest(
      session.user.id,
      requestedId,
      message
    );

    // Track match request event
    await fetch('/api/analytics/track', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        event: config.analytics.events.MATCH_REQUESTED,
        data: {
          requestedId,
          hasMessage: !!message,
        },
      }),
    }).catch(() => {});

    return NextResponse.json({
      success: true,
      request: matchRequest,
    });
  } catch (error) {
    console.error('Match request error:', error);

    if (error instanceof Error) {
      return NextResponse.json(
        { error: error.message },
        { status: 400 }
      );
    }

    return NextResponse.json(
      { error: 'Failed to send match request' },
      { status: 500 }
    );
  }
}