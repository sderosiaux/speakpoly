import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { aiService } from '../../../../services/ai';
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
    const count = parseInt(searchParams.get('count') || '3');

    if (!pairId) {
      return NextResponse.json({ error: 'Pair ID is required' }, { status: 400 });
    }

    // Get pair with user profiles
    const pair = await prisma.pair.findUnique({
      where: { id: pairId },
      include: {
        userA: {
          include: {
            profile: true,
            interests: true
          }
        },
        userB: {
          include: {
            profile: true,
            interests: true
          }
        }
      }
    });

    if (!pair) {
      return NextResponse.json({ error: 'Pair not found' }, { status: 404 });
    }

    // Check if user is participant
    const isParticipant = pair.userA.id === session.user.id || pair.userB.id === session.user.id;
    if (!isParticipant) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
    }

    // Generate contextual conversation starters
    const starters = await aiService.generateContextualStarters(
      pair.userA,
      pair.userB,
      count
    );

    return NextResponse.json({
      starters,
      pairId,
      generatedAt: new Date().toISOString()
    });

  } catch (error) {
    console.error('Starters generation error:', error);
    return NextResponse.json(
      { error: 'Failed to generate conversation starters' },
      { status: 500 }
    );
  }
}