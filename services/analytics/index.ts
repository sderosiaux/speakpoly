import { PrismaClient } from '@speakpoly/database';

const prisma = new PrismaClient();

export interface UserProgressStats {
  totalSessions: number;
  totalMinutes: number;
  avgSessionLength: number;
  languageBalance: Record<string, number>;
  streakDays: number;
  vocabularyLearned: number;
  mistakesCorrected: number;
  qualityTrends: {
    fluency: number[];
    vocabulary: number[];
    grammar: number[];
    engagement: number[];
  };
  weeklyActivity: Array<{
    week: string;
    sessions: number;
    minutes: number;
  }>;
  levelProgress: {
    currentLevel: string;
    progressPercentage: number;
    nextMilestone: string;
  };
}

export interface PairAnalytics {
  totalSessions: number;
  totalMessages: number;
  avgResponseTime: number;
  languageDistribution: Record<string, number>;
  topTopics: Array<{
    topic: string;
    usage: number;
  }>;
  conversationQuality: {
    overall: number;
    trend: 'improving' | 'stable' | 'declining';
  };
}

export interface PlatformAnalytics {
  activeUsers: {
    daily: number;
    weekly: number;
    monthly: number;
  };
  sessionMetrics: {
    totalSessions: number;
    avgDuration: number;
    completionRate: number;
  };
  languagePopularity: Array<{
    language: string;
    learners: number;
    native: number;
  }>;
  safetyMetrics: {
    violationsThisWeek: number;
    autoModerated: number;
    humanReviewed: number;
  };
  userGrowth: Array<{
    date: string;
    newUsers: number;
    activeUsers: number;
  }>;
}

export class AnalyticsService {
  /**
   * Get comprehensive progress statistics for a user
   */
  async getUserProgress(userId: string, timeframe: 'week' | 'month' | 'all' = 'month'): Promise<UserProgressStats> {
    try {
      const now = new Date();
      const startDate = this.getStartDate(timeframe, now);

      // Get user's sessions and messages
      const sessions = await prisma.session.findMany({
        where: {
          participants: {
            some: { userId }
          },
          startedAt: timeframe !== 'all' ? { gte: startDate } : undefined
        },
        include: {
          pair: {
            include: {
              messages: {
                where: {
                  type: 'TEXT',
                  body: { not: null }
                }
              }
            }
          },
          summary: true
        },
        orderBy: { startedAt: 'desc' }
      });

      // Calculate basic metrics
      const totalSessions = sessions.length;
      const totalMinutes = sessions.reduce((sum, session) => {
        if (session.endedAt) {
          return sum + Math.round((session.endedAt.getTime() - session.startedAt.getTime()) / (1000 * 60));
        }
        return sum;
      }, 0);

      const avgSessionLength = totalSessions > 0 ? Math.round(totalMinutes / totalSessions) : 0;

      // Calculate language balance
      const languageBalance = await this.calculateLanguageBalance(userId, sessions);

      // Calculate streak
      const streakDays = await this.calculateStreakDays(userId);

      // Get vocabulary and mistakes from summaries
      const { vocabularyLearned, mistakesCorrected, qualityTrends } = await this.extractLearningMetrics(sessions);

      // Get weekly activity
      const weeklyActivity = await this.getWeeklyActivity(userId, timeframe);

      // Calculate level progress
      const levelProgress = await this.calculateLevelProgress(userId);

      return {
        totalSessions,
        totalMinutes,
        avgSessionLength,
        languageBalance,
        streakDays,
        vocabularyLearned,
        mistakesCorrected,
        qualityTrends,
        weeklyActivity,
        levelProgress
      };

    } catch (error) {
      console.error('User progress error:', error);
      throw new Error('Failed to get user progress');
    }
  }

  /**
   * Get analytics for a specific pair
   */
  async getPairAnalytics(pairId: string): Promise<PairAnalytics> {
    try {
      const pair = await prisma.pair.findUnique({
        where: { id: pairId },
        include: {
          sessions: {
            include: {
              summary: true
            }
          },
          messages: {
            where: {
              type: 'TEXT',
              body: { not: null }
            },
            orderBy: { createdAt: 'asc' }
          }
        }
      });

      if (!pair) {
        throw new Error('Pair not found');
      }

      const totalSessions = pair.sessions.length;
      const totalMessages = pair.messages.length;

      // Calculate average response time
      const avgResponseTime = this.calculateAvgResponseTime(pair.messages);

      // Language distribution
      const languageDistribution = this.calculateLanguageDistribution(pair.messages);

      // Top topics from sessions
      const topTopics = await this.getTopTopics(pair.sessions);

      // Conversation quality analysis
      const conversationQuality = this.analyzeConversationQuality(pair.sessions);

      return {
        totalSessions,
        totalMessages,
        avgResponseTime,
        languageDistribution,
        topTopics,
        conversationQuality
      };

    } catch (error) {
      console.error('Pair analytics error:', error);
      throw new Error('Failed to get pair analytics');
    }
  }

