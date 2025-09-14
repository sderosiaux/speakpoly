import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@speakpoly/database';
import { config } from '@speakpoly/config';

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
    const { birthDate } = body;

    if (!birthDate) {
      return NextResponse.json(
        { error: 'Birth date is required' },
        { status: 400 }
      );
    }

    // Calculate age
    const today = new Date();
    const birth = new Date(birthDate);
    let age = today.getFullYear() - birth.getFullYear();
    const monthDiff = today.getMonth() - birth.getMonth();

    if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birth.getDate())) {
      age--;
    }

    if (age < config.app.minAge) {
      return NextResponse.json(
        { error: `You must be ${config.app.minAge} or older to use ${config.app.name}` },
        { status: 403 }
      );
    }

    // Update user's age verification status
    await prisma.user.update({
      where: { id: session.user.id },
      data: {
        ageVerified18Plus: true,
        updatedAt: new Date(),
      },
    });

    return NextResponse.json({
      success: true,
      message: 'Age verified successfully',
    });
  } catch (error) {
    console.error('Age verification error:', error);
    return NextResponse.json(
      { error: 'Failed to verify age' },
      { status: 500 }
    );
  }
}