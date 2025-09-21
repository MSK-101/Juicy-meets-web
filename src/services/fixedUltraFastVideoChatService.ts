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
 * Fixed Ultra-Fast Video Chat Service
 * - Properly handles race conditions
 * - Immediate stream assignment
 * - Reliable remote stream delivery
 */
export class FixedUltraFastVideoChatService {
  private peerConnection: RTCPeerConnection | null = null;
  private localStream: MediaStream | null = null;
  private remoteStream: MediaStream | null = null;
  private currentRoomId: string | null = null;
  private partnerId: string | null = null;
  private isInitiator: boolean = false;
  private sessionVersion: string | null = null;
  private statusCheckInterval: NodeJS.Timeout | null = null;

  // Ultra-fast settings
  private readonly STATUS_CHECK_INTERVAL = 300; // Even faster - 300ms
  private readonly CONNECTION_TIMEOUT_MS = 3000; // 3s only
  private readonly TRACK_TIMEOUT = 5000; // Max wait for remote track

  // Stream handling fix
  private pendingRemoteStream: MediaStream | null = null;
  private streamAssignmentRetries = 0;
  private readonly MAX_STREAM_RETRIES = 3;

  // Immediate callbacks - no delays
  private onRemoteStreamCallback: ((stream: MediaStream) => void) | null = null;
  private onLocalStreamCallback: ((stream: MediaStream) => void) | null = null;
  private onConnectionStateCallback: ((state: ConnectionState) => void) | null = null;
  private onPartnerLeftCallback: (() => void) | null = null;
  private onMessageReceivedCallback: ((message: { from: string; text: string; timestamp: number; id?: string }) => void) | null = null;
  private onVideoMatchCallback: ((videoData: VideoMatchData) => void) | null = null;
  private onErrorCallback: ((error: string) => void) | null = null;

  // Track assignment monitoring
  private trackTimeout: NodeJS.Timeout | null = null;
  private expectedTracks = 0;
  private receivedTracks = 0;

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
  // FIXED STREAM ASSIGNMENT
  // =============================================================================

  private assignRemoteStreamImmediately(stream: MediaStream): void {
    this.remoteStream = stream;

    // IMMEDIATE callback - no delays or conditions
    if (this.onRemoteStreamCallback) {
      // Use setTimeout 0 to ensure callback runs after current execution
      setTimeout(() => {
        if (this.onRemoteStreamCallback && this.remoteStream) {
          this.onRemoteStreamCallback(this.remoteStream);
        }
      }, 0);
    }

    // Update connection state
    if (this.onConnectionStateCallback) {
      setTimeout(() => {
        if (this.onConnectionStateCallback) {
          this.onConnectionStateCallback({
            type: 'connected',
            matchType: 'real_user'
          });
        }
      }, 0);
    }

    // Clear any track timeout
    if (this.trackTimeout) {
      clearTimeout(this.trackTimeout);
      this.trackTimeout = null;
    }
  }

  // =============================================================================
  // ULTRA-FAST MATCHING
  // =============================================================================

  public async joinQueue(): Promise<void> {
    try {
      // Reset state completely
      this.resetConnectionState();

      // Get auth immediately
      const userId = this.getAuthenticatedUserId();
      if (!userId) throw new Error('Authentication required');

      // Initialize local stream with aggressive settings
      await this.initializeLocalStreamAggressive();

      // Send join request
      await this.sendJoinRequest();

      // Start ultra-fast status checking
      this.startUltraFastStatusChecking();
    } catch (error) {
      this.handleError('Failed to join queue', error as Error);
      throw error;
    }
  }

  public async swipeNext(): Promise<void> {
    try {
      // Don't reset streams - keep for next connection
      this.currentRoomId = null;
      this.partnerId = null;
      this.sessionVersion = null;
      this.isInitiator = false;
      this.streamAssignmentRetries = 0;

      // Close only peer connection
      if (this.peerConnection) {
        this.peerConnection.close();
        this.peerConnection = null;
      }

      // Leave PubNub
      pubnubService.leave();

      // Send swipe request immediately
      await this.sendSwipeRequest();

      // Start checking for new match
      this.startUltraFastStatusChecking();
    } catch (error) {
      this.handleError('Failed to swipe', error as Error);
    }
  }

  // =============================================================================
  // AGGRESSIVE STREAM INITIALIZATION
  // =============================================================================

