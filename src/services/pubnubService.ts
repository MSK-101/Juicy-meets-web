import PubNub from 'pubnub';

// Simple WebRTC signal types - only what we need
type WebRTCSignal =
  | { type: 'ready'; from: string; to: string; sessionVersion: string; }
  | { type: 'offer'; sdp: string; from: string; to: string; sessionVersion: string; }
  | { type: 'answer'; sdp: string; from: string; to: string; sessionVersion: string; }
  | { type: 'ice'; candidate: RTCIceCandidateInit; from: string; to: string; sessionVersion: string; }
  | { type: 'bye'; from: string; to: string; sessionVersion: string; }
  | { type: 'health'; from: string; to: string; sessionVersion: string; ts: number; }
  | { type: 'chat'; text: string; from: string; to: string; sessionVersion: string; timestamp: number; id?: string; };

type Handlers = {
  onMessage: (msg: WebRTCSignal) => void;
  onJoin?: () => void;
  onLeave?: () => void;
  onError?: (e: unknown) => void;
};

class PubNubService {
  private client: PubNub | null = null;
  private channel?: string;
  private handlers?: Handlers;
  private myUserId?: string;
  private sessionVersion?: string;

  constructor() {
    if (typeof window !== 'undefined') {
      this.initializePubNub();
    }
  }

  private initializePubNub() {
    try {
      const publishKey = process.env.NEXT_PUBLIC_PUBNUB_PUBLISH_KEY || '';
      const subscribeKey = process.env.NEXT_PUBLIC_PUBNUB_SUBSCRIBE_KEY || '';

      if (!publishKey || !subscribeKey) {
        return;
      }

      this.client = new PubNub({
        publishKey,
        subscribeKey,
        uuid: `user-${Date.now()}`,
        // PAKISTAN FIX: Try alternative PubNub endpoints if DNS fails
        origin: 'pubsub.pubnub.com', // Fallback endpoint that might work better in Pakistan
        restore: true, // Auto-reconnect on network issues
        keepAlive: true, // Keep connection alive
        // Increase timeouts for Pakistan's potentially slower network
        subscribeRequestTimeout: 310000, // 310 seconds
        transactionalRequestTimeout: 15000, // 15 seconds
        // Auto network detection for better reliability
        autoNetworkDetection: true
      });

    } catch (error) {

    }
  }

  // Join a video chat room
  join(roomId: string, sessionVersion: string, myUserId: string, handlers: Handlers) {
    const newChannel = `vc.${roomId}`;

    // CRITICAL FIX: Always leave previous channel completely before joining new one
    if (this.channel && this.channel !== newChannel) {
      this.leave(); // Complete cleanup of previous session

      // Small delay to ensure cleanup is complete
      setTimeout(() => this.joinNewChannel(newChannel, sessionVersion, myUserId, handlers), 100);
      return;
    }

    // If same channel but different session, still reset
    if (this.channel === newChannel && this.sessionVersion !== sessionVersion) {
      this.leave();
      setTimeout(() => this.joinNewChannel(newChannel, sessionVersion, myUserId, handlers), 100);
      return;
    }

    // Direct join for new connections
    this.joinNewChannel(newChannel, sessionVersion, myUserId, handlers);
  }

  private joinNewChannel(channel: string, sessionVersion: string, myUserId: string, handlers: Handlers) {

    this.channel = channel;
    this.sessionVersion = sessionVersion;
    this.myUserId = myUserId;
    this.handlers = handlers;

    // Set UUID to actual user ID
    if (this.client) {
      this.client.setUUID(myUserId);
    }

    // Remove existing listeners first to prevent duplicates
    this.client?.removeAllListeners();

    this.client?.addListener({
      message: (evt) => {
        try {
          const msg = evt.message as WebRTCSignal;

          // Skip our own messages
          if (msg.from === this.myUserId) {
            return;
          }

          // Basic validation
          if (!msg || !msg.type || !msg.from || !msg.to) {
            return;
          }

          // Validate session version to prevent old messages from swipes
          if (msg.sessionVersion && msg.sessionVersion !== this.sessionVersion) {
            return;
          }

          handlers.onMessage(msg);
        } catch (e) {

          handlers.onError?.(e);
        }
      },
      status: (s) => {
        if (s.category === 'PNConnectedCategory') {
          handlers.onJoin?.();
        }
        if (s.category === 'PNNetworkIssuesCategory') {
          handlers.onError?.(s);
        }
        if (s.category === 'PNReconnectedCategory') {
        }
        if (s.category === 'PNDisconnectedCategory') {
        }
      },
    });

    this.client?.subscribe({
      channels: [this.channel],
      withPresence: false
    });
  }

