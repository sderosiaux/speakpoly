import { PrismaClient } from '@speakpoly/database';
import { SafetyResult, SafetyViolation, ViolationSeverity } from './index';

const prisma = new PrismaClient();

export interface SafetyEventData {
  userId: string;
  pairId?: string;
  messageId?: string;
  content: string;
  safetyResult: SafetyResult;
  userAgent?: string;
  ipAddress?: string;
}

export interface ModerationAction {
  type: 'warning' | 'temporary_restriction' | 'permanent_ban' | 'escalate_to_human';
  duration?: number; // minutes for temporary restrictions
  reason: string;
  autoApplied: boolean;
}

export class ModeratorService {
  /**
   * Record a safety event and apply appropriate actions
   */
  async recordSafetyEvent(eventData: SafetyEventData): Promise<ModerationAction[]> {
    const actions: ModerationAction[] = [];

    try {
      // Create safety event record
      const safetyEvent = await prisma.safetyEvent.create({
        data: {
          userId: eventData.userId,
          pairId: eventData.pairId,
          messageId: eventData.messageId,
          eventType: this.determineEventType(eventData.safetyResult.violations),
          severity: this.getHighestSeverity(eventData.safetyResult.violations),
          content: eventData.content,
          processedContent: eventData.safetyResult.processedText,
          violations: JSON.stringify(eventData.safetyResult.violations),
          metadata: JSON.stringify({
            confidence: eventData.safetyResult.confidence,
            sightengineUsed: eventData.safetyResult.metadata.sightengineUsed,
            requestId: eventData.safetyResult.metadata.requestId,
            userAgent: eventData.userAgent,
            ipAddress: eventData.ipAddress
          })
        }
      });

      // Get user's recent violation history
      const recentViolations = await this.getUserRecentViolations(eventData.userId);

      // Determine and apply sanctions
      const sanctionAction = await this.determineSanctions(
        eventData.userId,
        eventData.safetyResult.violations,
        recentViolations
      );

      if (sanctionAction) {
        actions.push(sanctionAction);
      }

      // Check if human moderation is needed
      if (this.requiresHumanReview(eventData.safetyResult.violations, recentViolations)) {
        actions.push({
          type: 'escalate_to_human',
          reason: 'Complex violation pattern requires human review',
          autoApplied: true
        });

        // Mark event for human review
        await prisma.safetyEvent.update({
          where: { id: safetyEvent.id },
          data: { requiresHumanReview: true }
        });
      }

      // Update user's safety score
      await this.updateUserSafetyScore(eventData.userId, eventData.safetyResult.violations);

      return actions;

    } catch (error) {
      console.error('Error recording safety event:', error);
      throw new Error('Failed to process safety event');
    }
  }

  /**
   * Get user's recent safety violations (last 30 days)
   */
  private async getUserRecentViolations(userId: string) {
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    return await prisma.safetyEvent.findMany({
      where: {
        userId,
        createdAt: {
          gte: thirtyDaysAgo
        }
      },
      orderBy: {
        createdAt: 'desc'
      }
    });
  }

  /**
   * Determine appropriate sanctions based on violations and history
   */
  private async determineSanctions(
    userId: string,
    violations: SafetyViolation[],
    recentViolations: any[]
  ): Promise<ModerationAction | null> {
    // Immediate severe violations
    const criticalViolations = violations.filter(v => v.severity === ViolationSeverity.CRITICAL);
    if (criticalViolations.length > 0) {
      await this.applySanction(userId, 'suspended', 24 * 60, 'Critical safety violation');
      return {
        type: 'temporary_restriction',
        duration: 24 * 60,
        reason: 'Critical safety violation detected',
        autoApplied: true
      };
    }

    // Multiple high severity violations
    const highViolations = violations.filter(v => v.severity === ViolationSeverity.HIGH);
    if (highViolations.length >= 2) {
      await this.applySanction(userId, 'suspended', 4 * 60, 'Multiple high-severity violations');
      return {
        type: 'temporary_restriction',
        duration: 4 * 60,
        reason: 'Multiple high-severity violations',
        autoApplied: true
      };
    }

    // Pattern of repeated violations
    const recentHighSeverityCount = recentViolations.filter(
      event => event.severity === 'HIGH' || event.severity === 'CRITICAL'
    ).length;

    if (recentHighSeverityCount >= 3) {
      await this.applySanction(userId, 'suspended', 12 * 60, 'Pattern of repeated violations');
      return {
        type: 'temporary_restriction',
        duration: 12 * 60,
        reason: 'Pattern of repeated violations detected',
        autoApplied: true
      };
    }

    // First-time medium violations - warning only
    const mediumViolations = violations.filter(v => v.severity === ViolationSeverity.MEDIUM);
    if (mediumViolations.length > 0 && recentViolations.length === 0) {
      await this.recordWarning(userId, 'First-time policy violation detected');
      return {
        type: 'warning',
        reason: 'First-time policy violation - educational warning issued',
        autoApplied: true
      };
    }

    return null;
  }

  /**
   * Apply sanctions to a user
   */
  private async applySanction(
    userId: string,
    status: 'suspended' | 'banned',
    durationMinutes?: number,
    reason?: string
  ) {
    const suspendedUntil = durationMinutes
      ? new Date(Date.now() + durationMinutes * 60 * 1000)
      : undefined;

    await prisma.user.update({
      where: { id: userId },
      data: {
        status: status.toUpperCase() as any,
        suspendedUntil,
        suspensionReason: reason
      }
    });

    // End any active sessions
    await prisma.session.updateMany({
      where: {
        pair: {
          OR: [
            { user1Id: userId },
            { user2Id: userId }
          ]
        },
        status: 'ACTIVE'
      },
      data: {
        status: 'ENDED',
        endedAt: new Date(),
        endReason: 'USER_SANCTIONED'
      }
    });
  }

