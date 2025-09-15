import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { engagementService } from '../../../../../services/engagement';

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const rematchSuggestions = await engagementService.generateRematchSuggestions(session.user.id);

    return NextResponse.json({
      suggestions: rematchSuggestions,
      userId: session.user.id,
      generatedAt: new Date().toISOString()
    });

  } catch (error) {
    console.error('Rematch suggestions API error:', error);
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

    const { partnerId } = await request.json();

    if (!partnerId) {
      return NextResponse.json({ error: 'Partner ID is required' }, { status: 400 });
    }

    const result = await engagementService.requestRematch(session.user.id, partnerId);

    return NextResponse.json({
      success: true,
      rematchId: result.id,
      status: result.status,
      partnerId,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('Request rematch API error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 }
    );
  }
}