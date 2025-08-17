import { createConsumer, Consumer, Subscription } from '@rails/actioncable';
import SimplePeer from 'simple-peer';

export interface WebRTCSignalingMessage {
  type: 'offer' | 'answer' | 'ice-candidate' | 'user-joined' | 'user-left';
  data?: SimplePeer.SignalData;
  from: string;
  to?: string;
  chatId: string;
  timestamp: number;
}

export interface ChatRoomStatus {
  chatId: string;
  onlineUsers: string[];
  isActive: boolean;
}

class ActionCableService {
  private consumer: Consumer | null = null;
  private subscriptions: Map<string, Subscription> = new Map();
  private currentUser: string | null = null;
  private currentChatId: string | null = null;
  private isConnecting: boolean = false;
  private isClient: boolean = false;

  constructor() {
    this.isClient = typeof window !== 'undefined';
    // Only initialize ActionCable on client side
    if (this.isClient) {
      this.initializeConsumer();
    }
  }

  private initializeConsumer() {
    if (!this.isClient) return;

    try {
      this.consumer = createConsumer(process.env.NEXT_PUBLIC_ACTION_CABLE_URL || 'ws://localhost:3000/cable');
    } catch (error) {
      console.error('Failed to initialize ActionCable:', error);
    }
  }

  async connect(userId: string, chatId: string, authToken: string): Promise<boolean> {
    if (!this.isClient) {
      console.log('ActionCable not available on server side');
      return false;
    }

    if (this.isConnecting) {
      console.log('ActionCable: Already connecting...');
      return false;
    }

    if (!this.consumer) {
      console.log('ActionCable: Consumer not initialized');
      return false;
    }

    try {
      this.isConnecting = true;
      console.log('🔌 ActionCable: Connecting user:', userId, 'to chat:', chatId);
      console.log('🔌 ActionCable: Consumer URL:', process.env.NEXT_PUBLIC_ACTION_CABLE_URL);
      console.log('🔌 ActionCable: Consumer instance:', !!this.consumer);

      this.currentUser = userId;
      this.currentChatId = chatId;

      // Subscribe to chat room channel
      const subscription = this.consumer.subscriptions.create(
        {
          channel: 'ChatRoomChannel',
          chat_id: chatId,
          user_id: userId,
          auth_token: authToken,
        },
        {
          connected: () => {
            console.log('✅ ActionCable: Connected to chat room:', chatId);
            this.isConnecting = false;
          },
          disconnected: () => {
            console.log('❌ ActionCable: Disconnected from chat room:', chatId);
            this.isConnecting = false;
          },
          rejected: () => {
            console.log('❌ ActionCable: Connection rejected for chat room:', chatId);
            console.log('❌ ActionCable: Rejection details - check backend logs');
            this.isConnecting = false;
          },
          received: (data: any) => {
            console.log('📨 ActionCable: Raw message received:', data);
            console.log('📨 ActionCable: Message structure:', {
              type: data.type,
              from: data.from,
              chatId: data.chat_id || data.chatId,
              hasData: !!data.data,
              dataType: data.data ? typeof data.data : 'undefined',
              fullData: data
            });
            // Handle received messages here
            this.handleReceivedMessage(data);
          },
        }
      );

      console.log('🔌 ActionCable: Subscription created');
      this.subscriptions.set(chatId, subscription);

      // Return true - ActionCable will handle connection state internally
      return true;
    } catch (error) {
      console.error('💥 ActionCable connection error:', error);
      this.isConnecting = false;
      return false;
    }
  }

  disconnect(chatId: string): void {
    const subscription = this.subscriptions.get(chatId);
    if (subscription) {
      subscription.unsubscribe();
      this.subscriptions.delete(chatId);
    }

    if (chatId === this.currentChatId) {
      this.currentUser = null;
      this.currentChatId = null;
    }
  }

  // Send WebRTC signaling message
  sendSignalingMessage(message: Omit<WebRTCSignalingMessage, 'from' | 'timestamp'>): boolean {
    if (!this.isClient) {
      console.log('ActionCable not available on server side');
      return false;
    }

    const subscription = this.subscriptions.get(message.chatId);
    if (!subscription) {
      console.log('Not subscribed to chat room:', message.chatId);
      return false;
    }

    try {
      const fullMessage: WebRTCSignalingMessage = {
        ...message,
        from: this.currentUser!,
        timestamp: Date.now(),
      };

      // Use the correct ActionCable method to send messages
      if (subscription.perform) {
        subscription.perform('send_message', fullMessage);
      } else {
        console.log('ActionCable subscription does not support perform method');
      }
      return true;
    } catch (error) {
      console.error('Error sending signaling message:', error);
      return false;
    }
  }

  // Send offer to peer
  sendOffer(offer: unknown, to: string): boolean {
    return this.sendSignalingMessage({
      type: 'offer',
      data: offer as SimplePeer.SignalData,
      to,
      chatId: this.currentChatId!,
    });
  }

  // Send answer to peer
  sendAnswer(answer: unknown, to: string): boolean {
    return this.sendSignalingMessage({
      type: 'answer',
      data: answer as SimplePeer.SignalData,
      to,
      chatId: this.currentChatId!,
    });
  }

  // Send ICE candidate to peer
  sendICECandidate(candidate: unknown, to: string): boolean {
    return this.sendSignalingMessage({
      type: 'ice-candidate',
      data: candidate as SimplePeer.SignalData,
      to,
      chatId: this.currentChatId!,
    });
  }

  // Notify user joined
  notifyUserJoined(): boolean {
    return this.sendSignalingMessage({
      type: 'user-joined',
      chatId: this.currentChatId!,
    });
  }

  // Notify user left
  notifyUserLeft(): boolean {
    return this.sendSignalingMessage({
      type: 'user-left',
      chatId: this.currentChatId!,
    });
  }

  private handleReceivedMessage(message: any) {
    if (!this.isClient) return;

    // Normalize the message format to match our interface
    const normalizedMessage: WebRTCSignalingMessage = {
      type: message.type,
      data: message.data,
      from: message.from,
      to: message.to,
      chatId: message.chat_id || message.chatId, // Handle both formats
      timestamp: message.timestamp || Date.now()
    };

    console.log('📨 ActionCable: Normalized message:', normalizedMessage);

    // Emit event for other services to listen to
    const event = new CustomEvent('webrtc-signaling', { detail: normalizedMessage });
    window.dispatchEvent(event);
  }

  // Listen to WebRTC signaling messages
  onSignalingMessage(callback: (message: WebRTCSignalingMessage) => void) {
    if (!this.isClient) {
      console.warn('ActionCable not available on server side');
      return () => {};
    }

    const handler = (event: CustomEvent) => {
      callback(event.detail);
    };

    window.addEventListener('webrtc-signaling', handler as EventListener);
    return () => window.removeEventListener('webrtc-signaling', handler as EventListener);
  }

  // Get connection status
  isConnected(chatId: string): boolean {
    return this.subscriptions.has(chatId);
  }

  // Get current user
  getCurrentUser(): string | null {
    return this.currentUser;
  }

  // Get current chat ID
  getCurrentChatId(): string | null {
    return this.currentChatId;
  }

  // Check if currently connecting
  isConnectingToChat(): boolean {
    return this.isConnecting;
  }

  // Check if running on client side
  isClientSide(): boolean {
    return this.isClient;
  }
}

export const actionCableService = new ActionCableService();
