import { PrismaClient } from '@speakpoly/database';
import { analyticsService } from '../analytics';

const prisma = new PrismaClient();

export interface NudgeConfig {
  type: 'reminder' | 'encouragement' | 'milestone' | 'streak_break' | 'partner_request';
  timing: 'immediate' | 'delayed' | 'scheduled';
  delayMinutes?: number;
  scheduledAt?: Date;
  priority: 'low' | 'medium' | 'high';
  channels: Array<'in_app' | 'email' | 'push'>;
}

export interface RematchSuggestion {
  userId: string;
  potentialPartners: Array<{
    partnerId: string;
    partnerPseudonym: string;
    compatibility: number;
    reason: string;
    previousSessions?: number;
    lastSessionDate?: Date;
  }>;
  preferences: {
    preferKnownPartners: boolean;
    preferNewPartners: boolean;
    preferSimilarLevel: boolean;
    preferDifferentLevel: boolean;
  };
}

export interface EngagementInsight {
  userId: string;
  riskLevel: 'low' | 'medium' | 'high';
  riskFactors: string[];
  recommendations: string[];
  suggestedNudges: NudgeConfig[];
  retentionScore: number;
  engagementTrend: 'improving' | 'stable' | 'declining';
}

export class EngagementService {
  /**
   * Send contextual nudges to encourage user engagement
   */
  async sendNudge(userId: string, config: NudgeConfig, customMessage?: string): Promise<void> {
    try {
      const user = await prisma.user.findUnique({
        where: { id: userId },
        include: {
          profile: true
        }
      });

      if (!user) {
        throw new Error('User not found');
      }

      const message = customMessage || await this.generateNudgeMessage(user, config);

      // Store nudge in database for tracking
      const nudge = await prisma.notification.create({
        data: {
          userId,
          type: config.type.toUpperCase(),
          title: this.getNudgeTitle(config.type),
          content: message,
          priority: config.priority.toUpperCase(),
          channels: config.channels,
          scheduledAt: config.scheduledAt,
          status: config.timing === 'immediate' ? 'SENT' : 'PENDING'
        }
      });

      // Send immediately or schedule
      if (config.timing === 'immediate') {
        await this.deliverNudge(nudge);
      } else if (config.timing === 'delayed' && config.delayMinutes) {
        setTimeout(() => this.deliverNudge(nudge), config.delayMinutes * 60 * 1000);
      }

      // Track analytics
      await analyticsService.trackActivity(userId, 'nudge_sent', {
        nudgeType: config.type,
        nudgeId: nudge.id
      });

    } catch (error) {
      console.error('Nudge sending error:', error);
      throw new Error('Failed to send nudge');
    }
  }

  /**
   * Generate personalized rematch suggestions
   */
  async generateRematchSuggestions(userId: string): Promise<RematchSuggestion> {
    try {
      const user = await prisma.user.findUnique({
        where: { id: userId },
        include: {
          profile: true,
          interests: true,
          pairsAsUserA: {
            include: {
              userB: {
                include: {
                  profile: true,
                  interests: true
                }
              },
              sessions: {
                orderBy: { startedAt: 'desc' },
                take: 1
              }
            }
          },
          pairsAsUserB: {
            include: {
              userA: {
                include: {
                  profile: true,
                  interests: true
                }
              },
              sessions: {
                orderBy: { startedAt: 'desc' },
                take: 1
              }
            }
          }
        }
      });

      if (!user) {
        throw new Error('User not found');
      }

      // Get all previous partners
      const previousPartners = [
        ...user.pairsAsUserA.map(pair => ({
          partner: pair.userB,
          sessions: pair.sessions.length,
          lastSession: pair.sessions[0]?.startedAt
        })),
        ...user.pairsAsUserB.map(pair => ({
          partner: pair.userA,
          sessions: pair.sessions.length,
          lastSession: pair.sessions[0]?.startedAt
        }))
      ];

      // Find potential new partners
      const potentialNewPartners = await this.findPotentialPartners(user);

      // Combine and rank suggestions
      const suggestions = [];

      // Add previous partners with good experiences
      previousPartners.forEach(({ partner, sessions, lastSession }) => {
        if (sessions >= 2) { // Had multiple successful sessions
          const compatibility = this.calculatePartnerCompatibility(user, partner);
          suggestions.push({
            partnerId: partner.id,
            partnerPseudonym: partner.pseudonym,
            compatibility,
            reason: `You had ${sessions} great conversation${sessions > 1 ? 's' : ''} together`,
            previousSessions: sessions,
            lastSessionDate: lastSession
          });
        }
      });

      // Add new potential partners
      potentialNewPartners.slice(0, 3).forEach(partner => {
        const compatibility = this.calculatePartnerCompatibility(user, partner);
        suggestions.push({
          partnerId: partner.id,
          partnerPseudonym: partner.pseudonym,
          compatibility,
          reason: this.getMatchReason(user, partner),
          previousSessions: 0
        });
      });

      // Sort by compatibility
      suggestions.sort((a, b) => b.compatibility - a.compatibility);

      // Determine user preferences based on history
      const preferences = this.analyzeUserPreferences(previousPartners);

      return {
        userId,
        potentialPartners: suggestions.slice(0, 5),
        preferences
      };

    } catch (error) {
      console.error('Rematch suggestions error:', error);
      throw new Error('Failed to generate rematch suggestions');
    }
  }

