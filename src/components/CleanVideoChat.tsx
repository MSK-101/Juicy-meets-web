'use client';

import React, { useState, useRef, useEffect } from 'react';
import { cleanVideoChatService } from '@/services/cleanVideoChatService';
import { nextSwipe } from '@/utils/swipeUtils';

export const CleanVideoChat: React.FC = () => {
  const [status, setStatus] = useState<'idle' | 'joining' | 'waiting' | 'connected' | 'error'>('idle');
  const [connectionState, setConnectionState] = useState<RTCPeerConnectionState>('new');
  const [error, setError] = useState<string | null>(null);

  const localVideoRef = useRef<HTMLVideoElement>(null);
  const remoteVideoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    // Set up event listeners
    cleanVideoChatService.onRemoteStream((stream) => {
      console.log('🎥 Remote stream received in component');
      if (remoteVideoRef.current) {
        remoteVideoRef.current.srcObject = stream;
      }
    });

    // Handle video matches (pre-recorded videos)
    cleanVideoChatService.onVideoMatch((videoData) => {
      console.log('🎥 Video match received:', videoData);

      // For video matches, set the video URL directly on the remote video element
      if (remoteVideoRef.current) {
        console.log('🎥 Setting video URL on remote video element:', videoData.videoUrl);

        // Clear any existing stream
        remoteVideoRef.current.srcObject = null;

        // Set the video URL directly
        remoteVideoRef.current.src = videoData.videoUrl;
        remoteVideoRef.current.load();

        // Play the video
        remoteVideoRef.current.play().then(() => {
          console.log('✅ Video started playing successfully');
          setStatus('connected');
        }).catch(error => {
          console.warn('⚠️ Could not autoplay video:', error);
          // Still set status to connected even if autoplay fails
          setStatus('connected');
        });
      }
    });

    cleanVideoChatService.onConnectionStateChange((state) => {
      console.log('🔗 Connection state changed:', state);
      if (state === 'disconnected') {
        //trigger swipe to next
        (async () => {
          await nextSwipe(
            setConnectionState,
            setError,
            () => {}, // setIsVideoPlaying - not needed in this component
            () => {}, // setCurrentVideoId - not needed in this component
            () => {}, // setCurrentVideoUrl - not needed in this component
            () => {}, // setCurrentVideoName - not needed in this component
            () => {}  // setMessages - not needed in this component
          );
        })();
      }
      setConnectionState(state);

      if (state === 'connected') {
        setStatus('connected');
      }
    });

    cleanVideoChatService.onPartnerLeft(() => {
      console.log('👋 Partner left');
      setStatus('idle');
      setError('Partner left the chat');
    });

    return () => {
      // Cleanup on unmount
      cleanVideoChatService.leaveChat();
    };
  }, []);

  const handleStart = async () => {
    setStatus('joining');
    setError(null);

    try {
      // Get local stream first
      const localStream = await cleanVideoChatService.getLocalStream();
      if (localVideoRef.current) {
        localVideoRef.current.srcObject = localStream;
      }

      // Join the queue
      await cleanVideoChatService.joinQueue();
      setStatus('waiting');
    } catch (err) {
      console.error('❌ Failed to start video chat:', err);
      setError(err instanceof Error ? err.message : 'Failed to start video chat');
      setStatus('error');
    }
  };

  const handleStop = async () => {
    try {
      await cleanVideoChatService.leaveChat();
      setStatus('idle');
      setError(null);

      // Clear video elements
      if (localVideoRef.current) {
        localVideoRef.current.srcObject = null;
      }
      if (remoteVideoRef.current) {
        remoteVideoRef.current.srcObject = null;
        remoteVideoRef.current.src = ''; // Clear video URL as well
      }
    } catch (err) {
      console.error('❌ Failed to stop video chat:', err);
    }
  };

  const renderStatus = () => {
    switch (status) {
      case 'idle':
        return (
          <div className="text-center p-8">
            <h2 className="text-2xl font-bold mb-4">Video Chat</h2>
            <p className="text-gray-600 mb-6">Connect with random people around the world</p>
            <button
              onClick={handleStart}
              className="bg-blue-500 hover:bg-blue-600 text-white px-8 py-3 rounded-lg font-semibold"
            >
              Start Chat
            </button>
          </div>
        );

      case 'joining':
        return (
          <div className="text-center p-8">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mx-auto mb-4"></div>
            <p className="text-gray-600">Getting your camera ready...</p>
          </div>
        );

      case 'waiting':
        return (
          <div className="text-center p-8">
            <div className="animate-pulse">
              <div className="h-4 w-4 bg-green-500 rounded-full mx-auto mb-4"></div>
            </div>
            <p className="text-gray-600 mb-4">Looking for someone to chat with...</p>
            <button
              onClick={handleStop}
              className="bg-red-500 hover:bg-red-600 text-white px-6 py-2 rounded-lg"
            >
              Cancel
            </button>
          </div>
        );

      case 'connected':
        return (
          <div className="text-center p-4">
            <p className="text-green-600 mb-2">✅ Connected!</p>
            <p className="text-sm text-gray-500 mb-4">Connection: {connectionState}</p>
            <button
              onClick={handleStop}
              className="bg-red-500 hover:bg-red-600 text-white px-6 py-2 rounded-lg"
            >
              End Chat
            </button>
          </div>
        );

      case 'error':
        return (
          <div className="text-center p-8">
            <p className="text-red-500 mb-4">❌ {error}</p>
            <button
              onClick={() => setStatus('idle')}
              className="bg-gray-500 hover:bg-gray-600 text-white px-6 py-2 rounded-lg"
            >
              Try Again
            </button>
          </div>
        );

      default:
        return null;
    }
  };

  return (
    <div className="flex flex-col h-screen bg-gray-900 text-white">
      {/* Video Area */}
      <div className="flex-1 flex">
        {/* Remote Video (Partner) */}
        <div className="flex-1 relative bg-gray-800">
          <video
            ref={remoteVideoRef}
            autoPlay
            playsInline
            className="w-full h-full object-cover"
          />
          {!remoteVideoRef.current?.srcObject && (
            <div className="absolute inset-0 flex items-center justify-center bg-gray-800">
              <p className="text-gray-400">Waiting for partner...</p>
            </div>
          )}
        </div>

        {/* Local Video (You) */}
        <div className="w-80 relative bg-gray-700">
          <video
            ref={localVideoRef}
            autoPlay
            playsInline
            muted
            className="w-full h-full object-cover"
          />
          <div className="absolute bottom-2 left-2 bg-black bg-opacity-50 px-2 py-1 rounded text-sm">
            You
          </div>
        </div>
      </div>

      {/* Controls */}
      <div className="bg-gray-800 border-t border-gray-700">
        {renderStatus()}
      </div>
    </div>
  );
};
