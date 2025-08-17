import { api } from '../api/baseAPI';
import { pubnubService } from './pubnubService';

export interface VideoMatchStatus {
  status: 'not_in_queue' | 'waiting' | 'matched';
  room_id?: string;
  partner?: {
    id: string;
    username: string;
  };
  is_initiator?: boolean;
}

export interface WebRTCSignalData {
  type: 'offer' | 'answer' | 'ice-candidate';
  data: RTCSessionDescriptionInit | RTCIceCandidateInit;
  room_id: string;
  target_user_id: string;
}

export class CleanVideoChatService {
  private peerConnection: RTCPeerConnection | null = null;
  private localStream: MediaStream | null = null;
  private remoteStream: MediaStream | null = null;
  private currentRoomId: string | null = null;
  private partnerId: string | null = null;
  private isInitiator: boolean = false;
  private iceCandidateQueue: RTCIceCandidateInit[] = [];
  private statusCheckInterval: NodeJS.Timeout | null = null;
  private signalPollingInterval: NodeJS.Timeout | null = null;
  private userId: string;

  // Events
  private onRemoteStreamCallback: ((stream: MediaStream) => void) | null = null;
  private onConnectionStateCallback: ((state: RTCPeerConnectionState) => void) | null = null;
  private onPartnerLeftCallback: (() => void) | null = null;

  constructor() {
    this.userId = this.generateUserId();
    console.log('🎥 CleanVideoChatService initialized with user ID:', this.userId);
  }

  private generateUserId(): string {
    // Check if we're in the browser environment
    if (typeof window === 'undefined') {
      // Server-side rendering - generate a temporary ID
      return `user_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    }

    // Try to get from localStorage first, then create new
    let userId = localStorage.getItem('video_chat_user_id');
    if (!userId) {
      userId = `user_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      localStorage.setItem('video_chat_user_id', userId);
    }
    return userId;
  }

  // Event listeners
  onRemoteStream(callback: (stream: MediaStream) => void) {
    this.onRemoteStreamCallback = callback;
  }

  onConnectionStateChange(callback: (state: RTCPeerConnectionState) => void) {
    this.onConnectionStateCallback = callback;
  }

  onPartnerLeft(callback: () => void) {
    this.onPartnerLeftCallback = callback;
  }

  // Ensure user ID is properly set (in case of SSR)
  private ensureUserId(): void {
    if (!this.userId || this.userId.startsWith('user_') && typeof window !== 'undefined') {
      this.userId = this.generateUserId();
    }
  }

  // Join the video chat queue
  async joinQueue(): Promise<void> {
    this.ensureUserId();
    console.log('🎯 Joining video chat queue with user ID:', this.userId);

    try {
      await api.post('/video_chat/join', {}, {
        headers: {
          'X-User-ID': this.userId
        }
      });
      console.log('✅ Successfully joined queue');

      // Start checking for matches
      this.startStatusChecking();
    } catch (error) {
      console.error('❌ Failed to join queue - backend likely not running:', error);
      throw new Error('Backend server is not available. Please make sure the Rails server is running on port 3000.');
    }
  }

  // Leave the video chat
  async leaveChat(): Promise<void> {
    this.ensureUserId();
    console.log('👋 Leaving video chat...');

    try {
      if (this.currentRoomId) {
        await api.post('/video_chat/leave', {}, {
          headers: {
            'X-User-ID': this.userId
          }
        });
      }

      this.cleanup();
      console.log('✅ Successfully left chat');
    } catch (error) {
      console.error('❌ Failed to leave chat:', error);
      this.cleanup(); // Clean up anyway
    }
  }

  // Get local video stream
  async getLocalStream(): Promise<MediaStream> {
    if (this.localStream) {
      return this.localStream;
    }

    try {
      console.log('📹 Getting local video stream...');
      this.localStream = await navigator.mediaDevices.getUserMedia({
        video: true,
        audio: true
      });
      console.log('✅ Got local stream');
      return this.localStream;
    } catch (error) {
      console.error('❌ Failed to get local stream:', error);
      throw error;
    }
  }

  // Get current local stream (null if not available)
  getCurrentLocalStream(): MediaStream | null {
    return this.localStream;
  }