  /**
   * Record a warning for the user
   */
  private async recordWarning(userId: string, reason: string) {
    await prisma.user.update({
      where: { id: userId },
      data: {
        warningCount: {
          increment: 1
        },
        lastWarningAt: new Date()
      }
    });

    // Could also send notification to user about the warning
  }

  /**
   * Update user's safety score based on violations
   */
  private async updateUserSafetyScore(userId: string, violations: SafetyViolation[]) {
    let scoreDeduction = 0;

    violations.forEach(violation => {
      switch (violation.severity) {
        case ViolationSeverity.CRITICAL:
          scoreDeduction += 50;
          break;
        case ViolationSeverity.HIGH:
          scoreDeduction += 25;
          break;
        case ViolationSeverity.MEDIUM:
          scoreDeduction += 10;
          break;
        case ViolationSeverity.LOW:
          scoreDeduction += 5;
          break;
      }
    });

    // Apply score deduction (minimum score of 0)
    await prisma.user.update({
      where: { id: userId },
      data: {
        safetyScore: {
          decrement: scoreDeduction
        }
      }
    });

    // Ensure safety score doesn't go below 0
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { safetyScore: true }
    });

    if (user && user.safetyScore < 0) {
      await prisma.user.update({
        where: { id: userId },
        data: { safetyScore: 0 }
      });
    }
  }

  /**
   * Check if violations require human review
   */
  private requiresHumanReview(violations: SafetyViolation[], recentViolations: any[]): boolean {
    // Always escalate critical violations for review
    if (violations.some(v => v.severity === ViolationSeverity.CRITICAL)) {
      return true;
    }

    // Escalate users with 5+ violations in last 30 days
    if (recentViolations.length >= 5) {
      return true;
    }

    // Escalate complex ML detection patterns
    const mlViolations = violations.filter(v => v.category === 'ml-based');
    if (mlViolations.length >= 3) {
      return true;
    }

    return false;
  }

  /**
   * Determine the primary event type from violations
   */
  private determineEventType(violations: SafetyViolation[]): string {
    if (violations.length === 0) return 'UNKNOWN';

    // Prioritize by severity and type
    const priorityOrder = [
      'contact_email', 'contact_phone', 'contact_social',
      'profanity_sexual', 'profanity_discriminatory',
      'extremism', 'violence', 'self-harm',
      'weapon', 'drug', 'content-trade',
      'spam', 'external_link'
    ];

    for (const priority of priorityOrder) {
      if (violations.some(v => v.type === priority)) {
        return priority.toUpperCase();
      }
    }

    return violations[0].type.toUpperCase();
  }

  /**
   * Get the highest severity from violations
   */
  private getHighestSeverity(violations: SafetyViolation[]): string {
    if (violations.some(v => v.severity === ViolationSeverity.CRITICAL)) return 'CRITICAL';
    if (violations.some(v => v.severity === ViolationSeverity.HIGH)) return 'HIGH';
    if (violations.some(v => v.severity === ViolationSeverity.MEDIUM)) return 'MEDIUM';
    return 'LOW';
  }

  /**
   * Get safety statistics for monitoring
   */
  async getSafetyStats(timeframe: 'day' | 'week' | 'month' = 'day') {
    const now = new Date();
    const startDate = new Date();

    switch (timeframe) {
      case 'day':
        startDate.setDate(now.getDate() - 1);
        break;
      case 'week':
        startDate.setDate(now.getDate() - 7);
        break;
      case 'month':
        startDate.setDate(now.getDate() - 30);
        break;
    }

    const [
      totalEvents,
      criticalEvents,
      humanReviewEvents,
      activeSuspensions
    ] = await Promise.all([
      prisma.safetyEvent.count({
        where: { createdAt: { gte: startDate } }
      }),
      prisma.safetyEvent.count({
        where: {
          createdAt: { gte: startDate },
          severity: 'CRITICAL'
        }
      }),
      prisma.safetyEvent.count({
        where: {
          createdAt: { gte: startDate },
          requiresHumanReview: true
        }
      }),
      prisma.user.count({
        where: {
          status: 'SUSPENDED',
          suspendedUntil: { gt: now }
        }
      })
    ]);

    return {
      timeframe,
      totalEvents,
      criticalEvents,
      humanReviewEvents,
      activeSuspensions,
      stats: {
        criticalRate: totalEvents > 0 ? (criticalEvents / totalEvents) * 100 : 0,
        humanReviewRate: totalEvents > 0 ? (humanReviewEvents / totalEvents) * 100 : 0
      }
    };
  }

  /**
   * Get events requiring human review
   */
  async getEventsForHumanReview(limit: number = 50) {
    return await prisma.safetyEvent.findMany({
      where: {
        requiresHumanReview: true,
        humanReviewedAt: null
      },
      include: {
        user: {
          select: {
            id: true,
            pseudonym: true,
            safetyScore: true,
            status: true
          }
        }
      },
      orderBy: [
        { severity: 'desc' },
        { createdAt: 'desc' }
      ],
      take: limit
    });
  }
}

export const moderatorService = new ModeratorService();