  /**
   * Analyze user engagement and provide insights
   */
  async analyzeUserEngagement(userId: string): Promise<EngagementInsight> {
    try {
      const userProgress = await analyticsService.getUserProgress(userId, 'month');
      const user = await prisma.user.findUnique({
        where: { id: userId },
        select: {
          createdAt: true,
          lastActiveAt: true,
          safetyScore: true
        }
      });

      if (!user) {
        throw new Error('User not found');
      }

      const riskFactors = [];
      const recommendations = [];
      const suggestedNudges: NudgeConfig[] = [];

      // Analyze risk factors
      const daysSinceLastActive = user.lastActiveAt
        ? Math.floor((Date.now() - user.lastActiveAt.getTime()) / (1000 * 60 * 60 * 24))
        : 999;

      if (daysSinceLastActive > 7) {
        riskFactors.push('Inactive for over a week');
        recommendations.push('Send re-engagement nudge');
        suggestedNudges.push({
          type: 'reminder',
          timing: 'immediate',
          priority: 'medium',
          channels: ['in_app', 'email']
        });
      }

      if (userProgress.streakDays === 0 && userProgress.totalSessions > 0) {
        riskFactors.push('Lost practice streak');
        recommendations.push('Encourage streak restart');
        suggestedNudges.push({
          type: 'streak_break',
          timing: 'immediate',
          priority: 'medium',
          channels: ['in_app']
        });
      }

      if (userProgress.totalSessions < 3) {
        riskFactors.push('Low session count');
        recommendations.push('Provide onboarding support');
        suggestedNudges.push({
          type: 'encouragement',
          timing: 'immediate',
          priority: 'high',
          channels: ['in_app']
        });
      }

      if (userProgress.avgSessionLength < 10) {
        riskFactors.push('Short session duration');
        recommendations.push('Suggest longer conversations');
      }

      // Calculate retention score
      const retentionScore = this.calculateRetentionScore(user, userProgress);

      // Determine risk level
      const riskLevel = this.determineRiskLevel(riskFactors, retentionScore);

      // Analyze engagement trend
      const engagementTrend = this.analyzeEngagementTrend(userProgress);

      return {
        userId,
        riskLevel,
        riskFactors,
        recommendations,
        suggestedNudges,
        retentionScore,
        engagementTrend
      };

    } catch (error) {
      console.error('Engagement analysis error:', error);
      throw new Error('Failed to analyze user engagement');
    }
  }

