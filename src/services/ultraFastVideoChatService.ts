import { api } from '../api/baseAPI';
import { useAuthStore } from '../store/auth';
import { pubnubService } from './pubnubService';

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
 * Ultra-Fast Video Chat Service
 * - Sub-second connection times
 * - Aggressive optimization for speed
 * - Persistent stream handling
 */
export class UltraFastVideoChatService {
  private peerConnection: RTCPeerConnection | null = null;
  private localStream: MediaStream | null = null;
  private remoteStream: MediaStream | null = null;
  private currentRoomId: string | null = null;
  private partnerId: string | null = null;
  private isInitiator: boolean = false;
  private sessionVersion: string | null = null;
  private statusCheckInterval: NodeJS.Timeout | null = null;

  // Ultra-fast settings
  private readonly STATUS_CHECK_INTERVAL = 500; // 500ms vs 2s
  private readonly CONNECTION_TIMEOUT_MS = 5000; // 5s vs 15s
  private readonly ICE_GATHERING_TIMEOUT = 2000; // 2s max ICE gathering

  // Stream persistence
  private streamCache = new Map<string, MediaStream>();
  private connectionRetryCount = 0;
  private readonly MAX_RETRIES = 2;

  // Event callbacks
  private onRemoteStreamCallback: ((stream: MediaStream) => void) | null = null;
  private onLocalStreamCallback: ((stream: MediaStream) => void) | null = null;
  private onConnectionStateCallback: ((state: ConnectionState) => void) | null = null;
  private onPartnerLeftCallback: (() => void) | null = null;
  private onMessageReceivedCallback: ((message: { from: string; text: string; timestamp: number; id?: string }) => void) | null = null;
  private onVideoMatchCallback: ((videoData: VideoMatchData) => void) | null = null;
  private onErrorCallback: ((error: string) => void) | null = null;

  // Pre-connection optimization
  private preConnectedPeerConnection: RTCPeerConnection | null = null;
  private iceCandidatesBuffer: RTCIceCandidate[] = [];

  constructor() {
    this.setupPageUnloadHandler();
    this.preInitializeConnection(); // Pre-initialize for speed
  }

  // =============================================================================
  // PRE-CONNECTION OPTIMIZATION
  // =============================================================================

  private preInitializeConnection(): void {
    // Pre-create peer connection for instant use
    this.preConnectedPeerConnection = new RTCPeerConnection({
      iceServers: [
        { urls: 'stun:stun.l.google.com:19302' },
        { urls: 'stun:stun1.l.google.com:19302' }
      ],
      iceCandidatePoolSize: 20, // Higher pool for faster connections
      iceTransportPolicy: 'all',
      bundlePolicy: 'max-bundle',
      rtcpMuxPolicy: 'require'
    });
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
  // ULTRA-FAST MATCHING
  // =============================================================================

  public async joinQueue(): Promise<void> {
    try {
      // Parallel initialization for maximum speed
      const [authResult, streamResult, joinResult] = await Promise.all([
        this.ensureAuthentication(),
        this.initializeLocalStreamFast(),
        this.sendJoinRequest()
      ]);

      this.startUltraFastStatusChecking();
    } catch (error) {
      this.handleError('Failed to join queue', error as Error);
      throw error;
    }
  }

  public async swipeNext(): Promise<void> {
    try {
      // Ultra-fast room cleanup
      this.cleanupCurrentSessionFast();

      // Send swipe request immediately
      await this.sendSwipeRequest();

      // Start checking for new match
      this.startUltraFastStatusChecking();
    } catch (error) {
      this.handleError('Failed to swipe', error as Error);
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
      this.cleanupCurrentSessionFast();
      await this.sendLeaveRequest();
    } catch (error) {
      // Silent error handling for leave
    } finally {
      this.cleanup();
    }
  }

  // =============================================================================
  // ULTRA-FAST AUTHENTICATION & STREAMS
  // =============================================================================

  private async ensureAuthentication(): Promise<string> {
    const userId = this.getAuthenticatedUserId();
    if (!userId) throw new Error('Authentication required');
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
      // Silent error
    }

    return null;
  }

