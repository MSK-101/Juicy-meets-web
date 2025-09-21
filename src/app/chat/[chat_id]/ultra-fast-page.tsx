'use client';

import React, { useState, useRef, useEffect, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { ultraFastVideoChatService } from '@/services/ultraFastVideoChatService';
import { coinDeductionService } from '@/services/coinDeductionService';
import { userService } from '@/api/services/userService';
import { ChatMessage } from "@/components/ChatMessageContainer";
import { VideoPlayer } from "@/components/VideoPlayer";

export default function UltraFastVideoChatPage() {
  const params = useParams();
  const router = useRouter();
  const chatId = params.chat_id as string;

  // Refs for video elements
  const localVideoRef = useRef<HTMLVideoElement>(null);
  const remoteVideoRef = useRef<HTMLVideoElement>(null);
  const chatEndRef = useRef<HTMLDivElement>(null);

  // Core state
  const [connectionState, setConnectionState] = useState<'disconnected' | 'connecting' | 'connected' | 'failed'>('connecting');
  const [error, setError] = useState<string | null>(null);
  const [isInitialized, setIsInitialized] = useState(false);
  const [isClient, setIsClient] = useState(false);

  // Stream state with persistence tracking
  const [localStream, setLocalStream] = useState<MediaStream | null>(null);
  const [remoteStream, setRemoteStream] = useState<MediaStream | null>(null);
  const [streamKey, setStreamKey] = useState(0); // Force re-render when streams change

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

  // Touch handling
  const [touchStart, setTouchStart] = useState<number | null>(null);
  const [touchEnd, setTouchEnd] = useState<number | null>(null);

  // Ultra-fast initialization flag
  const [ultraFastInit, setUltraFastInit] = useState(false);

  // =============================================================================
  // ULTRA-FAST CLIENT-SIDE INITIALIZATION
  // =============================================================================

  useEffect(() => {
    setIsClient(true);
    // Immediate ultra-fast initialization
    if (!ultraFastInit) {
      initializeUltraFastVideoChat();
      setUltraFastInit(true);
    }
  }, []);

  // =============================================================================
  // STREAM PERSISTENCE & BLANK SCREEN FIX
  // =============================================================================

  // Force video element updates when streams change
  useEffect(() => {
    if (localStream && localVideoRef.current) {
      const video = localVideoRef.current;
      video.srcObject = localStream;
      video.load();
      video.play().catch(() => {
        // Ignore autoplay errors
      });
      setStreamKey(prev => prev + 1);
    }
  }, [localStream]);

  useEffect(() => {
    if (remoteStream && remoteVideoRef.current) {
      const video = remoteVideoRef.current;
      video.srcObject = remoteStream;
      video.load();
      video.play().catch(() => {
        // Ignore autoplay errors
      });
      setStreamKey(prev => prev + 1);
    } else if (!remoteStream && remoteVideoRef.current) {
      // Clear video when no remote stream
      remoteVideoRef.current.srcObject = null;
    }
  }, [remoteStream]);

  // Periodic stream refresh to prevent blank screens
  useEffect(() => {
    if (!isClient || !isInitialized) return;

    const refreshInterval = setInterval(() => {
      if (connectionState === 'connected' && !isVideoPlaying) {
        // Force stream refresh
        const currentLocal = ultraFastVideoChatService.getCurrentLocalStream();
        const currentRemote = ultraFastVideoChatService.getCurrentRemoteStream();

        if (currentLocal && currentLocal !== localStream) {
          setLocalStream(currentLocal);
        }

        if (currentRemote && currentRemote !== remoteStream) {
          setRemoteStream(currentRemote);
        }
      }
    }, 1000); // Check every second

    return () => clearInterval(refreshInterval);
  }, [isClient, isInitialized, connectionState, isVideoPlaying, localStream, remoteStream]);

  // =============================================================================
  // ULTRA-FAST TOUCH/SWIPE HANDLING
  // =============================================================================

  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    setTouchEnd(null);
    setTouchStart(e.targetTouches[0].clientX);
  }, []);

  const handleTouchMove = useCallback((e: React.TouchEvent) => {
    setTouchEnd(e.targetTouches[0].clientX);
  }, []);

  const handleTouchEnd = useCallback(async () => {
    if (!touchStart || !touchEnd) return;

    const distance = touchStart - touchEnd;
    const isLeftSwipe = distance > 50;
    const isHorizontalSwipe = Math.abs(distance) > 50;

    if (isHorizontalSwipe && isLeftSwipe) {
      await handleUltraFastSwipe();
    }

    setTouchStart(null);
    setTouchEnd(null);
  }, [touchStart, touchEnd]);

  // =============================================================================
  // ULTRA-FAST SWIPE HANDLING
  // =============================================================================

  const handleUltraFastSwipe = useCallback(async () => {
    try {
      setError(null);

      // Stop current tracking
      coinDeductionService.stopChatDurationTracking();

      // Immediate UI updates for perceived speed
      setConnectionState('connecting');
      setIsVideoPlaying(false);
      setCurrentVideoId(null);
      setCurrentVideoUrl(null);
      setCurrentVideoName(null);
      setMessages([]);

      // Keep streams persistent during swipe
      // DON'T clear them - this prevents blank screen

      // Ultra-fast swipe
      await ultraFastVideoChatService.swipeNext();

    } catch (error) {
      setError('Failed to find next match');
    }
  }, []);

  // =============================================================================
  // VIDEO HANDLING
  // =============================================================================

  const handleVideoEnd = useCallback(() => {
    setIsVideoPlaying(false);
    setCurrentVideoId(null);
    setCurrentVideoUrl(null);
    setCurrentVideoName(null);
    setConnectionState('disconnected');
    setMessages([]);
    coinDeductionService.stopChatDurationTracking();
  }, []);

  // =============================================================================
  // ULTRA-FAST AUTHENTICATION & INITIALIZATION
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

  // Ultra-fast callback setup
  const initializeUltraFastVideoChat = useCallback(async () => {
    if (isInitialized) return;

    try {
      setConnectionState('connecting');
      setError(null);

      // Parallel initialization for maximum speed
      const [authUser] = await Promise.all([
        (async () => {
          const user = userService.getUserFromLocalStorage();
          if (!user?.id) throw new Error('Authentication required');
          return user;
        })(),
        coinDeductionService.initializeDeductionRules()
      ]);

      setUserId(authUser.id.toString());
      setCoinBalance(authUser.coin_balance || 0);

      // Setup ultra-fast callbacks
      setupUltraFastCallbacks();

      // Join queue with ultra-fast service
      await ultraFastVideoChatService.joinQueue();
      setIsInitialized(true);

    } catch (error) {
      setError(error instanceof Error ? error.message : 'Failed to initialize');
      setConnectionState('failed');
    }
  }, [isInitialized]);

  const setupUltraFastCallbacks = useCallback(() => {
    // Local stream callback - immediate display
    ultraFastVideoChatService.onLocalStream((stream) => {
      setLocalStream(stream);
    });

    // Remote stream callback - immediate display with persistence
    ultraFastVideoChatService.onRemoteStream((stream) => {
      setRemoteStream(stream);
      setConnectionState('connected');
      coinDeductionService.startChatDurationTracking();
    });

    // Video match callback
    ultraFastVideoChatService.onVideoMatch((videoData) => {
      setConnectionState('connected');
      setError(null);
      setRemoteStream(null); // Clear remote stream for video
      setIsVideoPlaying(true);
      setCurrentVideoId(videoData.videoId);
      setCurrentVideoUrl(videoData.videoUrl);
      setCurrentVideoName(videoData.videoName);
      coinDeductionService.startChatDurationTracking();
    });

    // Connection state callback
    ultraFastVideoChatService.onConnectionStateChange((state) => {
      setConnectionState(state.type);

      if (state.type === 'failed') {
        setError('Connection failed - finding new match...');
      } else if (state.type === 'connected') {
        setError(null);
      }
    });

    // Partner left callback
    ultraFastVideoChatService.onPartnerLeft(() => {
      setIsVideoPlaying(false);
      setCurrentVideoId(null);
      setCurrentVideoUrl(null);
      setCurrentVideoName(null);
      setMessages([]);
      setConnectionState('disconnected');
      coinDeductionService.stopChatDurationTracking();

      // Keep streams for next connection - prevents blank screen
    });

    // Message callback
    ultraFastVideoChatService.onMessageReceived((message) => {
      if (message.from !== userId) {
        setMessages(prev => [...prev, message]);
      }
    });

    // Error callback
    ultraFastVideoChatService.onError((errorMsg) => {
      setError(errorMsg);
    });
  }, [userId]);

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
  // CLEANUP
  // =============================================================================

  useEffect(() => {
    return () => {
      if (isInitialized) {
        coinDeductionService.stopChatDurationTracking();
        ultraFastVideoChatService.cleanup();
      }
    };
  }, [isInitialized]);

  // =============================================================================
  // CHAT HANDLING
  // =============================================================================

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const handleSend = useCallback(async (e?: React.FormEvent) => {
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
      await ultraFastVideoChatService.sendMessage(userMessage.text);
    } catch (error) {
      setMessages(prev => prev.filter(m => m.id !== messageId));
      setError('Failed to send message');
    }
  }, [input, userId]);

  // =============================================================================
  // RENDER
  // =============================================================================

  if (!isClient) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-purple-900 via-blue-900 to-indigo-900 flex items-center justify-center">
        <div className="text-white text-xl">Initializing ultra-fast connection...</div>
      </div>
    );
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
            <h1 className="text-2xl font-bold">Juicy Meets ⚡</h1>
            <p className="text-sm opacity-75">
              {connectionState === 'connected' ?
                (isVideoPlaying ? 'Watching Video' : 'Live Chat') :
                'Ultra-Fast Connecting...'}
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
              {/* Remote video - KEY PROP FORCES RE-RENDER */}
              <video
                key={`remote-${streamKey}`}
                ref={remoteVideoRef}
                className="w-full h-full object-cover"
                autoPlay
                playsInline
                muted={false}
              />

              {/* Local video overlay - KEY PROP FORCES RE-RENDER */}
              {localStream && (
                <div className="absolute top-4 right-4 w-32 h-24 bg-gray-800 rounded-lg overflow-hidden">
                  <video
                    key={`local-${streamKey}`}
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
                    <p>Ultra-fast matching...</p>
                  </div>
                </div>
              )}

              {/* Stream status indicator */}
              <div className="absolute bottom-4 left-4 bg-black bg-opacity-75 text-white px-2 py-1 rounded text-xs">
                Local: {localStream ? '✅' : '❌'} | Remote: {remoteStream ? '✅' : '❌'}
              </div>
            </div>
          )}
        </div>

        {/* Right side - Chat (hidden during video) */}
        {!isVideoPlaying && (
          <div className="w-80 bg-white bg-opacity-10 backdrop-blur-lg border-l border-white border-opacity-20 flex flex-col">
            {/* Chat header */}
            <div className="p-4 border-b border-white border-opacity-20">
              <h3 className="text-white font-semibold">Ultra-Fast Chat</h3>
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
                  ⚡
                </button>
              </form>
            </div>
          </div>
        )}
      </div>

      {/* Ultra-fast swipe button */}
      <div className="absolute bottom-10 left-1/2 transform -translate-x-1/2 z-20">
        <button
          onClick={handleUltraFastSwipe}
          className="bg-gradient-to-r from-purple-500 to-blue-500 text-white px-6 py-3 rounded-full hover:from-purple-600 hover:to-blue-600 transition-all duration-200 hover:scale-110 shadow-lg"
          disabled={connectionState === 'connecting'}
        >
          <span className="text-lg">⚡ Ultra Next</span>
        </button>
      </div>
    </div>
  );
}


