'use client';

import React, { useEffect, useState } from 'react';
import { videoChatService } from '@/services/videoChatService';
import { pubnubService } from '@/services/pubnubService';

export default function DebugVideoPage() {
  const [chatId] = useState('debug-test');
  const [userId, setUserId] = useState('');
  const [connectionInfo, setConnectionInfo] = useState<any>(null);
  const [onlineUsers, setOnlineUsers] = useState<string[]>([]);
  const [isInitialized, setIsInitialized] = useState(false);

  useEffect(() => {
    // Generate unique user ID
    const newUserId = `debug-user-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    setUserId(newUserId);
  }, []);

  const initializeConnection = async () => {
    if (!userId) return;

    try {
      console.log('🚀 Initializing debug connection...');

      // Set credentials
      videoChatService.setUserCredentials(userId, 'debug-token');

      // Create connection
      await videoChatService.createConnection(chatId);
      setIsInitialized(true);

      console.log('✅ Debug connection initialized');
    } catch (error) {
      console.error('❌ Error initializing debug connection:', error);
    }
  };

  const refreshInfo = () => {
    const info = videoChatService.getConnectionDebugInfo(chatId);
    setConnectionInfo(info);

    // Get online users
    pubnubService.getOnlineUsers().then(users => {
      setOnlineUsers(users);
    });
  };

  const forcePresenceSync = async () => {
    await pubnubService.forcePresenceSync();
    setTimeout(refreshInfo, 1000);
  };

  useEffect(() => {
    if (isInitialized) {
      const interval = setInterval(refreshInfo, 2000);
      return () => clearInterval(interval);
    }
  }, [isInitialized]);

  // Update video elements when streams change
  useEffect(() => {
    if (connectionInfo && isInitialized) {
      const connection = videoChatService.getConnection(chatId);
      if (connection) {
        // Update local video
        const localVideo = document.getElementById('localVideo') as HTMLVideoElement;
        if (localVideo && connection.localStream) {
          localVideo.srcObject = connection.localStream;
        }

        // Update remote video
        const remoteVideo = document.getElementById('remoteVideo') as HTMLVideoElement;
        if (remoteVideo && connection.remoteStream) {
          remoteVideo.srcObject = connection.remoteStream;
        }
      }
    }
  }, [connectionInfo, isInitialized, chatId]);

  return (
    <div className="min-h-screen bg-gray-900 text-white p-8">
      <h1 className="text-3xl font-bold mb-8">Video Chat Debug Page</h1>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Controls */}
        <div className="bg-gray-800 p-6 rounded-lg">
          <h2 className="text-xl font-semibold mb-4">Controls</h2>

          <div className="space-y-4">
            <div>
              <strong>User ID:</strong> {userId}
            </div>
            <div>
              <strong>Chat ID:</strong> {chatId}
            </div>

            <button
              onClick={initializeConnection}
              disabled={isInitialized || !userId}
              className="px-4 py-2 bg-blue-600 text-white rounded disabled:opacity-50"
            >
              {isInitialized ? 'Initialized' : 'Initialize Connection'}
            </button>

            <button
              onClick={refreshInfo}
              disabled={!isInitialized}
              className="px-4 py-2 bg-green-600 text-white rounded disabled:opacity-50 ml-2"
            >
              Refresh Info
            </button>

            <button
              onClick={forcePresenceSync}
              disabled={!isInitialized}
              className="px-4 py-2 bg-yellow-600 text-white rounded disabled:opacity-50 ml-2"
            >
              Force Presence Sync
            </button>
          </div>
        </div>

        {/* Connection Info */}
        <div className="bg-gray-800 p-6 rounded-lg">
          <h2 className="text-xl font-semibold mb-4">Connection Info</h2>

          <div className="space-y-2 text-sm">
            <div>
              <strong>Online Users ({onlineUsers.length}):</strong> {onlineUsers.join(', ')}
            </div>

            {connectionInfo && (
              <div className="mt-4">
                <h3 className="font-semibold mb-2">Connection Details:</h3>
                <pre className="bg-gray-700 p-3 rounded text-xs overflow-auto">
                  {JSON.stringify(connectionInfo, null, 2)}
                </pre>
              </div>
            )}
          </div>
        </div>

        {/* Videos */}
        <div className="lg:col-span-2 bg-gray-800 p-6 rounded-lg">
          <h2 className="text-xl font-semibold mb-4">Video Streams</h2>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <h3 className="font-semibold mb-2">Local Video</h3>
              <video
                id="localVideo"
                autoPlay
                playsInline
                muted
                className="w-full h-48 bg-gray-700 rounded"
              />
            </div>

            <div>
              <h3 className="font-semibold mb-2">Remote Video</h3>
              <video
                id="remoteVideo"
                autoPlay
                playsInline
                className="w-full h-48 bg-gray-700 rounded"
              />
            </div>
          </div>
        </div>
      </div>

      {/* Instructions */}
      <div className="mt-8 bg-blue-900 p-6 rounded-lg">
        <h2 className="text-xl font-semibold mb-4">Debug Instructions</h2>
        <ol className="list-decimal list-inside space-y-2">
          <li>Open this page in two different browser windows/tabs</li>
          <li>Click "Initialize Connection" in both windows</li>
          <li>Watch the Connection Info to see what happens</li>
          <li>Use "Force Presence Sync" if users don't appear</li>
          <li>Check browser console for detailed logs</li>
        </ol>
      </div>
    </div>
  );
}
