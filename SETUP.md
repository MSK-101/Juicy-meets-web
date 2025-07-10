# Video Chat Setup Guide

## Environment Variables

Create a `.env.local` file in the `Juicy-meets-web` directory with:

```bash
# PubNub Keys (free demo keys - replace with your own)
NEXT_PUBLIC_PUBNUB_PUBLISH_KEY=pub-c-796ad0ea-9bff-4bbf-be5e-b269b3fe0325
NEXT_PUBLIC_PUBNUB_SUBSCRIBE_KEY=sub-c-7da9e1d6-9659-4ec5-ab27-d83f2b3d4e7c

# TURN Server (free from metered.ca)
NEXT_PUBLIC_TURN_URL=turn:global.relay.metered.ca:80
NEXT_PUBLIC_TURN_USERNAME=your_username_here
NEXT_PUBLIC_TURN_CREDENTIAL=your_credential_here

# STUN Server (Google's free STUN)
NEXT_PUBLIC_STUN_URL=stun:stun.l.google.com:19302
```

## Testing Instructions

1. **Start the frontend:**
   ```bash
   cd Juicy-meets-web
   npm run dev
   ```

2. **Test video chat:**
   - Open `http://localhost:3001/video-chat` in two different browsers
   - Or use incognito mode for one browser
   - Both should connect and see each other's video
   - Chat should work between the two sessions

3. **Debug console logs:**
   - Check browser console for connection logs
   - Look for "[VideoChat]" prefixed messages
   - Verify PubNub messages are being sent/received

## Features

✅ **Video Chat** - WebRTC peer-to-peer video
✅ **Real-time Chat** - Text messaging via data channel
✅ **PubNub Signaling** - Robust signaling for WebRTC
✅ **Coin System** - Deduction during calls
✅ **UI Components** - Logo, diamonds, flags, swipe button
✅ **Responsive Design** - Works on different screen sizes

## Troubleshooting

- **No remote video:** Check console for WebRTC errors
- **Chat not working:** Verify data channel connection
- **Signaling issues:** Check PubNub keys and network
- **TURN server:** Get free credentials from metered.ca
