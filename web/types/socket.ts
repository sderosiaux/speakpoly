import { Server as NetServer, Socket } from 'net';
import { NextApiResponse } from 'next';
import { Server as SocketIOServer } from 'socket.io';

export type NextApiResponseServerIO = NextApiResponse & {
  socket: Socket & {
    server: NetServer & {
      io: SocketIOServer;
    };
  };
};

export interface ServerToClientEvents {
  'new-message': (message: ChatMessage) => void;
  'user-typing': (data: { userId: string; typing: boolean }) => void;
  'session-started': (data: { sessionId: string; startedBy: string }) => void;
  'session-ended': (data: { sessionId: string; endedBy: string }) => void;
  'joined-pair': (pairId: string) => void;
  'message-redacted': (data: {
    originalContent: string;
    redactedContent: string;
    redactions: any[];
  }) => void;
  'error': (message: string) => void;
}

export interface ClientToServerEvents {
  'join-pair': (pairId: string) => void;
  'send-message': (data: {
    pairId: string;
    content: string;
    type: 'text' | 'voice';
    voiceUrl?: string;
    duration?: number;
  }) => void;
  'typing-start': (pairId: string) => void;
  'typing-stop': (pairId: string) => void;
  'start-session': (pairId: string) => void;
  'end-session': (data: { pairId: string; sessionId: string }) => void;
}

export interface ChatMessage {
  id: string;
  content: string;
  type: 'TEXT' | 'VOICE' | 'SYSTEM';
  voiceUrl?: string;
  duration?: number;
  sender: {
    id: string;
    pseudonym: string;
  };
  createdAt: string;
  redacted?: boolean;
}