  private async initializeLocalStreamAggressive(): Promise<void> {
    if (this.localStream && this.localStream.active) {
      // Reuse existing stream
      if (this.onLocalStreamCallback) {
        this.onLocalStreamCallback(this.localStream);
      }
      return;
    }

    try {
      // Ultra-fast stream acquisition with minimal constraints
      this.localStream = await navigator.mediaDevices.getUserMedia({
        video: {
          width: { ideal: 640, max: 1280 },
          height: { ideal: 480, max: 720 },
          frameRate: { ideal: 15, max: 30 } // Lower FPS for faster connection
        },
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
          sampleRate: 44100
        }
      });

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
        await this.checkMatchStatusImmediate();
      } catch {
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

  private async checkMatchStatusImmediate(): Promise<void> {
    const response = await api.get('/video_chat/status') as MatchResponse;

    if (response.status === 'matched') {
      this.stopStatusChecking();

      // IMMEDIATE match handling
      this.handleMatchImmediate(response);
    }
  }

  // =============================================================================
  // IMMEDIATE MATCH HANDLING
  // =============================================================================

  private handleMatchImmediate(matchData: MatchResponse): void {
    const matchType = this.determineMatchType(matchData);

    if (matchType === 'video') {
      this.handleVideoMatchImmediate(matchData);
    } else {
      this.handleLiveMatchImmediate(matchData, matchType);
    }
  }

  private determineMatchType(matchData: MatchResponse): 'video' | 'real_user' | 'staff' {
    if (matchData.video_id && matchData.video_url) return 'video';
    if (matchData.partner?.id && matchData.partner.id !== 'video') {
      return matchData.match_type === 'staff' ? 'staff' : 'real_user';
    }
    return 'real_user';
  }

  private handleVideoMatchImmediate(matchData: MatchResponse): void {
    const videoData: VideoMatchData = {
      videoId: matchData.video_id?.toString() || 'unknown',
      videoUrl: matchData.video_url || '',
      videoName: matchData.video_name || 'Video'
    };

    this.currentRoomId = matchData.room_id || null;

    // Immediate callbacks
    if (this.onVideoMatchCallback) {
      this.onVideoMatchCallback(videoData);
    }

    if (this.onConnectionStateCallback) {
      this.onConnectionStateCallback({ type: 'connected', matchType: 'video' });
    }
  }

  // =============================================================================
  // IMMEDIATE WEBRTC CONNECTION
  // =============================================================================

  private handleLiveMatchImmediate(matchData: MatchResponse, matchType: 'real_user' | 'staff'): void {
    // Set match data instantly
    this.currentRoomId = matchData.room_id || null;
    this.partnerId = matchData.partner.id.toString();
    this.isInitiator = matchData.is_initiator;
    this.sessionVersion = matchData.session_version || null;

    // Reset counters
    this.streamAssignmentRetries = 0;
    this.expectedTracks = 2; // Audio + Video
    this.receivedTracks = 0;

    // Setup connection immediately - no async delays
    this.setupConnectionImmediate(matchType);
  }

  private setupConnectionImmediate(matchType: 'real_user' | 'staff'): void {
    // Create peer connection with aggressive settings
    this.peerConnection = new RTCPeerConnection({
      iceServers: [
        { urls: 'stun:stun.l.google.com:19302' },
        { urls: 'stun:stun1.l.google.com:19302' },
        { urls: 'stun:stun2.l.google.com:19302' }
      ],
      iceCandidatePoolSize: 30, // More candidates for faster connection
      iceTransportPolicy: 'all',
      bundlePolicy: 'max-bundle',
      rtcpMuxPolicy: 'require'
    });

    // Add local stream immediately
    if (this.localStream) {
      this.localStream.getTracks().forEach(track => {
        if (this.peerConnection) {
          this.peerConnection.addTrack(track, this.localStream!);
        }
      });
    }

    // Setup event handlers with immediate callbacks
    this.setupPeerConnectionHandlersFixed();

    // Start connection process immediately
    this.startConnectionProcessImmediate();

    // Setup PubNub immediately
    this.setupPubNubImmediate();

    // Set track timeout for failure detection
    this.trackTimeout = setTimeout(() => {
      if (this.receivedTracks < this.expectedTracks) {
        this.retryStreamAssignment();
      }
    }, this.TRACK_TIMEOUT);

    // Update state immediately
    if (this.onConnectionStateCallback) {
      this.onConnectionStateCallback({ type: 'connecting', matchType });
    }
  }

  private setupPeerConnectionHandlersFixed(): void {
    if (!this.peerConnection) return;

    // FIXED: Handle remote stream with immediate assignment
    this.peerConnection.ontrack = (event) => {
      this.receivedTracks++;

      const [remoteStream] = event.streams;
      if (remoteStream && remoteStream.getTracks().length > 0) {
        // IMMEDIATE assignment - no conditions or delays
        this.assignRemoteStreamImmediately(remoteStream);
      }
    };

    // Fast ICE candidate handling
    this.peerConnection.onicecandidate = (event) => {
      if (event.candidate && this.partnerId) {
        // Send immediately - no await
        pubnubService.sendIceCandidate(this.partnerId, event.candidate).catch(() => {
          // Silent error
        });
      }
    };

    // Connection state monitoring with retry
    this.peerConnection.onconnectionstatechange = () => {
      const state = this.peerConnection?.connectionState;
      if (state === 'connected') {
        // Clear timeout on successful connection
        if (this.trackTimeout) {
          clearTimeout(this.trackTimeout);
          this.trackTimeout = null;
        }
      } else if (state === 'failed') {
        this.retryStreamAssignment();
      }
    };

    // ICE connection state monitoring
    this.peerConnection.oniceconnectionstatechange = () => {
      const state = this.peerConnection?.iceConnectionState;
      if (state === 'connected' || state === 'completed') {
        // Force stream check when ICE is connected
        setTimeout(() => {
          this.checkAndAssignPendingStream();
        }, 100);
      }
    };
  }

  private checkAndAssignPendingStream(): void {
    if (this.pendingRemoteStream && !this.remoteStream) {
      this.assignRemoteStreamImmediately(this.pendingRemoteStream);
      this.pendingRemoteStream = null;
    }
  }

  private retryStreamAssignment(): void {
    if (this.streamAssignmentRetries >= this.MAX_STREAM_RETRIES) return;

    this.streamAssignmentRetries++;

    // Try to get remote stream from peer connection
    if (this.peerConnection) {
      const receivers = this.peerConnection.getReceivers();
      for (const receiver of receivers) {
        if (receiver.track && receiver.track.readyState === 'live') {
          // Create stream from tracks
          const stream = new MediaStream([receiver.track]);
          this.assignRemoteStreamImmediately(stream);
          return;
        }
      }
    }

    // If still no stream, retry connection
    setTimeout(() => {
      this.swipeNext();
    }, 1000);
  }

  private startConnectionProcessImmediate(): void {
    if (!this.peerConnection || !this.partnerId) return;

    if (this.isInitiator) {
      // Create offer immediately
      this.peerConnection.createOffer({
        offerToReceiveAudio: true,
        offerToReceiveVideo: true
      }).then(offer => {
        if (this.peerConnection) {
          return this.peerConnection.setLocalDescription(offer);
        }
      }).then(() => {
        if (this.peerConnection && this.partnerId) {
          return pubnubService.sendOffer(this.partnerId, this.peerConnection.localDescription?.sdp || '');
        }
      }).catch(() => {
        this.retryStreamAssignment();
      });
    }
  }

  private setupPubNubImmediate(): void {
    if (!this.currentRoomId || !this.partnerId) return;

    pubnubService.join(this.currentRoomId, this.sessionVersion || '', this.getAuthenticatedUserId()!, {
      onMessage: (signal) => {
        this.handleWebRTCSignalImmediate(signal);
      },
      onJoin: () => {
        if (this.partnerId) {
          pubnubService.sendReady(this.partnerId).catch(() => {
            // Silent error
          });
        }
      },
      onError: () => {
        // Silent error handling
      }
    });
  }

  // =============================================================================
  // IMMEDIATE SIGNAL HANDLING
  // =============================================================================

  private handleWebRTCSignalImmediate(signal: { type: string; sdp?: string; candidate?: RTCIceCandidateInit; text?: string; from: string; to: string; timestamp?: number; id?: string }): void {
    if (!this.peerConnection || !signal) return;

    const myUserId = this.getAuthenticatedUserId();
    if (signal.to !== myUserId) return;

    // Handle signals immediately - no await
    switch (signal.type) {
      case 'offer':
        if (signal.sdp && this.peerConnection) {
          this.peerConnection.setRemoteDescription({ type: 'offer', sdp: signal.sdp })
            .then(() => {
              if (this.peerConnection) {
                return this.peerConnection.createAnswer();
              }
            })
            .then(answer => {
              if (this.peerConnection && answer) {
                return this.peerConnection.setLocalDescription(answer);
              }
            })
            .then(() => {
              if (this.partnerId && this.peerConnection) {
                return pubnubService.sendAnswer(this.partnerId, this.peerConnection.localDescription?.sdp || '');
              }
            })
            .catch(() => {
              // Silent error
            });
        }
        break;

      case 'answer':
        if (signal.sdp && this.peerConnection) {
          this.peerConnection.setRemoteDescription({ type: 'answer', sdp: signal.sdp }).catch(() => {
            // Silent error
          });
        }
        break;

      case 'ice':
        if (signal.candidate && this.peerConnection) {
          this.peerConnection.addIceCandidate(signal.candidate).catch(() => {
            // Silent error
          });
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
  }

  // =============================================================================
  // UTILITY METHODS
  // =============================================================================

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
      this.resetConnectionState();
      await this.sendLeaveRequest();
    } catch {
      // Silent error handling for leave
    } finally {
      this.cleanup();
    }
  }

  private resetConnectionState(): void {
    this.stopStatusChecking();

    if (this.trackTimeout) {
      clearTimeout(this.trackTimeout);
      this.trackTimeout = null;
    }

    if (this.peerConnection) {
      this.peerConnection.close();
      this.peerConnection = null;
    }

    pubnubService.leave();

    this.currentRoomId = null;
    this.partnerId = null;
    this.sessionVersion = null;
    this.isInitiator = false;
    this.streamAssignmentRetries = 0;
    this.expectedTracks = 0;
    this.receivedTracks = 0;
    this.pendingRemoteStream = null;
  }

  public cleanup(): void {
    this.resetConnectionState();

    if (this.localStream) {
      this.localStream.getTracks().forEach(track => track.stop());
      this.localStream = null;
    }

    this.remoteStream = null;
  }

  // =============================================================================
  // AUTHENTICATION & API
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
export const fixedUltraFastVideoChatService = new FixedUltraFastVideoChatService();
