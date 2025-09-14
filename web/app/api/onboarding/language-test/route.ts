import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@speakpoly/database';
import { config } from '@speakpoly/config';
import type { CEFRTestResult } from '@speakpoly/types/cefr';

export async function POST(request: Request) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.id) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const body = await request.json();
    const { language, testResult, answers, selfAssessment } = body as {
      language: string;
      testResult: CEFRTestResult;
      answers: any[];
      selfAssessment: Record<string, boolean>;
    };

    // Validate language
    if (!config.languages.supported.includes(language as any)) {
      return NextResponse.json(
        { error: 'Unsupported language' },
        { status: 400 }
      );
    }

    // Check if user already has a language profile
    const existingProfile = await prisma.languageProfile.findUnique({
      where: { userId: session.user.id },
    });

    if (existingProfile) {
      // Update existing profile
      await prisma.languageProfile.update({
        where: { userId: session.user.id },
        data: {
          learningLanguage: language,
          learningLevel: testResult.level,
          levelFromTest: true,
          testCompletedAt: new Date(),
          updatedAt: new Date(),
        },
      });
    } else {
      // Create new language profile
      await prisma.languageProfile.create({
        data: {
          userId: session.user.id,
          nativeLanguages: [], // Will be set in profile setup
          fluentLanguages: [],
          learningLanguage: language,
          learningLevel: testResult.level,
          levelFromTest: true,
          testCompletedAt: new Date(),
          motives: [],
        },
      });
    }

    // Track level assignment
    await prisma.$executeRaw`
      INSERT INTO analytics_events (user_id, event_type, event_data, created_at)
      VALUES (
        ${session.user.id},
        ${config.analytics.events.LEVEL_ASSIGNED},
        ${JSON.stringify({ language, level: testResult.level, score: testResult.score })},
        NOW()
      )
      ON CONFLICT DO NOTHING
    `.catch(() => {});

    return NextResponse.json({
      success: true,
      level: testResult.level,
      score: testResult.score,
      message: `Your ${language.toUpperCase()} level is ${testResult.level}`,
    });
  } catch (error) {
    console.error('Language test error:', error);
    return NextResponse.json(
      { error: 'Failed to save test results' },
      { status: 500 }
    );
  }
}

export async function GET(request: Request) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.id) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const profile = await prisma.languageProfile.findUnique({
      where: { userId: session.user.id },
      select: {
        learningLanguage: true,
        learningLevel: true,
        levelFromTest: true,
        testCompletedAt: true,
      },
    });

    return NextResponse.json({
      hasCompletedTest: !!profile?.levelFromTest,
      profile,
    });
  } catch (error) {
    console.error('Get language profile error:', error);
    return NextResponse.json(
      { error: 'Failed to get language profile' },
      { status: 500 }
    );
  }
}