  /**
   * Get platform-wide analytics (admin only)
   */
  async getPlatformAnalytics(timeframe: 'week' | 'month' | 'year' = 'month'): Promise<PlatformAnalytics> {
    try {
      const now = new Date();
      const startDate = this.getStartDate(timeframe, now);

      // Active users
      const activeUsers = await this.getActiveUsers(startDate);

      // Session metrics
      const sessionMetrics = await this.getSessionMetrics(startDate);

      // Language popularity
      const languagePopularity = await this.getLanguagePopularity();

      // Safety metrics
      const safetyMetrics = await this.getSafetyMetrics(startDate);

      // User growth
      const userGrowth = await this.getUserGrowth(timeframe);

      return {
        activeUsers,
        sessionMetrics,
        languagePopularity,
        safetyMetrics,
        userGrowth
      };

    } catch (error) {
      console.error('Platform analytics error:', error);
      throw new Error('Failed to get platform analytics');
    }
  }

  /**
   * Track user activity event
   */
  async trackActivity(userId: string, event: string, metadata?: any): Promise<void> {
    try {
      // In a more sophisticated system, you'd use a dedicated analytics DB
      // For now, we'll use a simple approach with user updates
      await prisma.user.update({
        where: { id: userId },
        data: { lastActiveAt: new Date() }
      });

      // Log significant events (you could extend this with a dedicated events table)
      console.log(`User activity: ${userId} - ${event}`, metadata);

    } catch (error) {
      console.error('Activity tracking error:', error);
    }
  }

  /**
   * Get learning milestones for a user
   */
  async getUserMilestones(userId: string): Promise<Array<{
    type: string;
    title: string;
    description: string;
    achievedAt: Date;
    value: number;
  }>> {
    try {
      const milestones = [];
      const stats = await this.getUserProgress(userId, 'all');

      // Session milestones
      if (stats.totalSessions >= 1) {
        milestones.push({
          type: 'first_session',
          title: 'First Conversation',
          description: 'Completed your first language exchange session',
          achievedAt: new Date(), // You'd track this properly
          value: 1
        });
      }

      if (stats.totalSessions >= 10) {
        milestones.push({
          type: 'sessions_10',
          title: 'Conversation Enthusiast',
          description: 'Completed 10 language exchange sessions',
          achievedAt: new Date(),
          value: 10
        });
      }

      // Time milestones
      if (stats.totalMinutes >= 60) {
        milestones.push({
          type: 'hour_practiced',
          title: 'Hour of Practice',
          description: 'Practiced for over an hour total',
          achievedAt: new Date(),
          value: 60
        });
      }

      // Streak milestones
      if (stats.streakDays >= 7) {
        milestones.push({
          type: 'week_streak',
          title: 'Weekly Warrior',
          description: 'Maintained a 7-day practice streak',
          achievedAt: new Date(),
          value: 7
        });
      }

      // Vocabulary milestones
      if (stats.vocabularyLearned >= 50) {
        milestones.push({
          type: 'vocab_50',
          title: 'Word Collector',
          description: 'Learned 50 new vocabulary words',
          achievedAt: new Date(),
          value: 50
        });
      }

      return milestones.sort((a, b) => b.achievedAt.getTime() - a.achievedAt.getTime());

    } catch (error) {
      console.error('Milestones error:', error);
      return [];
    }
  }

  // Private helper methods

  private getStartDate(timeframe: string, now: Date): Date {
    const date = new Date(now);
    switch (timeframe) {
      case 'week':
        date.setDate(date.getDate() - 7);
        break;
      case 'month':
        date.setMonth(date.getMonth() - 1);
        break;
      case 'year':
        date.setFullYear(date.getFullYear() - 1);
        break;
    }
    return date;
  }

  private async calculateLanguageBalance(userId: string, sessions: any[]): Promise<Record<string, number>> {
    // Calculate time spent in each language based on messages
    const languageTime: Record<string, number> = {};
    let totalTime = 0;

    for (const session of sessions) {
      const sessionDuration = session.endedAt
        ? (session.endedAt.getTime() - session.startedAt.getTime()) / (1000 * 60)
        : 0;

      if (sessionDuration > 0) {
        // Estimate language distribution (simplified)
        const messages = session.pair.messages || [];
        const userMessages = messages.filter((m: any) => m.senderId === userId);

        // This is a simplified approach - in reality you'd track language per message
        const estimatedNativeTime = sessionDuration * 0.5; // Assume 50/50 split
        const estimatedLearningTime = sessionDuration * 0.5;

        languageTime['native'] = (languageTime['native'] || 0) + estimatedNativeTime;
        languageTime['learning'] = (languageTime['learning'] || 0) + estimatedLearningTime;
        totalTime += sessionDuration;
      }
    }

    // Convert to percentages
    const balance: Record<string, number> = {};
    Object.keys(languageTime).forEach(lang => {
      balance[lang] = totalTime > 0 ? Math.round((languageTime[lang] / totalTime) * 100) : 0;
    });

    return balance;
  }

