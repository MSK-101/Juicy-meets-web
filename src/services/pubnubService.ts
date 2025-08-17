import PubNub from 'pubnub';

export interface ChatMessage {
  id: string;
  text: string;
  sender: string;
  timestamp: number;
  type: 'text' | 'webrtc-signal';
}

export interface WebRTCSignal {
  type: 'offer' | 'answer' | 'ice-candidate';
  data: RTCSessionDescriptionInit | RTCIceCandidateInit;
  from: string;
  to: string;
  chatId: string;
  connectionId?: string; // Connection session ID
}

interface PubNubPresenceEvent {
  action: 'join' | 'leave' | 'timeout' | 'state-change';
  channel: string;
  uuid: string;
  timestamp: number;
  occupancy: number;
}

interface PubNubMessageEvent {
  channel: string;
  subscription?: string;
  timetoken: string;
  message: unknown;
  publisher: string;
  uuid: string;
}

interface WebRTCMessage {
  type: 'offer' | 'answer' | 'ice-candidate';
  data: RTCSessionDescriptionInit | RTCIceCandidateInit;
  from: string;
  chatId: string;
  connectionId?: string;
}

interface PresenceSyncMessage {
  type: 'presence-sync' | 'presence-sync-request' | 'presence-sync-response';
  userId: string;
}

class PubNubService {
  private pubnub: PubNub | null = null;
  private currentUser: string | null = null;
  private currentChatId: string | null = null;
  private isClient: boolean = false;
  private isInitialized: boolean = false;
  private onlineUsers: Set<string> = new Set();
  private presenceCallbacks: ((users: string[]) => void)[] = [];

  constructor() {
    this.isClient = typeof window !== 'undefined';
    // Only initialize PubNub on client side
    if (this.isClient) {
      this.initializePubNub();
      this.isInitialized = true;
    }
  }

  private initializePubNub() {
    if (!this.isClient) return;

    try {
      const publishKey = process.env.NEXT_PUBLIC_PUBNUB_PUBLISH_KEY || '';
      const subscribeKey = process.env.NEXT_PUBLIC_PUBNUB_SUBSCRIBE_KEY || '';

      console.log('🔑 PubNub keys check:');
      console.log('  - Publish key length:', publishKey.length);
      console.log('  - Subscribe key length:', subscribeKey.length);
      console.log('  - Publish key starts with:', publishKey.substring(0, 10) + '...');
      console.log('  - Subscribe key starts with:', subscribeKey.substring(0, 10) + '...');

      if (!publishKey || !subscribeKey) {
        console.error('❌ PubNub keys are missing!');
        console.error('  - NEXT_PUBLIC_PUBNUB_PUBLISH_KEY:', publishKey ? 'Set' : 'Missing');
        console.error('  - NEXT_PUBLIC_PUBNUB_SUBSCRIBE_KEY:', subscribeKey ? 'Set' : 'Missing');
        return;
      }

      this.pubnub = new PubNub({
        publishKey: publishKey,
        subscribeKey: subscribeKey,
        uuid: `user-${Date.now()}`,
      });

      console.log('✅ PubNub instance created successfully');
    } catch (error) {
      console.error('💥 Failed to initialize PubNub:', error);
    }
  }

