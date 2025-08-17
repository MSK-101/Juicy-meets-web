"use client";
import React, { useState, useRef, useEffect, useCallback } from "react";
import { useParams } from "next/navigation";
import { SplitVideoChat } from "@/components/SplitVideoChat";
import { cleanVideoChatService } from "@/services/cleanVideoChatService";
import DiamondCountBar from "../components/DiamondCountBar";
import ChatInput from "../components/ChatInput";
import FlagButton from "../components/FlagButton";
import MaleIcon from "../components/MaleIcon";
import FemaleIcon from "../components/FemaleIcon";

// Define the message type
interface ChatMessage {
  sender: string;
  text: string;
}

export default function VideoChatPage() {
  const params = useParams();
  const chatId = params.chat_id as string;

  // Start with empty chat
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const chatEndRef = useRef<HTMLDivElement>(null);

  // Clean video chat state
  const [localStream, setLocalStream] = useState<MediaStream | null>(null);
  const [remoteStream, setRemoteStream] = useState<MediaStream | null>(null);
  const [connectionState, setConnectionState] = useState<'disconnected' | 'connecting' | 'connected' | 'failed'>('disconnected');
  const [isConnecting, setIsConnecting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isInitialized, setIsInitialized] = useState(false);
  const [userId, setUserId] = useState<string>('');
  const [isClient, setIsClient] = useState(false);

  // Check if we're on the client side
  useEffect(() => {
    setIsClient(true);
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

      // Generate a random user ID if not already set
      let currentUserId = userId;
      if (!currentUserId) {
        currentUserId = `user-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
        setUserId(currentUserId);
        console.log('🆔 Generated user ID for page:', currentUserId);
      }

      console.log('🚀 Initializing clean video chat for page:', chatId);

      // Set up event listeners
      cleanVideoChatService.onRemoteStream((stream) => {
        console.log('📺 Remote stream received on page');
        setRemoteStream(stream);
        setConnectionState('connected');
      });

      cleanVideoChatService.onConnectionStateChange((state) => {
        console.log('🔗 Connection state changed on page:', state);
        if (state === 'connected') {
          setConnectionState('connected');
        } else if (state === 'failed' || state === 'disconnected') {
          setConnectionState('failed');
        }
      });

      cleanVideoChatService.onPartnerLeft(() => {
        console.log('👋 Partner left on page');
        setRemoteStream(null);
        setConnectionState('disconnected');
      });

      // Start video chat by joining queue
      await cleanVideoChatService.joinQueue();

      // Get local stream (this will create it if needed)
      const stream = await cleanVideoChatService.getLocalStream();
      setLocalStream(stream);
      setIsInitialized(true);

      console.log('✅ Clean video chat initialized successfully on page');

    } catch (err) {
      console.error('❌ Error initializing clean video chat on page:', err);
      setError(err instanceof Error ? err.message : 'Failed to initialize video chat');
      setConnectionState('failed');
      setIsInitialized(false);
    } finally {
      setIsConnecting(false);
    }
  }, [chatId, isInitialized, isConnecting, userId, isClient]);

  // Initialize on client side
  useEffect(() => {
    if (isClient && !isInitialized) {
      initializeVideoChat();
    }
  }, [chatId, initializeVideoChat, isInitialized, isClient]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (isInitialized) {
        console.log('🧹 Cleaning up video chat on page unmount');
        cleanVideoChatService.leaveChat();
      }
    };
  }, [isInitialized]);

  // Scroll to bottom on new message
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  function handleSend(e?: React.FormEvent) {
    if (e) e.preventDefault();
    if (!input.trim()) return;
    setMessages((prev) => {
      return [...prev, { sender: "you", text: input.trim() }];
    });
    setInput("");
  }

  return (
    <div className="fixed inset-0 z-0 flex items-center justify-center bg-black/80">
      <div className="w-full h-full flex flex-col md:flex-row items-stretch justify-stretch p-0">
        <div className="gradient-border border md:border-[3px] w-full h-full flex flex-col md:flex-row overflow-hidden relative">
          {/* Left/User 1 - Remote User */}
          <div className="flex-1 flex flex-col relative overflow-hidden">
            <div className="w-full h-full">
              <SplitVideoChat
                chatId={chatId}
                showRemote={true}
                localStream={localStream}
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
          <div className="flex-1 flex flex-col relative overflow-hidden">
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
              <DiamondCountBar count={3900} />
            </div>

            {/* Chat overlay/input */}
            <ChatInput
              messages={messages}
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
          <DiamondCountBar count={39000} />
          <div className="flex flex-col gap-4 items-end">
            <FlagButton />
            <MaleIcon />
            <FemaleIcon />
          </div>
        </div>
      </div>
    </div>
  );
}
