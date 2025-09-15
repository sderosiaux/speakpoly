import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { analyticsService } from '../../../../services/analytics';

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { event, metadata } = await request.json();

    if (!event) {
      return NextResponse.json({ error: 'Event type is required' }, { status: 400 });
    }

    // Validate event types
    const validEvents = [
      'session_started',
      'session_ended',
      'message_sent',
      'topic_viewed',
      'summary_generated',
      'pair_created',
      'profile_updated',
      'settings_changed',
      'dashboard_viewed',
      'matches_viewed'
    ];

    if (!validEvents.includes(event)) {
      return NextResponse.json({ error: 'Invalid event type' }, { status: 400 });
    }

    await analyticsService.trackActivity(session.user.id, event, metadata);

    return NextResponse.json({
      success: true,
      event,
      userId: session.user.id,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('Activity tracking error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}