import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { analyticsService } from '../../../../services/analytics';
import { PrismaClient } from '@speakpoly/database';

const prisma = new PrismaClient();

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const pairId = searchParams.get('pairId');

    if (!pairId) {
      return NextResponse.json({ error: 'Pair ID is required' }, { status: 400 });
    }

    // Verify user is part of this pair
    const pair = await prisma.pair.findUnique({
      where: { id: pairId },
      select: {
        userAId: true,
        userBId: true
      }
    });

    if (!pair) {
      return NextResponse.json({ error: 'Pair not found' }, { status: 404 });
    }

    const isParticipant = pair.userAId === session.user.id || pair.userBId === session.user.id;
    if (!isParticipant) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
    }

    const analytics = await analyticsService.getPairAnalytics(pairId);

    return NextResponse.json({
      pairId,
      ...analytics,
      generatedAt: new Date().toISOString()
    });

  } catch (error) {
    console.error('Pair analytics error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}