import { Server as NetServer } from 'http';
import { Server as SocketIOServer } from 'socket.io';
import { NextApiRequest } from 'next';
import { NextApiResponseServerIO } from '@/types/socket';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@speakpoly/database';
import { detectAndRedactContactInfo } from '@speakpoly/utils';
import { config } from '@speakpoly/config';

export const initSocketServer = (httpServer: NetServer) => {
  const io = new SocketIOServer(httpServer, {
    path: '/api/socket.io',
    addTrailingSlash: false,
    cors: {
      origin: process.env.NODE_ENV === 'production' ? false : '*',
      methods: ['GET', 'POST'],
    },
  });

  // Middleware for authentication
  io.use(async (socket, next) => {
    try {
      const token = socket.handshake.auth.token;
      // In a real app, you'd validate the JWT token here
      if (!token) {
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
    socket.on('join-pair', async (pairId: string) => {
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
    socket.on('send-message', async (data: {
      pairId: string;
      content: string;
      type: 'text' | 'voice';
      voiceUrl?: string;
      duration?: number;
    }) => {
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
          include: {
            userA: { select: { id: true, pseudonym: true } },
            userB: { select: { id: true, pseudonym: true } },
          },
        });

        if (!pair) {
          socket.emit('error', 'Unauthorized access to pair');
          return;
        }

        let processedContent = content;
        let redactions: any[] = [];
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
            type: type.toUpperCase() as any,
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
          createdAt: message.createdAt,
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
        const eventType = type === 'text'
          ? config.analytics.events.MESSAGE_SENT
          : config.analytics.events.VOICE_NOTE_SENT;

        console.log('Analytics Event:', {
          event: eventType,
          userId: socket.data.userId,
          data: { pairId, messageType: type, hasRedactions },
        });

      } catch (error) {
        console.error('Send message error:', error);
        socket.emit('error', 'Failed to send message');
      }
    });

    // Handle typing indicators
    socket.on('typing-start', (pairId: string) => {
      socket.to(`pair:${pairId}`).emit('user-typing', {
        userId: socket.data.userId,
        typing: true,
      });
    });

    socket.on('typing-stop', (pairId: string) => {
      socket.to(`pair:${pairId}`).emit('user-typing', {
        userId: socket.data.userId,
        typing: false,
      });
    });

    // Handle session start/end
    socket.on('start-session', async (pairId: string) => {
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

        console.log('Analytics Event:', {
          event: config.analytics.events.SESSION_STARTED,
          userId: socket.data.userId,
          data: { pairId, sessionId: session.id },
        });

      } catch (error) {
        console.error('Start session error:', error);
      }
    });

    socket.on('end-session', async (data: { pairId: string; sessionId: string }) => {
      try {
        await prisma.session.update({
          where: { id: data.sessionId },
          data: { endedAt: new Date() },
        });

        socket.to(`pair:${data.pairId}`).emit('session-ended', {
          sessionId: data.sessionId,
          endedBy: socket.data.userId,
        });

        console.log('Analytics Event:', {
          event: config.analytics.events.SESSION_ENDED,
          userId: socket.data.userId,
          data: { pairId: data.pairId, sessionId: data.sessionId },
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

  return io;
};