import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { MatchingAlgorithm } from '@/services/matching/algorithm';
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

    // Check if user has completed profile
    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      include: {
        profile: true,
        interests: true,
        availability: true,
      },
    });

    if (!user?.profile || !user.interests || !user.availability) {
      return NextResponse.json(
        { error: 'Please complete your profile first' },
        { status: 400 }
      );
    }

    // Get matches using the algorithm
    const matchingAlgorithm = new MatchingAlgorithm();
    const matchScores = await matchingAlgorithm.findMatches(session.user.id, 20);

    // Get user details for each match
    const matchUserIds = matchScores.map(m => m.userId);
    const matchUsers = await prisma.user.findMany({
      where: {
        id: { in: matchUserIds },
      },
      include: {
        profile: true,
        interests: true,
        qualification: true,
      },
    });

    // Combine match scores with user data
    const matches = matchScores.map(score => {
      const user = matchUsers.find(u => u.id === score.userId);
      if (!user) return null;

      return {
        id: user.id,
        pseudonym: user.pseudonym,
        profile: user.profile,
        interests: user.interests,
        qualification: user.qualification || {
          reliabilityScore: 100,
          longevityWeeks: 0,
        },
        matchScore: score,
      };
    }).filter(Boolean);

    return NextResponse.json({
      matches,
      total: matches.length,
    });
  } catch (error) {
    console.error('Get matches error:', error);
    return NextResponse.json(
      { error: 'Failed to get matches' },
      { status: 500 }
    );
  }
}