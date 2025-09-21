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

interface BackendMatchResponse {
  status: 'matched' | 'joined_queue' | 'not_in_queue';
  room_id?: string;
  match_type?: string;
  actual_match_type?: string;
  partner?: {
    id: string;
    type: string;
  };
  is_initiator?: boolean;
  session_id?: string;
  session_version?: string;
  video_id?: string;
  video_url?: string;
  video_name?: string;
  message?: string;
}

/**
 * Proper Video Chat Service
 * - Follows exact backend API contract
 * - Proper WebRTC setup order
 * - Reliable stream handling
 */
export class ProperVideoChatService {
  private peerConnection: RTCPeerConnection | null = null;
  private localStream: MediaStream | null = null;
  private remoteStream: MediaStream | null = null;

  // Match state from backend
  private currentRoomId: string | null = null;
  private partnerId: string | null = null;
  private isInitiator: boolean = false;
  private sessionVersion: string | null = null;
  private matchType: string | null = null;
  private actualMatchType: string | null = null;

  // Status checking
  private statusCheckInterval: NodeJS.Timeout | null = null;
  private readonly STATUS_CHECK_INTERVAL = 1000; // 1 second - reasonable speed

  // Connection state tracking
  private isConnecting = false;
  private hasReceivedTracks = false;
  private readySignalSent = false;

  // Event callbacks
  private onRemoteStreamCallback: ((stream: MediaStream) => void) | null = null;
  private onLocalStreamCallback: ((stream: MediaStream) => void) | null = null;
  private onConnectionStateCallback: ((state: ConnectionState) => void) | null = null;
  private onPartnerLeftCallback: (() => void) | null = null;
  private onMessageReceivedCallback: ((message: { from: string; text: string; timestamp: number; id?: string }) => void) | null = null;
  private onVideoMatchCallback: ((videoData: VideoMatchData) => void) | null = null;
  private onErrorCallback: ((error: string) => void) | null = null;