  private async initializeLocalStreamFast(): Promise<void> {
    // Check cache first for instant stream
    const cachedStream = this.streamCache.get('local');
    if (cachedStream && cachedStream.active) {
      this.localStream = cachedStream;
      if (this.onLocalStreamCallback) {
        this.onLocalStreamCallback(this.localStream);
      }
      return;
    }

    try {
      // Ultra-fast stream acquisition
      this.localStream = await navigator.mediaDevices.getUserMedia({
        video: {
          width: { ideal: 640 },
          height: { ideal: 480 },
          frameRate: { ideal: 30 }
        },
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true
        }
      });

      // Cache for future use
      this.streamCache.set('local', this.localStream);

      if (this.onLocalStreamCallback) {
        this.onLocalStreamCallback(this.localStream);
      }
    } catch {
      throw new Error('Camera/microphone access denied');
    }
  }

  // =============================================================================
  // ULTRA-FAST STATUS CHECKING
  // =============================================================================

  private startUltraFastStatusChecking(): void {
    this.stopStatusChecking();

    this.statusCheckInterval = setInterval(async () => {
      try {
        await this.checkMatchStatusFast();
      } catch (error) {
        // Silent error handling
      }
    }, this.STATUS_CHECK_INTERVAL);
  }

  private stopStatusChecking(): void {
    if (this.statusCheckInterval) {
      clearInterval(this.statusCheckInterval);
      this.statusCheckInterval = null;
    }
  }

  private async checkMatchStatusFast(): Promise<void> {
    const response = await api.get('/video_chat/status') as MatchResponse;

    if (response.status === 'matched') {
      this.stopStatusChecking();

      // Immediate match handling - no delays
      await this.handleMatchUltraFast(response);
    }
  }

  // =============================================================================
  // ULTRA-FAST MATCH HANDLING
  // =============================================================================

  private async handleMatchUltraFast(matchData: MatchResponse): Promise<void> {
    const matchType = this.determineMatchType(matchData);

    if (matchType === 'video') {
      this.handleVideoMatchInstant(matchData);
    } else {
      await this.handleLiveMatchUltraFast(matchData, matchType);
    }
  }

  private determineMatchType(matchData: MatchResponse): 'video' | 'real_user' | 'staff' {
    if (matchData.video_id && matchData.video_url) return 'video';
    if (matchData.partner?.id && matchData.partner.id !== 'video') {
      return matchData.match_type === 'staff' ? 'staff' : 'real_user';
    }
    return 'real_user';
  }

  private handleVideoMatchInstant(matchData: MatchResponse): void {
    const videoData: VideoMatchData = {
      videoId: matchData.video_id?.toString() || 'unknown',
      videoUrl: matchData.video_url || '',
      videoName: matchData.video_name || 'Video'
    };

    this.currentRoomId = matchData.room_id || null;

    // Instant callbacks - no await
    if (this.onVideoMatchCallback) {
      this.onVideoMatchCallback(videoData);
    }

    if (this.onConnectionStateCallback) {
      this.onConnectionStateCallback({ type: 'connected', matchType: 'video' });
    }
  }

  // =============================================================================
  // ULTRA-FAST WEBRTC CONNECTION
  // =============================================================================

  private async handleLiveMatchUltraFast(matchData: MatchResponse, matchType: 'real_user' | 'staff'): Promise<void> {
    // Set match data instantly
    this.currentRoomId = matchData.room_id || null;
    this.partnerId = matchData.partner.id.toString();
    this.isInitiator = matchData.is_initiator;
    this.sessionVersion = matchData.session_version || null;

    // Use pre-connected peer connection for speed
    this.peerConnection = this.preConnectedPeerConnection;
    this.preInitializeConnection(); // Prepare next connection

    // Add local stream immediately
    if (this.localStream && this.peerConnection) {
      this.localStream.getTracks().forEach(track => {
        this.peerConnection!.addTrack(track, this.localStream!);
      });
    }

    // Setup event handlers
    this.setupPeerConnectionHandlers();

    // Parallel connection setup - NO await for maximum speed
    Promise.all([
      this.setupPubNubConnectionFast(),
      this.startWebRTCConnectionFast()
    ]).catch(() => {
      // Error handling without blocking
    });

    // Immediate state update
    if (this.onConnectionStateCallback) {
      this.onConnectionStateCallback({ type: 'connecting', matchType });
    }
  }

  private setupPeerConnectionHandlers(): void {
    if (!this.peerConnection) return;

    // Handle remote stream - IMMEDIATE callback
    this.peerConnection.ontrack = (event) => {
      const [remoteStream] = event.streams;
      if (remoteStream) {
        this.remoteStream = remoteStream;

        // Cache stream for persistence
        this.streamCache.set(`remote_${this.partnerId}`, remoteStream);

        // Instant callback
        if (this.onRemoteStreamCallback) {
          this.onRemoteStreamCallback(remoteStream);
        }

        if (this.onConnectionStateCallback) {
          this.onConnectionStateCallback({
            type: 'connected',
            matchType: this.partnerId ? 'real_user' : 'staff'
          });
        }
      }
    };

    // Fast ICE candidate handling
    this.peerConnection.onicecandidate = (event) => {
      if (event.candidate && this.partnerId) {
        pubnubService.sendIceCandidate(this.partnerId, event.candidate);
      }
    };

    // Connection state monitoring
    this.peerConnection.onconnectionstatechange = () => {
      const state = this.peerConnection?.connectionState;
      if (state === 'failed' && this.connectionRetryCount < this.MAX_RETRIES) {
        this.connectionRetryCount++;
        this.retryConnectionFast();
      }
    };
  }

  private async setupPubNubConnectionFast(): Promise<void> {
    if (!this.currentRoomId || !this.partnerId) return;

    pubnubService.join(this.currentRoomId, this.sessionVersion || '', this.getAuthenticatedUserId()!, {
      onMessage: (signal) => {
        this.handleWebRTCSignalFast(signal);
      },
      onJoin: () => {
        pubnubService.sendReady(this.partnerId!);
      },
      onError: () => {
        // Silent error handling
      }
    });
  }

  private async startWebRTCConnectionFast(): Promise<void> {
    if (!this.peerConnection || !this.partnerId) return;

    if (this.isInitiator) {
      try {
        // Fast offer creation
        const offer = await this.peerConnection.createOffer({
          offerToReceiveAudio: true,
          offerToReceiveVideo: true
        });

        await this.peerConnection.setLocalDescription(offer);
        await pubnubService.sendOffer(this.partnerId, offer.sdp || '');
      } catch (error) {
        this.retryConnectionFast();
      }
    }
  }

  // =============================================================================
  // ULTRA-FAST SIGNAL HANDLING
  // =============================================================================

  private async handleWebRTCSignalFast(signal: any): Promise<void> {
    if (!this.peerConnection || !signal) return;

    const myUserId = this.getAuthenticatedUserId();
    if (signal.to !== myUserId) return;

    try {
      switch (signal.type) {
        case 'offer':
          if (signal.sdp) {
            await this.peerConnection.setRemoteDescription({ type: 'offer', sdp: signal.sdp });
            const answer = await this.peerConnection.createAnswer();
            await this.peerConnection.setLocalDescription(answer);
            await pubnubService.sendAnswer(this.partnerId!, answer.sdp || '');
          }
          break;

        case 'answer':
          if (signal.sdp) {
            await this.peerConnection.setRemoteDescription({ type: 'answer', sdp: signal.sdp });
          }
          break;

        case 'ice':
          if (signal.candidate) {
            await this.peerConnection.addIceCandidate(signal.candidate);
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
      // Silent error handling for speed
    }
  }

  // =============================================================================
  // FAST RETRY & RECOVERY
  // =============================================================================

  private async retryConnectionFast(): Promise<void> {
    if (this.connectionRetryCount >= this.MAX_RETRIES) return;

    // Check for cached stream first
    const cachedStream = this.streamCache.get(`remote_${this.partnerId}`);
    if (cachedStream && cachedStream.active) {
      this.remoteStream = cachedStream;
      if (this.onRemoteStreamCallback) {
        this.onRemoteStreamCallback(cachedStream);
      }
      return;
    }

    // Fast reconnection
    this.cleanupCurrentSessionFast();
    await this.swipeNext();
  }

  // =============================================================================
  // ULTRA-FAST CLEANUP
  // =============================================================================

  private cleanupCurrentSessionFast(): void {
    this.stopStatusChecking();

    // Keep streams for persistence - don't close them
    if (this.peerConnection) {
      this.peerConnection.close();
      this.peerConnection = null;
    }

    // Quick state reset
    this.currentRoomId = null;
    this.partnerId = null;
    this.sessionVersion = null;
    this.isInitiator = false;
    this.connectionRetryCount = 0;

    pubnubService.leave();
  }

  public cleanup(): void {
    this.cleanupCurrentSessionFast();

    // Only cleanup streams on final cleanup
    this.streamCache.forEach(stream => {
      stream.getTracks().forEach(track => track.stop());
    });
    this.streamCache.clear();

    if (this.localStream) {
      this.localStream.getTracks().forEach(track => track.stop());
      this.localStream = null;
    }
  }

  // =============================================================================
  // API REQUESTS (FAST)
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
  // ERROR HANDLING & UTILS
  // =============================================================================

  private handleError(message: string, error?: Error): void {
    if (this.onErrorCallback) {
      this.onErrorCallback(message);
    }
  }

  private setupPageUnloadHandler(): void {
    if (typeof window === 'undefined') return;

    const handlePageUnload = () => {
      const userId = this.getAuthenticatedUserId();
      const token = localStorage.getItem('juicyMeetsAuthToken');

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
export const ultraFastVideoChatService = new UltraFastVideoChatService();
