'use client';

import React, { useEffect, useRef, useState, useCallback } from 'react';
import { videoChatService, VideoChatConnection } from '@/services/videoChatService';

interface VideoChatProps {
  chatId: string;
}

export const VideoChat: React.FC<VideoChatProps> = ({ chatId }) => {
  const [connection, setConnection] = useState<VideoChatConnection | null>(null);
  const [isConnecting, setIsConnecting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isInitialized, setIsInitialized] = useState(false);
  const [userId, setUserId] = useState<string>('');
  const [isClient, setIsClient] = useState(false);
  const [hasRemoteStream, setHasRemoteStream] = useState(false);

  const localVideoRef = useRef<HTMLVideoElement>(null);
  const remoteVideoRef = useRef<HTMLVideoElement>(null);

  // Check if we're on the client side
  useEffect(() => {
    setIsClient(true);
    console.log('🌐 Client-side detected');

    // Debug: Check service state
    console.log('🔍 VideoChatService state:', {
      isClient: videoChatService.isAvailable(),
      isInitialized: videoChatService.isAvailable()
    });
  }, []);

  const initializeVideoChat = useCallback(async () => {
    // Only run on client side
    if (!isClient) {
      console.log('⏳ Waiting for client-side initialization...');
      return;
    }

    // Prevent multiple initializations
    if (isInitialized || isConnecting) {
      console.log('🔄 VideoChat already initialized or connecting, skipping...');
      return;
    }

    try {
      setIsConnecting(true);
      setError(null);

      // Generate a random user ID if not already set
      let currentUserId = userId;
      if (!currentUserId) {
        currentUserId = `user-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
        setUserId(currentUserId);
        console.log('🆔 Generated random user ID:', currentUserId);
      }

      console.log('🚀 Initializing video chat for:', chatId);
      console.log('👤 User ID:', currentUserId);

      // Step 1: Set user credentials FIRST
      console.log('🔑 Setting user credentials...');
      videoChatService.setUserCredentials(currentUserId, 'fake-auth-token-for-testing');
      console.log('✅ User credentials set');

      // Step 2: NOW check if service is available
      if (!videoChatService.isAvailable()) {
        throw new Error('VideoChatService not available after setting credentials');
      }
      console.log('✅ VideoChatService is available');

      // Step 3: Create connection
      console.log('🔗 Creating video chat connection...');
      const newConnection = await videoChatService.createConnection(chatId);
      setConnection(newConnection);
      setIsInitialized(true);

      console.log('✅ Video chat initialized successfully');

    } catch (err) {
      console.error('❌ Error initializing video chat:', err);
      setError(err instanceof Error ? err.message : 'Failed to initialize video chat');
      setIsInitialized(false);
    } finally {
      setIsConnecting(false);
    }
  }, [chatId, isInitialized, isConnecting, userId, isClient]);

  useEffect(() => {
    // Only initialize on client side
    if (isClient && !isInitialized) {
      initializeVideoChat();
    }

    return () => {
      // Cleanup handled by service.cleanup()
    };
  }, [chatId, initializeVideoChat, connection, isInitialized, isClient]);

  // Handle local video stream
  useEffect(() => {
    if (connection?.localStream && localVideoRef.current) {
      localVideoRef.current.srcObject = connection.localStream;
      console.log('📹 Local video stream attached');
    }
  }, [connection?.localStream]);

  // Handle remote video stream
  useEffect(() => {
    if (connection?.remoteStream && remoteVideoRef.current) {
      remoteVideoRef.current.srcObject = connection.remoteStream;
      setHasRemoteStream(true);
      console.log('📹 Remote video stream attached');
    }
  }, [connection?.remoteStream]);

  // Listen for remote stream events
  useEffect(() => {
    const handleRemoteStream = (event: CustomEvent) => {
      console.log('📺 Remote stream event received:', event.detail);

      if (event.detail.chatId === chatId) {
        const updatedConnection = videoChatService.getConnection(chatId);
        if (updatedConnection) {
          setConnection({ ...updatedConnection });
        }
      }
    };

    window.addEventListener('remote-stream-received', handleRemoteStream as EventListener);

    return () => {
      window.removeEventListener('remote-stream-received', handleRemoteStream as EventListener);
    };
  }, [chatId]);

  if (error) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-center">
          <p className="text-red-500 mb-4">{error}</p>
          <button
            onClick={() => {
              setIsInitialized(false);
              setError(null);
              initializeVideoChat();
            }}
            className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  // Show both local and remote video
  return (
    <div className="w-full h-full relative bg-gray-900">
      {/* Main video (remote stream if available, otherwise local) */}
      <div className="w-full h-full">
        {hasRemoteStream && connection?.remoteStream ? (
          <video
            ref={remoteVideoRef}
            autoPlay
            playsInline
            className="w-full h-full object-cover"
          />
        ) : connection?.localStream ? (
          <video
            ref={localVideoRef}
            autoPlay
            playsInline
            muted
            className="w-full h-full object-cover"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center bg-gray-800">
            {isConnecting ? (
              <div className="text-center">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-white mx-auto mb-4"></div>
                <p className="text-white">Initializing video chat...</p>
              </div>
            ) : (
              <div className="text-center">
                <p className="text-gray-400 text-lg">Waiting for connection...</p>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Picture-in-picture local video when remote is showing */}
      {hasRemoteStream && connection?.localStream && (
        <div className="absolute bottom-4 right-4 w-32 h-24 bg-gray-800 rounded-lg overflow-hidden">
          <video
            ref={localVideoRef}
            autoPlay
            playsInline
            muted
            className="w-full h-full object-cover"
          />
        </div>
      )}

      {/* Connection status indicator */}
      <div className="absolute top-4 right-4">
        <div className={`flex items-center space-x-2 bg-black/50 rounded-full px-3 py-1`}>
          <div className={`w-2 h-2 rounded-full ${
            connection?.isConnected ? 'bg-green-500' : isConnecting ? 'bg-yellow-500' : 'bg-red-500'
          }`}></div>
          <span className="text-white text-xs">
            {connection?.isConnected ? 'Connected' : isConnecting ? 'Connecting' : 'Disconnected'}
          </span>
        </div>
      </div>

      {/* User info for debugging */}
      {userId && (
        <div className="absolute top-4 left-4 bg-black/50 text-white px-2 py-1 rounded text-xs">
          <div>User: {userId.substring(0, 15)}...</div>
          <div>Role: {connection?.isInitiator ? 'Initiator' : 'Receiver'}</div>
          <div>Remote: {hasRemoteStream ? 'Yes' : 'No'}</div>
        </div>
      )}
    </div>
  );
};
