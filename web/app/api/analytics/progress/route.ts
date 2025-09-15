import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { analyticsService } from '../../../../services/analytics';

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const timeframe = searchParams.get('timeframe') as 'week' | 'month' | 'all' || 'month';
    const userId = searchParams.get('userId') || session.user.id;

    // Users can only access their own progress unless they're admin
    if (userId !== session.user.id) {
      // Check if user is admin
      const { PrismaClient } = await import('@speakpoly/database');
      const prisma = new PrismaClient();

      const user = await prisma.user.findUnique({
        where: { id: session.user.id },
        select: { role: true }
      });

      if (user?.role !== 'ADMIN') {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
      }
    }

    const progress = await analyticsService.getUserProgress(userId, timeframe);

    return NextResponse.json({
      userId,
      timeframe,
      ...progress,
      generatedAt: new Date().toISOString()
    });

  } catch (error) {
    console.error('Progress analytics error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}