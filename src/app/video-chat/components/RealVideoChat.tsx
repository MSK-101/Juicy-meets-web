'use client';

import React, { useRef, useEffect, useState } from 'react';

const CABLE_URL = process.env.NEXT_PUBLIC_CABLE_URL || 'ws://localhost:3000/cable';

// SVGs for diamond, flag, and placeholder controls
const DiamondIcon = () => (
  <svg width="28" height="28" viewBox="0 0 28 28" fill="none" xmlns="http://www.w3.org/2000/svg">
    <g filter="url(#filter0_d_1_2)">
      <path d="M14 4L24 14L14 24L4 14L14 4Z" fill="#7C3AED" stroke="#A78BFA" strokeWidth="2"/>
      <path d="M14 4L19 14L14 24L9 14L14 4Z" fill="#C4B5FD"/>
    </g>
    <defs>
      <filter id="filter0_d_1_2" x="0" y="0" width="28" height="28" filterUnits="userSpaceOnUse" colorInterpolationFilters="sRGB">
        <feFlood floodOpacity="0" result="BackgroundImageFix"/>
        <feBlend mode="normal" in="SourceGraphic" in2="BackgroundImageFix" result="shape"/>
        <feGaussianBlur stdDeviation="2" result="effect1_foregroundBlur_1_2"/>
      </filter>
    </defs>
  </svg>
);

const FlagIcon = () => (
  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#F87171" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M4 22V4a2 2 0 0 1 2-2h13l-2 5 2 5H6"/></svg>
);

// ICE server config: use Google STUN for local, allow TURN for production
const getIceServers = () => {
  const turnUrl = process.env.NEXT_PUBLIC_TURN_URL;
  const turnUsername = process.env.NEXT_PUBLIC_TURN_USERNAME;
  const turnCredential = process.env.NEXT_PUBLIC_TURN_CREDENTIAL;
  const stunServers = [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' },
    { urls: 'stun:stun2.l.google.com:19302' },
    { urls: 'stun:stun3.l.google.com:19302' },
    { urls: 'stun:stun4.l.google.com:19302' }
  ];
  if (turnUrl && turnUsername && turnCredential) {
    return [
      ...stunServers,
      { urls: turnUrl, username: turnUsername, credential: turnCredential }
    ];
  }
  return stunServers;
};

