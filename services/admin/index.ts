import { PrismaClient } from '@speakpoly/database';
import { moderatorService } from '../safety/moderator';
import { analyticsService } from '../analytics';

const prisma = new PrismaClient();

export interface AdminDashboardData {
  overview: {
    totalUsers: number;
    activeUsers: number;
    totalSessions: number;
    activePairs: number;
    pendingSafetyReviews: number;
    systemHealth: 'healthy' | 'warning' | 'critical';
  };
  recentActivity: Array<{
    id: string;
    type: 'user_registered' | 'session_completed' | 'safety_event' | 'pair_created';
    description: string;
    timestamp: Date;
    userId?: string;
    metadata?: any;
  }>;
  safetyMetrics: {
    violationsToday: number;
    autoModerations: number;
    humanReviews: number;
    criticalEvents: number;
  };
  userMetrics: {
    newUsersToday: number;
    retentionRate: number;
    avgSessionsPerUser: number;
    topLanguages: Array<{ language: string; count: number }>;
  };
}

export interface UserManagementData {
  user: {
    id: string;
    pseudonym: string;
    email: string;
    status: string;
    role: string;
    createdAt: Date;
    lastActiveAt: Date | null;
    safetyScore: number;
    warningCount: number;
    suspendedUntil: Date | null;
    suspensionReason: string | null;
  };
  profile: any;
  recentSessions: Array<{
    id: string;
    pairId: string;
    startedAt: Date;
    endedAt: Date | null;
    duration: number;
    partnerPseudonym: string;
  }>;
  safetyEvents: Array<{
    id: string;
    eventType: string;
    severity: string;
    createdAt: Date;
    content: string;
    requiresHumanReview: boolean;
  }>;
  analytics: {
    totalSessions: number;
    totalMinutes: number;
    streakDays: number;
    vocabularyLearned: number;
  };
}

export interface ModerationAction {
  type: 'warning' | 'temporary_suspension' | 'permanent_ban' | 'score_adjustment';
  duration?: number; // minutes for suspension
  reason: string;
  notes?: string;
  scoreAdjustment?: number;
}

