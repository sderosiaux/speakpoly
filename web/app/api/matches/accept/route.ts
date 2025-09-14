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
    const { requestId } = body;

    if (!requestId) {
      return NextResponse.json(
        { error: 'Request ID is required' },
        { status: 400 }
      );
    }

    // Accept match request using the algorithm
    const matchingAlgorithm = new MatchingAlgorithm();
    const pair = await matchingAlgorithm.acceptMatchRequest(
      requestId,
      session.user.id
    );

    // Track match acceptance
    await fetch('/api/analytics/track', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        event: config.analytics.events.MATCH_ACCEPTED,
        data: {
          requestId,
          pairId: pair.id,
        },
      }),
    }).catch(() => {});

    // Track pair creation
    await fetch('/api/analytics/track', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        event: config.analytics.events.PAIR_CREATED,
        data: {
          pairId: pair.id,
          partnerId: pair.userAId === session.user.id ? pair.userBId : pair.userAId,
        },
      }),
    }).catch(() => {});

    return NextResponse.json({
      success: true,
      pair,
    });
  } catch (error) {
    console.error('Accept match error:', error);

    if (error instanceof Error) {
      return NextResponse.json(
        { error: error.message },
        { status: 400 }
      );
    }

    return NextResponse.json(
      { error: 'Failed to accept match request' },
      { status: 500 }
    );
  }
}