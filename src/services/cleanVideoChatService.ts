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
  private readonly CONNECTION_TIMEOUT_MS = 15000; // 15 seconds - increased for better reliability

  // Track processed signals to prevent duplicates
  private processedSignals = new Set<string>();
  private signalCounter = 0; // Counter for unique signal IDs

  // Message buffering for proper ordering
  private messageBuffer = new Map<string, unknown[]>();
  private processingMessages = false;

  // Connection health monitoring
  private heartbeatInterval: NodeJS.Timeout | null = null;

  constructor() {

    // Set up cleanup for page unload/refresh
    this.setupPageUnloadHandler();
  }

  // Set up handler for page unload/refresh/tab close
  private setupPageUnloadHandler(): void {
    if (typeof window === 'undefined') return;

    const handlePageUnload = (_event: BeforeUnloadEvent) => {

      // Attempt to leave chat (may not complete due to page unload timing)
      try {
        // Use sendBeacon for more reliable cleanup during page unload
        const userId = this.getAuthenticatedUserId();
        const token = this.getAuthToken();

        if (userId && token) {
          navigator.sendBeacon('/api/v1/video_chat/leave', JSON.stringify({}));
        }
      } catch (error) {

      }

      // Clean up local resources immediately
      this.cleanup();
    };

    // Handle page unload/refresh
    window.addEventListener('beforeunload', handlePageUnload);

    // Handle tab close/navigation
    window.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'hidden') {
        // Don't cleanup immediately as user might come back
      }
    });

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
              return userId;
            } else {
              this.clearStoredAuth();
            }
          } else {
            // Only validate if enough time has passed since last attempt
            const timeSinceLastValidation = Date.now() - lastValidationAttempt;
            if (timeSinceLastValidation >= VALIDATION_COOLDOWN) {
              try {
                lastValidationAttempt = Date.now();

                // Get user email for auto-login fallback
                let userEmail: string | undefined;
                try {
                  const storedUser = localStorage.getItem('juicyMeetsUser');
                  if (storedUser) {
                    const userData = JSON.parse(storedUser);
                    userEmail = userData.email;
                  }
                } catch (error) {

                }

                const validation = await UserService.validateToken(token, userEmail);

                // Cache the validation result
                this.tokenValidationCache = {
                  token,
                  isValid: validation.valid,
                  timestamp: Date.now()
                };

                if (validation.valid) {

                  // If a new token was provided (auto-login), update localStorage
                  if (validation.token) {
                    localStorage.setItem('juicyMeetsAuthToken', validation.token);
                  }

                  return userId;
                } else {
                  this.clearStoredAuth();
                }
              } catch (error) {

                this.clearStoredAuth();
              }
            } else {
              // Log that we're waiting for cooldown
              const remainingCooldown = VALIDATION_COOLDOWN - timeSinceLastValidation;
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

    } catch (error) {

    }
  }

  // Clear token validation cache (useful for testing or manual refresh)
  clearTokenValidationCache(): void {
    this.tokenValidationCache = null;
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

  // Send chat message to partner
  async sendMessage(text: string): Promise<void> {
    if (!text.trim()) {
      return;
    }

    if (!this.partnerId) {
      return;
    }

    if (!pubnubService.isConnected()) {
      return;
    }

    try {
      const messageId = `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      await pubnubService.sendChatMessage(this.partnerId, text.trim(), messageId);

    } catch (error) {

      throw error;
    }
  }

  // Join the video chat queue
  async joinQueue(): Promise<void> {
    try {
      // Wait for authentication to be ready
      const userId = await this.waitForAuthentication();

      // Verify we have a valid token
      const token = this.getAuthToken();
      if (!token) {
        throw new Error('No authentication token available');
      }

      // Request camera permissions immediately when joining queue
      try {
        // Check permission state first and show appropriate messaging
        const permissionState = await this.checkPermissionState();
        this.showPermissionStateMessage(permissionState);

        if (permissionState !== 'granted') {
          throw new Error(`Camera permissions not granted. Current state: ${permissionState}`);
        }

        // Get the local stream
        await this.getLocalStream();

      } catch (error) {

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

      // Start checking for matches
      this.startStatusChecking();
    } catch (error) {

      throw new Error('Failed to join video chat queue. Please try again.');
    }
  }

  // Leave the video chat
  async leaveChat(): Promise<void> {

    try {
      // Wait for authentication to be ready
      const userId = await this.waitForAuthentication();

      // Verify we have a valid token
      const token = this.getAuthToken();
      if (!token) {
        // Still cleanup locally even without token
        this.cleanup();
        return;
      }

      await api.post('/video_chat/leave', {});

    } catch (error) {

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
    swipe_deduction?: {
      success: boolean;
      deducted: number;
      new_balance: number;
      error?: string;
    };
  }> {
    // Allow immediate swipes for video matches (no debounce)
    const isVideoMatch = this.currentRoomId && this.partnerId === 'video';

    if (this.isSwiping && !isVideoMatch) {
      return { success: false };
    }

    // Clear any existing debounce timeout
    if (this.swipeDebounceTimeout) {
      clearTimeout(this.swipeDebounceTimeout);
      this.swipeDebounceTimeout = null;
    }

    try {
      this.isSwiping = true;

      // CRITICAL FIX: Complete cleanup BEFORE sending bye signal to prevent conflicts

      // Store current connection info before cleanup
      const currentPartnerId = this.partnerId;
      const wasInActiveConnection = this.currentRoomId &&
                                   this.partnerId &&
                                   this.partnerId !== 'video' &&
                                   this.partnerId !== 'unknown' &&
                                   pubnubService.isConnected();

      // Trigger partner left callback to show loader immediately
      if (this.onPartnerLeftCallback) {
        this.onPartnerLeftCallback();
      }

      // Perform comprehensive cleanup FIRST
      this.performSwipeCleanup();

      // Additional state cleanup for signal tracking
      this.processedSignals.clear();
      this.signalCounter = 0;
      this.messageBuffer.clear();
      this.processingMessages = false;
      this.isPubNubConnecting = false;

      // CRITICAL: Clear all connection identifiers to prevent cross-contamination
      this.currentRoomId = null;
      this.partnerId = null;
      this.sessionVersion = null;
      this.isInitiator = false;
      this.hasSentReadySignal = false;
      this.partnerReadyReceived = false;

      // NOW send bye signal with stored partner info (if we were connected)
      if (wasInActiveConnection && currentPartnerId) {
        try {
          // Use a fresh PubNub connection attempt for bye signal
          const currentSession = pubnubService.getCurrentSession();
          if (currentSession.channel && currentSession.userId) {
            await pubnubService.sendBye(currentPartnerId);
          } else {
          }
        } catch (error) {

          // This is expected after cleanup, continue normally
        }
      } else {
      }

      const response = await api.post('/video_chat/swipe', {});

      // Type the response data
      const responseData = response as {
        status: string;
        room_id: string;
        match_type: string;
        actual_match_type?: string;
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

      }

      if (responseData.status === 'matched') {
        // Ensure local stream is healthy before proceeding
        await this.ensureLocalStreamHealth();

        // CRITICAL FIX: Ensure complete cleanup before setting new match data
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

        // CRITICAL FIX: Use actual_match_type from backend for proper detection
        let actualMatchType = responseData.actual_match_type || responseData.match_type || 'unknown';

        // Additional validation for video matches
        if (actualMatchType === 'video' && (!responseData.video_id || !responseData.video_url)) {
          console.log('⚠️ Backend says video match but missing video data, falling back to live match');
          actualMatchType = responseData.match_type === 'staff' ? 'staff' : 'real_user';
        }

        // Additional validation for live matches
        if (actualMatchType !== 'video' && (!responseData.partner || !responseData.partner.id || responseData.partner.id === 'video')) {
          console.log('⚠️ Backend says live match but missing partner data, falling back to video match');
          actualMatchType = 'video';
        }

        // Handle the match based on its type
        await this.handleMatchWithErrorHandling(actualMatchType, responseData);

        // Return the match result based on actual type
        if (actualMatchType === 'video') {
          return {
            success: true,
            roomId: responseData.room_id,
            matchType: 'video',
            partnerId: 'video',
            videoId: responseData.video_id,
            videoUrl: responseData.video_url || '',
            videoName: responseData.video_name || 'Video',
            sessionVersion: responseData.session_version,
            updatedUserInfo: responseData.updated_user_info,
            swipe_deduction: (responseData as any).swipe_deduction
          };
        } else if (actualMatchType === 'staff') {
          return {
            success: true,
            roomId: responseData.room_id,
            matchType: 'staff',
            partnerId: responseData.partner.id,
            sessionVersion: responseData.session_version,
            updatedUserInfo: responseData.updated_user_info,
            swipe_deduction: (responseData as any).swipe_deduction
          };
        } else if (actualMatchType === 'real_user') {
          return {
            success: true,
            roomId: responseData.room_id,
            matchType: 'real_user',
            partnerId: responseData.partner.id,
            sessionVersion: responseData.session_version,
            updatedUserInfo: responseData.updated_user_info,
            swipe_deduction: (responseData as any).swipe_deduction
          };
        } else {
          return { success: false };
        }
      } else {
        // No match found - ensure we're in a clean state for the next attempt

        // CRITICAL FIX: If no match found, restart status checking to wait for new matches
        // This is especially important for staff users who need to wait for real app users

        // Make sure we're not already checking
        if (this.statusCheckInterval) {
          clearInterval(this.statusCheckInterval);
          this.statusCheckInterval = null;
        }

        // Start status checking again to wait for matches
        this.startStatusChecking();

        return { success: false };
      }
    } catch (error) {

      // CRITICAL FIX: Even on error, restart status checking so user doesn't get stuck

      // Make sure we're not already checking
      if (this.statusCheckInterval) {
        clearInterval(this.statusCheckInterval);
        this.statusCheckInterval = null;
      }

      // Start status checking again
      this.startStatusChecking();

      return { success: false };
    } finally {
      // Reset swiping flag after a delay to prevent rapid swipes (only for live connections)
      if (!isVideoMatch) {
        this.swipeDebounceTimeout = setTimeout(() => {
          this.isSwiping = false;
        }, 2000); // 2 second debounce only for live connections
      } else {
        // For video matches, reset immediately
        this.isSwiping = false;
      }
    }
  }

  // Perform comprehensive cleanup specifically for swipes
  private performSwipeCleanup(): void {
    console.log('🔄 SWIPE CLEANUP: Starting...');

    // Clear remote stream internally (UI will handle the null via React state)

    // Clean up PubNub connection COMPLETELY
    if (this.currentRoomId) {
      pubnubService.leave();
      console.log('✅ SWIPE CLEANUP: Left PubNub room');
    }

    // Clean up WebRTC resources (but preserve local stream)
    if (this.peerConnection) {
      this.peerConnection.close();
      this.peerConnection = null;
      console.log('✅ SWIPE CLEANUP: Peer connection closed');
    }

    // Clear remote stream AFTER UI notification
    this.remoteStream = null;
    console.log('✅ SWIPE CLEANUP: Remote stream cleared');

    // Reset connection state flags
    this.isPubNubConnecting = false;
    this.hasSentReadySignal = false;
    this.partnerReadyReceived = false;
    this.isWebRTCResetting = false;

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
    }

    // Verify local stream is still intact
    if (this.localStream) {
    } else {
    }

  }

  // End current session
  async endSession(roomId: string): Promise<void> {

    try {
      await api.post('/video_chat/end_session', { room_id: roomId });

    } catch (error) {

    }
  }

  // Show permission denied alert
  private showPermissionDeniedAlert(): void {
    // Create a custom modal for better user experience
    this.createPermissionDeniedModal();

    // Also log for debugging
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
  }

  // Check permission state and show appropriate messaging
  async checkPermissionState(): Promise<'granted' | 'denied' | 'blocked' | 'not-supported'> {
    try {
      // Check if getUserMedia is supported
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        return 'not-supported';
      }

      // Check if permissions API is supported
      if (navigator.permissions && navigator.permissions.query) {
        try {
          const permission = await navigator.permissions.query({ name: 'camera' as PermissionName });

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

      return 'denied';
    }
  }

  // Show appropriate message based on permission state
  private showPermissionStateMessage(permissionState: 'granted' | 'denied' | 'blocked' | 'not-supported'): void {
    switch (permissionState) {
      case 'granted':
        break;
      case 'denied':
        this.showPermissionDeniedAlert();
        break;
      case 'blocked':
        this.showPermissionBlockedAlert();
        break;
      case 'not-supported':
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
      return this.localStream;
    } catch (error) {

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

      // Stop existing stream if any
      if (this.localStream) {
        this.localStream.getTracks().forEach(track => track.stop());
        this.localStream = null;
      }

      // Get fresh stream
      const freshStream = await this.getLocalStream();
      return freshStream;
    } catch (error) {

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

    try {
      // For video matches, directly use the video URL - no need to create streams

      // Trigger the video match callback with video data for the video player component
      if (this.onVideoMatchCallback) {
        this.onVideoMatchCallback({
          videoId: videoData.videoId,
          videoUrl: videoData.videoUrl,
          videoName: videoData.videoName
        });
      } else {
      }

    } catch (error) {

      // Fallback: try to trigger video callback again
      if (this.onVideoMatchCallback && videoData.videoUrl) {
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

      return stream;
    } catch (error) {

      return null;
    }
  }

    // Fetch video details and create video stream from actual video file
  private async createVideoStreamFromFile(videoId: number): Promise<MediaStream | null> {
    try {

      // Fetch video details from backend
      const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL || '/api/v1';
      const response = await fetch(`${API_BASE_URL}/videos/${videoId}/public`);

      if (!response.ok) {
        throw new Error(`Failed to fetch video: ${response.status}`);
      }

      const data = await response.json();
      const video = data.data.video;

      if (!video.video_file_url) {
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
          return stream;
        } else {
          return null;
        }
      } catch (captureError) {

        return null;
      }

    } catch (error) {

      return null;
    }
  }

  // Log current WebRTC state for debugging
  private logWebRTCState(): void {
    if (!this.peerConnection) {
      return;
    }

  }

  // Log current connection state for debugging
  private logConnectionState(): void {

  }

  // Ensure signal listener is set up for the current room
  private async ensureSignalListenerSetup(): Promise<void> {
    if (!this.currentRoomId) {
      return;
    }

    try {
              // First, ensure PubNub connection is established for this room
        const userId = this.getAuthenticatedUserId();
        if (userId) {
          // TODO: Implement PubNub connect method
          // await pubnubService.connect(userId, this.currentRoomId);

          // Wait a bit for the connection to stabilize
          await new Promise(resolve => setTimeout(resolve, 1000));

          // Check if we're properly subscribed to the channel
          try {
            // TODO: Implement getOnlineUsers method
            // const onlineUsers = await pubnubService.getOnlineUsers();

          } catch (error) {

          }
        } else {
        }

      // Then set up the signal listener
      this.setupSignalListener();

      // Test signal routing by sending a test signal
      try {
        await this.sendTestSignal('ice-candidate', { test: true });

      } catch (error) {

      }
    } catch (error) {

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

        if (response.status === 'matched') {
          // CRITICAL FIX: Prevent processing the same match multiple times
          // if (this.currentRoomId === response.room_id &&
          //     this.sessionVersion === response.session_version) {
          //   return;
          // }

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

          // Process any queued ICE candidates that were generated before room info was set
          if (this.iceCandidateQueue.length > 0) {
            await this.processQueuedIceCandidates();
          }

          // Stop checking status
          if (this.statusCheckInterval) {
            clearInterval(this.statusCheckInterval);
            this.statusCheckInterval = null;
          }

          // Handle different match types
          await this.handleMatchWithErrorHandling(response.match_type, response);
        }
      } catch (error) {

        // If we get a WebRTC error, reset the connection state
        if (error instanceof Error && (
          error.message.includes('no pending remote description') ||
          error.message.includes('setLocalDescription') ||
          error.message.includes('setRemoteDescription')
        )) {
          this.resetWebRTCState();
        }

        // If we get an authentication error, stop checking
        if (error instanceof Error && error.message.includes('401')) {
          if (this.statusCheckInterval) {
            clearInterval(this.statusCheckInterval);
            this.statusCheckInterval = null;
          }
        }
      }
    }, 800); // Check every 800ms - much faster matching
  }

  // Initialize WebRTC connection
  private async initializeWebRTC(): Promise<void> {
    try {

      // Use existing local stream (camera permissions already granted)
      if (!this.localStream) {
        throw new Error('Local stream not available. Camera permissions may have been revoked.');
      }

      // Start the WebRTC connection
      await this.startWebRTCConnection();

    } catch (error) {

    }
  }

  // Set up peer connection event handlers
  private setupPeerConnectionHandlers(): void {
    if (!this.peerConnection) return;

    this.peerConnection.ontrack = (event) => {
      console.log('🎯 ONTRACK: Event received:', event.streams.length, 'streams');

      if (event.streams && event.streams.length > 0) {
        this.remoteStream = event.streams[0];
        console.log('✅ ONTRACK: Remote stream assigned:', this.remoteStream.getTracks().length, 'tracks');

        // CRITICAL FIX: Update connection state immediately when we get remote stream
        if (this.onConnectionStateCallback) {
          this.onConnectionStateCallback('connected' as RTCPeerConnectionState);
          console.log('✅ ONTRACK: Connection state updated to connected');
        }

        // Single callback - let React handle the timing
        if (this.onRemoteStreamCallback && this.remoteStream) {
          this.onRemoteStreamCallback(this.remoteStream);
          console.log('✅ ONTRACK: Remote stream callback fired');
        } else {
          console.log('❌ ONTRACK: No remote stream callback registered');
        }

        // Check remote stream status after setting it
        this.checkRemoteStreamStatus();
      } else {
        console.log('❌ ONTRACK: No streams in ontrack event');
      }
    };

    this.peerConnection.onconnectionstatechange = () => {
      const state = this.peerConnection?.connectionState;
      console.log('🔄 CONNECTION STATE CHANGE:', state);

      if (this.onConnectionStateCallback && state) {
        this.onConnectionStateCallback(state);
      }

      // Auto-swipe on connection failure or disconnect
      if (state === 'failed' || state === 'disconnected' || state === 'closed') {
        console.log('🔥 Connection failed/closed, handling partner disconnect...');
        this.handleConnectionFailure();
      }
    };

    // Add ice connection state monitoring
    this.peerConnection.oniceconnectionstatechange = () => {
      const iceState = this.peerConnection?.iceConnectionState;
      console.log('🧊 ICE CONNECTION STATE:', iceState);

      // If ICE connection fails, try to recover
      if (iceState === 'failed') {
        console.log('🧊 ICE connection failed, attempting recovery...');
        this.handleConnectionFailure();
      }
    };

    this.peerConnection.onicecandidate = (event) => {
      if (event.candidate) {

        // Check if we have the necessary room and partner info before sending
        if (!this.currentRoomId || !this.partnerId) {

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

    if (!this.currentRoomId || !this.partnerId) {
      return;
    }

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

    } catch (error) {

    }
  }

  // Validate connection state before sending signals
  private validateConnectionState(): boolean {
    if (!this.currentRoomId) {
      return false;
    }

    if (!this.partnerId) {
      return false;
    }

    if (!this.peerConnection) {
      return false;
    }

    return true;
  }

  // Send WebRTC signal via PubNub with session versioning
  private async sendSignal(type: string, data: RTCSessionDescriptionInit | RTCIceCandidateInit): Promise<void> {
    if (!this.currentRoomId || !this.partnerId || !this.sessionVersion) {
      return;
    }

    try {
      const userId = this.getAuthenticatedUserId();
      if (!userId) {
        throw new Error('No user ID available for signal sending');
      }

      switch (type) {
        case 'offer':
          if ('sdp' in data) {
            await pubnubService.sendOffer(this.partnerId, data.sdp || '');
          }
          break;
        case 'answer':
          if ('sdp' in data) {
            await pubnubService.sendAnswer(this.partnerId, data.sdp || '');
          }
          break;
        case 'ice-candidate':
          if ('candidate' in data) {
            await pubnubService.sendIceCandidate(this.partnerId, data);
          } else {
          }
          break;
        default:
      }
    } catch (error) {

      throw error;
    }
  }

  // Validate signal integrity
  private validateSignalIntegrity(signal: any): boolean {
    const requiredFields = ['type', 'from', 'sessionVersion'];
    const hasAllFields = requiredFields.every(field => signal.hasOwnProperty(field));

    if (!hasAllFields) {
      return false;
    }

    // Validate session version
    if (signal.sessionVersion !== this.sessionVersion) {
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
          const aTs = (a[0] as any)?.ts || 0;
          const bTs = (b[0] as any)?.ts || 0;
          return aTs - bTs;
        });

      for (const [, messages] of sortedMessages) {
        for (const message of messages) {
          await this.handleIncomingSignal(message as any);
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
    type: 'ready' | 'offer' | 'answer' | 'ice' | 'bye' | 'health' | 'chat';
    from: string;
    to: string;
    sessionVersion: string;
    sdp?: string;
    candidate?: RTCIceCandidateInit;
    ts?: number;
    text?: string;
    timestamp?: number;
    id?: string;
  }): Promise<void> {

    // Verify this signal is from our partner (convert both to strings for comparison)
    const signalFromStr = signal.from.toString();
    const partnerIdStr = this.partnerId?.toString();
    const currentUserId = this.getAuthenticatedUserId()?.toString();

    // Double-check: Ignore signals from ourselves (this should never happen with proper PubNub setup)
    if (signalFromStr === currentUserId) {
        return;
      }

    // Verify this signal is from our partner
    if (signalFromStr !== partnerIdStr) {
      return;
    }

    // Check if WebRTC state is valid before processing signals
    if (this.isWebRTCResetting) {
      return;
    }

    if (!this.peerConnection && (signal.type === 'offer' || signal.type === 'answer' || signal.type === 'ice')) {
      return;
    }

    // Create a unique identifier for this signal to prevent duplicates
    const signalId = `${signal.type}_${signal.from}_${this.signalCounter++}_${Date.now()}`;

    // Check if we've already processed this signal
    if (this.processedSignals.has(signalId)) {
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

    if (!this.validateSignalIntegrity(signal)) {
        return;
    }

    try {
      switch (signal.type) {
          case 'ready':
          // We now use a simplified handshake where initiator starts immediately
          // Ready signals are no longer needed for the handshake
          break;
        case 'offer':
          if (signal.sdp) {
            console.log('📨 Received OFFER, handling...');
            // FIX: Ensure peer connection is in correct state for offer
            if (this.peerConnection && this.peerConnection.signalingState === 'stable') {
              await this.resetWebRTCState();
              await this.setupPeerConnectionOnly();
            }
            await this.handleOffer({ sdp: signal.sdp, type: 'offer' });
            console.log('✅ OFFER handled successfully');
          } else {
            console.log('❌ OFFER signal missing SDP');
          }
          break;
        case 'answer':
          if (signal.sdp) {
            console.log('📨 Received ANSWER, handling...');
            await this.handleAnswer({ sdp: signal.sdp, type: 'answer' });
            console.log('✅ ANSWER handled successfully');
          }
          break;
        case 'ice':
          if (signal.candidate) {
            await this.handleIceCandidate(signal.candidate);
          }
          break;
        case 'bye':
          this.handlePartnerLeft();
          break;
        case 'health':
          // Send heartbeat response via PubNub directly
          try {
            if (this.partnerId) {
              await pubnubService.sendHealth(this.partnerId);
              this.clearWaitingRoomAfterConnection();
            }
          } catch (error) {

          }
          break;
        case 'chat':
          if (signal.text) {
            this.handleChatMessage({
              text: signal.text,
              from: signal.from,
              timestamp: signal.timestamp || Date.now(),
              id: signal.id
            });
          } else {
          }
          break;
        default:
      }
    } catch (error) {

      // Reset state on critical errors
      if (error instanceof Error && (
        error.message.includes('setRemoteDescription') ||
        error.message.includes('setLocalDescription') ||
        error.message.includes('Called in wrong state') ||
        error.message.includes('Invalid signaling state')
      )) {
        this.resetWebRTCState();
      }
    }
  }

  // Listen for incoming signals from other users via PubNub
  private setupSignalListener(): void {
    // This method is deprecated - signals are now handled by setupPubNubConnection
  }

  // Remove signal listener
  private removeSignalListener(): void {

    // Clean up PubNub connection
    if (this.currentRoomId) {
      pubnubService.leave();
    }

    // Clear cleanup functions
    this.webrtcSignalCleanup = null;
      this.generalMessageCleanup = null;
  }

    // Track PubNub connection state to prevent multiple joins
  private isPubNubConnecting = false;

  // Track if ready signal has been sent to prevent duplicates
  private hasSentReadySignal = false;
  private partnerReadyReceived = false;

  // Track if WebRTC is being reset to prevent signal processing during reset
  private isWebRTCResetting = false;

  // Set up PubNub connection with session versioning
  private async setupPubNubConnection(): Promise<void> {
    console.log('🔗 Setting up PubNub connection...');

    if (!this.currentRoomId || !this.partnerId || !this.sessionVersion) {
      console.log('❌ Missing PubNub connection data:', {
        roomId: !!this.currentRoomId,
        partnerId: !!this.partnerId,
        sessionVersion: !!this.sessionVersion
      });
      return;
    }

    // CRITICAL FIX: Prevent multiple concurrent PubNub join attempts
    if (this.isPubNubConnecting) {
      console.log('⏳ PubNub connection already in progress');
      return;
    }

    // FORCE clean PubNub state for new connections
    const currentSession = pubnubService.getCurrentSession();
    if (currentSession.channel && currentSession.channel !== `vc.${this.currentRoomId}`) {
      pubnubService.leave();
      console.log('🔄 Cleaned previous PubNub session');
    }

    try {
      this.isPubNubConnecting = true; // Set flag to prevent concurrent joins

      const userId = this.getAuthenticatedUserId();
      if (!userId) {
        throw new Error('No user ID available for PubNub connection');
      }

      // Join PubNub channel with session versioning
      console.log('🔗 Joining PubNub channel:', this.currentRoomId);
      pubnubService.join(
        this.currentRoomId,
        this.sessionVersion,
        userId,
        {
          onMessage: (signal) => {
            console.log('📨 PubNub signal received:', signal.type);
            this.handleIncomingSignal(signal);
          },
          onJoin: () => {
            console.log('✅ PubNub join successful');
            this.handlePubNubJoin();
          },
          onError: (error) => {
            console.log('❌ PubNub join error:', error);
          }
        }
      );

    } catch (error) {

      throw error;
    } finally {
      this.isPubNubConnecting = false; // Reset flag regardless of success/failure
    }
  }

  // Handle PubNub join and initiate handshake
  private async handlePubNubJoin(): Promise<void> {

    try {
      // BOTH users send ready signals to ensure proper synchronization
      if (this.partnerId && !this.hasSentReadySignal) {

        this.hasSentReadySignal = true;

        await pubnubService.sendReady(this.partnerId);

        if (this.isInitiator) {
          // Initiator: Wait a bit for partner to also join and send ready, then create offer
          console.log('🚀 Initiator: Will create offer in 2 seconds...');
          setTimeout(async () => {
            try {
              console.log('🎯 Creating and sending offer...');
              await this.createAndSendOffer();
              console.log('✅ Offer sent successfully');
            } catch (error) {
              console.log('❌ Error creating offer:', error);
            }
          }, 2000); // Reduced to 2 seconds for faster connection
        } else {
          // Receiver: Just wait for offer
        }
      } else if (this.hasSentReadySignal) {

      } else {
      }
    } catch (error) {

    }
  }

  // Handle WebRTC offer
  private async handleOffer(offer: RTCSessionDescriptionInit): Promise<void> {
    console.log('📨 OFFER: Received offer, processing...');

    try {
      // Ensure peer connection exists and is in stable state
      if (!this.peerConnection) {
        console.log('📨 OFFER: Creating new peer connection...');
        await this.setupPeerConnectionOnly();
      } else {
        // Double-check that the peer connection is truly fresh and ready
        if (this.peerConnection.signalingState !== 'stable' ||
            this.peerConnection.remoteDescription ||
            this.peerConnection.localDescription) {
          console.log('📨 OFFER: Resetting peer connection due to invalid state');
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
        console.log('📨 OFFER: Already have remote description, ignoring duplicate offer');
        return;
      }

      // Check if we're in a valid state for receiving an offer
      if (this.peerConnection!.signalingState === 'have-remote-offer' ||
          this.peerConnection!.signalingState === 'have-local-offer') {
        console.log('📨 OFFER: Already processing offer/answer, ignoring duplicate');
        return;
      }

      // FIXED: Accept offers in 'stable' state as long as no remote description exists
      // 'stable' state is valid for receiving offers when the connection is fresh

      // Set remote description first
      console.log('📨 OFFER: Setting remote description...');
      await this.peerConnection!.setRemoteDescription(new RTCSessionDescription(offer));
      this.logWebRTCState();

      // Check remote stream status after setting remote description
      this.checkRemoteStreamStatus();

      // Log current signaling state for debugging
      const currentState = this.peerConnection!.signalingState;
      console.log('📨 OFFER: Signaling state after setting remote description:', currentState);

      // Create and send answer
      console.log('📨 OFFER: Creating answer...');
      const answer = await this.peerConnection!.createAnswer();
      await this.peerConnection!.setLocalDescription(answer);
      this.logWebRTCState();

      // Check remote stream status again after setting local description
      this.checkRemoteStreamStatus();

      // Send answer to partner
      console.log('📨 OFFER: Sending answer to partner...');
      this.sendSignal('answer', answer);

      // Process any queued ICE candidates
      await this.processQueuedIceCandidates();

      console.log('✅ OFFER: Offer processed successfully');
    } catch (error) {
      console.log('❌ OFFER: Error processing offer:', error);

      // Reset state on critical errors
      if (error instanceof Error && (
        error.message.includes('setRemoteDescription') ||
        error.message.includes('setLocalDescription') ||
        error.message.includes('createAnswer') ||
        error.message.includes('Called in wrong state') ||
        error.message.includes('Invalid signaling state')
      )) {
        this.resetWebRTCState();
      }
    }
  }

  // Handle WebRTC answer
  private async handleAnswer(answer: RTCSessionDescriptionInit): Promise<void> {
    console.log('📨 ANSWER: Received answer, processing...');

    try {
      // Ensure peer connection exists
      if (!this.peerConnection) {
        console.log('❌ ANSWER: No peer connection available');
        return;
      }

      // Ensure we have a local description before setting remote
      if (!this.peerConnection.localDescription) {
        console.log('❌ ANSWER: No local description available');
        return;
      }

      // Log current WebRTC state
      this.logWebRTCState();

      // Check if peer connection is in the correct state for receiving an answer
      if (this.peerConnection.signalingState !== 'have-local-offer') {
        console.log('❌ ANSWER: Wrong signaling state:', this.peerConnection.signalingState);
        // Reset the connection if it's in the wrong state
        this.resetWebRTCState();
        return;
      }

      // Set remote description
      console.log('📨 ANSWER: Setting remote description...');
      await this.peerConnection.setRemoteDescription(new RTCSessionDescription(answer));
      this.logWebRTCState();

      // Log current signaling state
      const currentState = this.peerConnection.signalingState;
      console.log('📨 ANSWER: Signaling state after setting remote description:', currentState);

      // Check if connection is stable (using string comparison to avoid TypeScript strictness)
      if (String(currentState) === 'stable') {
        console.log('✅ ANSWER: Connection is stable, starting heartbeat...');

        // Start heartbeat monitoring for connection health
        this.startHeartbeat();

        // CRITICAL FIX: Update connection state to connected
        if (this.onConnectionStateCallback) {
          this.onConnectionStateCallback('connected' as RTCPeerConnectionState);
        }
      }

      // Process queued ICE candidates
      await this.processQueuedIceCandidates();

      console.log('✅ ANSWER: Answer processed successfully');
    } catch (error) {
      console.log('❌ ANSWER: Error processing answer:', error);

      // Reset state on critical errors
      if (error instanceof Error && (
        error.message.includes('setRemoteDescription') ||
        error.message.includes('Called in wrong state')
      )) {
        this.resetWebRTCState();
      }
    }
  }

    // Handle ICE candidate safely
  private async handleIceCandidate(candidate: RTCIceCandidateInit): Promise<void> {
    try {
      // Ensure peer connection exists
      if (!this.peerConnection) {
        return;
      }

      // CRITICAL: Check if remote description is set before adding ICE candidates
      if (!this.peerConnection.remoteDescription) {
        this.queueIceCandidate(candidate);
      return;
    }

      // Check if we're in a valid state for adding ICE candidates
      const state = this.peerConnection.signalingState;
      if (state === 'closed') {
      return;
    }

      // Additional state validation for ICE candidate processing
      if (state === 'stable' && this.peerConnection.localDescription && this.peerConnection.remoteDescription) {
        // In stable state, we can add ICE candidates
        await this.peerConnection.addIceCandidate(new RTCIceCandidate(candidate));
      } else if (state === 'have-remote-offer' || state === 'have-local-offer') {
        // In offer/answer states, we can add ICE candidates
        await this.peerConnection.addIceCandidate(new RTCIceCandidate(candidate));
      } else {
        this.queueIceCandidate(candidate);
        return;
      }
    } catch (error) {

      // If we get an m-lines order error, this means the connection is in an invalid state
      if (error instanceof Error && error.message.includes('m-lines')) {
        this.resetWebRTCState();
      } else if (error instanceof Error && error.message.includes('remote description was null')) {
        this.queueIceCandidate(candidate);
      }
    }
  }

  // Queue ICE candidate for later processing when remote description is not ready
  private queueIceCandidate(candidate: RTCIceCandidateInit): void {

    // Add to queue with timestamp for ordering
    this.iceCandidateQueue.push({
      ...candidate,
      queuedAt: Date.now()
    });

  }

  // Process queued ICE candidates
  private async processQueuedIceCandidates(): Promise<void> {
    if (this.iceCandidateQueue.length === 0) {
      return;
    }

    // Filter out invalid candidates and process valid ones
    const validCandidates = this.iceCandidateQueue.filter(candidate => candidate && candidate.candidate);

    // Process each valid candidate in order (oldest first)
    const sortedCandidates = validCandidates.sort((a, b) => (a.queuedAt || 0) - (b.queuedAt || 0));

    for (const candidate of sortedCandidates) {
      try {
        await this.handleIceCandidate(candidate);

      } catch (error) {

        // Don't break the loop, continue with other candidates
      }
    }

    // Clear the queue
    this.iceCandidateQueue = [];
  }

  // Reset WebRTC state completely (for critical errors)
  private resetWebRTCState(): void {
    this.isWebRTCResetting = true;

    // Close and clear peer connection
    if (this.peerConnection) {
      try {
        // Close all transceivers first
        this.peerConnection.getTransceivers().forEach(transceiver => {
          if (transceiver.stop) {
            transceiver.stop();
          }
        });

        // Close the peer connection
        this.peerConnection.close();

      } catch (error) {

      } finally {
        this.peerConnection = null;
      }
    }

    // Clear remote stream
    if (this.remoteStream) {
      try {
        this.remoteStream.getTracks().forEach(track => {
          track.stop();
        });
      } catch (error) {

      } finally {
        this.remoteStream = null;
      }
    }

    // Clear ICE candidate queue
    this.iceCandidateQueue = [];

    // Clear processed signals tracking
    this.processedSignals.clear();
    this.signalCounter = 0;

    // Clear message buffer
    this.messageBuffer.clear();
    this.processingMessages = false;

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
      } catch (error) {
        // Ignore if gc is not available
      }
    }

    this.isWebRTCResetting = false;
  }

  // Reset WebRTC state only (preserves local stream)
  private resetWebRTCStateOnly(): void {

    // Close peer connection
    if (this.peerConnection) {
        this.peerConnection.close();
      this.peerConnection = null;
    }

    // Clear remote stream
    if (this.remoteStream) {
      this.remoteStream.getTracks().forEach(track => {
        track.stop();
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

  }


  // Ensure complete cleanup before new peer connection setup
  private async ensureCompleteCleanup(): Promise<void> {

    // Force reset if there's any existing state
    if (this.peerConnection || this.remoteStream || this.iceCandidateQueue.length > 0) {
      this.resetWebRTCState();
    }

    // Small delay to ensure cleanup is complete
    await new Promise(resolve => setTimeout(resolve, 100));
  }

  // Set up peer connection without creating offer (for non-initiators)
  private async setupPeerConnectionOnly(): Promise<void> {

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

      // Set up event handlers
      this.setupPeerConnectionHandlers();

      // Add local stream
      if (this.localStream) {
        this.localStream.getTracks().forEach(track => {
          if (this.peerConnection) {
            this.peerConnection.addTrack(track, this.localStream!);
          }
        });
      } else {
      }

    } catch (error) {

      // Reset state on critical errors
      if (error instanceof Error && error.message.includes('addTrack')) {
        this.resetWebRTCState();
      }
      throw error;
    }
  }

  // Start WebRTC connection (assumes peer connection is already set up)
  private async startWebRTCConnection(): Promise<void> {

    try {
      // Ensure peer connection is ready
      this.ensurePeerConnectionReady();

      // Start connection timeout monitoring
      this.startConnectionTimeoutMonitoring();

      // Simplified flow: Initiator will create offer after PubNub join
      // Receiver will wait for the offer
      if (this.isInitiator) {
      } else {
      }

    } catch (error) {

      // Stop timeout monitoring on error
      this.stopConnectionTimeoutMonitoring();

      // Reset state on critical errors
      if (error instanceof Error && (
        error.message.includes('createOffer') ||
        error.message.includes('setLocalDescription')
      )) {
        this.resetWebRTCState();
      }
      throw error;
    }
  }

  // Handle chat message
  private handleChatMessage(message: { text: string; from: string; timestamp: number; id?: string }): void {

    if (this.onMessageReceivedCallback) {
      this.onMessageReceivedCallback(message);
    }
  }

  // Handle match with proper error handling and fallbacks
  private async handleMatchWithErrorHandling(matchType: string, matchData: any): Promise<void> {

    try {
      // CRITICAL FIX: Use actual_match_type from backend for proper detection
      const actualMatchType = matchData.actual_match_type || matchType;

      // Case 1: Video Match - Handle video playback
      if (actualMatchType === 'video' && matchData.video_id && matchData.video_url) {

        await this.handleVideoMatch({
          videoId: matchData.video_id?.toString() || 'unknown',
          videoUrl: matchData.video_url || '',
          videoName: matchData.video_name || 'Video'
        });

        return; // Explicitly return to prevent any further processing
      } else if (actualMatchType !== 'video' && matchData.partner && matchData.partner.id && matchData.partner.id !== 'video') {
        // Case 2: Live Connection (staff or real user) - Start WebRTC

        // CRITICAL: Set match data FIRST before any setup
        this.currentRoomId = matchData.room_id;
        this.partnerId = matchData.partner.id.toString();
        this.isInitiator = matchData.is_initiator;
        this.sessionVersion = matchData.session_version;

        // CRITICAL FIX: Reset ready signal flag for fresh connection
        // This prevents "already sent" issues when rematching with same partner
        this.hasSentReadySignal = false;
        this.partnerReadyReceived = false;

        // Verify we have a valid partner (not a ghost connection)
        if (matchData.partner.id === this.getAuthenticatedUserId()) {

          // Try to get a video match instead
          await this.requestVideoMatchFallback();
          return;
        }

        // CRITICAL: Verify all required data is set before proceeding

        if (!this.currentRoomId || !this.partnerId || !this.sessionVersion) {
          // Don't throw error, just log and continue for now
        } else {
        }

        await this.setupPubNubConnection();

        // Set up peer connection for both initiator and receiver
        await this.setupPeerConnectionOnly();

        // CRITICAL FIX: Update connection state to connecting for both users
        if (this.onConnectionStateCallback) {
          this.onConnectionStateCallback('connecting' as RTCPeerConnectionState);
          console.log('🔄 LIVE MATCH: Connection state set to connecting');
        }

        if (this.isInitiator) {
          // For initiators, start the WebRTC connection (send offer)
          console.log('🚀 LIVE MATCH: Initiator starting WebRTC connection...');
          await this.startWebRTCConnection();
        } else {
          // For receivers, just wait for the offer
          console.log('⏳ LIVE MATCH: Receiver waiting for offer...');
        }
      } else {

        // Fall back to video match
        await this.requestVideoMatchFallback();
        return;
      }

    } catch (error) {

      // Implement fallback strategies
      await this.handleMatchFallback(matchData, error);
    }
  }

  // Request video match fallback when real user match fails
  private async requestVideoMatchFallback(): Promise<void> {

    try {
      // Call the swipe endpoint again to get a video match
      const result = await this.swipeToNext();

      if (result.success && result.matchType === 'video') {
      } else {
        // Notify UI of connection failure
        if (this.onConnectionStateCallback) {
          this.onConnectionStateCallback('failed' as RTCPeerConnectionState);
        }
      }
    } catch (error) {

      // Notify UI of connection failure
      if (this.onConnectionStateCallback) {
        this.onConnectionStateCallback('failed' as RTCPeerConnectionState);
      }
    }
  }

  // Simplified fallback handling
  private async handleMatchFallback(matchData: any, error: unknown): Promise<void> {

    try {
      if (matchData.video_id && matchData.video_url) {
        // Video fallback: try simulated stream
        const fallbackStream = await this.createSimulatedVideoStream();
        if (fallbackStream) {
          this.remoteStream = fallbackStream;
          if (this.onRemoteStreamCallback) {
            this.onRemoteStreamCallback(fallbackStream);
          }
        }
      } else {
        // WebRTC fallback: try to reconnect
        await this.attemptReconnection();
      }
    } catch (fallbackError) {

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
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }
  }

  // Attempt to reconnect after failure
  private async attemptReconnection(): Promise<void> {

    try {
      // Check if we have the minimum required parameters
      if (!this.currentRoomId || !this.partnerId) {

        // Instead of failing, trigger a new match request
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

      } else {
        throw new Error('Missing connection parameters for reconnection');
      }
    } catch (error) {

      throw error;
    }
  }

  // Request a new match when reconnection fails
  private async requestNewMatch(): Promise<void> {

    try {
      // Call the swipe endpoint to get a new match
      const result = await this.swipeToNext();

      if (result.success) {
      } else {
      }
    } catch (error) {

    }
  }

  // Clean up all resources and reset state
  cleanup(): void {
    console.log('🧹 CLEANUP: Starting complete cleanup...');

    // CRITICAL: Clear remote stream first to prevent gray screen
    this.remoteStream = null;
    console.log('✅ CLEANUP: Remote stream cleared');

    // Ensure PubNub is completely reset
    if (pubnubService.getCurrentSession().channel) {
      pubnubService.reset();
      console.log('✅ CLEANUP: PubNub reset');
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
    }

    // Stop local stream tracks
    if (this.localStream) {
      this.localStream.getTracks().forEach(track => track.stop());
    }

    // Stop remote stream tracks
    if (this.remoteStream && (this.remoteStream as MediaStream).getTracks) {
      (this.remoteStream as MediaStream).getTracks().forEach(track => track.stop());
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

    // CRITICAL FIX: Don't clear UI callbacks during cleanup!
    // These callbacks need to persist across connections so UI can receive streams
    // Only clear them during complete service shutdown, not during normal cleanup
    // this.onRemoteStreamCallback = null;          // KEEP THIS
    // this.onConnectionStateCallback = null;       // KEEP THIS
    // this.onMessageReceivedCallback = null;       // KEEP THIS
    // this.onVideoMatchCallback = null;            // KEEP THIS
    // this.onPartnerLeftCallback = null;           // KEEP THIS

    // Reset state
    this.currentRoomId = null;
    this.partnerId = null;
    this.isInitiator = false;
    this.sessionVersion = null;
    this.isSwiping = false;

    // Clear ICE candidate queue
    this.iceCandidateQueue = [];

  }

  // Manually refresh token validation (useful for testing or when token is refreshed)
  async refreshTokenValidation(): Promise<boolean> {

    // Clear existing cache
    this.tokenValidationCache = null;

    // Force a new validation
    try {
      const userId = await this.waitForAuthentication(10000); // 10 second timeout for manual refresh
      return !!userId;
    } catch (error) {

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

    // Notify UI that partner left
    if (this.onPartnerLeftCallback) {
      this.onPartnerLeftCallback();
    } else {
    }

    // Clean up the current connection
    this.performSwipeCleanup();

    // CRITICAL FIX: Force new match request after cleanup
    setTimeout(async () => {
      try {
        await this.forceNewMatchRequest();

      } catch (error) {

      }
    }, 50); // Minimal delay to ensure cleanup is complete
  }

  // Check if currently swiping
  isSwipingInProgress(): boolean {
    return this.isSwiping;
  }

  // Force new match request after cleanup
  private async forceNewMatchRequest(): Promise<void> {

    try {
      // Clear current state to ensure fresh match
      this.currentRoomId = null;
      this.partnerId = null;
      this.sessionVersion = null;

      // CRITICAL FIX: Instead of just calling swipeToNext(), we need to rejoin the queue
      // This ensures the user gets a new VideoWaitingRoom entry and starts status checking

      // Add minimal delay to prevent immediate re-matching with same partner who also failed
      await new Promise(resolve => setTimeout(resolve, 200 + Math.random() * 300)); // 200-500ms random delay

      try {
        // Stop current status checking first
        if (this.statusCheckInterval) {
          clearInterval(this.statusCheckInterval);
          this.statusCheckInterval = null;
        }

        // Rejoin the queue (this creates VideoWaitingRoom entry and starts status checking)
        await api.post('/video_chat/join', {});

        // Start checking for matches again
        this.startStatusChecking();

      } catch (joinError) {

        // Fallback to the old method
        const result = await this.swipeToNext();

        if (result.success) {
        } else {
        }
      }
    } catch (error) {

    }
  }

  // Clear waiting room after successful connection
  private async clearWaitingRoomAfterConnection(): Promise<void> {
    if (!this.currentRoomId) {
      return;
    }

    try {

      // Call backend to clear waiting room
      await api.post('/video_chat/clear_waiting_room', {
        room_id: this.currentRoomId,
        user_id: this.getAuthenticatedUserId()
      });

    } catch (error) {

      // Don't throw error - this is cleanup, not critical
    }
  }

  // Ensure local stream is healthy and restore if needed
  private async ensureLocalStreamHealth(): Promise<void> {
    if (!this.localStream) {
      try {
        await this.getLocalStream();

      } catch (error) {

        throw new Error('Local stream cannot be restored');
      }
    } else {
      // Check if stream is still active
      const tracks = this.localStream.getTracks();
      const activeTracks = tracks.filter(track => track.readyState === 'live');

      if (activeTracks.length === 0) {
        try {
          await this.forceRefreshLocalStream();

        } catch (error) {

          throw new Error('Local stream cannot be refreshed');
        }
      } else {
      }
    }
  }

  // Check if we're in a valid state and recover if needed
  private async validateAndRecoverState(): Promise<void> {

    // Check if we have a valid room but no active connection
    if (this.currentRoomId && this.partnerId && this.partnerId !== 'video') {
      if (!this.peerConnection || !this.remoteStream) {

        // REDUCED RECOVERY: Only clear state, don't attempt aggressive reconnection
        this.performSwipeCleanup();
      }
    }

    // Check if we're stuck in video state without video data
    if (this.currentRoomId && this.partnerId === 'video' && !this.onVideoMatchCallback) {
      this.performSwipeCleanup();
    }

  }

  // Handle video completion and transition to next state
  private async handleVideoCompletion(): Promise<void> {

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
      const result = await this.swipeToNext();

      if (result.success) {
      } else {
      }
    } catch (error) {

      // Don't throw - this is a background process
    }
  }

  // Start connection timeout monitoring
  private startConnectionTimeoutMonitoring(): void {
    this.stopConnectionTimeoutMonitoring(); // Clear any existing timeout

    this.connectionStartTime = Date.now();

    this.connectionTimeoutId = setTimeout(() => {
      this.handleConnectionTimeout();
    }, this.CONNECTION_TIMEOUT_MS);
  }

  // Stop connection timeout monitoring
  private stopConnectionTimeoutMonitoring(): void {
    if (this.connectionTimeoutId) {
      clearTimeout(this.connectionTimeoutId);
      this.connectionTimeoutId = null;
    }
    this.connectionStartTime = null;
  }

  // Handle connection timeout - no remote stream after 40 seconds
  private async handleConnectionTimeout(): Promise<void> {

    // Check if we have a remote stream
    if (this.remoteStream && this.remoteStream.active) {
      return;
    }

    try {
      // Try to get a video match as fallback
      await this.requestVideoMatchFallback();
    } catch (error) {

      // If video fallback fails, try to swipe to next match
      try {
        await this.swipeToNext();
      } catch (swipeError) {

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
          }
        } catch (error) {

        }
      }
    }, 30000); // Every 30 seconds
  }

  // Stop heartbeat monitoring
  private stopHeartbeat(): void {
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
      this.heartbeatInterval = null;
    }
  }

  // Check connection health and reset timeout if remote stream appears
  private checkConnectionHealth(): void {
    if (this.connectionStartTime && this.remoteStream && this.remoteStream.active) {
      const connectionDuration = Date.now() - this.connectionStartTime;

      // Stop timeout monitoring since we have a successful connection
      this.stopConnectionTimeoutMonitoring();
    }
  }

  // Handle remote stream from peer connection
  private handleRemoteStream(stream: MediaStream): void {

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

  }

  // Handle connection failure by automatically triggering swipe
  private async handleConnectionFailure(): Promise<void> {

    try {
      // Clean up the failed connection
      this.resetWebRTCState();

      // Trigger UI callback
      if (this.onPartnerLeftCallback) {
        this.onPartnerLeftCallback();
      } else {
      }

      // CRITICAL FIX: Also trigger the same rejoin logic as handlePartnerLeft
      setTimeout(async () => {
        try {
          await this.forceNewMatchRequest();

        } catch (error) {

        }
      }, 100); // Minimal delay just to ensure UI updates are complete
    } catch (error) {

    }
  }

  // Public method to manually flush ICE candidate queue
  public async flushIceCandidateQueue(): Promise<void> {
    await this.processQueuedIceCandidates();
  }

  // Send queued ICE candidates to partner (for test signals)
  private sendQueuedIceCandidates(): void {
    if (this.iceCandidateQueue.length === 0) {
      return;
    }

    if (!this.currentRoomId || !this.partnerId) {
      return;
    }

    // Send all queued candidates
    for (const candidateData of this.iceCandidateQueue) {
      try {
        // Check if this is a test signal or actual ICE candidate
        if (candidateData && typeof candidateData === 'object' && 'test' in candidateData && (candidateData as any).test === true) {
          // This is a test signal, use test signal method
          this.sendTestSignal('ice-candidate', candidateData);
        } else {
          // This is an actual ICE candidate, use regular signal method
          this.sendSignal('ice-candidate', candidateData);
        }
      } catch (error) {

      }
    }

    // Clear the queue
    this.iceCandidateQueue = [];
  }

  // Call the backend swipe endpoint
  private async callSwipeEndpoint(): Promise<{ success: boolean; data?: any }> {
    try {
      const response = await api.post('/video_chat/swipe', {});
      return { success: true, data: response };
    } catch (error) {

      return { success: false };
    }
  }

  // Update service state from swipe response
  private updateServiceStateFromSwipeResponse(responseData: any): void {

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

  }

  // Create and send WebRTC offer (called by initiator after PubNub connection)
  private async createAndSendOffer(): Promise<void> {

    // Prevent multiple offer creations
    if (this.peerConnection?.localDescription) {
      return;
    }

    try {

      // SIMPLIFIED: Only ensure peer connection exists, don't force cleanup
      if (!this.peerConnection) {
        await this.setupPeerConnectionOnly();
      } else {
        // Check if the existing peer connection is in a valid state
        const state = this.peerConnection.signalingState;

        // Only reset if in an invalid state
        if (state === 'closed' || state === 'have-remote-offer' || state === 'have-local-offer') {
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

      // Send offer to partner
      if (this.partnerId) {
        await pubnubService.sendOffer(this.partnerId, offer.sdp || '');
      }
    } catch (error) {

      // If we get an m-lines error, reset the state completely
      if (error instanceof Error && error.message.includes('m-lines')) {
        this.resetWebRTCState();
      }

      throw error;
    }
  }

  // Ensure peer connection is ready - CRITICAL for second connection
  private ensurePeerConnectionReady(): void {
    console.log('🔧 Ensuring peer connection is ready...');

    // If no peer connection or it's closed, create new one
    if (!this.peerConnection || this.peerConnection.signalingState === 'closed') {
      console.log('🆕 Creating new peer connection...');

      this.peerConnection = new RTCPeerConnection({
        iceServers: [
          { urls: 'stun:stun.l.google.com:19302' },
          { urls: 'stun:stun1.l.google.com:19302' }
        ]
      });

      // CRITICAL: Setup event handlers for the new connection
      this.setupPeerConnectionHandlers();

      // CRITICAL: Add local stream to new peer connection
      if (this.localStream) {
        console.log('📹 Adding local stream to new peer connection...');
        this.localStream.getTracks().forEach(track => {
          if (this.peerConnection && this.localStream) {
            this.peerConnection.addTrack(track, this.localStream);
          }
        });
      }

      console.log('✅ New peer connection created and configured');
    } else {
      console.log('✅ Existing peer connection is ready');
    }
  }

  // Check remote stream status
  private checkRemoteStreamStatus(): void {
    if (this.peerConnection) {
      const connectionState = this.peerConnection.connectionState;
      const iceConnectionState = this.peerConnection.iceConnectionState;
      const signalingState = this.peerConnection.signalingState;

      console.log('🔍 STREAM STATUS CHECK:', {
        connectionState,
        iceConnectionState,
        signalingState,
        hasRemoteStream: !!this.remoteStream,
        remoteStreamActive: this.remoteStream?.active || false
      });

      // If we have a stable connection but no remote stream after 5 seconds, something is wrong
      if (connectionState === 'connected' && iceConnectionState === 'connected' && !this.remoteStream) {
        console.log('⚠️ STREAM STATUS: Connection stable but no remote stream - possible issue');

        // Give it a bit more time, then check again
        setTimeout(() => {
          if (!this.remoteStream && this.peerConnection?.connectionState === 'connected') {
            console.log('❌ STREAM STATUS: Still no remote stream after delay - triggering fallback');
            this.handleConnectionFailure();
          }
        }, 3000);
      }
    }
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
