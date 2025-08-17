'use client';

import React, { useState } from 'react';
import { VideoChat } from '@/components/VideoChat';
import { VideoChatDebug } from '@/components/VideoChatDebug';

export default function VideoTestPage() {
  const [chatId, setChatId] = useState('test-chat-123');
  const [showVideo, setShowVideo] = useState(false);

  return (
    <div className="min-h-screen bg-gray-900 p-8">
      <div className="max-w-6xl mx-auto">
        <h1 className="text-3xl font-bold text-white mb-8">Video Chat Test</h1>

        <div className="bg-gray-800 rounded-lg p-6 mb-6">
          <h2 className="text-xl font-semibold text-white mb-4">Test Configuration</h2>

          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                Chat ID:
              </label>
              <input
                type="text"
                value={chatId}
                onChange={(e) => setChatId(e.target.value)}
                className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-md text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="Enter chat ID"
              />
            </div>

            <div className="flex space-x-4">
              <button
                onClick={() => setShowVideo(true)}
                className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                Start Video Chat
              </button>

              <button
                onClick={() => setShowVideo(false)}
                className="px-4 py-2 bg-gray-600 text-white rounded-md hover:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-gray-500"
              >
                Stop Video Chat
              </button>
            </div>
          </div>
        </div>

        {showVideo && (
          <div className="bg-gray-800 rounded-lg p-4">
            <h3 className="text-lg font-semibold text-white mb-4">Video Chat</h3>
            <div className="aspect-video bg-gray-900 rounded-lg overflow-hidden">
              <VideoChat chatId={chatId} />
            </div>
          </div>
        )}

        <div className="bg-gray-800 rounded-lg p-6 mt-6">
          <h2 className="text-xl font-semibold text-white mb-4">Testing Instructions</h2>
          <div className="text-gray-300 space-y-2">
            <p>1. Open this page in two different browser tabs/windows</p>
            <p>2. Use the same Chat ID in both tabs</p>
            <p>3. Click "Start Video Chat" in both tabs</p>
            <p>4. Allow camera and microphone access when prompted</p>
            <p>5. You should see your local video initially, then remote video when both users connect</p>
            <p>6. Check the browser console for detailed connection logs</p>
          </div>
        </div>

        <div className="bg-gray-800 rounded-lg p-6 mt-6">
          <h2 className="text-xl font-semibold text-white mb-4">Debug Information</h2>
          <div className="text-gray-300 space-y-2">
            <p>• Chat ID: {chatId}</p>
            <p>• Backend: Not required (PubNub handles everything)</p>
            <p>• PubNub Keys: Configured</p>
            <p>• STUN Servers: Google STUN servers</p>
          </div>
        </div>

        <div className="mt-6">
          <VideoChatDebug />
        </div>
      </div>
    </div>
  );
}
