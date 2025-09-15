import OpenAI from 'openai';
import { zodResponseFormat } from 'openai/helpers/zod';
import { z } from 'zod';
import { PrismaClient } from '@speakpoly/database';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

const prisma = new PrismaClient();

// Zod schemas for structured outputs
const TopicSchema = z.object({
  text: z.string().describe('The topic question or prompt in the target language'),
  tags: z.array(z.string()).describe('Relevant tags for categorization'),
  difficulty: z.enum(['A1', 'A2', 'B1', 'B2', 'C1', 'C2']).describe('CEFR difficulty level'),
  culturalContext: z.string().optional().describe('Cultural context or background information'),
});

const TopicGenerationResponse = z.object({
  topics: z.array(TopicSchema).min(5).max(10),
});

const ConversationSummarySchema = z.object({
  newWords: z.array(z.object({
    word: z.string(),
    definition: z.string(),
    context: z.string(),
    language: z.enum(['native', 'learning']),
  })).describe('New vocabulary words learned during the conversation'),

  commonMistakes: z.array(z.object({
    mistake: z.string(),
    correction: z.string(),
    explanation: z.string(),
    language: z.enum(['native', 'learning']),
  })).describe('Common language mistakes and their corrections'),

  conversationQuality: z.object({
    fluency: z.number().min(1).max(10),
    vocabulary: z.number().min(1).max(10),
    grammar: z.number().min(1).max(10),
    engagement: z.number().min(1).max(10),
  }).describe('Quality metrics for the conversation'),

  followUpTask: z.string().optional().describe('Suggested follow-up learning task or topic'),

  keyMoments: z.array(z.string()).describe('Interesting or important moments from the conversation'),
});

export interface TopicGenerationOptions {
  language: string;
  level: string;
  interests?: string[];
  count?: number;
  excludeRecentTopics?: boolean;
}

export interface ConversationSummaryOptions {
  messages: Array<{
    content: string;
    senderId: string;
    language: string;
    timestamp: Date;
  }>;
  participants: Array<{
    id: string;
    nativeLanguages: string[];
    learningLanguage: string;
    level: string;
  }>;
  sessionDuration: number; // in minutes
}

export class AIService {
  /**
   * Generate conversation topics tailored to users' levels and interests
   */
  async generateTopics(options: TopicGenerationOptions) {
    try {
      const { language, level, interests = [], count = 5, excludeRecentTopics = true } = options;

      // Get recently used topics to avoid repetition
      let recentTopics: string[] = [];
      if (excludeRecentTopics) {
        const recent = await prisma.topic.findMany({
          where: {
            locale: language,
            difficulty: level as any,
            usageCount: { gt: 0 }
          },
          orderBy: { createdAt: 'desc' },
          take: 20,
          select: { text: true }
        });
        recentTopics = recent.map(t => t.text);
      }

      const interestsText = interests.length > 0
        ? `Focus on these interests: ${interests.join(', ')}. `
        : '';

      const recentTopicsText = recentTopics.length > 0
        ? `Avoid these recently used topics: ${recentTopics.slice(0, 10).join(', ')}. `
        : '';

      const prompt = `Generate ${count} engaging conversation topics for language learners at ${level} level learning ${language}.

${interestsText}${recentTopicsText}

Requirements:
- Topics should be appropriate for ${level} level (CEFR scale)
- Make them practical and relevant to real-life situations
- Include a mix of personal, cultural, and practical topics
- Ensure topics encourage natural conversation flow
- Add relevant tags for categorization
- Include cultural context where appropriate

Language: ${language}
Target Level: ${level}`;

      const completion = await openai.chat.completions.parse({
        model: 'gpt-4o',
        messages: [
          {
            role: 'system',
            content: 'You are an expert language learning coach who creates engaging conversation topics for language exchange. Focus on practical, culturally relevant topics that encourage natural conversation.'
          },
          {
            role: 'user',
            content: prompt
          }
        ],
        response_format: zodResponseFormat(TopicGenerationResponse, 'topic_generation'),
      });

      const parsedResponse = completion.choices[0]?.message.parsed;
      if (!parsedResponse) {
        throw new Error('Failed to parse AI response');
      }

      // Store topics in database
      const createdTopics = await Promise.all(
        parsedResponse.topics.map(topic =>
          prisma.topic.create({
            data: {
              locale: language,
              text: topic.text,
              tags: topic.tags,
              difficulty: topic.difficulty as any,
            }
          })
        )
      );

      return {
        topics: createdTopics,
        metadata: {
          generatedAt: new Date(),
          model: completion.model,
          language,
          level,
          interests
        }
      };

    } catch (error) {
      console.error('Topic generation error:', error);
      throw new Error('Failed to generate topics');
    }
  }

