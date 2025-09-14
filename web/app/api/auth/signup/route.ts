import { NextResponse } from 'next/server';
import { prisma } from '@speakpoly/database';
import { hashPassword, pseudonymSchema, emailSchema, passwordSchema } from '@speakpoly/utils';
import { z } from 'zod';

const signUpSchema = z.object({
  pseudonym: pseudonymSchema,
  email: emailSchema,
  password: passwordSchema,
});

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const parsed = signUpSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.errors[0].message },
        { status: 400 }
      );
    }

    const { pseudonym, email, password } = parsed.data;

    // Check if email already exists
    const existingUser = await prisma.user.findFirst({
      where: {
        OR: [
          { email: email.toLowerCase() },
          { pseudonym },
        ],
      },
    });

    if (existingUser) {
      if (existingUser.email === email.toLowerCase()) {
        return NextResponse.json(
          { error: 'Email already registered' },
          { status: 400 }
        );
      }
      return NextResponse.json(
        { error: 'Pseudonym already taken' },
        { status: 400 }
      );
    }

    // Hash password and create user
    const hashedPassword = await hashPassword(password);

    const user = await prisma.user.create({
      data: {
        pseudonym,
        email: email.toLowerCase(),
        hashedPassword,
        ageVerified18Plus: false, // Will be verified in onboarding
        status: 'ACTIVE',
      },
      select: {
        id: true,
        pseudonym: true,
        email: true,
      },
    });

    // Track signup event
    await prisma.$executeRaw`
      INSERT INTO analytics_events (user_id, event_type, event_data, created_at)
      VALUES (${user.id}, 'sign_up_started', '{}', NOW())
      ON CONFLICT DO NOTHING
    `.catch(() => {}); // Ignore if analytics table doesn't exist yet

    return NextResponse.json({
      success: true,
      user: {
        id: user.id,
        pseudonym: user.pseudonym,
        email: user.email,
      },
    });
  } catch (error) {
    console.error('Signup error:', error);
    return NextResponse.json(
      { error: 'Failed to create account' },
      { status: 500 }
    );
  }
}