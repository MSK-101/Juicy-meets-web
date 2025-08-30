import { api } from '../api/baseAPI';
import { useAuthStore } from '../store/auth';
import { UserService } from '../api/services/userService';
import { pubnubService } from './pubnubService';

export interface WebRTCSignalData {
  type: 'offer' | 'answer' | 'ice-candidate';
  data: any;
  target_user_id: string;
}

export class CleanVideoChatService {
  private peerConnection: RTCPeerConnection | null = null;
  private localStream: MediaStream | null = null;
  private remoteStream: MediaStream | null = null;
  private currentRoomId: string | null = null;
  private partnerId: string | null = null;
  private isInitiator: boolean = false;
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

  // Signal listener for incoming WebRTC signals
  private signalListener: ((event: CustomEvent) => void) | null = null;

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
    } catch (error) {
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
    } catch (error) {
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
  }> {
    try {
      const response = await api.post('/video_chat/swipe', {});
      console.log('🔄 Raw response from backend:', response);
      console.log('🔄 Response data:', response.data);
      console.log('🔄 Response keys:', Object.keys(response));

      // Check if response.data exists, otherwise use response directly
      const responseData = (response.data || response) as {
        status: string;
        room_id: string;
        match_type: string;
        partner: { id: string };
        is_initiator: boolean;
        video_id?: string;
        video_url?: string;
        video_name?: string;
      };

      console.log('🔄 Parsed response data:', responseData);
      console.log('🔄 Response status:', responseData.status);
      console.log('🔄 Response match_type:', responseData.match_type);

      if (responseData.status === 'matched') {
        // Update current room and partner info
        this.currentRoomId = responseData.room_id;
        this.partnerId = responseData.partner.id;
        this.isInitiator = responseData.is_initiator;

        // Handle different match types
        if (responseData.match_type === 'video') {
          console.log('🎥 Video match data from backend:', {
            video_id: responseData.video_id,
            video_url: responseData.video_url,
            video_name: responseData.video_name
          });

          try {
            let videoStream: MediaStream | null = null;

            // Try to get real video file if video_id is available
            if (responseData.video_id) {
              videoStream = await this.createVideoStreamFromFile(parseInt(responseData.video_id));
            }

            // If we got a video stream, set it as remote stream
            if (videoStream) {
              this.remoteStream = videoStream;
              // Trigger the remote stream callback
              if (this.onRemoteStreamCallback) {
                this.onRemoteStreamCallback(videoStream);
              }
            } else {
              // No stream created, but that's okay - VideoPlayer will handle the URL directly
              // Trigger the video match callback with video data
              if (this.onVideoMatchCallback && responseData.video_id && responseData.video_url) {
                console.log('🎥 Triggering video match callback with data:', {
                  videoId: responseData.video_id.toString(),
                  videoUrl: responseData.video_url,
                  videoName: responseData.video_name || 'Video'
                });
                this.onVideoMatchCallback({
                  videoId: responseData.video_id.toString(),
                  videoUrl: responseData.video_url,
                  videoName: responseData.video_name || 'Video'
                });
              } else {
                console.log('❌ Video match callback not triggered. Missing:', {
                  hasCallback: !!this.onVideoMatchCallback,
                  hasVideoId: !!responseData.video_id,
                  hasVideoUrl: !!responseData.video_url
                });
              }
            }

          } catch {
            // Silent error handling
          }

          return {
            success: true,
            roomId: responseData.room_id,
            matchType: 'video',
            partnerId: 'video',
            videoId: responseData.video_id,
            videoUrl: responseData.video_url || '',
            videoName: responseData.video_name || 'Video'
          };
        } else if (responseData.match_type === 'staff') {
          return {
            success: true,
            roomId: responseData.room_id,
            matchType: 'staff',
            partnerId: responseData.partner.id
          };
        } else {
          // Start WebRTC connection for real user
          await this.startWebRTCConnection();
          return {
            success: true,
            roomId: responseData.room_id,
            matchType: 'real_user',
            partnerId: responseData.partner.id
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

  // Create a simulated video stream for video partner matches
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

          // Log every 10 frames to verify animation is running
          if (frame % 10 === 0) {
            console.log('🎨 Canvas animation frame:', frame);
          }

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

        console.log('🎨 Canvas animation started with interval:', animationInterval);
        console.log('🎨 Canvas dimensions:', canvas.width, 'x', canvas.height);

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
      // Fetch video details from backend
      const response = await fetch(`http://localhost:3000/api/v1/videos/${videoId}/public`);

      if (!response.ok) {
        throw new Error(`Failed to fetch video: ${response.status}`);
      }

      const data = await response.json();
      const video = data.data.video;

      if (!video.video_file_url) {
        return await this.createSimulatedVideoStream();
      }

      // Instead of trying to create a complex stream, let's use the direct URL
      // This will be handled by the VideoPlayer component directly
      return null;

    } catch (error) {
      console.error('❌ Failed to create video stream from file:', error);
      return await this.createSimulatedVideoStream();
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

        const response = await api.get('/video_chat/status') as any;

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

          console.log('🔍 Set currentRoomId:', this.currentRoomId);
          console.log('🔍 Set partnerId:', this.partnerId);
          console.log('🔍 Set isInitiator:', this.isInitiator);

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
          if (response.match_type === 'video') {
            try {
              let videoStream: MediaStream | null = null;

              // Try to get real video file if video_id is available
              if (response.video_id) {
                videoStream = await this.createVideoStreamFromFile(response.video_id);
              } else {
                videoStream = await this.createSimulatedVideoStream();
              }

              // If we got a video stream, set it as remote stream
              if (videoStream) {
                this.remoteStream = videoStream;
                // Trigger the remote stream callback
                if (this.onRemoteStreamCallback) {
                  this.onRemoteStreamCallback(videoStream);
                }
              } else {
                // No stream created, but that's okay - VideoPlayer will handle the URL directly
                // Trigger the video match callback with video data
                if (this.onVideoMatchCallback && response.video_id && response.video_url) {
                  this.onVideoMatchCallback({
                    videoId: response.video_id.toString(),
                    videoUrl: response.video_url,
                    videoName: response.video_name || 'Video'
                  });
                }
              }
            } catch (error) {
              console.error('❌ Failed to create video stream via status check:', error);
              // Log more details about the error
              if (error instanceof Error) {
                console.error('❌ Error details:', error.message, error.stack);
              } else {
                console.error('❌ Unknown error type:', typeof error, error);
              }
            }
          } else if (response.match_type === 'staff') {
            console.log('👨‍💼 Matched with staff member, starting WebRTC...');
            // Start WebRTC connection for staff
            await this.startWebRTCConnection();
          } else if (response.match_type === 'real_user') {
            console.log('👤 Matched with real user, setting up WebRTC...');

            // Log current state before setup
            this.logConnectionState();

            // Ensure signal listener is set up for the room
            await this.ensureSignalListenerSetup();

            // Log state after signal listener setup
            this.logConnectionState();

            // For real user matches, we need to handle the connection carefully
            // Only the initiator should create and send the offer
            if (response.is_initiator) {
              console.log('🚀 Initiator: Creating and sending offer...');
              try {
                // Verify room and partner info is set
                if (!this.currentRoomId || !this.partnerId) {
                  throw new Error('Room or partner info not set before starting WebRTC connection');
                }

                // Small delay to ensure both users are ready
                await new Promise(resolve => setTimeout(resolve, 500));
                await this.startWebRTCConnection();
                console.log('✅ WebRTC connection started successfully for initiator');

                // Log state after WebRTC connection
                this.logConnectionState();
              } catch (error) {
                console.error('❌ Failed to start WebRTC connection for initiator:', error);
                // Reset state and try again
                this.resetWebRTCState();
              }
            } else {
              console.log('⏳ Non-initiator: Waiting for offer from partner...');
              try {
                // Verify room and partner info is set
                if (!this.currentRoomId || !this.partnerId) {
                  throw new Error('Room or partner info not set before setting up peer connection');
                }

                // Small delay to ensure PubNub connection is fully established
                await new Promise(resolve => setTimeout(resolve, 1000));
                // Just set up the peer connection and wait for the offer
                await this.setupPeerConnectionOnly();
                console.log('✅ Peer connection set up for non-initiator');

                // Log state after peer connection setup
                this.logConnectionState();
              } catch (error) {
                console.error('❌ Failed to set up peer connection for non-initiator:', error);
                // Reset state and try again
                this.resetWebRTCState();
              }
            }
          }
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

  // Send WebRTC signal
  private async sendSignal(type: string, data: any): Promise<void> {
    console.log(`📤 Sending ${type} signal`);

    // Validate connection state before sending
    if (!this.validateConnectionState()) {
      console.error('❌ Cannot send signal: connection state validation failed');
      console.error('❌ Current Room ID:', this.currentRoomId);
      console.error('❌ Partner ID:', this.partnerId);
      console.error('❌ Call stack:', new Error().stack);
      return;
    }

    // At this point, we know currentRoomId and partnerId are not null due to validation
    const roomId = this.currentRoomId!;
    const partnerId = this.partnerId!;

    console.log(`📤 Signal details:`, {
      type,
      data,
      roomId,
      partnerId,
      from: this.getAuthenticatedUserId()
    });

    try {
      // Send WebRTC signal via PubNub
      await pubnubService.sendWebRTCSignal({
        type: type as 'offer' | 'answer' | 'ice-candidate',
        data,
        from: this.getAuthenticatedUserId() || 'unknown',
        to: partnerId,
        chatId: roomId
      });

      console.log(`✅ Signal ${type} sent via PubNub for room ${roomId}`);

      // Log the signal that was sent for debugging
      console.log(`📤 Sent signal payload:`, {
        type,
        data,
        from: this.getAuthenticatedUserId(),
        to: partnerId,
        chatId: roomId
      });
    } catch (error) {
      console.error(`❌ Failed to send ${type} signal:`, error);
      console.error(`❌ Signal details:`, { type, data, roomId, partnerId });
    }
  }

  // Listen for incoming signals from other users via PubNub
  private setupSignalListener(): void {
    if (!this.currentRoomId) {
      console.warn('⚠️ Cannot set up signal listener: no room ID');
      return;
    }

    console.log('🔔 Setting up PubNub signal listener for room:', this.currentRoomId);

    // Set up WebRTC signal handler
    const webrtcCleanup = pubnubService.onWebRTCSignal((signal) => {
      console.log('🔗 WebRTC signal handler activated for signal:', signal.type);

      // Ignore signals from ourselves
      if (signal.from === this.getAuthenticatedUserId()) {
        console.log('🔄 Ignoring own signal:', signal.type);
        return;
      }

      console.log('📨 Received WebRTC signal via PubNub:', signal.type, 'from:', signal.from);
      console.log('📨 Signal data:', signal.data);
      console.log('📨 Current room ID:', this.currentRoomId);
      console.log('📨 Partner ID:', this.partnerId);

      this.handleIncomingSignal({
        type: signal.type,
        data: signal.data,
        from: signal.from
      });
    });

    // Store cleanup function for later use
    this.webrtcSignalCleanup = webrtcCleanup;

    // Set up general message listener for chat messages
    const generalMessageCleanup = pubnubService.onMessage((message) => {
      console.log('💬 Received general message via PubNub:', message);

      // Check if this is a WebRTC signal (fallback handling)
      if (message && typeof message === 'object' && 'type' in message && 'data' in message) {
        const webrtcMessage = message as any;
        if (webrtcMessage.type === 'offer' || webrtcMessage.type === 'answer' || webrtcMessage.type === 'ice-candidate') {
          console.log('📨 Received WebRTC signal via general message (fallback):', webrtcMessage.type);
          console.log('📨 Signal data:', webrtcMessage.data);
          console.log('📨 From user:', webrtcMessage.from);

          // Process the WebRTC signal
          this.handleIncomingSignal({
            type: webrtcMessage.type,
            data: webrtcMessage.data,
            from: webrtcMessage.from
          });
          return; // Don't process as chat message
        }
      }

      // Check if this is a chat message
      if (message && typeof message === 'object' && 'sender' in message && 'text' in message) {
        const chatMessage = message as any;

        // Ignore messages from ourselves - this prevents seeing our own messages twice
        if (chatMessage.sender === this.getAuthenticatedUserId()) {
          console.log('🔄 Ignoring own chat message from PubNub:', chatMessage.text);
          return;
        }

        console.log('📨 Processing incoming chat message from other user:', chatMessage);

        // Handle the chat message
        this.handleChatMessage({
          from: chatMessage.sender,
          text: chatMessage.text,
          timestamp: chatMessage.timestamp || Date.now()
        });
      } else if (message && typeof message === 'object' && 'type' in message && message.type === 'chat-message') {
        // Handle custom chat message format
        const customMessage = message as any;
        if (customMessage.data && customMessage.data.from !== this.getAuthenticatedUserId()) {
          console.log('📨 Processing custom chat message from other user:', customMessage.data);

          this.handleChatMessage({
            from: customMessage.data.from,
            text: customMessage.data.text,
            timestamp: customMessage.data.timestamp || Date.now()
          });
        } else {
          console.log('🔄 Ignoring custom chat message from self:', customMessage.data);
        }
      }
    });

    // Store cleanup function for later use
    this.generalMessageCleanup = generalMessageCleanup;

    console.log('✅ Signal listener setup completed for room:', this.currentRoomId);
  }

  // Remove signal listener
  private removeSignalListener(): void {
    console.log('🔕 Removing signal listeners...');

    // Clean up WebRTC signal listener
    if (this.webrtcSignalCleanup) {
      this.webrtcSignalCleanup();
      this.webrtcSignalCleanup = null;
      console.log('✅ WebRTC signal listener removed');
    }

    // Clean up general message listener
    if (this.generalMessageCleanup) {
      this.generalMessageCleanup();
      this.generalMessageCleanup = null;
      console.log('✅ General message listener removed');
    }

    // Disconnect from PubNub
    if (this.currentRoomId) {
      pubnubService.disconnect();
      console.log('✅ Disconnected from PubNub');
    }
  }

  // Handle incoming WebRTC signals
  async handleIncomingSignal(signal: { type: string; data: any; from: string }): Promise<void> {
    console.log('📨 Received signal:', signal.type, 'from:', signal.from);

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
          await this.handleOffer(signal.data);
          break;
        case 'answer':
          await this.handleAnswer(signal.data);
          break;
        case 'ice-candidate':
          await this.handleIceCandidate(signal.data);
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
      this.iceCandidateQueue.push(candidateData);
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

      // Set up signal listener for incoming WebRTC signals
      this.setupSignalListener();

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

      // Set up signal listener for incoming WebRTC signals
      this.setupSignalListener();

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

      // Create and send offer
      const offer = await this.peerConnection.createOffer();
      console.log('✅ Offer created successfully');

      await this.peerConnection.setLocalDescription(offer);
      console.log('✅ Local description (offer) set successfully');

      // Send offer to partner
      this.sendSignal('offer', offer);
      console.log('✅ Offer sent to partner');

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

  // Clean up resources
  cleanup(): void {
    console.log('🧹 Cleaning up video chat service...');

    // Remove signal listener
    this.removeSignalListener();

    // Clean up PubNub listeners
    if (this.webrtcSignalCleanup) {
      this.webrtcSignalCleanup();
      this.webrtcSignalCleanup = null;
      console.log('✅ WebRTC signal cleanup completed');
    }

    if (this.generalMessageCleanup) {
      this.generalMessageCleanup();
      this.generalMessageCleanup = null;
      console.log('✅ General message cleanup completed');
    }

    // Clear intervals
    if (this.statusCheckInterval) {
      clearInterval(this.statusCheckInterval);
      this.statusCheckInterval = null;
    }

    // Reset WebRTC state
    this.resetWebRTCState();

    // Clear streams
    if (this.localStream) {
      this.localStream.getTracks().forEach(track => track.stop());
      this.localStream = null;
    }

    if (this.remoteStream) {
      this.remoteStream.getTracks().forEach(track => track.stop());
      this.remoteStream = null;
    }

    // Clear callbacks
    this.onRemoteStreamCallback = null;
    this.onConnectionStateCallback = null;
    this.onPartnerLeftCallback = null;
    this.onMessageReceivedCallback = null;
    this.onVideoMatchCallback = null;

    console.log('✅ Video chat service cleanup completed');
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
  getCurrentRoomInfo(): { roomId: string | null; partnerId: string | null; isInitiator: boolean } {
    return {
      roomId: this.currentRoomId,
      partnerId: this.partnerId,
      isInitiator: this.isInitiator
    };
  }
}

// Export singleton instance
export const cleanVideoChatService = new CleanVideoChatService();
