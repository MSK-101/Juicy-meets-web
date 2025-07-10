This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.

# Juicy Meets Web

## TURN/STUN Environment Variables (for WebRTC)

Add these to your `.env.local` for local testing, and to your deployment environment for production:

```
NEXT_PUBLIC_CABLE_URL=ws://localhost:3000/cable
NEXT_PUBLIC_STUN_URL=stun:stun.l.google.com:19302
NEXT_PUBLIC_TURN_URL=turn:global.relay.metered.ca:80
NEXT_PUBLIC_TURN_USERNAME=efb0b7b7b6b0b7b7b7b7b7b7
NEXT_PUBLIC_TURN_CREDENTIAL=efb0b7b7b7b7b7b7b7b7b7b7b7b7b7b7
```

- **Do not commit real TURN credentials to public repos.**
- For production, use your own TURN provider (Xirsys, Twilio, etc) or self-hosted coturn.

## Deployment & Testing Guide

### 1. Backend (Rails/ActionCable)
- Deploy your Rails backend (with ActionCable) to a public host (Heroku, Fly.io, Render, etc.).
- Ensure CORS and WebSocket support for your Vercel frontend domain.
- Your ActionCable endpoint should be public, e.g. `wss://your-backend.com/cable`.

### 2. Frontend (Next.js on Vercel)
- Deploy this Next.js app to Vercel.
- Set the following environment variable in Vercel:
  - `NEXT_PUBLIC_CABLE_URL=wss://your-backend.com/cable`
- (Optional, for TURN in production):
  - `NEXT_PUBLIC_TURN_URL=turn:your-turn-server.com:3478`
  - `NEXT_PUBLIC_TURN_USERNAME=your-turn-username`
  - `NEXT_PUBLIC_TURN_CREDENTIAL=your-turn-password`

### 3. Local Development
- For local testing, use the default `ws://localhost:3000/cable` (no env var needed).
- Open two browsers (or devices) at `http://localhost:3001/video-chat#room1`.

### 4. Testing with Two Users
- Open the deployed Vercel site in two browsers or devices.
- Use the same room URL (e.g. `/video-chat#room1`).
- Each user will see their own video on the left, the peer on the right, and can chat when the data channel is open.

### 5. Clean Code
- All dummy code, unused props, and extra logs have been removed.
- Only production-ready WebRTC and chat logic remains.
- ICE servers use Google STUN for local, and TURN if provided in env vars.

---

**For any issues, check browser console for WebRTC and WebSocket errors.**
