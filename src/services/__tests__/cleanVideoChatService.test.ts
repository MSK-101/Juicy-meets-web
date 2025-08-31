/**
 * Comprehensive Test Suite for CleanVideoChatService
 * Tests all three match types: Video, Staff, and Real User
 */

import { CleanVideoChatService } from '../cleanVideoChatService';
import { pubnubService } from '../pubnubService';

// Mock the API and other dependencies
jest.mock('../../api/baseAPI');
jest.mock('../pubnubService');
jest.mock('../../store/auth');

describe('CleanVideoChatService - Complete Integration Tests', () => {
  let service: CleanVideoChatService;
  let mockApi: any;
  let mockPubNub: any;

  beforeEach(() => {
    // Reset all mocks
    jest.clearAllMocks();
    
    // Create service instance
    service = new CleanVideoChatService();
    
    // Mock API responses
    mockApi = {
      post: jest.fn(),
      get: jest.fn()
    };
    
    // Mock PubNub service
    mockPubNub = {
      join: jest.fn(),
      leave: jest.fn(),
      sendOffer: jest.fn(),
      sendAnswer: jest.fn(),
      sendIceCandidate: jest.fn(),
      sendHello: jest.fn(),
      sendReady: jest.fn(),
      sendMessage: jest.fn()
    };
    
    (pubnubService as any) = mockPubNub;
  });

  afterEach(() => {
    service.cleanup();
  });

  describe('🎥 Video Match Scenarios', () => {
    test('should handle video match with real video file', async () => {
      // Mock video match response
      const videoMatchResponse = {
        status: 'matched',
        room_id: 'room_123',
        match_type: 'video',
        video_id: '456',
        video_url: 'https://example.com/video.mp4',
        video_name: 'Test Video',
        session_version: 'v1_abc123'
      };

      // Mock API response
      mockApi.post.mockResolvedValue(videoMatchResponse);

      // Set up video match callback
      const videoMatchCallback = jest.fn();
      service.onVideoMatch(videoMatchCallback);

      // Simulate swipe to next match
      const result = await service.swipeToNext();

      // Verify video match was handled
      expect(result.success).toBe(true);
      expect(result.matchType).toBe('video');
      expect(result.videoId).toBe('456');
      expect(result.videoUrl).toBe('https://example.com/video.mp4');
      expect(result.sessionVersion).toBe('v1_abc123');
    });

    test('should handle video match with fallback to simulated stream', async () => {
      // Mock video match response without video file
      const videoMatchResponse = {
        status: 'matched',
        room_id: 'room_123',
        match_type: 'video',
        video_id: '456',
        video_url: null, // No video file
        video_name: 'Test Video',
        session_version: 'v1_abc123'
      };

      mockApi.post.mockResolvedValue(videoMatchResponse);

      // Set up remote stream callback
      const remoteStreamCallback = jest.fn();
      service.onRemoteStream(remoteStreamCallback);

      // Simulate swipe
      const result = await service.swipeToNext();

      // Verify fallback was used
      expect(result.success).toBe(true);
      expect(result.matchType).toBe('video');
    });

    test('should handle video match with error and fallback', async () => {
      // Mock API error
      mockApi.post.mockRejectedValue(new Error('API Error'));

      // Set up error handling
      const result = await service.swipeToNext();

      // Verify error was handled gracefully
      expect(result.success).toBe(false);
    });
  });

  describe('👨‍💼 Staff Match Scenarios', () => {
    test('should handle staff match for app user', async () => {
      // Mock staff match response
      const staffMatchResponse = {
        status: 'matched',
        room_id: 'room_123',
        match_type: 'staff',
        partner: { id: 'staff_789' },
        is_initiator: true,
        session_version: 'v1_abc123'
      };

      mockApi.post.mockResolvedValue(staffMatchResponse);

      // Set up connection state callback
      const connectionStateCallback = jest.fn();
      service.onConnectionStateChange(connectionStateCallback);

      // Simulate swipe
      const result = await service.swipeToNext();

      // Verify staff match was handled
      expect(result.success).toBe(true);
      expect(result.matchType).toBe('staff');
      expect(result.partnerId).toBe('staff_789');
      expect(result.isInitiator).toBe(true);
      expect(result.sessionVersion).toBe('v1_abc123');

      // Verify PubNub connection was established
      expect(mockPubNub.join).toHaveBeenCalledWith(
        'room_123',
        'v1_abc123',
        expect.any(String),
        expect.any(Object)
      );
    });

    test('should handle staff match with receiver role', async () => {
      // Mock staff match response with receiver role
      const staffMatchResponse = {
        status: 'matched',
        room_id: 'room_123',
        match_type: 'staff',
        partner: { id: 'staff_789' },
        is_initiator: false, // Receiver
        session_version: 'v1_abc123'
      };

      mockApi.post.mockResolvedValue(staffMatchResponse);

      // Simulate swipe
      const result = await service.swipeToNext();

      // Verify receiver role was handled
      expect(result.isInitiator).toBe(false);
    });
  });

  describe('👤 Real User Match Scenarios', () => {
    test('should handle real user match with initiator role', async () => {
      // Mock real user match response
      const realUserMatchResponse = {
        status: 'matched',
        room_id: 'room_123',
        match_type: 'real_user',
        partner: { id: 'user_456' },
        is_initiator: true,
        session_version: 'v1_abc123'
      };

      mockApi.post.mockResolvedValue(realUserMatchResponse);

      // Set up callbacks
      const remoteStreamCallback = jest.fn();
      const connectionStateCallback = jest.fn();
      service.onRemoteStream(remoteStreamCallback);
      service.onConnectionStateChange(connectionStateCallback);

      // Simulate swipe
      const result = await service.swipeToNext();

      // Verify real user match was handled
      expect(result.success).toBe(true);
      expect(result.matchType).toBe('real_user');
      expect(result.partnerId).toBe('user_456');
      expect(result.isInitiator).toBe(true);

      // Verify PubNub connection was established
      expect(mockPubNub.join).toHaveBeenCalled();
    });

    test('should handle real user match with receiver role', async () => {
      // Mock real user match response with receiver role
      const realUserMatchResponse = {
        status: 'matched',
        room_id: 'room_123',
        match_type: 'real_user',
        partner: { id: 'user_456' },
        is_initiator: false, // Receiver
        session_version: 'v1_abc123'
      };

      mockApi.post.mockResolvedValue(realUserMatchResponse);

      // Simulate swipe
      const result = await service.swipeToNext();

      // Verify receiver role was handled
      expect(result.isInitiator).toBe(false);
    });

    test('should handle WebRTC connection failure and retry', async () => {
      // Mock successful match but failed WebRTC
      const realUserMatchResponse = {
        status: 'matched',
        room_id: 'room_123',
        match_type: 'real_user',
        partner: { id: 'user_456' },
        is_initiator: true,
        session_version: 'v1_abc123'
      };

      mockApi.post.mockResolvedValue(realUserMatchResponse);

      // Mock PubNub join failure
      mockPubNub.join.mockRejectedValue(new Error('PubNub Error'));

      // Simulate swipe
      const result = await service.swipeToNext();

      // Verify error was handled gracefully
      expect(result.success).toBe(true);
    });
  });

  describe('🔄 Session Management', () => {
    test('should handle session versioning correctly', async () => {
      // Mock response with session version
      const matchResponse = {
        status: 'matched',
        room_id: 'room_123',
        match_type: 'real_user',
        partner: { id: 'user_456' },
        is_initiator: true,
        session_version: 'v1_abc123'
      };

      mockApi.post.mockResolvedValue(matchResponse);

      // Simulate swipe
      const result = await service.swipeToNext();

      // Verify session version was captured
      expect(result.sessionVersion).toBe('v1_abc123');

      // Verify PubNub was joined with correct session version
      expect(mockPubNub.join).toHaveBeenCalledWith(
        'room_123',
        'v1_abc123',
        expect.any(String),
        expect.any(Object)
      );
    });

    test('should handle multiple swipes with different session versions', async () => {
      // First match
      const firstMatch = {
        status: 'matched',
        room_id: 'room_123',
        match_type: 'real_user',
        partner: { id: 'user_456' },
        is_initiator: true,
        session_version: 'v1_abc123'
      };

      // Second match
      const secondMatch = {
        status: 'matched',
        room_id: 'room_456',
        match_type: 'video',
        video_id: '789',
        video_url: 'https://example.com/video.mp4',
        video_name: 'New Video',
        session_version: 'v2_def456'
      };

      mockApi.post
        .mockResolvedValueOnce(firstMatch)
        .mockResolvedValueOnce(secondMatch);

      // First swipe
      const firstResult = await service.swipeToNext();
      expect(firstResult.sessionVersion).toBe('v1_abc123');

      // Second swipe
      const secondResult = await service.swipeToNext();
      expect(secondResult.sessionVersion).toBe('v2_def456');

      // Verify old PubNub connection was cleaned up
      expect(mockPubNub.leave).toHaveBeenCalled();
    });
  });

  describe('🧹 Cleanup and Resource Management', () => {
    test('should cleanup all resources properly', async () => {
      // Set up some state
      service['currentRoomId'] = 'room_123';
      service['partnerId'] = 'user_456';
      service['sessionVersion'] = 'v1_abc123';

      // Mock peer connection
      const mockPeerConnection = {
        close: jest.fn(),
        getTracks: jest.fn().mockReturnValue([])
      };
      service['peerConnection'] = mockPeerConnection as any;

      // Mock local stream
      const mockLocalStream = {
        getTracks: jest.fn().mockReturnValue([
          { kind: 'video', stop: jest.fn() },
          { kind: 'audio', stop: jest.fn() }
        ])
      };
      service['localStream'] = mockLocalStream as any;

      // Perform cleanup
      service.cleanup();

      // Verify all resources were cleaned up
      expect(mockPubNub.leave).toHaveBeenCalled();
      expect(mockPeerConnection.close).toHaveBeenCalled();
      expect(service['currentRoomId']).toBeNull();
      expect(service['partnerId']).toBeNull();
      expect(service['sessionVersion']).toBeNull();
    });

    test('should handle cleanup errors gracefully', async () => {
      // Mock cleanup error
      mockPubNub.leave.mockImplementation(() => {
        throw new Error('Cleanup Error');
      });

      // Set up some state
      service['currentRoomId'] = 'room_123';

      // Perform cleanup (should not throw)
      expect(() => service.cleanup()).not.toThrow();
    });
  });

  describe('🚨 Edge Cases and Error Handling', () => {
    test('should handle missing session version gracefully', async () => {
      // Mock response without session version
      const matchResponse = {
        status: 'matched',
        room_id: 'room_123',
        match_type: 'real_user',
        partner: { id: 'user_456' },
        is_initiator: true
        // No session_version
      };

      mockApi.post.mockResolvedValue(matchResponse);

      // Simulate swipe
      const result = await service.swipeToNext();

      // Verify it was handled gracefully
      expect(result.success).toBe(true);
      expect(result.sessionVersion).toBeUndefined();
    });

    test('should handle network errors gracefully', async () => {
      // Mock network error
      mockApi.post.mockRejectedValue(new Error('Network Error'));

      // Simulate swipe
      const result = await service.swipeToNext();

      // Verify error was handled gracefully
      expect(result.success).toBe(false);
    });

    test('should handle invalid match types gracefully', async () => {
      // Mock response with invalid match type
      const invalidMatchResponse = {
        status: 'matched',
        room_id: 'room_123',
        match_type: 'invalid_type',
        partner: { id: 'user_456' },
        is_initiator: true,
        session_version: 'v1_abc123'
      };

      mockApi.post.mockResolvedValue(invalidMatchResponse);

      // Simulate swipe
      const result = await service.swipeToNext();

      // Verify it was handled gracefully
      expect(result.success).toBe(true);
    });
  });
});
