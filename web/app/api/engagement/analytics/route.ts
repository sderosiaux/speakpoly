import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { engagementService } from '../../../../../services/engagement';

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const timeframe = searchParams.get('timeframe') as 'week' | 'month' | 'all' || 'month';

    const engagementAnalytics = await engagementService.analyzeUserEngagement(session.user.id, timeframe);

    return NextResponse.json({
      ...engagementAnalytics,
      userId: session.user.id,
      timeframe,
      generatedAt: new Date().toISOString()
    });

  } catch (error) {
    console.error('Engagement analytics API error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}