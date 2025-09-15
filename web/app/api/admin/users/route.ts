import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { adminService } from '../../../../services/admin';
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
    const userId = searchParams.get('userId');
    const search = searchParams.get('search');
    const status = searchParams.get('status');
    const role = searchParams.get('role');
    const safetyScoreMin = searchParams.get('safetyScoreMin');
    const safetyScoreMax = searchParams.get('safetyScoreMax');
    const lastActiveDays = searchParams.get('lastActiveDays');
    const limit = searchParams.get('limit');
    const attention = searchParams.get('attention'); // Get users requiring attention

    // Get specific user data
    if (userId) {
      const userData = await adminService.getUserManagementData(userId);
      return NextResponse.json(userData);
    }

    // Get users requiring attention
    if (attention === 'true') {
      const users = await adminService.getUsersRequiringAttention(
        limit ? parseInt(limit) : 50
      );
      return NextResponse.json({ users });
    }

    // Search users
    const searchQuery = {
      search: search || undefined,
      status: status || undefined,
      role: role || undefined,
      safetyScoreMin: safetyScoreMin ? parseInt(safetyScoreMin) : undefined,
      safetyScoreMax: safetyScoreMax ? parseInt(safetyScoreMax) : undefined,
      lastActiveDays: lastActiveDays ? parseInt(lastActiveDays) : undefined,
      limit: limit ? parseInt(limit) : 50
    };

    const users = await adminService.searchUsers(searchQuery);

    return NextResponse.json({
      users,
      query: searchQuery,
      generatedAt: new Date().toISOString()
    });

  } catch (error) {
    console.error('Admin users error:', error);
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

    // Check if user is admin or moderator
    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { role: true }
    });

    if (user?.role !== 'ADMIN' && user?.role !== 'MODERATOR') {
      return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 });
    }

    const { userId, action } = await request.json();

    if (!userId || !action) {
      return NextResponse.json({ error: 'User ID and action are required' }, { status: 400 });
    }

    // Validate action structure
    const validActionTypes = ['warning', 'temporary_suspension', 'permanent_ban', 'score_adjustment'];
    if (!validActionTypes.includes(action.type)) {
      return NextResponse.json({ error: 'Invalid action type' }, { status: 400 });
    }

    await adminService.applyModerationAction(userId, action, session.user.id);

    return NextResponse.json({
      success: true,
      action: action.type,
      userId,
      moderatorId: session.user.id,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('Admin moderation action error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 }
    );
  }
}