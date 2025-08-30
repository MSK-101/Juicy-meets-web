'use client';

import React, { useEffect, useRef, useState } from 'react';

interface SplitVideoChatProps {
  chatId: string;
  showRemote: boolean; // true for left side (remote), false for right side (local)
  localStream: MediaStream | null;
  remoteStream: MediaStream | null;
  connectionState: 'disconnected' | 'connecting' | 'connected' | 'failed';
  isConnecting: boolean;
  error: string | null;
}

export const SplitVideoChat: React.FC<SplitVideoChatProps> = ({
  chatId,
  showRemote,
  localStream,
  remoteStream,
  connectionState,
  isConnecting,
  error
}) => {
  const [hasRemoteStream, setHasRemoteStream] = useState(false);

  const localVideoRef = useRef<HTMLVideoElement>(null);
  const remoteVideoRef = useRef<HTMLVideoElement>(null);

  // Handle local video stream
  useEffect(() => {
    if (localStream && localVideoRef.current) {
      try {
        localVideoRef.current.srcObject = localStream;
        // Force video element to load
        localVideoRef.current.load();

        // Ensure video plays
        localVideoRef.current.play().then(() => {
          console.log('✅ Local video started playing successfully');
        }).catch(error => {
          console.warn('⚠️ Could not autoplay local video:', error);
        });

      } catch (error) {
        console.error('❌ Error setting local stream on video element:', error);
      }
    } else if (localStream) {
      // Wait a bit and try again
      setTimeout(() => {
        if (localStream && localVideoRef.current) {
          console.log('🔄 Retrying to set local stream after delay...');
          try {
            localVideoRef.current.srcObject = localStream;
            localVideoRef.current.load();
            localVideoRef.current.play().catch(console.warn);
            console.log('✅ Local stream set on retry');
          } catch (error) {
            console.error('❌ Error on retry:', error);
          }
        }
      }, 100);
    } else {
      console.log('⚠️ No local stream available');
    }
  }, [localStream]);

  // Handle remote video stream
  useEffect(() => {
    if (!remoteStream) {
      console.log('⚠️ No remote stream available');
      setHasRemoteStream(false);
      return;
    }

    const assignStream = () => {
      if (remoteVideoRef.current) {
        console.log('📺 Setting remote stream on video element');
        console.log('📺 Remote stream tracks:', remoteStream.getTracks().length);

        try {
          remoteVideoRef.current.srcObject = remoteStream;
          // Force video element to load
          remoteVideoRef.current.load();

          // Ensure video plays
          remoteVideoRef.current.play().then(() => {
            console.log('✅ Remote video started playing successfully');
          }).catch(error => {
            console.warn('⚠️ Could not autoplay remote video:', error);
          });

          setHasRemoteStream(true);
          return true;
        } catch (error) {
          console.error('❌ Error setting remote stream on video element:', error);
          return false;
        }
      }
      return false;
    };

    // Try immediate assignment
    if (assignStream()) {
      return;
    }

    // If video ref not ready, wait a bit and retry
    const retryTimeout = setTimeout(() => {
      if (assignStream()) {
        console.log('✅ Remote stream assigned on retry');
      } else {
        console.log('❌ Failed to assign remote stream after retry');
        setHasRemoteStream(false);
      }
    }, 100);

    return () => clearTimeout(retryTimeout);
  }, [remoteStream]);

  // Update remote stream availability when stream changes
  useEffect(() => {
    setHasRemoteStream(!!remoteStream);
  }, [remoteStream]);

  // Use chatId for logging context
  useEffect(() => {
    if (showRemote) {
      console.log(`📺 Remote video component initialized for chat: ${chatId}`);
    } else {
      console.log(`📹 Local video component initialized for chat: ${chatId}`);
    }
  }, [chatId, showRemote]);

  if (error) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-center">
          <p className="text-red-500 mb-4">{error}</p>
          <button
            onClick={() => {
              window.location.reload();
            }}
            className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  // Show remote video on left side
  if (showRemote) {
    return (
      <div className="w-full h-full relative bg-gray-900 border-2 border-red-500">
        {hasRemoteStream && remoteStream ? (
          <div className="w-full h-full relative">
            <video
              ref={remoteVideoRef}
              autoPlay
              playsInline
              className="w-full h-full object-cover"
            />
          </div>
        ) : (
          <div className="w-full h-full flex items-center justify-center bg-gray-800">
            {connectionState === 'connecting' || isConnecting ? (
              <div className="text-center">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-white mx-auto mb-4"></div>
                <p className="text-white">Looking for someone to chat with...</p>
              </div>
            ) : connectionState === 'connected' ? (
              <div className="text-center">
                <p className="text-gray-400 text-lg">Partner video loading...</p>
              </div>
            ) : (
              <div className="text-center">
                <p className="text-gray-400 text-lg">Waiting for connection...</p>
              </div>
            )}
          </div>
        )}
      </div>
    );
  }

  // Show local video on right side
  return (
    <div className="w-full h-full relative bg-gray-900 border-2 border-blue-500">
      {localStream ? (
        <div className="w-full h-full relative">
          <video
            ref={localVideoRef}
            autoPlay
            playsInline
            muted
            className="w-full h-full object-cover"
          />
        </div>
      ) : (
        <div className="w-full h-full flex items-center justify-center bg-gray-800">
          {connectionState === 'connecting' || isConnecting ? (
            <div className="text-center">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-white mx-auto mb-4"></div>
              <p className="text-white">Initializing camera...</p>
            </div>
          ) : (
            <div className="text-center">
              <p className="text-gray-400">Camera not available</p>
              <p className="text-gray-500 text-sm mt-2">Stream: {localStream ? 'Present' : 'Missing'}</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
