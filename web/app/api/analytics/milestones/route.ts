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
    const userId = searchParams.get('userId') || session.user.id;

    // Users can only access their own milestones unless they're admin
    if (userId !== session.user.id) {
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

    const milestones = await analyticsService.getUserMilestones(userId);

    return NextResponse.json({
      userId,
      milestones,
      generatedAt: new Date().toISOString()
    });

  } catch (error) {
    console.error('Milestones error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}