  // Get remote stream (if available)
  getRemoteStream(): MediaStream | null {
    return this.remoteStream;
  }

  // Check if currently in a chat
  isInChat(): boolean {
    return this.currentRoomId !== null;
  }

  // Event listener methods
  onRemoteStream(callback: (stream: MediaStream) => void): void {
    this.onRemoteStreamCallback = callback;
  }

  onConnectionStateChange(callback: (state: RTCPeerConnectionState) => void): void {
    this.onConnectionStateCallback = callback;
  }

  onPartnerLeft(callback: () => void): void {
    this.onPartnerLeftCallback = callback;
  }

  // Private methods

  private startStatusChecking(): void {
    console.log('🔄 Starting status checking...');

    this.statusCheckInterval = setInterval(async () => {
      try {
        console.log('🔄 Checking status for user:', this.userId);
        const response = await api.get('/video_chat/status', {
          headers: {
            'X-User-ID': this.userId
          }
        }) as VideoMatchStatus;

        console.log('📡 Status API response:', response);

        // Check if response exists and has status
        if (response && response.status) {
          await this.handleStatusUpdate(response);
        } else {
          console.warn('⚠️ Invalid response from status API:', response);
        }
      } catch (error) {
        console.error('❌ Status check failed - backend likely not running:', error);
        // Stop checking if backend is not available
        this.stopStatusChecking();
      }
    }, 2000); // Check every 2 seconds
  }

  private stopStatusChecking(): void {
    if (this.statusCheckInterval) {
      clearInterval(this.statusCheckInterval);
      this.statusCheckInterval = null;
      console.log('🛑 Status checking stopped');
    }
  }

  private async subscribeToPubNubSignaling(): Promise<void> {
    if (!this.currentRoomId) return;

    console.log('🔔 Connecting to PubNub for room:', this.currentRoomId);

    // Connect to PubNub with room as chat ID
    await pubnubService.connect(this.userId, this.currentRoomId);

    // Set up WebRTC signal handler
    pubnubService.onWebRTCSignal((signal) => {
      // Ignore signals from ourselves
      if (signal.from === this.userId) {
        console.log('🔄 Ignoring own signal:', signal.type);
        return;
      }

      console.log('📨 Received WebRTC signal via PubNub:', signal.type, 'from:', signal.from);
      this.handleIncomingSignal(signal);
    });
  }

  private async handleStatusUpdate(status: VideoMatchStatus): Promise<void> {
    console.log('📊 Status update:', status);
    console.log('📊 Current room ID:', this.currentRoomId);
    console.log('📊 Status type:', status?.status);

    // Guard against invalid status
    if (!status || !status.status) {
      console.error('❌ Invalid status object received:', status);
      return;
    }

    if (status.status === 'matched' && !this.currentRoomId) {
      // We got matched!
      console.log('🎉 Got matched!', status);

      this.currentRoomId = status.room_id!;
      this.partnerId = status.partner!.id;
      this.isInitiator = status.is_initiator!;

      // Stop status checking
      this.stopStatusChecking();

      // Subscribe to PubNub channel for this room
      await this.subscribeToPubNubSignaling();

      // Start WebRTC connection
      console.log('🚀 About to start WebRTC connection...');
      await this.startWebRTCConnection();
      console.log('🚀 WebRTC connection setup complete');
    }
  }

  private async startWebRTCConnection(): Promise<void> {
    console.log(`🔗 Starting WebRTC connection as ${this.isInitiator ? 'initiator' : 'receiver'}`);

    try {
      // Create peer connection
      this.peerConnection = new RTCPeerConnection({
        iceServers: [
          { urls: 'stun:stun.l.google.com:19302' },
          { urls: 'stun:stun1.l.google.com:19302' }
        ]
      });

      // Set up event handlers
      this.setupPeerConnectionHandlers();

      // Add local stream
      const localStream = await this.getLocalStream();
      console.log('📹 Adding local stream tracks:', localStream.getTracks().length);
      localStream.getTracks().forEach((track, index) => {
        console.log(`📹 Adding track ${index}:`, track.kind, track.enabled);
        this.peerConnection!.addTrack(track, localStream);
      });

      // If initiator, create and send offer
      if (this.isInitiator) {
        console.log('📤 Creating offer...');
        console.log('📤 User ID:', this.userId);
        console.log('📤 Partner ID:', this.partnerId);
        console.log('📤 Room ID:', this.currentRoomId);

        const offer = await this.peerConnection.createOffer({
          offerToReceiveAudio: true,
          offerToReceiveVideo: true
        });

        await this.peerConnection.setLocalDescription(offer);
        console.log('📤 Local description set');

        // Send offer via PubNub
        await this.sendSignal('offer', offer);
        console.log('✅ Offer sent via PubNub');
      } else {
        console.log('📱 Waiting as receiver (not initiator)');
        console.log('📱 User ID:', this.userId);
        console.log('📱 Partner ID:', this.partnerId);
      }

    } catch (error) {
      console.error('❌ Failed to start WebRTC connection:', error);
    }
  }

