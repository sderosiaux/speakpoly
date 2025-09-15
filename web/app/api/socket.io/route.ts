import { NextRequest } from 'next/server';
import { Server as NetServer } from 'http';
import { Server as SocketIOServer } from 'socket.io';
import { initSocketServer } from '@/lib/socket-server';

let io: SocketIOServer;

export async function GET(req: NextRequest) {
  if (!io) {
    console.log('Initializing Socket.IO...');
    const httpServer = (req as any).socket?.server;

    if (!httpServer) {
      return new Response('Socket.IO server not available', { status: 500 });
    }

    io = initSocketServer(httpServer);
    console.log('Socket.IO initialized');
  }

  return new Response('Socket.IO server running', { status: 200 });
}