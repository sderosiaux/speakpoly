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
    const type = searchParams.get('type') || 'random';
    const language = searchParams.get('language');
    const level = searchParams.get('level');
    const count = parseInt(searchParams.get('count') || '3');

    if (!language || !level) {
      return NextResponse.json({ error: 'Language and level are required' }, { status: 400 });
    }

    let topics;

    if (type === 'generate') {
      // Get user's interests for personalized topic generation
      const user = await prisma.user.findUnique({
        where: { id: session.user.id },
        include: { interests: true }
      });

      const interests = user?.interests?.interests || [];

      topics = await aiService.generateTopics({
        language,
        level,
        interests,
        count
      });
    } else {
      // Get random existing topics
      const topicList = await aiService.getRandomTopics(language, level, count);
      topics = { topics: topicList };
    }

    return NextResponse.json(topics);

  } catch (error) {
    console.error('Topics API error:', error);
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

    const { language, level, interests, count = 5 } = await request.json();

    if (!language || !level) {
      return NextResponse.json({ error: 'Language and level are required' }, { status: 400 });
    }

    const topics = await aiService.generateTopics({
      language,
      level,
      interests: interests || [],
      count
    });

    return NextResponse.json(topics);

  } catch (error) {
    console.error('Topics generation error:', error);
    return NextResponse.json(
      { error: 'Failed to generate topics' },
      { status: 500 }
    );
  }
}