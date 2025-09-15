const { createServer } = require('http');
const { parse } = require('url');
const next = require('next');
const { Server } = require('socket.io');
const { getServerSession } = require('next-auth');
const { authOptions } = require('./lib/auth');
const { PrismaClient } = require('@prisma/client');
const { detectAndRedactContactInfo } = require('@speakpoly/utils');
const { safetyService } = require('../services/safety');
const { moderatorService } = require('../services/safety/moderator');
const { aiService } = require('../services/ai');
const { analyticsService } = require('../services/analytics');

const dev = process.env.NODE_ENV !== 'production';
const hostname = 'localhost';
const port = process.env.PORT || 3000;

const app = next({ dev, hostname, port });
const handle = app.getRequestHandler();

const prisma = new PrismaClient();

app.prepare().then(() => {
  const httpServer = createServer(async (req, res) => {
    try {
      const parsedUrl = parse(req.url, true);
      await handle(req, res, parsedUrl);
    } catch (err) {
      console.error('Error occurred handling', req.url, err);
      res.statusCode = 500;
      res.end('internal server error');
    }
  });

  const io = new Server(httpServer, {
    path: '/api/socket.io',
    addTrailingSlash: false,
    cors: {
      origin: dev ? '*' : false,
      methods: ['GET', 'POST'],
    },
  });

  // Socket.io middleware for authentication
  io.use(async (socket, next) => {
    try {
      const token = socket.handshake.auth.token;
      if (!token?.userId) {
        return next(new Error('Authentication error'));
      }
      socket.data.userId = token.userId;
      next();
    } catch (err) {
      next(new Error('Authentication error'));
    }
  });

  io.on('connection', (socket) => {
    console.log('User connected:', socket.data.userId);

    // Join user to their personal room
    socket.join(`user:${socket.data.userId}`);

    // Handle joining a chat pair
    socket.on('join-pair', async (pairId) => {
      try {
        // Verify user is part of this pair
        const pair = await prisma.pair.findFirst({
          where: {
            id: pairId,
            OR: [
              { userAId: socket.data.userId },
              { userBId: socket.data.userId },
            ],
            status: 'ACTIVE',
          },
        });

        if (!pair) {
          socket.emit('error', 'Unauthorized access to pair');
          return;
        }

        socket.join(`pair:${pairId}`);
        socket.emit('joined-pair', pairId);

        // Update last activity
        await prisma.pair.update({
          where: { id: pairId },
          data: { lastActivityAt: new Date() },
        });

      } catch (error) {
        console.error('Join pair error:', error);
        socket.emit('error', 'Failed to join pair');
      }
    });

    // Handle sending messages
    socket.on('send-message', async (data) => {
      try {
        const { pairId, content, type, voiceUrl, duration } = data;

        // Verify user is part of this pair
        const pair = await prisma.pair.findFirst({
          where: {
            id: pairId,
            OR: [
              { userAId: socket.data.userId },
              { userBId: socket.data.userId },
            ],
            status: 'ACTIVE',
          },
        });

        if (!pair) {
          socket.emit('error', 'Unauthorized access to pair');
          return;
        }

        let processedContent = content;
        let redactions = [];
        let hasRedactions = false;

        // Comprehensive safety check for text messages
        if (type === 'text' && content) {
          try {
            const safetyResult = await safetyService.moderateText(content);
            processedContent = safetyResult.processedText;
            redactions = safetyResult.redactionResult.redactions;
            hasRedactions = safetyResult.redactionResult.hasRedactions;

            // If content is not safe, block the message
            if (!safetyResult.safe) {
              socket.emit('message-blocked', {
                reason: 'Content violates community guidelines',
                violations: safetyResult.violations.map(v => ({
                  type: v.type,
                  severity: v.severity,
                  description: v.description
                }))
              });

              // Record safety event and apply sanctions
              const actions = await moderatorService.recordSafetyEvent({
                userId: socket.data.userId,
                pairId,
                content,
                safetyResult,
                userAgent: socket.handshake.headers['user-agent'],
                ipAddress: socket.handshake.address
              });

              // Notify user of any auto-applied sanctions
              if (actions.length > 0) {
                actions.forEach(action => {
                  socket.emit('moderation-action', {
                    type: action.type,
                    duration: action.duration,
                    reason: action.reason
                  });
                });
              }

              return; // Block message completely
            }

            // Notify sender about redactions if any occurred
            if (hasRedactions) {
              socket.emit('message-redacted', {
                originalContent: content,
                redactedContent: processedContent,
                redactions,
              });
            }
          } catch (error) {
            console.error('Safety check error:', error);
            // Fallback to basic contact detection if safety service fails
            const basicSafetyResult = detectAndRedactContactInfo(content);
            processedContent = basicSafetyResult.text;
            redactions = basicSafetyResult.redactions;
            hasRedactions = basicSafetyResult.hasRedactions;
          }
        }

        // Create message in database
        const message = await prisma.message.create({
          data: {
            pairId,
            senderId: socket.data.userId,
            type: type.toUpperCase(),
            body: type === 'text' ? processedContent : null,
            voiceUrl: type === 'voice' ? voiceUrl : null,
            duration: type === 'voice' ? duration : null,
            redactions: hasRedactions ? redactions : null,
          },
          include: {
            sender: {
              select: {
                id: true,
                pseudonym: true,
              },
            },
          },
        });

        // Broadcast message to pair room
        io.to(`pair:${pairId}`).emit('new-message', {
          id: message.id,
          content: processedContent,
          type: message.type,
          voiceUrl: message.voiceUrl,
          duration: message.duration,
          sender: message.sender,
          createdAt: message.createdAt.toISOString(),
          redacted: hasRedactions,
        });

        // Update pair activity
        await prisma.pair.update({
          where: { id: pairId },
          data: {
            lastActivityAt: new Date(),
            turnsTotal: { increment: 1 },
          },
        });

        // Track analytics
        await analyticsService.trackActivity(socket.data.userId, 'message_sent', {
          pairId,
          messageType: type,
          hasRedactions
        });

      } catch (error) {
        console.error('Send message error:', error);
        socket.emit('error', 'Failed to send message');
      }
    });

    // Handle typing indicators
    socket.on('typing-start', (pairId) => {
      socket.to(`pair:${pairId}`).emit('user-typing', {
        userId: socket.data.userId,
        typing: true,
      });
    });

    socket.on('typing-stop', (pairId) => {
      socket.to(`pair:${pairId}`).emit('user-typing', {
        userId: socket.data.userId,
        typing: false,
      });
    });

    // Handle session start/end
    socket.on('start-session', async (pairId) => {
      try {
        const session = await prisma.session.create({
          data: {
            pairId,
            mode: 'TEXT',
            participants: {
              create: {
                userId: socket.data.userId,
              },
            },
          },
        });

        socket.to(`pair:${pairId}`).emit('session-started', {
          sessionId: session.id,
          startedBy: socket.data.userId,
        });

        // Track analytics
        await analyticsService.trackActivity(socket.data.userId, 'session_started', {
          pairId,
          sessionId: session.id
        });

      } catch (error) {
        console.error('Start session error:', error);
      }
    });

    socket.on('end-session', async (data) => {
      try {
        await prisma.session.update({
          where: { id: data.sessionId },
          data: { endedAt: new Date() },
        });

        socket.to(`pair:${data.pairId}`).emit('session-ended', {
          sessionId: data.sessionId,
          endedBy: socket.data.userId,
        });

        // Track analytics
        await analyticsService.trackActivity(socket.data.userId, 'session_ended', {
          pairId: data.pairId,
          sessionId: data.sessionId
        });

      } catch (error) {
        console.error('End session error:', error);
      }
    });

    // Handle AI topic requests
    socket.on('get-topics', async (data) => {
      try {
        const { pairId, language, level, count = 3 } = data;

        // Verify user is part of this pair
        const pair = await prisma.pair.findFirst({
          where: {
            id: pairId,
            OR: [
              { userAId: socket.data.userId },
              { userBId: socket.data.userId },
            ],
            status: 'ACTIVE',
          },
          include: {
            userA: { include: { interests: true } },
            userB: { include: { interests: true } }
          }
        });

        if (!pair) {
          socket.emit('error', 'Unauthorized access to pair');
          return;
        }

        // Get user interests for personalized topics
        const currentUser = pair.userA.id === socket.data.userId ? pair.userA : pair.userB;
        const interests = currentUser.interests?.interests || [];

        const topics = await aiService.getRandomTopics(language, level, count);

        socket.emit('topics-ready', {
          topics,
          pairId,
          language,
          level
        });

        // Track analytics
        await analyticsService.trackActivity(socket.data.userId, 'topic_viewed', {
          pairId,
          language,
          level,
          topicCount: topics.length
        });

      } catch (error) {
        console.error('Get topics error:', error);
        socket.emit('error', 'Failed to get topics');
      }
    });

    // Handle conversation starter requests
    socket.on('get-conversation-starters', async (pairId) => {
      try {
        const pair = await prisma.pair.findFirst({
          where: {
            id: pairId,
            OR: [
              { userAId: socket.data.userId },
              { userBId: socket.data.userId },
            ],
            status: 'ACTIVE',
          },
          include: {
            userA: {
              include: {
                profile: true,
                interests: true
              }
            },
            userB: {
              include: {
                profile: true,
                interests: true
              }
            }
          }
        });

        if (!pair) {
          socket.emit('error', 'Unauthorized access to pair');
          return;
        }

        const starters = await aiService.generateContextualStarters(
          pair.userA,
          pair.userB,
          3
        );

        socket.emit('conversation-starters-ready', {
          starters,
          pairId
        });

      } catch (error) {
        console.error('Conversation starters error:', error);
        socket.emit('error', 'Failed to generate conversation starters');
      }
    });

    // Handle session summary generation
    socket.on('generate-summary', async (data) => {
      try {
        const { sessionId } = data;

        // Get session with messages and verify user access
        const session = await prisma.session.findUnique({
          where: { id: sessionId },
          include: {
            pair: {
              include: {
                userA: { include: { profile: true } },
                userB: { include: { profile: true } },
                messages: {
                  where: {
                    type: 'TEXT',
                    body: { not: null },
                    deletedAt: null
                  },
                  orderBy: { createdAt: 'asc' },
                  include: { sender: true }
                }
              }
            }
          }
        });

        if (!session) {
          socket.emit('error', 'Session not found');
          return;
        }

        // Check if user is participant
        const isParticipant = session.pair.userA.id === socket.data.userId ||
                             session.pair.userB.id === socket.data.userId;

        if (!isParticipant) {
          socket.emit('error', 'Unauthorized access to session');
          return;
        }

        // Check if conversation is suitable for analysis
        if (!aiService.isConversationAnalyzable(session.pair.messages)) {
          socket.emit('error', 'Conversation too short for meaningful analysis');
          return;
        }

        socket.emit('summary-generating', { sessionId });

        // Generate summary (this may take a while)
        // In a production environment, you might want to queue this job
        // For now, we'll do it synchronously

        const messages = session.pair.messages.map(msg => ({
          content: msg.body || '',
          senderId: msg.senderId,
          language: msg.senderId === session.pair.userA.id
            ? session.pair.userA.profile?.nativeLanguages[0] || 'en'
            : session.pair.userB.profile?.nativeLanguages[0] || 'en',
          timestamp: msg.createdAt
        }));

        const participants = [
          {
            id: session.pair.userA.id,
            nativeLanguages: session.pair.userA.profile?.nativeLanguages || ['en'],
            learningLanguage: session.pair.userA.profile?.learningLanguage || 'en',
            level: session.pair.userA.profile?.currentLevel || 'A1'
          },
          {
            id: session.pair.userB.id,
            nativeLanguages: session.pair.userB.profile?.nativeLanguages || ['en'],
            learningLanguage: session.pair.userB.profile?.learningLanguage || 'en',
            level: session.pair.userB.profile?.currentLevel || 'A1'
          }
        ];

        const startTime = session.startedAt;
        const endTime = session.endedAt || new Date();
        const durationMinutes = Math.round((endTime.getTime() - startTime.getTime()) / (1000 * 60));

        const result = await aiService.generateConversationSummary({
          messages,
          participants,
          sessionDuration: durationMinutes
        });

        // Save summary to database
        const savedSummary = await prisma.summary.create({
          data: {
            sessionId: session.id,
            newWords: JSON.stringify(result.summary.newWords),
            commonMistakes: JSON.stringify(result.summary.commonMistakes),
            followUpTask: result.summary.followUpTask
          }
        });

        // Emit to both participants
        io.to(`pair:${session.pairId}`).emit('summary-ready', {
          sessionId,
          summary: result.summary,
          summaryId: savedSummary.id
        });

        // Track analytics
        await analyticsService.trackActivity(socket.data.userId, 'summary_generated', {
          sessionId,
          pairId: session.pairId,
          summaryId: savedSummary.id
        });

      } catch (error) {
        console.error('Summary generation error:', error);
        socket.emit('error', 'Failed to generate summary');
      }
    });

    // Handle disconnection
    socket.on('disconnect', () => {
      console.log('User disconnected:', socket.data.userId);
    });
  });

  httpServer
    .once('error', (err) => {
      console.error(err);
      process.exit(1);
    })
    .listen(port, () => {
      console.log(`> Ready on http://${hostname}:${port}`);
    });
});