  constructor() {
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
  // MAIN PUBLIC METHODS
  // =============================================================================

  public async joinQueue(): Promise<void> {
    try {
      this.updateConnectionState('connecting');

      // Step 1: Get authenticated user
      const userId = this.getAuthenticatedUserId();
      if (!userId) {
        throw new Error('User authentication required');
      }

      // Step 2: Initialize local stream first
      await this.initializeLocalStream();

      // Step 3: Send join request to backend
      await this.sendJoinRequest();

      // Step 4: Start checking for matches
      this.startStatusChecking();

    } catch (error) {
      this.handleError('Failed to join queue', error as Error);
      throw error;
    }
  }

  public async swipeNext(): Promise<void> {
    try {
      this.updateConnectionState('connecting');

      // Step 1: Clean up current connection
      this.cleanupCurrentConnection();

      // Step 2: Send swipe request to backend
      await this.sendSwipeRequest();

      // Step 3: Start checking for new match
      this.startStatusChecking();

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
      this.cleanupCurrentConnection();
      await this.sendLeaveRequest();
    } catch (error) {
      // Silent error handling for leave
    } finally {
      this.cleanup();
    }
  }

  // =============================================================================
  // LOCAL STREAM INITIALIZATION
  // =============================================================================

  private async initializeLocalStream(): Promise<void> {
    if (this.localStream && this.localStream.active) {
      // Reuse existing stream
      if (this.onLocalStreamCallback) {
        this.onLocalStreamCallback(this.localStream);
      }
      return;
    }

    try {
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

      if (this.onLocalStreamCallback) {
        this.onLocalStreamCallback(this.localStream);
      }
    } catch (error) {
      throw new Error('Camera/microphone access denied. Please allow permissions and try again.');
    }
  }

  // =============================================================================
  // STATUS CHECKING (BACKEND POLLING)
  // =============================================================================

  private startStatusChecking(): void {
    this.stopStatusChecking();

    this.statusCheckInterval = setInterval(async () => {
      try {
        await this.checkMatchStatus();
      } catch (error) {
        // Continue checking even on errors
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
    try {
      const response = await api.get('/video_chat/status') as BackendMatchResponse;

      if (response.status === 'matched') {
        this.stopStatusChecking();
        await this.handleBackendMatch(response);
      }
      // If status is 'joined_queue', keep checking
      // If status is 'not_in_queue', we may need to rejoin

    } catch (error) {
      // Network error, keep trying
    }
  }

  // =============================================================================
  // BACKEND MATCH HANDLING
  // =============================================================================

  private async handleBackendMatch(matchData: BackendMatchResponse): Promise<void> {
    // Extract match information from backend response
    this.currentRoomId = matchData.room_id || null;
    this.partnerId = matchData.partner?.id || null;
    this.isInitiator = matchData.is_initiator || false;
    this.sessionVersion = matchData.session_version || null;
    this.matchType = matchData.match_type || null;
    this.actualMatchType = matchData.actual_match_type || null;

    // Determine if this is a video match or live chat
    if (this.actualMatchType === 'video' && matchData.video_id && matchData.video_url) {
      await this.handleVideoMatch(matchData);
    } else {
      await this.handleLiveMatch(matchData);
    }
  }

  private async handleVideoMatch(matchData: BackendMatchResponse): Promise<void> {
    const videoData: VideoMatchData = {
      videoId: matchData.video_id?.toString() || 'unknown',
      videoUrl: matchData.video_url || '',
      videoName: matchData.video_name || 'Video'
    };

    if (this.onVideoMatchCallback) {
      this.onVideoMatchCallback(videoData);
    }

    this.updateConnectionState('connected', 'video');
  }

  private async handleLiveMatch(matchData: BackendMatchResponse): Promise<void> {
    if (!this.currentRoomId || !this.partnerId || !this.sessionVersion) {
      throw new Error('Invalid match data from backend');
    }

    // Reset WebRTC state
    this.isConnecting = true;
    this.hasReceivedTracks = false;
    this.readySignalSent = false;

    try {
      // Step 1: Setup PubNub connection first
      await this.setupPubNubConnection();

      // Step 2: Setup WebRTC peer connection
      await this.setupPeerConnection();

      // Step 3: Start WebRTC handshake if initiator
      if (this.isInitiator) {
        await this.initiateWebRTCConnection();
      }

      // Update connection state
      this.updateConnectionState('connecting', this.actualMatchType as 'real_user' | 'staff');

    } catch (error) {
      this.handleError('Failed to setup live connection', error as Error);
    }
  }

  // =============================================================================
  // PUBNUB CONNECTION SETUP
  // =============================================================================

  private async setupPubNubConnection(): Promise<void> {
    if (!this.currentRoomId || !this.partnerId || !this.sessionVersion) {
      throw new Error('Missing room data for PubNub connection');
    }

    const userId = this.getAuthenticatedUserId();
    if (!userId) {
      throw new Error('User ID required for PubNub');
    }

    return new Promise<void>((resolve, reject) => {
      pubnubService.join(this.currentRoomId!, this.sessionVersion!, userId, {
        onMessage: (signal) => {
          this.handlePubNubMessage(signal);
        },
        onJoin: () => {
          resolve();
        },
        onError: (error) => {
          reject(error);
        }
      });
    });
  }

  // =============================================================================
  // WEBRTC PEER CONNECTION SETUP
  // =============================================================================

  private async setupPeerConnection(): Promise<void> {
    // Create peer connection with proper configuration
    this.peerConnection = new RTCPeerConnection({
      iceServers: [
        { urls: 'stun:stun.l.google.com:19302' },
        { urls: 'stun:stun1.l.google.com:19302' }
      ],
      iceCandidatePoolSize: 10
    });

    // Add local stream to peer connection
    if (this.localStream) {
      this.localStream.getTracks().forEach(track => {
        if (this.peerConnection && this.localStream) {
          this.peerConnection.addTrack(track, this.localStream);
        }
      });
    }

    // Setup event handlers
    this.setupPeerConnectionHandlers();
  }

  private setupPeerConnectionHandlers(): void {
    if (!this.peerConnection) return;

    // Handle incoming tracks (remote stream)
    this.peerConnection.ontrack = (event) => {
      const [remoteStream] = event.streams;
      if (remoteStream && remoteStream.getTracks().length > 0) {
        this.remoteStream = remoteStream;
        this.hasReceivedTracks = true;

        if (this.onRemoteStreamCallback) {
          this.onRemoteStreamCallback(remoteStream);
        }

        this.updateConnectionState('connected', this.actualMatchType as 'real_user' | 'staff');
      }
    };

    // Handle ICE candidates
    this.peerConnection.onicecandidate = (event) => {
      if (event.candidate && this.partnerId) {
        pubnubService.sendIceCandidate(this.partnerId, event.candidate).catch(() => {
          // Silent error for ICE candidate sending
        });
      }
    };

    // Monitor connection state
    this.peerConnection.onconnectionstatechange = () => {
      const state = this.peerConnection?.connectionState;
      if (state === 'failed' || state === 'disconnected') {
        this.handleConnectionFailure();
      }
    };
  }

  // =============================================================================
  // WEBRTC HANDSHAKE
  // =============================================================================

  private async initiateWebRTCConnection(): Promise<void> {
    if (!this.peerConnection || !this.partnerId) return;

    try {
      // Create and send offer
      const offer = await this.peerConnection.createOffer({
        offerToReceiveAudio: true,
        offerToReceiveVideo: true
      });

      await this.peerConnection.setLocalDescription(offer);
      await pubnubService.sendOffer(this.partnerId, offer.sdp || '');

    } catch (error) {
      this.handleError('Failed to create offer', error as Error);
    }
  }

  // =============================================================================
  // PUBNUB MESSAGE HANDLING
  // =============================================================================

  private async handlePubNubMessage(signal: any): Promise<void> {
    if (!this.peerConnection || !signal) return;

    const myUserId = this.getAuthenticatedUserId();
    if (signal.to !== myUserId) return;

    try {
      switch (signal.type) {
        case 'ready':
          if (!this.readySignalSent && this.partnerId) {
            await pubnubService.sendReady(this.partnerId);
            this.readySignalSent = true;
          }
          break;

        case 'offer':
          if (signal.sdp) {
            await this.peerConnection.setRemoteDescription({ type: 'offer', sdp: signal.sdp });
            const answer = await this.peerConnection.createAnswer();
            await this.peerConnection.setLocalDescription(answer);
            if (this.partnerId) {
              await pubnubService.sendAnswer(this.partnerId, answer.sdp || '');
            }
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

        case 'bye':
          this.handlePartnerLeft();
          break;
      }
    } catch (error) {
      // Silent error handling for individual signal processing
    }
  }

  // =============================================================================
  // CONNECTION STATE MANAGEMENT
  // =============================================================================

  private updateConnectionState(type: ConnectionState['type'], matchType?: ConnectionState['matchType']): void {
    if (this.onConnectionStateCallback) {
      this.onConnectionStateCallback({ type, matchType });
    }
  }

  private handleConnectionFailure(): void {
    this.updateConnectionState('failed');
    this.handleError('WebRTC connection failed');
  }

  private handlePartnerLeft(): void {
    if (this.onPartnerLeftCallback) {
      this.onPartnerLeftCallback();
    }
    this.cleanupCurrentConnection();
  }

  // =============================================================================
  // CLEANUP METHODS
  // =============================================================================

  private cleanupCurrentConnection(): void {
    this.stopStatusChecking();

    // Close peer connection
    if (this.peerConnection) {
      this.peerConnection.close();
      this.peerConnection = null;
    }

    // Leave PubNub channel
    pubnubService.leave();

    // Reset state
    this.currentRoomId = null;
    this.partnerId = null;
    this.sessionVersion = null;
    this.isInitiator = false;
    this.matchType = null;
    this.actualMatchType = null;
    this.isConnecting = false;
    this.hasReceivedTracks = false;
    this.readySignalSent = false;
    this.remoteStream = null;
  }

  public cleanup(): void {
    this.cleanupCurrentConnection();

    // Stop local stream
    if (this.localStream) {
      this.localStream.getTracks().forEach(track => track.stop());
      this.localStream = null;
    }
  }

  // =============================================================================
  // API REQUESTS
  // =============================================================================

  private async sendJoinRequest(): Promise<void> {
    const response = await api.post('/video_chat/join', {}) as BackendMatchResponse;

    if (response.status !== 'matched' && response.status !== 'joined_queue') {
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
  // UTILITY METHODS
  // =============================================================================

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
export const properVideoChatService = new ProperVideoChatService();