  /**
   * Send rematch invitation to a previous partner
   */
  async sendRematchInvitation(fromUserId: string, toUserId: string, message?: string): Promise<void> {
    try {
      // Check if users previously had a successful pair
      const previousPair = await prisma.pair.findFirst({
        where: {
          OR: [
            { userAId: fromUserId, userBId: toUserId },
            { userAId: toUserId, userBId: fromUserId }
          ]
        },
        include: {
          sessions: true
        }
      });

      if (!previousPair || previousPair.sessions.length === 0) {
        throw new Error('No previous successful sessions found');
      }

      // Create rematch request
      const rematchRequest = await prisma.matchRequest.create({
        data: {
          requesterId: fromUserId,
          requestedId: toUserId,
          status: 'PENDING',
          isRematch: true,
          previousPairId: previousPair.id,
          message: message || 'Would you like to practice again?'
        }
      });

      // Send notification
      await this.sendNudge(toUserId, {
        type: 'partner_request',
        timing: 'immediate',
        priority: 'medium',
        channels: ['in_app']
      }, `${await this.getUserPseudonym(fromUserId)} wants to practice with you again!`);

      // Track analytics
      await analyticsService.trackActivity(fromUserId, 'rematch_invitation_sent', {
        targetUserId: toUserId,
        requestId: rematchRequest.id
      });

    } catch (error) {
      console.error('Rematch invitation error:', error);
      throw new Error('Failed to send rematch invitation');
    }
  }

  /**
   * Process automated engagement campaigns
   */
  async processEngagementCampaigns(): Promise<void> {
    try {
      // Find users who need engagement nudges
      const inactiveUsers = await this.findInactiveUsers();
      const streakBreakUsers = await this.findStreakBreakUsers();
      const milestoneUsers = await this.findMilestoneUsers();

      // Send appropriate nudges
      for (const user of inactiveUsers) {
        await this.sendNudge(user.id, {
          type: 'reminder',
          timing: 'immediate',
          priority: 'medium',
          channels: ['in_app', 'email']
        });
      }

      for (const user of streakBreakUsers) {
        await this.sendNudge(user.id, {
          type: 'streak_break',
          timing: 'immediate',
          priority: 'high',
          channels: ['in_app']
        });
      }

      for (const user of milestoneUsers) {
        await this.sendNudge(user.id, {
          type: 'milestone',
          timing: 'immediate',
          priority: 'low',
          channels: ['in_app']
        });
      }

      console.log(`Engagement campaigns processed: ${inactiveUsers.length + streakBreakUsers.length + milestoneUsers.length} nudges sent`);

    } catch (error) {
      console.error('Engagement campaigns error:', error);
    }
  }

  // Private helper methods

  private async generateNudgeMessage(user: any, config: NudgeConfig): Promise<string> {
    const name = user.pseudonym;

    switch (config.type) {
      case 'reminder':
        return `Hi ${name}! Ready for another language practice session? Your conversation partner is waiting! 💬`;

      case 'encouragement':
        return `You're doing great, ${name}! Keep up the momentum with another practice session. Every conversation helps you improve! 🌟`;

      case 'milestone':
        return `Congratulations, ${name}! You've reached a new milestone. Time to celebrate with another conversation! 🎉`;

      case 'streak_break':
        return `Don't let your streak end, ${name}! Jump back in with a quick practice session. You've got this! 🔥`;

      case 'partner_request':
        return `${name}, someone wants to practice with you! Check out your new conversation request. 👋`;

      default:
        return `Hey ${name}! Time for some language practice! 📚`;
    }
  }

  private getNudgeTitle(type: string): string {
    switch (type) {
      case 'reminder':
        return 'Time to Practice!';
      case 'encouragement':
        return 'Keep Going!';
      case 'milestone':
        return 'Milestone Achieved!';
      case 'streak_break':
        return 'Maintain Your Streak!';
      case 'partner_request':
        return 'New Practice Request!';
      default:
        return 'SpeakPoly Notification';
    }
  }

  private async deliverNudge(nudge: any): Promise<void> {
    // In a real implementation, you'd integrate with push notification services,
    // email providers, etc. For now, we'll just log and update the status.

    console.log(`Delivering nudge: ${nudge.title} to user ${nudge.userId}`);

    await prisma.notification.update({
      where: { id: nudge.id },
      data: {
        status: 'SENT',
        sentAt: new Date()
      }
    });
  }

  private async findPotentialPartners(user: any) {
    // Simplified partner finding - in reality, you'd use the matching algorithm
    return await prisma.user.findMany({
      where: {
        id: { not: user.id },
        status: 'ACTIVE',
        profile: {
          learningLanguage: { in: user.profile?.nativeLanguages || [] },
          nativeLanguages: { has: user.profile?.learningLanguage || 'en' }
        }
      },
      include: {
        profile: true,
        interests: true
      },
      take: 10
    });
  }