  async connect(userId: string, chatId: string): Promise<void> {
    if (!this.isClient || !this.isInitialized || !this.pubnub) {
      console.log('❌ PubNub not available on server side');
      return;
    }

    // Prevent duplicate connections for the same user to the same chat
    if (this.currentChatId === chatId && this.currentUser === userId) {
      console.log('🔄 PubNub: Already connected to this chat with this user');
      return;
    }

    // If connecting to a different chat or as a different user, allow it
    if (this.currentChatId && this.currentChatId !== chatId) {
      console.log('🔄 PubNub: Switching from chat', this.currentChatId, 'to', chatId);
    }

    if (this.currentUser && this.currentUser !== userId) {
      console.log('🔄 PubNub: Switching from user', this.currentUser, 'to', userId);
    }

    try {
      console.log('🔌 PubNub: Starting connection process...');
      console.log('🔌 PubNub: Current state before connection:');
      console.log('  - currentUser:', this.currentUser);
      console.log('  - currentChatId:', this.currentChatId);
      console.log('  - userId to connect:', userId);
      console.log('  - chatId to connect:', chatId);

      // Set the currentChatId FIRST before doing anything else
      this.currentChatId = chatId;
      this.currentUser = userId;

      console.log('🔌 PubNub: Set currentUser and currentChatId');
      console.log('  - currentUser:', this.currentUser);
      console.log('  - currentChatId:', this.currentChatId);

      // Set UUID for this user
      this.pubnub.setUUID(userId);

      // Subscribe to chat and presence channels
      const chatChannel = `chat-${chatId}`;
      const presenceChannel = `presence-${chatId}`;

      console.log('📡 PubNub: Subscribing to channels:', [chatChannel, presenceChannel]);

      await this.pubnub.subscribe({
        channels: [chatChannel, presenceChannel],
        channelGroups: [],
        withPresence: true
      });

      console.log('✅ PubNub: Subscribed to channels successfully');

      // Set presence state immediately after subscription
      console.log('👤 PubNub: Setting presence state for user:', userId);
      if (this.pubnub) {
        await this.pubnub.setState({
          state: { status: 'online', chatId: chatId, timestamp: Date.now() },
          channels: [presenceChannel]
        });
        console.log('✅ PubNub: Presence state set successfully');
      }

      // Wait for presence state to propagate
      await new Promise(resolve => setTimeout(resolve, 2000));
      console.log('⏳ Waited for presence state propagation');

      // Add current user to local tracking
      this.onlineUsers.add(userId);
      console.log('✅ PubNub connection completed successfully');
      console.log('🔍 PubNub: Final state after connection:');
      console.log('  - currentUser:', this.currentUser);
      console.log('  - currentChatId:', this.currentChatId);
      console.log('  - onlineUsers:', Array.from(this.onlineUsers));

      // Set up presence listener
      if (this.pubnub) {
        this.pubnub.addListener({
          presence: (presenceEvent: PubNubPresenceEvent) => {
            console.log('👥 Presence event details:', presenceEvent);

            if (presenceEvent.action === 'state-change') {
              console.log('🔄 User state changed in channel:', presenceEvent.channel);

              // Update local tracking
              if (presenceEvent.uuid && presenceEvent.uuid !== this.currentUser) {
                this.onlineUsers.add(presenceEvent.uuid);
                console.log('➕ Added user to online list:', presenceEvent.uuid);
              }
            } else if (presenceEvent.action === 'join') {
              console.log('👋 User joined:', presenceEvent.uuid);
              if (presenceEvent.uuid !== this.currentUser) {
                this.onlineUsers.add(presenceEvent.uuid);
              }
            } else if (presenceEvent.action === 'leave') {
              console.log('👋 User left:', presenceEvent.uuid);
              this.onlineUsers.delete(presenceEvent.uuid);
            } else if (presenceEvent.action === 'timeout') {
              console.log('⏰ User timed out:', presenceEvent.uuid);
              this.onlineUsers.delete(presenceEvent.uuid);
            }

            // Notify subscribers of presence change
            this.notifyPresenceChange();
          },
          message: (messageEvent: PubNubMessageEvent) => {
            console.log('📨 PubNub message received:', messageEvent);
            const message = messageEvent.message as WebRTCMessage | PresenceSyncMessage | unknown;

            console.log('📨 Message details:', {
              channel: messageEvent.channel,
              messageType: (message as WebRTCMessage | PresenceSyncMessage)?.type,
              currentUser: this.currentUser,
              currentChatId: this.currentChatId
            });

            // Skip WebRTC signals - they're handled by the WebRTC signal listener
            if (message && typeof message === 'object' && 'type' in message) {
              const typedMessage = message as WebRTCMessage | PresenceSyncMessage;
              if (typedMessage.type === 'offer' ||
                  typedMessage.type === 'answer' ||
                  typedMessage.type === 'ice-candidate') {
                console.log('🔄 Skipping WebRTC signal - handled by WebRTC listener');
                return;
              }
            }

            // Handle presence sync messages
            const msg = messageEvent.message as any;
            if (messageEvent.channel === presenceChannel && msg?.type === 'presence-sync') {
              const syncUserId = msg.userId;
              console.log('🔄 Processing presence sync message from user:', syncUserId);
              if (syncUserId && syncUserId !== this.currentUser) {
                console.log('🔄 Presence sync message from user:', syncUserId);
                this.onlineUsers.add(syncUserId);
                console.log('➕ Added user to online list via sync:', syncUserId);
                console.log('👥 Updated online users:', Array.from(this.onlineUsers));
                this.notifyPresenceChange();
              } else {
                console.log('⚠️ Ignoring sync message from self or invalid user');
              }
            }

            // Handle presence sync requests
            if (messageEvent.channel === presenceChannel && msg?.type === 'presence-sync-request') {
              const requestUserId = msg.userId;
              console.log('🔄 Processing presence sync request from user:', requestUserId);

              if (requestUserId && requestUserId !== this.currentUser) {
                console.log('🔄 Responding to presence sync request from:', requestUserId);

                // Send our presence info back to the requesting user
                if (this.pubnub) {
                  this.pubnub.publish({
                    channel: presenceChannel,
                    message: {
                      type: 'presence-sync-response',
                      userId: this.currentUser,
                      chatId: this.currentChatId,
                      timestamp: Date.now()
                    }
                  }).then(() => {
                    console.log('✅ Sent presence sync response to:', requestUserId);

                    // Also add the requesting user to our list
                    this.onlineUsers.add(requestUserId);
                    console.log('➕ Added requesting user to online list:', requestUserId);
                    this.notifyPresenceChange();
                  }).catch((error) => {
                    console.error('❌ Error sending presence sync response:', error);
                  });
                }
              }
            }

            // Handle presence sync responses
            if (messageEvent.channel === presenceChannel && msg?.type === 'presence-sync-response') {
              const responseUserId = msg.userId;
              console.log('🔄 Processing presence sync response from user:', responseUserId);

              if (responseUserId && responseUserId !== this.currentUser) {
                console.log('🔄 Presence sync response from user:', responseUserId);
                this.onlineUsers.add(responseUserId);
                console.log('➕ Added user to online list via sync response:', responseUserId);
                console.log('👥 Updated online users:', Array.from(this.onlineUsers));
                this.notifyPresenceChange();
              }
            }

            // Handle presence announce messages
            if (messageEvent.channel === presenceChannel && msg?.type === 'presence-announce') {
              const announceUserId = msg.userId;
              console.log('📢 Processing presence announce message from user:', announceUserId);
              if (announceUserId && announceUserId !== this.currentUser) {
                console.log('📢 Presence announce from user:', announceUserId);
                this.onlineUsers.add(announceUserId);
                console.log('➕ Added user to online list via announce:', announceUserId);
                console.log('👥 Updated online users:', Array.from(this.onlineUsers));
                this.notifyPresenceChange();
              } else {
                console.log('⚠️ Ignoring announce message from self or invalid user');
              }
            }
          }
        });
      }

      // Announce presence to other users
      await this.announcePresence();

    } catch (error) {
      console.error('💥 Error connecting to PubNub:', error);
      // Reset state on error
      this.currentUser = null;
      this.currentChatId = null;
      throw error;
    }
  }

