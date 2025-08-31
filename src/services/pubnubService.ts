import PubNub from 'pubnub';

export interface ChatMessage {
  id: string;
  text: string;
  sender: string;
  timestamp: number;
  type: 'text' | 'webrtc-signal';
}

export interface WebRTCSignal {
  type: 'offer' | 'answer' | 'ice-candidate';
  data: RTCSessionDescriptionInit | RTCIceCandidateInit;
  from: string;
  to: string;
  chatId: string;
  connectionId?: string; // Connection session ID
}

// New robust signaling types based on the demo
type Signal =
  | { type: 'hello' | 'ready' | 'bye' | 'reset' | 'health'; matchId: string; sessionVersion: string; from: string; to?: string; role: 'initiator'|'receiver'; correlationId: string; ts: number; }
  | { type: 'offer' | 'answer'; matchId: string; sessionVersion: string; from: string; to: string; role: 'initiator'|'receiver'; sdp: string; correlationId: string; ts: number; }
  | { type: 'ice'; matchId: string; sessionVersion: string; from: string; to: string; role: 'initiator'|'receiver'; candidate: RTCIceCandidateInit; correlationId: string; ts: number; };

type Handlers = {
  onMessage: (msg: Signal) => void;
  onJoin?: () => void;
  onLeave?: () => void;
  onError?: (e: unknown) => void;
};

class PubNubService {
  private client: PubNub | null = null;
  private channel?: string;
  private handlers?: Handlers;
  private seen = new Set<string>();
  private seenQueue: string[] = [];
  private myUserId!: string;
  private matchId?: string;
  private sessionVersion = '';
  private isClient: boolean = false;
  private isInitialized: boolean = false;

  constructor() {
    this.isClient = typeof window !== 'undefined';
    // Only initialize PubNub on client side
    if (this.isClient) {
      this.initializePubNub();
      this.isInitialized = true;
    }
  }

  private initializePubNub() {
    if (!this.isClient) return;

    try {
      const publishKey = process.env.NEXT_PUBLIC_PUBNUB_PUBLISH_KEY || '';
      const subscribeKey = process.env.NEXT_PUBLIC_PUBNUB_SUBSCRIBE_KEY || '';

      console.log('🔑 PubNub keys check:');
      console.log('  - Publish key length:', publishKey.length);
      console.log('  - Subscribe key length:', subscribeKey.length);
      console.log('  - Publish key starts with:', publishKey.substring(0, 10) + '...');
      console.log('  - Subscribe key starts with:', subscribeKey.substring(0, 10) + '...');

      if (!publishKey || !subscribeKey) {
        console.error('❌ PubNub keys are missing!');
        console.error('  - NEXT_PUBLIC_PUBNUB_PUBLISH_KEY:', publishKey ? 'Set' : 'Missing');
        console.error('  - NEXT_PUBLIC_PUBNUB_SUBSCRIBE_KEY:', subscribeKey ? 'Set' : 'Missing');
        return;
      }

      this.client = new PubNub({
        publishKey: publishKey,
        subscribeKey: subscribeKey,
        uuid: `user-${Date.now()}`,
      });

      console.log('✅ PubNub instance created successfully');
    } catch (error) {
      console.error('💥 Failed to initialize PubNub:', error);
    }
  }

  // Join a video chat session with proper session versioning
  join(matchId: string, sessionVersion: string, myUserId: string, handlers: Handlers) {
    this.leave(); // defensive cleanup
    this.matchId = matchId;
    this.sessionVersion = sessionVersion;
    this.myUserId = myUserId;
    this.handlers = handlers;
    this.channel = `vc.${matchId}`;

    console.log('🔌 PubNub: Joining channel:', this.channel, 'with session version:', sessionVersion);

    this.client?.addListener({
      message: (evt) => {
        try {
          const msg = evt.message as Signal;
          if (!this.isValid(msg)) return;
          if (this.isStale(msg)) return;
          if (this.isDup(msg.correlationId)) return;
          handlers.onMessage(msg);
        } catch (e) {
          handlers.onError?.(e);
        }
      },
      status: (s) => {
        if (s.category === 'PNConnectedCategory') handlers.onJoin?.();
        if (s.category === 'PNNetworkIssuesCategory') handlers.onError?.(s);
      },
    });

    this.client?.subscribe({ channels: [this.channel] });
  }

  // Leave current session and cleanup
  leave() {
    if (this.channel) {
      this.client?.unsubscribe({ channels: [this.channel] });
    }
    this.channel = undefined;
    this.matchId = undefined;
    this.sessionVersion = '';
    this.handlers?.onLeave?.();
    this.handlers = undefined;
    this.seen.clear();
    this.seenQueue = [];
  }

  // Send signal with proper session versioning and correlation IDs
  send(partial: Omit<Signal, 'correlationId' | 'ts'>) {
    if (!this.channel) throw new Error('Not joined to a channel');
    const msg: Signal = { ...partial, correlationId: this.generateCorrelationId(), ts: Date.now() } as Signal;
    return this.client?.publish({ channel: this.channel, message: msg });
  }

