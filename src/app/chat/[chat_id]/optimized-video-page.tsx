'use client';

import React, { useState, useRef, useEffect, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { optimizedVideoChatService, ConnectionState, VideoMatchData } from '@/services/optimizedVideoChatService';
import { coinDeductionService } from '@/services/coinDeductionService';
import { userService } from '@/api/services/userService';

interface ChatMessage {
  from: string;
  text: string;
  timestamp: number;
  id?: string;
}

export default function OptimizedVideoChatPage() {
  const params = useParams();
  const router = useRouter();
  const chatId = params.chat_id as string;

  // Video refs
  const localVideoRef = useRef<HTMLVideoElement>(null);
  const remoteVideoRef = useRef<HTMLVideoElement>(null);
  const videoPlayerRef = useRef<HTMLVideoElement>(null);

  // State
  const [connectionState, setConnectionState] = useState<'connecting' | 'connected' | 'failed' | 'disconnected'>('connecting');
  const [matchType, setMatchType] = useState<'video' | 'real_user' | 'staff' | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isInitialized, setIsInitialized] = useState(false);
  const [isSwiping, setIsSwiping] = useState(false);

  // Video player state
  const [isVideoPlaying, setIsVideoPlaying] = useState(false);
  const [currentVideoUrl, setCurrentVideoUrl] = useState<string | null>(null);
  const [currentVideoName, setCurrentVideoName] = useState<string | null>(null);

  // Chat state
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [newMessage, setNewMessage] = useState('');

  // User state
  const [userId, setUserId] = useState<string>('');
  const [coinBalance, setCoinBalance] = useState<number>(0);

  // =============================================================================
  // INITIALIZATION
  // =============================================================================

  useEffect(() => {
    initializeOptimizedVideoChat();
    return () => optimizedVideoChatService.cleanup();
  }, []);

  const initializeOptimizedVideoChat = useCallback(async () => {
    if (isInitialized) return;

    try {
      setError(null);

      // Setup authentication
      const authenticatedUser = userService.getUserFromLocalStorage();
      if (!authenticatedUser?.id) {
        throw new Error('Authentication required');
      }

      setUserId(authenticatedUser.id.toString());
      setCoinBalance(authenticatedUser.coin_balance || 0);

      // Initialize deduction service
      await coinDeductionService.initializeDeductionRules();

      // Setup optimized callbacks - minimal setup for maximum speed
      setupOptimizedCallbacks();

      // Join queue
      await optimizedVideoChatService.joinQueue();
      setIsInitialized(true);

    } catch (error) {
      setError(error instanceof Error ? error.message : 'Failed to initialize');
      setConnectionState('failed');
    }
  }, [isInitialized]);

  // =============================================================================
  // OPTIMIZED CALLBACKS SETUP
  // =============================================================================

  const setupOptimizedCallbacks = useCallback(() => {
    // Local stream callback - immediate display
    optimizedVideoChatService.onLocalStream((stream) => {
      if (localVideoRef.current) {
        localVideoRef.current.srcObject = stream;
      }
    });

    // Remote stream callback - live connections
    optimizedVideoChatService.onRemoteStream((stream) => {
      if (remoteVideoRef.current) {
        remoteVideoRef.current.srcObject = stream;
      }
      setIsVideoPlaying(false); // Switch from video player to live stream
      setCurrentVideoUrl(null);
      coinDeductionService.startChatDurationTracking();
    });

    // Video match callback - video content
    optimizedVideoChatService.onVideoMatch((videoData: VideoMatchData) => {
      setIsVideoPlaying(true);
      setCurrentVideoUrl(videoData.videoUrl);
      setCurrentVideoName(videoData.videoName);

      // Clear remote stream for video playback
      if (remoteVideoRef.current) {
        remoteVideoRef.current.srcObject = null;
      }

      coinDeductionService.startChatDurationTracking();
    });

    // Connection state callback
    optimizedVideoChatService.onConnectionStateChange((state: ConnectionState) => {
      setConnectionState(state.type);
      setMatchType(state.matchType || null);

      if (state.type === 'failed') {
        setError('Connection failed - finding new match...');
      } else if (state.type === 'connected') {
        setError(null);
      }
    });

    // Partner left callback
    optimizedVideoChatService.onPartnerLeft(() => {
      setIsVideoPlaying(false);
      setCurrentVideoUrl(null);
      setCurrentVideoName(null);
      setMessages([]);
      setConnectionState('disconnected');
      coinDeductionService.stopChatDurationTracking();

      if (remoteVideoRef.current) {
        remoteVideoRef.current.srcObject = null;
      }
    });

    // Message callback
    optimizedVideoChatService.onMessageReceived((message) => {
      if (message.from !== userId) {
        setMessages(prev => [...prev, message]);
      }
    });

    // Error callback
    optimizedVideoChatService.onError((errorMsg) => {
      setError(errorMsg);
    });
  }, [userId]);

  // =============================================================================
  // VIDEO PLAYER EFFECT
  // =============================================================================

  useEffect(() => {
    if (isVideoPlaying && currentVideoUrl && videoPlayerRef.current) {
      videoPlayerRef.current.src = currentVideoUrl;
      videoPlayerRef.current.load();
      videoPlayerRef.current.play().catch(console.warn);
    }
  }, [isVideoPlaying, currentVideoUrl]);

  // =============================================================================
  // COIN DEDUCTION HANDLING
  // =============================================================================

  useEffect(() => {
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
  }, []);

  // =============================================================================
  // USER ACTIONS
  // =============================================================================

  const handleSwipeNext = useCallback(async () => {
    if (isSwiping) return;

    setIsSwiping(true);
    setError(null);

    try {
      coinDeductionService.stopChatDurationTracking();
      await optimizedVideoChatService.swipeNext();
      setConnectionState('connecting');
    } catch (error) {
      setError('Failed to find next match');
    } finally {
      setIsSwiping(false);
    }
  }, [isSwiping]);

  const handleSendMessage = useCallback(async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMessage.trim() || !userId) return;

    const message: ChatMessage = {
      from: userId,
      text: newMessage.trim(),
      timestamp: Date.now(),
      id: `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
    };

    // Add message to local state immediately
    setMessages(prev => [...prev, message]);
    setNewMessage('');

    // Send via service
    try {
      await optimizedVideoChatService.sendMessage(message.text);
    } catch (error) {
      // Remove message on failure
      setMessages(prev => prev.filter(m => m.id !== message.id));
      setError('Failed to send message');
    }
  }, [newMessage, userId]);

  const handleLeaveChat = useCallback(async () => {
    try {
      coinDeductionService.stopChatDurationTracking();
      await optimizedVideoChatService.leaveChat();
      router.push('/');
    } catch (error) {
      // Still navigate away even if leave fails
      router.push('/');
    }
  }, [router]);

  // =============================================================================
  // RENDER LOGIC
  // =============================================================================

  const renderVideoContent = () => {
    if (isVideoPlaying && currentVideoUrl) {
      return (
        <div className="relative w-full h-full bg-black rounded-lg overflow-hidden">
          <video
            ref={videoPlayerRef}
            className="w-full h-full object-cover"
            controls
            playsInline
            muted={false}
          />
          {currentVideoName && (
            <div className="absolute top-4 left-4 bg-black bg-opacity-75 text-white px-3 py-1 rounded">
              {currentVideoName}
            </div>
          )}
        </div>
      );
    }

    return (
      <div className="relative w-full h-full bg-black rounded-lg overflow-hidden">
        {/* Remote video */}
        <video
          ref={remoteVideoRef}
          className="w-full h-full object-cover"
          autoPlay
          playsInline
          muted={false}
        />

        {/* Local video overlay */}
        <div className="absolute top-4 right-4 w-32 h-24 bg-gray-800 rounded-lg overflow-hidden">
          <video
            ref={localVideoRef}
            className="w-full h-full object-cover"
            autoPlay
            playsInline
            muted
          />
        </div>

        {/* Connection status overlay */}
        {connectionState === 'connecting' && (
          <div className="absolute inset-0 bg-black bg-opacity-50 flex items-center justify-center">
            <div className="text-white text-center">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-white mb-4 mx-auto"></div>
              <p>Connecting...</p>
            </div>
          </div>
        )}
      </div>
    );
  };

  const renderChatMessages = () => {
    if (isVideoPlaying) return null; // Hide chat during video playback

    return (
      <div className="bg-white rounded-lg shadow-lg p-4 h-full flex flex-col">
        <h3 className="text-lg font-semibold mb-4">Chat</h3>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto space-y-2 mb-4">
          {messages.map((message) => (
            <div
              key={message.id || `${message.timestamp}_${message.from}`}
              className={`p-2 rounded-lg max-w-xs ${
                message.from === userId
                  ? 'bg-blue-500 text-white ml-auto'
                  : 'bg-gray-200 text-gray-800'
              }`}
            >
              <p className="text-sm">{message.text}</p>
              <p className="text-xs opacity-75 mt-1">
                {new Date(message.timestamp).toLocaleTimeString()}
              </p>
            </div>
          ))}
        </div>

        {/* Message input */}
        <form onSubmit={handleSendMessage} className="flex gap-2">
          <input
            type="text"
            value={newMessage}
            onChange={(e) => setNewMessage(e.target.value)}
            placeholder="Type a message..."
            className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            disabled={connectionState !== 'connected' || isVideoPlaying}
          />
          <button
            type="submit"
            disabled={!newMessage.trim() || connectionState !== 'connected' || isVideoPlaying}
            className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Send
          </button>
        </form>
      </div>
    );
  };

  if (!isInitialized && !error) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-purple-900 via-blue-900 to-indigo-900 flex items-center justify-center">
        <div className="text-white text-center">
          <div className="animate-spin rounded-full h-16 w-16 border-b-2 border-white mb-4 mx-auto"></div>
          <p className="text-xl">Initializing video chat...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-900 via-blue-900 to-indigo-900 p-4">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="bg-white rounded-lg shadow-lg p-4 mb-4 flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-800">Juicy Meets</h1>
            <p className="text-gray-600">
              {matchType === 'video' ? 'Watching Video' :
               matchType === 'staff' ? 'Connected to Staff' :
               matchType === 'real_user' ? 'Connected to User' : 'Finding Match...'}
            </p>
          </div>

          <div className="flex items-center gap-4">
            <div className="text-right">
              <p className="text-sm text-gray-600">Coins</p>
              <p className="text-lg font-semibold text-yellow-600">{coinBalance}</p>
            </div>

            <button
              onClick={handleLeaveChat}
              className="px-4 py-2 bg-red-500 text-white rounded-lg hover:bg-red-600"
            >
              Leave
            </button>
          </div>
        </div>

        {/* Error display */}
        {error && (
          <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-4">
            {error}
          </div>
        )}

        {/* Main content */}
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-4 h-[600px]">
          {/* Video area */}
          <div className="lg:col-span-3">
            {renderVideoContent()}
          </div>

          {/* Chat area */}
          <div className="lg:col-span-1">
            {renderChatMessages()}
          </div>
        </div>

        {/* Controls */}
        <div className="bg-white rounded-lg shadow-lg p-4 mt-4 flex items-center justify-center gap-4">
          <button
            onClick={handleSwipeNext}
            disabled={isSwiping || connectionState === 'connecting'}
            className="px-6 py-3 bg-green-500 text-white rounded-lg hover:bg-green-600 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
          >
            {isSwiping ? (
              <>
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                Finding Next...
              </>
            ) : (
              <>
                <span>Next Match</span>
                <span className="text-lg">➡️</span>
              </>
            )}
          </button>

          <div className="text-center text-gray-600">
            <p className="text-sm">Connection: {connectionState}</p>
            {matchType && <p className="text-xs">Type: {matchType}</p>}
          </div>
        </div>
      </div>
    </div>
  );
}


