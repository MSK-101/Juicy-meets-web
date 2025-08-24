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
import { userService } from "@/api/services/userService";
import { coinDeductionService } from "@/services/coinDeductionService";

// Use imported ChatMessage interface

export default function VideoChatPage() {
  const params = useParams();
  const chatId = params.chat_id as string;
  const router = useRouter();

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
  }, []);

  // Check authentication and redirect if no user
  useEffect(() => {
    if (isClient) {
      const storedUser = userService.getUserFromLocalStorage();
      if (!storedUser) {
        console.log('❌ No authenticated user found, redirecting to homepage');
        router.push('/');
        return;
      }

      // User is authenticated, set user ID and coin balance
      setUserId(storedUser.id.toString());
      setCoinBalance(storedUser.coin_balance);
      setIsCheckingAuth(false);

      // Initialize deduction rules
      coinDeductionService.initializeDeductionRules().then(() => {
        // Deduction rules are loaded but not displayed
      }).catch(error => {
        console.error('❌ Failed to initialize deduction rules:', error);
      });
    }
  }, [isClient, router]);

  // Listen for coin deduction events
  useEffect(() => {
    if (!isClient) return;

    const handleCoinDeduction = (event: CustomEvent) => {
      const result = event.detail;

      // Update coin balance in frontend state
      setCoinBalance(result.new_balance);

      // Sync the new balance with localStorage
      userService.updateUserCoinBalance(result.new_balance);

      // Show notification for deduction
      if (result.deducted > 0) {
        // Deduction applied successfully - no notification needed
      }
    };

    const handleCoinDeductionError = () => {
      // Error occurred but no notification needed
    };

    window.addEventListener('coinDeductionApplied', handleCoinDeduction as EventListener);
    window.addEventListener('coinDeductionError', handleCoinDeductionError as EventListener);

    return () => {
      window.removeEventListener('coinDeductionApplied', handleCoinDeduction as EventListener);
      window.removeEventListener('coinDeductionError', handleCoinDeductionError as EventListener);
    };
  }, [isClient]);

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

      // Set up event listeners
      cleanVideoChatService.onRemoteStream((stream) => {
        setRemoteStream(stream);
        setConnectionState('connected');

        // Start tracking chat duration for coin deductions
        coinDeductionService.startChatDurationTracking();

        // Add welcome message when connection is established
        const welcomeMessage: ChatMessage = {
          from: 'system',
          text: '🎉 Video chat connected! You can now send messages.',
          timestamp: Date.now()
        };
        setMessages(prev => [...prev, welcomeMessage]);
      });

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
            } catch (error) {
              console.warn('⚠️ Could not get delayed local stream:', error);
            }
          }, 1000);
        }
      } catch (error) {
        console.warn('⚠️ Could not get local stream:', error);
      }

      cleanVideoChatService.onConnectionStateChange((state) => {
        if (state === 'connected') {
          setConnectionState('connected');
        } else if (state === 'failed' || state === 'disconnected') {
          setConnectionState('failed');
        }
      });

      cleanVideoChatService.onPartnerLeft(() => {
        setRemoteStream(null);
        setConnectionState('disconnected');
        // Clear messages when partner leaves
        setMessages([]);
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
      } catch (error) {
        console.error('❌ Failed to join video chat queue:', error);
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
      } catch (error) {
        console.warn('⚠️ Could not get local stream after joining queue:', error);
      }

    } catch (err) {
      console.error('❌ Error initializing video chat:', err);

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
  }, [chatId, isInitialized, isConnecting, isClient]);

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
        } catch (error) {
          console.warn('⚠️ Could not get local stream in periodic check:', error);
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
      }
    };
  }, [isInitialized]);

  // Scroll to bottom on new message
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const handleSend = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!input.trim()) return;

    const messageId = `${Date.now()}-${Math.random()}`;
    const newMessage: ChatMessage = {
      from: userId || 'unknown',
      text: input.trim(),
      timestamp: Date.now(),
      id: messageId, // Add unique ID for duplicate detection
    };

    // Add message locally immediately
    setMessages((prev) => [...prev, newMessage]);
    setInput("");

    try {
      // Send message via video chat service (which will send via PubNub)
      await cleanVideoChatService.sendMessage(input.trim());
    } catch (error) {
      console.error('❌ Failed to send message:', error);
      // Optionally remove the message from local state if sending failed
      setMessages((prev) => prev.filter(msg => msg.id !== messageId));
    }
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

      {/* Local Stream Refresh Button */}
      {!localStream && isInitialized && !error && (
        <div className="absolute top-4 left-1/2 transform -translate-x-1/2 z-50">
          <button
            onClick={async () => {
              try {
                const freshStream = await cleanVideoChatService.forceRefreshLocalStream();
                if (freshStream) {
                  setLocalStream(freshStream);
                }
              } catch (error) {
                console.warn('⚠️ Error refreshing local stream:', error);
              }
            }}
            className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg shadow-lg"
          >
            📹 Refresh Camera
          </button>
        </div>
      )}

      {/* Main video chat interface */}
      <div className="w-full h-full flex flex-col md:flex-row items-stretch justify-stretch p-0">
        <div className="gradient-border border md:border-[3px] w-full h-full flex flex-col md:flex-row overflow-hidden relative">
          {/* Left/User 1 - Remote User */}
          <div className="h-[60%] md:flex-1 flex flex-col relative overflow-hidden md:h-full">
            <div className="w-full h-full">
              <SplitVideoChat
                chatId={chatId}
                showRemote={true}
                localStream={null}
                remoteStream={remoteStream}
                connectionState={connectionState}
                isConnecting={isConnecting}
                error={error}
              />
            </div>
            {/* Project logo (top left, only left panel) */}
            <div className="absolute top-4 left-4 z-10">
              <img src="/logo.png" alt="Logo" className="w-8 h-8" />
            </div>

            {/* Desktop: Left screen controls - Flag, Male, Female icons */}
            <div className="hidden md:flex flex-col gap-4 absolute top-4 right-4 z-10 items-end">
              <FlagButton />
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
            <button>
              <img src="/swipe.png" alt="Swipe" className="w-33 h-33 mx-auto" />
            </button>
          </div>
        </div>

        {/* Mobile Layout: DiamondCountBar, Flag, Male, Female icons stacked vertically */}
        <div className="md:hidden flex flex-col gap-4 absolute top-4 right-1 z-20 items-center">
          <DiamondCountBar count={coinBalance} />
          <div className="flex flex-col gap-4 items-end">
            <FlagButton />
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
