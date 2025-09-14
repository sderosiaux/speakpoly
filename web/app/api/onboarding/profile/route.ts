import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@speakpoly/database';
import { config } from '@speakpoly/config';
import type { TimeSlot } from '@speakpoly/types';

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
    const {
      nativeLanguages,
      fluentLanguages,
      motives,
      interests,
      customInterests,
      timezone,
      availability,
    } = body;

    // Validate native languages
    if (!nativeLanguages || nativeLanguages.length === 0) {
      return NextResponse.json(
        { error: 'At least one native language is required' },
        { status: 400 }
      );
    }

    // Validate fluent languages limit
    if (fluentLanguages && fluentLanguages.length > config.languages.maxFluent) {
      return NextResponse.json(
        { error: `Maximum ${config.languages.maxFluent} fluent languages allowed` },
        { status: 400 }
      );
    }

    // Get existing language profile to ensure learning language is not in native/fluent
    const existingProfile = await prisma.languageProfile.findUnique({
      where: { userId: session.user.id },
      select: { learningLanguage: true },
    });

    if (existingProfile) {
      if (nativeLanguages.includes(existingProfile.learningLanguage)) {
        return NextResponse.json(
          { error: 'Cannot set learning language as native language' },
          { status: 400 }
        );
      }
    }

    // Start transaction to update all profile data
    const result = await prisma.$transaction(async (tx) => {
      // Update language profile
      const languageProfile = await tx.languageProfile.upsert({
        where: { userId: session.user.id },
        update: {
          nativeLanguages,
          fluentLanguages: fluentLanguages || [],
          motives,
          updatedAt: new Date(),
        },
        create: {
          userId: session.user.id,
          nativeLanguages,
          fluentLanguages: fluentLanguages || [],
          motives,
          learningLanguage: 'en', // Default, should be set from test
          learningLevel: 'A1', // Default, should be set from test
        },
      });

      // Create or update interests
      await tx.interests.upsert({
        where: { userId: session.user.id },
        update: {
          tags: interests,
          customTags: customInterests || [],
          updatedAt: new Date(),
        },
        create: {
          userId: session.user.id,
          tags: interests,
          customTags: customInterests || [],
        },
      });

      // Create or update availability
      await tx.availability.upsert({
        where: { userId: session.user.id },
        update: {
          weeklySlots: availability,
          timezone: timezone || 'UTC',
          updatedAt: new Date(),
        },
        create: {
          userId: session.user.id,
          weeklySlots: availability,
          timezone: timezone || 'UTC',
        },
      });

      // Initialize qualification record
      await tx.qualification.upsert({
        where: { userId: session.user.id },
        update: {},
        create: {
          userId: session.user.id,
          consistencyWeeks: 0,
          depthScore: 0,
          reciprocityScore: 0,
          reliabilityScore: 100,
          onPlatformRate: 100,
          longevityWeeks: 0,
        },
      });

      return languageProfile;
    });

    return NextResponse.json({
      success: true,
      message: 'Profile completed successfully',
      profileId: result.id,
    });
  } catch (error) {
    console.error('Profile setup error:', error);
    return NextResponse.json(
      { error: 'Failed to save profile' },
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

    const profile = await prisma.user.findUnique({
      where: { id: session.user.id },
      include: {
        profile: true,
        interests: true,
        availability: true,
        qualification: true,
      },
    });

    if (!profile) {
      return NextResponse.json(
        { error: 'Profile not found' },
        { status: 404 }
      );
    }

    const isComplete = !!(
      profile.ageVerified18Plus &&
      profile.profile &&
      profile.interests &&
      profile.availability
    );

    return NextResponse.json({
      profile,
      isComplete,
    });
  } catch (error) {
    console.error('Get profile error:', error);
    return NextResponse.json(
      { error: 'Failed to get profile' },
      { status: 500 }
    );
  }
}