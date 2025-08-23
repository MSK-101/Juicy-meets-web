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

  // Event callbacks
  private onRemoteStreamCallback: ((stream: MediaStream) => void) | null = null;
  private onConnectionStateCallback: ((state: RTCPeerConnectionState) => void) | null = null;
  private onPartnerLeftCallback: (() => void) | null = null;
  private onMessageReceivedCallback: ((message: { from: string; text: string; timestamp: number; id?: string }) => void) | null = null;

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

        if (response.status === 'matched') {
          console.log('🎉 Match found! Room ID:', response.room_id);
          this.currentRoomId = response.room_id;
          this.partnerId = response.partner.id;
          this.isInitiator = response.is_initiator;

          // Stop checking status
          if (this.statusCheckInterval) {
            clearInterval(this.statusCheckInterval);
            this.statusCheckInterval = null;
          }

          // Initialize WebRTC connection
          await this.initializeWebRTC();
        }
      } catch (error) {
        console.error('❌ Error checking status:', error);
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
        // Send ICE candidate to partner via signaling
        this.sendSignal('ice-candidate', event.candidate);
      }
    };
  }

  // Send WebRTC signal
  private async sendSignal(type: string, data: any): Promise<void> {
    console.log(`📤 Sending ${type} signal`);

    if (!this.currentRoomId || !this.partnerId) {
      console.error('❌ Cannot send signal: missing room or partner info');
      return;
    }

    try {
      // Send WebRTC signal via PubNub
      await pubnubService.sendWebRTCSignal({
        type: type as 'offer' | 'answer' | 'ice-candidate',
        data,
        from: this.getAuthenticatedUserId() || 'unknown',
        to: this.partnerId,
        chatId: this.currentRoomId
      });

      console.log(`✅ Signal ${type} sent via PubNub for room ${this.currentRoomId}`);
    } catch (error) {
      console.error(`❌ Failed to send ${type} signal:`, error);
    }
  }

  // Listen for incoming signals from other users via PubNub
  private setupSignalListener(): void {
    if (!this.currentRoomId) return;

    console.log('🔔 Setting up PubNub signal listener for room:', this.currentRoomId);

    // Connect to PubNub with room as chat ID
    pubnubService.connect(this.getAuthenticatedUserId() || 'unknown', this.currentRoomId);

    // Set up WebRTC signal handler
    pubnubService.onWebRTCSignal((signal) => {
      // Ignore signals from ourselves
      if (signal.from === this.getAuthenticatedUserId()) {
        console.log('🔄 Ignoring own signal:', signal.type);
        return;
      }

      console.log('📨 Received WebRTC signal via PubNub:', signal.type, 'from:', signal.from);
      this.handleIncomingSignal({
        type: signal.type,
        data: signal.data,
        from: signal.from
      });
    });

    // Set up general message listener for chat messages
    pubnubService.onMessage((message) => {
      console.log('💬 Received general message via PubNub:', message);

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
  }

  // Remove signal listener
  private removeSignalListener(): void {
    // Disconnect from PubNub
    if (this.currentRoomId) {
      pubnubService.disconnect();
    }
  }

  // Handle incoming WebRTC signals
  async handleIncomingSignal(signal: { type: string; data: any; from: string }): Promise<void> {
    console.log('📨 Received signal:', signal.type, 'from:', signal.from);

    if (!this.peerConnection) {
      console.log('⚠️ No peer connection, ignoring signal');
      return;
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
    }
  }

  // Handle WebRTC offer
  private async handleOffer(offer: RTCSessionDescriptionInit): Promise<void> {
    console.log('📥 Handling offer');

    try {
      await this.peerConnection!.setRemoteDescription(new RTCSessionDescription(offer));

      // Create and send answer
      const answer = await this.peerConnection!.createAnswer();
      await this.peerConnection!.setLocalDescription(answer);

      // Send answer to partner
      this.sendSignal('answer', answer);
      console.log('✅ Answer sent');

      // Process queued ICE candidates
      this.processQueuedIceCandidates();
    } catch (error) {
      console.error('❌ Error handling offer:', error);
    }
  }

  // Handle WebRTC answer
  private async handleAnswer(answer: RTCSessionDescriptionInit): Promise<void> {
    console.log('📥 Handling answer');

    try {
      await this.peerConnection!.setRemoteDescription(new RTCSessionDescription(answer));
      console.log('✅ Answer processed');

      // Process queued ICE candidates
      this.processQueuedIceCandidates();
    } catch (error) {
      console.error('❌ Error handling answer:', error);
    }
  }

  // Handle ICE candidate
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

  // Process queued ICE candidates
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
      }

      // Create and send offer
      const offer = await this.peerConnection.createOffer();
      await this.peerConnection.setLocalDescription(offer);

      // Send offer to partner
      this.sendSignal('offer', offer);
      console.log('✅ Offer sent');

      console.log('✅ WebRTC connection started');
    } catch (error) {
      console.error('❌ Failed to start WebRTC connection:', error);
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

    // Clear intervals
    if (this.statusCheckInterval) {
      clearInterval(this.statusCheckInterval);
      this.statusCheckInterval = null;
    }

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

    // Clear token validation cache
    this.tokenValidationCache = null;

    // Reset state
    this.currentRoomId = null;
    this.partnerId = null;
    this.isInitiator = false;
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
