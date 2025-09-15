const { createServer } = require('http');
const { parse } = require('url');
const next = require('next');
const { Server } = require('socket.io');
const { getServerSession } = require('next-auth');
const { authOptions } = require('./lib/auth');
const { PrismaClient } = require('@prisma/client');
const { detectAndRedactContactInfo } = require('@speakpoly/utils');

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

        // Safety check for text messages
        if (type === 'text' && content) {
          const safetyResult = detectAndRedactContactInfo(content);
          processedContent = safetyResult.text;
          redactions = safetyResult.redactions;
          hasRedactions = safetyResult.hasRedactions;

          // Track safety events if redactions occurred
          if (hasRedactions) {
            await prisma.safetyEvent.create({
              data: {
                userId: socket.data.userId,
                type: 'CONTACT_SHARE_ATTEMPT',
                severity: 'MEDIUM',
                actionTaken: 'MESSAGE_BLOCKED',
                details: { originalContent: content, redactions },
              },
            });

            // Notify sender about redaction
            socket.emit('message-redacted', {
              originalContent: content,
              redactedContent: processedContent,
              redactions,
            });
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

      } catch (error) {
        console.error('End session error:', error);
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