  private calculatePartnerCompatibility(user1: any, user2: any): number {
    // Simplified compatibility calculation
    let score = 70; // Base score

    // Language compatibility
    if (user1.profile?.nativeLanguages?.includes(user2.profile?.learningLanguage)) {
      score += 15;
    }

    // Interest compatibility
    const interests1 = user1.interests?.interests || [];
    const interests2 = user2.interests?.interests || [];
    const commonInterests = interests1.filter((i: string) => interests2.includes(i));
    score += Math.min(15, commonInterests.length * 3);

    return Math.min(100, score);
  }

  private getMatchReason(user1: any, user2: any): string {
    const interests1 = user1.interests?.interests || [];
    const interests2 = user2.interests?.interests || [];
    const commonInterests = interests1.filter((i: string) => interests2.includes(i));

    if (commonInterests.length > 0) {
      return `You both enjoy ${commonInterests.slice(0, 2).join(' and ')}`;
    }

    return 'Great language match for practice';
  }

  private analyzeUserPreferences(previousPartners: any[]) {
    const hasRepeatPartners = previousPartners.some(p => p.sessions > 1);
    const recentActivity = previousPartners.filter(p =>
      p.lastSession && (Date.now() - p.lastSession.getTime()) < 30 * 24 * 60 * 60 * 1000
    );

    return {
      preferKnownPartners: hasRepeatPartners,
      preferNewPartners: !hasRepeatPartners,
      preferSimilarLevel: true, // Default preference
      preferDifferentLevel: false
    };
  }

  private calculateRetentionScore(user: any, progress: any): number {
    let score = 50; // Base score

    // Activity recency
    const daysSinceLastActive = user.lastActiveAt
      ? Math.floor((Date.now() - user.lastActiveAt.getTime()) / (1000 * 60 * 60 * 24))
      : 999;

    if (daysSinceLastActive < 1) score += 30;
    else if (daysSinceLastActive < 3) score += 20;
    else if (daysSinceLastActive < 7) score += 10;
    else score -= 20;

    // Session frequency
    if (progress.totalSessions > 10) score += 20;
    else if (progress.totalSessions > 5) score += 10;

    // Streak
    if (progress.streakDays > 7) score += 15;
    else if (progress.streakDays > 3) score += 10;

    return Math.max(0, Math.min(100, score));
  }

  private determineRiskLevel(riskFactors: string[], retentionScore: number): 'low' | 'medium' | 'high' {
    if (retentionScore < 30 || riskFactors.length >= 3) return 'high';
    if (retentionScore < 60 || riskFactors.length >= 2) return 'medium';
    return 'low';
  }

  private analyzeEngagementTrend(progress: any): 'improving' | 'stable' | 'declining' {
    // Simplified trend analysis based on recent activity
    if (progress.weeklyActivity.length < 2) return 'stable';

    const recent = progress.weeklyActivity.slice(-2);
    const trend = recent[1].sessions - recent[0].sessions;

    if (trend > 0) return 'improving';
    if (trend < 0) return 'declining';
    return 'stable';
  }

  private async findInactiveUsers() {
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

    return await prisma.user.findMany({
      where: {
        lastActiveAt: { lt: sevenDaysAgo },
        status: 'ACTIVE'
      },
      take: 50
    });
  }

  private async findStreakBreakUsers() {
    // Users who had streaks but haven't been active recently
    const twoDaysAgo = new Date(Date.now() - 2 * 24 * 60 * 60 * 1000);

    return await prisma.user.findMany({
      where: {
        lastActiveAt: { lt: twoDaysAgo },
        status: 'ACTIVE'
      },
      take: 50
    });
  }

  private async findMilestoneUsers() {
    // Users who recently achieved milestones but haven't received nudges
    return [];
  }

  private async getUserPseudonym(userId: string): Promise<string> {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { pseudonym: true }
    });

    return user?.pseudonym || 'Someone';
  }
}

export const engagementService = new EngagementService();