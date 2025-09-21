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
  const localVideoRef = useRef<HTMLVideoElement>(null);
  const remoteVideoRef = useRef<HTMLVideoElement>(null);

  // Handle local video stream - SIMPLE
  useEffect(() => {
    if (localStream && localVideoRef.current) {
      localVideoRef.current.srcObject = localStream;
      localVideoRef.current.play().catch(() => {});
    }
  }, [localStream]);

  // Handle remote video stream - SIMPLE
  useEffect(() => {
    if (remoteStream && remoteVideoRef.current) {
      console.log('📺 SplitVideoChat: Assigning remote stream tracks:', remoteStream.getTracks().length);
      remoteVideoRef.current.srcObject = remoteStream;
      remoteVideoRef.current.play().catch(() => {});
      console.log('✅ SplitVideoChat: Remote stream assigned');
    } else if (!remoteStream && remoteVideoRef.current) {
      console.log('📺 SplitVideoChat: Clearing remote stream');
      remoteVideoRef.current.srcObject = null;
    }
  }, [remoteStream]);


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
        {remoteStream ? (
          <div className="w-full h-full relative">
            <video
              ref={remoteVideoRef}
              autoPlay
              playsInline
              muted={false}
              controls={false}
              disablePictureInPicture
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
            controls={false}
            disablePictureInPicture
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