  private setupPeerConnectionHandlers(): void {
    if (!this.peerConnection) return;

    // Connection state changes
    this.peerConnection.onconnectionstatechange = () => {
      const state = this.peerConnection!.connectionState;
      console.log('🔗 Connection state:', state);

      // Debug: Check if we have senders/receivers
      const senders = this.peerConnection!.getSenders();
      const receivers = this.peerConnection!.getReceivers();
      console.log('📡 Senders count:', senders.length);
      console.log('📡 Receivers count:', receivers.length);

      if (state === 'connected') {
        console.log('🎥 Checking streams on connection...');
        console.log('🎥 Local stream tracks:', this.localStream?.getTracks().length || 0);
        console.log('🎥 Remote stream tracks:', this.remoteStream?.getTracks().length || 0);
      }

      if (this.onConnectionStateCallback) {
        this.onConnectionStateCallback(state);
      }
    };

    // ICE candidates
    this.peerConnection.onicecandidate = (event) => {
      if (event.candidate) {
        console.log('🧊 Sending ICE candidate');
        this.sendSignal('ice-candidate', event.candidate);
      }
    };

    // Remote stream
    this.peerConnection.ontrack = (event) => {
      console.log('📹 Remote stream received!');
      console.log('📹 Track kind:', event.track.kind);
      console.log('📹 Streams count:', event.streams?.length || 0);

      if (event.streams && event.streams[0]) {
        this.remoteStream = event.streams[0];
        console.log('📹 Remote stream set with tracks:', this.remoteStream.getTracks().length);

        if (this.onRemoteStreamCallback) {
          this.onRemoteStreamCallback(this.remoteStream);
        }
      }
    };
  }

  private async sendSignal(type: 'offer' | 'answer' | 'ice-candidate', data: RTCSessionDescriptionInit | RTCIceCandidateInit): Promise<void> {
    if (!this.currentRoomId) {
      console.error('❌ Cannot send signal: missing room info');
      return;
    }

    console.log(`📤 Sending ${type} signal via PubNub`);

    try {
      // Send WebRTC signal via PubNub
      pubnubService.sendWebRTCSignal({
        type,
        data,
        from: this.userId,
        to: this.partnerId || '',
        chatId: this.currentRoomId
      });

      console.log(`✅ ${type} signal sent via PubNub`);
    } catch (error) {
      console.error('❌ Failed to send signal via PubNub:', error);
    }
  }

  // Handle incoming WebRTC signals from PubNub
  async handleIncomingSignal(signal: { type: string; data: RTCSessionDescriptionInit | RTCIceCandidateInit }): Promise<void> {
    console.log('📨 Received signal:', signal.type, 'Current state:', this.peerConnection?.signalingState);

    if (!this.peerConnection) {
      console.log('⚠️ No peer connection, ignoring signal');
      return;
    }

    try {
      switch (signal.type) {
        case 'offer':
          await this.handleOffer(signal.data as RTCSessionDescriptionInit);
          break;
        case 'answer':
          await this.handleAnswer(signal.data as RTCSessionDescriptionInit);
          break;
        case 'ice-candidate':
          await this.handleIceCandidate(signal.data as RTCIceCandidateInit);
          break;
        default:
          console.log('⚠️ Unknown signal type:', signal.type);
      }
    } catch (error) {
      console.error('❌ Error handling signal:', error);
      console.error('❌ Current signaling state:', this.peerConnection?.signalingState);
      console.error('❌ Signal details:', signal);
    }
  }

