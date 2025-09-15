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

    // Check if user is admin
    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { role: true }
    });

    if (user?.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 });
    }

    // System health checks
    const systemHealth = await getSystemHealth();

    return NextResponse.json({
      ...systemHealth,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('Admin system health error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

async function getSystemHealth() {
  try {
    const startTime = Date.now();

    // Database health check
    const dbHealth = await checkDatabaseHealth();

    // API response time check
    const apiResponseTime = Date.now() - startTime;

    // Memory usage (simplified)
    const memoryUsage = process.memoryUsage();

    // Check external services status
    const externalServices = await checkExternalServices();

    // Check recent errors (last hour)
    const recentErrors = await checkRecentErrors();

    // System metrics
    const systemMetrics = {
      uptime: process.uptime(),
      nodeVersion: process.version,
      platform: process.platform,
      architecture: process.arch
    };

    // Overall health status
    const overallHealth = determineOverallHealth({
      dbHealth,
      apiResponseTime,
      externalServices,
      recentErrors
    });

    return {
      status: overallHealth,
      database: dbHealth,
      api: {
        responseTime: apiResponseTime,
        status: apiResponseTime < 1000 ? 'healthy' : apiResponseTime < 5000 ? 'warning' : 'critical'
      },
      memory: {
        used: Math.round(memoryUsage.heapUsed / 1024 / 1024), // MB
        total: Math.round(memoryUsage.heapTotal / 1024 / 1024), // MB
        external: Math.round(memoryUsage.external / 1024 / 1024), // MB
        status: memoryUsage.heapUsed / memoryUsage.heapTotal < 0.8 ? 'healthy' : 'warning'
      },
      externalServices,
      recentErrors,
      system: systemMetrics
    };

  } catch (error) {
    console.error('System health check error:', error);
    return {
      status: 'critical',
      error: 'Failed to perform health check',
      timestamp: new Date().toISOString()
    };
  }
}

async function checkDatabaseHealth() {
  try {
    const startTime = Date.now();

    // Simple query to test database connectivity
    await prisma.user.count();

    const responseTime = Date.now() - startTime;

    return {
      status: responseTime < 500 ? 'healthy' : responseTime < 2000 ? 'warning' : 'critical',
      responseTime,
      connected: true
    };
  } catch (error) {
    return {
      status: 'critical',
      responseTime: null,
      connected: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    };
  }
}

async function checkExternalServices() {
  const services = [];

  // Check OpenAI API (if configured)
  if (process.env.OPENAI_API_KEY) {
    try {
      const response = await fetch('https://api.openai.com/v1/models', {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`,
        },
        signal: AbortSignal.timeout(5000) // 5 second timeout
      });

      services.push({
        name: 'OpenAI API',
        status: response.ok ? 'healthy' : 'warning',
        responseCode: response.status
      });
    } catch (error) {
      services.push({
        name: 'OpenAI API',
        status: 'critical',
        error: error instanceof Error ? error.message : 'Connection failed'
      });
    }
  }

  // Check Sightengine API (if configured)
  if (process.env.SIGHTENGINE_API_USER && process.env.SIGHTENGINE_API_SECRET) {
    try {
      const formData = new FormData();
      formData.append('text', 'test');
      formData.append('lang', 'en');
      formData.append('mode', 'rules');
      formData.append('api_user', process.env.SIGHTENGINE_API_USER);
      formData.append('api_secret', process.env.SIGHTENGINE_API_SECRET);

      const response = await fetch('https://api.sightengine.com/1.0/text/check.json', {
        method: 'POST',
        body: formData,
        signal: AbortSignal.timeout(5000)
      });

      services.push({
        name: 'Sightengine API',
        status: response.ok ? 'healthy' : 'warning',
        responseCode: response.status
      });
    } catch (error) {
      services.push({
        name: 'Sightengine API',
        status: 'critical',
        error: error instanceof Error ? error.message : 'Connection failed'
      });
    }
  }

  return services;
}

async function checkRecentErrors() {
  const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);

  try {
    // Check for recent safety events with critical severity
    const criticalSafetyEvents = await prisma.safetyEvent.count({
      where: {
        createdAt: { gte: oneHourAgo },
        severity: 'CRITICAL'
      }
    });

    // Check for users with recent suspensions (might indicate system issues)
    const recentSuspensions = await prisma.user.count({
      where: {
        status: 'SUSPENDED',
        suspendedUntil: { gte: oneHourAgo }
      }
    });

    return {
      criticalSafetyEvents,
      recentSuspensions,
      status: criticalSafetyEvents > 10 || recentSuspensions > 5 ? 'warning' : 'healthy'
    };

  } catch (error) {
    return {
      status: 'critical',
      error: 'Failed to check recent errors'
    };
  }
}

function determineOverallHealth(checks: {
  dbHealth: any;
  apiResponseTime: number;
  externalServices: any[];
  recentErrors: any;
}) {
  // Critical if database is down
  if (checks.dbHealth.status === 'critical') {
    return 'critical';
  }

  // Critical if API is very slow
  if (checks.apiResponseTime > 10000) {
    return 'critical';
  }

  // Critical if external services are down
  const criticalServices = checks.externalServices.filter(s => s.status === 'critical');
  if (criticalServices.length > 0) {
    return 'critical';
  }

  // Warning if any component has warnings
  const hasWarnings = checks.dbHealth.status === 'warning' ||
                     checks.apiResponseTime > 2000 ||
                     checks.externalServices.some(s => s.status === 'warning') ||
                     checks.recentErrors.status === 'warning';

  if (hasWarnings) {
    return 'warning';
  }

  return 'healthy';
}