  disconnect() {
    if (!this.isClient || !this.isInitialized || !this.pubnub || !this.currentChatId) return;

    // Set offline status
    this.pubnub.setState({
      channels: [this.getPresenceChannel(this.currentChatId)],
      state: {
        status: 'offline',
        lastSeen: Date.now(),
      },
    });

    // Unsubscribe from channels
    this.pubnub.unsubscribe({
      channels: [this.getChatChannel(this.currentChatId), this.getPresenceChannel(this.currentChatId)],
    });

    this.currentUser = null;
    this.currentChatId = null;
  }

  // Send chat message
  async sendMessage(text: string): Promise<void> {
    if (!this.isClient || !this.isInitialized) {
      console.log('PubNub not available on server side');
      return;
    }

    if (!this.pubnub || !this.currentChatId || !this.currentUser) {
      throw new Error('Not connected to chat');
    }

    const message: ChatMessage = {
      id: `${Date.now()}-${Math.random()}`,
      text,
      sender: this.currentUser,
      timestamp: Date.now(),
      type: 'text',
    };

    await this.pubnub.publish({
      channel: this.getChatChannel(this.currentChatId),
      message,
    });
  }

  // Send WebRTC signal via PubNub
  sendWebRTCSignal(signal: WebRTCSignal) {
    if (!this.isClient || !this.isInitialized || !this.pubnub || !this.currentChatId) {
      console.log('PubNub not available for sending WebRTC signal');
      return;
    }

    try {
      // Check if we're subscribed to the channel
      const channel = this.getChatChannel(signal.chatId);
      const subscribedChannels = this.pubnub.getSubscribedChannels();

      if (!subscribedChannels.includes(channel)) {
        console.log('⚠️ Not subscribed to channel:', channel);
        console.log('📡 Subscribed channels:', subscribedChannels);
        return;
      }

      // Format message for WebRTC signaling
      const message = {
        type: signal.type,
        data: signal.data,
        from: signal.from,
        chatId: signal.chatId
      };

      console.log('📤 PubNub: Sending WebRTC signal to channel:', channel);
      console.log('📤 Message content:', message);
      console.log('📤 Signal type:', signal.type);
      console.log('📤 From user:', signal.from);

      this.pubnub.publish({
        channel: channel,
        message: message,
      }).then((result) => {
        console.log('✅ PubNub WebRTC signal sent successfully:', result);
        console.log('✅ Sent to channel:', channel);
      }).catch((error) => {
        console.error('❌ PubNub publish error:', error);
        console.error('❌ Error details:', {
          status: error.status,
          message: error.message,
          details: error.details
        });
      });

    } catch (error) {
      console.error('💥 Error in sendWebRTCSignal:', error);
    }
  }

