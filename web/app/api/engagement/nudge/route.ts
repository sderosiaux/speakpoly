import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { engagementService } from '../../../../../services/engagement';

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { type, customMessage } = await request.json();

    if (!type) {
      return NextResponse.json({ error: 'Nudge type is required' }, { status: 400 });
    }

    const validTypes = ['welcome_back', 'session_reminder', 'milestone_celebration', 'streak_recovery', 'skill_progress', 'community_highlight'];
    if (!validTypes.includes(type)) {
      return NextResponse.json({ error: 'Invalid nudge type' }, { status: 400 });
    }

    const result = await engagementService.sendNudge(
      session.user.id,
      { type, timing: 'immediate' },
      customMessage
    );

    return NextResponse.json({
      success: true,
      nudgeId: result.id,
      message: result.message,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('Nudge API error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const limit = parseInt(searchParams.get('limit') || '10');
    const status = searchParams.get('status');

    const nudges = await engagementService.getUserNudges(session.user.id, {
      limit,
      status: status as 'sent' | 'delivered' | 'read' | undefined
    });

    return NextResponse.json({
      nudges,
      userId: session.user.id,
      generatedAt: new Date().toISOString()
    });

  } catch (error) {
    console.error('Get nudges API error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}