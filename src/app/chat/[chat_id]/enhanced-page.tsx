'use client';

import React, { useState, useRef, useEffect, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { cleanVideoChatService } from '@/services/cleanVideoChatService';
import { coinDeductionService } from '@/services/coinDeductionService';
import { userService } from '@/api/services/userService';
import { ChatMessage } from "@/components/ChatMessageContainer";
import { VideoPlayer } from "@/components/VideoPlayer";
import { optimizedNextSwipe } from "@/utils/optimizedSwipeUtils";
import { useAuthStore } from "@/store/auth";

export default function EnhancedVideoChatPage() {
  const params = useParams();
  const router = useRouter();
  const chatId = params.chat_id as string;

  // Video refs
  const localVideoRef = useRef<HTMLVideoElement>(null);
  const remoteVideoRef = useRef<HTMLVideoElement>(null);
  const chatEndRef = useRef<HTMLDivElement>(null);

  // State
  const [connectionState, setConnectionState] = useState<'disconnected' | 'connecting' | 'connected' | 'failed'>('connecting');
  const [error, setError] = useState<string | null>(null);
  const [isInitialized, setIsInitialized] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const [isClient, setIsClient] = useState(false);
  const [isCheckingAuth, setIsCheckingAuth] = useState(false);

  // Streams
  const [localStream, setLocalStream] = useState<MediaStream | null>(null);
  const [remoteStream, setRemoteStream] = useState<MediaStream | null>(null);

  // Video state
  const [isVideoPlaying, setIsVideoPlaying] = useState(false);
  const [currentVideoId, setCurrentVideoId] = useState<string | null>(null);
  const [currentVideoUrl, setCurrentVideoUrl] = useState<string | null>(null);
  const [currentVideoName, setCurrentVideoName] = useState<string | null>(null);

  // Chat state
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');

  // User state
  const [userId, setUserId] = useState<string>('');
  const [coinBalance, setCoinBalance] = useState<number>(0);

  // Touch handling for mobile swipe
  const [touchStart, setTouchStart] = useState<number | null>(null);
  const [touchEnd, setTouchEnd] = useState<number | null>(null);

  // =============================================================================
  // CLIENT-SIDE INITIALIZATION
  // =============================================================================

  useEffect(() => {
    setIsClient(true);
  }, []);

  // =============================================================================
  // TOUCH/SWIPE HANDLING (Optimized)
  // =============================================================================

  const handleTouchStart = (e: React.TouchEvent) => {
    setTouchEnd(null);
    setTouchStart(e.targetTouches[0].clientX);
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    setTouchEnd(e.targetTouches[0].clientX);
  };

  const handleTouchEnd = async () => {
    if (!touchStart || !touchEnd) return;

    const distance = touchStart - touchEnd;
    const isLeftSwipe = distance > 50;
    const isRightSwipe = distance < -50;
    const isHorizontalSwipe = Math.abs(distance) > 50;

    if (isHorizontalSwipe && isLeftSwipe) {
      await handleSwipeToNext();
    }

    setTouchStart(null);
    setTouchEnd(null);
  };

  // =============================================================================
  // SWIPE HANDLING (Enhanced)
  // =============================================================================

  const handleSwipeToNext = async () => {
    try {
      const result = await optimizedNextSwipe(
        setConnectionState,
        setError,
        setIsVideoPlaying,
        setCurrentVideoId,
        setCurrentVideoUrl,
        setCurrentVideoName,
        setMessages,
        setRemoteStream
      );

      // Handle per-swipe deduction result
      if (result?.swipe_deduction) {
        const deduction = result.swipe_deduction;
        if (deduction.success && deduction.deducted > 0) {
          setCoinBalance(deduction.new_balance);
          userService.updateUserCoinBalance(deduction.new_balance);
        }
      }
    } catch (error) {
      // Error handling is done in optimizedNextSwipe
    }
  };

  // =============================================================================
  // VIDEO HANDLING
  // =============================================================================

  const handleVideoEnd = () => {
    setIsVideoPlaying(false);
    setCurrentVideoId(null);
    setCurrentVideoUrl(null);
    setCurrentVideoName(null);
    setConnectionState('disconnected');
    setMessages([]);
    coinDeductionService.stopChatDurationTracking();
  };

  // =============================================================================
  // AUTHENTICATION & INITIALIZATION (Optimized)
  // =============================================================================

  useEffect(() => {
    if (isClient) {
      const storedUser = userService.getUserFromLocalStorage();
      if (!storedUser) {
        router.push('/');
        return;
      }
      setUserId(storedUser.id.toString());
      setCoinBalance(storedUser.coin_balance || 0);
    }
  }, [isClient, router]);

  // Early callback setup for preventing timing issues
  useEffect(() => {
    if (!isClient) return;

    // Setup callbacks immediately to prevent timing issues
    cleanVideoChatService.onRemoteStream((stream) => {
      setRemoteStream(stream);
      setConnectionState('connected');
      coinDeductionService.startChatDurationTracking();
    });

    return () => {
      // Minimal cleanup
    };
  }, [isClient]);

  // Initialize video chat
  const initializeVideoChat = useCallback(async () => {
    if (!isClient || isInitialized || isConnecting) return;

    try {
      setIsConnecting(true);
      setConnectionState('connecting');
      setError(null);

      // Initialize deduction rules
      await coinDeductionService.initializeDeductionRules();

      // Get authenticated user
      const authenticatedUser = userService.getUserFromLocalStorage();
      if (!authenticatedUser?.id) {
        throw new Error('User not authenticated. Please log in first.');
      }

      const currentUserId = authenticatedUser.id.toString();
      setUserId(currentUserId);

      // Setup video match callback
      cleanVideoChatService.onVideoMatch((videoData) => {
        setConnectionState('connected');
        setError(null);
        setRemoteStream(null);
        setIsVideoPlaying(true);
        setCurrentVideoId(videoData.videoId);
        setCurrentVideoUrl(videoData.videoUrl);
        setCurrentVideoName(videoData.videoName);
        coinDeductionService.startChatDurationTracking();
      });

      // Get local stream
      try {
        const localVideoStream = cleanVideoChatService.getCurrentLocalStream();
        if (localVideoStream) {
          setLocalStream(localVideoStream);
        }
      } catch {
        // Silent error handling
      }

      // Setup connection state callback
      cleanVideoChatService.onConnectionStateChange((state) => {
        if (state === 'connected') {
          setConnectionState('connected');
          if (!isVideoPlaying && !localStream) {
            try {
              const currentLocalStream = cleanVideoChatService.getCurrentLocalStream();
              if (currentLocalStream) {
                setLocalStream(currentLocalStream);
              }
            } catch (error) {
              // Silent error handling
            }
          }
        } else if (state === 'failed' || state === 'disconnected') {
          setConnectionState('failed');
        }
      });

      // Setup partner left callback
      cleanVideoChatService.onPartnerLeft(() => {
        setRemoteStream(null);
        setConnectionState('disconnected');
        setIsVideoPlaying(false);
        setCurrentVideoId(null);
        setCurrentVideoUrl(null);
        setCurrentVideoName(null);
        setMessages([]);
        coinDeductionService.stopChatDurationTracking();
      });

      // Setup message callback
      cleanVideoChatService.onMessageReceived((message) => {
        if (message.from === userId) return;

        const isDuplicate = messages.some(existingMsg => {
          if (existingMsg.id && message.id && existingMsg.id === message.id) {
            return true;
          }
          return existingMsg.from === message.from &&
                 existingMsg.text === message.text &&
                 Math.abs(existingMsg.timestamp - message.timestamp) < 1000;
        });

        if (isDuplicate) return;

        const chatMessage: ChatMessage = {
          from: message.from,
          text: message.text,
          timestamp: message.timestamp,
          id: message.id
        };
        setMessages(prev => [...prev, chatMessage]);
      });

      // Join queue
      try {
        await cleanVideoChatService.joinQueue();
        setIsInitialized(true);
      } catch {
        setError('Failed to join video chat queue');
        setIsConnecting(false);
        return;
      }

    } catch (error) {
      setError(error instanceof Error ? error.message : 'An error occurred');
      setConnectionState('failed');
    } finally {
      setIsConnecting(false);
    }
  }, [isClient, isInitialized, isConnecting, userId, isVideoPlaying, localStream, messages]);

  // Auto-initialize
  useEffect(() => {
    if (isClient && !isInitialized && !isCheckingAuth) {
      initializeVideoChat();
    }
  }, [chatId, initializeVideoChat, isInitialized, isClient, isCheckingAuth]);

  // =============================================================================
  // COIN DEDUCTION HANDLING
  // =============================================================================

  useEffect(() => {
    if (!isClient) return;

    const handleCoinDeduction = (event: CustomEvent) => {
      const result = event.detail;
      setCoinBalance(result.new_balance);
      userService.updateUserCoinBalance(result.new_balance);
    };

    const handleCoinDeductionError = (event: CustomEvent) => {
      const result = event.detail;
      setError(`Coin deduction failed: ${result.error}`);
    };

    window.addEventListener('coinDeductionApplied', handleCoinDeduction as EventListener);
    window.addEventListener('coinDeductionError', handleCoinDeductionError as EventListener);

    return () => {
      window.removeEventListener('coinDeductionApplied', handleCoinDeduction as EventListener);
      window.removeEventListener('coinDeductionError', handleCoinDeductionError as EventListener);
    };
  }, [isClient]);

  // =============================================================================
  // STREAM EFFECTS
  // =============================================================================

  useEffect(() => {
    if (localStream && localVideoRef.current) {
      localVideoRef.current.srcObject = localStream;
    }
  }, [localStream]);

  useEffect(() => {
    if (remoteStream && remoteVideoRef.current) {
      remoteVideoRef.current.srcObject = remoteStream;
    }
  }, [remoteStream]);

  // =============================================================================
  // CLEANUP
  // =============================================================================

  useEffect(() => {
    return () => {
      if (isInitialized) {
        coinDeductionService.stopChatDurationTracking();
        cleanVideoChatService.cleanup();
      }
    };
  }, [isInitialized]);

  // =============================================================================
  // CHAT HANDLING
  // =============================================================================

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const handleSend = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!input.trim() || !userId) return;

    const timestamp = Date.now();
    const messageId = `msg_${timestamp}_${Math.random().toString(36).substr(2, 9)}`;

    const userMessage: ChatMessage = {
      from: userId,
      text: input.trim(),
      timestamp: timestamp,
      id: messageId
    };

    setMessages(prev => [...prev, userMessage]);
    setInput('');

    try {
      await cleanVideoChatService.sendMessage(userMessage.text);
    } catch (error) {
      // Remove message on failure
      setMessages(prev => prev.filter(m => m.id !== messageId));
      setError('Failed to send message');
    }
  };

  // =============================================================================
  // RENDER
  // =============================================================================

  if (!isClient) {
    return <div className="min-h-screen bg-gradient-to-br from-purple-900 via-blue-900 to-indigo-900 flex items-center justify-center">
      <div className="text-white text-xl">Loading...</div>
    </div>;
  }

  return (
    <div
      className="min-h-screen bg-gradient-to-br from-purple-900 via-blue-900 to-indigo-900 relative overflow-hidden"
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
    >
      {/* Header */}
      <div className="absolute top-0 left-0 right-0 z-10 p-4">
        <div className="flex justify-between items-center">
          <div className="text-white">
            <h1 className="text-2xl font-bold">Juicy Meets</h1>
            <p className="text-sm opacity-75">
              {connectionState === 'connected' ?
                (isVideoPlaying ? 'Watching Video' : 'Live Chat') :
                'Connecting...'}
            </p>
          </div>

          <div className="text-white text-right">
            <p className="text-sm opacity-75">Coins</p>
            <p className="text-lg font-bold">{coinBalance}</p>
          </div>
        </div>
      </div>

      {/* Error display */}
      {error && (
        <div className="absolute top-20 left-4 right-4 z-20 bg-red-500 text-white px-4 py-2 rounded-lg">
          {error}
        </div>
      )}

      {/* Main content */}
      <div className="flex h-screen">
        {/* Left side - Video */}
        <div className="flex-1 relative">
          {isVideoPlaying && currentVideoUrl ? (
            <div className="w-full h-full">
              <VideoPlayer
                videoId={currentVideoId || 'video'}
                videoUrl={currentVideoUrl}
                onVideoEnd={handleVideoEnd}
              />
            </div>
          ) : (
            <div className="relative w-full h-full bg-black">
              {/* Remote video */}
              <video
                ref={remoteVideoRef}
                className="w-full h-full object-cover"
                autoPlay
                playsInline
                muted={false}
              />

              {/* Local video overlay */}
              {localStream && (
                <div className="absolute top-4 right-4 w-32 h-24 bg-gray-800 rounded-lg overflow-hidden">
                  <video
                    ref={localVideoRef}
                    className="w-full h-full object-cover"
                    autoPlay
                    playsInline
                    muted
                  />
                </div>
              )}

              {/* Connection status */}
              {connectionState === 'connecting' && (
                <div className="absolute inset-0 bg-black bg-opacity-50 flex items-center justify-center">
                  <div className="text-white text-center">
                    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-white mb-4 mx-auto"></div>
                    <p>Finding your match...</p>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Right side - Chat (hidden during video) */}
        {!isVideoPlaying && (
          <div className="w-80 bg-white bg-opacity-10 backdrop-blur-lg border-l border-white border-opacity-20 flex flex-col">
            {/* Chat header */}
            <div className="p-4 border-b border-white border-opacity-20">
              <h3 className="text-white font-semibold">Chat</h3>
            </div>

            {/* Messages */}
            <div className="flex-1 overflow-y-auto p-4 space-y-3">
              {messages.map((message) => (
                <div
                  key={message.id || `${message.timestamp}_${message.from}`}
                  className={`p-3 rounded-lg max-w-xs ${
                    message.from === userId
                      ? 'bg-blue-500 text-white ml-auto'
                      : 'bg-white bg-opacity-20 text-white'
                  }`}
                >
                  <p className="text-sm">{message.text}</p>
                  <p className="text-xs opacity-75 mt-1">
                    {new Date(message.timestamp).toLocaleTimeString()}
                  </p>
                </div>
              ))}
              <div ref={chatEndRef} />
            </div>

            {/* Message input */}
            <div className="p-4 border-t border-white border-opacity-20">
              <form onSubmit={handleSend} className="flex gap-2">
                <input
                  type="text"
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  placeholder="Type a message..."
                  className="flex-1 px-3 py-2 bg-white bg-opacity-20 text-white placeholder-white placeholder-opacity-75 border border-white border-opacity-30 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  disabled={connectionState !== 'connected'}
                />
                <button
                  type="submit"
                  disabled={!input.trim() || connectionState !== 'connected'}
                  className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Send
                </button>
              </form>
            </div>
          </div>
        )}
      </div>

      {/* Swipe button */}
      <div className="absolute bottom-10 left-1/2 transform -translate-x-1/2 z-20">
        <button
          onClick={handleSwipeToNext}
          className="bg-white bg-opacity-20 backdrop-blur-lg border border-white border-opacity-30 text-white px-6 py-3 rounded-full hover:bg-opacity-30 transition-all duration-200 hover:scale-110"
          disabled={connectionState === 'connecting'}
        >
          <span className="text-lg">➡️ Next Match</span>
        </button>
      </div>
    </div>
  );
}
