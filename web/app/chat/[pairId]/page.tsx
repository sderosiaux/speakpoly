'use client';

import { useState, useEffect, useRef } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { useParams } from 'next/navigation';
import { format } from 'date-fns';
import { useChat } from '@/hooks/useSocket';
import toast from 'react-hot-toast';
import type { ChatMessage } from '@/types/socket';

interface PairData {
  id: string;
  partner: {
    id: string;
    pseudonym: string;
    profile: {
      nativeLanguages: string[];
      learningLanguage: string;
      learningLevel: string;
    };
  };
  messages: ChatMessage[];
}

export default function ChatPage() {
  const { data: session } = useSession();
  const router = useRouter();
  const params = useParams();
  const pairId = params.pairId as string;

  const [pairData, setPairData] = useState<PairData | null>(null);
  const [messageInput, setMessageInput] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const typingTimeoutRef = useRef<NodeJS.Timeout>();

  const {
    messages,
    isTyping,
    currentSession,
    isConnected,
    sendMessage,
    startTyping,
    stopTyping,
    startSession,
    endSession,
  } = useChat(pairId);

  useEffect(() => {
    if (!session?.user) {
      router.push('/auth/signin');
      return;
    }

    fetchPairData();
  }, [session, pairId]);

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const fetchPairData = async () => {
    try {
      const response = await fetch(`/api/chat/${pairId}`);
      if (!response.ok) throw new Error('Failed to fetch pair data');
      const data = await response.json();
      setPairData(data);
    } catch (error) {
      toast.error('Failed to load chat');
      router.push('/dashboard');
    } finally {
      setIsLoading(false);
    }
  };

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  const handleSendMessage = (e: React.FormEvent) => {
    e.preventDefault();
    if (!messageInput.trim() || !isConnected) return;

    sendMessage(messageInput.trim());
    setMessageInput('');
    stopTyping();
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setMessageInput(value);

    // Handle typing indicators
    if (value.trim()) {
      startTyping();

      // Clear existing timeout
      if (typingTimeoutRef.current) {
        clearTimeout(typingTimeoutRef.current);
      }

      // Set new timeout to stop typing
      typingTimeoutRef.current = setTimeout(() => {
        stopTyping();
      }, 1000);
    } else {
      stopTyping();
    }
  };

  const allMessages = pairData ? [...pairData.messages, ...messages] : messages;
  const partnerId = pairData?.partner.id;
  const isPartnerTyping = partnerId ? isTyping[partnerId] : false;

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-pulse text-primary-600">Loading chat...</div>
      </div>
    );
  }

  if (!pairData) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-neutral-900 mb-2">Chat not found</h1>
          <button onClick={() => router.push('/dashboard')} className="btn-primary">
            Back to Dashboard
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-neutral-50 flex flex-col">
      {/* Header */}
      <header className="bg-white border-b border-neutral-200 px-6 py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <button
              onClick={() => router.push('/dashboard')}
              className="p-2 hover:bg-neutral-100 rounded-lg"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
            </button>
            <div>
              <h1 className="text-xl font-semibold text-neutral-900">
                {pairData.partner.pseudonym}
              </h1>
              <p className="text-sm text-neutral-600">
                Native {pairData.partner.profile.nativeLanguages[0]?.toUpperCase()} •
                Learning {pairData.partner.profile.learningLanguage.toUpperCase()}
                ({pairData.partner.profile.learningLevel})
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {/* Connection status */}
            <div className={`w-3 h-3 rounded-full ${isConnected ? 'bg-success-500' : 'bg-danger-500'}`} />

            {/* Session controls */}
            {currentSession ? (
              <button
                onClick={endSession}
                className="btn-outline text-sm"
              >
                End Session
              </button>
            ) : (
              <button
                onClick={startSession}
                className="btn-primary text-sm"
              >
                Start Session
              </button>
            )}
          </div>
        </div>
      </header>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-6">
        <div className="max-w-4xl mx-auto space-y-4">
          {allMessages.length === 0 ? (
            <div className="text-center py-12">
              <div className="w-16 h-16 bg-primary-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <svg className="w-8 h-8 text-primary-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                </svg>
              </div>
              <h3 className="text-lg font-semibold text-neutral-900 mb-2">
                Start your language exchange!
              </h3>
              <p className="text-neutral-600">
                Say hello and begin practicing together
              </p>
            </div>
          ) : (
            allMessages.map((message) => (
              <div
                key={message.id}
                className={`flex ${
                  message.sender.id === session?.user?.id ? 'justify-end' : 'justify-start'
                }`}
              >
                <div
                  className={`max-w-xs lg:max-w-md px-4 py-2 rounded-lg ${
                    message.sender.id === session?.user?.id
                      ? 'bg-primary-500 text-white'
                      : 'bg-white text-neutral-900 border border-neutral-200'
                  }`}
                >
                  {message.type === 'VOICE' ? (
                    <div className="flex items-center gap-2">
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
                      </svg>
                      <span className="text-sm">Voice message ({message.duration}s)</span>
                      {message.voiceUrl && (
                        <audio controls className="w-32">
                          <source src={message.voiceUrl} type="audio/webm" />
                        </audio>
                      )}
                    </div>
                  ) : (
                    <p className="text-sm">{message.content}</p>
                  )}

                  {message.redacted && (
                    <p className="text-xs opacity-75 mt-1">⚠️ Message was filtered for safety</p>
                  )}

                  <p
                    className={`text-xs mt-1 ${
                      message.sender.id === session?.user?.id
                        ? 'text-primary-100'
                        : 'text-neutral-500'
                    }`}
                  >
                    {format(new Date(message.createdAt), 'HH:mm')}
                  </p>
                </div>
              </div>
            ))
          )}

          {/* Typing indicator */}
          {isPartnerTyping && (
            <div className="flex justify-start">
              <div className="bg-white border border-neutral-200 rounded-lg px-4 py-2">
                <div className="flex items-center gap-1">
                  <div className="flex gap-1">
                    <div className="w-2 h-2 bg-neutral-400 rounded-full animate-pulse" />
                    <div className="w-2 h-2 bg-neutral-400 rounded-full animate-pulse" style={{ animationDelay: '0.2s' }} />
                    <div className="w-2 h-2 bg-neutral-400 rounded-full animate-pulse" style={{ animationDelay: '0.4s' }} />
                  </div>
                  <span className="text-xs text-neutral-500 ml-2">
                    {pairData.partner.pseudonym} is typing...
                  </span>
                </div>
              </div>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>
      </div>

      {/* Message input */}
      <div className="bg-white border-t border-neutral-200 p-6">
        <div className="max-w-4xl mx-auto">
          <form onSubmit={handleSendMessage} className="flex gap-4">
            <input
              type="text"
              value={messageInput}
              onChange={handleInputChange}
              placeholder="Type your message..."
              className="flex-1 px-4 py-2 border border-neutral-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
              disabled={!isConnected}
            />
            <button
              type="submit"
              disabled={!messageInput.trim() || !isConnected}
              className="btn-primary"
            >
              Send
            </button>
          </form>

          {!isConnected && (
            <p className="text-sm text-danger-600 mt-2">
              Disconnected from chat server. Trying to reconnect...
            </p>
          )}
        </div>
      </div>
    </div>
  );
}