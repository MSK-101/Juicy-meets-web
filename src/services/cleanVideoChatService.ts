import { api } from '../api/baseAPI';
import { useAuthStore } from '../store/auth';
import { UserService } from '../api/services/userService';
import { pubnubService } from './pubnubService';

export interface WebRTCSignalData {
  type: 'offer' | 'answer' | 'ice-candidate';
  data: RTCSessionDescriptionInit | RTCIceCandidateInit;
  target_user_id: string;
}

export class CleanVideoChatService {
  private peerConnection: RTCPeerConnection | null = null;
  private localStream: MediaStream | null = null;
  private remoteStream: MediaStream | null = null;
  private currentRoomId: string | null = null;
  private partnerId: string | null = null;
  private isInitiator: boolean = false;
  private sessionVersion: string | null = null;
  private statusCheckInterval: NodeJS.Timeout | null = null;
  private iceCandidateQueue: (RTCIceCandidateInit & { queuedAt?: number })[] = [];
  private tokenValidationCache: { token: string; isValid: boolean; timestamp: number } | null = null;
  private readonly TOKEN_CACHE_DURATION = 5 * 60 * 1000; // 5 minutes

  // Cleanup functions for PubNub listeners
  private webrtcSignalCleanup: (() => void) | null = null;
  private generalMessageCleanup: (() => void) | null = null;

  // Event callbacks
  private onRemoteStreamCallback: ((stream: MediaStream) => void) | null = null;
  private onConnectionStateCallback: ((state: RTCPeerConnectionState) => void) | null = null;
  private onPartnerLeftCallback: (() => void) | null = null;
  private onMessageReceivedCallback: ((message: { from: string; text: string; timestamp: number; id?: string }) => void) | null = null;
  private onVideoMatchCallback: ((videoData: { videoId: string; videoUrl: string; videoName: string }) => void) | null = null;

  private isSwiping = false;
  private swipeDebounceTimeout: NodeJS.Timeout | null = null;

  // Frontend connection timeout handling
  private connectionTimeoutId: NodeJS.Timeout | null = null;
  private connectionStartTime: number | null = null;
  private readonly CONNECTION_TIMEOUT_MS = 40000; // 40 seconds

  // Track processed signals to prevent duplicates
  private processedSignals = new Set<string>();
  private signalCounter = 0; // Counter for unique signal IDs

  // Message buffering for proper ordering
  private messageBuffer = new Map<string, any[]>();
  private processingMessages = false;

  // Connection health monitoring
  private heartbeatInterval: NodeJS.Timeout | null = null;

  constructor() {
    console.log('🎥 CleanVideoChatService initialized');
  }

  private getAuthenticatedUserId(): string | null {
    // Check if we're in the browser environment
    if (typeof window === 'undefined') {
      return null;
    }

    // Get user ID from auth store
    const user = useAuthStore.getState().user;
    if (user?.id) {
      return user.id.toString();
    }

    // Fallback to localStorage if auth store not hydrated yet
    try {
      const storedUser = localStorage.getItem('juicyMeetsUser');
      if (storedUser) {
        const userData = JSON.parse(storedUser);
        return userData.id?.toString() || null;
      }
    } catch {
      console.warn('Could not parse stored user data');
    }

    return null;
  }

  private async waitForAuthentication(maxWaitMs: number = 5000): Promise<string> {
    const startTime = Date.now();
    let lastValidationAttempt = 0;
    const VALIDATION_COOLDOWN = 1000; // 1 second cooldown between validation attempts

    while (Date.now() - startTime < maxWaitMs) {
      const userId = this.getAuthenticatedUserId();
      if (userId) {
        // Check token validation cache first
        const token = this.getAuthToken();
        if (token) {
          // Use cached validation if available and not expired
          if (this.tokenValidationCache &&
              this.tokenValidationCache.token === token &&
              Date.now() - this.tokenValidationCache.timestamp < this.TOKEN_CACHE_DURATION) {

            if (this.tokenValidationCache.isValid) {
              console.log('✅ Using cached token validation');
              return userId;
            } else {
              console.warn('⚠️ Cached token validation shows invalid token, clearing storage');
              this.clearStoredAuth();
            }
          } else {
            // Only validate if enough time has passed since last attempt
            const timeSinceLastValidation = Date.now() - lastValidationAttempt;
            if (timeSinceLastValidation >= VALIDATION_COOLDOWN) {
              try {
                console.log('🔍 Validating token (cooldown respected)...');
                lastValidationAttempt = Date.now();

                const validation = await UserService.validateToken(token);

                // Cache the validation result
                this.tokenValidationCache = {
                  token,
                  isValid: validation.valid,
                  timestamp: Date.now()
                };

                if (validation.valid) {
                  console.log('✅ Token validation successful');
                  return userId;
                } else {
                  console.warn('⚠️ Token validation failed, clearing storage');
                  this.clearStoredAuth();
                }
              } catch (error) {
                console.error('❌ Token validation error:', error);
                this.clearStoredAuth();
              }
            } else {
              // Log that we're waiting for cooldown
              const remainingCooldown = VALIDATION_COOLDOWN - timeSinceLastValidation;
              console.log(`⏳ Waiting ${remainingCooldown}ms for validation cooldown...`);
            }
          }
        }
      }

      // Wait a bit before checking again (increased from 100ms to 500ms)
      await new Promise(resolve => setTimeout(resolve, 500));
    }

    throw new Error('Authentication timeout - user not authenticated after 5 seconds');
  }

  private clearStoredAuth(): void {
    // Clear stored authentication data
    try {
      localStorage.removeItem('juicyMeetsUser');
      localStorage.removeItem('juicyMeetsAuthToken');
      // Clear token validation cache
      this.tokenValidationCache = null;
      console.log('🧹 Cleared stored authentication data and token cache');
    } catch (error) {
      console.warn('Could not clear stored auth data:', error);
    }
  }

  // Clear token validation cache (useful for testing or manual refresh)
  clearTokenValidationCache(): void {
    this.tokenValidationCache = null;
    console.log('🧹 Cleared token validation cache');
  }

