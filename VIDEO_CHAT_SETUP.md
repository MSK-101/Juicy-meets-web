# Video Chat Local Setup Guide

This guide will help you set up and test the video chat functionality locally.

## Prerequisites

1. **Next.js Frontend** - Must be running on port 3001
2. **Camera and Microphone** - Required for WebRTC functionality
3. **Modern Browser** - Chrome, Firefox, Safari, or Edge with WebRTC support
4. **Internet Connection** - Required for PubNub communication

## Environment Variables

Make sure your `.env.local` file contains the following variables:

```bash
# PubNub Configuration (free demo keys)
NEXT_PUBLIC_PUBNUB_PUBLISH_KEY=pub-c-796ad0ea-9bff-4bbf-be5e-b269b3fe0325
NEXT_PUBLIC_PUBNUB_SUBSCRIBE_KEY=sub-c-7da9e1d6-9659-4ec5-ab27-d83f2b3d4e7c



# STUN Servers (Google's free STUN servers)
NEXT_PUBLIC_STUN_URL=stun:stun.l.google.com:19302
NEXT_PUBLIC_STUN_URL_2=stun:stun1.l.google.com:19302

# API Configuration
NEXT_PUBLIC_API_URL=http://localhost:3000/api/v1
```

## Starting the Services

### 1. Start Next.js Frontend (Only Frontend Needed)

**Note**: No backend server is required for video chat functionality. PubNub handles all real-time communication.

```bash
cd Juicy-meets-web
npm install
npm run dev
```

The frontend should be available at: http://localhost:3001

## Testing Video Chat

### 1. Access the Test Page

Navigate to: http://localhost:3001/video-test

### 2. Test Individual Services

Use the debug panel to test each service individually:

- **Test PubNub**: Verifies PubNub connection and presence system
- **Test ActionCable**: Verifies WebSocket connection to Rails backend
- **Test Video Chat**: Tests the complete WebRTC connection flow

### 3. Test Video Chat Between Two Tabs

1. Open the test page in two different browser tabs/windows
2. Use the same Chat ID in both tabs
3. Click "Start Video Chat" in both tabs
4. Allow camera and microphone access when prompted
5. You should see your local video and eventually the remote video

## Troubleshooting

### Common Issues

1. **Camera/Microphone Access Denied**
   - Check browser permissions
   - Ensure HTTPS or localhost (required for getUserMedia)

2. **PubNub Connection Issues**
   - Verify PubNub keys are correct
   - Check browser console for connection errors
   - Ensure no ad blockers are interfering
   - Verify network connectivity to PubNub servers



4. **WebRTC Connection Fails**
   - Check STUN server configuration
   - Verify both users are in the same chat room
   - Check browser console for ICE connection errors

### Debug Information

The debug panel shows:
- Service connection status
- Current user IDs and chat IDs
- Online user count
- Real-time connection logs

### Console Logs

Check the browser console for detailed logs:
- Video chat service status
- WebRTC connection states
- Signaling message flow
- ICE candidate exchange

## Architecture Overview

The video chat system uses:

1. **PubNub**: Presence detection, user discovery, and WebRTC signaling
2. **WebRTC**: Peer-to-peer video/audio streaming
3. **STUN Servers**: NAT traversal for direct connections

**Simplified Architecture**: PubNub handles all real-time communication, eliminating the need for a separate WebSocket backend.

## Next Steps

Once local testing is successful:

1. **Add TURN Servers**: For users behind restrictive NATs
2. **Implement Authentication**: Real user authentication instead of test tokens
3. **Add Connection Quality Monitoring**: Track connection health
4. **Implement Reconnection Logic**: Handle network interruptions
5. **Add Screen Sharing**: Extend functionality beyond video chat

## Support

If you encounter issues:

1. Check the debug panel for service status
2. Review browser console logs
3. Verify all services are running
4. Check environment variable configuration
5. Ensure browser supports WebRTC