  /**
   * Generate conversation summary with learning insights
   */
  async generateConversationSummary(options: ConversationSummaryOptions) {
    try {
      const { messages, participants, sessionDuration } = options;

      if (messages.length < 5) {
        throw new Error('Not enough messages for meaningful summary');
      }

      // Prepare conversation text
      const conversationText = messages
        .map(msg => `[${msg.language}] ${msg.content}`)
        .join('\n');

      const participantInfo = participants
        .map(p => `Participant: Native ${p.nativeLanguages.join(', ')}, Learning ${p.learningLanguage} (${p.level})`)
        .join('\n');

      const prompt = `Analyze this language exchange conversation and provide learning insights.

Conversation Duration: ${sessionDuration} minutes
${participantInfo}

Conversation:
${conversationText}

Please analyze and provide:
1. New vocabulary words learned (with definitions and context)
2. Common language mistakes and corrections
3. Quality metrics for fluency, vocabulary, grammar, and engagement
4. Key memorable moments from the conversation
5. Suggested follow-up learning tasks

Focus on constructive feedback that helps both participants improve their language skills.`;

      const completion = await openai.chat.completions.parse({
        model: 'gpt-4o',
        messages: [
          {
            role: 'system',
            content: 'You are an expert language teacher analyzing a conversation between language exchange partners. Provide constructive, encouraging feedback that helps learners improve while celebrating their progress.'
          },
          {
            role: 'user',
            content: prompt
          }
        ],
        response_format: zodResponseFormat(ConversationSummarySchema, 'conversation_summary'),
      });

      const parsedResponse = completion.choices[0]?.message.parsed;
      if (!parsedResponse) {
        throw new Error('Failed to parse AI response');
      }

      return {
        summary: parsedResponse,
        metadata: {
          generatedAt: new Date(),
          model: completion.model,
          messageCount: messages.length,
          duration: sessionDuration,
          participantCount: participants.length
        }
      };

    } catch (error) {
      console.error('Conversation summary error:', error);
      throw new Error('Failed to generate conversation summary');
    }
  }

  /**
   * Get random topics from database for quick access
   */
  async getRandomTopics(language: string, level: string, count: number = 3) {
    try {
      const topics = await prisma.topic.findMany({
        where: {
          locale: language,
          difficulty: level as any
        },
        orderBy: {
          usageCount: 'asc' // Prefer less used topics
        },
        take: count * 2 // Get more than needed for randomization
      });

      // Randomly select from available topics
      const shuffled = topics.sort(() => 0.5 - Math.random());
      const selected = shuffled.slice(0, count);

      // Update usage count for selected topics
      if (selected.length > 0) {
        await prisma.topic.updateMany({
          where: {
            id: { in: selected.map(t => t.id) }
          },
          data: {
            usageCount: { increment: 1 }
          }
        });
      }

      return selected;
    } catch (error) {
      console.error('Random topics error:', error);
      throw new Error('Failed to get random topics');
    }
  }

  /**
   * Check if conversation is suitable for AI analysis
   */
  isConversationAnalyzable(messages: any[]): boolean {
    // Need minimum message count
    if (messages.length < 5) return false;

    // Need messages from both participants
    const senders = new Set(messages.map(m => m.senderId));
    if (senders.size < 2) return false;

    // Need sufficient text content
    const totalContent = messages
      .filter(m => m.type === 'TEXT' && m.body)
      .map(m => m.body)
      .join(' ');

    return totalContent.length > 200; // Minimum character count
  }

  /**
   * Generate contextual conversation starters based on user profiles
   */
  async generateContextualStarters(user1: any, user2: any, count: number = 3) {
    try {
      const commonInterests = user1.interests?.interests?.filter((interest: string) =>
        user2.interests?.interests?.includes(interest)
      ) || [];

      const prompt = `Generate ${count} conversation starters for language exchange partners:

Partner 1: Native ${user1.profile.nativeLanguages.join(', ')}, Learning ${user1.profile.learningLanguage} (${user1.profile.currentLevel})
Partner 2: Native ${user2.profile.nativeLanguages.join(', ')}, Learning ${user2.profile.learningLanguage} (${user2.profile.currentLevel})

${commonInterests.length > 0 ? `Common interests: ${commonInterests.join(', ')}` : ''}

Create engaging icebreakers that:
- Help partners get to know each other
- Encourage natural conversation flow
- Are appropriate for their language levels
- Reference their backgrounds when relevant
- Feel personal but not intrusive`;

      const completion = await openai.chat.completions.create({
        model: 'gpt-4o',
        messages: [
          {
            role: 'system',
            content: 'You are a language exchange facilitator. Create warm, engaging conversation starters that help partners connect naturally.'
          },
          {
            role: 'user',
            content: prompt
          }
        ],
        max_tokens: 500,
        temperature: 0.8,
      });

      const response = completion.choices[0]?.message.content;
      if (!response) {
        throw new Error('Failed to generate starters');
      }

      // Parse the response into individual starters
      const starters = response
        .split('\n')
        .filter(line => line.trim() && (line.match(/^\d+\./) || line.match(/^-/)))
        .map(line => line.replace(/^\d+\.\s*/, '').replace(/^-\s*/, '').trim())
        .slice(0, count);

      return starters;

    } catch (error) {
      console.error('Contextual starters error:', error);
      // Fallback to generic starters
      return [
        "What's your favorite way to practice languages?",
        "Tell me about something interesting from your culture.",
        "What motivated you to learn this language?"
      ];
    }
  }
}

// Export singleton instance
export const aiService = new AIService();