  // Listen to messages
  onMessage(callback: (message: unknown) => void) {
    if (!this.isClient || !this.isInitialized || !this.pubnub) {
      return () => {};
    }

    const listener = {
      message: (event: PubNubMessageEvent) => {
        console.log('📨 PubNub message received:', event);
        // Pass the entire message to the callback
        callback(event.message);
      },
    };

    this.pubnub.addListener(listener);
    return () => this.pubnub?.removeListener(listener);
  }

  // Listen to WebRTC signals
  onWebRTCSignal(callback: (signal: WebRTCSignal) => void) {
    if (!this.isClient || !this.isInitialized || !this.pubnub) {
      return () => {};
    }

    const listener = {
      message: (event: PubNubMessageEvent) => {
        console.log('🔗 PubNub WebRTC signal received on channel:', event.channel);
        console.log('🔍 Message content:', event.message);
        const message = event.message as WebRTCMessage | unknown;

        console.log('🔍 Message type check:', {
          hasMessage: !!message,
          messageType: message && typeof message === 'object' && 'type' in message ? (message as WebRTCMessage).type : 'unknown'
        });

        if (message && typeof message === 'object' && 'type' in message && 'data' in message) {
          const webrtcMessage = message as WebRTCMessage;
          if (webrtcMessage.type === 'offer' || webrtcMessage.type === 'answer' || webrtcMessage.type === 'ice-candidate') {
            console.log('✅ Processing WebRTC signal:', webrtcMessage.type);
            callback(webrtcMessage as WebRTCSignal);
          } else {
            console.log('⚠️ Unknown WebRTC message type:', webrtcMessage.type);
          }
        } else {
          console.log('⚠️ Ignoring non-WebRTC message or invalid structure');
        }
      },
    };

    this.pubnub.addListener(listener);
    return () => this.pubnub?.removeListener(listener);
  }

