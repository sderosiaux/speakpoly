'use client';

import { useEffect, useRef, useState } from 'react';
import { useSession } from 'next-auth/react';
import { io, Socket } from 'socket.io-client';
import type { ServerToClientEvents, ClientToServerEvents } from '@/types/socket';

type SocketInstance = Socket<ServerToClientEvents, ClientToServerEvents>;

export function useSocket() {
  const { data: session } = useSession();
  const [isConnected, setIsConnected] = useState(false);
  const socketRef = useRef<SocketInstance | null>(null);

  useEffect(() => {
    if (!session?.user?.id) return;

    // Initialize socket connection
    const socket: SocketInstance = io({
      path: '/api/socket.io',
      auth: {
        token: {
          userId: session.user.id,
        },
      },
    });

    socketRef.current = socket;

    socket.on('connect', () => {
      console.log('Connected to Socket.IO server');
      setIsConnected(true);
    });

    socket.on('disconnect', () => {
      console.log('Disconnected from Socket.IO server');
      setIsConnected(false);
    });

    socket.on('connect_error', (error) => {
      console.error('Socket connection error:', error);
      setIsConnected(false);
    });

    return () => {
      socket.disconnect();
      socketRef.current = null;
      setIsConnected(false);
    };
  }, [session?.user?.id]);

  return {
    socket: socketRef.current,
    isConnected,
  };
}

export function useChat(pairId: string) {
  const { socket, isConnected } = useSocket();
  const [messages, setMessages] = useState<any[]>([]);
  const [isTyping, setIsTyping] = useState<Record<string, boolean>>({});
  const [currentSession, setCurrentSession] = useState<string | null>(null);

  useEffect(() => {
    if (!socket || !isConnected || !pairId) return;

    // Join the pair room
    socket.emit('join-pair', pairId);

    // Listen for new messages
    socket.on('new-message', (message) => {
      setMessages((prev) => [...prev, message]);
    });

    // Listen for typing indicators
    socket.on('user-typing', ({ userId, typing }) => {
      setIsTyping((prev) => ({ ...prev, [userId]: typing }));

      // Clear typing after timeout
      if (typing) {
        setTimeout(() => {
          setIsTyping((prev) => ({ ...prev, [userId]: false }));
        }, 3000);
      }
    });

    // Listen for session events
    socket.on('session-started', ({ sessionId }) => {
      setCurrentSession(sessionId);
    });

    socket.on('session-ended', () => {
      setCurrentSession(null);
    });

    // Handle message redaction notifications
    socket.on('message-redacted', (data) => {
      console.warn('Message was redacted:', data);
      // You could show a toast notification here
    });

    socket.on('error', (error) => {
      console.error('Socket error:', error);
    });

    return () => {
      socket.off('new-message');
      socket.off('user-typing');
      socket.off('session-started');
      socket.off('session-ended');
      socket.off('message-redacted');
      socket.off('error');
    };
  }, [socket, isConnected, pairId]);

  const sendMessage = (content: string, type: 'text' | 'voice' = 'text', voiceUrl?: string, duration?: number) => {
    if (!socket || !isConnected) return;

    socket.emit('send-message', {
      pairId,
      content,
      type,
      voiceUrl,
      duration,
    });
  };

  const startTyping = () => {
    if (!socket || !isConnected) return;
    socket.emit('typing-start', pairId);
  };

  const stopTyping = () => {
    if (!socket || !isConnected) return;
    socket.emit('typing-stop', pairId);
  };

  const startSession = () => {
    if (!socket || !isConnected) return;
    socket.emit('start-session', pairId);
  };

  const endSession = () => {
    if (!socket || !isConnected || !currentSession) return;
    socket.emit('end-session', { pairId, sessionId: currentSession });
  };

  return {
    messages,
    isTyping,
    currentSession,
    isConnected,
    sendMessage,
    startTyping,
    stopTyping,
    startSession,
    endSession,
  };
}