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

    // SIMPLE AND DIRECT: Just assign the stream immediately
    if (remoteVideoRef.current && remoteStream) {
      console.log('📺 Setting remote stream on video element');
      console.log('📺 Remote stream tracks:', remoteStream.getTracks().length);
      console.log('📺 Remote stream active:', remoteStream.active);

      try {
        // Direct assignment - no complex logic
        remoteVideoRef.current.srcObject = remoteStream;

        // Force video to load and play
        remoteVideoRef.current.load();

        // Set state immediately
        setHasRemoteStream(true);

        // Force play after a short delay
        setTimeout(() => {
          if (remoteVideoRef.current) {
            remoteVideoRef.current.play().catch(e =>
              console.log('⚠️ Autoplay failed (normal):', e)
            );
          }
        }, 100);

        console.log('✅ Remote stream assigned successfully');
        return;
      } catch (error) {
        console.error('❌ Error setting remote stream:', error);
        setHasRemoteStream(false);
      }
    }

    // If video ref not ready, wait and retry once
    const retryTimeout = setTimeout(() => {
      if (remoteVideoRef.current && remoteStream) {
        console.log('📺 Retry: Setting remote stream on video element');
        remoteVideoRef.current.srcObject = remoteStream;
        setHasRemoteStream(true);
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
    console.log('🔄 Remote stream changed:', {
      hasStream: !!remoteStream,
      streamActive: remoteStream?.active,
      trackCount: remoteStream?.getTracks().length,
      videoTracks: remoteStream?.getVideoTracks().length,
      audioTracks: remoteStream?.getAudioTracks().length
    });
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
          <div className="w-full h-full relative">
            <video
              ref={remoteVideoRef}
              autoPlay
              playsInline
              muted={false}
              className="w-full h-full object-cover"
            />
            {/* Simple debug info */}
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
              <div className="absolute inset-0 bg-black/80 flex items-center justify-center z-20">
                  <div className="text-center text-white">
                    <div className="animate-spin rounded-full h-16 w-16 border-b-2 border-white mx-auto mb-4"></div>
                    <p className="text-lg">Finding your next match...</p>
                  </div>
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
