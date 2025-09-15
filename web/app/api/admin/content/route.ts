import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { PrismaClient } from '@speakpoly/database';

const prisma = new PrismaClient();

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Check if user is admin or moderator
    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { role: true }
    });

    if (user?.role !== 'ADMIN' && user?.role !== 'MODERATOR') {
      return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const type = searchParams.get('type') || 'topics';
    const language = searchParams.get('language');
    const difficulty = searchParams.get('difficulty');
    const limit = parseInt(searchParams.get('limit') || '50');

    if (type === 'topics') {
      const where: any = {};
      if (language) where.locale = language;
      if (difficulty) where.difficulty = difficulty;

      const topics = await prisma.topic.findMany({
        where,
        orderBy: [
          { usageCount: 'desc' },
          { createdAt: 'desc' }
        ],
        take: limit
      });

      const totalTopics = await prisma.topic.count({ where });

      return NextResponse.json({
        topics,
        totalTopics,
        query: { type, language, difficulty, limit }
      });
    }

    if (type === 'summaries') {
      const summaries = await prisma.summary.findMany({
        include: {
          session: {
            include: {
              pair: {
                select: {
                  userA: { select: { pseudonym: true } },
                  userB: { select: { pseudonym: true } }
                }
              }
            }
          }
        },
        orderBy: { generatedAt: 'desc' },
        take: limit
      });

      return NextResponse.json({
        summaries: summaries.map(summary => ({
          id: summary.id,
          sessionId: summary.sessionId,
          followUpTask: summary.followUpTask,
          generatedAt: summary.generatedAt,
          participants: [
            summary.session.pair.userA.pseudonym,
            summary.session.pair.userB.pseudonym
          ],
          newWordsCount: JSON.parse(summary.newWords || '[]').length,
          mistakesCount: JSON.parse(summary.commonMistakes || '[]').length
        }))
      });
    }

    return NextResponse.json({ error: 'Invalid content type' }, { status: 400 });

  } catch (error) {
    console.error('Admin content error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Check if user is admin
    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { role: true }
    });

    if (user?.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 });
    }

    const { type, data } = await request.json();

    if (type === 'topic') {
      const { text, tags, difficulty, locale } = data;

      if (!text || !difficulty || !locale) {
        return NextResponse.json({ error: 'Text, difficulty, and locale are required' }, { status: 400 });
      }

      const topic = await prisma.topic.create({
        data: {
          text,
          tags: tags || [],
          difficulty,
          locale
        }
      });

      return NextResponse.json({
        success: true,
        topic
      });
    }

    return NextResponse.json({ error: 'Invalid content type' }, { status: 400 });

  } catch (error) {
    console.error('Admin content creation error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function PUT(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Check if user is admin
    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { role: true }
    });

    if (user?.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 });
    }

    const { type, id, data } = await request.json();

    if (type === 'topic') {
      const { text, tags, difficulty, locale } = data;

      const updatedTopic = await prisma.topic.update({
        where: { id },
        data: {
          text,
          tags,
          difficulty,
          locale
        }
      });

      return NextResponse.json({
        success: true,
        topic: updatedTopic
      });
    }

    return NextResponse.json({ error: 'Invalid content type' }, { status: 400 });

  } catch (error) {
    console.error('Admin content update error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Check if user is admin
    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { role: true }
    });

    if (user?.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const type = searchParams.get('type');
    const id = searchParams.get('id');

    if (!type || !id) {
      return NextResponse.json({ error: 'Type and ID are required' }, { status: 400 });
    }

    if (type === 'topic') {
      await prisma.topic.delete({
        where: { id }
      });

      return NextResponse.json({
        success: true,
        message: 'Topic deleted successfully'
      });
    }

    return NextResponse.json({ error: 'Invalid content type' }, { status: 400 });

  } catch (error) {
    console.error('Admin content deletion error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}