  private async calculateStreakDays(userId: string): Promise<number> {
    // Get user's session history ordered by date
    const sessions = await prisma.session.findMany({
      where: {
        participants: {
          some: { userId }
        }
      },
      orderBy: { startedAt: 'desc' },
      select: { startedAt: true }
    });

    if (sessions.length === 0) return 0;

    let streak = 0;
    let currentDate = new Date();
    currentDate.setHours(0, 0, 0, 0);

    for (let i = 0; i < sessions.length; i++) {
      const sessionDate = new Date(sessions[i].startedAt);
      sessionDate.setHours(0, 0, 0, 0);

      const daysDiff = Math.floor((currentDate.getTime() - sessionDate.getTime()) / (1000 * 60 * 60 * 24));

      if (daysDiff === streak) {
        streak++;
        currentDate.setDate(currentDate.getDate() - 1);
      } else if (daysDiff > streak) {
        break;
      }
    }

    return streak;
  }

  private async extractLearningMetrics(sessions: any[]): Promise<{
    vocabularyLearned: number;
    mistakesCorrected: number;
    qualityTrends: any;
  }> {
    let vocabularyLearned = 0;
    let mistakesCorrected = 0;
    const qualityTrends = {
      fluency: [],
      vocabulary: [],
      grammar: [],
      engagement: []
    };

    for (const session of sessions) {
      if (session.summary) {
        try {
          const newWords = JSON.parse(session.summary.newWords || '[]');
          const mistakes = JSON.parse(session.summary.commonMistakes || '[]');

          vocabularyLearned += newWords.length;
          mistakesCorrected += mistakes.length;

          // This would come from the AI summary's quality metrics
          // For now, we'll use placeholder values
          qualityTrends.fluency.push(Math.floor(Math.random() * 3) + 7); // 7-10 range
          qualityTrends.vocabulary.push(Math.floor(Math.random() * 3) + 7);
          qualityTrends.grammar.push(Math.floor(Math.random() * 3) + 7);
          qualityTrends.engagement.push(Math.floor(Math.random() * 3) + 7);
        } catch (error) {
          console.error('Error parsing summary:', error);
        }
      }
    }

    return { vocabularyLearned, mistakesCorrected, qualityTrends };
  }

  private async getWeeklyActivity(userId: string, timeframe: string): Promise<Array<{
    week: string;
    sessions: number;
    minutes: number;
  }>> {
    const weeks = timeframe === 'month' ? 4 : timeframe === 'week' ? 1 : 12;
    const activity = [];

    for (let i = 0; i < weeks; i++) {
      const weekStart = new Date();
      weekStart.setDate(weekStart.getDate() - (i * 7));
      const weekEnd = new Date(weekStart);
      weekEnd.setDate(weekEnd.getDate() + 7);

      const weekSessions = await prisma.session.findMany({
        where: {
          participants: {
            some: { userId }
          },
          startedAt: {
            gte: weekStart,
            lt: weekEnd
          }
        }
      });

      const minutes = weekSessions.reduce((sum, session) => {
        if (session.endedAt) {
          return sum + Math.round((session.endedAt.getTime() - session.startedAt.getTime()) / (1000 * 60));
        }
        return sum;
      }, 0);

      activity.unshift({
        week: weekStart.toISOString().split('T')[0],
        sessions: weekSessions.length,
        minutes
      });
    }

    return activity;
  }