  // Get online users in chat
  async getOnlineUsers(): Promise<string[]> {
    // Multiple safety checks to prevent SSR errors
    if (!this.isClient || !this.isInitialized || !this.pubnub) {
      console.log('❌ PubNub getOnlineUsers: Service not ready');
      console.log('  - isClient:', this.isClient);
      console.log('  - isInitialized:', this.isInitialized);
      console.log('  - pubnub instance:', !!this.pubnub);
      return [];
    }

    // Check if currentChatId is set
    if (!this.currentChatId) {
      console.log('❌ PubNub getOnlineUsers: currentChatId not set');
      console.log('  - currentChatId:', this.currentChatId);
      console.log('  - currentUser:', this.currentUser);
      return [];
    }

    // Additional check to ensure we're actually connected
    if (!this.pubnub.getSubscribedChannels().length) {
      console.log('❌ PubNub getOnlineUsers: No subscribed channels');
      return [];
    }

    console.log('🔍 PubNub: Getting online users for chat:', this.currentChatId);
    console.log('📡 Subscribed channels:', this.pubnub.getSubscribedChannels());

    // Use local tracking as primary source
    const localUsers = Array.from(this.onlineUsers);
    console.log('👥 Local online users tracking:', localUsers);

    // If we have other users locally, return them
    if (localUsers.length > 1) {
      console.log('✅ Multiple users found in local tracking');
      return localUsers;
    }

    // If only self, try to discover other users
    if (localUsers.length === 1 && localUsers[0] === this.currentUser) {
      console.log('🔍 Only self detected, trying to discover other users...');

      // Trigger a presence sync to discover other users
      try {
        await this.forcePresenceSync();

        // Wait a bit for responses
        await new Promise(resolve => setTimeout(resolve, 2000));

        // Check local tracking again
        const updatedLocalUsers = Array.from(this.onlineUsers);
        console.log('👥 Updated local users after sync:', updatedLocalUsers);

        if (updatedLocalUsers.length > 1) {
          console.log('✅ Other users discovered via presence sync');
          return updatedLocalUsers;
        }
      } catch (error) {
        console.log('⚠️ Presence sync failed:', error);
      }
    }

    // Fallback to hereNow() as last resort
    try {
      const presenceChannel = `presence-${this.currentChatId}`;
      console.log('🔍 Checking presence channel:', presenceChannel);

      const hereNowResult = await this.pubnub.hereNow({
        channels: [presenceChannel],
        includeState: true,
      });

      console.log('📊 PubNub hereNow result:', hereNowResult);

      if (hereNowResult.channels && hereNowResult.channels[presenceChannel]) {
        const channel = hereNowResult.channels[presenceChannel];
        const hereNowUsers = Object.keys(channel.occupants || {});

        console.log('👥 Actual online users from PubNub:', hereNowUsers);
        console.log('👥 Channel occupancy:', channel.occupancy);

        // Merge local and hereNow users, removing duplicates
        const allUsers = new Set([...localUsers, ...hereNowUsers]);
        const mergedUsers = Array.from(allUsers);

        console.log('🔗 Merged online users (local + PubNub):', mergedUsers);
        return mergedUsers;
      } else {
        console.log('⚠️ No channel data in hereNow result, using local tracking');
        console.log('🔍 Available channels:', Object.keys(hereNowResult.channels || {}));
        return localUsers;
      }
    } catch (error) {
      console.error('💥 Error calling PubNub hereNow:', error);
      // Fallback to local tracking
      console.log('🔄 Falling back to local online users');
      return localUsers;
    }
  }

  // Check for other users in the chat room
  private checkForOtherUsers(chatId: string) {
    if (!this.pubnub || !this.currentChatId) return;

    try {
      // Try to get users from the presence channel
      this.pubnub.hereNow({
        channels: [this.getPresenceChannel(chatId)],
        includeState: true,
      }).then((result) => {
        console.log('🔍 Periodic presence check result:', result);

        if (result.channels && result.channels[this.getPresenceChannel(chatId)]) {
          const channel = result.channels[this.getPresenceChannel(chatId)];
          const users = Object.keys(channel.occupants || {});

          console.log('👥 Found users in periodic check:', users);

          // Add any new users we found
          users.forEach(userId => {
            if (userId !== this.currentUser) {
              this.onlineUsers.add(userId);
              console.log('➕ Added user to online users:', userId);
            }
          });

          if (users.length > 0) {
            this.notifyPresenceChange();
          }
        }
      }).catch((error) => {
        console.log('⚠️ Periodic presence check failed:', error);
      });
    } catch (error) {
      console.log('⚠️ Error in periodic presence check:', error);
    }
  }

