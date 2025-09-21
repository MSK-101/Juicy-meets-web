'use client';

import React, { useState, useRef, useEffect, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { fixedUltraFastVideoChatService } from '@/services/fixedUltraFastVideoChatService';
import { coinDeductionService } from '@/services/coinDeductionService';
import { userService } from '@/api/services/userService';
import { ChatMessage } from "@/components/ChatMessageContainer";
import { VideoPlayer } from "@/components/VideoPlayer";

export default function ReliableVideoChatPage() {
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

  // Stream state with reliable assignment
  const [localStream, setLocalStream] = useState<MediaStream | null>(null);
  const [remoteStream, setRemoteStream] = useState<MediaStream | null>(null);
  const [streamAssignmentKey, setStreamAssignmentKey] = useState(0);

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

  // Debug state
  const [debugInfo, setDebugInfo] = useState('Initializing...');

  // =============================================================================
  // RELIABLE CLIENT-SIDE INITIALIZATION
  // =============================================================================

  useEffect(() => {
    setIsClient(true);
    setDebugInfo('Client initialized');
  }, []);

  useEffect(() => {
    if (isClient && !isInitialized) {
      initializeReliableVideoChat();
    }
  }, [isClient, isInitialized]);

  // =============================================================================
  // RELIABLE STREAM ASSIGNMENT
  // =============================================================================

  // Force video element updates with reliable assignment
  useEffect(() => {
    if (localStream && localVideoRef.current) {
      const video = localVideoRef.current;

      // Force assignment
      video.srcObject = localStream;
      video.load();

      // Force play
      const playPromise = video.play();
      if (playPromise) {
        playPromise.catch(() => {
          // Retry play after a short delay
          setTimeout(() => {
            video.play().catch(() => {
              // Final retry
              setTimeout(() => video.play().catch(() => {}), 500);
            });
          }, 100);
        });
      }

      setDebugInfo(`Local stream: ✅ (tracks: ${localStream.getTracks().length})`);
    }
  }, [localStream, streamAssignmentKey]);

  useEffect(() => {
    if (remoteStream && remoteVideoRef.current) {
      const video = remoteVideoRef.current;

      setDebugInfo(`Remote stream received: ✅ (tracks: ${remoteStream.getTracks().length})`);

      // Force assignment with multiple retries
      const assignStream = (retryCount = 0) => {
        video.srcObject = remoteStream;
        video.load();

        const playPromise = video.play();
        if (playPromise) {
          playPromise
            .then(() => {
              setDebugInfo(`Remote stream playing: ✅`);
            })
            .catch(() => {
              if (retryCount < 3) {
                setTimeout(() => assignStream(retryCount + 1), 200);
              }
            });
        }
      };

      assignStream();

    } else if (!remoteStream && remoteVideoRef.current) {
      remoteVideoRef.current.srcObject = null;
      setDebugInfo('Remote stream: ❌');
    }
  }, [remoteStream, streamAssignmentKey]);

  // Force re-assignment every 2 seconds to prevent stuck streams
  useEffect(() => {
    if (!isClient || !isInitialized) return;

    const forceRefreshInterval = setInterval(() => {
      if (connectionState === 'connected' && !isVideoPlaying) {
        const currentRemote = fixedUltraFastVideoChatService.getCurrentRemoteStream();
        const currentLocal = fixedUltraFastVideoChatService.getCurrentLocalStream();

        if (currentRemote && currentRemote !== remoteStream) {
          setRemoteStream(currentRemote);
          setStreamAssignmentKey(prev => prev + 1);
          setDebugInfo('Forced remote stream refresh');
        }

        if (currentLocal && currentLocal !== localStream) {
          setLocalStream(currentLocal);
          setStreamAssignmentKey(prev => prev + 1);
          setDebugInfo('Forced local stream refresh');
        }
      }
    }, 2000);

    return () => clearInterval(forceRefreshInterval);
  }, [isClient, isInitialized, connectionState, isVideoPlaying, localStream, remoteStream]);

  // =============================================================================
  // RELIABLE TOUCH/SWIPE HANDLING
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
      await handleReliableSwipe();
    }

    setTouchStart(null);
    setTouchEnd(null);
  }, [touchStart, touchEnd]);

  // =============================================================================
  // RELIABLE SWIPE HANDLING
  // =============================================================================

  const handleReliableSwipe = useCallback(async () => {
    try {
      setError(null);
      setDebugInfo('Swiping...');

      // Stop current tracking
      coinDeductionService.stopChatDurationTracking();

      // Clear UI state immediately
      setConnectionState('connecting');
      setIsVideoPlaying(false);
      setCurrentVideoId(null);
      setCurrentVideoUrl(null);
      setCurrentVideoName(null);
      setMessages([]);

      // Keep streams for reliability - DON'T clear them
      // This prevents the gray screen issue

      // Perform reliable swipe
      await fixedUltraFastVideoChatService.swipeNext();

      setDebugInfo('Swipe completed, waiting for match...');

    } catch (error) {
      setError('Failed to find next match');
      setDebugInfo('Swipe failed');
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
    setDebugInfo('Video ended');
  }, []);

  // =============================================================================
  // RELIABLE INITIALIZATION
  // =============================================================================

  const initializeReliableVideoChat = useCallback(async () => {
    if (isInitialized) return;

    try {
      setConnectionState('connecting');
      setError(null);
      setDebugInfo('Initializing...');

      // Get authenticated user
      const storedUser = userService.getUserFromLocalStorage();
      if (!storedUser) {
        router.push('/');
        return;
      }

      setUserId(storedUser.id.toString());
      setCoinBalance(storedUser.coin_balance || 0);

      // Initialize deduction rules
      await coinDeductionService.initializeDeductionRules();
      setDebugInfo('Deduction rules loaded');

      // Setup reliable callbacks
      setupReliableCallbacks();
      setDebugInfo('Callbacks configured');

      // Join queue with fixed service
      await fixedUltraFastVideoChatService.joinQueue();
      setIsInitialized(true);
      setDebugInfo('Joined queue, waiting for match...');

    } catch (error) {
      setError(error instanceof Error ? error.message : 'Failed to initialize');
      setConnectionState('failed');
      setDebugInfo('Initialization failed');
    }
  }, [isInitialized, router]);

  const setupReliableCallbacks = useCallback(() => {
    // Local stream callback - IMMEDIATE assignment
    fixedUltraFastVideoChatService.onLocalStream((stream) => {
      setLocalStream(stream);
      setStreamAssignmentKey(prev => prev + 1);
      setDebugInfo(`Local stream assigned: ${stream.getTracks().length} tracks`);
    });

    // Remote stream callback - IMMEDIATE assignment with retry
    fixedUltraFastVideoChatService.onRemoteStream((stream) => {
      setRemoteStream(stream);
      setConnectionState('connected');
      setStreamAssignmentKey(prev => prev + 1);
      setDebugInfo(`Remote stream assigned: ${stream.getTracks().length} tracks`);
      coinDeductionService.startChatDurationTracking();
    });

    // Video match callback
    fixedUltraFastVideoChatService.onVideoMatch((videoData) => {
      setConnectionState('connected');
      setError(null);
      setRemoteStream(null);
      setIsVideoPlaying(true);
      setCurrentVideoId(videoData.videoId);
      setCurrentVideoUrl(videoData.videoUrl);
      setCurrentVideoName(videoData.videoName);
      setDebugInfo('Video match found');
      coinDeductionService.startChatDurationTracking();
    });

    // Connection state callback
    fixedUltraFastVideoChatService.onConnectionStateChange((state) => {
      setConnectionState(state.type);
      setDebugInfo(`Connection: ${state.type}`);

      if (state.type === 'failed') {
        setError('Connection failed - retrying...');
      } else if (state.type === 'connected') {
        setError(null);
      }
    });

    // Partner left callback
    fixedUltraFastVideoChatService.onPartnerLeft(() => {
      setIsVideoPlaying(false);
      setCurrentVideoId(null);
      setCurrentVideoUrl(null);
      setCurrentVideoName(null);
      setMessages([]);
      setConnectionState('disconnected');
      setDebugInfo('Partner left');
      coinDeductionService.stopChatDurationTracking();

      // Keep streams for next connection
    });

    // Message callback
    fixedUltraFastVideoChatService.onMessageReceived((message) => {
      if (message.from !== userId) {
        setMessages(prev => [...prev, message]);
      }
    });

    // Error callback
    fixedUltraFastVideoChatService.onError((errorMsg) => {
      setError(errorMsg);
      setDebugInfo(`Error: ${errorMsg}`);
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
        fixedUltraFastVideoChatService.cleanup();
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
      await fixedUltraFastVideoChatService.sendMessage(userMessage.text);
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
        <div className="text-white text-xl">Initializing reliable connection...</div>
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
            <h1 className="text-2xl font-bold">Juicy Meets 🔧</h1>
            <p className="text-sm opacity-75">
              {connectionState === 'connected' ?
                (isVideoPlaying ? 'Watching Video' : 'Live Chat') :
                'Reliable Connection...'}
            </p>
          </div>

          <div className="text-white text-right">
            <p className="text-sm opacity-75">Coins</p>
            <p className="text-lg font-bold">{coinBalance}</p>
          </div>
        </div>
      </div>

      {/* Debug info */}
      <div className="absolute top-20 left-4 z-20 bg-black bg-opacity-75 text-white px-2 py-1 rounded text-xs">
        {debugInfo}
      </div>

      {/* Error display */}
      {error && (
        <div className="absolute top-32 left-4 right-4 z-20 bg-red-500 text-white px-4 py-2 rounded-lg">
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
              {/* Remote video - FORCE RE-RENDER WITH KEY */}
              <video
                key={`remote-${streamAssignmentKey}-${remoteStream?.id || 'none'}`}
                ref={remoteVideoRef}
                className="w-full h-full object-cover"
                autoPlay
                playsInline
                muted={false}
              />

              {/* Local video overlay - FORCE RE-RENDER WITH KEY */}
              {localStream && (
                <div className="absolute top-4 right-4 w-32 h-24 bg-gray-800 rounded-lg overflow-hidden">
                  <video
                    key={`local-${streamAssignmentKey}-${localStream?.id || 'none'}`}
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
                    <p>Finding reliable match...</p>
                  </div>
                </div>
              )}

              {/* Stream status indicator */}
              <div className="absolute bottom-4 left-4 bg-black bg-opacity-75 text-white px-2 py-1 rounded text-xs">
                Local: {localStream ? '✅' : '❌'} | Remote: {remoteStream ? '✅' : '❌'}
                <br />
                Key: {streamAssignmentKey} | State: {connectionState}
              </div>
            </div>
          )}
        </div>

        {/* Right side - Chat (hidden during video) */}
        {!isVideoPlaying && (
          <div className="w-80 bg-white bg-opacity-10 backdrop-blur-lg border-l border-white border-opacity-20 flex flex-col">
            {/* Chat header */}
            <div className="p-4 border-b border-white border-opacity-20">
              <h3 className="text-white font-semibold">Reliable Chat</h3>
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
                  🔧
                </button>
              </form>
            </div>
          </div>
        )}
      </div>

      {/* Reliable swipe button */}
      <div className="absolute bottom-10 left-1/2 transform -translate-x-1/2 z-20">
        <button
          onClick={handleReliableSwipe}
          className="bg-gradient-to-r from-green-500 to-blue-500 text-white px-6 py-3 rounded-full hover:from-green-600 hover:to-blue-600 transition-all duration-200 hover:scale-110 shadow-lg"
          disabled={connectionState === 'connecting'}
        >
          <span className="text-lg">🔧 Reliable Next</span>
        </button>
      </div>
    </div>
  );
}


