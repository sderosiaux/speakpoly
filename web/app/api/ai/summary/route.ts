import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { aiService } from '../../../../services/ai';
import { PrismaClient } from '@speakpoly/database';

const prisma = new PrismaClient();

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { sessionId } = await request.json();

    if (!sessionId) {
      return NextResponse.json({ error: 'Session ID is required' }, { status: 400 });
    }

    // Get session with messages and participants
    const sessionData = await prisma.session.findUnique({
      where: { id: sessionId },
      include: {
        pair: {
          include: {
            userA: {
              include: {
                profile: true
              }
            },
            userB: {
              include: {
                profile: true
              }
            },
            messages: {
              where: {
                type: 'TEXT',
                body: { not: null },
                deletedAt: null
              },
              orderBy: { createdAt: 'asc' },
              include: {
                sender: true
              }
            }
          }
        },
        summary: true
      }
    });

    if (!sessionData) {
      return NextResponse.json({ error: 'Session not found' }, { status: 404 });
    }

    // Check if user is participant in this session
    const isParticipant = sessionData.pair.userA.id === session.user.id ||
                         sessionData.pair.userB.id === session.user.id;

    if (!isParticipant) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
    }

    // Check if summary already exists
    if (sessionData.summary) {
      return NextResponse.json({
        summary: JSON.parse(sessionData.summary.newWords),
        alreadyExists: true
      });
    }

    // Check if conversation is suitable for analysis
    if (!aiService.isConversationAnalyzable(sessionData.pair.messages)) {
      return NextResponse.json({
        error: 'Conversation too short for meaningful analysis'
      }, { status: 400 });
    }

    // Prepare messages for AI analysis
    const messages = sessionData.pair.messages.map(msg => ({
      content: msg.body || '',
      senderId: msg.senderId,
      language: msg.senderId === sessionData.pair.userA.id
        ? sessionData.pair.userA.profile?.nativeLanguages[0] || 'en'
        : sessionData.pair.userB.profile?.nativeLanguages[0] || 'en',
      timestamp: msg.createdAt
    }));

    // Prepare participant info
    const participants = [
      {
        id: sessionData.pair.userA.id,
        nativeLanguages: sessionData.pair.userA.profile?.nativeLanguages || ['en'],
        learningLanguage: sessionData.pair.userA.profile?.learningLanguage || 'en',
        level: sessionData.pair.userA.profile?.currentLevel || 'A1'
      },
      {
        id: sessionData.pair.userB.id,
        nativeLanguages: sessionData.pair.userB.profile?.nativeLanguages || ['en'],
        learningLanguage: sessionData.pair.userB.profile?.learningLanguage || 'en',
        level: sessionData.pair.userB.profile?.currentLevel || 'A1'
      }
    ];

    // Calculate session duration
    const startTime = sessionData.startedAt;
    const endTime = sessionData.endedAt || new Date();
    const durationMinutes = Math.round((endTime.getTime() - startTime.getTime()) / (1000 * 60));

    // Generate AI summary
    const result = await aiService.generateConversationSummary({
      messages,
      participants,
      sessionDuration: durationMinutes
    });

    // Save summary to database
    const savedSummary = await prisma.summary.create({
      data: {
        sessionId: sessionData.id,
        newWords: JSON.stringify(result.summary.newWords),
        commonMistakes: JSON.stringify(result.summary.commonMistakes),
        followUpTask: result.summary.followUpTask
      }
    });

    return NextResponse.json({
      summary: result.summary,
      metadata: result.metadata,
      summaryId: savedSummary.id
    });

  } catch (error) {
    console.error('Summary generation error:', error);
    return NextResponse.json(
      { error: 'Failed to generate summary' },
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
    const sessionId = searchParams.get('sessionId');

    if (!sessionId) {
      return NextResponse.json({ error: 'Session ID is required' }, { status: 400 });
    }

    // Get existing summary
    const summary = await prisma.summary.findUnique({
      where: { sessionId },
      include: {
        session: {
          include: {
            pair: true
          }
        }
      }
    });

    if (!summary) {
      return NextResponse.json({ error: 'Summary not found' }, { status: 404 });
    }

    // Check if user is participant
    const isParticipant = summary.session.pair.userAId === session.user.id ||
                         summary.session.pair.userBId === session.user.id;

    if (!isParticipant) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
    }

    return NextResponse.json({
      id: summary.id,
      newWords: JSON.parse(summary.newWords),
      commonMistakes: JSON.parse(summary.commonMistakes),
      followUpTask: summary.followUpTask,
      generatedAt: summary.generatedAt
    });

  } catch (error) {
    console.error('Summary fetch error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}