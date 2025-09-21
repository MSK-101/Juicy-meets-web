import { api } from '../api/baseAPI';
import { useAuthStore } from '../store/auth';
import { pubnubService } from './pubnubService';

export interface WebRTCSignalData {
  type: 'offer' | 'answer' | 'ice-candidate';
  data: RTCSessionDescriptionInit | RTCIceCandidateInit;
  target_user_id: string;
}

export interface VideoMatchData {
  videoId: string;
  videoUrl: string;
  videoName: string;
}

export interface ConnectionState {
  type: 'connecting' | 'connected' | 'failed' | 'disconnected';
  matchType?: 'video' | 'real_user' | 'staff';
}

interface MatchResponse {
  status: string;
  room_id: string;
  match_type: string;
  partner: { id: string };
  is_initiator: boolean;
  session_version?: string;
  video_id?: string;
  video_url?: string;
  video_name?: string;
}

/**
 * Optimized Video Chat Service - Performance Focused
 * - Minimal logging for production speed
 * - Fast room switching and cleanup
 * - Optimized WebRTC connections
 */
export class OptimizedVideoChatService {
  private peerConnection: RTCPeerConnection | null = null;
  private localStream: MediaStream | null = null;
  private remoteStream: MediaStream | null = null;
  private currentRoomId: string | null = null;
  private partnerId: string | null = null;
  private isInitiator: boolean = false;
  private sessionVersion: string | null = null;
  private statusCheckInterval: NodeJS.Timeout | null = null;
  private iceCandidateQueue: RTCIceCandidateInit[] = [];

  // Cleanup functions for PubNub listeners
  private webrtcSignalCleanup: (() => void) | null = null;
  private generalMessageCleanup: (() => void) | null = null;

  // Event callbacks
  private onRemoteStreamCallback: ((stream: MediaStream) => void) | null = null;
  private onLocalStreamCallback: ((stream: MediaStream) => void) | null = null;
  private onConnectionStateCallback: ((state: ConnectionState) => void) | null = null;
  private onPartnerLeftCallback: (() => void) | null = null;
  private onMessageReceivedCallback: ((message: { from: string; text: string; timestamp: number; id?: string }) => void) | null = null;
  private onVideoMatchCallback: ((videoData: VideoMatchData) => void) | null = null;
  private onErrorCallback: ((error: string) => void) | null = null;

  // Connection optimization
  private connectionTimeoutId: NodeJS.Timeout | null = null;
  private readonly CONNECTION_TIMEOUT_MS = 15000; // Reduced from 40s to 15s
  private readonly STATUS_CHECK_INTERVAL = 2000; // Reduced from 3s to 2s

  // Prevent duplicate processing
  private processedSignals = new Set<string>();
  private currentMatchProcessing = false;

  // Ready signal tracking
  private hasSentReadySignal = false;
  private partnerReadyReceived = false;

  constructor() {
    // Only essential initialization logging
    if (process.env.NODE_ENV === 'development') {
    }
    this.setupPageUnloadHandler();
  }

  // =============================================================================
  // PUBLIC API METHODS
  // =============================================================================

  public onRemoteStream(callback: (stream: MediaStream) => void): void {
    this.onRemoteStreamCallback = callback;
  }

  public onLocalStream(callback: (stream: MediaStream) => void): void {
    this.onLocalStreamCallback = callback;
  }

  public onConnectionStateChange(callback: (state: ConnectionState) => void): void {
    this.onConnectionStateCallback = callback;
  }

  public onPartnerLeft(callback: () => void): void {
    this.onPartnerLeftCallback = callback;
  }

  public onMessageReceived(callback: (message: { from: string; text: string; timestamp: number; id?: string }) => void): void {
    this.onMessageReceivedCallback = callback;
  }

  public onVideoMatch(callback: (videoData: VideoMatchData) => void): void {
    this.onVideoMatchCallback = callback;
  }

  public onError(callback: (error: string) => void): void {
    this.onErrorCallback = callback;
  }

  public getCurrentLocalStream(): MediaStream | null {
    return this.localStream;
  }

  public getCurrentRemoteStream(): MediaStream | null {
    return this.remoteStream;
  }

