import { prisma } from '@speakpoly/database';
import {
  calculateTimeOverlap,
  calculateJaccardSimilarity,
  checkLanguageCompatibility
} from '@speakpoly/utils';
import { config } from '@speakpoly/config';
import type { MatchScore } from '@speakpoly/types';

interface UserMatchData {
  id: string;
  profile: {
    nativeLanguages: string[];
    learningLanguage: string;
    learningLevel: string;
    motives: string[];
  };
  interests: {
    tags: string[];
  };
  availability: {
    weeklySlots: any;
    timezone: string;
  };
  qualification: {
    reliabilityScore: number;
    longevityWeeks: number;
  };
}

export class MatchingAlgorithm {
  private weights = config.matching.weights;

  async findMatches(userId: string, limit: number = 20): Promise<MatchScore[]> {
    // Get current user data
    const currentUser = await this.getUserMatchData(userId);
    if (!currentUser) {
      throw new Error('User not found or incomplete profile');
    }

    // Get all potential matches
    const potentialMatches = await this.getPotentialMatches(currentUser);

    // Calculate match scores
    const scores = potentialMatches.map(match =>
      this.calculateMatchScore(currentUser, match)
    );

    // Sort by score and return top matches
    return scores
      .sort((a, b) => b.score - a.score)
      .slice(0, limit);
  }

