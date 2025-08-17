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
      localVideoRef.current.srcObject = localStream;
    }
  }, [localStream]);

  // Handle remote video stream
  useEffect(() => {
    console.log('🔄 Remote stream effect triggered:', !!remoteStream, !!remoteVideoRef.current);

    if (!remoteStream) {
      console.log('⚠️ No remote stream available');
      setHasRemoteStream(false);
      return;
    }

    const assignStream = () => {
      if (remoteVideoRef.current) {
        console.log('📺 Setting remote stream on video element');
        console.log('📺 Remote stream tracks:', remoteStream.getTracks().length);
        remoteVideoRef.current.srcObject = remoteStream;
        setHasRemoteStream(true);
        console.log('✅ Remote video element srcObject set');
        return true;
      }
      return false;
    };

    // Try immediate assignment
    if (assignStream()) {
      return;
    }

    // If video ref not ready, wait a bit and retry
    console.log('⏳ Video ref not ready, retrying in 100ms...');
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
      <div className="w-full h-full relative bg-gray-900">
        {hasRemoteStream && remoteStream ? (
          <video
            ref={remoteVideoRef}
            autoPlay
            playsInline
            className="w-full h-full object-cover"
          />
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
    <div className="w-full h-full relative bg-gray-900">
      {localStream ? (
        <video
          ref={localVideoRef}
          autoPlay
          playsInline
          muted
          className="w-full h-full object-cover"
        />
      ) : (
        <div className="w-full h-full flex items-center justify-center bg-gray-800">
          {connectionState === 'connecting' || isConnecting ? (
            <div className="text-center">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-white mx-auto mb-4"></div>
              <p className="text-white">Initializing camera...</p>
            </div>
          ) : (
            <p className="text-gray-400">Camera not available</p>
          )}
        </div>
      )}
    </div>
  );
};