export default function RealVideoChat() {
  const [remoteStream, setRemoteStream] = useState<MediaStream | null>(null);
  const [chatMessages, setChatMessages] = useState<{ user: 'You' | 'Stranger'; message: string }[]>([]);
  const [inputValue, setInputValue] = useState('');
  const [dataChannelOpen, setDataChannelOpen] = useState(false);
  const [isInitialized, setIsInitialized] = useState(false);

  const localVideoRef = useRef<HTMLVideoElement>(null);
  const remoteVideoRef = useRef<HTMLVideoElement>(null);
  const connectionManagerRef = useRef<any>(null);
  const cableRef = useRef<any>(null);
  const channelRef = useRef<any>(null);

  useEffect(() => {
    let ActionCable: any;
    let SimplePeer: any;

    class ConnectionManager {
      private peer: any = null;
      private stream: MediaStream | null = null;
      private isInitiator: boolean = false;
      private hasReceivedOffer: boolean = false;
      private hasReceivedAnswer: boolean = false;
      private pendingSignals: any[] = [];
      private isDestroyed: boolean = false;

      constructor(stream: MediaStream, isInitiator: boolean) {
        this.stream = stream;
        this.isInitiator = isInitiator;
        this.createPeer();
      }

      private createPeer() {
        if (this.isDestroyed) return;
        this.peer = new SimplePeer({
          initiator: this.isInitiator,
          trickle: true,
          stream: this.stream,
          config: {
            iceServers: getIceServers()
          }
        });
        this.setupPeerEvents();
      }

      private setupPeerEvents() {
        this.peer.on('signal', (data: any) => {
          if (channelRef.current) {
            channelRef.current.send({ signal: data });
          }
        });
        this.peer.on('stream', (remoteStream: MediaStream) => {
          setRemoteStream(remoteStream);
          if (remoteVideoRef.current) {
            remoteVideoRef.current.srcObject = remoteStream;
          }
        });
        this.peer.on('connect', () => {
          setDataChannelOpen(true);
        });
        this.peer.on('data', (data: Uint8Array) => {
          const msg = new TextDecoder().decode(data);
          setChatMessages(prev => [...prev, { user: 'Stranger', message: msg }]);
        });
        this.peer.on('close', () => {
          setRemoteStream(null);
          setDataChannelOpen(false);
        });
        this.peer.on('error', () => {
          setDataChannelOpen(false);
        });
      }

      public handleSignal(signal: any) {
        if (this.isDestroyed) return;
        if (signal.type === 'offer' && this.hasReceivedOffer) return;
        if (signal.type === 'answer' && this.hasReceivedAnswer) return;
        if (signal.type === 'offer') this.hasReceivedOffer = true;
        if (signal.type === 'answer') this.hasReceivedAnswer = true;
        if (!this.peer) {
          this.pendingSignals.push(signal);
          return;
        }
        try {
          this.peer.signal(signal);
        } catch {}
      }

      public processPendingSignals() {
        if (this.isDestroyed) return;
        const signalsToProcess = [...this.pendingSignals];
        this.pendingSignals = [];
        signalsToProcess.forEach(signal => {
          setTimeout(() => {
            if (!this.isDestroyed) {
              this.handleSignal(signal);
            }
          }, 50);
        });
      }

      public destroy() {
        this.isDestroyed = true;
        if (this.peer) {
          this.peer.destroy();
          this.peer = null;
        }
        this.pendingSignals = [];
      }
    }

    const initializeVideoChat = async () => {
      try {
        const [actionCableModule, simplePeerModule] = await Promise.all([
          import('actioncable'),
          import('simple-peer')
        ]);
        ActionCable = actionCableModule.default;
        SimplePeer = simplePeerModule.default;
        const ROOM = window.location.hash.replace('#', '') || Math.random().toString(36).substring(2, 10);
        const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
        if (localVideoRef.current) {
          localVideoRef.current.srcObject = stream;
        }
        cableRef.current = ActionCable.createConsumer(CABLE_URL);
        channelRef.current = cableRef.current.subscriptions.create(
          { channel: 'VideoChatChannel', room: ROOM },
          {
            received: (data: any) => {
              if (data.signal && connectionManagerRef.current) {
                connectionManagerRef.current.handleSignal(data.signal);
              }
            }
          }
        );
        let isInitiator = false;
        if (typeof window !== 'undefined') {
          const sessionKey = `videochat_${ROOM}`;
          const hasJoined = sessionStorage.getItem(sessionKey);
          if (!hasJoined) {
            sessionStorage.setItem(sessionKey, 'true');
            isInitiator = true;
          }
        }
        setTimeout(() => {
          connectionManagerRef.current = new ConnectionManager(stream, isInitiator);
          setTimeout(() => {
            if (connectionManagerRef.current) {
              connectionManagerRef.current.processPendingSignals();
            }
          }, 1000);
        }, 500);
        setIsInitialized(true);
      } catch {}
    };
    setTimeout(() => {
      initializeVideoChat();
    }, 200);
    return () => {
      if (connectionManagerRef.current) {
        connectionManagerRef.current.destroy();
      }
      if (cableRef.current) cableRef.current.disconnect();
      if (typeof window !== 'undefined') {
        const ROOM = window.location.hash.replace('#', '') || Math.random().toString(36).substring(2, 10);
        const sessionKey = `videochat_${ROOM}`;
        sessionStorage.removeItem(sessionKey);
      }
    };
  }, []);

  useEffect(() => {
    if (remoteStream && remoteVideoRef.current) {
      remoteVideoRef.current.srcObject = remoteStream;
      remoteVideoRef.current.play().catch(() => {});
    }
  }, [remoteStream]);

  const handleSend = () => {
    if (!inputValue.trim() || !connectionManagerRef.current?.peer || !dataChannelOpen) return;
    connectionManagerRef.current.peer.send(inputValue);
    setChatMessages(prev => [...prev, { user: 'You', message: inputValue }]);
    setInputValue('');
  };

  return (
    <div className="h-[calc(100vh-80px)] w-full flex items-stretch overflow-hidden relative">
      {/* Left: Local User Video + Chat */}
      <div className="flex-1 relative flex flex-col bg-black">
        <video
          ref={localVideoRef}
          autoPlay
          playsInline
          muted
          className="w-full h-full object-cover rounded-none"
        />
        {/* Chat messages overlay */}
        <div className="absolute bottom-32 left-0 w-full flex flex-col items-end px-8 space-y-2 z-10">
          {chatMessages.map((msg, i) => (
            <div
              key={i}
              className={`max-w-[70%] px-4 py-2 rounded-2xl mb-1 text-sm ${msg.user === 'You' ? 'bg-black bg-opacity-60 text-white self-end' : 'bg-white bg-opacity-80 text-gray-900 self-start'}`}
              style={{backdropFilter: 'blur(4px)'}}>
              <span className="block whitespace-pre-line">{msg.user === 'You' ? `You: ${msg.message}` : `Stranger: ${msg.message}`}</span>
            </div>
          ))}
        </div>
        {/* Chat input at bottom */}
        <div className="absolute bottom-0 left-0 w-full p-6 z-10">
          <div className="flex items-center bg-white bg-opacity-20 rounded-full px-4 py-2 backdrop-blur-md">
            <input
              type="text"
              placeholder={dataChannelOpen ? "Start typing..." : "Connecting chat..."}
              className="flex-1 bg-transparent text-white outline-none border-none placeholder-gray-400 px-2 py-1"
              value={inputValue}
              onChange={e => setInputValue(e.target.value)}
              onKeyDown={e => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  handleSend();
                }
              }}
              disabled={!dataChannelOpen}
            />
            <button className="ml-2 text-white opacity-80 hover:opacity-100" onClick={handleSend} disabled={!inputValue.trim() || !dataChannelOpen}>
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M22 2L11 13" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M22 2l-7 20-4-9-9-4 20-7z" /></svg>
            </button>
          </div>
        </div>
      </div>
      {/* Vertical separator */}
      <div className="w-1 bg-gradient-to-b from-purple-400 to-purple-600 opacity-80" />
      {/* Right: Remote User Panel with controls */}
      <div className="flex-1 relative flex flex-col bg-gray-900">
        {remoteStream ? (
          <video
            ref={remoteVideoRef}
            autoPlay
            playsInline
            className="w-full h-full object-cover rounded-none absolute inset-0 z-0"
            style={{ opacity: 0.7 }}
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-white text-xl">
            {isInitialized ? "Waiting for peer..." : "Initializing..."}
          </div>
        )}
      </div>
    </div>
  );
}