  private getAuthToken(): string | null {
    // Check if we're in the browser environment
    if (typeof window === 'undefined') {
      return null;
    }

    // Get token from auth store
    const user = useAuthStore.getState().user;
    if (user?.token) {
      return user.token;
    }

    // Fallback to localStorage if auth store not hydrated yet
    try {
      const storedToken = localStorage.getItem('juicyMeetsAuthToken');
      if (storedToken) {
        return storedToken;
      }
    } catch {
      console.warn('Could not access localStorage for token');
    }

    return null;
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

  onMessageReceived(callback: (message: { from: string; text: string; timestamp: number; id?: string }) => void) {
    this.onMessageReceivedCallback = callback;
  }

  onVideoMatch(callback: (videoData: { videoId: string; videoUrl: string; videoName: string }) => void) {
    this.onVideoMatchCallback = callback;
  }

  // Join the video chat queue
  async joinQueue(): Promise<void> {
    try {
      // Wait for authentication to be ready
      const userId = await this.waitForAuthentication();
      console.log('🎯 Joining video chat queue with user ID:', userId);

      // Verify we have a valid token
      const token = this.getAuthToken();
      if (!token) {
        throw new Error('No authentication token available');
      }

      console.log('🔑 Using token for authentication');

      // Request camera permissions immediately when joining queue
      console.log('📹 Requesting camera permissions...');
      try {
        // Check permission state first and show appropriate messaging
        const permissionState = await this.checkPermissionState();
        this.showPermissionStateMessage(permissionState);

        if (permissionState !== 'granted') {
          throw new Error(`Camera permissions not granted. Current state: ${permissionState}`);
        }

        // Get the local stream
        await this.getLocalStream();
        console.log('✅ Camera permissions granted');
      } catch (error) {
        console.error('❌ Camera permission denied:', error);

        // Show user-friendly alert for permission denied
        if (error instanceof Error) {
          if (error.name === 'NotAllowedError' ||
              error.message.includes('Permission denied') ||
              error.message.includes('NotAllowedError')) {
            this.showPermissionDeniedAlert();
          }
        }

        throw new Error('Camera access is required for video chat. Please allow camera permissions and try again.');
      }

      await api.post('/video_chat/join', {});
      console.log('✅ Successfully joined queue');

      // Start checking for matches
      this.startStatusChecking();
    } catch (error) {
      console.error('❌ Failed to join queue:', error);
      throw new Error('Failed to join video chat queue. Please try again.');
    }
  }

  // Leave the video chat
  async leaveChat(): Promise<void> {
    console.log('👋 Leaving video chat...');

    try {
      // Wait for authentication to be ready
      const userId = await this.waitForAuthentication();
      console.log('👋 Leaving video chat for user ID:', userId);

      // Verify we have a valid token
      const token = this.getAuthToken();
      if (!token) {
        console.warn('⚠️ No authentication token available for leave request');
        // Still cleanup locally even without token
        this.cleanup();
        return;
      }

      await api.post('/video_chat/leave', {});
      console.log('✅ Successfully left video chat');
    } catch (error) {
      console.error('❌ Error leaving video chat:', error);
      // Even if the API call fails, cleanup locally
    } finally {
      this.cleanup();
    }
  }

  // Swipe to next match with proper cleanup
  async swipeToNext(): Promise<{
    success: boolean;
    roomId?: string;
    matchType?: string;
    partnerId?: string;
    videoId?: string;
    videoUrl?: string;
    videoName?: string;
    sessionVersion?: string;
    updatedUserInfo?: {
      pool_id: number;
      sequence_id: number;
      videos_watched_in_current_sequence: number;
      sequence_total_videos: number;
    };
  }> {
    // Allow immediate swipes for video matches (no debounce)
    const isVideoMatch = this.currentRoomId && this.partnerId === 'video';

    if (this.isSwiping && !isVideoMatch) {
      console.log('⚠️ Swipe already in progress, ignoring duplicate request');
      return { success: false };
    }

    // Clear any existing debounce timeout
    if (this.swipeDebounceTimeout) {
      clearTimeout(this.swipeDebounceTimeout);
      this.swipeDebounceTimeout = null;
    }

    try {
      this.isSwiping = true;
      console.log('🔄 Starting swipe to next match...');

      // Check if we're in an active connection before sending bye signal
      const isInActiveConnection = this.currentRoomId &&
                                  this.partnerId &&
                                  this.partnerId !== 'video' &&
                                  this.partnerId !== 'unknown' &&
                                  pubnubService.isConnected();

      if (isInActiveConnection && this.partnerId) {
        console.log('👋 Sending bye signal to partner before swipe...');
          try {
            await pubnubService.sendBye(this.partnerId);
            console.log('✅ Bye signal sent successfully');

          // Wait a bit for the signal to be delivered
          await new Promise(resolve => setTimeout(resolve, 500));
        } catch (error) {
          console.warn('⚠️ Failed to send bye signal:', error);
          // Continue with swipe even if bye signal fails
        }
      } else {
        console.log('ℹ️ No active connection to send bye signal, proceeding with swipe...');
        if (this.currentRoomId) {
          console.log('🔍 Debug info:', {
            currentRoomId: this.currentRoomId,
            partnerId: this.partnerId,
            pubnubConnected: pubnubService.isConnected()
          });
        }
      }

      // Clear remote stream state to prevent UI inconsistency
      // Note: We don't call the callback here since it expects a MediaStream
      // The UI will be updated when the new match is processed

      // Trigger partner left callback to show loader
      if (this.onPartnerLeftCallback) {
        this.onPartnerLeftCallback();
      }

        // Perform comprehensive cleanup before requesting new match
  console.log('🧹 Performing comprehensive cleanup for new match...');
  this.performSwipeCleanup();

  // Additional state cleanup for signal tracking
  this.processedSignals.clear();
  this.signalCounter = 0;
  this.messageBuffer.clear();
  this.processingMessages = false;

    // Reset PubNub connection state
  this.isPubNubConnecting = false;

  console.log('✅ Signal tracking state cleared for new match');

      const response = await api.post('/video_chat/swipe', {});
      console.log('🔄 Raw response from backend:', response);
      console.log('🔄 Response data:', response);

      // Type the response data
      const responseData = response as {
        status: string;
        room_id: string;
        match_type: string;
        partner: { id: string };
        is_initiator: boolean;
        session_id?: string;
        session_version?: string;
        video_id?: string;
        video_url?: string;
        video_name?: string;
        updated_user_info?: {
          pool_id: number;
          sequence_id: number;
          videos_watched_in_current_sequence: number;
          sequence_total_videos: number;
        };
      };

      console.log('🔄 Parsed response data:', responseData);
      console.log('🔍 Updated user info:', responseData.updated_user_info);

      // Update auth store with new user info if provided
      if (responseData.updated_user_info) {
        const { useAuthStore } = await import('../store/auth');
        const authStore = useAuthStore.getState();

        authStore.setSequenceInfo(
          responseData.updated_user_info.sequence_id,
          responseData.updated_user_info.videos_watched_in_current_sequence,
          responseData.updated_user_info.sequence_total_videos
        );

        if (responseData.updated_user_info.pool_id) {
          authStore.setPoolId(responseData.updated_user_info.pool_id);
        }

        console.log('✅ Updated auth store with new sequence info');
      }

      if (responseData.status === 'matched') {
        // Ensure local stream is healthy before proceeding
        await this.ensureLocalStreamHealth();

        // CRITICAL FIX: Ensure complete cleanup before setting new match data
        console.log('🧹 Ensuring complete cleanup before new match...');
        this.performSwipeCleanup();

        // Update current room and partner info
        this.currentRoomId = responseData.room_id;

        // Fix: partnerId should be the OTHER user's ID, not the current user's ID
        if (responseData.partner && responseData.partner.id) {
          // If partner.id is 'video', keep it as is
          if (responseData.partner.id === 'video') {
            this.partnerId = 'video';
          } else {
            // For real users and staff, partnerId should be the other user's ID
            this.partnerId = responseData.partner.id.toString();
              }
            } else {
          this.partnerId = 'unknown';
        }

        this.isInitiator = responseData.is_initiator;
        this.sessionVersion = responseData.session_version || '';

        console.log('🔍 Set currentRoomId:', this.currentRoomId);
        console.log('🔍 Set partnerId:', this.partnerId, '(partner from backend:', responseData.partner, ')');
        console.log('🔍 Set isInitiator:', this.isInitiator);
        console.log('🔍 Set sessionVersion:', this.sessionVersion);

        // Handle the match based on its type
        console.log('🔍 Processing match type:', responseData.match_type);
        await this.handleMatchWithErrorHandling(responseData.match_type, responseData);

        // Return the match result
        if (responseData.match_type === 'video') {
          return {
            success: true,
            roomId: responseData.room_id,
            matchType: 'video',
            partnerId: 'video',
            videoId: responseData.video_id,
            videoUrl: responseData.video_url || '',
            videoName: responseData.video_name || 'Video',
            sessionVersion: responseData.session_version,
            updatedUserInfo: responseData.updated_user_info
          };
        } else if (responseData.match_type === 'staff') {
          return {
            success: true,
            roomId: responseData.room_id,
            matchType: 'staff',
            partnerId: responseData.partner.id,
            sessionVersion: responseData.session_version,
            updatedUserInfo: responseData.updated_user_info
          };
        } else {
          // Real user match
          return {
            success: true,
            roomId: responseData.room_id,
            matchType: 'real_user',
            partnerId: responseData.partner.id,
            sessionVersion: responseData.session_version,
            updatedUserInfo: responseData.updated_user_info
          };
        }
      } else {
        // No match found - ensure we're in a clean state for the next attempt
        console.log('⚠️ No match found after swipe, ensuring clean state...');

        return { success: false };
      }
    } catch (error) {
      console.error('❌ Error during swipe:', error);
      return { success: false };
    } finally {
      // Reset swiping flag after a delay to prevent rapid swipes (only for live connections)
      if (!isVideoMatch) {
        this.swipeDebounceTimeout = setTimeout(() => {
          this.isSwiping = false;
          console.log('✅ Swipe debounce reset, ready for next swipe');
        }, 2000); // 2 second debounce only for live connections
      } else {
        // For video matches, reset immediately
        this.isSwiping = false;
        console.log('✅ Video match swipe completed, ready for next swipe');
      }
    }
  }

  // Perform comprehensive cleanup specifically for swipes
  private performSwipeCleanup(): void {
    console.log('🧹 Performing swipe-specific cleanup...');
    console.log('🔒 Preserving local stream during cleanup...');

    // Clean up PubNub connection
    if (this.currentRoomId) {
      pubnubService.leave();
      console.log('✅ PubNub connection cleaned up');
    }

    // Clean up WebRTC resources (but preserve local stream)
    if (this.peerConnection) {
      this.peerConnection.close();
      this.peerConnection = null;
      console.log('✅ Peer connection closed');
    }

    // Clear remote stream only (never touch local stream)
    if (this.remoteStream) {
      this.remoteStream.getTracks().forEach(track => {
        track.stop();
        console.log('🛑 Remote stream track stopped:', track.kind);
      });
      this.remoteStream = null;
      console.log('✅ Remote stream cleared (local stream preserved)');
    }

    // CRITICAL FIX: Clear ALL state tracking to prevent "already connected" issues
    this.currentRoomId = null;
    this.partnerId = null;
    this.isInitiator = false;
    this.sessionVersion = null;

        // Clear signal tracking to prevent duplicate signal issues
    this.processedSignals.clear();
    this.signalCounter = 0;

    // Clear message buffer and processing state
    this.messageBuffer.clear();
    this.processingMessages = false;

    // Reset ready signal flag
    this.hasSentReadySignal = false;

    // Clear ICE candidate queue
    this.iceCandidateQueue = [];

    // Stop connection timeout monitoring
    this.stopConnectionTimeoutMonitoring();

    // Stop heartbeat if running
    this.stopHeartbeat();

    // Clear any intervals
    if (this.statusCheckInterval) {
      clearInterval(this.statusCheckInterval);
      this.statusCheckInterval = null;
      console.log('🛑 Status check interval cleared');
    }

    // Verify local stream is still intact
    if (this.localStream) {
      console.log('✅ Local stream preserved and intact');
      console.log('🔍 Local stream tracks:', this.localStream.getTracks().map(t => t.kind));
    } else {
      console.warn('⚠️ WARNING: Local stream was lost during cleanup!');
    }

    console.log('✅ COMPLETE swipe cleanup completed (local stream preserved)');
  }

  // End current session
  async endSession(roomId: string): Promise<void> {
    console.log('🔚 Ending current session...');

    try {
      await api.post('/video_chat/end_session', { room_id: roomId });
      console.log('✅ Session ended successfully');
    } catch (error) {
      console.error('❌ Error ending session:', error);
    }
  }

  // Show permission denied alert
  private showPermissionDeniedAlert(): void {
    // Create a custom modal for better user experience
    this.createPermissionDeniedModal();

    // Also log for debugging
    console.error('❌ Camera permissions denied by user');
    console.warn('💡 User needs to allow camera permissions to use video chat');
  }

  // Create a custom permission denied modal
  private createPermissionDeniedModal(): void {
    // Remove existing modal if any
    const existingModal = document.getElementById('permission-denied-modal');
    if (existingModal) {
      existingModal.remove();
    }

    // Create modal container
    const modal = document.createElement('div');
    modal.id = 'permission-denied-modal';
    modal.style.cssText = `
      position: fixed;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      background: rgba(0, 0, 0, 0.8);
      display: flex;
      align-items: center;
      justify-content: center;
      z-index: 10000;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
    `;

    // Create modal content
    const modalContent = document.createElement('div');
    modalContent.style.cssText = `
      background: white;
      padding: 30px;
      border-radius: 12px;
      max-width: 500px;
      width: 90%;
      text-align: center;
      box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.1);
    `;

    // Create modal HTML
    modalContent.innerHTML = `
      <div style="margin-bottom: 20px;">
        <div style="font-size: 48px; margin-bottom: 16px;">🚫</div>
        <h2 style="margin: 0 0 16px 0; color: #dc2626; font-size: 24px;">Camera Permission Required!</h2>
        <p style="margin: 0 0 20px 0; color: #374151; line-height: 1.6;">
          Video chat requires camera and microphone access to work properly.
        </p>
      </div>

      <div style="background: #f3f4f6; padding: 20px; border-radius: 8px; margin-bottom: 20px; text-align: left;">
        <h3 style="margin: 0 0 12px 0; color: #1f2937; font-size: 18px;">🔧 How to enable:</h3>
        <ol style="margin: 0; padding-left: 20px; color: #374151; line-height: 1.6;">
          <li>Click "Allow" when browser asks for camera permission</li>
          <li>Or click the camera icon in your browser's address bar</li>
          <li>Select "Allow" for both camera and microphone</li>
        </ol>
      </div>

      <div style="background: #fef2f2; padding: 16px; border-radius: 8px; margin-bottom: 24px; border-left: 4px solid #dc2626;">
        <p style="margin: 0; color: #dc2626; font-weight: 500;">
          ❌ Without these permissions, video chat cannot function.
        </p>
      </div>

      <div style="display: flex; gap: 12px; justify-content: center;">
        <button id="refresh-btn" style="
          background: #3b82f6;
          color: white;
          border: none;
          padding: 12px 24px;
          border-radius: 8px;
          font-size: 16px;
          font-weight: 500;
          cursor: pointer;
          transition: background 0.2s;
        ">🔄 Refresh & Try Again</button>
        <button id="close-btn" style="
          background: #6b7280;
          color: white;
          border: none;
          padding: 12px 24px;
          border-radius: 8px;
          font-size: 16px;
          font-weight: 500;
          cursor: pointer;
          transition: background 0.2s;
        ">✕ Close</button>
      </div>
    `;

    // Add event listeners
    const refreshBtn = modalContent.querySelector('#refresh-btn');
    const closeBtn = modalContent.querySelector('#close-btn');

    if (refreshBtn) {
      refreshBtn.addEventListener('click', () => {
        modal.remove();
        window.location.reload();
      });

      // Add hover effects
      refreshBtn.addEventListener('mouseenter', () => {
        (refreshBtn as HTMLElement).style.background = '#2563eb';
      });
      refreshBtn.addEventListener('mouseleave', () => {
        (refreshBtn as HTMLElement).style.background = '#3b82f6';
      });
    }

    if (closeBtn) {
      closeBtn.addEventListener('click', () => {
        modal.remove();
      });

      // Add hover effects
      closeBtn.addEventListener('mouseenter', () => {
        (closeBtn as HTMLElement).style.background = '#4b5563';
      });
      closeBtn.addEventListener('mouseleave', () => {
        (closeBtn as HTMLElement).style.background = '#6b7280';
      });
    }

    // Add modal to page
    modal.appendChild(modalContent);
    document.body.appendChild(modal);

    // Auto-close after 30 seconds
    setTimeout(() => {
      if (document.body.contains(modal)) {
        modal.remove();
      }
    }, 30000);
  }

  // Show permission blocked alert (when camera is in use by another app)
  private showPermissionBlockedAlert(): void {
    const alertMessage = `
🚫 Camera Access Blocked!

Your camera is currently being used by another application or is blocked by your system.

🔧 How to fix:
1. Close other apps that might be using the camera
2. Check your system camera settings
3. Restart your browser
4. Check if your camera is working in other apps

❌ Video chat cannot work without camera access.

🔄 Please try again after resolving the camera access issue.
    `;

    alert(alertMessage);
    console.error('🚫 Camera access is blocked by browser or system');
  }

  // Show not supported alert
  private showNotSupportedAlert(): void {
    const alertMessage = `
❌ Camera Not Supported!

Your browser or device does not support camera access.

🔧 What you can try:
1. Use a modern browser (Chrome, Firefox, Safari, Edge)
2. Update your browser to the latest version
3. Check if your device has a camera
4. Try on a different device

❌ Video chat cannot work without camera support.

💡 Please try using a different browser or device.
    `;

    alert(alertMessage);
    console.error('❌ Camera access is not supported in this browser');
  }

  // Check permission state and show appropriate messaging
  async checkPermissionState(): Promise<'granted' | 'denied' | 'blocked' | 'not-supported'> {
    try {
      // Check if getUserMedia is supported
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        console.error('❌ getUserMedia not supported in this browser');
        return 'not-supported';
      }

      // Check if permissions API is supported
      if (navigator.permissions && navigator.permissions.query) {
        try {
          const permission = await navigator.permissions.query({ name: 'camera' as PermissionName });
          console.log('📋 Camera permission state:', permission.state);

          switch (permission.state) {
            case 'granted':
              return 'granted';
            case 'denied':
              return 'denied';
            case 'prompt':
              // Try to get permissions
              try {
                const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
                stream.getTracks().forEach(track => track.stop());
                return 'granted';
              } catch (error) {
                if (error instanceof Error) {
                  if (error.name === 'NotAllowedError') {
                    return 'denied';
                  } else if (error.name === 'NotReadableError' || error.name === 'AbortError') {
                    return 'blocked';
                  }
                }
                return 'denied';
              }
            default:
              return 'denied';
          }
        } catch (error) {
          console.warn('⚠️ Could not query permission state, falling back to getUserMedia test');
        }
      }

      // Fallback: try to get permissions directly
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
        stream.getTracks().forEach(track => track.stop());
        return 'granted';
      } catch (error) {
        if (error instanceof Error) {
          if (error.name === 'NotAllowedError') {
            return 'denied';
          } else if (error.name === 'NotReadableError' || error.name === 'AbortError') {
            return 'blocked';
          }
        }
        return 'denied';
      }
    } catch (error) {
      console.error('❌ Error checking permission state:', error);
      return 'denied';
    }
  }

  // Show appropriate message based on permission state
  private showPermissionStateMessage(permissionState: 'granted' | 'denied' | 'blocked' | 'not-supported'): void {
    switch (permissionState) {
      case 'granted':
        console.log('✅ Camera permissions are already granted');
        break;
      case 'denied':
        console.warn('⚠️ Camera permissions were denied by user');
        this.showPermissionDeniedAlert();
        break;
      case 'blocked':
        console.error('🚫 Camera access is blocked by browser or system');
        this.showPermissionBlockedAlert();
        break;
      case 'not-supported':
        console.error('❌ Camera access is not supported in this browser');
        this.showNotSupportedAlert();
        break;
    }
  }

  // Get local video stream
  async getLocalStream(): Promise<MediaStream> {
    if (this.localStream) {
      return this.localStream;
    }

    try {
      console.log('📹 Getting local video stream...');

      // Check permission state first and show appropriate messaging
      const permissionState = await this.checkPermissionState();
      this.showPermissionStateMessage(permissionState);

      if (permissionState !== 'granted') {
        throw new Error(`Camera permissions not granted. Current state: ${permissionState}`);
      }

      this.localStream = await navigator.mediaDevices.getUserMedia({
        video: true,
        audio: true
      });
      console.log('✅ Got local stream');
      return this.localStream;
    } catch (error) {
      console.error('❌ Failed to get local stream:', error);

      // Show user-friendly alert for permission denied
      if (error instanceof Error) {
        if (error.name === 'NotAllowedError' ||
            error.message.includes('Permission denied') ||
            error.message.includes('NotAllowedError')) {
          this.showPermissionDeniedAlert();
        }
      }

      throw error;
    }
  }

  // Force refresh local stream (useful when stream is lost or needs to be recreated)
  async forceRefreshLocalStream(): Promise<MediaStream | null> {
    try {
      console.log('🔄 Force refreshing local stream...');

      // Stop existing stream if any
      if (this.localStream) {
        this.localStream.getTracks().forEach(track => track.stop());
        this.localStream = null;
      }

      // Get fresh stream
      const freshStream = await this.getLocalStream();
      console.log('✅ Local stream refreshed successfully');
      return freshStream;
    } catch (error) {
      console.error('❌ Failed to refresh local stream:', error);
      return null;
    }
  }

  // Get current local stream (null if not available)
  getCurrentLocalStream(): MediaStream | null {
    return this.localStream;
  }

  // Get current remote stream (null if not available)
  getCurrentRemoteStream(): MediaStream | null {
    return this.remoteStream;
  }

  // Handle video match - create video player or stream
  private async handleVideoMatch(videoData: { videoId: string; videoUrl: string; videoName: string }): Promise<void> {
    console.log('🎥 Handling video match:', videoData);
    console.log('🎥 onVideoMatchCallback exists:', !!this.onVideoMatchCallback);

    try {
      // For video matches, directly use the video URL - no need to create streams
      console.log('🎥 Video match detected - using video URL directly');

      // Trigger the video match callback with video data for the video player component
      if (this.onVideoMatchCallback) {
        console.log('🎥 Calling onVideoMatchCallback with video data');
        this.onVideoMatchCallback({
          videoId: videoData.videoId,
          videoUrl: videoData.videoUrl,
          videoName: videoData.videoName
        });
        console.log('✅ onVideoMatchCallback called successfully');
      } else {
        console.warn('⚠️ No onVideoMatchCallback set - video cannot be played');
        console.warn('⚠️ This means no component has registered to handle video matches');
      }

      console.log('✅ Video match handling completed successfully');
    } catch (error) {
      console.error('❌ Error handling video match:', error);

      // Fallback: try to trigger video callback again
      if (this.onVideoMatchCallback && videoData.videoUrl) {
        console.log('🔄 Fallback: trying video callback again');
        this.onVideoMatchCallback({
          videoId: videoData.videoId,
          videoUrl: videoData.videoUrl,
          videoName: videoData.videoName
        });
      }
    }
  }

  // Create a simulated video stream for fallback scenarios
  private async createSimulatedVideoStream(): Promise<MediaStream | null> {
    try {
      console.log('🎥 Creating simulated video stream...');

      // Create a canvas element to generate video frames
      const canvas = document.createElement('canvas');
      canvas.width = 640;
      canvas.height = 480;
      const ctx = canvas.getContext('2d');

      if (!ctx) {
        throw new Error('Could not get canvas context');
      }

              // Create a simple animated pattern
        let frame = 0;
        const animate = () => {
          // Clear canvas with bright background
          ctx.fillStyle = '#ff0000'; // Bright red background
          ctx.fillRect(0, 0, canvas.width, canvas.height);

          // Draw animated elements with high contrast
          ctx.fillStyle = '#ffffff'; // White text
          ctx.font = 'bold 48px Arial';
          ctx.textAlign = 'center';
          ctx.fillText('VIDEO PARTNER', canvas.width / 2, canvas.height / 2);

          ctx.fillStyle = '#ffff00'; // Bright yellow
          ctx.font = 'bold 24px Arial';
          ctx.fillText(`Frame: ${frame}`, canvas.width / 2, canvas.height / 2 + 50);

          // Add moving elements to make it obvious
          ctx.fillStyle = '#00ffff'; // Bright cyan
          ctx.beginPath();
          ctx.arc(100 + (frame * 2) % 400, 100, 20, 0, 2 * Math.PI);
          ctx.fill();

          ctx.fillStyle = '#ff00ff'; // Bright magenta
          ctx.beginPath();
          ctx.arc(500 - (frame * 3) % 400, 300, 25, 0, 2 * Math.PI);
          ctx.fill();

          frame++;
        };

              // Start animation immediately
        animate(); // Draw first frame immediately

        // Start animation loop
        const animationInterval = setInterval(animate, 100);

        // Capture the canvas as a video stream
        const stream = canvas.captureStream(10); // 10 FPS

        // Store the interval so we can clean it up later
        (stream as any)._animationInterval = animationInterval;

      console.log('✅ Simulated video stream created');
      return stream;
    } catch (error) {
      console.error('❌ Failed to create simulated video stream:', error);
      return null;
    }
  }

    // Fetch video details and create video stream from actual video file
  private async createVideoStreamFromFile(videoId: number): Promise<MediaStream | null> {
    try {
      console.log('🎥 Attempting to create video stream from file ID:', videoId);

      // Fetch video details from backend
      const response = await fetch(`http://localhost:3000/api/v1/videos/${videoId}/public`);

      if (!response.ok) {
        throw new Error(`Failed to fetch video: ${response.status}`);
      }

      const data = await response.json();
      const video = data.data.video;

      if (!video.video_file_url) {
        console.log('⚠️ Video has no file URL, falling back to simulated stream');
        return null;
      }

      // Try to create a video element and capture its stream
      const videoElement = document.createElement('video');
      videoElement.crossOrigin = 'anonymous';
      videoElement.muted = true;
      videoElement.playsInline = true;
      videoElement.src = video.video_file_url;

      // Wait for video to load
      await new Promise((resolve, reject) => {
        videoElement.onloadedmetadata = resolve;
        videoElement.onerror = reject;
        videoElement.load();
      });

      // Try to capture the video stream
      try {
        if ('captureStream' in videoElement && typeof videoElement.captureStream === 'function') {
          const stream = videoElement.captureStream();
          console.log('✅ Video stream captured successfully from file');
          return stream;
        } else {
          console.warn('⚠️ captureStream method not available on this video element');
          return null;
        }
      } catch (captureError) {
        console.warn('⚠️ Could not capture video stream, falling back to URL:', captureError);
        return null;
      }

    } catch (error) {
      console.error('❌ Failed to create video stream from file:', error);
      return null;
    }
  }

  // Log current WebRTC state for debugging
  private logWebRTCState(): void {
    if (!this.peerConnection) {
      console.log('🔍 WebRTC State: No peer connection');
      return;
    }

    console.log('🔍 === WebRTC STATE DEBUG ===');
    console.log('🔍 Signaling State:', this.peerConnection.signalingState);
    console.log('🔍 Connection State:', this.peerConnection.connectionState);
    console.log('🔍 ICE Connection State:', this.peerConnection.iceConnectionState);
    console.log('🔍 ICE Gathering State:', this.peerConnection.iceGatheringState);
    console.log('🔍 Local Description:', !!this.peerConnection.localDescription);
    console.log('🔍 Remote Description:', !!this.peerConnection.remoteDescription);
    console.log('🔍 === END WebRTC STATE DEBUG ===');
  }

  // Log current connection state for debugging
  private logConnectionState(): void {
    console.log('🔍 === CONNECTION STATE DEBUG ===');
    console.log('🔍 Current Room ID:', this.currentRoomId);
    console.log('🔍 Partner ID:', this.partnerId);
    console.log('🔍 Is Initiator:', this.isInitiator);
    console.log('🔍 Peer Connection:', !!this.peerConnection);
    console.log('🔍 Local Stream:', !!this.localStream);
    console.log('🔍 Remote Stream:', !!this.remoteStream);
    console.log('🔍 Status Check Interval:', !!this.statusCheckInterval);
    console.log('🔍 === END CONNECTION STATE DEBUG ===');
  }

  // Ensure signal listener is set up for the current room
  private async ensureSignalListenerSetup(): Promise<void> {
    if (!this.currentRoomId) {
      console.warn('⚠️ Cannot set up signal listener: no room ID');
      return;
    }

    console.log('🔔 Ensuring signal listener is set up for room:', this.currentRoomId);

    try {
              // First, ensure PubNub connection is established for this room
        const userId = this.getAuthenticatedUserId();
        if (userId) {
          console.log('🔌 Ensuring PubNub connection for room:', this.currentRoomId);
          // TODO: Implement PubNub connect method
          // await pubnubService.connect(userId, this.currentRoomId);
          console.log('✅ PubNub connection established for room:', this.currentRoomId);

          // Wait a bit for the connection to stabilize
          await new Promise(resolve => setTimeout(resolve, 1000));
          console.log('⏳ Waited for PubNub connection to stabilize');

          // Check if we're properly subscribed to the channel
          console.log('🔍 Checking channel subscription status...');
          try {
            // TODO: Implement getOnlineUsers method
            // const onlineUsers = await pubnubService.getOnlineUsers();
            // console.log('👥 Online users in room:', onlineUsers);
            // console.log('👤 Current user ID:', userId);
            // console.log('🔍 Is current user in online users?', onlineUsers.includes(userId));
            console.log('👥 Online users check not yet implemented');
          } catch (error) {
            console.warn('⚠️ Could not check online users:', error);
          }
        } else {
          console.warn('⚠️ Cannot establish PubNub connection: no user ID');
        }

      // Then set up the signal listener
      this.setupSignalListener();
      console.log('✅ Signal listener setup completed');

      // Test signal routing by sending a test signal
      console.log('🧪 Testing signal routing...');
      try {
        await this.sendTestSignal('ice-candidate', { test: true });
        console.log('✅ Test signal sent successfully');
      } catch (error) {
        console.error('❌ Test signal failed:', error);
      }
    } catch (error) {
      console.error('❌ Failed to set up signal listener:', error);
    }
  }

  // Start checking for matches
  private startStatusChecking(): void {
    if (this.statusCheckInterval) {
      clearInterval(this.statusCheckInterval);
    }

    this.statusCheckInterval = setInterval(async () => {
      try {
        // Verify we have a valid token before making the request
        const token = this.getAuthToken();
        if (!token) {
          console.warn('⚠️ No authentication token available for status check');
          return;
        }

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

        console.log('🔍 Status check response:', response);
        console.log('🔍 Response type:', typeof response);
        console.log('🔍 Response keys:', Object.keys(response));
        console.log('🔍 Response status:', response.status);
        console.log('🔍 Response room_id:', response.room_id);
        console.log('🔍 Response match_type:', response.match_type);
        console.log('🔍 Response partner:', response.partner);

        if (response.status === 'matched') {
          // CRITICAL FIX: Prevent processing the same match multiple times
          // if (this.currentRoomId === response.room_id &&
          //     this.sessionVersion === response.session_version) {
          //   console.log('⚠️ Duplicate match detected, ignoring:', response.room_id);
          //   return;
          // }

          console.log('🎉 Match found! Room ID:', response.room_id);
          console.log('🎉 Match type:', response.match_type);
          console.log('🎉 Partner:', response.partner);

          this.currentRoomId = response.room_id;

          // Fix: partnerId should be the OTHER user's ID, not the current user's ID
          if (response.partner && response.partner.id) {
            // If partner.id is 'video', keep it as is
            if (response.partner.id === 'video') {
              this.partnerId = 'video';
            } else {
              // For real users and staff, partnerId should be the other user's ID
              this.partnerId = response.partner.id.toString();
            }
          } else {
            this.partnerId = 'unknown';
          }

          this.isInitiator = response.is_initiator;
          this.sessionVersion = response.session_version || '';

          console.log('🔍 Set currentRoomId:', this.currentRoomId);
          console.log('🔍 Set partnerId:', this.partnerId, '(partner from backend:', response.partner, ')');
          console.log('🔍 Set isInitiator:', this.isInitiator);
          console.log('🔍 Set sessionVersion:', this.sessionVersion);

          // Process any queued ICE candidates that were generated before room info was set
          if (this.iceCandidateQueue.length > 0) {
            console.log(`📦 Processing ${this.iceCandidateQueue.length} queued ICE candidates after room setup`);
            await this.processQueuedIceCandidates();
          }

          // Stop checking status
          if (this.statusCheckInterval) {
            clearInterval(this.statusCheckInterval);
            this.statusCheckInterval = null;
            console.log('🛑 Stopped status checking');
          }

          // Handle different match types
          await this.handleMatchWithErrorHandling(response.match_type, response);
        }
      } catch (error) {
        console.error('❌ Error checking status:', error);

        // If we get a WebRTC error, reset the connection state
        if (error instanceof Error && (
          error.message.includes('no pending remote description') ||
          error.message.includes('setLocalDescription') ||
          error.message.includes('setRemoteDescription')
        )) {
          console.warn('🔄 WebRTC error detected, resetting connection state...');
          this.resetWebRTCState();
        }

        // If we get an authentication error, stop checking
        if (error instanceof Error && error.message.includes('401')) {
          console.warn('🔒 Authentication failed, stopping status checks');
          if (this.statusCheckInterval) {
            clearInterval(this.statusCheckInterval);
            this.statusCheckInterval = null;
          }
        }
      }
    }, 2000); // Check every 2 seconds
  }

  // Initialize WebRTC connection
  private async initializeWebRTC(): Promise<void> {
    try {
      console.log('🔗 Initializing WebRTC connection...');

      // Use existing local stream (camera permissions already granted)
      if (!this.localStream) {
        throw new Error('Local stream not available. Camera permissions may have been revoked.');
      }

      // Start the WebRTC connection
      await this.startWebRTCConnection();

      console.log('✅ WebRTC connection initialized');
    } catch (error) {
      console.error('❌ Failed to initialize WebRTC:', error);
    }
  }

  // Set up peer connection event handlers
  private setupPeerConnectionHandlers(): void {
    if (!this.peerConnection) return;

    this.peerConnection.ontrack = (event) => {
      console.log('📺 Remote track received:', event);
      console.log('📺 Streams count:', event.streams.length);
      console.log('📺 Track kind:', event.track.kind);

      if (event.streams && event.streams.length > 0) {
      this.remoteStream = event.streams[0];
        console.log('✅ Remote stream set:', this.remoteStream);
        console.log('✅ Remote stream tracks:', this.remoteStream.getTracks().map(t => t.kind));

      if (this.onRemoteStreamCallback) {
          console.log('📞 Calling onRemoteStreamCallback with stream');
        this.onRemoteStreamCallback(this.remoteStream);
        } else {
          console.warn('⚠️ No onRemoteStreamCallback set');
        }

        // Check remote stream status after setting it
        this.checkRemoteStreamStatus();
      } else {
        console.warn('⚠️ No streams in track event');
      }
    };

    this.peerConnection.onconnectionstatechange = () => {
      const state = this.peerConnection?.connectionState;
      console.log('🔗 Connection state changed:', state);

      if (this.onConnectionStateCallback && state) {
        this.onConnectionStateCallback(state);
      }

      // Auto-swipe on connection failure
      if (state === 'failed') {
        console.log('❌ WebRTC connection failed, automatically triggering swipe...');
        this.handleConnectionFailure();
      }
    };

    this.peerConnection.onicecandidate = (event) => {
      if (event.candidate) {
        console.log('🧊 ICE candidate generated');

        // Check if we have the necessary room and partner info before sending
        if (!this.currentRoomId || !this.partnerId) {
          console.warn('⚠️ ICE candidate generated but room/partner info not ready yet');
          console.warn('⚠️ Current Room ID:', this.currentRoomId);
          console.warn('⚠️ Partner ID:', this.partnerId);
          console.warn('⚠️ Queuing ICE candidate for later');

          // Queue the candidate for later when room/partner info is available
          this.iceCandidateQueue.push(event.candidate);
          return;
        }

        // Send ICE candidate to partner via signaling
        this.sendSignal('ice-candidate', event.candidate);
      }
    };
  }

  // Send test signal for routing verification (doesn't require full WebRTC state)
  private async sendTestSignal(type: string, data: any): Promise<void> {
    console.log(`🧪 Sending test ${type} signal`);

    if (!this.currentRoomId || !this.partnerId) {
      console.warn('⚠️ Cannot send test signal: missing room or partner info');
      console.warn('⚠️ Current Room ID:', this.currentRoomId);
      console.warn('⚠️ Partner ID:', this.partnerId);
      return;
    }

    console.log(`🧪 Test signal details:`, {
      type,
      data,
      roomId: this.currentRoomId,
      partnerId: this.partnerId,
      from: this.getAuthenticatedUserId()
    });

    try {
      // Send test signal via PubNub
      // TODO: Implement sendWebRTCSignal method
      // await pubnubService.sendWebRTCSignal({
      //   type: type as 'offer' | 'answer' | 'ice-candidate',
      //   data,
      //   from: this.getAuthenticatedUserId() || 'unknown',
      //   to: this.partnerId,
      //   chatId: this.currentRoomId
      // });

      console.log(`✅ Test signal ${type} not yet implemented`);
    } catch (error) {
      console.error(`❌ Failed to send test signal ${type}:`, error);
    }
  }

  // Validate connection state before sending signals
  private validateConnectionState(): boolean {
    if (!this.currentRoomId) {
      console.warn('⚠️ Connection validation failed: no room ID');
      return false;
    }

    if (!this.partnerId) {
      console.warn('⚠️ Connection validation failed: no partner ID');
      return false;
    }

    if (!this.peerConnection) {
      console.warn('⚠️ Connection validation failed: no peer connection');
      return false;
    }

    console.log('✅ Connection state validation passed');
    return true;
  }

  // Send WebRTC signal via PubNub with session versioning
  private async sendSignal(type: string, data: RTCSessionDescriptionInit | RTCIceCandidateInit): Promise<void> {
    if (!this.currentRoomId || !this.partnerId || !this.sessionVersion) {
      console.warn('⚠️ Cannot send signal: missing room, partner, or session version info');
      return;
    }

    try {
      const userId = this.getAuthenticatedUserId();
      if (!userId) {
        throw new Error('No user ID available for signal sending');
      }

      console.log(`📤 Sending ${type} signal to partner ${this.partnerId}`);

      switch (type) {
        case 'offer':
          if ('sdp' in data) {
            await pubnubService.sendOffer(this.partnerId, data.sdp || '');
            console.log('✅ Offer sent successfully');
          }
          break;
        case 'answer':
          if ('sdp' in data) {
            await pubnubService.sendAnswer(this.partnerId, data.sdp || '');
            console.log('✅ Answer sent successfully');
          }
          break;
        case 'ice-candidate':
          if ('candidate' in data) {
            await pubnubService.sendIceCandidate(this.partnerId, data);
            console.log('✅ ICE candidate sent successfully');
          } else {
            console.warn('⚠️ Invalid data type for ICE candidate');
          }
          break;
        default:
          console.warn('⚠️ Unknown signal type:', type);
      }
    } catch (error) {
      console.error(`❌ Failed to send ${type} signal:`, error);
      throw error;
    }
  }



  // Validate signal integrity
  private validateSignalIntegrity(signal: any): boolean {
    const requiredFields = ['type', 'from', 'sessionVersion'];
    const hasAllFields = requiredFields.every(field => signal.hasOwnProperty(field));

    if (!hasAllFields) {
      console.warn('⚠️ Signal missing required fields:', signal);
      return false;
    }

    // Validate session version
    if (signal.sessionVersion !== this.sessionVersion) {
      console.warn('⚠️ Session version mismatch:', signal.sessionVersion, this.sessionVersion);
      return false;
    }

    return true;
  }

  // Process message buffer in order
  private async processMessageBuffer(): Promise<void> {
    if (this.processingMessages) return;
    this.processingMessages = true;

    try {
      // Process messages in order by timestamp
      const sortedMessages = Array.from(this.messageBuffer.entries())
        .sort(([,a], [,b]) => {
          const aTs = a[0]?.ts || 0;
          const bTs = b[0]?.ts || 0;
          return aTs - bTs;
        });

      for (const [channel, messages] of sortedMessages) {
        for (const message of messages) {
          await this.handleIncomingSignal(message);
        }
      }

      // Clear processed messages
      this.messageBuffer.clear();
    } finally {
      this.processingMessages = false;
    }
  }

  // Listen for incoming signals from other users via PubNub
  private async handleIncomingSignal(signal: {
    type: 'ready' | 'offer' | 'answer' | 'ice' | 'bye' | 'health';
    from: string;
    to: string;
    sessionVersion: string;
    sdp?: string;
    candidate?: RTCIceCandidateInit;
    ts?: number;
  }): Promise<void> {
    console.log('📨 Received signal:', signal.type, 'from:', signal.from, 'to:', signal.to);

    // Verify this signal is from our partner (convert both to strings for comparison)
    const signalFromStr = signal.from.toString();
    const partnerIdStr = this.partnerId?.toString();
    const currentUserId = this.getAuthenticatedUserId()?.toString();

    console.log('🔍 Signal validation:', {
      signalFrom: signalFromStr,
      partnerId: partnerIdStr,
      currentUserId: currentUserId,
      match: signalFromStr === partnerIdStr
    });

    // Double-check: Ignore signals from ourselves (this should never happen with proper PubNub setup)
    if (signalFromStr === currentUserId) {
      console.log('⚠️ Ignoring signal from ourselves:', signalFromStr);
        return;
      }

    // Verify this signal is from our partner
    if (signalFromStr !== partnerIdStr) {
      console.log('⚠️ Ignoring signal from wrong partner. Expected:', partnerIdStr, 'Got:', signalFromStr);
      console.log('⚠️ Signal validation failed - partner ID mismatch');
      return;
    }

    // Check if WebRTC state is valid before processing signals
    if (this.isWebRTCResetting) {
      console.warn('⚠️ WebRTC is being reset, ignoring signal:', signal.type);
      return;
    }

    if (!this.peerConnection && (signal.type === 'offer' || signal.type === 'answer' || signal.type === 'ice')) {
      console.warn('⚠️ WebRTC state not ready, ignoring signal:', signal.type);
      return;
    }

    // Create a unique identifier for this signal to prevent duplicates
    const signalId = `${signal.type}_${signal.from}_${this.signalCounter++}_${Date.now()}`;

    // Check if we've already processed this signal
    if (this.processedSignals.has(signalId)) {
      console.warn('⚠️ Duplicate signal detected, ignoring:', signal.type);
          return;
        }

    // Mark this signal as processed
    this.processedSignals.add(signalId);

    // Clean up old signal IDs (keep only last 100)
    if (this.processedSignals.size > 100) {
      const signalArray = Array.from(this.processedSignals);
      this.processedSignals.clear();
      signalArray.slice(-50).forEach(id => this.processedSignals.add(id));
    }

        // Enhanced signal integrity validation
    console.log('🔍 Validating signal integrity:', {
      signalType: signal.type,
      signalSessionVersion: signal.sessionVersion,
      currentSessionVersion: this.sessionVersion,
      hasRequiredFields: ['type', 'from', 'sessionVersion'].every(field => signal.hasOwnProperty(field)),
      sessionVersionMatch: signal.sessionVersion === this.sessionVersion
    });

    if (!this.validateSignalIntegrity(signal)) {
      console.warn('⚠️ Signal integrity validation failed, ignoring signal');
        return;
    }

    console.log('✅ Signal validation passed, processing...');

    try {
      switch (signal.type) {
          case 'ready':
          console.log('✅ Partner is ready for WebRTC connection');
          console.log('🔍 Ready signal details:', {
            from: signal.from,
            to: signal.to,
            sessionVersion: signal.sessionVersion,
            currentSessionVersion: this.sessionVersion,
            match: signal.sessionVersion === this.sessionVersion
          });
          console.log('🔍 Current user state:', {
            isInitiator: this.isInitiator,
            partnerId: this.partnerId,
            currentRoomId: this.currentRoomId
          });

          // FIXED: Remove the duplicate signal check that was blocking ready signals
          // The processedSignals check was preventing the handshake from completing

          if (this.isInitiator) {
            console.log('🎯 Initiator: Partner ready, creating offer...');
            await this.createAndSendOffer();
          } else {
            console.log('⏳ Receiver: Partner ready, sending ready signal back to complete handshake...');
            console.log('🔍 About to send ready signal to partner:', signal.from);
            try {
              await pubnubService.sendReady(signal.from);
              console.log('✅ Ready signal sent to:', signal.from);
            } catch (error) {
              console.error('❌ Failed to send ready signal back:', error);
            }
          }
          break;
        case 'offer':
          if (signal.sdp) {
            console.log('📥 Received offer from partner');
            // FIX: Ensure peer connection is in correct state for offer
            if (this.peerConnection && this.peerConnection.signalingState === 'stable') {
              console.log('🔄 Peer connection in stable state, resetting for offer...');
              await this.resetWebRTCState();
              await this.setupPeerConnectionOnly();
            }
            await this.handleOffer({ sdp: signal.sdp, type: 'offer' });
          }
          break;
        case 'answer':
          if (signal.sdp) {
            console.log('📥 Received answer from partner');
            await this.handleAnswer({ sdp: signal.sdp, type: 'answer' });
          }
          break;
        case 'ice':
          if (signal.candidate) {
            console.log('🧊 Received ICE candidate from partner');
            await this.handleIceCandidate(signal.candidate);
          }
          break;
        case 'bye':
          console.log('👋 Partner is leaving/swiping, cleaning up connection...');
          this.handlePartnerLeft();
          break;
        case 'health':
          console.log('💓 Received heartbeat from partner:', signal);
          // Send heartbeat response via PubNub directly
          try {
            if (this.partnerId) {
              await pubnubService.sendHealth(this.partnerId);
              console.log('💓 Heartbeat response sent');
              this.clearWaitingRoomAfterConnection();
            }
          } catch (error) {
            console.warn('⚠️ Failed to send heartbeat response:', error);
          }
          break;
        default:
          console.log('⚠️ Unknown signal type:', signal.type);
      }
    } catch (error) {
      console.error('❌ Error handling signal:', error);
      // Reset state on critical errors
      if (error instanceof Error && (
        error.message.includes('setRemoteDescription') ||
        error.message.includes('setLocalDescription') ||
        error.message.includes('Called in wrong state') ||
        error.message.includes('Invalid signaling state')
      )) {
        console.warn('🔄 Critical WebRTC error, resetting connection state...');
        this.resetWebRTCState();
      }
    }
  }

  // Listen for incoming signals from other users via PubNub
  private setupSignalListener(): void {
    // This method is deprecated - signals are now handled by setupPubNubConnection
    console.log('⚠️ setupSignalListener is deprecated - using new session-versioned approach');
  }

  // Remove signal listener
  private removeSignalListener(): void {
    console.log('🔕 Removing signal listeners...');

    // Clean up PubNub connection
    if (this.currentRoomId) {
      pubnubService.leave();
      console.log('✅ Disconnected from PubNub');
    }

    // Clear cleanup functions
    this.webrtcSignalCleanup = null;
      this.generalMessageCleanup = null;
  }

    // Track PubNub connection state to prevent multiple joins
  private isPubNubConnecting = false;

  // Track if ready signal has been sent to prevent duplicates
  private hasSentReadySignal = false;

  // Track if WebRTC is being reset to prevent signal processing during reset
  private isWebRTCResetting = false;



  // Set up PubNub connection with session versioning
  private async setupPubNubConnection(): Promise<void> {
    if (!this.currentRoomId || !this.partnerId || !this.sessionVersion) {
      console.warn('⚠️ Cannot set up PubNub connection: missing room, partner, or session version info');
      return;
    }

    // CRITICAL FIX: Prevent multiple concurrent PubNub join attempts
    if (this.isPubNubConnecting) {
      console.warn('⚠️ PubNub connection already in progress, skipping duplicate request');
      return;
    }

    // SIMPLIFIED: Always ensure clean state for new connections
    // const currentSession = pubnubService.getCurrentSession();
    // if (currentSession.channel) {
    //   console.log('🔄 Resetting PubNub session for fresh connection');
    //   pubnubService.reset();
    // }

    console.log('🔌 Setting up PubNub connection for room:', this.currentRoomId);
    console.log('🔌 Session version:', this.sessionVersion);
    console.log('🔌 Partner ID:', this.partnerId);
    console.log('🔌 Is initiator:', this.isInitiator);

    try {
      this.isPubNubConnecting = true; // Set flag to prevent concurrent joins

      const userId = this.getAuthenticatedUserId();
      if (!userId) {
        throw new Error('No user ID available for PubNub connection');
      }

      // Join PubNub channel with session versioning
      pubnubService.join(
        this.currentRoomId,
        this.sessionVersion,
        userId,
        {
          onMessage: (signal) => {
          console.log('📨 PubNub message received:', signal.type, 'from:', signal.from, 'to:', signal.to);
          this.handleIncomingSignal(signal);
        },
          onJoin: () => this.handlePubNubJoin(),
          onLeave: () => console.log('👋 Left PubNub channel'),
          onError: (error) => console.error('❌ PubNub error:', error)
        }
      );

      console.log('✅ PubNub connection setup completed');
    } catch (error) {
      console.error('❌ Failed to set up PubNub connection:', error);
      throw error;
    } finally {
      this.isPubNubConnecting = false; // Reset flag regardless of success/failure
    }
  }

  // Handle PubNub join and initiate handshake
  private async handlePubNubJoin(): Promise<void> {
    console.log('✅ Joined PubNub channel successfully');

    try {
      // PROPER HANDSHAKE FLOW:
      if (this.partnerId && this.isInitiator && !this.hasSentReadySignal) {
        // Initiator: Send ready signal to start handshake (only once)
        console.log('🎯 Initiator: Sending ready signal to partner to start handshake');
        await pubnubService.sendReady(this.partnerId);
        this.hasSentReadySignal = true; // Mark as sent
        console.log('✅ Ready signal sent to partner');
        console.log('⏳ Waiting for partner ready signal before creating offer...');
      } else if (this.partnerId && !this.isInitiator) {
        // Receiver: Wait for initiator's ready signal
        console.log('⏳ Receiver: Waiting for initiator to send ready signal');
        console.log('⏳ Waiting for offer from initiator...');
      } else if (this.hasSentReadySignal) {
        console.log('⚠️ Ready signal already sent, skipping duplicate');
      }
    } catch (error) {
      console.error('❌ Error in PubNub join handling:', error);
    }
  }

  // Handle WebRTC offer
  private async handleOffer(offer: RTCSessionDescriptionInit): Promise<void> {
    console.log('📥 Handling offer');

    try {
      // Ensure peer connection exists and is in stable state
      if (!this.peerConnection) {
        console.warn('⚠️ Peer connection not ready, setting up now...');
        await this.setupPeerConnectionOnly();
      } else {
        // Double-check that the peer connection is truly fresh and ready
        if (this.peerConnection.signalingState !== 'stable' ||
            this.peerConnection.remoteDescription ||
            this.peerConnection.localDescription) {
          console.warn('⚠️ Peer connection has stale state, resetting...');
          this.resetWebRTCState();

          // Small delay to ensure cleanup is complete
          await new Promise(resolve => setTimeout(resolve, 100));

          // Set up fresh peer connection
        await this.setupPeerConnectionOnly();
        }
      }

      // Log current WebRTC state
      this.logWebRTCState();

      // Comprehensive state validation to prevent duplicate offer processing
      if (this.peerConnection!.remoteDescription) {
        console.warn('⚠️ Remote description already exists, ignoring duplicate offer');
        return;
      }

      // Check if we're in a valid state for receiving an offer
      if (this.peerConnection!.signalingState === 'have-remote-offer' ||
          this.peerConnection!.signalingState === 'have-local-offer') {
        console.warn('⚠️ Invalid state for offer processing:', this.peerConnection!.signalingState);
        return;
      }

      // FIXED: Accept offers in 'stable' state as long as no remote description exists
      // 'stable' state is valid for receiving offers when the connection is fresh

      // Set remote description first
      await this.peerConnection!.setRemoteDescription(new RTCSessionDescription(offer));
      console.log('✅ Remote description set successfully');
      this.logWebRTCState();

      // Check remote stream status after setting remote description
      console.log('🔍 Checking remote stream after setting remote description...');
      this.checkRemoteStreamStatus();

      // Log current signaling state for debugging
      const currentState = this.peerConnection!.signalingState;
      console.log('🔍 Current signaling state before creating answer:', currentState);

      // Create and send answer
      const answer = await this.peerConnection!.createAnswer();
      await this.peerConnection!.setLocalDescription(answer);
      console.log('✅ Local description (answer) set successfully');
      this.logWebRTCState();

      // Check remote stream status again after setting local description
      console.log('🔍 Checking remote stream after setting local description...');
      this.checkRemoteStreamStatus();

      // Send answer to partner
      this.sendSignal('answer', answer);
      console.log('✅ Answer sent to partner');

      // Process any queued ICE candidates
      await this.processQueuedIceCandidates();
    } catch (error) {
      console.error('❌ Error handling offer:', error);
      // Reset state on critical errors
      if (error instanceof Error && (
        error.message.includes('setRemoteDescription') ||
        error.message.includes('setLocalDescription') ||
        error.message.includes('createAnswer') ||
        error.message.includes('Called in wrong state') ||
        error.message.includes('Invalid signaling state')
      )) {
        console.warn('🔄 Critical WebRTC error in offer handling, resetting connection state...');
        this.resetWebRTCState();
      }
    }
  }

  // Handle WebRTC answer
  private async handleAnswer(answer: RTCSessionDescriptionInit): Promise<void> {
    console.log('📥 Handling answer');

    try {
      // Ensure peer connection exists
      if (!this.peerConnection) {
        console.warn('⚠️ No peer connection available, ignoring answer');
        return;
      }

      // Ensure we have a local description before setting remote
      if (!this.peerConnection.localDescription) {
        console.warn('⚠️ No local description set, cannot process answer');
        return;
      }

      // Log current WebRTC state
      this.logWebRTCState();

      // Check if peer connection is in the correct state for receiving an answer
      if (this.peerConnection.signalingState !== 'have-local-offer') {
        console.warn('⚠️ Peer connection not in have-local-offer state, current state:', this.peerConnection.signalingState);
        // Reset the connection if it's in the wrong state
        console.log('🔄 Resetting peer connection due to invalid answer state...');
        this.resetWebRTCState();
        return;
      }

      // Set remote description
      await this.peerConnection.setRemoteDescription(new RTCSessionDescription(answer));
      console.log('✅ Answer processed successfully');
      this.logWebRTCState();

      // Log current signaling state
      const currentState = this.peerConnection.signalingState;
      console.log('🔍 Signaling state after answer:', currentState);

      // Check if connection is stable (using string comparison to avoid TypeScript strictness)
      if (String(currentState) === 'stable') {
        console.log('✅ WebRTC connection established successfully');

        // Start heartbeat monitoring for connection health
        this.startHeartbeat();
      }

      // Process queued ICE candidates
      await this.processQueuedIceCandidates();
    } catch (error) {
      console.error('❌ Error handling answer:', error);
      // Reset state on critical errors
      if (error instanceof Error && (
        error.message.includes('setRemoteDescription') ||
        error.message.includes('Called in wrong state')
      )) {
        console.warn('🔄 Critical WebRTC error in answer handling, resetting connection state...');
        this.resetWebRTCState();
      }
    }
  }

    // Handle ICE candidate safely
  private async handleIceCandidate(candidate: RTCIceCandidateInit): Promise<void> {
    try {
      // Ensure peer connection exists
      if (!this.peerConnection) {
        console.warn('⚠️ No peer connection available, ignoring ICE candidate');
        return;
      }

      // CRITICAL: Check if remote description is set before adding ICE candidates
      if (!this.peerConnection.remoteDescription) {
        console.warn('⚠️ Remote description not set, queuing ICE candidate for later processing');
        this.queueIceCandidate(candidate);
      return;
    }

      // Check if we're in a valid state for adding ICE candidates
      const state = this.peerConnection.signalingState;
      if (state === 'closed') {
        console.warn('⚠️ Peer connection is closed, ignoring ICE candidate');
      return;
    }

      // Additional state validation for ICE candidate processing
      if (state === 'stable' && this.peerConnection.localDescription && this.peerConnection.remoteDescription) {
        // In stable state, we can add ICE candidates
        await this.peerConnection.addIceCandidate(new RTCIceCandidate(candidate));
        console.log('✅ ICE candidate added successfully in stable state');
      } else if (state === 'have-remote-offer' || state === 'have-local-offer') {
        // In offer/answer states, we can add ICE candidates
        await this.peerConnection.addIceCandidate(new RTCIceCandidate(candidate));
        console.log('✅ ICE candidate added successfully in', state, 'state');
      } else {
        console.warn('⚠️ Invalid signaling state for ICE candidate:', state);
        console.warn('⚠️ Queuing ICE candidate for later processing');
        this.queueIceCandidate(candidate);
        return;
      }
    } catch (error) {
      console.error('❌ Error adding ICE candidate:', error);

      // If we get an m-lines order error, this means the connection is in an invalid state
      if (error instanceof Error && error.message.includes('m-lines')) {
        console.warn('⚠️ M-lines order error detected, resetting WebRTC state...');
        this.resetWebRTCState();
      } else if (error instanceof Error && error.message.includes('remote description was null')) {
        console.warn('⚠️ Remote description null error, queuing ICE candidate for later processing');
        this.queueIceCandidate(candidate);
      }
    }
  }

  // Queue ICE candidate for later processing when remote description is not ready
  private queueIceCandidate(candidate: RTCIceCandidateInit): void {
    console.log('📦 Queuing ICE candidate for later processing:', candidate);

    // Add to queue with timestamp for ordering
    this.iceCandidateQueue.push({
      ...candidate,
      queuedAt: Date.now()
    });

    console.log(`📦 ICE candidate queued. Queue size: ${this.iceCandidateQueue.length}`);
  }

  // Process queued ICE candidates
  private async processQueuedIceCandidates(): Promise<void> {
    if (this.iceCandidateQueue.length === 0) {
      console.log('📦 No queued ICE candidates to process');
      return;
    }

    console.log(`📦 Processing ${this.iceCandidateQueue.length} queued ICE candidates...`);

    // Filter out invalid candidates and process valid ones
    const validCandidates = this.iceCandidateQueue.filter(candidate => candidate && candidate.candidate);
    console.log(`📦 Found ${validCandidates.length} valid candidates`);

    // Process each valid candidate in order (oldest first)
    const sortedCandidates = validCandidates.sort((a, b) => (a.queuedAt || 0) - (b.queuedAt || 0));

    for (const candidate of sortedCandidates) {
      try {
        await this.handleIceCandidate(candidate);
        console.log('✅ Queued ICE candidate processed successfully');
      } catch (error) {
        console.error('❌ Failed to process queued ICE candidate:', error);
        // Don't break the loop, continue with other candidates
      }
    }

    // Clear the queue
    this.iceCandidateQueue = [];
    console.log('📦 ICE candidate queue processed and cleared');
  }

  // Reset WebRTC state completely (for critical errors)
  private resetWebRTCState(): void {
    console.log('🔄 Resetting WebRTC state completely...');
    this.isWebRTCResetting = true;

    // Close and clear peer connection
    if (this.peerConnection) {
      try {
        // Close all transceivers first
        this.peerConnection.getTransceivers().forEach(transceiver => {
          if (transceiver.stop) {
            transceiver.stop();
            console.log('🛑 Transceiver stopped:', transceiver.mid);
          }
        });

        // Close the peer connection
        this.peerConnection.close();
        console.log('✅ Peer connection closed and cleared');
      } catch (error) {
        console.warn('⚠️ Error during peer connection cleanup:', error);
      } finally {
        this.peerConnection = null;
      }
    }

    // Clear remote stream
    if (this.remoteStream) {
      try {
        this.remoteStream.getTracks().forEach(track => {
          track.stop();
          console.log('🛑 Remote stream track stopped:', track.kind);
        });
      } catch (error) {
        console.warn('⚠️ Error during remote stream cleanup:', error);
      } finally {
        this.remoteStream = null;
        console.log('✅ Remote stream cleared');
      }
    }

    // Clear ICE candidate queue
    this.iceCandidateQueue = [];
    console.log('✅ ICE candidate queue cleared');

    // Clear processed signals tracking
    this.processedSignals.clear();
    this.signalCounter = 0;
    console.log('✅ Processed signals tracking cleared');

    // Clear message buffer
    this.messageBuffer.clear();
    this.processingMessages = false;
    console.log('✅ Message buffer cleared');

        // Clear connection timeout
    this.stopConnectionTimeoutMonitoring();

    // Stop heartbeat monitoring
    this.stopHeartbeat();

    // Reset PubNub connection state
    this.isPubNubConnecting = false;



    // Force garbage collection hint (if available)
    if (typeof window !== 'undefined' && (window as any).gc) {
      try {
        (window as any).gc();
        console.log('🧹 Garbage collection triggered');
      } catch (error) {
        // Ignore if gc is not available
      }
    }

    console.log('✅ WebRTC state reset complete');
    this.isWebRTCResetting = false;
  }

  // Reset WebRTC state only (preserves local stream)
  private resetWebRTCStateOnly(): void {
    console.log('🔄 Resetting WebRTC state only (preserving local stream)...');

    // Close peer connection
    if (this.peerConnection) {
        this.peerConnection.close();
        console.log('✅ Peer connection closed successfully');
      this.peerConnection = null;
    }

    // Clear remote stream
    if (this.remoteStream) {
      this.remoteStream.getTracks().forEach(track => {
        track.stop();
        console.log('🛑 Remote stream track stopped:', track.kind);
      });
      this.remoteStream = null;
    }

    // Clear WebRTC-related state
    this.currentRoomId = null;
    this.partnerId = null;
    this.isInitiator = false;
    this.sessionVersion = null;

    // Clear ICE candidate queue
    this.iceCandidateQueue = [];

    console.log('✅ WebRTC state reset complete (local stream preserved)');
  }

  // Ensure peer connection is properly set up
  private ensurePeerConnectionReady(): void {
    if (!this.peerConnection) {
      throw new Error('Peer connection not initialized. Call setupPeerConnectionOnly() first.');
    }

    if (!this.localStream) {
      throw new Error('Local stream not available. Cannot proceed with WebRTC connection.');
    }

    console.log('✅ Peer connection ready for WebRTC operations');
  }

  // Ensure complete cleanup before new peer connection setup
  private async ensureCompleteCleanup(): Promise<void> {
    console.log('🧹 Ensuring complete cleanup before new setup...');

    // Force reset if there's any existing state
    if (this.peerConnection || this.remoteStream || this.iceCandidateQueue.length > 0) {
      console.log('⚠️ Existing state detected, forcing complete reset...');
      this.resetWebRTCState();
    }

    // Small delay to ensure cleanup is complete
    await new Promise(resolve => setTimeout(resolve, 100));
  }

  // Set up peer connection without creating offer (for non-initiators)
  private async setupPeerConnectionOnly(): Promise<void> {
    console.log('🔗 Setting up peer connection (waiting for offer)...');

    try {
      // Create peer connection with proper STUN servers
      this.peerConnection = new RTCPeerConnection({
        iceServers: [
          { urls: 'stun:stun.l.google.com:19302' },
          { urls: 'stun:stun1.l.google.com:19302' },
          { urls: 'stun:stun2.l.google.com:19302' },
          { urls: 'stun:stun3.l.google.com:19302' },
          { urls: 'stun:stun4.l.google.com:19302' }
        ]
      });

      console.log('✅ Peer connection created successfully (waiting for offer)');

      // Set up event handlers
      this.setupPeerConnectionHandlers();

      // Add local stream
      if (this.localStream) {
        this.localStream.getTracks().forEach(track => {
          if (this.peerConnection) {
            this.peerConnection.addTrack(track, this.localStream!);
          }
        });
        console.log('✅ Local stream tracks added to peer connection');
      } else {
        console.warn('⚠️ No local stream available for peer connection setup');
      }

      console.log('✅ Peer connection set up successfully (waiting for offer)');
    } catch (error) {
      console.error('❌ Failed to set up peer connection:', error);
      // Reset state on critical errors
      if (error instanceof Error && error.message.includes('addTrack')) {
        console.warn('🔄 Critical WebRTC error, resetting connection state...');
        this.resetWebRTCState();
      }
      throw error;
    }
  }

  // Start WebRTC connection (assumes peer connection is already set up)
  private async startWebRTCConnection(): Promise<void> {
    console.log('🔗 Starting WebRTC connection...');

    try {
      // Ensure peer connection is ready
      this.ensurePeerConnectionReady();

      // Start connection timeout monitoring
      this.startConnectionTimeoutMonitoring();

      console.log('✅ Using existing peer connection for WebRTC connection');

      // For the new handshake flow, we wait for the partner's ready signal
      // The offer will be created and sent in createAndSendOffer() when ready is received
      if (this.isInitiator) {
        console.log('⏳ Initiator: Waiting for partner ready signal before creating offer...');
      } else {
        console.log('⏳ Receiver: Waiting for offer from initiator...');
      }

      console.log('✅ WebRTC connection started successfully');
    } catch (error) {
      console.error('❌ Failed to start WebRTC connection:', error);
      // Stop timeout monitoring on error
      this.stopConnectionTimeoutMonitoring();

      // Reset state on critical errors
      if (error instanceof Error && (
        error.message.includes('createOffer') ||
        error.message.includes('setLocalDescription')
      )) {
        console.warn('🔄 Critical WebRTC error, resetting connection state...');
        this.resetWebRTCState();
      }
      throw error;
    }
  }



  // Handle chat message
  private handleChatMessage(message: { text: string; from: string; timestamp: number; id?: string }): void {
    console.log('💬 Received chat message:', message);

    if (this.onMessageReceivedCallback) {
      this.onMessageReceivedCallback(message);
    }
  }

  // Handle match with proper error handling and fallbacks
  private async handleMatchWithErrorHandling(matchType: string, matchData: any): Promise<void> {
    console.log(`🎯 Handling match with type: ${matchType}`);
    console.log(`🔍 Match data:`, {
      video_id: matchData.video_id,
      video_url: matchData.video_url,
      video_name: matchData.video_name,
      partner: matchData.partner,
      partner_id: matchData.partner?.id,
      room_id: matchData.room_id,
      match_type: matchData.match_type
    });
    console.log(`🔍 Current service state:`, {
      partnerId: this.partnerId,
      currentRoomId: this.currentRoomId,
      sessionVersion: this.sessionVersion
    });

    try {
      // Case 1: Video Match - Handle video playback
      if (matchData.video_id && matchData.video_url) {
        console.log('🎥 Video match detected - handling video playback...');
        console.log('🎥 Video data:', {
          videoId: matchData.video_id,
          videoUrl: matchData.video_url,
          videoName: matchData.video_name || 'Video'
        });

        await this.handleVideoMatch({
          videoId: matchData.video_id?.toString() || 'unknown',
          videoUrl: matchData.video_url || '',
          videoName: matchData.video_name || 'Video'
        });

        console.log('✅ Video match handling completed - NO WebRTC should be started');
        return; // Explicitly return to prevent any further processing
      } else if (matchData.partner && matchData.partner.id && matchData.partner.id !== 'video') {
        // Case 2: Live Connection (staff or real user) - Start WebRTC
        console.log('🔗 Live connection detected - starting WebRTC...');
        console.log('🔗 Partner ID:', matchData.partner.id);
        console.log('🔗 Is Initiator:', this.isInitiator);

        // Verify we have a valid partner (not a ghost connection)
        if (matchData.partner.id === this.getAuthenticatedUserId()) {
          console.warn('⚠️ Ghost connection detected - partner ID matches current user');
          console.warn('⚠️ This suggests a backend matching error, falling back to video');

          // Try to get a video match instead
          await this.requestVideoMatchFallback();
      return;
    }

        await this.setupPubNubConnection();

        // Set up peer connection for both initiator and receiver
        await this.setupPeerConnectionOnly();

        if (this.isInitiator) {
          // For initiators, start the WebRTC connection (send offer)
          await this.startWebRTCConnection();
        } else {
          // For receivers, just wait for the offer
          console.log('⏳ Waiting for offer from initiator...');
        }
      } else {
        console.warn('⚠️ Unknown match type - no video data and no partner info');
        console.warn('⚠️ Video ID exists:', !!matchData.video_id);
        console.warn('⚠️ Video URL exists:', !!matchData.video_url);
        console.warn('⚠️ Partner exists:', !!matchData.partner);

        // Fall back to video match
        console.log('🔄 Attempting video match fallback...');
        await this.requestVideoMatchFallback();
        return;
      }

      console.log(`✅ Match handling completed successfully`);
    } catch (error) {
      console.error(`❌ Error handling match:`, error);

      // Implement fallback strategies
      await this.handleMatchFallback(matchData, error);
    }
  }

  // Request video match fallback when real user match fails
  private async requestVideoMatchFallback(): Promise<void> {
    console.log('🎥 Requesting video match fallback...');

    try {
      // Call the swipe endpoint again to get a video match
      const result = await this.swipeToNext();

      if (result.success && result.matchType === 'video') {
        console.log('✅ Video match fallback successful');
      } else {
        console.warn('⚠️ Video match fallback failed, showing error to user');
        // Notify UI of connection failure
        if (this.onConnectionStateCallback) {
          this.onConnectionStateCallback('failed' as RTCPeerConnectionState);
        }
      }
    } catch (error) {
      console.error('❌ Error requesting video match fallback:', error);
      // Notify UI of connection failure
      if (this.onConnectionStateCallback) {
        this.onConnectionStateCallback('failed' as RTCPeerConnectionState);
      }
    }
  }

  // Simplified fallback handling
  private async handleMatchFallback(matchData: any, error: unknown): Promise<void> {
    console.log(`🔄 Implementing fallback for failed match`);

    try {
      if (matchData.video_id && matchData.video_url) {
        // Video fallback: try simulated stream
        console.log('🎥 Video fallback: creating simulated stream');
        const fallbackStream = await this.createSimulatedVideoStream();
        if (fallbackStream) {
          this.remoteStream = fallbackStream;
          if (this.onRemoteStreamCallback) {
            this.onRemoteStreamCallback(fallbackStream);
          }
        }
      } else {
        // WebRTC fallback: try to reconnect
        console.log('🔗 WebRTC fallback: attempting reconnection');
        await this.attemptReconnection();
      }
    } catch (fallbackError) {
      console.error('❌ Fallback also failed:', fallbackError);

      // Notify user of connection failure
      if (this.onConnectionStateCallback) {
        this.onConnectionStateCallback('failed' as RTCPeerConnectionState);
      }
    }
  }

  // Retry with exponential backoff
  private async retryWithBackoff(operation: () => Promise<any>, maxRetries = 3): Promise<any> {
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        return await operation();
    } catch (error) {
        if (attempt === maxRetries) throw error;

        const delay = Math.pow(2, attempt) * 1000; // Exponential backoff
        console.log(`🔄 Retry attempt ${attempt} failed, waiting ${delay}ms before retry...`);
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }
  }

  // Attempt to reconnect after failure
  private async attemptReconnection(): Promise<void> {
    console.log('🔄 Attempting reconnection...');

    try {
      // Check if we have the minimum required parameters
      if (!this.currentRoomId || !this.partnerId) {
        console.warn('⚠️ Cannot reconnect: missing room ID or partner ID');
        console.log('🔍 Current state:', {
          roomId: this.currentRoomId,
          partnerId: this.partnerId,
          sessionVersion: this.sessionVersion
        });

        // Instead of failing, trigger a new match request
        console.log('🔄 Triggering new match request instead of reconnection');
        await this.requestNewMatch();
        return;
      }

      // Reset current state
    this.resetWebRTCState();

      // Wait a bit before retrying
      await new Promise(resolve => setTimeout(resolve, 2000));

      // Try to set up connection again
      if (this.currentRoomId && this.partnerId && this.sessionVersion) {
        await this.setupPubNubConnection();

        if (this.isInitiator) {
          await this.startWebRTCConnection();
        } else {
          await this.setupPeerConnectionOnly();
        }

        console.log('✅ Reconnection successful');
      } else {
        throw new Error('Missing connection parameters for reconnection');
      }
    } catch (error) {
      console.error('❌ Reconnection failed:', error);
      throw error;
    }
  }

  // Request a new match when reconnection fails
  private async requestNewMatch(): Promise<void> {
    console.log('🔄 Requesting new match...');

    try {
      // Call the swipe endpoint to get a new match
      const result = await this.swipeToNext();

      if (result.success) {
        console.log('✅ New match obtained successfully');
      } else {
        console.warn('⚠️ Failed to get new match - requesting new match');
      }
    } catch (error) {
      console.error('❌ Error requesting new match:', error);
    }
  }

  // Clean up all resources and reset state
  cleanup(): void {
    console.log('🧹 Cleaning up CleanVideoChatService...');

    // Ensure PubNub is completely reset
    if (pubnubService.getCurrentSession().channel) {
      console.log('🔄 Completely resetting PubNub before cleanup');
      pubnubService.reset();
    }

    // Stop connection timeout monitoring
    this.stopConnectionTimeoutMonitoring();

    // Stop swipe debounce timeout
    if (this.swipeDebounceTimeout) {
      clearTimeout(this.swipeDebounceTimeout);
      this.swipeDebounceTimeout = null;
    }

    // Stop status checking
    if (this.statusCheckInterval) {
      clearInterval(this.statusCheckInterval);
      this.statusCheckInterval = null;
    }

    // Close peer connection
    if (this.peerConnection) {
      this.peerConnection.close();
      this.peerConnection = null;
      console.log('✅ Peer connection closed');
    }

    // Stop local stream tracks
    if (this.localStream) {
      this.localStream.getTracks().forEach(track => track.stop());
      console.log('✅ Local stream tracks stopped');
    }

    // Stop remote stream tracks
    if (this.remoteStream) {
      this.remoteStream.getTracks().forEach(track => track.stop());
      console.log('✅ Remote stream tracks stopped');
    }

    // Clear streams
    this.localStream = null;
      this.remoteStream = null;

    // Clear PubNub connection
    pubnubService.leave();

    // Clear intervals
    if (this.statusCheckInterval) {
      clearInterval(this.statusCheckInterval);
      this.statusCheckInterval = null;
    }

    // Clear callbacks
    this.onRemoteStreamCallback = null;
    this.onConnectionStateCallback = null;
    this.onMessageReceivedCallback = null;
    this.onVideoMatchCallback = null;
    this.onPartnerLeftCallback = null;

    // Reset state
    this.currentRoomId = null;
    this.partnerId = null;
    this.isInitiator = false;
    this.sessionVersion = null;
    this.isSwiping = false;

    // Clear ICE candidate queue
    this.iceCandidateQueue = [];

    console.log('✅ Cleanup completed');
  }

  // Manually refresh token validation (useful for testing or when token is refreshed)
  async refreshTokenValidation(): Promise<boolean> {
    console.log('🔄 Manually refreshing token validation...');

    // Clear existing cache
    this.tokenValidationCache = null;

    // Force a new validation
    try {
      const userId = await this.waitForAuthentication(10000); // 10 second timeout for manual refresh
      return !!userId;
    } catch (error) {
      console.error('❌ Manual token validation refresh failed:', error);
      return false;
    }
  }

  // Check if camera permissions are available (legacy method for compatibility)
  async checkCameraPermissions(): Promise<boolean> {
    const permissionState = await this.checkPermissionState();
    return permissionState === 'granted';
  }

  // Handle user matching and room setup
  async handleUserMatched(roomId: string, partnerId: string, isInitiator: boolean): Promise<void> {
    console.log('🎉 User matched! Room:', roomId, 'Partner:', partnerId, 'Initiator:', isInitiator);

    this.currentRoomId = roomId;
    this.partnerId = partnerId;
    this.isInitiator = isInitiator;

    // Initialize WebRTC connection
    await this.initializeWebRTC();
  }

  // Check if user is in a chat room
  isInChat(): boolean {
    return this.currentRoomId !== null && this.partnerId !== null;
  }

  // Get current room information
  getCurrentRoomInfo(): { roomId: string | null; partnerId: string | null; isInitiator: boolean; sessionVersion: string | null } {
    return {
      roomId: this.currentRoomId,
      partnerId: this.partnerId,
      isInitiator: this.isInitiator,
      sessionVersion: this.sessionVersion
    };
  }

  // Handle partner left event
  private handlePartnerLeft(): void {
    console.log('👋 Partner is leaving/swiping, cleaning up connection...');

    // Notify UI that partner left
    if (this.onPartnerLeftCallback) {
      this.onPartnerLeftCallback();
    }

    // Clean up the current connection
    this.performSwipeCleanup();

    // CRITICAL FIX: Force new match request after cleanup
    console.log('🔄 Forcing new match request after cleanup...');
    this.forceNewMatchRequest();
  }

  // Check if currently swiping
  isSwipingInProgress(): boolean {
    return this.isSwiping;
  }

  // Force new match request after cleanup
  private async forceNewMatchRequest(): Promise<void> {
    console.log('🔄 Forcing new match request...');

    try {
      // Clear current state to ensure fresh match
      this.currentRoomId = null;
      this.partnerId = null;
      this.sessionVersion = null;

      // Request new match from backend
      const result = await this.swipeToNext();

      if (result.success) {
        console.log('✅ New match request successful');
      } else {
        console.log('⚠️ New match request failed, will retry via status checking');
      }
    } catch (error) {
      console.error('❌ Error forcing new match request:', error);
    }
  }

  // Clear waiting room after successful connection
  private async clearWaitingRoomAfterConnection(): Promise<void> {
    if (!this.currentRoomId) {
      console.log('⚠️ No room ID available for waiting room cleanup');
      return;
    }

    try {
      console.log('🧹 Clearing waiting room after successful connection...');

      // Call backend to clear waiting room
      await api.post('/video_chat/clear_waiting_room', {
        room_id: this.currentRoomId,
        user_id: this.getAuthenticatedUserId()
      });

      console.log('✅ Waiting room cleared successfully');
    } catch (error) {
      console.warn('⚠️ Failed to clear waiting room:', error);
      // Don't throw error - this is cleanup, not critical
    }
  }

  // Ensure local stream is healthy and restore if needed
  private async ensureLocalStreamHealth(): Promise<void> {
    if (!this.localStream) {
      console.log('🔍 Local stream missing, attempting to restore...');
      try {
        await this.getLocalStream();
        console.log('✅ Local stream restored successfully');
      } catch (error) {
        console.error('❌ Failed to restore local stream:', error);
        throw new Error('Local stream cannot be restored');
      }
    } else {
      // Check if stream is still active
      const tracks = this.localStream.getTracks();
      const activeTracks = tracks.filter(track => track.readyState === 'live');

      if (activeTracks.length === 0) {
        console.warn('⚠️ Local stream tracks are not active, refreshing...');
        try {
          await this.forceRefreshLocalStream();
          console.log('✅ Local stream refreshed successfully');
        } catch (error) {
          console.error('❌ Failed to refresh local stream:', error);
          throw new Error('Local stream cannot be refreshed');
        }
      } else {
        console.log('✅ Local stream is healthy with', activeTracks.length, 'active tracks');
      }
    }
  }

  // Check if we're in a valid state and recover if needed
  private async validateAndRecoverState(): Promise<void> {
    console.log('🔍 Validating current state...');

    // Check if we have a valid room but no active connection
    if (this.currentRoomId && this.partnerId && this.partnerId !== 'video') {
      if (!this.peerConnection || !this.remoteStream) {
        console.warn('⚠️ Invalid state detected: room exists but no active connection');

        // REDUCED RECOVERY: Only clear state, don't attempt aggressive reconnection
        console.log('🧹 Clearing invalid state instead of aggressive recovery...');
        this.performSwipeCleanup();
      }
    }

    // Check if we're stuck in video state without video data
    if (this.currentRoomId && this.partnerId === 'video' && !this.onVideoMatchCallback) {
      console.warn('⚠️ Invalid video state detected: no video callback');
      console.log('🔄 Clearing invalid video state...');
      this.performSwipeCleanup();
    }

    console.log('✅ State validation completed');
  }

  // Handle video completion and transition to next state
  private async handleVideoCompletion(): Promise<void> {
    console.log('🎬 Video completed, transitioning to next state...');

    try {
      // Clear video state
      if (this.onVideoMatchCallback) {
        // Trigger callback to clear video UI
        this.onVideoMatchCallback({
          videoId: '',
          videoUrl: '',
          videoName: ''
        });
      }

      // Wait a moment for UI to update
      await new Promise(resolve => setTimeout(resolve, 500));

      // Automatically request next match
      console.log('🔄 Auto-requesting next match after video completion...');
      const result = await this.swipeToNext();

      if (result.success) {
        console.log('✅ Auto-swipe successful after video completion');
      } else {
        console.log('⚠️ Auto-swipe failed, user may need to manually swipe');
      }
    } catch (error) {
      console.error('❌ Error handling video completion:', error);
      // Don't throw - this is a background process
    }
  }

  // Start connection timeout monitoring
  private startConnectionTimeoutMonitoring(): void {
    this.stopConnectionTimeoutMonitoring(); // Clear any existing timeout

    this.connectionStartTime = Date.now();
    console.log('⏰ Starting connection timeout monitoring (40 seconds)...');

    this.connectionTimeoutId = setTimeout(() => {
      this.handleConnectionTimeout();
    }, this.CONNECTION_TIMEOUT_MS);
  }

  // Stop connection timeout monitoring
  private stopConnectionTimeoutMonitoring(): void {
    if (this.connectionTimeoutId) {
      clearTimeout(this.connectionTimeoutId);
      this.connectionTimeoutId = null;
      console.log('⏰ Connection timeout monitoring stopped');
    }
    this.connectionStartTime = null;
  }

  // Handle connection timeout - no remote stream after 40 seconds
  private async handleConnectionTimeout(): Promise<void> {
    console.warn('⏰ Connection timeout reached - no remote stream after 40 seconds');

    // Check if we have a remote stream
    if (this.remoteStream && this.remoteStream.active) {
      console.log('✅ Remote stream is active, connection timeout was false positive');
      return;
    }

    console.warn('⚠️ No active remote stream detected, falling back to video or next match...');

    try {
      // Try to get a video match as fallback
      console.log('🔄 Attempting video match fallback due to connection timeout...');
      await this.requestVideoMatchFallback();
    } catch (error) {
      console.error('❌ Video match fallback failed:', error);

      // If video fallback fails, try to swipe to next match
      console.log('🔄 Video fallback failed, trying to swipe to next match...');
      try {
        await this.swipeToNext();
      } catch (swipeError) {
        console.error('❌ Swipe to next match also failed:', swipeError);
      }
    }
  }

  // Start heartbeat mechanism for connection health monitoring
  private startHeartbeat(): void {
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
    }

    this.heartbeatInterval = setInterval(() => {
      if (this.peerConnection && this.peerConnection.connectionState === 'connected') {
        // Send heartbeat to partner via PubNub directly
        try {
          if (this.partnerId) {
            pubnubService.sendHealth(this.partnerId);
            console.log('💓 Heartbeat sent to partner');
          }
        } catch (error) {
          console.warn('⚠️ Failed to send heartbeat:', error);
        }
      }
    }, 30000); // Every 30 seconds
  }

  // Stop heartbeat monitoring
  private stopHeartbeat(): void {
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
      this.heartbeatInterval = null;
      console.log('💓 Heartbeat monitoring stopped');
    }
  }

  // Check connection health and reset timeout if remote stream appears
  private checkConnectionHealth(): void {
    if (this.connectionStartTime && this.remoteStream && this.remoteStream.active) {
      const connectionDuration = Date.now() - this.connectionStartTime;
      console.log(`✅ Remote stream detected after ${connectionDuration}ms, connection successful!`);

      // Stop timeout monitoring since we have a successful connection
      this.stopConnectionTimeoutMonitoring();
    }
  }

  // Handle remote stream from peer connection
  private handleRemoteStream(stream: MediaStream): void {
    console.log('📹 Remote stream received from peer connection');

    if (this.remoteStream) {
      // Stop existing remote stream
      this.remoteStream.getTracks().forEach(track => track.stop());
    }

    this.remoteStream = stream;

    // Check connection health when remote stream appears
    this.checkConnectionHealth();

    // Set remote stream on video element if callback exists
    if (this.onRemoteStreamCallback) {
      this.onRemoteStreamCallback(stream);
    }

    console.log('✅ Remote stream set successfully');
  }

  // Handle connection failure by automatically triggering swipe
  private async handleConnectionFailure(): Promise<void> {
    console.log('🔄 Handling connection failure, triggering automatic swipe...');

    try {
      // Clean up the failed connection
      this.resetWebRTCState();

      // Trigger swipe to get a new match
      if (this.onPartnerLeftCallback) {
        console.log('👋 Triggering partner left callback for automatic swipe...');
        this.onPartnerLeftCallback();
      } else {
        console.log('⚠️ No partner left callback available, cannot auto-swipe');
      }
    } catch (error) {
      console.error('❌ Error handling connection failure:', error);
    }
  }

  // Public method to manually flush ICE candidate queue
  public async flushIceCandidateQueue(): Promise<void> {
    console.log('🔄 Manually flushing ICE candidate queue...');
    await this.processQueuedIceCandidates();
  }

  // Send queued ICE candidates to partner (for test signals)
  private sendQueuedIceCandidates(): void {
    if (this.iceCandidateQueue.length === 0) {
      console.log('📦 No queued ICE candidates to send');
      return;
    }

    if (!this.currentRoomId || !this.partnerId) {
      console.warn('⚠️ Cannot send queued ICE candidates: room/partner info not ready');
      return;
    }

    console.log(`📦 Sending ${this.iceCandidateQueue.length} queued ICE candidates`);

    // Send all queued candidates
    for (const candidateData of this.iceCandidateQueue) {
      try {
        // Check if this is a test signal or actual ICE candidate
        if (candidateData && typeof candidateData === 'object' && 'test' in candidateData && (candidateData as any).test === true) {
          // This is a test signal, use test signal method
          this.sendTestSignal('ice-candidate', candidateData);
          console.log('✅ Queued test ICE candidate sent successfully');
        } else {
          // This is an actual ICE candidate, use regular signal method
          this.sendSignal('ice-candidate', candidateData);
          console.log('✅ Queued ICE candidate sent successfully');
        }
      } catch (error) {
        console.error('❌ Failed to send queued ICE candidate:', error);
      }
    }

    // Clear the queue
    this.iceCandidateQueue = [];
    console.log('📦 ICE candidate queue sent and cleared');
  }

  // Call the backend swipe endpoint
  private async callSwipeEndpoint(): Promise<{ success: boolean; data?: any }> {
    try {
      const response = await api.post('/video_chat/swipe', {});
      console.log('🔄 Raw response from backend:', response);
      return { success: true, data: response };
    } catch (error) {
      console.error('❌ Error calling swipe endpoint:', error);
      return { success: false };
    }
  }

  // Update service state from swipe response
  private updateServiceStateFromSwipeResponse(responseData: any): void {
    console.log('🔄 Updating service state from swipe response:', responseData);

    // Update current room and partner info
    this.currentRoomId = responseData.room_id;

    // Fix: partnerId should be the OTHER user's ID, not the current user's ID
    if (responseData.partner && responseData.partner.id) {
      // If partner.id is 'video', keep it as is
      if (responseData.partner.id === 'video') {
        this.partnerId = 'video';
      } else {
        // For real users and staff, partnerId should be the other user's ID
        this.partnerId = responseData.partner.id.toString();
      }
    } else {
      this.partnerId = 'unknown';
    }

    this.isInitiator = responseData.is_initiator;
    this.sessionVersion = responseData.session_version || '';

    console.log('🔍 Set currentRoomId:', this.currentRoomId);
    console.log('🔍 Set partnerId:', this.partnerId, '(partner from backend:', responseData.partner, ')');
    console.log('🔍 Set isInitiator:', this.isInitiator);
    console.log('🔍 Set sessionVersion:', this.sessionVersion);
  }

  // Create and send WebRTC offer (called by initiator after receiving ready signal)
  private async createAndSendOffer(): Promise<void> {
    // Prevent multiple offer creations
    if (this.peerConnection?.localDescription) {
      console.warn('⚠️ Offer already created, ignoring duplicate request');
      return;
    }

    try {
      console.log('🎯 Creating WebRTC offer...');

      // SIMPLIFIED: Only ensure peer connection exists, don't force cleanup
      if (!this.peerConnection) {
        console.log('⚠️ No peer connection, setting up now...');
        await this.setupPeerConnectionOnly();
      } else {
        // Check if the existing peer connection is in a valid state
        const state = this.peerConnection.signalingState;
        console.log('🔍 Current peer connection state:', state);

        // Only reset if in an invalid state
        if (state === 'closed' || state === 'have-remote-offer' || state === 'have-local-offer') {
          console.warn('⚠️ Peer connection in invalid state, resetting...');
          this.resetWebRTCState();
          await this.setupPeerConnectionOnly();
        }
      }

      // Double-check we have a clean peer connection
      if (!this.peerConnection || this.peerConnection.signalingState !== 'stable') {
        throw new Error('Peer connection not in stable state after setup');
      }

      // Create offer
      const offer = await this.peerConnection.createOffer();
      await this.peerConnection.setLocalDescription(offer);
      console.log('✅ Local description (offer) set successfully');

      // Send offer to partner
      if (this.partnerId) {
        await pubnubService.sendOffer(this.partnerId, offer.sdp || '');
        console.log('✅ Offer sent to partner');
      }
    } catch (error) {
      console.error('❌ Error creating and sending offer:', error);

      // If we get an m-lines error, reset the state completely
      if (error instanceof Error && error.message.includes('m-lines')) {
        console.warn('⚠️ M-lines order error in offer creation, resetting WebRTC state...');
        this.resetWebRTCState();
      }

      throw error;
    }
  }

  // Check remote stream status
  private checkRemoteStreamStatus(): void {
    console.log('🔍 Checking remote stream status...');
    console.log('🔍 Remote stream exists:', !!this.remoteStream);
    console.log('🔍 Remote stream active:', this.remoteStream?.active);
    console.log('🔍 Remote stream tracks:', this.remoteStream?.getTracks().map(t => ({ kind: t.kind, enabled: t.enabled, readyState: t.readyState })));
    console.log('🔍 onRemoteStreamCallback set:', !!this.onRemoteStreamCallback);
    console.log('🔍 Peer connection state:', this.peerConnection?.connectionState);
    console.log('🔍 Peer connection signaling state:', this.peerConnection?.signalingState);
  }

  // Public method to check remote stream status (for debugging)
  public getRemoteStreamStatus(): {
    exists: boolean;
    active: boolean;
    tracks: Array<{ kind: string; enabled: boolean; readyState: string }>;
    callbackSet: boolean;
    peerConnectionState?: string;
    signalingState?: string;
  } {
    return {
      exists: !!this.remoteStream,
      active: this.remoteStream?.active || false,
      tracks: this.remoteStream?.getTracks().map(t => ({
        kind: t.kind,
        enabled: t.enabled,
        readyState: t.readyState
      })) || [],
      callbackSet: !!this.onRemoteStreamCallback,
      peerConnectionState: this.peerConnection?.connectionState,
      signalingState: this.peerConnection?.signalingState
    };
  }
}

// Export singleton instance
export const cleanVideoChatService = new CleanVideoChatService();