  // Send WebRTC offer
  async sendOffer(to: string, role: 'initiator' | 'receiver', sdp: string): Promise<void> {
    if (!this.client) {
      console.warn('⚠️ PubNub not available, skipping offer signal');
      return;
    }

    try {
      await this.send({
        type: 'offer',
        matchId: this.matchId!,
        sessionVersion: this.sessionVersion,
        from: this.myUserId,
        to,
        role,
        sdp
      });
      console.log('📤 Offer signal sent successfully');
    } catch (error) {
      console.error('❌ Failed to send offer signal:', error);
      throw error; // Offer failure is critical
    }
  }

  // Send WebRTC answer
  async sendAnswer(to: string, role: 'initiator' | 'receiver', sdp: string): Promise<void> {
    if (!this.client) {
      console.warn('⚠️ PubNub not available, skipping answer signal');
      return;
    }

    try {
      await this.send({
        type: 'answer',
        matchId: this.matchId!,
        sessionVersion: this.sessionVersion,
        from: this.myUserId,
        to,
        role,
        sdp
      });
      console.log('📤 Answer signal sent successfully');
    } catch (error) {
      console.error('❌ Failed to send answer signal:', error);
      throw error; // Answer failure is critical
    }
  }

  // Send ICE candidate
  async sendIceCandidate(to: string, role: 'initiator' | 'receiver', candidate: RTCIceCandidateInit): Promise<void> {
    if (!this.client) {
      console.warn('⚠️ PubNub not available, skipping ICE candidate signal');
      return;
    }

    try {
      await this.send({
        type: 'ice',
        matchId: this.matchId!,
        sessionVersion: this.sessionVersion,
        from: this.myUserId,
        to,
        role,
        candidate
      });
      console.log('🧊 ICE candidate signal sent successfully');
    } catch (error) {
      console.error('❌ Failed to send ICE candidate signal:', error);
      // ICE failures are not critical, just log
    }
  }

  // Send handshake signals for connection establishment
  async sendHello(to: string, role: 'initiator' | 'receiver'): Promise<void> {
    if (!this.client) {
      console.warn('⚠️ PubNub not available, skipping hello signal');
      return;
    }

    try {
      await this.send({
        type: 'hello',
        matchId: this.matchId!,
        sessionVersion: this.sessionVersion,
        from: this.myUserId,
        to,
        role
      });
      console.log('👋 Hello signal sent successfully');
    } catch (error) {
      console.error('❌ Failed to send hello signal:', error);
      // Don't throw - allow fallback behavior
    }
  }

  async sendReady(to: string, role: 'initiator' | 'receiver'): Promise<void> {
    if (!this.client) {
      console.warn('⚠️ PubNub not available, skipping ready signal');
      return;
    }

    try {
      await this.send({
        type: 'ready',
        matchId: this.matchId!,
        sessionVersion: this.sessionVersion,
        from: this.myUserId,
        to,
        role
      });
      console.log('✅ Ready signal sent successfully');
    } catch (error) {
      console.error('❌ Failed to send ready signal:', error);
      // Don't throw - allow fallback behavior
    }
  }

  // Send chat message
  async sendMessage(text: string): Promise<void> {
    if (!this.isClient || !this.isInitialized) {
      console.log('PubNub not available on server side');
      return;
    }

    if (!this.client || !this.channel || !this.myUserId) {
      throw new Error('Not connected to chat');
    }

    const message: ChatMessage = {
      id: `${Date.now()}-${Math.random()}`,
      text,
      sender: this.myUserId,
      timestamp: Date.now(),
      type: 'text',
    };

    await this.client.publish({
      channel: this.channel,
      message: message,
    });
  }

  // Legacy methods for backward compatibility
  async connect(_userId: string, _chatId: string): Promise<void> {
    // This is now handled by the join method
    console.warn('⚠️ connect() is deprecated, use join() instead');
  }

  disconnect() {
    this.leave();
  }

  // Validation methods
  private isValid(msg: unknown): msg is Signal {
    if (!msg || typeof msg !== 'object') return false;
    const signal = msg as Signal;
    return typeof signal.type === 'string' &&
           typeof signal.matchId === 'string' &&
           typeof signal.sessionVersion === 'string';
  }

  private isStale(msg: Signal) {
    return msg.matchId !== this.matchId || msg.sessionVersion !== this.sessionVersion;
  }

  private isDup(id: string) {
    if (this.seen.has(id)) return true;
    this.seen.add(id);
    this.seenQueue.push(id);
    if (this.seenQueue.length > 500) { // small LRU
      const old = this.seenQueue.shift()!;
      this.seen.delete(old);
    }
    return false;
  }

  private generateCorrelationId(): string {
    return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  // Check if running on client side
  isClientSide(): boolean {
    return this.isClient && this.isInitialized;
  }

  // Get current session info
  getCurrentSession(): { matchId?: string; sessionVersion: string; channel?: string } {
    return {
      matchId: this.matchId,
      sessionVersion: this.sessionVersion,
      channel: this.channel
    };
  }
}

export const pubnubService = new PubNubService();
