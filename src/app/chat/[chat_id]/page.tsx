"use client";
import React, { useState, useRef, useEffect, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import { SplitVideoChat } from "@/components/SplitVideoChat";
import { cleanVideoChatService } from "@/services/cleanVideoChatService";
import DiamondCountBar from "../components/DiamondCountBar";
import ChatInput from "../components/ChatInput";
import FlagButton from "../components/FlagButton";
import MaleIcon from "../components/MaleIcon";
import FemaleIcon from "../components/FemaleIcon";
import { ChatMessage } from "@/components/ChatMessageContainer";
import { VideoPlayer } from "@/components/VideoPlayer";
import { userService } from "@/api/services/userService";
import { coinDeductionService } from "@/services/coinDeductionService";
import { nextSwipe } from "@/utils/swipeUtils";
import { useAuthStore } from "@/store/auth";

// Use imported ChatMessage interface

export default function VideoChatPage() {
  const params = useParams();
  const chatId = params.chat_id as string;
  const router = useRouter();

  // Get user info from auth store
  const handleUserBan = useAuthStore((state) => state.handleUserBan);

  // Start with empty chat
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const chatEndRef = useRef<HTMLDivElement>(null);

  // Clean video chat state
  const [remoteStream, setRemoteStream] = useState<MediaStream | null>(null);
  const [localStream, setLocalStream] = useState<MediaStream | null>(null);
  const [connectionState, setConnectionState] = useState<'disconnected' | 'connecting' | 'connected' | 'failed'>('disconnected');
  const [isConnecting, setIsConnecting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isInitialized, setIsInitialized] = useState(false);
  const [userId, setUserId] = useState<string>('');
  const [isClient, setIsClient] = useState(false);
  const [coinBalance, setCoinBalance] = useState<number>(0);
  const [isCheckingAuth, setIsCheckingAuth] = useState(true);
  const [partnerId, setPartnerId] = useState<string | null>(null);

  // Touch gesture state for mobile swipe
  const [touchStart, setTouchStart] = useState<{ x: number; y: number } | null>(null);
  const [touchEnd, setTouchEnd] = useState<{ x: number; y: number } | null>(null);

  // Video display state
  const [isVideoPlaying, setIsVideoPlaying] = useState(false);
  const [currentVideoId, setCurrentVideoId] = useState<string | null>(null);
  const [currentVideoUrl, setCurrentVideoUrl] = useState<string | null>(null);
  const [currentVideoName, setCurrentVideoName] = useState<string | null>(null);

  // Convert ChatMessage to format expected by ChatInput
  const messagesForChatInput = React.useMemo(() => {
    if (!userId) return [];
    return messages.map(msg => ({
      sender: msg.from === userId ? 'you' : 'partner',
      text: msg.text,
      timestamp: msg.timestamp
    }));
  }, [messages, userId]);

  // Check if we're on the client side
  useEffect(() => {
    setIsClient(true);

    // CRITICAL FIX: Set up remote stream callback immediately to prevent timing issues
    // This ensures the callback is available even if streams arrive before full initialization
    cleanVideoChatService.onRemoteStream((stream) => {
      console.log('📺 UI: Remote stream callback received:', !!stream);

      // CRITICAL FIX: Don't ignore remote streams - they might be for live connections
      // Only ignore if we're currently in a video match state
      if (isVideoPlaying && currentVideoId) {
        console.log('📺 UI: Ignoring remote stream - video is playing');
        return;
      }

      // Set the remote stream directly
      console.log('📺 UI: Setting remote stream');
      setRemoteStream(stream);

      // Update connection state if we got a stream
      if (stream) {
        setConnectionState('connected');
        coinDeductionService.startChatDurationTracking();
        console.log('📺 UI: Connection state set to connected');
      }
    });
  }, []);

  // Removed streamKey logic - component remounting was causing issues

    // Touch gesture handlers for mobile swipe
  const handleTouchStart = (e: React.TouchEvent) => {
    setTouchStart({
      x: e.targetTouches[0].clientX,
      y: e.targetTouches[0].clientY
    });
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    setTouchEnd({
      x: e.targetTouches[0].clientX,
      y: e.targetTouches[0].clientY
    });
  };

  const handleTouchEnd = async () => {
    if (!touchStart || !touchEnd) return;

    const distanceX = touchStart.x - touchEnd.x;
    const distanceY = touchStart.y - touchEnd.y;
    const isHorizontalSwipe = Math.abs(distanceX) > Math.abs(distanceY);
    const isLeftSwipe = distanceX > 50; // Minimum swipe distance

    if (isHorizontalSwipe && isLeftSwipe) {
      // Left swipe detected - trigger next match
      await handleSwipeToNext();
    }

    // Reset touch state
    setTouchStart(null);
    setTouchEnd(null);
  };

  // Centralized swipe handler for both touch and button
  const handleSwipeToNext = async () => {
    try {
      // CRITICAL: Clear ALL UI state before swipe
      console.log('🔄 SWIPE: Clearing UI state...');
      setRemoteStream(null);
      setConnectionState('connecting');
      setMessages([]);

      // CRITICAL FIX: Clear video state as well
      setIsVideoPlaying(false);
      setCurrentVideoId(null);
      setCurrentVideoUrl(null);
      setCurrentVideoName(null);

      const result = await nextSwipe(
        setConnectionState,
        setError,
        setIsVideoPlaying,
        setCurrentVideoId,
        setCurrentVideoUrl,
        setCurrentVideoName,
        setMessages
      );

      // Handle per-swipe deduction result
      if (result?.swipe_deduction) {
        const deduction = result.swipe_deduction;
        if (deduction.success && deduction.deducted > 0) {
          // Update coin balance
          setCoinBalance(deduction.new_balance);
          userService.updateUserCoinBalance(deduction.new_balance);
        } else if (!deduction.success) {
        }
      }
    } catch (error) {
      console.error('Error in handleSwipeToNext:', error);
    }
  };

  // Handle video end
  const handleVideoEnd = () => {
    setIsVideoPlaying(false);
    setCurrentVideoId(null);
    setCurrentVideoUrl(null);
    setCurrentVideoName(null);
    setConnectionState('disconnected');
    setMessages([]); // Clear messages when video ends

    // Stop tracking chat duration for coin deductions
    coinDeductionService.stopChatDurationTracking();

    // Automatically trigger next match
    handleSwipeToNext();
  };

  // Check authentication and redirect if no user
  useEffect(() => {
    if (isClient) {
      const storedUser = userService.getUserFromLocalStorage();
      if (!storedUser) {
        router.push('/');
        return;
      }

      // Check if user is banned
      if (storedUser.user_status === 'suspended') {
        handleUserBan();
        return;
      }

      // User is authenticated, set user ID and coin balance
      setUserId(storedUser.id.toString());
      setCoinBalance(storedUser.coin_balance);
      setIsCheckingAuth(false);

      // Initialize deduction rules and refresh balance from server
      coinDeductionService.initializeDeductionRules().then(async () => {
        // Refresh balance from server to ensure it's current
        try {
          const currentBalance = await coinDeductionService.getUserBalance();
          setCoinBalance(currentBalance);
          userService.updateUserCoinBalance(currentBalance);
        } catch (error) {
          console.error('Failed to refresh balance from server:', error);
        }
      }).catch(() => {
        // Silent error handling
      });
    }
  }, [isClient, router, handleUserBan]);

  // Listen for coin deduction events
  useEffect(() => {
    if (!isClient) return;

    const handleCoinDeduction = (event: CustomEvent) => {
      const result = event.detail;
      setCoinBalance(result.new_balance);
      userService.updateUserCoinBalance(result.new_balance);
    };

    const handleCoinDeductionError = (event: CustomEvent) => {
      const result = event.detail;
      console.error('Coin deduction error:', result);
    };

    window.addEventListener('coinDeductionApplied', handleCoinDeduction as EventListener);
    window.addEventListener('coinDeductionError', handleCoinDeductionError as EventListener);

    return () => {
      window.removeEventListener('coinDeductionApplied', handleCoinDeduction as EventListener);
      window.removeEventListener('coinDeductionError', handleCoinDeductionError as EventListener);
    };
  }, [isClient]);

  // Update partner ID when connection state changes
  useEffect(() => {
    if (connectionState === 'connected') {
      const currentPartnerId = cleanVideoChatService.getPartnerId();
      setPartnerId(currentPartnerId);
    } else {
      setPartnerId(null);
    }
  }, [connectionState]);

  // Set up video match callback immediately
  useEffect(() => {
    cleanVideoChatService.onVideoMatch((videoData) => {
      console.log('🎬 UI: Video match received:', videoData);

      setConnectionState('connected');
      setError(null);

      // Clear live connection state when video match starts
      setRemoteStream(null);
      setMessages([]);

      setIsVideoPlaying(true);
      setCurrentVideoId(videoData.videoId);
      setCurrentVideoUrl(videoData.videoUrl);
      setCurrentVideoName(videoData.videoName);

      // Start new tracking for video
      coinDeductionService.startChatDurationTracking();
    });
  }, []);

  // Initialize clean video chat service
  const initializeVideoChat = useCallback(async () => {
    if (!isClient || isInitialized || isConnecting) {
      return;
    }
    try {
      setIsConnecting(true);
      setConnectionState('connecting');
      setError(null);

      // Ensure deduction rules are loaded before starting video chat
      await coinDeductionService.initializeDeductionRules();

      // Get authenticated user ID instead of generating random one
      const authenticatedUser = userService.getUserFromLocalStorage();
      if (!authenticatedUser?.id) {
        throw new Error('User not authenticated. Please log in first.');
      }

      const currentUserId = authenticatedUser.id.toString();
      setUserId(currentUserId);

            // Note: Remote stream callback already set up in early useEffect to prevent timing issues

      // Get local stream from video chat service
      try {
        const localVideoStream = cleanVideoChatService.getCurrentLocalStream();
        if (localVideoStream) {
          setLocalStream(localVideoStream);
        } else {
          // Try to get it after a short delay
          setTimeout(async () => {
            try {
              const delayedStream = cleanVideoChatService.getCurrentLocalStream();
              if (delayedStream) {
                setLocalStream(delayedStream);
              }
            } catch {
              // Silent error handling
            }
          }, 1000);
        }
      } catch {
        // Silent error handling
      }

      cleanVideoChatService.onConnectionStateChange((state) => {
        console.log('🔄 UI: Connection state changed to:', state);

        if (state === 'connected') {
          setConnectionState('connected');
          console.log('✅ UI: Connection state set to connected');

          // For live connections (not video), ensure local stream is available
          if (!isVideoPlaying && !localStream) {
            try {
              const currentLocalStream = cleanVideoChatService.getCurrentLocalStream();
              if (currentLocalStream) {
                setLocalStream(currentLocalStream);
                console.log('✅ UI: Local stream set');
              }
            } catch (error) {
              console.log('❌ UI: Error getting local stream:', error);
            }
          }
        } else if (state === 'failed' || state === 'disconnected') {
          setConnectionState('failed');
          console.log('❌ UI: Connection state set to failed');
        } else if (state === 'connecting') {
          setConnectionState('connecting');
          console.log('🔄 UI: Connection state set to connecting');
        }
      });

      cleanVideoChatService.onPartnerLeft(() => {
        setRemoteStream(null);
        setConnectionState('disconnected');
        setIsVideoPlaying(false);
        setCurrentVideoId(null);
        setCurrentVideoUrl(null);
        setCurrentVideoName(null);
        // Clear messages when partner leaves
        setMessages([]);

        // Stop tracking chat duration
        coinDeductionService.stopChatDurationTracking();
      });

      // Set up message listener
      cleanVideoChatService.onMessageReceived((message) => {
        // Additional safety check: ignore messages from ourselves that come via callback
        // This prevents seeing our own messages twice (once locally, once via PubNub)
        if (message.from === userId) {
          return;
        }

        // Check if this message is already in our local state to prevent duplicates
        const isDuplicate = messages.some(existingMsg => {
          // If both messages have IDs, compare by ID (most reliable)
          if (existingMsg.id && message.id && existingMsg.id === message.id) {
            return true;
          }
          // Otherwise, compare by content, sender, and timestamp
          return existingMsg.from === message.from &&
                 existingMsg.text === message.text &&
                 Math.abs(existingMsg.timestamp - message.timestamp) < 1000; // Within 1 second
        });

        if (isDuplicate) {
          return;
        }

        const chatMessage: ChatMessage = {
          from: message.from,
          text: message.text,
          timestamp: message.timestamp,
          id: message.id // Preserve the ID if it exists
        };
        setMessages(prev => [...prev, chatMessage]);
      });

      // Join the video chat queue
      try {
        await cleanVideoChatService.joinQueue();
        setIsInitialized(true);
      } catch {
        setError('Failed to join video chat queue');
        setIsConnecting(false);
        return;
      }

      // Get local stream after joining queue
      try {
        const currentLocalStream = cleanVideoChatService.getCurrentLocalStream();
        if (currentLocalStream) {
          setLocalStream(currentLocalStream);
        }
      } catch {
        // Silent error handling
      }

    } catch (err) {
      let errorMessage = 'Failed to initialize video chat';

      if (err instanceof Error) {
        if (err.message.includes('Camera access is required')) {
          errorMessage = 'Camera access is required for video chat. Please allow camera permissions and refresh the page.';
        } else if (err.message.includes('Camera permissions not granted')) {
          errorMessage = 'Camera permissions not granted. Please allow camera access in your browser settings and try again.';
        } else if (err.message.includes('getUserMedia not supported')) {
          errorMessage = 'Video chat is not supported in this browser. Please use a modern browser with camera support.';
        } else {
          errorMessage = err.message;
        }
      }

      setError(errorMessage);
      setIsInitialized(false);
    } finally {
      setIsConnecting(false);
    }
  }, [chatId, isInitialized, isConnecting, isClient, isVideoPlaying]);

  // Cleanup effect to stop tracking when component unmounts
  useEffect(() => {
    return () => {
      // Stop tracking chat duration when component unmounts
      coinDeductionService.stopChatDurationTracking();
    };
  }, []);

  // Initialize on client side
  useEffect(() => {
    if (isClient && !isInitialized && !isCheckingAuth) {
      // Add a small delay to ensure auth store is hydrated
      const timer = setTimeout(() => {
        initializeVideoChat();
      }, 500); // Wait 500ms for auth store to be ready

      return () => clearTimeout(timer);
    }
  }, [chatId, initializeVideoChat, isInitialized, isClient, isCheckingAuth]);

  // Periodic check for local stream
  useEffect(() => {
    if (!isClient || !isInitialized) return;

    const interval = setInterval(() => {
      if (!localStream) {
        try {
          const currentLocalStream = cleanVideoChatService.getCurrentLocalStream();
          if (currentLocalStream) {
            setLocalStream(currentLocalStream);
          }
        } catch {
          // Silent error handling
        }
      }
    }, 5000); // Check every 5 seconds

    return () => clearInterval(interval);
  }, [isClient, isInitialized, localStream]);

  // Update chat duration in real-time
  useEffect(() => {
    if (!isClient || !isInitialized) return;

    const durationInterval = setInterval(() => {
      // Chat duration tracking is handled by coin deduction service
      // but not displayed on the UI
    }, 1000);

    return () => clearInterval(durationInterval);
  }, [isClient, isInitialized]);


  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (isInitialized) {
        // Stop coin deduction tracking
        coinDeductionService.stopChatDurationTracking();

        // Cleanup video chat service
        cleanVideoChatService.cleanup();

        // Ensure waiting room is cleared on route change/unmount
        try { cleanVideoChatService.leaveWaitingRoom(); } catch {}
      }
    };
  }, [isInitialized]);

  // Scroll to bottom on new message
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const handleSend = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!input.trim() || !userId) return;

    const timestamp = Date.now();
    const messageId = `msg_${timestamp}_${Math.random().toString(36).substr(2, 9)}`;

    // Create user message
    const userMessage: ChatMessage = {
      from: userId,
      text: input.trim(),
      timestamp: timestamp,
      id: messageId
    };

    // Add user message to chat
    setMessages(prev => [...prev, userMessage]);

    // If matched with video, create a dummy response to simulate conversation
    if (isVideoPlaying && currentVideoId) {
      // Simulate a response after a short delay
      setTimeout(() => {
        const dummyResponses = [
          "That's interesting! Tell me more.",
          "I see what you mean.",
          "That's a great point!",
          "I'm listening...",
          "That's fascinating!",
          "I understand what you're saying.",
          "That makes sense to me.",
          "I'm here for you.",
          "That's really thoughtful.",
          "I appreciate you sharing that.",
          "That's a good perspective.",
          "I can relate to that.",
          "That's worth thinking about.",
          "You have a way with words.",
          "That's quite insightful.",
          "I'm glad you shared that.",
          "That's a beautiful thought.",
          "You're absolutely right.",
          "That's very considerate of you.",
          "I love how you think."
        ];

        const followUpQuestions = [
          "What made you think of that?",
          "How do you feel about it?",
          "What's your take on this?",
          "How does that relate to your life?",
          "What do you think happens next?",
          "How would you handle that situation?",
          "What's your experience with this?",
          "How do you see this playing out?",
          "What's your perspective on this?",
          "How does this affect you?"
        ];

        // 30% chance to ask a follow-up question
        const shouldAskQuestion = Math.random() < 0.3;
        const responsePool = shouldAskQuestion ? followUpQuestions : dummyResponses;
        const randomResponse = responsePool[Math.floor(Math.random() * responsePool.length)];

        const dummyMessage: ChatMessage = {
          from: 'video-partner',
          text: randomResponse,
          timestamp: Date.now(),
          id: `dummy_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
        };

        setMessages(prev => [...prev, dummyMessage]);
      }, 1000 + Math.random() * 2000); // Random delay between 1-3 seconds
    } else {
      // For real user matches, send via PubNub
      try {
        await cleanVideoChatService.sendMessage(input.trim());

      } catch (error) {
        console.error('Error sending message:', error);
        // You might want to show an error to the user here
      }
    }

    setInput("");
  };

  return (
    <div className="fixed inset-0 z-0 flex items-center justify-center bg-black/80">
      {/* Authentication Check Loading */}
      {isCheckingAuth && (
        <div className="text-center text-white">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-white mx-auto mb-4"></div>
          <p className="text-lg">Checking authentication...</p>
        </div>
      )}

      {/* Video Chat Interface - Only show when authenticated */}
      {!isCheckingAuth && (
        <>
          {/* Camera Permission Error Retry Button */}
          {error && error.includes('Camera') && (
        <div className="absolute top-4 left-1/2 transform -translate-x-1/2 z-50">
          <button
            onClick={() => {
              setError(null);
              setIsInitialized(false);
              initializeVideoChat();
            }}
            className="bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded-lg shadow-lg"
          >
            🔄 Retry Camera Access
          </button>
        </div>
      )}

      {/* Main video chat interface */}
      <div className="w-full h-full flex flex-col md:flex-row items-stretch justify-stretch p-0">

        <div
          className="gradient-border border md:border-[3px] w-full h-full flex flex-col md:flex-row overflow-hidden relative"
          onTouchStart={handleTouchStart}
          onTouchMove={handleTouchMove}
          onTouchEnd={handleTouchEnd}
        >
          {/* Left/User 1 - Remote User or Video */}
          <div className="h-[60%] md:flex-1 flex flex-col relative overflow-hidden md:h-full">
            <div className="w-full h-full">
              {(() => {

                if (isVideoPlaying && currentVideoId) {
                  return (
                    <VideoPlayer
                      videoId={currentVideoId}
                      videoUrl={currentVideoUrl || undefined}
                      videoName={currentVideoName || undefined}
                      onVideoEnd={handleVideoEnd}
                    />
                  );
                } else {
                  return (
                    <SplitVideoChat
                      chatId={chatId}
                      showRemote={true}
                      localStream={null}
                      remoteStream={remoteStream}
                      connectionState={connectionState}
                      isConnecting={isConnecting}
                      error={error}
                    />
                  );
                }
              })()}

              {/* Loading overlay when swiping */}
              {connectionState === 'connecting' && (
                <div className="absolute inset-0 bg-black/80 flex items-center justify-center z-20">
                  <div className="text-center text-white">
                    <div className="animate-spin rounded-full h-16 w-16 border-b-2 border-white mx-auto mb-4"></div>
                    <p className="text-lg">Finding your next match...</p>
                  </div>
                </div>
              )}
            </div>
            {/* Project logo (top left, only left panel) */}
            <div className="absolute top-4 left-4 z-10">
              <img src="/logo.png" alt="Logo" className="w-8 h-8" />
            </div>

            {/* Desktop: Left screen controls - Flag, Male, Female icons */}
            <div className="hidden md:flex flex-col gap-4 absolute top-4 right-4 z-10 items-end">
              <FlagButton
                reportedUserId={partnerId && partnerId !== 'video' ? partnerId : undefined}
                onReportSuccess={async () => {
                  console.log('User reported successfully - triggering swipe');
                  // Trigger swipe to next match after reporting
                  await handleSwipeToNext();
                }}
              />
              <MaleIcon />
              <FemaleIcon />
            </div>
          </div>

          {/* Divider with gradient border */}
          <div className="hidden md:flex items-stretch">
            <div className="w-[3px] h-full gradient-border border md:border-[3px] mx-0" />
          </div>
          <div className="flex md:hidden w-full">
            <div className="h-[3px] w-full gradient-border border md:border-[3px] my-0" />
          </div>

          {/* Right/User 2 - Self User */}
          <div className="h-[40%] md:flex-1 flex flex-col relative overflow-hidden md:h-full">
            <div className="w-full h-full">
              <SplitVideoChat
                chatId={chatId}
                showRemote={false}
                localStream={localStream}
                remoteStream={remoteStream}
                connectionState={connectionState}
                isConnecting={isConnecting}
                error={error}
              />
            </div>

            {/* Desktop: DiamondCountBar at top-right of right screen */}
            <div className="hidden md:block absolute top-3 right-4 z-10">
              <DiamondCountBar count={coinBalance} />
            </div>

            {/* Chat overlay/input */}
            <ChatInput
              messages={messagesForChatInput}
              input={input}
              setInput={setInput}
              handleSend={handleSend}
              chatEndRef={chatEndRef}
            />
          </div>

          {/* Swipe icon (desktop only, bottom center) */}
          <div className="hidden md:flex absolute left-1/5 bottom-10 z-20">
                        <button
              onClick={handleSwipeToNext}
              className="hover:scale-110 transition-transform duration-200"
            >
              <img src="/swipe.png" alt="Swipe" className="w-33 h-33 mx-auto" />
            </button>
          </div>
        </div>

        {/* Mobile Layout: DiamondCountBar, Flag, Male, Female icons stacked vertically */}
        <div className="md:hidden flex flex-col gap-4 absolute top-4 right-1 z-20 items-center">
          <DiamondCountBar count={coinBalance} />
          <div className="flex flex-col gap-4 items-end">
            <FlagButton
              reportedUserId={partnerId && partnerId !== 'video' ? partnerId : undefined}
              onReportSuccess={async () => {
                console.log('User reported successfully - triggering swipe');
                // Trigger swipe to next match after reporting
                await handleSwipeToNext();
              }}
            />
            <MaleIcon />
            <FemaleIcon />
          </div>
        </div>
      </div>
        </>
      )}
    </div>
  );
}