  // Leave current session
  leave() {
    if (this.channel) {
      this.client?.unsubscribe({ channels: [this.channel] });
    }
    this.channel = undefined;
    this.sessionVersion = undefined;
    this.myUserId = undefined;
    this.handlers?.onLeave?.();
    this.handlers = undefined;

  }

  // Complete reset - clear everything including client
  reset() {

    // Leave current session
    this.leave();

    // Reset client state
    if (this.client) {
      try {
        this.client.unsubscribeAll();

      } catch (error) {

      }
    }

  }

  // Send ready signal for handshake
  async sendReady(to: string): Promise<void> {
    if (!this.client || !this.channel || !this.myUserId || !this.sessionVersion) {
      throw new Error('Not connected to channel or missing session version');
    }

    await this.client.publish({
      channel: this.channel,
      message: {
        type: 'ready',
        from: this.myUserId,
        to,
        sessionVersion: this.sessionVersion
      }
    });
  }

  // Send ready signal (alias for consistency)
  async sendReadySignal(to: string, sessionVersion: string): Promise<void> {
    return this.sendReady(to);
  }

  // Send WebRTC offer
  async sendOffer(to: string, sdp: string): Promise<void> {
    if (!this.client || !this.channel || !this.myUserId || !this.sessionVersion) {
      throw new Error('Not connected to channel or missing session version');
    }

    await this.client.publish({
      channel: this.channel,
      message: {
        type: 'offer',
        sdp,
        from: this.myUserId,
        to,
        sessionVersion: this.sessionVersion
      }
    });
  }

  // Send WebRTC answer
  async sendAnswer(to: string, sdp: string): Promise<void> {
    if (!this.client || !this.channel || !this.myUserId || !this.sessionVersion) {
      throw new Error('Not connected to channel or missing session version');
    }

    await this.client.publish({
      channel: this.channel,
      message: {
        type: 'answer',
        sdp,
        from: this.myUserId,
        to,
        sessionVersion: this.sessionVersion
      }
    });
  }

  // Send ICE candidate
  async sendIceCandidate(to: string, candidate: RTCIceCandidateInit): Promise<void> {
    if (!this.client || !this.channel || !this.myUserId || !this.sessionVersion) {
      throw new Error('Not connected to channel or missing session version');
    }

    await this.client.publish({
      channel: this.channel,
        message: {
        type: 'ice',
        candidate: JSON.parse(JSON.stringify(candidate)), // Convert to plain object
        from: this.myUserId,
        to,
        sessionVersion: this.sessionVersion
      }
    });
  }

  // Send bye signal
  async sendBye(to: string): Promise<void> {
    if (!this.client || !this.channel || !this.myUserId || !this.sessionVersion) {
      throw new Error('Not connected to channel or missing session version');
    }

    await this.client.publish({
      channel: this.channel,
        message: {
        type: 'bye',
        from: this.myUserId,
        to,
        sessionVersion: this.sessionVersion
      }
    });
  }

  // Send health/heartbeat signal
  async sendHealth(to: string): Promise<void> {
    if (!this.client || !this.channel || !this.myUserId || !this.sessionVersion) {
      throw new Error('Not connected to channel or missing session version');
    }

    await this.client.publish({
      channel: this.channel,
        message: {
        type: 'health',
        from: this.myUserId,
        to,
        sessionVersion: this.sessionVersion,
        ts: Date.now()
      }
    });
  }

  // Send chat message
  async sendChatMessage(to: string, text: string, messageId?: string): Promise<void> {
    if (!this.client || !this.channel || !this.myUserId || !this.sessionVersion) {
      throw new Error('Not connected to channel or missing session version');
    }

    await this.client.publish({
      channel: this.channel,
      message: {
        type: 'chat',
        text,
        from: this.myUserId,
        to,
        sessionVersion: this.sessionVersion,
        timestamp: Date.now(),
        id: messageId
      } as any
    });
  }

    // Check if connected
  isConnected(): boolean {
    // Check if we have the basic connection info
    if (!this.channel || !this.myUserId || !this.sessionVersion) {
      return false;
    }

    // Check if the client exists
    if (!this.client) {
      return false;
    }

    // Check if we're subscribed to the channel
    try {
      // Allow joining different rooms - only block if trying to join the exact same room and session
      return this.client !== null && this.channel !== undefined;
    } catch (error) {

      return false;
    }
  }

  // Get current session info
  getCurrentSession(): { channel?: string; userId?: string; sessionVersion?: string } {
    return {
      channel: this.channel,
      userId: this.myUserId,
      sessionVersion: this.sessionVersion
    };
  }

}

export const pubnubService = new PubNubService();
