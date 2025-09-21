'use client';

import React, { useState, useEffect } from 'react';
import { videoChatService } from '@/services/videoChatService';
import { pubnubService } from '@/services/pubnubService';

export const VideoChatDebug: React.FC = () => {
  const [debugInfo, setDebugInfo] = useState<any>({});
  const [logs, setLogs] = useState<string[]>([]);
  const [testChatId, setTestChatId] = useState('debug-chat-123');

  useEffect(() => {
    const updateDebugInfo = () => {
      setDebugInfo({
        videoChatService: {
          isAvailable: videoChatService.isAvailable(),
          currentUserId: videoChatService.getCurrentUserId(),
          connectionsCount: (videoChatService as any).connections?.size || 0
        },
        pubnubService: {
          // TODO: Implement missing methods
          // isClientSide: pubnubService.isClientSide(),
          // currentUser: (pubnubService as any).currentUser,
          // currentChatId: (pubnubService as any).currentChatId,
          // onlineUsers: (pubnubService as any).onlineUsers ? Array.from((pubnubService as any).onlineUsers) : []
          isClientSide: false,
          currentUser: null,
          currentChatId: null,
          onlineUsers: []
        }
      });
    };

    updateDebugInfo();
    const interval = setInterval(updateDebugInfo, 1000);
    return () => clearInterval(interval);
  }, []);

  const addLog = (message: string) => {
    setLogs(prev => [...prev, `${new Date().toLocaleTimeString()}: ${message}`]);
  };

  const testConnection = async () => {
    try {
      addLog('🔧 Testing video chat connection...');

      // Generate test user
      const userId = `test-user-${Date.now()}`;
      addLog(`👤 Generated test user: ${userId}`);

      // Set credentials
      videoChatService.setUserCredentials(userId, 'test-auth-token');
      addLog('🔑 Set user credentials');

      // Create connection
      const connection = await videoChatService.createConnection(testChatId);
      addLog(`✅ Connection created: ${connection.id}`);

      // Debug connections
      // TODO: Implement debugConnections method
      // videoChatService.debugConnections();
      // addLog('🔍 Debug info logged to console');
      addLog('🔍 Debug connections not yet implemented');

    } catch (error) {
      addLog(`❌ Error: ${error instanceof Error ? error.message : String(error)}`);
    }
  };

  const resetConnection = () => {
    try {
      // TODO: Implement forceResetConnection method
      // videoChatService.forceResetConnection(testChatId);
      // addLog('🔄 Connection reset');
      addLog('🔄 Connection reset not yet implemented');
    } catch (error) {
      addLog(`❌ Reset error: ${error instanceof Error ? error.message : String(error)}`);
    }
  };

  const testPubNub = async () => {
    try {
      addLog('🔧 Testing PubNub connection...');

      // TODO: Implement missing methods
      // const userId = `pubnub-test-${Date.now()}`;
      // await pubnubService.connect(userId, testChatId);
      // addLog('✅ PubNub connected');

      // await pubnubService.announcePresence();
      // addLog('📢 Presence announced');

      // const onlineUsers = await pubnubService.getOnlineUsers();
      // addLog(`👥 Online users: ${onlineUsers.join(', ')}`);

      addLog('⚠️ PubNub methods not yet implemented');

    } catch (error) {
      addLog(`❌ PubNub error: ${error instanceof Error ? error.message : String(error)}`);
    }
  };

  const clearLogs = () => {
    setLogs([]);
  };

  return (
    <div className="bg-gray-800 rounded-lg p-6 text-white">
      <h2 className="text-xl font-semibold mb-4">Video Chat Debug Panel</h2>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-6">
        <div className="bg-gray-700 p-4 rounded">
          <h3 className="font-semibold mb-2">Video Chat Service</h3>
          <div className="text-sm space-y-1">
            <p>Available: {debugInfo.videoChatService?.isAvailable ? '✅' : '❌'}</p>
            <p>User ID: {debugInfo.videoChatService?.currentUserId || 'None'}</p>
            <p>Connections: {debugInfo.videoChatService?.connectionsCount || 0}</p>
          </div>
        </div>

        <div className="bg-gray-700 p-4 rounded">
          <h3 className="font-semibold mb-2">PubNub Service</h3>
          <div className="text-sm space-y-1">
            <p>Client Side: {debugInfo.pubnubService?.isClientSide ? '✅' : '❌'}</p>
            <p>User: {debugInfo.pubnubService?.currentUser || 'None'}</p>
            <p>Chat ID: {debugInfo.pubnubService?.currentChatId || 'None'}</p>
            <p>Online Users: {debugInfo.pubnubService?.onlineUsers?.length || 0}</p>
          </div>
        </div>

      </div>

      <div className="mb-4">
        <label className="block text-sm font-medium mb-2">Test Chat ID:</label>
        <input
          type="text"
          value={testChatId}
          onChange={(e) => setTestChatId(e.target.value)}
          className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded text-white"
        />
      </div>

      <div className="flex flex-wrap gap-2 mb-4">
        <button
          onClick={testConnection}
          className="px-4 py-2 bg-blue-600 rounded hover:bg-blue-700"
        >
          Test Video Chat
        </button>

        <button
          onClick={testPubNub}
          className="px-4 py-2 bg-green-600 rounded hover:bg-green-700"
        >
          Test PubNub
        </button>

        <button
          onClick={resetConnection}
          className="px-4 py-2 bg-yellow-600 rounded hover:bg-yellow-700"
        >
          Reset Connection
        </button>

        <button
          onClick={clearLogs}
          className="px-4 py-2 bg-gray-600 rounded hover:bg-gray-700"
        >
          Clear Logs
        </button>
      </div>

      <div className="bg-gray-900 p-4 rounded max-h-64 overflow-y-auto">
        <h3 className="font-semibold mb-2">Debug Logs:</h3>
        {logs.length === 0 ? (
          <p className="text-gray-400">No logs yet. Run a test to see activity.</p>
        ) : (
          <div className="text-sm space-y-1">
            {logs.map((log, index) => (
              <div key={index} className="text-gray-300 font-mono">
                {log}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
