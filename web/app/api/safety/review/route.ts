import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { moderatorService } from '../../../../services/safety/moderator';
import { PrismaClient } from '@speakpoly/database';

const prisma = new PrismaClient();

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Check if user is an admin/moderator
    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { role: true }
    });

    if (user?.role !== 'ADMIN' && user?.role !== 'MODERATOR') {
      return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const limit = parseInt(searchParams.get('limit') || '50');

    const events = await moderatorService.getEventsForHumanReview(limit);

    return NextResponse.json({
      events: events.map(event => ({
        id: event.id,
        userId: event.userId,
        user: event.user,
        eventType: event.eventType,
        severity: event.severity,
        content: event.content,
        processedContent: event.processedContent,
        violations: JSON.parse(event.violations),
        metadata: JSON.parse(event.metadata),
        createdAt: event.createdAt
      }))
    });

  } catch (error) {
    console.error('Safety review error:', error);
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

    // Check if user is an admin/moderator
    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { role: true }
    });

    if (user?.role !== 'ADMIN' && user?.role !== 'MODERATOR') {
      return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 });
    }

    const { eventId, action, notes } = await request.json();

    if (!eventId || !action) {
      return NextResponse.json({ error: 'Event ID and action are required' }, { status: 400 });
    }

    // Update the safety event as reviewed
    await prisma.safetyEvent.update({
      where: { id: eventId },
      data: {
        humanReviewedAt: new Date(),
        humanReviewedBy: session.user.id,
        humanReviewAction: action,
        humanReviewNotes: notes
      }
    });

    // Apply additional actions if needed
    if (action === 'ESCALATE' || action === 'APPLY_SANCTION') {
      // Here you could implement additional sanctions or escalations
      // based on human moderator decision
    }

    return NextResponse.json({ success: true });

  } catch (error) {
    console.error('Safety review action error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}