  // =============================================================================
  // CORE MATCHING LOGIC
  // =============================================================================

  public async joinQueue(): Promise<void> {
    try {
      await this.ensureAuthentication();
      await this.initializeLocalStream();
      await this.sendJoinRequest();
      this.startStatusChecking();
    } catch (error) {
      this.handleError('Failed to join queue', error as Error);
      throw error;
    }
  }

  public async swipeNext(): Promise<void> {
    if (this.currentMatchProcessing) return;

    try {
      this.currentMatchProcessing = true;
      await this.leaveCurrentRoom();
      await this.sendSwipeRequest();
      this.startStatusChecking();
    } catch (error) {
      this.handleError('Failed to swipe', error as Error);
    } finally {
      this.currentMatchProcessing = false;
    }
  }

  public async sendMessage(text: string): Promise<void> {
    if (!this.currentRoomId || !text.trim() || !this.partnerId) return;

    try {
      const messageId = `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      await pubnubService.sendChatMessage(this.partnerId, text.trim(), messageId);
    } catch (error) {
      this.handleError('Failed to send message', error as Error);
    }
  }

  public async leaveChat(): Promise<void> {
    try {
      await this.leaveCurrentRoom();
      await this.sendLeaveRequest();
    } catch (error) {
      if (process.env.NODE_ENV === 'development') {
        
      }
    } finally {
      this.cleanup();
    }
  }

  // =============================================================================
  // AUTHENTICATION & INITIALIZATION
  // =============================================================================

  private async ensureAuthentication(): Promise<string> {
    const userId = this.getAuthenticatedUserId();
    if (!userId) {
      throw new Error('Authentication required');
    }

    // Quick token validation
    const token = this.getAuthToken();
    if (!token) {
      throw new Error('No auth token found');
    }

    return userId;
  }

  private getAuthenticatedUserId(): string | null {
    if (typeof window === 'undefined') return null;

    const user = useAuthStore.getState().user;
    if (user?.id) return user.id.toString();

    try {
      const storedUser = localStorage.getItem('juicyMeetsUser');
      if (storedUser) {
        const userData = JSON.parse(storedUser);
        return userData.id?.toString() || null;
      }
    } catch {
      // Silent error handling
    }

    return null;
  }

  private getAuthToken(): string | null {
    if (typeof window === 'undefined') return null;
    return localStorage.getItem('juicyMeetsAuthToken');
  }

  private async initializeLocalStream(): Promise<void> {
    if (this.localStream) return;

    try {
      this.localStream = await navigator.mediaDevices.getUserMedia({
        video: { width: 640, height: 480 }, // Reduced resolution for performance
        audio: true
      });

      if (this.onLocalStreamCallback) {
        this.onLocalStreamCallback(this.localStream);
      }
    } catch {
      throw new Error('Camera/microphone access denied');
    }
  }

  // =============================================================================
  // API REQUESTS
  // =============================================================================

  private async sendJoinRequest(): Promise<void> {
    const response = await api.post('/video_chat/join', {}) as { status: string };
    if (response.status !== 'success' && response.status !== 'waiting') {
      throw new Error(`Join failed: ${response.status}`);
    }
  }

  private async sendSwipeRequest(): Promise<void> {
    await api.post('/video_chat/swipe', {});
  }

  private async sendLeaveRequest(): Promise<void> {
    await api.post('/video_chat/leave', {});
  }

  // =============================================================================
  // STATUS CHECKING & MATCH HANDLING
  // =============================================================================

  private startStatusChecking(): void {
    this.stopStatusChecking();

    this.statusCheckInterval = setInterval(async () => {
      try {
        await this.checkMatchStatus();
      } catch (error) {
        if (process.env.NODE_ENV === 'development') {
          
        }
      }
    }, this.STATUS_CHECK_INTERVAL);
  }

  private stopStatusChecking(): void {
    if (this.statusCheckInterval) {
      clearInterval(this.statusCheckInterval);
      this.statusCheckInterval = null;
    }
  }

  private async checkMatchStatus(): Promise<void> {
    if (this.currentMatchProcessing) return;

    const response = await api.get('/video_chat/status') as {
      status: string;
      room_id: string;
      match_type: string;
      partner: { id: string };
      is_initiator: boolean;
      session_version?: string;
      video_id?: string;
      video_url?: string;
      video_name?: string;
    };

    if (response.status === 'matched') {
      this.currentMatchProcessing = true;
      this.stopStatusChecking();

      try {
        await this.handleMatch(response);
      } finally {
        this.currentMatchProcessing = false;
      }
    }
  }

  private async handleMatch(matchData: MatchResponse): Promise<void> {
    // Determine match type based on backend response
    const matchType = this.determineMatchType(matchData);

    if (matchType === 'video') {
      await this.handleVideoMatch(matchData);
    } else {
      await this.handleLiveMatch(matchData, matchType);
    }
  }

  private determineMatchType(matchData: MatchResponse): 'video' | 'real_user' | 'staff' {
    // Video match: has video data
    if (matchData.video_id && matchData.video_url) {
      return 'video';
    }

    // Live match: has partner data
    if (matchData.partner?.id && matchData.partner.id !== 'video') {
      return matchData.match_type === 'staff' ? 'staff' : 'real_user';
    }

    // Fallback
    return (matchData.match_type as 'video' | 'real_user' | 'staff') || 'real_user';
  }

  // =============================================================================
  // VIDEO MATCH HANDLING
  // =============================================================================

  private async handleVideoMatch(matchData: MatchResponse): Promise<void> {
    const videoData: VideoMatchData = {
      videoId: matchData.video_id?.toString() || 'unknown',
      videoUrl: matchData.video_url || '',
      videoName: matchData.video_name || 'Video'
    };

    this.currentRoomId = matchData.room_id || null;

    if (this.onVideoMatchCallback) {
      this.onVideoMatchCallback(videoData);
    }

    if (this.onConnectionStateCallback) {
      this.onConnectionStateCallback({ type: 'connected', matchType: 'video' });
    }
  }

  // =============================================================================
  // LIVE MATCH HANDLING (WebRTC)
  // =============================================================================

  private async handleLiveMatch(matchData: MatchResponse, matchType: 'real_user' | 'staff'): Promise<void> {
    // Set match data
    this.currentRoomId = matchData.room_id || null;
    this.partnerId = matchData.partner.id.toString();
    this.isInitiator = matchData.is_initiator;
    this.sessionVersion = matchData.session_version || null;

    // Reset connection state
    this.hasSentReadySignal = false;
    this.partnerReadyReceived = false;
    this.processedSignals.clear();

    // Validate required data
    if (!this.currentRoomId || !this.partnerId || !this.sessionVersion) {
      throw new Error('Invalid match data received');
    }

    // Setup connections in parallel for speed
    await Promise.all([
      this.setupPubNubConnection(),
      this.setupPeerConnection()
    ]);

    // Start WebRTC connection
    if (this.isInitiator) {
      await this.startWebRTCConnection();
    }

    if (this.onConnectionStateCallback) {
      this.onConnectionStateCallback({ type: 'connecting', matchType });
    }

    // Set connection timeout
    this.startConnectionTimeout();
  }

  // =============================================================================
  // PUBNUB CONNECTION
  // =============================================================================

  private async setupPubNubConnection(): Promise<void> {
    if (!this.currentRoomId || !this.partnerId) return;

    // Cleanup existing connections
    this.cleanupPubNubListeners();

    // Connect to PubNub using the join method
    pubnubService.join(this.currentRoomId, this.sessionVersion || '', this.getAuthenticatedUserId()!, {
      onMessage: (signal) => {
        this.handleWebRTCSignal(signal);
      },
      onJoin: () => {
        // Connection established
        this.sendReadySignal();
      },
      onError: (error) => {
        this.handleError('PubNub connection error', error as Error);
      }
    });
  }

  private async sendReadySignal(): Promise<void> {
    if (!this.partnerId || this.hasSentReadySignal) return;

    await pubnubService.sendReady(this.partnerId);
    this.hasSentReadySignal = true;
  }

  // =============================================================================
  // WEBRTC CONNECTION
  // =============================================================================

  private async setupPeerConnection(): Promise<void> {
    // Close existing connection
    if (this.peerConnection) {
      this.peerConnection.close();
    }

    // Create new peer connection with optimized config
    this.peerConnection = new RTCPeerConnection({
      iceServers: [
        { urls: 'stun:stun.l.google.com:19302' },
        { urls: 'stun:stun1.l.google.com:19302' }
      ],
      iceCandidatePoolSize: 10 // Pregenerate candidates for faster connection
    });

    // Add local stream
    if (this.localStream) {
      this.localStream.getTracks().forEach(track => {
        this.peerConnection!.addTrack(track, this.localStream!);
      });
    }

    // Handle remote stream
    this.peerConnection.ontrack = (event) => {
      const [remoteStream] = event.streams;
      if (remoteStream && this.onRemoteStreamCallback) {
        this.remoteStream = remoteStream;
        this.onRemoteStreamCallback(remoteStream);

        if (this.onConnectionStateCallback) {
          this.onConnectionStateCallback({
            type: 'connected',
            matchType: this.partnerId ? 'real_user' : 'staff'
          });
        }

        this.clearConnectionTimeout();
      }
    };

    // Handle ICE candidates
    this.peerConnection.onicecandidate = (event) => {
      if (event.candidate && this.partnerId) {
        pubnubService.sendIceCandidate(this.partnerId, event.candidate);
      }
    };

    // Handle connection state changes
    this.peerConnection.onconnectionstatechange = () => {
      const state = this.peerConnection?.connectionState;
      if (state === 'connected') {
        this.clearConnectionTimeout();
      } else if (state === 'failed' || state === 'disconnected') {
        this.handleConnectionFailure();
      }
    };
  }

  private async startWebRTCConnection(): Promise<void> {
    if (!this.peerConnection || !this.currentRoomId) return;

    try {
      // Create and send offer
      const offer = await this.peerConnection.createOffer({
        offerToReceiveAudio: true,
        offerToReceiveVideo: true
      });

      await this.peerConnection.setLocalDescription(offer);

      await pubnubService.sendOffer(this.partnerId!, offer.sdp || '');
    } catch (error) {
      this.handleError('Failed to create WebRTC offer', error as Error);
    }
  }

  // =============================================================================
  // WEBRTC SIGNAL HANDLING
  // =============================================================================

  private async handleWebRTCSignal(signal: any): Promise<void> {
    if (!this.peerConnection || !signal) return;

    const myUserId = this.getAuthenticatedUserId();

    // Only process signals intended for us
    if (signal.to !== myUserId) return;

    // Generate signal ID for deduplication
    const signalId = `${signal.type}_${signal.from}_${Date.now()}`;
    if (this.processedSignals.has(signalId)) return;
    this.processedSignals.add(signalId);

    try {
      switch (signal.type) {
        case 'ready':
          this.partnerReadyReceived = true;
          break;

        case 'offer':
          if (signal.sdp) {
            await this.handleOffer({ type: 'offer', sdp: signal.sdp });
          }
          break;

        case 'answer':
          if (signal.sdp) {
            await this.handleAnswer({ type: 'answer', sdp: signal.sdp });
          }
          break;

        case 'ice':
          if (signal.candidate) {
            await this.handleIceCandidate(signal.candidate);
          }
          break;

        case 'chat':
          if (this.onMessageReceivedCallback && signal.text) {
            this.onMessageReceivedCallback({
              from: signal.from,
              text: signal.text,
              timestamp: signal.timestamp || Date.now(),
              id: signal.id
            });
          }
          break;
      }
    } catch (error) {
      if (process.env.NODE_ENV === 'development') {
        
      }
    }
  }

  private async handleOffer(offer: RTCSessionDescriptionInit): Promise<void> {
    if (!this.peerConnection || !this.currentRoomId) return;

    await this.peerConnection.setRemoteDescription(offer);

    // Process queued ICE candidates
    await this.processQueuedIceCandidates();

      const answer = await this.peerConnection.createAnswer();
      await this.peerConnection.setLocalDescription(answer);

    await pubnubService.sendAnswer(this.partnerId!, answer.sdp || '');
  }

  private async handleAnswer(answer: RTCSessionDescriptionInit): Promise<void> {
    if (!this.peerConnection) return;

    await this.peerConnection.setRemoteDescription(answer);
    await this.processQueuedIceCandidates();
  }

  private async handleIceCandidate(candidate: RTCIceCandidateInit): Promise<void> {
    if (!this.peerConnection) return;

    if (this.peerConnection.remoteDescription) {
      await this.peerConnection.addIceCandidate(candidate);
    } else {
      this.iceCandidateQueue.push(candidate);
    }
  }

  private async processQueuedIceCandidates(): Promise<void> {
    if (!this.peerConnection) return;

    while (this.iceCandidateQueue.length > 0) {
      const candidate = this.iceCandidateQueue.shift();
      if (candidate) {
        try {
          await this.peerConnection.addIceCandidate(candidate);
    } catch {
      // Ignore ICE candidate errors
    }
      }
    }
  }

  // =============================================================================
  // CONNECTION TIMEOUT & ERROR HANDLING
  // =============================================================================

  private startConnectionTimeout(): void {
    this.clearConnectionTimeout();

    this.connectionTimeoutId = setTimeout(() => {
      this.handleConnectionFailure();
    }, this.CONNECTION_TIMEOUT_MS);
  }

  private clearConnectionTimeout(): void {
    if (this.connectionTimeoutId) {
      clearTimeout(this.connectionTimeoutId);
      this.connectionTimeoutId = null;
    }
  }

  private handleConnectionFailure(): void {
    this.clearConnectionTimeout();

    if (this.onConnectionStateCallback) {
      this.onConnectionStateCallback({ type: 'failed' });
    }

    // Auto-retry by getting next match
    setTimeout(() => {
      this.swipeNext();
    }, 2000);
  }

  private handleError(message: string, error?: Error): void {
    if (process.env.NODE_ENV === 'development') {
    }

    if (this.onErrorCallback) {
      this.onErrorCallback(message);
    }
  }

  // =============================================================================
  // CLEANUP & ROOM MANAGEMENT
  // =============================================================================

  private async leaveCurrentRoom(): Promise<void> {
    // Clear connection timeout
    this.clearConnectionTimeout();

    // Stop status checking
    this.stopStatusChecking();

    // Close WebRTC connection
    if (this.peerConnection) {
      this.peerConnection.close();
      this.peerConnection = null;
    }

    // Clear remote stream
    this.remoteStream = null;

    // Cleanup PubNub
    this.cleanupPubNubListeners();

    if (this.currentRoomId) {
      pubnubService.leave();
    }

    // Reset state
    this.currentRoomId = null;
    this.partnerId = null;
    this.sessionVersion = null;
    this.isInitiator = false;
    this.hasSentReadySignal = false;
    this.partnerReadyReceived = false;
    this.processedSignals.clear();
    this.iceCandidateQueue = [];

    // Notify partner left
    if (this.onPartnerLeftCallback) {
      this.onPartnerLeftCallback();
    }
  }

  private cleanupPubNubListeners(): void {
    if (this.webrtcSignalCleanup) {
      this.webrtcSignalCleanup();
      this.webrtcSignalCleanup = null;
    }

    if (this.generalMessageCleanup) {
      this.generalMessageCleanup();
      this.generalMessageCleanup = null;
    }
  }

  public cleanup(): void {
    this.leaveCurrentRoom();

    // Stop local stream
    if (this.localStream) {
      this.localStream.getTracks().forEach(track => track.stop());
      this.localStream = null;
    }
  }

  // =============================================================================
  // PAGE UNLOAD HANDLING
  // =============================================================================

  private setupPageUnloadHandler(): void {
    if (typeof window === 'undefined') return;

    const handlePageUnload = () => {
      // Use sendBeacon for reliable cleanup during page unload
      const userId = this.getAuthenticatedUserId();
      const token = this.getAuthToken();

      if (userId && token && this.currentRoomId) {
        navigator.sendBeacon('/api/v1/video_chat/leave', JSON.stringify({}));
      }

      this.cleanup();
    };

    window.addEventListener('beforeunload', handlePageUnload);
    window.addEventListener('pagehide', handlePageUnload);
  }
}

// Export singleton instance
export const optimizedVideoChatService = new OptimizedVideoChatService();