  // Notify presence change callbacks
  notifyPresenceChange(): void {
    if (!this.isClient || !this.isInitialized) return;

    const currentUsers = Array.from(this.onlineUsers);
    console.log('🔄 Notifying presence change, online users:', currentUsers);

    // Call all registered callbacks
    this.presenceCallbacks.forEach(callback => {
      try {
        callback(currentUsers);
      } catch (error) {
        console.error('💥 Error in presence change callback:', error);
      }
    });

    // Also dispatch a custom event for immediate notification
    if (typeof window !== 'undefined') {
      const event = new CustomEvent('pubnub-presence-change', {
        detail: { onlineUsers: currentUsers, chatId: this.currentChatId }
      });
      window.dispatchEvent(event);
    }
  }

  // Listen to presence changes
  onPresenceChange(callback: (presence: string[] | { onlineUsers: string[]; chatId: string }) => void) {
    if (!this.isClient || !this.isInitialized || !this.pubnub) {
      return () => {};
    }

    this.presenceCallbacks.push(callback);

    const listener = {
      presence: (event: Record<string, unknown>) => {
        console.log('🔗 PubNub presence event received:', event);

        // Extract user IDs from PubNub presence event
        let userIds: string[] = [];

        if (event.occupancy && event.occupants) {
          // This is a presence event with occupancy info
          const occupants = event.occupants as Record<string, unknown>;
          userIds = Object.keys(occupants);
        } else if (event.uuid) {
          // This is a single user presence event
          userIds = [event.uuid as string];
        }

        // Call the callback with consistent format
        if (userIds.length > 0) {
          callback(userIds);
        }
      },
    };

    this.pubnub.addListener(listener);
    return () => {
      this.pubnub?.removeListener(listener);
      // Remove callback
      const index = this.presenceCallbacks.indexOf(callback);
      if (index > -1) {
        this.presenceCallbacks.splice(index, 1);
      }
    };
  }

  // Manually trigger presence update to ensure visibility
  async triggerPresenceUpdate(): Promise<void> {
    if (!this.isClient || !this.isInitialized || !this.pubnub || !this.currentChatId || !this.currentUser) {
      return;
    }

    try {
      const presenceChannel = `presence-${this.currentChatId}`;

      // Force a presence state update
      await this.pubnub.setState({
        state: {
          status: 'online',
          chatId: this.currentChatId,
          timestamp: Date.now(),
          lastUpdate: Date.now()
        },
        channels: [presenceChannel]
      });

      console.log('🔄 Manual presence update triggered for user:', this.currentUser);

      // Wait a bit for the update to propagate
      await new Promise(resolve => setTimeout(resolve, 1000));

      // Check if we're now visible
      const hereNowResult = await this.pubnub.hereNow({
        channels: [presenceChannel],
        includeState: true,
      });

      if (hereNowResult.channels && hereNowResult.channels[presenceChannel]) {
        const channel = hereNowResult.channels[presenceChannel];
        console.log('✅ Presence update result - Channel occupancy:', channel.occupancy);
        console.log('✅ Presence update result - Channel occupants:', Object.keys(channel.occupants || {}));
      }
    } catch (error) {
      console.error('💥 Error triggering presence update:', error);
    }
  }

