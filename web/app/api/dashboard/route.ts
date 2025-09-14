import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@speakpoly/database';

export async function GET(request: Request) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.id) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // Get user with profile
    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      include: {
        profile: true,
        interests: true,
        qualification: true,
      },
    });

    if (!user) {
      return NextResponse.json(
        { error: 'User not found' },
        { status: 404 }
      );
    }

    // Check if profile is complete
    if (!user.profile || !user.interests) {
      return NextResponse.json({
        user,
        profile: null,
        activePairs: [],
        pendingRequests: [],
        stats: {
          totalHours: 0,
          wordsLearned: 0,
          currentStreak: 0,
          pairsFormed: 0,
        },
      });
    }

    // Get active pairs
    const activePairs = await prisma.pair.findMany({
      where: {
        OR: [
          { userAId: session.user.id },
          { userBId: session.user.id },
        ],
        status: 'ACTIVE',
      },
      include: {
        userA: {
          include: {
            profile: true,
          },
        },
        userB: {
          include: {
            profile: true,
          },
        },
      },
    });

    // Format pairs to show the partner
    const formattedPairs = activePairs.map(pair => {
      const isUserA = pair.userAId === session.user.id;
      const partner = isUserA ? pair.userB : pair.userA;
      return {
        id: pair.id,
        partner,
        startedAt: pair.startedAt,
        lastActivityAt: pair.lastActivityAt,
        minutesTotal: pair.minutesTotal,
      };
    });

    // Get pending requests received
    const pendingRequests = await prisma.matchRequest.findMany({
      where: {
        requestedId: session.user.id,
        status: 'pending',
      },
      include: {
        requester: {
          include: {
            profile: true,
          },
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
    });

    // Calculate stats
    const stats = {
      totalHours: Math.round((user.qualification?.depthScore || 0) / 60),
      wordsLearned: 0, // Will be calculated from summaries
      currentStreak: user.qualification?.consistencyWeeks || 0,
      pairsFormed: activePairs.length,
    };

    // Get word count from summaries
    const summaries = await prisma.summary.findMany({
      where: {
        session: {
          pair: {
            OR: [
              { userAId: session.user.id },
              { userBId: session.user.id },
            ],
          },
        },
      },
    });

    stats.wordsLearned = summaries.reduce((total, summary) => {
      const newWords = summary.newWords as any[];
      return total + (newWords?.length || 0);
    }, 0);

    return NextResponse.json({
      user: {
        id: user.id,
        pseudonym: user.pseudonym,
        email: user.email,
        createdAt: user.createdAt,
      },
      profile: user.profile,
      activePairs: formattedPairs,
      pendingRequests,
      stats,
    });
  } catch (error) {
    console.error('Dashboard error:', error);
    return NextResponse.json(
      { error: 'Failed to load dashboard data' },
      { status: 500 }
    );
  }
}