  private async getUserMatchData(userId: string): Promise<UserMatchData | null> {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      include: {
        profile: true,
        interests: true,
        availability: true,
        qualification: true,
      },
    });

    if (!user?.profile || !user.interests || !user.availability) {
      return null;
    }

    return {
      id: user.id,
      profile: user.profile,
      interests: user.interests,
      availability: user.availability,
      qualification: user.qualification || {
        reliabilityScore: 100,
        longevityWeeks: 0,
      },
    };
  }

  private async getPotentialMatches(currentUser: UserMatchData): Promise<UserMatchData[]> {
    // Find users who:
    // 1. Are native in the language the current user is learning
    // 2. Are learning a language the current user is native in
    // 3. Have completed their profile
    // 4. Are active
    // 5. Don't already have a pair with current user

    const existingPairs = await prisma.pair.findMany({
      where: {
        OR: [
          { userAId: currentUser.id },
          { userBId: currentUser.id },
        ],
        status: { in: ['PENDING', 'ACTIVE'] },
      },
      select: {
        userAId: true,
        userBId: true,
      },
    });

    const pairedUserIds = existingPairs.flatMap(pair => [pair.userAId, pair.userBId])
      .filter(id => id !== currentUser.id);

    const matches = await prisma.user.findMany({
      where: {
        id: {
          not: currentUser.id,
          notIn: pairedUserIds,
        },
        status: 'ACTIVE',
        ageVerified18Plus: true,
        profile: {
          nativeLanguages: {
            has: currentUser.profile.learningLanguage,
          },
          learningLanguage: {
            in: currentUser.profile.nativeLanguages,
          },
        },
      },
      include: {
        profile: true,
        interests: true,
        availability: true,
        qualification: true,
      },
    });

    return matches
      .filter(m => m.profile && m.interests && m.availability)
      .map(m => ({
        id: m.id,
        profile: m.profile!,
        interests: m.interests!,
        availability: m.availability!,
        qualification: m.qualification || {
          reliabilityScore: 100,
          longevityWeeks: 0,
        },
      }));
  }

  private calculateMatchScore(user1: UserMatchData, user2: UserMatchData): MatchScore {
    const components = {
      languageCompatibility: 0,
      timeOverlap: 0,
      interestOverlap: 0,
      goalMatch: 0,
      reliability: 0,
      longevity: 0,
    };

    // 1. Language Compatibility (binary - must match)
    const langCompat = checkLanguageCompatibility(
      user1.profile.nativeLanguages,
      user1.profile.learningLanguage,
      user2.profile.nativeLanguages,
      user2.profile.learningLanguage
    );
    components.languageCompatibility = langCompat ? 1 : 0;

    // If no language compatibility, score is 0
    if (!langCompat) {
      return {
        userId: user2.id,
        score: 0,
        components,
      };
    }

    // 2. Time Overlap (normalized to 0-1)
    const timeOverlapMinutes = calculateTimeOverlap(
      user1.availability.weeklySlots,
      user2.availability.weeklySlots
    );
    // Normalize: 10+ hours of overlap = 1.0
    components.timeOverlap = Math.min(1, timeOverlapMinutes / 600);

    // 3. Interest Overlap (Jaccard similarity)
    components.interestOverlap = calculateJaccardSimilarity(
      user1.interests.tags,
      user2.interests.tags
    );

    // 4. Goal Match (at least one common motive)
    const commonMotives = user1.profile.motives.filter(m =>
      user2.profile.motives.includes(m)
    );
    components.goalMatch = commonMotives.length > 0 ? 1 : 0;

    // 5. Reliability Score (normalized)
    components.reliability = user2.qualification.reliabilityScore / 100;

    // 6. Longevity Intent (bonus for users seeking long-term)
    const longevityBonus = user2.qualification.longevityWeeks > 0 ? 0.5 : 0;
    if (user1.profile.motives.includes('friendly') &&
        user2.profile.motives.includes('friendly')) {
      components.longevity = 1;
    } else {
      components.longevity = longevityBonus;
    }

    // Calculate weighted score
    const score =
      components.languageCompatibility * this.weights.languageCompatibility +
      components.timeOverlap * this.weights.timeOverlap +
      components.interestOverlap * this.weights.interestOverlap +
      components.goalMatch * this.weights.goalMatch +
      components.reliability * this.weights.reliability +
      components.longevity * this.weights.longevity;

    return {
      userId: user2.id,
      score: Math.round(score * 100) / 100, // Round to 2 decimals
      components,
    };
  }

  async createMatchRequest(
    requesterId: string,
    requestedId: string,
    message?: string
  ): Promise<any> {
    // Check if request already exists
    const existingRequest = await prisma.matchRequest.findFirst({
      where: {
        OR: [
          { requesterId, requestedId },
          { requesterId: requestedId, requestedId: requesterId },
        ],
        status: 'pending',
      },
    });

    if (existingRequest) {
      throw new Error('Match request already exists');
    }

    // Check open request limit
    const openRequests = await prisma.matchRequest.count({
      where: {
        requesterId,
        status: 'pending',
      },
    });

    if (openRequests >= config.app.maxOpenRequests) {
      throw new Error(`Maximum ${config.app.maxOpenRequests} open requests allowed`);
    }

    // Create match request
    const request = await prisma.matchRequest.create({
      data: {
        requesterId,
        requestedId,
        message,
        expiresAt: new Date(Date.now() + config.app.requestExpiryHours * 60 * 60 * 1000),
      },
      include: {
        requester: {
          select: {
            id: true,
            pseudonym: true,
            profile: {
              select: {
                learningLanguage: true,
                learningLevel: true,
              },
            },
          },
        },
        requested: {
          select: {
            id: true,
            pseudonym: true,
          },
        },
      },
    });

    return request;
  }

  async acceptMatchRequest(requestId: string, userId: string): Promise<any> {
    const request = await prisma.matchRequest.findFirst({
      where: {
        id: requestId,
        requestedId: userId,
        status: 'pending',
      },
    });

    if (!request) {
      throw new Error('Match request not found or already processed');
    }

    // Create pair and update request in transaction
    const result = await prisma.$transaction(async (tx) => {
      // Update request status
      await tx.matchRequest.update({
        where: { id: requestId },
        data: {
          status: 'accepted',
          respondedAt: new Date(),
        },
      });

      // Create pair
      const pair = await tx.pair.create({
        data: {
          userAId: request.requesterId,
          userBId: request.requestedId,
          status: 'ACTIVE',
        },
        include: {
          userA: {
            select: {
              id: true,
              pseudonym: true,
              profile: true,
            },
          },
          userB: {
            select: {
              id: true,
              pseudonym: true,
              profile: true,
            },
          },
        },
      });

      // Reject all other pending requests for both users
      await tx.matchRequest.updateMany({
        where: {
          OR: [
            { requesterId: request.requesterId, status: 'pending' },
            { requestedId: request.requesterId, status: 'pending' },
            { requesterId: request.requestedId, status: 'pending' },
            { requestedId: request.requestedId, status: 'pending' },
          ],
          id: { not: requestId },
        },
        data: {
          status: 'expired',
          respondedAt: new Date(),
        },
      });

      return pair;
    });

    return result;
  }

  async rejectMatchRequest(requestId: string, userId: string): Promise<void> {
    await prisma.matchRequest.update({
      where: {
        id: requestId,
        requestedId: userId,
      },
      data: {
        status: 'rejected',
        respondedAt: new Date(),
      },
    });
  }

  async getExpiredRequests(): Promise<any[]> {
    const expired = await prisma.matchRequest.findMany({
      where: {
        status: 'pending',
        expiresAt: {
          lt: new Date(),
        },
      },
    });

    if (expired.length > 0) {
      await prisma.matchRequest.updateMany({
        where: {
          id: {
            in: expired.map(r => r.id),
          },
        },
        data: {
          status: 'expired',
        },
      });
    }

    return expired;
  }
}