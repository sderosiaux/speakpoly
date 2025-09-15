import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@speakpoly/database';

export async function GET(
  request: Request,
  { params }: { params: { pairId: string } }
) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.id) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const { pairId } = params;

    // Get pair data and verify user access
    const pair = await prisma.pair.findFirst({
      where: {
        id: pairId,
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
        messages: {
          include: {
            sender: {
              select: {
                id: true,
                pseudonym: true,
              },
            },
          },
          orderBy: {
            createdAt: 'asc',
          },
          take: 50, // Limit to last 50 messages
        },
      },
    });

    if (!pair) {
      return NextResponse.json(
        { error: 'Pair not found or access denied' },
        { status: 404 }
      );
    }

    // Determine partner
    const isUserA = pair.userAId === session.user.id;
    const partner = isUserA ? pair.userB : pair.userA;

    // Format messages
    const messages = pair.messages.map(message => ({
      id: message.id,
      content: message.body || '',
      type: message.type,
      voiceUrl: message.voiceUrl,
      duration: message.duration,
      sender: message.sender,
      createdAt: message.createdAt.toISOString(),
      redacted: !!message.redactions,
    }));

    return NextResponse.json({
      id: pair.id,
      partner: {
        id: partner.id,
        pseudonym: partner.pseudonym,
        profile: partner.profile,
      },
      messages,
      startedAt: pair.startedAt,
      lastActivityAt: pair.lastActivityAt,
    });
  } catch (error) {
    console.error('Get chat error:', error);
    return NextResponse.json(
      { error: 'Failed to load chat' },
      { status: 500 }
    );
  }
}