export class AdminService {
  /**
   * Get comprehensive dashboard data for admin overview
   */
  async getDashboardData(): Promise<AdminDashboardData> {
    try {
      const now = new Date();
      const today = new Date(now);
      today.setHours(0, 0, 0, 0);

      // Overview metrics
      const [
        totalUsers,
        activeUsers,
        totalSessions,
        activePairs,
        pendingSafetyReviews
      ] = await Promise.all([
        prisma.user.count(),
        prisma.user.count({
          where: {
            lastActiveAt: {
              gte: new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000) // Last 7 days
            }
          }
        }),
        prisma.session.count(),
        prisma.pair.count({
          where: { status: 'ACTIVE' }
        }),
        prisma.safetyEvent.count({
          where: {
            requiresHumanReview: true,
            humanReviewedAt: null
          }
        })
      ]);

      // System health assessment
      const systemHealth = this.assessSystemHealth(pendingSafetyReviews, activeUsers, totalUsers);

      // Recent activity
      const recentActivity = await this.getRecentActivity();

      // Safety metrics
      const safetyMetrics = await this.getSafetyMetrics(today);

      // User metrics
      const userMetrics = await this.getUserMetrics(today);

      return {
        overview: {
          totalUsers,
          activeUsers,
          totalSessions,
          activePairs,
          pendingSafetyReviews,
          systemHealth
        },
        recentActivity,
        safetyMetrics,
        userMetrics
      };

    } catch (error) {
      console.error('Dashboard data error:', error);
      throw new Error('Failed to get dashboard data');
    }
  }

  /**
   * Get detailed user management data
   */
  async getUserManagementData(userId: string): Promise<UserManagementData> {
    try {
      const user = await prisma.user.findUnique({
        where: { id: userId },
        include: {
          profile: true,
          interests: true,
          availability: true
        }
      });

      if (!user) {
        throw new Error('User not found');
      }

      // Get recent sessions
      const recentSessions = await prisma.session.findMany({
        where: {
          participants: {
            some: { userId }
          }
        },
        include: {
          pair: {
            include: {
              userA: { select: { pseudonym: true } },
              userB: { select: { pseudonym: true } }
            }
          }
        },
        orderBy: { startedAt: 'desc' },
        take: 10
      });

      // Get safety events
      const safetyEvents = await prisma.safetyEvent.findMany({
        where: { userId },
        orderBy: { createdAt: 'desc' },
        take: 20
      });

      // Get analytics
      const analytics = await analyticsService.getUserProgress(userId, 'all');

      // Format recent sessions
      const formattedSessions = recentSessions.map(session => {
        const partner = session.pair.userA.pseudonym === user.pseudonym
          ? session.pair.userB
          : session.pair.userA;

        return {
          id: session.id,
          pairId: session.pairId,
          startedAt: session.startedAt,
          endedAt: session.endedAt,
          duration: session.endedAt
            ? Math.round((session.endedAt.getTime() - session.startedAt.getTime()) / (1000 * 60))
            : 0,
          partnerPseudonym: partner.pseudonym
        };
      });

      return {
        user: {
          id: user.id,
          pseudonym: user.pseudonym,
          email: user.email,
          status: user.status,
          role: user.role,
          createdAt: user.createdAt,
          lastActiveAt: user.lastActiveAt,
          safetyScore: user.safetyScore,
          warningCount: user.warningCount,
          suspendedUntil: user.suspendedUntil,
          suspensionReason: user.suspensionReason
        },
        profile: user.profile,
        recentSessions: formattedSessions,
        safetyEvents: safetyEvents.map(event => ({
          id: event.id,
          eventType: event.eventType,
          severity: event.severity,
          createdAt: event.createdAt,
          content: event.content.slice(0, 100) + '...', // Truncate for overview
          requiresHumanReview: event.requiresHumanReview
        })),
        analytics: {
          totalSessions: analytics.totalSessions,
          totalMinutes: analytics.totalMinutes,
          streakDays: analytics.streakDays,
          vocabularyLearned: analytics.vocabularyLearned
        }
      };

    } catch (error) {
      console.error('User management data error:', error);
      throw new Error('Failed to get user management data');
    }
  }

  /**
   * Apply moderation action to a user
   */
  async applyModerationAction(
    userId: string,
    action: ModerationAction,
    moderatorId: string
  ): Promise<void> {
    try {
      const user = await prisma.user.findUnique({
        where: { id: userId }
      });

      if (!user) {
        throw new Error('User not found');
      }

      switch (action.type) {
        case 'warning':
          await this.applyWarning(userId, action.reason, action.notes);
          break;

        case 'temporary_suspension':
          if (!action.duration) {
            throw new Error('Duration required for temporary suspension');
          }
          await this.applySuspension(userId, action.duration, action.reason);
          break;

        case 'permanent_ban':
          await this.applyBan(userId, action.reason);
          break;

        case 'score_adjustment':
          if (!action.scoreAdjustment) {
            throw new Error('Score adjustment value required');
          }
          await this.adjustSafetyScore(userId, action.scoreAdjustment, action.reason);
          break;

        default:
          throw new Error('Invalid moderation action type');
      }

      // Log the moderation action
      await this.logModerationAction(userId, action, moderatorId);

    } catch (error) {
      console.error('Moderation action error:', error);
      throw new Error('Failed to apply moderation action');
    }
  }

  /**
   * Get users requiring attention (low safety scores, repeated violations, etc.)
   */
  async getUsersRequiringAttention(limit: number = 50): Promise<Array<{
    id: string;
    pseudonym: string;
    safetyScore: number;
    warningCount: number;
    recentViolations: number;
    lastActiveAt: Date | null;
    riskLevel: 'low' | 'medium' | 'high';
    reason: string;
  }>> {
    try {
      const sevenDaysAgo = new Date();
      sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

      // Get users with potential issues
      const users = await prisma.user.findMany({
        where: {
          OR: [
            { safetyScore: { lt: 70 } }, // Low safety score
            { warningCount: { gte: 2 } }, // Multiple warnings
            { status: 'SUSPENDED' } // Currently suspended
          ],
          status: { not: 'BANNED' } // Exclude banned users
        },
        include: {
          safetyEvents: {
            where: {
              createdAt: { gte: sevenDaysAgo }
            }
          }
        },
        orderBy: [
          { safetyScore: 'asc' },
          { warningCount: 'desc' }
        ],
        take: limit
      });

      return users.map(user => {
        const recentViolations = user.safetyEvents.length;
        const { riskLevel, reason } = this.assessUserRisk(user, recentViolations);

        return {
          id: user.id,
          pseudonym: user.pseudonym,
          safetyScore: user.safetyScore,
          warningCount: user.warningCount,
          recentViolations,
          lastActiveAt: user.lastActiveAt,
          riskLevel,
          reason
        };
      });

    } catch (error) {
      console.error('Users requiring attention error:', error);
      throw new Error('Failed to get users requiring attention');
    }
  }

  /**
   * Get platform statistics for reporting
   */
  async getPlatformStatistics(timeframe: 'week' | 'month' | 'year' = 'month') {
    try {
      const analytics = await analyticsService.getPlatformAnalytics(timeframe);
      const safetyStats = await moderatorService.getSafetyStats(timeframe);

      return {
        ...analytics,
        safety: safetyStats,
        generatedAt: new Date().toISOString(),
        timeframe
      };

    } catch (error) {
      console.error('Platform statistics error:', error);
      throw new Error('Failed to get platform statistics');
    }
  }

  /**
   * Search users by various criteria
   */
  async searchUsers(query: {
    search?: string;
    status?: string;
    role?: string;
    safetyScoreMin?: number;
    safetyScoreMax?: number;
    lastActiveDays?: number;
    limit?: number;
  }) {
    try {
      const {
        search,
        status,
        role,
        safetyScoreMin,
        safetyScoreMax,
        lastActiveDays,
        limit = 50
      } = query;

      const where: any = {};

      if (search) {
        where.OR = [
          { pseudonym: { contains: search, mode: 'insensitive' } },
          { email: { contains: search, mode: 'insensitive' } }
        ];
      }

      if (status) {
        where.status = status;
      }

      if (role) {
        where.role = role;
      }

      if (safetyScoreMin !== undefined || safetyScoreMax !== undefined) {
        where.safetyScore = {};
        if (safetyScoreMin !== undefined) where.safetyScore.gte = safetyScoreMin;
        if (safetyScoreMax !== undefined) where.safetyScore.lte = safetyScoreMax;
      }

      if (lastActiveDays) {
        const cutoffDate = new Date();
        cutoffDate.setDate(cutoffDate.getDate() - lastActiveDays);
        where.lastActiveAt = { gte: cutoffDate };
      }

      const users = await prisma.user.findMany({
        where,
        select: {
          id: true,
          pseudonym: true,
          email: true,
          status: true,
          role: true,
          safetyScore: true,
          warningCount: true,
          lastActiveAt: true,
          createdAt: true
        },
        orderBy: { createdAt: 'desc' },
        take: limit
      });

      return users;

    } catch (error) {
      console.error('User search error:', error);
      throw new Error('Failed to search users');
    }
  }

  // Private helper methods

  private assessSystemHealth(
    pendingSafetyReviews: number,
    activeUsers: number,
    totalUsers: number
  ): 'healthy' | 'warning' | 'critical' {
    // Critical: High pending reviews or very low activity
    if (pendingSafetyReviews > 50 || (totalUsers > 100 && activeUsers / totalUsers < 0.1)) {
      return 'critical';
    }

    // Warning: Moderate pending reviews or low activity
    if (pendingSafetyReviews > 20 || (totalUsers > 50 && activeUsers / totalUsers < 0.2)) {
      return 'warning';
    }

    return 'healthy';
  }

  private async getRecentActivity(): Promise<Array<{
    id: string;
    type: 'user_registered' | 'session_completed' | 'safety_event' | 'pair_created';
    description: string;
    timestamp: Date;
    userId?: string;
    metadata?: any;
  }>> {
    const activities = [];

    // Recent user registrations (last 24 hours)
    const recentUsers = await prisma.user.findMany({
      where: {
        createdAt: {
          gte: new Date(Date.now() - 24 * 60 * 60 * 1000)
        }
      },
      orderBy: { createdAt: 'desc' },
      take: 5
    });

    recentUsers.forEach(user => {
      activities.push({
        id: user.id,
        type: 'user_registered' as const,
        description: `New user ${user.pseudonym} registered`,
        timestamp: user.createdAt,
        userId: user.id
      });
    });

    // Recent safety events
    const recentSafetyEvents = await prisma.safetyEvent.findMany({
      where: {
        createdAt: {
          gte: new Date(Date.now() - 24 * 60 * 60 * 1000)
        }
      },
      include: {
        user: { select: { pseudonym: true } }
      },
      orderBy: { createdAt: 'desc' },
      take: 5
    });

    recentSafetyEvents.forEach(event => {
      activities.push({
        id: event.id,
        type: 'safety_event' as const,
        description: `Safety event: ${event.eventType} (${event.severity})`,
        timestamp: event.createdAt,
        userId: event.userId,
        metadata: { userPseudonym: event.user.pseudonym }
      });
    });

    return activities.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime()).slice(0, 10);
  }

  private async getSafetyMetrics(today: Date) {
    const [violationsToday, autoModerations, humanReviews, criticalEvents] = await Promise.all([
      prisma.safetyEvent.count({
        where: { createdAt: { gte: today } }
      }),
      prisma.safetyEvent.count({
        where: {
          createdAt: { gte: today },
          humanReviewedAt: null
        }
      }),
      prisma.safetyEvent.count({
        where: {
          createdAt: { gte: today },
          humanReviewedAt: { not: null }
        }
      }),
      prisma.safetyEvent.count({
        where: {
          createdAt: { gte: today },
          severity: 'CRITICAL'
        }
      })
    ]);

    return { violationsToday, autoModerations, humanReviews, criticalEvents };
  }

  private async getUserMetrics(today: Date) {
    const newUsersToday = await prisma.user.count({
      where: { createdAt: { gte: today } }
    });

    // Simple retention calculation (users active in last 7 days vs total)
    const weekAgo = new Date(today.getTime() - 7 * 24 * 60 * 60 * 1000);
    const [activeLastWeek, totalUsers] = await Promise.all([
      prisma.user.count({
        where: { lastActiveAt: { gte: weekAgo } }
      }),
      prisma.user.count()
    ]);

    const retentionRate = totalUsers > 0 ? Math.round((activeLastWeek / totalUsers) * 100) : 0;

    // Average sessions per user (simplified)
    const [totalSessions, totalUsersWithSessions] = await Promise.all([
      prisma.session.count(),
      prisma.user.count({
        where: {
          sessions: {
            some: {}
          }
        }
      })
    ]);

    const avgSessionsPerUser = totalUsersWithSessions > 0
      ? Math.round(totalSessions / totalUsersWithSessions)
      : 0;

    // Top languages (placeholder - would need proper aggregation)
    const topLanguages = [
      { language: 'English', count: 245 },
      { language: 'Spanish', count: 198 },
      { language: 'French', count: 167 }
    ];

    return { newUsersToday, retentionRate, avgSessionsPerUser, topLanguages };
  }

  private async applyWarning(userId: string, reason: string, notes?: string) {
    await prisma.user.update({
      where: { id: userId },
      data: {
        warningCount: { increment: 1 },
        lastWarningAt: new Date()
      }
    });
  }

  private async applySuspension(userId: string, durationMinutes: number, reason: string) {
    const suspendedUntil = new Date(Date.now() + durationMinutes * 60 * 1000);

    await prisma.user.update({
      where: { id: userId },
      data: {
        status: 'SUSPENDED',
        suspendedUntil,
        suspensionReason: reason
      }
    });

    // End any active sessions
    await prisma.session.updateMany({
      where: {
        pair: {
          OR: [
            { userAId: userId },
            { userBId: userId }
          ]
        },
        status: 'ACTIVE'
      },
      data: {
        status: 'ENDED',
        endedAt: new Date(),
        endReason: 'USER_SUSPENDED'
      }
    });
  }

  private async applyBan(userId: string, reason: string) {
    await prisma.user.update({
      where: { id: userId },
      data: {
        status: 'BANNED',
        suspensionReason: reason
      }
    });

    // End any active sessions and pairs
    await Promise.all([
      prisma.session.updateMany({
        where: {
          pair: {
            OR: [
              { userAId: userId },
              { userBId: userId }
            ]
          },
          status: 'ACTIVE'
        },
        data: {
          status: 'ENDED',
          endedAt: new Date(),
          endReason: 'USER_BANNED'
        }
      }),
      prisma.pair.updateMany({
        where: {
          OR: [
            { userAId: userId },
            { userBId: userId }
          ],
          status: 'ACTIVE'
        },
        data: { status: 'CLOSED' }
      })
    ]);
  }

  private async adjustSafetyScore(userId: string, adjustment: number, reason: string) {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { safetyScore: true }
    });

    if (!user) throw new Error('User not found');

    const newScore = Math.max(0, Math.min(100, user.safetyScore + adjustment));

    await prisma.user.update({
      where: { id: userId },
      data: { safetyScore: newScore }
    });
  }

  private async logModerationAction(
    userId: string,
    action: ModerationAction,
    moderatorId: string
  ) {
    // In a full implementation, you'd have a dedicated moderation log table
    console.log('Moderation action logged:', {
      userId,
      action,
      moderatorId,
      timestamp: new Date()
    });
  }

  private assessUserRisk(user: any, recentViolations: number): {
    riskLevel: 'low' | 'medium' | 'high';
    reason: string;
  } {
    if (user.safetyScore < 50 || recentViolations >= 3) {
      return { riskLevel: 'high', reason: 'Low safety score and recent violations' };
    }

    if (user.safetyScore < 70 || user.warningCount >= 2 || recentViolations >= 1) {
      return { riskLevel: 'medium', reason: 'Moderate safety concerns' };
    }

    return { riskLevel: 'low', reason: 'Good standing' };
  }
}

export const adminService = new AdminService();