  private async calculateLevelProgress(userId: string): Promise<{
    currentLevel: string;
    progressPercentage: number;
    nextMilestone: string;
  }> {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      include: { profile: true }
    });

    const currentLevel = user?.profile?.currentLevel || 'A1';
    const levels = ['A1', 'A2', 'B1', 'B2', 'C1', 'C2'];
    const currentIndex = levels.indexOf(currentLevel);

    // Simple progress calculation based on sessions and time
    const stats = await this.getUserProgress(userId, 'all');
    const sessionsNeeded = (currentIndex + 1) * 20; // Rough estimate
    const progressPercentage = Math.min(100, Math.round((stats.totalSessions / sessionsNeeded) * 100));

    const nextMilestone = currentIndex < levels.length - 1
      ? levels[currentIndex + 1]
      : 'Mastery achieved';

    return {
      currentLevel,
      progressPercentage,
      nextMilestone
    };
  }

  private calculateAvgResponseTime(messages: any[]): number {
    if (messages.length < 2) return 0;

    let totalTime = 0;
    let responseCount = 0;

    for (let i = 1; i < messages.length; i++) {
      const timeDiff = messages[i].createdAt.getTime() - messages[i-1].createdAt.getTime();
      if (timeDiff < 300000) { // Less than 5 minutes
        totalTime += timeDiff;
        responseCount++;
      }
    }

    return responseCount > 0 ? Math.round(totalTime / responseCount / 1000) : 0; // Return in seconds
  }

  private calculateLanguageDistribution(messages: any[]): Record<string, number> {
    // Simplified language distribution
    return {
      native: 50,
      learning: 50
    };
  }

  private async getTopTopics(sessions: any[]): Promise<Array<{ topic: string; usage: number }>> {
    const topicCounts: Record<string, number> = {};

    sessions.forEach(session => {
      session.topicsCovered?.forEach((topicId: string) => {
        topicCounts[topicId] = (topicCounts[topicId] || 0) + 1;
      });
    });

    return Object.entries(topicCounts)
      .sort(([,a], [,b]) => b - a)
      .slice(0, 5)
      .map(([topic, usage]) => ({ topic, usage }));
  }

  private analyzeConversationQuality(sessions: any[]): { overall: number; trend: 'improving' | 'stable' | 'declining' } {
    // Simplified quality analysis
    const overall = Math.floor(Math.random() * 3) + 7; // 7-10 range
    const trends = ['improving', 'stable', 'declining'] as const;
    const trend = trends[Math.floor(Math.random() * trends.length)];

    return { overall, trend };
  }

  private async getActiveUsers(startDate: Date) {
    const now = new Date();
    const dayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

    const [daily, weekly, monthly] = await Promise.all([
      prisma.user.count({
        where: { lastActiveAt: { gte: dayAgo } }
      }),
      prisma.user.count({
        where: { lastActiveAt: { gte: weekAgo } }
      }),
      prisma.user.count({
        where: { lastActiveAt: { gte: startDate } }
      })
    ]);

    return { daily, weekly, monthly };
  }

  private async getSessionMetrics(startDate: Date) {
    const sessions = await prisma.session.findMany({
      where: { startedAt: { gte: startDate } }
    });

    const completedSessions = sessions.filter(s => s.endedAt);
    const totalSessions = sessions.length;
    const avgDuration = completedSessions.length > 0
      ? Math.round(completedSessions.reduce((sum, s) =>
          sum + (s.endedAt!.getTime() - s.startedAt.getTime()), 0) / completedSessions.length / (1000 * 60))
      : 0;
    const completionRate = totalSessions > 0 ? Math.round((completedSessions.length / totalSessions) * 100) : 0;

    return { totalSessions, avgDuration, completionRate };
  }

  private async getLanguagePopularity() {
    // This would require aggregating user profiles
    // Placeholder implementation
    return [
      { language: 'English', learners: 245, native: 89 },
      { language: 'Spanish', learners: 198, native: 156 },
      { language: 'French', learners: 167, native: 78 },
      { language: 'German', learners: 134, native: 45 },
      { language: 'Italian', learners: 98, native: 34 }
    ];
  }

  private async getSafetyMetrics(startDate: Date) {
    const [violationsThisWeek, autoModerated, humanReviewed] = await Promise.all([
      prisma.safetyEvent.count({
        where: { createdAt: { gte: startDate } }
      }),
      prisma.safetyEvent.count({
        where: {
          createdAt: { gte: startDate },
          humanReviewedAt: null
        }
      }),
      prisma.safetyEvent.count({
        where: {
          createdAt: { gte: startDate },
          humanReviewedAt: { not: null }
        }
      })
    ]);

    return { violationsThisWeek, autoModerated, humanReviewed };
  }

  private async getUserGrowth(timeframe: string) {
    const days = timeframe === 'week' ? 7 : timeframe === 'month' ? 30 : 365;
    const growth = [];

    for (let i = days - 1; i >= 0; i--) {
      const date = new Date();
      date.setDate(date.getDate() - i);
      const dayStart = new Date(date);
      dayStart.setHours(0, 0, 0, 0);
      const dayEnd = new Date(date);
      dayEnd.setHours(23, 59, 59, 999);

      const [newUsers, activeUsers] = await Promise.all([
        prisma.user.count({
          where: {
            createdAt: {
              gte: dayStart,
              lte: dayEnd
            }
          }
        }),
        prisma.user.count({
          where: {
            lastActiveAt: {
              gte: dayStart,
              lte: dayEnd
            }
          }
        })
      ]);

      growth.push({
        date: date.toISOString().split('T')[0],
        newUsers,
        activeUsers
      });
    }

    return growth;
  }
}

export const analyticsService = new AnalyticsService();