  // Force presence sync to discover other users
  async forcePresenceSync(): Promise<void> {
    if (!this.isClient || !this.isInitialized || !this.pubnub || !this.currentUser || !this.currentChatId) {
      console.log('❌ Cannot force presence sync - service not ready');
      return;
    }

    try {
      const presenceChannel = `presence-${this.currentChatId}`;
      console.log('🔄 Forcing presence sync...');

      // Send sync request
      await this.pubnub.publish({
        channel: presenceChannel,
        message: {
          type: 'presence-sync-request',
          userId: this.currentUser,
          chatId: this.currentChatId,
          timestamp: Date.now()
        }
      });

      console.log('✅ Presence sync request sent');

      // Wait for responses
      await new Promise(resolve => setTimeout(resolve, 2000));

      // Check hereNow again
      const hereNowResult = await this.pubnub.hereNow({
        channels: [presenceChannel],
        includeState: true
      });

      console.log('📊 HereNow after sync:', hereNowResult);

      if (hereNowResult.channels && hereNowResult.channels[presenceChannel]) {
        const channel = hereNowResult.channels[presenceChannel];
        const hereNowUsers = Object.keys(channel.occupants || {});

        console.log('👥 Users from hereNow after sync:', hereNowUsers);

        // Add all users from hereNow to local tracking
        hereNowUsers.forEach(userId => {
          if (userId !== this.currentUser) {
            this.onlineUsers.add(userId);
            console.log('➕ Added user from hereNow:', userId);
          }
        });
      }

    } catch (error) {
      console.error('❌ Error forcing presence sync:', error);
    }
  }

  // Announce presence to other users
  async announcePresence(): Promise<void> {
    if (!this.isClient || !this.isInitialized || !this.pubnub || !this.currentUser || !this.currentChatId) {
      console.log('❌ Cannot announce presence - service not ready');
      return;
    }

    try {
      const presenceChannel = `presence-${this.currentChatId}`;
      console.log('📢 Announcing presence to channel:', presenceChannel);

      // Send presence announce message
      await this.pubnub.publish({
        channel: presenceChannel,
        message: {
          type: 'presence-announce',
          userId: this.currentUser,
          chatId: this.currentChatId,
          timestamp: Date.now()
        }
      });

      console.log('✅ Presence announced successfully');

      // Also send presence sync request to discover other users
      await this.pubnub.publish({
        channel: presenceChannel,
        message: {
          type: 'presence-sync-request',
          userId: this.currentUser,
          chatId: this.currentChatId,
          timestamp: Date.now()
        }
      });

      console.log('✅ Presence sync request sent');

    } catch (error) {
      console.error('❌ Error announcing presence:', error);
    }
  }

  // Test method to check if presence system is working
  async testPresenceSystem(): Promise<void> {
    if (!this.isClient || !this.isInitialized || !this.pubnub || !this.currentChatId || !this.currentUser) {
      console.log('❌ Cannot test presence system - missing required properties');
      return;
    }

    try {
      const presenceChannel = `presence-${this.currentChatId}`;
      console.log('🧪 Testing presence system...');
      console.log('🧪 Current user:', this.currentUser);
      console.log('🧪 Current chat ID:', this.currentChatId);
      console.log('🧪 Presence channel:', presenceChannel);
      console.log('🧪 Local online users:', Array.from(this.onlineUsers));
      console.log('🧪 Subscribed channels:', this.pubnub.getSubscribedChannels());

      // Try to publish a test message
      const testResult = await this.pubnub.publish({
        channel: presenceChannel,
        message: {
          type: 'test-message',
          userId: this.currentUser,
          timestamp: Date.now(),
          test: true
        }
      });

      console.log('🧪 Test message published:', testResult);

      // Check hereNow
      const hereNowResult = await this.pubnub.hereNow({
        channels: [presenceChannel],
        includeState: true,
      });

      console.log('🧪 HereNow result:', hereNowResult);

    } catch (error) {
      console.error('💥 Error testing presence system:', error);
    }
  }

  private getChatChannel(chatId: string): string {
    return `chat-${chatId}`;
  }

  private getPresenceChannel(chatId: string): string {
    return `presence-${chatId}`;
  }

  // Check if running on client side
  isClientSide(): boolean {
    return this.isClient && this.isInitialized;
  }
}

export const pubnubService = new PubNubService();
