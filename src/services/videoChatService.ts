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
    console.log('🔑 User credentials set:', { userId, hasAuthToken: !!authToken });
  }

  public isAvailable(): boolean {
    return !!(this.currentUserId && this.authToken);
  }

  public async createConnection(chatId: string): Promise<VideoChatConnection> {
    if (!this.isAvailable()) {
      throw new Error('Service not available - set user credentials first');
    }

    console.log('🔗 Creating connection for chat:', chatId);

    try {
      // Get user media
      const stream = await navigator.mediaDevices.getUserMedia({
        video: true,
        audio: true
      });

      console.log('✅ Got media stream');

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
      await pubnubService.connect(this.currentUserId!, chatId);
      this.setupSignaling(chatId);
      await pubnubService.announcePresence();

      // Start connection process after a short delay
      setTimeout(() => {
        this.attemptConnection(chatId);
      }, 2000);

      console.log('✅ Video chat service initialized');
      return connection;

    } catch (error) {
      console.error('❌ Error creating connection:', error);
      throw error;
    }
  }

  private setupSignaling(chatId: string): void {
    // Listen for WebRTC signals
    pubnubService.onWebRTCSignal((signal) => {
      this.handleSignal(signal, chatId);
    });

    // Listen for presence changes
    pubnubService.onPresenceChange((onlineUsers) => {
      this.handlePresenceChange(chatId, onlineUsers);
    });
  }

  private async attemptConnection(chatId: string): Promise<void> {
    console.log('🎯 Attempting to establish connection for chat:', chatId);

    const onlineUsers = await pubnubService.getOnlineUsers();
    console.log('👥 Online users:', onlineUsers);

    if (onlineUsers.length >= 2) {
      this.handlePresenceChange(chatId, onlineUsers);
    }
  }

    private async handlePresenceChange(chatId: string, onlineUsers: unknown): Promise<void> {
    console.log('👥 Presence change for chat:', chatId);

    // Extract user list
    let userList: string[] = [];
    if (Array.isArray(onlineUsers)) {
      userList = onlineUsers;
    }

    console.log('👥 User list:', userList);

    const connection = this.connections.get(chatId);
    if (!connection) {
      console.log('❌ No connection found for chat:', chatId);
      return;
    }

        console.log('🔍 Connection state check:');
    console.log('  - User list length:', userList.length);
    console.log('  - Has peer connection:', !!connection.peerConnection);
    console.log('  - Is connected:', connection.isConnected);
    console.log('  - Connection ID:', connection.connectionId);

    // Only proceed if we have exactly 2 users and need to establish connection
    if (userList.length === 2 && !connection.isConnected) {

      // Check if we already have a working peer connection
      if (connection.peerConnection) {
        const pc = connection.peerConnection;
        console.log('🔍 Existing peer connection state:', {
          connectionState: pc.connectionState,
          iceConnectionState: pc.iceConnectionState,
          signalingState: pc.signalingState
        });

                // If we have a peer connection that's working or in progress, don't recreate
        if (pc.connectionState === 'connecting' ||
            pc.connectionState === 'connected') {
          console.log('✅ Peer connection already exists and working, skipping recreation');
          return;
        }

        // Special handling for have-local-offer state
        if (pc.signalingState === 'have-local-offer') {
          // If we have local offer but no remote description, this means offer wasn't processed
          // Let's see if we need to wait or restart
          if (!pc.remoteDescription) {
            const timeSinceCreation = Date.now() - parseInt(connection.connectionId.split('-')[1]);
            console.log('🔍 Checking offer timeout:', {
              timeSinceCreation,
              connectionId: connection.connectionId,
              hasRemoteDescription: !!pc.remoteDescription
            });

            // More aggressive timeout for stuck offers - 3 seconds
            if (timeSinceCreation > 3000) {
              console.log('⏰ Local offer timed out, restarting connection...');
              pc.close();
              connection.peerConnection = null;
              connection.isConnected = false;
              // Don't return here - let it recreate the connection below
            } else {
              console.log('⏳ Waiting for answer to local offer...');
              return;
            }
          } else {
            console.log('✅ Have local offer with remote description, connection in progress');
            return;
          }
        }

        // Check other states
        if (pc.signalingState === 'have-remote-offer') {
          console.log('✅ Have remote offer, processing in progress');
          return;
        }

        // For stable state, check if this makes sense
        if (pc.signalingState === 'stable') {
          // If we're stable but not connected, something might be wrong
          if (pc.iceConnectionState === 'new' && pc.connectionState === 'new') {
            const timeSinceCreation = Date.now() - parseInt(connection.connectionId.split('-')[1]);
            console.log('🔍 Stable but new connection, checking age:', {
              timeSinceCreation,
              iceConnectionState: pc.iceConnectionState,
              connectionState: pc.connectionState
            });

            // If receiver has been stable for too long without progress, restart
            if (timeSinceCreation > 2000) {
              console.log('⏰ Stable connection without progress, restarting...');
              pc.close();
              connection.peerConnection = null;
              connection.isConnected = false;
              // Don't return here - let it recreate the connection below
            } else {
              console.log('✅ Peer connection in stable state, skipping recreation');
              return;
            }
          } else {
            console.log('✅ Peer connection in stable state with progress, skipping recreation');
            return;
          }
        }

        // Only restart if connection actually failed
        if (pc.connectionState === 'failed' || pc.connectionState === 'disconnected') {
          console.log('♻️ Restarting failed connection...');
          pc.close();
          connection.peerConnection = null;
          connection.isConnected = false;
        } else {
          console.log('⏳ Peer connection in progress, waiting...');
          return;
        }
      }

      // Create new connection if we don't have one
      if (!connection.peerConnection) {
        console.log('🎯 2 users detected, determining roles...');
        console.log('🔍 User list for role determination:', userList);

        // Simple deterministic initiator selection
        const sortedUsers = userList.sort();
        const isInitiator = sortedUsers[0] === this.currentUserId;

        console.log('🎯 Am I initiator?', isInitiator);
        console.log('🎯 Sorted users:', sortedUsers);
        console.log('🎯 Current user:', this.currentUserId);
        console.log('🎯 First user in sorted list:', sortedUsers[0]);

        connection.isInitiator = isInitiator;

        if (isInitiator) {
          console.log('🚀 Starting as initiator...');
          await this.createPeerConnection(chatId, true);
        } else {
          console.log('⏳ Starting as receiver, creating peer connection...');
          // Receiver also needs peer connection to handle incoming offers
          await this.createPeerConnection(chatId, false);
        }
      }
    } else if (connection.peerConnection) {
      console.log('✅ Peer connection already exists for chat:', chatId);
      console.log('🔍 Connection details:', {
        connectionState: connection.peerConnection.connectionState,
        iceConnectionState: connection.peerConnection.iceConnectionState,
        signalingState: connection.peerConnection.signalingState,
        isConnected: connection.isConnected
      });
    } else if (connection.isConnected) {
      console.log('✅ Already connected to chat:', chatId);
    } else {
      console.log('⚠️ Unexpected state - not enough users or other condition not met');
    }
  }

  private async createPeerConnection(chatId: string, isInitiator: boolean): Promise<void> {
    const connection = this.connections.get(chatId);
    if (!connection) {
      console.log('❌ Cannot create peer connection - no connection found');
      return;
    }

    // Close existing peer connection if any
    if (connection.peerConnection) {
      console.log('🔄 Closing existing peer connection');
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
      console.log(`🔧 Creating ${isInitiator ? 'initiator' : 'receiver'} peer connection with ID: ${connection.connectionId}`);

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
        console.log('📤 Creating and sending offer...');
        const offer = await peerConnection.createOffer({
          offerToReceiveAudio: true,
          offerToReceiveVideo: true
        });

        await peerConnection.setLocalDescription(offer);
        console.log('✅ Local description (offer) set');

        // Send offer via PubNub
        console.log('🔗 About to send WebRTC offer...');
        try {
          pubnubService.sendWebRTCSignal({
            type: 'offer',
            data: offer,
            from: this.currentUserId!,
            to: 'broadcast',
            chatId,
            connectionId: connection.connectionId
          });

          console.log('📤 Offer sent successfully');
        } catch (error) {
          console.error('❌ Error sending offer:', error);
          throw error;
        }
      }

      console.log(`✅ ${isInitiator ? 'Initiator' : 'Receiver'} peer created successfully`);

    } catch (error) {
      console.error('❌ Error creating peer connection:', error);
    }
  }

  private setupPeerConnectionHandlers(peerConnection: RTCPeerConnection, chatId: string): void {
    const connection = this.connections.get(chatId);
    if (!connection) return;

    // Connection state changes
    peerConnection.onconnectionstatechange = () => {
      console.log('🔗 Connection state:', peerConnection.connectionState);

      if (peerConnection.connectionState === 'connected') {
        connection.isConnected = true;
        console.log('✅ WebRTC connection established!');
      } else if (peerConnection.connectionState === 'failed') {
        connection.isConnected = false;
        console.log('❌ WebRTC connection failed');
      }
    };

    // ICE connection state changes
    peerConnection.oniceconnectionstatechange = () => {
      console.log('🧊 ICE connection state:', peerConnection.iceConnectionState);
    };

    // Signaling state changes
    peerConnection.onsignalingstatechange = () => {
      console.log('📡 Signaling state:', peerConnection.signalingState);
    };

    // ICE candidates
    peerConnection.onicecandidate = (event) => {
      if (event.candidate) {
        console.log('🧊 Sending ICE candidate');
        pubnubService.sendWebRTCSignal({
          type: 'ice-candidate',
          data: event.candidate,
          from: this.currentUserId!,
          to: 'broadcast',
          chatId,
          connectionId: connection.connectionId
        });
      }
    };

    // Remote tracks (remote video/audio)
    peerConnection.ontrack = (event) => {
      console.log('📹 Remote track received:', event.track.kind);

      if (event.streams && event.streams[0]) {
        connection.remoteStream = event.streams[0];
        console.log('✅ Remote stream set');

        // Notify UI about remote stream
        this.notifyRemoteStreamAvailable(chatId);
      }
    };
  }

  private async handleSignal(signal: WebRTCSignal, chatId: string): Promise<void> {
    const { type, data, from, connectionId } = signal;

    console.log('📨 Received signal:', { type, from, chatId, connectionId });

    const connection = this.connections.get(chatId);
    if (!connection) {
      console.log('❌ No connection found for signal');
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
      console.error('❌ Error handling signal:', error);
    }
  }

  private async handleOffer(offer: RTCSessionDescriptionInit, from: string, chatId: string, connectionId?: string): Promise<void> {
    console.log('📥 Handling offer from:', from, 'connectionId:', connectionId);

    const connection = this.connections.get(chatId);
    if (!connection) return;

    // Prevent concurrent offer processing
    if (connection.isProcessingOffer) {
      console.log('⚠️ Already processing an offer, ignoring');
      return;
    }

    connection.isProcessingOffer = true;

    try {
      // Validate connection ID if provided
      if (connectionId && connection.peerConnection && connectionId !== connection.connectionId) {
        console.log('⚠️ Offer for wrong connection session, creating new connection');
        // Close old connection and create new one
        connection.peerConnection.close();
        connection.peerConnection = null;
      }

      // Create receiver peer connection if we don't have one
      if (!connection.peerConnection) {
        await this.createPeerConnection(chatId, false);
      }

      if (!connection.peerConnection) {
        console.log('❌ Failed to create peer connection for offer');
        return;
      }

      // Set remote description
      await connection.peerConnection.setRemoteDescription(new RTCSessionDescription(offer));
      console.log('✅ Remote description (offer) set');

      // Create and send answer
      const answer = await connection.peerConnection.createAnswer();
      await connection.peerConnection.setLocalDescription(answer);
      console.log('✅ Local description (answer) set');

      // Send answer
      pubnubService.sendWebRTCSignal({
        type: 'answer',
        data: answer,
        from: this.currentUserId!,
        to: 'broadcast',
        chatId,
        connectionId: connection.connectionId
      });

      console.log('📤 Answer sent successfully');

      // Process queued ICE candidates
      await this.processQueuedIceCandidates(chatId);

    } catch (error) {
      console.error('❌ Error handling offer:', error);
    } finally {
      connection.isProcessingOffer = false;
    }
  }

  private async handleAnswer(answer: RTCSessionDescriptionInit, from: string, chatId: string, connectionId?: string): Promise<void> {
    console.log('📥 Handling answer from:', from, 'connectionId:', connectionId);

    const connection = this.connections.get(chatId);
    if (!connection?.peerConnection) {
      console.log('❌ No peer connection for answer');
      return;
    }

    // Prevent concurrent answer processing
    if (connection.isProcessingAnswer) {
      console.log('⚠️ Already processing an answer, ignoring');
      return;
    }

    connection.isProcessingAnswer = true;

    try {
      // Validate connection ID if provided
      if (connectionId && connectionId !== connection.connectionId) {
        console.log('⚠️ Answer for wrong connection session, ignoring:', {
          received: connectionId,
          current: connection.connectionId
        });
        return;
      }

      const pc = connection.peerConnection;

      // Check current signaling state
      console.log('🔧 Current signaling state:', pc.signalingState);

      // Only process answer if we're in the right state
      if (pc.signalingState !== 'have-local-offer') {
        console.log('⚠️ Cannot process answer in current state:', pc.signalingState);
        return;
      }

      await pc.setRemoteDescription(new RTCSessionDescription(answer));
      console.log('✅ Remote description (answer) set');

      // Process queued ICE candidates
      await this.processQueuedIceCandidates(chatId);
    } catch (error) {
      console.error('❌ Error handling answer:', error);
    } finally {
      connection.isProcessingAnswer = false;
    }
  }

  private async handleIceCandidate(candidateData: RTCIceCandidateInit, from: string, chatId: string, connectionId?: string): Promise<void> {
    console.log('🧊 Handling ICE candidate from:', from, 'connectionId:', connectionId);

    const connection = this.connections.get(chatId);
    if (!connection) {
      console.log('❌ No connection found for ICE candidate');
      return;
    }

    // Validate connection ID if provided
    if (connectionId && connectionId !== connection.connectionId) {
      console.log('⚠️ ICE candidate for wrong connection session, ignoring:', {
        received: connectionId,
        current: connection.connectionId
      });
      return;
    }

    if (!connection.peerConnection) {
      console.log('📦 Queueing ICE candidate (no peer connection yet)');
      connection.queuedIceCandidates.push(candidateData);
      return;
    }

    // Check if remote description is set
    if (!connection.peerConnection.remoteDescription) {
      console.log('📦 Queueing ICE candidate (no remote description yet)');
      connection.queuedIceCandidates.push(candidateData);
      return;
    }

    try {
      const candidate = new RTCIceCandidate(candidateData);
      await connection.peerConnection.addIceCandidate(candidate);
      console.log('✅ ICE candidate added');
    } catch (error) {
      if (error instanceof DOMException && error.message.includes('Unknown ufrag')) {
        console.log('⚠️ ICE candidate for old session, ignoring:', error.message);
        return;
      }
      console.error('❌ Error adding ICE candidate:', error);

      // If remote description state changed, try queueing
      if (!connection.peerConnection.remoteDescription) {
        console.log('📦 Re-queueing ICE candidate due to state change');
        connection.queuedIceCandidates.push(candidateData);
      }
    }
  }

  private async processQueuedIceCandidates(chatId: string): Promise<void> {
    const connection = this.connections.get(chatId);
    if (!connection?.peerConnection || !connection.peerConnection.remoteDescription) {
      return;
    }

    console.log(`📦 Processing ${connection.queuedIceCandidates.length} queued ICE candidates`);

    const candidates = [...connection.queuedIceCandidates];
    connection.queuedIceCandidates = []; // Clear the queue

    for (const candidateData of candidates) {
      try {
        const candidate = new RTCIceCandidate(candidateData);
        await connection.peerConnection.addIceCandidate(candidate);
        console.log('✅ Queued ICE candidate added');
      } catch (error) {
        if (error instanceof DOMException && error.message.includes('Unknown ufrag')) {
          console.log('⚠️ Queued ICE candidate for old session, skipping');
        } else {
          console.error('❌ Error adding queued ICE candidate:', error);
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

    console.log('📢 Remote stream notification dispatched');
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
    console.log('🔧 Setting up test user:', userId);

    this.setUserCredentials(userId, 'fake-auth-token-for-testing');

    this.createConnection(testChatId)
      .then(() => {
        console.log('✅ Test connection created');
      })
      .catch(error => {
        console.error('❌ Test connection failed:', error);
      });

    return userId;
  }

  public cleanup(): void {
    console.log('🧹 Cleaning up video chat service...');

    for (const [, connection] of this.connections) {
      if (connection.peerConnection) {
        connection.peerConnection.close();
      }
    }

    this.connections.clear();
    this.currentUserId = null;
    this.authToken = null;

    console.log('✅ Cleanup completed');
  }
}

export const videoChatService = new VideoChatService();

// Export to window for debugging
if (typeof window !== 'undefined') {
  (window as unknown as Record<string, unknown>).videoChatService = videoChatService;
  console.log('🌐 VideoChatService exported to window.videoChatService');
}
