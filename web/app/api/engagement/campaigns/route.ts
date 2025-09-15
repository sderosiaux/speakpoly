import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { engagementService } from '../../../../../services/engagement';
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

    const campaigns = await engagementService.getActiveCampaigns();

    return NextResponse.json({
      campaigns,
      generatedAt: new Date().toISOString()
    });

  } catch (error) {
    console.error('Get campaigns API error:', error);
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

    const { type } = await request.json();

    if (!type) {
      return NextResponse.json({ error: 'Campaign type is required' }, { status: 400 });
    }

    const validTypes = ['welcome_series', 'retention_boost', 'milestone_celebration', 'comeback_special'];
    if (!validTypes.includes(type)) {
      return NextResponse.json({ error: 'Invalid campaign type' }, { status: 400 });
    }

    const result = await engagementService.processCampaign(type);

    return NextResponse.json({
      success: true,
      campaignType: type,
      targetedUsers: result.targetedUsers,
      sentNudges: result.sentNudges,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('Process campaign API error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}