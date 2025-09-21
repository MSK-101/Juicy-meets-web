import { useAuthStore } from '../store/auth';

export interface WebRTCSignalData {
  type: 'offer' | 'answer' | 'ice-candidate';
  data: any;
  target_user_id: string;
}

export class MockVideoChatService {
  private peerConnection: RTCPeerConnection | null = null;
  private localStream: MediaStream | null = null;
  private remoteStream: MediaStream | null = null;
  private currentRoomId: string | null = null;
  private partnerId: string | null = null;
  private isInitiator: boolean = false;
  private iceCandidateQueue: RTCIceCandidateInit[] = [];
  private userId: string | null = null;

  // Simulation state
  private isWaiting = false;
  private mockMatchTimeout: NodeJS.Timeout | null = null;

  // Events
  private onRemoteStreamCallback: ((stream: MediaStream) => void) | null = null;
  private onConnectionStateCallback: ((state: RTCPeerConnectionState) => void) | null = null;
  private onPartnerLeftCallback: (() => void) | null = null;

  constructor() {
    this.userId = this.getAuthenticatedUserId();
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

  // Get local stream
  async getLocalStream(): Promise<MediaStream> {
    if (this.localStream) {
      return this.localStream;
    }

    try {
      this.localStream = await navigator.mediaDevices.getUserMedia({
        video: true,
        audio: true
      });
      return this.localStream;
    } catch (error) {
      
      throw error;
    }
  }

  getRemoteStream(): MediaStream | null {
    return this.remoteStream;
  }

  // Mock join queue - simulates finding a match after 2 seconds
  async joinQueue(): Promise<void> {
    this.isWaiting = true;

    // Simulate finding a match after 2 seconds
    this.mockMatchTimeout = setTimeout(async () => {
      if (this.isWaiting) {
        await this.simulateMatch();
      }
    }, 2000);
  }

  private async simulateMatch(): Promise<void> {
    // Create mock match data
    this.currentRoomId = `room_${Date.now()}_mock`;
    this.partnerId = `partner_${Date.now()}`;
    this.isInitiator = Math.random() > 0.5; // Randomly decide who initiates

    // Start WebRTC connection
    await this.startWebRTCConnection();
  }

  private async startWebRTCConnection(): Promise<void> {
    try {

      // Create peer connection
      await this.createPeerConnection();

      // Get local stream and add tracks
      const localStream = await this.getLocalStream();
      localStream.getTracks().forEach(track => {
        this.peerConnection!.addTrack(track, localStream);
      });

      // If initiator, create and send offer
      if (this.isInitiator && this.peerConnection) {
        const offer = await this.peerConnection.createOffer({
          offerToReceiveAudio: true,
          offerToReceiveVideo: true
        });

        await this.peerConnection.setLocalDescription(offer);

        // Simulate sending offer and receiving answer after 1 second
        setTimeout(async () => {
          await this.simulateAnswer();
        }, 1000);
      } else {
        // Simulate receiving offer after 500ms
        setTimeout(async () => {
          await this.simulateOffer();
        }, 500);
      }

    } catch (error) {
      
    }
  }

  private async createPeerConnection(): Promise<void> {
    this.peerConnection = new RTCPeerConnection({
      iceServers: [
        { urls: 'stun:stun.l.google.com:19302' },
        { urls: 'stun:stun1.l.google.com:19302' }
      ]
    });

    this.setupPeerConnectionHandlers();
  }

  private setupPeerConnectionHandlers(): void {
    if (!this.peerConnection) return;

    // Connection state changes
    this.peerConnection.onconnectionstatechange = () => {
      const state = this.peerConnection!.connectionState;

      if (this.onConnectionStateCallback) {
        this.onConnectionStateCallback(state);
      }
    };

    // ICE candidates
    this.peerConnection.onicecandidate = (event) => {
      if (event.candidate) {
        // In real implementation, this would be sent to the other peer
        // For mock, we'll simulate adding it to the remote peer
        setTimeout(() => {
          if (this.peerConnection) {
            this.peerConnection.addIceCandidate(event.candidate!);
          }
        }, 100);
      }
    };

    // Remote stream
    this.peerConnection.ontrack = (event) => {

      if (event.streams && event.streams[0]) {
        this.remoteStream = event.streams[0];

        if (this.onRemoteStreamCallback) {
          this.onRemoteStreamCallback(this.remoteStream);
        }
      }
    };
  }

  private async simulateOffer(): Promise<void> {
    if (!this.peerConnection) return;

    // Create a mock offer
    const offer = await this.peerConnection.createOffer({
      offerToReceiveAudio: true,
      offerToReceiveVideo: true
    });

    await this.peerConnection.setRemoteDescription(offer);

    // Create answer
    const answer = await this.peerConnection.createAnswer();
    await this.peerConnection.setLocalDescription(answer);

    // Simulate remote peer also setting up their local stream
    setTimeout(() => {
      this.simulateRemoteStream();
    }, 500);
  }

  private async simulateAnswer(): Promise<void> {
    if (!this.peerConnection) return;

    // Create a mock answer
    const answer = await this.peerConnection.createAnswer();
    await this.peerConnection.setRemoteDescription(answer);

    // Simulate remote peer setting up their local stream
    setTimeout(() => {
      this.simulateRemoteStream();
    }, 500);
  }

  private simulateRemoteStream(): void {
    // For demo purposes, mirror the local stream as remote
    if (this.localStream && this.onRemoteStreamCallback) {
      this.onRemoteStreamCallback(this.localStream);
    }
  }

  // Leave chat
  async leaveChat(): Promise<void> {

    this.isWaiting = false;

    if (this.mockMatchTimeout) {
      clearTimeout(this.mockMatchTimeout);
      this.mockMatchTimeout = null;
    }

    this.cleanup();
  }

  private cleanup(): void {

    if (this.peerConnection) {
      this.peerConnection.close();
      this.peerConnection = null;
    }

    if (this.localStream) {
      this.localStream.getTracks().forEach(track => track.stop());
      this.localStream = null;
    }

    this.remoteStream = null;
    this.currentRoomId = null;
    this.partnerId = null;
    this.isInitiator = false;
    this.iceCandidateQueue = [];

  }
}

// Export singleton instance
export const mockVideoChatService = new MockVideoChatService();
