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
  private iceCandidateQueue: RTCIceCandidate[] = [];
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

  // Swipe to next match
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
    try {
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
        // Reset WebRTC state but preserve local stream for new match
        this.resetWebRTCStateOnly();

        // Update current room and partner info
        this.currentRoomId = responseData.room_id;
        this.partnerId = responseData.partner.id;
        this.isInitiator = responseData.is_initiator;
        this.sessionVersion = responseData.session_version || '';

        console.log('🔍 Set currentRoomId:', this.currentRoomId);
        console.log('🔍 Set partnerId:', this.partnerId);
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
        return { success: false };
      }
    } catch {
      return { success: false };
    }
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
        const stream = videoElement.captureStream();
        console.log('✅ Video stream captured successfully from file');
        return stream;
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
        await pubnubService.connect(userId, this.currentRoomId);
        console.log('✅ PubNub connection established for room:', this.currentRoomId);

        // Wait a bit for the connection to stabilize
        await new Promise(resolve => setTimeout(resolve, 1000));
        console.log('⏳ Waited for PubNub connection to stabilize');

        // Check if we're properly subscribed to the channel
        console.log('🔍 Checking channel subscription status...');
        try {
          const onlineUsers = await pubnubService.getOnlineUsers();
          console.log('👥 Online users in room:', onlineUsers);
          console.log('👤 Current user ID:', userId);
          console.log('🔍 Is current user in online users?', onlineUsers.includes(userId));
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
          console.log('🎉 Match found! Room ID:', response.room_id);
          console.log('🎉 Match type:', response.match_type);
          console.log('🎉 Partner:', response.partner);

          this.currentRoomId = response.room_id;
          this.partnerId = response.partner.id;
          this.isInitiator = response.is_initiator;
          this.sessionVersion = response.session_version || '';

          console.log('🔍 Set currentRoomId:', this.currentRoomId);
          console.log('🔍 Set partnerId:', this.partnerId);
          console.log('🔍 Set isInitiator:', this.isInitiator);
          console.log('🔍 Set sessionVersion:', this.sessionVersion);

          // Process any queued ICE candidates that were generated before room info was set
          if (this.iceCandidateQueue.length > 0) {
            console.log(`📦 Processing ${this.iceCandidateQueue.length} queued ICE candidates after room setup`);
            this.flushIceCandidateQueue();
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
      console.log('📺 Remote track received');
      this.remoteStream = event.streams[0];

      if (this.onRemoteStreamCallback) {
        this.onRemoteStreamCallback(this.remoteStream);
      }
    };

    this.peerConnection.onconnectionstatechange = () => {
      const state = this.peerConnection?.connectionState;
      console.log('🔗 Connection state changed:', state);

      if (this.onConnectionStateCallback && state) {
        this.onConnectionStateCallback(state);
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
      await pubnubService.sendWebRTCSignal({
        type: type as 'offer' | 'answer' | 'ice-candidate',
        data,
        from: this.getAuthenticatedUserId() || 'unknown',
        to: this.partnerId,
        chatId: this.currentRoomId
      });

      console.log(`✅ Test signal ${type} sent via PubNub for room ${this.currentRoomId}`);
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
            await pubnubService.sendOffer(this.partnerId, 'initiator', data.sdp || '');
            console.log('✅ Offer sent successfully');
          }
          break;
        case 'answer':
          if ('sdp' in data) {
            await pubnubService.sendAnswer(this.partnerId, 'receiver', data.sdp || '');
            console.log('✅ Answer sent successfully');
          }
          break;
        case 'ice-candidate':
          await pubnubService.sendIceCandidate(this.partnerId, 'initiator', data);
          console.log('✅ ICE candidate sent successfully');
          break;
        default:
          console.warn('⚠️ Unknown signal type:', type);
      }
    } catch (error) {
      console.error(`❌ Failed to send ${type} signal:`, error);
      throw error;
    }
  }

  // Send handshake signals for connection establishment
  private async sendHandshakeSignals(): Promise<void> {
    if (!this.partnerId) {
      console.warn('⚠️ Cannot send handshake signals: no partner ID');
      return;
    }

    try {
      // Send hello signal
      await pubnubService.sendHello(this.partnerId, this.isInitiator ? 'initiator' : 'receiver');
      console.log('👋 Hello signal sent');

      // If we're the receiver, also send ready signal
      if (!this.isInitiator) {
        await pubnubService.sendReady(this.partnerId, 'receiver');
        console.log('✅ Ready signal sent');
      }
    } catch (error) {
      console.error('❌ Failed to send handshake signals:', error);
      throw error;
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

  // Set up PubNub connection with session versioning
  private async setupPubNubConnection(): Promise<void> {
    if (!this.currentRoomId || !this.partnerId || !this.sessionVersion) {
      console.warn('⚠️ Cannot set up PubNub connection: missing room, partner, or session version info');
      return;
    }

    console.log('🔌 Setting up PubNub connection for room:', this.currentRoomId);
    console.log('🔌 Session version:', this.sessionVersion);
    console.log('🔌 Partner ID:', this.partnerId);
    console.log('🔌 Is initiator:', this.isInitiator);

    try {
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
          onMessage: (signal) => this.handleIncomingSignal(signal),
          onJoin: () => console.log('✅ Joined PubNub channel successfully'),
          onLeave: () => console.log('👋 Left PubNub channel'),
          onError: (error) => console.error('❌ PubNub error:', error)
        }
      );

      console.log('✅ PubNub connection setup completed');
    } catch (error) {
      console.error('❌ Failed to set up PubNub connection:', error);
      throw error;
    }
  }

  // Handle incoming WebRTC signals from PubNub
  private async handleIncomingSignal(signal: {
    type: string;
    matchId: string;
    sessionVersion: string;
    from: string;
    to?: string;
    role: 'initiator' | 'receiver';
    sdp?: string;
    candidate?: RTCIceCandidateInit;
    correlationId: string;
    ts: number;
  }): Promise<void> {
    console.log('📨 Received signal:', signal.type, 'from:', signal.from, 'to:', signal.to);

    // Verify this signal is from our partner (convert both to strings for comparison)
    const signalFromStr = signal.from.toString();
    const partnerIdStr = this.partnerId?.toString();

    if (signalFromStr !== partnerIdStr) {
      console.log('⚠️ Ignoring signal from wrong partner. Expected:', partnerIdStr, 'Got:', signalFromStr);
      return;
    }

    // For staff matches, be more permissive with the 'to' field
    // Staff users might not always set the 'to' field correctly
    const currentUserId = this.getAuthenticatedUserId();
    if (signal.to && signal.to.toString() !== currentUserId?.toString()) {
      console.log('⚠️ Ignoring signal not intended for us. Expected:', currentUserId, 'Got:', signal.to);
      return;
    }

    // Verify session version matches
    if (signal.sessionVersion !== this.sessionVersion) {
      console.log('⚠️ Ignoring signal with stale session version. Expected:', this.sessionVersion, 'Got:', signal.sessionVersion);
      return;
    }

    console.log('✅ Signal validation passed, processing...');

    if (!this.peerConnection) {
      console.log('⚠️ No peer connection, setting up now...');
      try {
        await this.setupPeerConnectionOnly();
      } catch (error) {
        console.error('❌ Failed to set up peer connection for incoming signal:', error);
        return;
      }
    }

    try {
      switch (signal.type) {
        case 'offer':
          if (signal.sdp) {
            await this.handleOffer({ sdp: signal.sdp, type: 'offer' });
          }
          break;
        case 'answer':
          if (signal.sdp) {
            await this.handleAnswer({ sdp: signal.sdp, type: 'answer' });
          }
          break;
        case 'ice':
          if (signal.candidate) {
            await this.handleIceCandidate(signal.candidate);
          }
          break;
        case 'hello':
          console.log('👋 Received hello from partner, sending ready...');
          if (this.partnerId) {
            pubnubService.sendReady(this.partnerId, this.isInitiator ? 'initiator' : 'receiver');
          }
          break;
        case 'ready':
          console.log('✅ Partner is ready for WebRTC connection');
          break;
        default:
          console.log('⚠️ Unknown signal type:', signal.type);
      }
    } catch (error) {
      console.error('❌ Error handling signal:', error);
      // Reset state on critical errors
      if (error instanceof Error && (
        error.message.includes('setRemoteDescription') ||
        error.message.includes('setLocalDescription')
      )) {
        console.warn('🔄 Critical WebRTC error, resetting connection state...');
        this.resetWebRTCState();
      }
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
      }

      // Log current WebRTC state
      this.logWebRTCState();

      // Check if we already have a remote description
      if (this.peerConnection!.remoteDescription) {
        console.warn('⚠️ Remote description already set, ignoring duplicate offer');
        return;
      }

      // Check if peer connection is in the correct state
      if (this.peerConnection!.signalingState !== 'stable') {
        console.warn('⚠️ Peer connection not in stable state, current state:', this.peerConnection!.signalingState);
        // Reset the connection if it's in the wrong state
        this.resetWebRTCState();
        await this.setupPeerConnectionOnly();
        this.logWebRTCState();
      }

      // Set remote description first
      await this.peerConnection!.setRemoteDescription(new RTCSessionDescription(offer));
      console.log('✅ Remote description set successfully');
      this.logWebRTCState();

      // Create and send answer
      const answer = await this.peerConnection!.createAnswer();
      await this.peerConnection!.setLocalDescription(answer);
      console.log('✅ Local description (answer) set successfully');
      this.logWebRTCState();

      // Send answer to partner
      this.sendSignal('answer', answer);
      console.log('✅ Answer sent to partner');

      // Process any queued ICE candidates
      this.processQueuedIceCandidates();
    } catch (error) {
      console.error('❌ Error handling offer:', error);
      // Reset state on critical errors
      if (error instanceof Error && (
        error.message.includes('setRemoteDescription') ||
        error.message.includes('setLocalDescription') ||
        error.message.includes('createAnswer') ||
        error.message.includes('Called in wrong state')
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
      // Ensure we have a local description before setting remote
      if (!this.peerConnection!.localDescription) {
        console.warn('⚠️ No local description set, cannot process answer');
        return;
      }

      // Log current WebRTC state
      this.logWebRTCState();

      // Check if peer connection is in the correct state
      if (this.peerConnection!.signalingState !== 'have-local-offer') {
        console.warn('⚠️ Peer connection not in have-local-offer state, current state:', this.peerConnection!.signalingState);
        // Reset the connection if it's in the wrong state
        this.resetWebRTCState();
        return;
      }

      // Set remote description
      await this.peerConnection!.setRemoteDescription(new RTCSessionDescription(answer));
      console.log('✅ Answer processed successfully');
      this.logWebRTCState();

      // Process queued ICE candidates
      this.processQueuedIceCandidates();
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

  // Handle ICE candidate
  private async handleIceCandidate(candidateData: RTCIceCandidateInit): Promise<void> {
    console.log('🧊 Handling ICE candidate');
    console.log('🧊 Candidate data:', candidateData);

    // Validate ICE candidate data before processing
    if (!this.isValidIceCandidate(candidateData)) {
      console.warn('⚠️ Invalid ICE candidate received, skipping:', candidateData);
      return;
    }

    if (!this.peerConnection!.remoteDescription) {
      // Queue candidate for later
      this.iceCandidateQueue.push(new RTCIceCandidate(candidateData));
      console.log('📦 Queued ICE candidate for later processing');
      return;
    }

    try {
      const candidate = new RTCIceCandidate(candidateData);
      await this.peerConnection!.addIceCandidate(candidate);
      console.log('✅ ICE candidate added successfully');
    } catch (error) {
      console.error('❌ Error adding ICE candidate:', error);
      // Don't reset state for ICE candidate errors, just log them
      console.warn('⚠️ ICE candidate error, continuing with connection...');
    }
  }

  // Validate ICE candidate data
  private isValidIceCandidate(candidateData: RTCIceCandidateInit): boolean {
    // Check if candidate has the required properties
    if (!candidateData || typeof candidateData !== 'object') {
      return false;
    }

    // Check if candidate has a valid candidate string
    if (!candidateData.candidate || typeof candidateData.candidate !== 'string') {
      return false;
    }

    // Check if candidate has valid sdpMid or sdpMLineIndex
    // At least one of them must be present and not null
    if (candidateData.sdpMid === null && candidateData.sdpMLineIndex === null) {
      return false;
    }

    // Additional validation for sdpMLineIndex
    if (candidateData.sdpMLineIndex !== null && typeof candidateData.sdpMLineIndex !== 'number') {
      return false;
    }

    return true;
  }

  // Flush ICE candidate queue and send any pending candidates
  private flushIceCandidateQueue(): void {
    if (this.iceCandidateQueue.length === 0) {
      console.log('📦 No queued ICE candidates to flush');
      return;
    }

    if (!this.currentRoomId || !this.partnerId) {
      console.warn('⚠️ Cannot flush ICE candidate queue: room/partner info not ready');
      return;
    }

    console.log(`📦 Flushing ${this.iceCandidateQueue.length} queued ICE candidates`);

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
    console.log('📦 ICE candidate queue flushed and cleared');
  }

  // Process queued ICE candidates
  private async processQueuedIceCandidates(): Promise<void> {
    console.log(`📦 Processing ${this.iceCandidateQueue.length} queued ICE candidates`);

    // Filter out invalid candidates before processing
    const validCandidates = this.iceCandidateQueue.filter(candidate => this.isValidIceCandidate(candidate));
    const invalidCandidates = this.iceCandidateQueue.length - validCandidates.length;

    if (invalidCandidates > 0) {
      console.warn(`⚠️ Filtered out ${invalidCandidates} invalid ICE candidates`);
    }

    if (validCandidates.length === 0) {
      console.log('📦 No valid ICE candidates to process');
      this.iceCandidateQueue = [];
      return;
    }

    console.log(`📦 Processing ${validCandidates.length} valid ICE candidates`);

    for (const candidateData of validCandidates) {
      try {
        const candidate = new RTCIceCandidate(candidateData);
        await this.peerConnection!.addIceCandidate(candidate);
        console.log('✅ Queued ICE candidate added successfully');
      } catch (error) {
        console.error('❌ Error adding queued ICE candidate:', error);
      }
    }

    // Clear the queue after processing
    this.iceCandidateQueue = [];
    console.log('📦 ICE candidate queue cleared');
  }

  // Reset WebRTC connection state
  private resetWebRTCState(): void {
    console.log('🔄 Resetting WebRTC connection state...');

    // Close existing peer connection
    if (this.peerConnection) {
      try {
        // Close the peer connection
        this.peerConnection.close();
        console.log('✅ Peer connection closed successfully');
      } catch (error) {
        console.warn('⚠️ Error closing peer connection:', error);
      }
      this.peerConnection = null;
    }

    // Clear ICE candidate queue
    this.iceCandidateQueue = [];

    // Clear room and partner info
    this.currentRoomId = null;
    this.partnerId = null;
    this.isInitiator = false;
    this.sessionVersion = null;

    console.log('✅ WebRTC state reset complete');
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

  // Start WebRTC connection
  private async startWebRTCConnection(): Promise<void> {
    console.log('🔗 Starting WebRTC connection...');

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

      console.log('✅ Peer connection created successfully');

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
        console.warn('⚠️ No local stream available for WebRTC connection');
      }

      // Send handshake signals first
      await this.sendHandshakeSignals();

      // Only create and send offer if we're the initiator
      if (this.isInitiator) {
        // Wait a bit for handshake to complete
        await new Promise(resolve => setTimeout(resolve, 1000));

        // Create and send offer
        const offer = await this.peerConnection.createOffer();
        console.log('✅ Offer created successfully');

        await this.peerConnection.setLocalDescription(offer);
        console.log('✅ Local description (offer) set successfully');

        // Send offer to partner
        await this.sendSignal('offer', offer);
        console.log('✅ Offer sent to partner');
      }

      console.log('✅ WebRTC connection started successfully');
    } catch (error) {
      console.error('❌ Failed to start WebRTC connection:', error);
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

  // Send chat message
  async sendMessage(text: string): Promise<void> {
    if (!this.currentRoomId || !this.partnerId) {
      console.log('⚠️ Cannot send message: not in a chat room');
      return;
    }

    console.log('💬 Sending chat message:', text);

    try {
      // Send chat message via PubNub
      await pubnubService.sendMessage(text);

      // Note: We don't add the message locally here anymore because:
      // 1. It will be added locally in the page component
      // 2. PubNub will send it back to all subscribers
      // 3. Our duplicate detection will prevent it from being added twice

      console.log('✅ Chat message sent via PubNub');
    } catch (error) {
      console.error('❌ Failed to send chat message:', error);
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

  // Handle match with simplified logic
  private async handleMatchWithErrorHandling(matchType: string, matchData: any): Promise<void> {
    console.log(`🔍 Handling match with simplified logic`);
    console.log('🔍 Match data:', matchData);
    console.log('🔍 Match type:', matchType);
    console.log('🔍 Video ID:', matchData.video_id);
    console.log('🔍 Video URL:', matchData.video_url);
    console.log('🔍 Partner:', matchData.partner);

    try {
      // Simplified logic: Only two cases matter for frontend
      if (matchData.video_id && matchData.video_url) {
        // Case 1: Video Match - Start video player
        console.log('🎥 Video match detected - starting video player...');
        console.log('🎥 Video data:', {
          videoId: matchData.video_id?.toString() || 'unknown',
          videoUrl: matchData.video_url || '',
          videoName: matchData.video_name || 'Video'
        });

        await this.handleVideoMatch({
          videoId: matchData.video_id?.toString() || 'unknown',
          videoUrl: matchData.video_url || '',
          videoName: matchData.video_name || 'Video'
        });
      } else if (matchData.partner && matchData.partner.id) {
        // Case 2: Live Connection (staff or real user) - Start WebRTC
        console.log('🔗 Live connection detected - starting WebRTC...');
        console.log('🔗 Partner ID:', matchData.partner.id);
        console.log('🔗 Is Initiator:', this.isInitiator);

        await this.setupPubNubConnection();

        if (this.isInitiator) {
          await this.startWebRTCConnection();
        } else {
          await this.setupPeerConnectionOnly();
        }
      } else {
        console.warn('⚠️ Unknown match type - no video data and no partner info');
        console.warn('⚠️ Video ID exists:', !!matchData.video_id);
        console.warn('⚠️ Video URL exists:', !!matchData.video_url);
        console.warn('⚠️ Partner exists:', !!matchData.partner);
        throw new Error('Invalid match data - missing video or partner information');
      }

      console.log(`✅ Match handling completed successfully`);
    } catch (error) {
      console.error(`❌ Error handling match:`, error);

      // Implement fallback strategies
      await this.handleMatchFallback(matchData, error);
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

  // Enhanced cleanup with proper resource management
  cleanup(): void {
    console.log('🧹 Starting comprehensive cleanup...');

    try {
      // Clean up PubNub connection
      if (this.currentRoomId) {
        pubnubService.leave();
        console.log('✅ PubNub connection cleaned up');
      }

      // Clean up WebRTC resources
      this.resetWebRTCState();

      // Clean up video streams
      if (this.localStream) {
        this.localStream.getTracks().forEach(track => {
          track.stop();
          console.log('🛑 Local stream track stopped:', track.kind);
        });
        this.localStream = null;
      }

      if (this.remoteStream) {
        this.remoteStream.getTracks().forEach(track => {
          track.stop();
          console.log('🛑 Remote stream track stopped:', track.kind);
        });
        this.remoteStream = null;
      }

      // Clean up intervals
      if (this.statusCheckInterval) {
        clearInterval(this.statusCheckInterval);
        this.statusCheckInterval = null;
        console.log('🛑 Status check interval cleared');
      }

      // Clear callbacks
      this.onRemoteStreamCallback = null;
      this.onConnectionStateCallback = null;
      this.onPartnerLeftCallback = null;
      this.onMessageReceivedCallback = null;
      this.onVideoMatchCallback = null;

      // Clear cleanup functions
      this.webrtcSignalCleanup = null;
      this.generalMessageCleanup = null;

      console.log('✅ Comprehensive cleanup completed');
    } catch (error) {
      console.error('❌ Error during cleanup:', error);
    }
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

  // Reset only WebRTC state without clearing local stream (for staff/real user matches)
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
}

// Export singleton instance
export const cleanVideoChatService = new CleanVideoChatService();
