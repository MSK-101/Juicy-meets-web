import { optimizedVideoChatService } from "@/services/optimizedVideoChatService";
import { coinDeductionService } from "@/services/coinDeductionService";
import { ChatMessage } from "@/components/ChatMessageContainer";

export interface SwipeResult {
  success: boolean;
  matchType?: 'video' | 'real_user' | 'staff';
  videoId?: string;
  videoUrl?: string;
  videoName?: string;
  updatedUserInfo?: {
    sequence_id: number;
    videos_watched_in_current_sequence: number;
    sequence_total_videos: number;
    pool_id?: number;
  };
  swipe_deduction?: {
    success: boolean;
    deducted: number;
    new_balance: number;
    error?: string;
  };
  error?: Error;
}

/**
 * Optimized swipe function with minimal logging and faster room transitions
 */
export const optimizedNextSwipe = async (
  setConnectionState: (state: 'disconnected' | 'connecting' | 'connected' | 'failed') => void,
  setError: (error: string | null) => void,
  setIsVideoPlaying: (playing: boolean) => void,
  setCurrentVideoId: (id: string | null) => void,
  setCurrentVideoUrl: (url: string | null) => void,
  setCurrentVideoName: (name: string | null) => void,
  setMessages: (messages: ChatMessage[]) => void,
  setRemoteStream?: (stream: MediaStream | null) => void
): Promise<SwipeResult> => {
  // Immediate UI feedback for faster perceived performance
  setConnectionState('connecting');
  setError(null);

  try {
    // Clean up current state immediately for instant feedback
    await cleanCurrentState(
      setIsVideoPlaying,
      setCurrentVideoId,
      setCurrentVideoUrl,
      setCurrentVideoName,
      setMessages,
      setRemoteStream
    );

    // Stop previous tracking
    coinDeductionService.stopChatDurationTracking();

    // Perform the swipe operation
    await optimizedVideoChatService.swipeNext();

    // The optimized service will handle match results via callbacks
    // Return basic success result
    return {
      success: true,
      matchType: 'real_user' // Will be updated via callbacks
    };

  } catch (error) {
    // Show error briefly then auto-retry
    const errorMessage = error instanceof Error ? error.message : 'Failed to find next match';

    setTimeout(() => {
      setError(errorMessage);
      setConnectionState('failed');

      // Auto-retry after a brief delay
      setTimeout(() => {
        optimizedNextSwipe(
          setConnectionState,
          setError,
          setIsVideoPlaying,
          setCurrentVideoId,
          setCurrentVideoUrl,
          setCurrentVideoName,
          setMessages,
          setRemoteStream
        );
      }, 3000);
    }, 1000);

    return {
      success: false,
      error: error instanceof Error ? error : new Error('Unknown error')
    };
  }
};

/**
 * Clean current state for fast room transitions
 */
async function cleanCurrentState(
  setIsVideoPlaying: (playing: boolean) => void,
  setCurrentVideoId: (id: string | null) => void,
  setCurrentVideoUrl: (url: string | null) => void,
  setCurrentVideoName: (name: string | null) => void,
  setMessages: (messages: ChatMessage[]) => void,
  setRemoteStream?: (stream: MediaStream | null) => void
): Promise<void> {
  // Clear UI state in parallel for faster cleanup
  await Promise.all([
    // Clear video state
    Promise.resolve().then(() => {
      setIsVideoPlaying(false);
      setCurrentVideoId(null);
      setCurrentVideoUrl(null);
      setCurrentVideoName(null);
    }),

    // Clear chat state
    Promise.resolve().then(() => {
      setMessages([]);
    }),

    // Clear remote stream
    setRemoteStream ? Promise.resolve().then(() => {
      setRemoteStream(null);
    }) : Promise.resolve()
  ]);
}

/**
 * Legacy wrapper for compatibility with existing code
 */
export const nextSwipe = optimizedNextSwipe;
