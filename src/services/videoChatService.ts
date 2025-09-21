import { pubnubService } from './pubnubService';

export interface VideoChatConnection {
  id: string;
  localStream: MediaStream;
  remoteStream: MediaStream | null;
  peerConnection: RTCPeerConnection | null;
  isConnected: boolean;
  isInitiator: boolean;
  connectionId: string; // Unique ID for this connection session
  queuedIceCandidates: RTCIceCandidateInit[];
  isProcessingOffer: boolean;
  isProcessingAnswer: boolean;
}

export interface WebRTCSignal {
  type: 'offer' | 'answer' | 'ice-candidate';
  data: RTCSessionDescriptionInit | RTCIceCandidateInit;
  from: string;
  chatId: string;
  connectionId?: string; // Connection session ID
}

export class VideoChatService {
  private connections = new Map<string, VideoChatConnection>();
  private currentUserId: string | null = null;
  private authToken: string | null = null;

  public setUserCredentials(userId: string, authToken: string): void {
    this.currentUserId = userId;
    this.authToken = authToken;
  }

  public isAvailable(): boolean {
    return !!(this.currentUserId && this.authToken);
  }

  public async createConnection(chatId: string): Promise<VideoChatConnection> {
    if (!this.isAvailable()) {
      throw new Error('Service not available - set user credentials first');
    }

    try {
      // Get user media
      const stream = await navigator.mediaDevices.getUserMedia({
        video: true,
        audio: true
      });

      // Create connection object
      const connection: VideoChatConnection = {
        id: chatId,
        localStream: stream,
        remoteStream: null,
        peerConnection: null,
        isConnected: false,
        isInitiator: false,
        connectionId: `conn-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        queuedIceCandidates: [],
        isProcessingOffer: false,
        isProcessingAnswer: false
      };

      this.connections.set(chatId, connection);

      // Connect to PubNub
      // TODO: Implement missing PubNub methods
      // await pubnubService.connect(this.currentUserId!, chatId);
      // this.setupSignaling(chatId);
      // await pubnubService.announcePresence();

      // Start connection process after a short delay
      setTimeout(() => {
        this.attemptConnection(chatId);
      }, 2000);

      return connection;

    } catch (error) {
      
      throw error;
    }
  }

  private setupSignaling(chatId: string): void {
    // TODO: Implement missing PubNub methods
    // Listen for WebRTC signals
    // pubnubService.onWebRTCSignal((signal) => {
    //   this.handleSignal(signal, chatId);
    // });

    // Listen for presence changes
    // pubnubService.onPresenceChange((onlineUsers) => {
    //   this.handlePresenceChange(chatId, onlineUsers);
    // });
  }

  private async attemptConnection(chatId: string): Promise<void> {

    // TODO: Implement getOnlineUsers method
    // const onlineUsers = await pubnubService.getOnlineUsers();

    // if (onlineUsers.length >= 2) {
    //   this.handlePresenceChange(chatId, onlineUsers);
    // }
  }

    private async handlePresenceChange(chatId: string, onlineUsers: unknown): Promise<void> {

    // Extract user list
    let userList: string[] = [];
    if (Array.isArray(onlineUsers)) {
      userList = onlineUsers;
    }

    const connection = this.connections.get(chatId);
    if (!connection) {
      return;
    }

    // Only proceed if we have exactly 2 users and need to establish connection
    if (userList.length === 2 && !connection.isConnected) {

      // Check if we already have a working peer connection
      if (connection.peerConnection) {
        const pc = connection.peerConnection;

                // If we have a peer connection that's working or in progress, don't recreate
        if (pc.connectionState === 'connecting' ||
            pc.connectionState === 'connected') {
          return;
        }

        // Special handling for have-local-offer state
        if (pc.signalingState === 'have-local-offer') {
          // If we have local offer but no remote description, this means offer wasn't processed
          // Let's see if we need to wait or restart
          if (!pc.remoteDescription) {
            const timeSinceCreation = Date.now() - parseInt(connection.connectionId.split('-')[1]);

            // More aggressive timeout for stuck offers - 3 seconds
            if (timeSinceCreation > 3000) {
              pc.close();
              connection.peerConnection = null;
              connection.isConnected = false;
              // Don't return here - let it recreate the connection below
            } else {
              return;
            }
          } else {
            return;
          }
        }

        // Check other states
        if (pc.signalingState === 'have-remote-offer') {
          return;
        }

        // For stable state, check if this makes sense
        if (pc.signalingState === 'stable') {
          // If we're stable but not connected, something might be wrong
          if (pc.iceConnectionState === 'new' && pc.connectionState === 'new') {
            const timeSinceCreation = Date.now() - parseInt(connection.connectionId.split('-')[1]);

            // If receiver has been stable for too long without progress, restart
            if (timeSinceCreation > 2000) {
              pc.close();
              connection.peerConnection = null;
              connection.isConnected = false;
              // Don't return here - let it recreate the connection below
            } else {
              return;
            }
          } else {
            return;
          }
        }

        // Only restart if connection actually failed
        if (pc.connectionState === 'failed' || pc.connectionState === 'disconnected') {
          pc.close();
          connection.peerConnection = null;
          connection.isConnected = false;
        } else {
          return;
        }
      }

      // Create new connection if we don't have one
      if (!connection.peerConnection) {

        // Simple deterministic initiator selection
        const sortedUsers = userList.sort();
        const isInitiator = sortedUsers[0] === this.currentUserId;

        connection.isInitiator = isInitiator;

        if (isInitiator) {
          await this.createPeerConnection(chatId, true);
        } else {
          // Receiver also needs peer connection to handle incoming offers
          await this.createPeerConnection(chatId, false);
        }
      }
    } else if (connection.peerConnection) {
      
    } else if (connection.isConnected) {
    } else {
    }
  }

  private async createPeerConnection(chatId: string, isInitiator: boolean): Promise<void> {
    const connection = this.connections.get(chatId);
    if (!connection) {
      return;
    }

    // Close existing peer connection if any
    if (connection.peerConnection) {
      connection.peerConnection.close();
    }

    // Reset connection state with new ID
    connection.connectionId = `conn-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    connection.queuedIceCandidates = [];
    connection.isProcessingOffer = false;
    connection.isProcessingAnswer = false;
    connection.remoteStream = null;
    connection.isConnected = false;

    try {

      // Create RTCPeerConnection
      const peerConnection = new RTCPeerConnection({
        iceServers: [
          { urls: 'stun:stun.l.google.com:19302' },
          { urls: 'stun:stun1.l.google.com:19302' }
        ]
      });

      // Add local stream
      connection.localStream.getTracks().forEach(track => {
        peerConnection.addTrack(track, connection.localStream);
      });

      // Set up event handlers
      this.setupPeerConnectionHandlers(peerConnection, chatId);

      // Store peer connection
      connection.peerConnection = peerConnection;

      // If initiator, create and send offer
      if (isInitiator) {
        const offer = await peerConnection.createOffer({
          offerToReceiveAudio: true,
          offerToReceiveVideo: true
        });

        await peerConnection.setLocalDescription(offer);

        // Send offer via PubNub
        // TODO: Implement sendWebRTCSignal method
        // try {
        //   pubnubService.sendWebRTCSignal({
        //     type: 'offer',
        //     data: offer,
        //     from: this.currentUserId!,
        //     to: 'broadcast',
        //     chatId,
        //     connectionId: connection.connectionId
        //   });

        //   
        // } catch (error) {
        //   
        //   throw error;
        // }
      }

    } catch (error) {
      
    }
  }

  private setupPeerConnectionHandlers(peerConnection: RTCPeerConnection, chatId: string): void {
    const connection = this.connections.get(chatId);
    if (!connection) return;

    // Connection state changes
    peerConnection.onconnectionstatechange = () => {

      if (peerConnection.connectionState === 'connected') {
        connection.isConnected = true;
      } else if (peerConnection.connectionState === 'failed') {
        connection.isConnected = false;
      }
    };

    // ICE connection state changes
    peerConnection.oniceconnectionstatechange = () => {
    };

    // Signaling state changes
    peerConnection.onsignalingstatechange = () => {
    };

    // ICE candidates
    peerConnection.onicecandidate = (event) => {
      if (event.candidate) {
        // TODO: Implement sendWebRTCSignal method
        // pubnubService.sendWebRTCSignal({
        //   type: 'ice-candidate',
        //   data: event.candidate,
        //   from: this.currentUserId!,
        //   to: 'broadcast',
        //   chatId,
        //   connectionId: connection.connectionId
        // });
      }
    };

    // Remote tracks (remote video/audio)
    peerConnection.ontrack = (event) => {

      if (event.streams && event.streams[0]) {
        connection.remoteStream = event.streams[0];

        // Notify UI about remote stream
        this.notifyRemoteStreamAvailable(chatId);
      }
    };
  }

  private async handleSignal(signal: WebRTCSignal, chatId: string): Promise<void> {
    const { type, data, from, connectionId } = signal;

    const connection = this.connections.get(chatId);
    if (!connection) {
      return;
    }

    // Ignore signals from ourselves
    if (from === this.currentUserId) {
      return;
    }

    try {
      if (type === 'offer') {
        await this.handleOffer(data as RTCSessionDescriptionInit, from, chatId, connectionId);
      } else if (type === 'answer') {
        await this.handleAnswer(data as RTCSessionDescriptionInit, from, chatId, connectionId);
      } else if (type === 'ice-candidate') {
        await this.handleIceCandidate(data as RTCIceCandidateInit, from, chatId, connectionId);
      }
    } catch (error) {
      
    }
  }

  private async handleOffer(offer: RTCSessionDescriptionInit, from: string, chatId: string, connectionId?: string): Promise<void> {

    const connection = this.connections.get(chatId);
    if (!connection) return;

    // Prevent concurrent offer processing
    if (connection.isProcessingOffer) {
      return;
    }

    connection.isProcessingOffer = true;

    try {
      // Validate connection ID if provided
      if (connectionId && connection.peerConnection && connectionId !== connection.connectionId) {
        // Close old connection and create new one
        connection.peerConnection.close();
        connection.peerConnection = null;
      }

      // Create receiver peer connection if we don't have one
      if (!connection.peerConnection) {
        await this.createPeerConnection(chatId, false);
      }

      if (!connection.peerConnection) {
        return;
      }

      // Set remote description
      await connection.peerConnection.setRemoteDescription(new RTCSessionDescription(offer));

      // Create and send answer
      const answer = await connection.peerConnection.createAnswer();
      await connection.peerConnection.setLocalDescription(answer);

      // Send answer
      // TODO: Implement sendWebRTCSignal method
      // pubnubService.sendWebRTCSignal({
      //   type: 'answer',
      //   data: answer,
      //   from: this.currentUserId!,
      //   to: 'broadcast',
      //   chatId,
      //   connectionId: connection.connectionId
      // });

      // Process queued ICE candidates
      await this.processQueuedIceCandidates(chatId);

    } catch (error) {
      
    } finally {
      connection.isProcessingOffer = false;
    }
  }

  private async handleAnswer(answer: RTCSessionDescriptionInit, from: string, chatId: string, connectionId?: string): Promise<void> {

    const connection = this.connections.get(chatId);
    if (!connection?.peerConnection) {
      return;
    }

    // Prevent concurrent answer processing
    if (connection.isProcessingAnswer) {
      return;
    }

    connection.isProcessingAnswer = true;

    try {
      // Validate connection ID if provided
      if (connectionId && connectionId !== connection.connectionId) {
        
        return;
      }

      const pc = connection.peerConnection;

      // Check current signaling state

      // Only process answer if we're in the right state
      if (pc.signalingState !== 'have-local-offer') {
        return;
      }

      await pc.setRemoteDescription(new RTCSessionDescription(answer));

      // Process queued ICE candidates
      await this.processQueuedIceCandidates(chatId);
    } catch (error) {
      
    } finally {
      connection.isProcessingAnswer = false;
    }
  }

  private async handleIceCandidate(candidateData: RTCIceCandidateInit, from: string, chatId: string, connectionId?: string): Promise<void> {

    const connection = this.connections.get(chatId);
    if (!connection) {
      return;
    }

    // Validate connection ID if provided
    if (connectionId && connectionId !== connection.connectionId) {
      
      return;
    }

    if (!connection.peerConnection) {
      connection.queuedIceCandidates.push(candidateData);
      return;
    }

    // Check if remote description is set
    if (!connection.peerConnection.remoteDescription) {
      connection.queuedIceCandidates.push(candidateData);
      return;
    }

    try {
      const candidate = new RTCIceCandidate(candidateData);
      await connection.peerConnection.addIceCandidate(candidate);
    } catch (error) {
      if (error instanceof DOMException && error.message.includes('Unknown ufrag')) {
        
        return;
      }

      // If remote description state changed, try queueing
      if (!connection.peerConnection.remoteDescription) {
        connection.queuedIceCandidates.push(candidateData);
      }
    }
  }

  private async processQueuedIceCandidates(chatId: string): Promise<void> {
    const connection = this.connections.get(chatId);
    if (!connection?.peerConnection || !connection.peerConnection.remoteDescription) {
      return;
    }

    const candidates = [...connection.queuedIceCandidates];
    connection.queuedIceCandidates = []; // Clear the queue

    for (const candidateData of candidates) {
      try {
        const candidate = new RTCIceCandidate(candidateData);
        await connection.peerConnection.addIceCandidate(candidate);
      } catch (error) {
        if (error instanceof DOMException && error.message.includes('Unknown ufrag')) {
          
        } else {
        }
      }
    }
  }

  private notifyRemoteStreamAvailable(chatId: string): void {
    const connection = this.connections.get(chatId);
    if (!connection?.remoteStream) return;

    // Dispatch custom event for UI
    const event = new CustomEvent('remote-stream-received', {
      detail: { chatId, stream: connection.remoteStream }
    });
    window.dispatchEvent(event);

  }

  public getConnection(chatId: string): VideoChatConnection | undefined {
    return this.connections.get(chatId);
  }

  public getConnectionDebugInfo(chatId: string): Record<string, unknown> {
    const connection = this.connections.get(chatId);
    if (!connection) {
      return { error: 'No connection found' };
    }

    return {
      chatId: connection.id,
      connectionId: connection.connectionId,
      isConnected: connection.isConnected,
      isInitiator: connection.isInitiator,
      hasPeerConnection: !!connection.peerConnection,
      hasLocalStream: !!connection.localStream,
      hasRemoteStream: !!connection.remoteStream,
      isProcessingOffer: connection.isProcessingOffer,
      isProcessingAnswer: connection.isProcessingAnswer,
      queuedIceCandidatesCount: connection.queuedIceCandidates.length,
      peerConnectionState: connection.peerConnection ? {
        connectionState: connection.peerConnection.connectionState,
        iceConnectionState: connection.peerConnection.iceConnectionState,
        signalingState: connection.peerConnection.signalingState
      } : null
    };
  }

  public getCurrentUserId(): string | null {
    return this.currentUserId;
  }

  public setupTestUser(testChatId: string): string {
    const userId = 'user-' + Date.now() + '-' + Math.random().toString(36).substr(2, 9);

    this.setUserCredentials(userId, 'fake-auth-token-for-testing');

    this.createConnection(testChatId)
      .then(() => {
      })
      .catch(error => {
      });

    return userId;
  }

  public cleanup(): void {

    for (const [, connection] of this.connections) {
      if (connection.peerConnection) {
        connection.peerConnection.close();
      }
    }

    this.connections.clear();
    this.currentUserId = null;
    this.authToken = null;

  }
}

export const videoChatService = new VideoChatService();

// Export to window for debugging
if (typeof window !== 'undefined') {
  (window as unknown as Record<string, unknown>).videoChatService = videoChatService;
}