  private async handleOffer(offer: RTCSessionDescriptionInit): Promise<void> {
    console.log('📥 Handling offer, current state:', this.peerConnection!.signalingState);

    // Only handle offer if we're in stable state or have-local-offer state
    if (this.peerConnection!.signalingState !== 'stable' && this.peerConnection!.signalingState !== 'have-local-offer') {
      console.log('⚠️ Cannot handle offer in state:', this.peerConnection!.signalingState);
      return;
    }

    // If we're the initiator and in have-local-offer state, we have a race condition
    // Use user ID comparison to deterministically resolve who should be initiator
    if (this.isInitiator && this.peerConnection!.signalingState === 'have-local-offer') {
      console.log('🔄 Race condition detected: both users sent offers');
      // The user with the lexicographically smaller user ID becomes the receiver
      if (this.userId < (this.partnerId || '')) {
        console.log('🔄 Becoming receiver (smaller user ID)');
        this.isInitiator = false;
      } else {
        console.log('🔄 Staying as initiator (larger user ID), ignoring offer');
        return; // Ignore the offer and let our offer be processed by the other side
      }
    }

    await this.peerConnection!.setRemoteDescription(new RTCSessionDescription(offer));

    // Create and send answer
    const answer = await this.peerConnection!.createAnswer();
    await this.peerConnection!.setLocalDescription(answer);

    await this.sendSignal('answer', answer);
    console.log('✅ Answer sent');

    // Process queued ICE candidates
    this.processQueuedIceCandidates();
  }

  private async handleAnswer(answer: RTCSessionDescriptionInit): Promise<void> {
    console.log('📥 Handling answer, current state:', this.peerConnection!.signalingState);

    // Only handle answer if we're in have-local-offer state (we sent an offer)
    if (this.peerConnection!.signalingState !== 'have-local-offer') {
      console.log('⚠️ Cannot handle answer in state:', this.peerConnection!.signalingState, 'Expected: have-local-offer');
      return;
    }

    await this.peerConnection!.setRemoteDescription(new RTCSessionDescription(answer));
    console.log('✅ Answer processed successfully');

    // Process queued ICE candidates
    this.processQueuedIceCandidates();
  }

  private async handleIceCandidate(candidateData: RTCIceCandidateInit): Promise<void> {
    console.log('🧊 Handling ICE candidate');

    if (!this.peerConnection!.remoteDescription) {
      // Queue candidate for later
      this.iceCandidateQueue.push(candidateData);
      console.log('📦 Queued ICE candidate');
      return;
    }

    try {
      const candidate = new RTCIceCandidate(candidateData);
      await this.peerConnection!.addIceCandidate(candidate);
      console.log('✅ ICE candidate added');
    } catch (error) {
      console.error('❌ Error adding ICE candidate:', error);
    }
  }

  private async processQueuedIceCandidates(): Promise<void> {
    console.log(`📦 Processing ${this.iceCandidateQueue.length} queued ICE candidates`);

    for (const candidateData of this.iceCandidateQueue) {
      try {
        const candidate = new RTCIceCandidate(candidateData);
        await this.peerConnection!.addIceCandidate(candidate);
      } catch (error) {
        console.error('❌ Error adding queued ICE candidate:', error);
      }
    }

    this.iceCandidateQueue = [];
  }

  private cleanup(): void {
    console.log('🧹 Cleaning up...');

    // Stop status checking
    this.stopStatusChecking();

    // Disconnect from PubNub (handled by pubnubService internally)

    // Close peer connection
    if (this.peerConnection) {
      this.peerConnection.close();
      this.peerConnection = null;
    }

    // Stop local stream
    if (this.localStream) {
      this.localStream.getTracks().forEach(track => track.stop());
      this.localStream = null;
    }

    // Reset state
    this.remoteStream = null;
    this.currentRoomId = null;
    this.partnerId = null;
    this.isInitiator = false;
    this.iceCandidateQueue = [];

    console.log('✅ Cleanup complete');
  }
}

// Export singleton instance
export const cleanVideoChatService = new CleanVideoChatService();
