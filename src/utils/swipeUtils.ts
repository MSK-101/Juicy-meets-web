import { cleanVideoChatService } from "@/services/cleanVideoChatService";
import { coinDeductionService } from "@/services/coinDeductionService";
import { ChatMessage } from "@/components/ChatMessageContainer";

export const nextSwipe = async (
  setConnectionState: (state: 'disconnected' | 'connecting' | 'connected' | 'failed') => void,
  setError: (error: string | null) => void,
  setIsVideoPlaying: (playing: boolean) => void,
  setCurrentVideoId: (id: string | null) => void,
  setCurrentVideoUrl: (url: string | null) => void,
  setCurrentVideoName: (name: string | null) => void,
  setMessages: (messages: ChatMessage[]) => void
) => {
  // Show loading immediately for instant feedback
  setConnectionState('connecting');
  setError(null);

  try {
    // Clear left screen immediately and show loading
    setIsVideoPlaying(false);
    setCurrentVideoId(null);
    setCurrentVideoUrl(null);
    setCurrentVideoName(null);
    setMessages([]); // Clear messages for new match

    // Stop previous tracking
    coinDeductionService.stopChatDurationTracking();

    const result = await cleanVideoChatService.swipeToNext();
    console.log('🔄 Swipe result:', result);

    // Handle updated user info if provided
    if (result.updatedUserInfo) {
      console.log('🔍 Updating user info from swipe result:', result.updatedUserInfo);

      // Import and update auth store
      const { useAuthStore } = await import('../store/auth');
      const authStore = useAuthStore.getState();

      authStore.setSequenceInfo(
        result.updatedUserInfo.sequence_id,
        result.updatedUserInfo.videos_watched_in_current_sequence,
        result.updatedUserInfo.sequence_total_videos
      );

      if (result.updatedUserInfo.pool_id) {
        authStore.setPoolId(result.updatedUserInfo.pool_id);
      }

      console.log('✅ Auth store updated with new sequence info from swipe');
    }

    if (result.success) {
      if (result.matchType === 'video') {
        // Handle video match - show video player
        setConnectionState('connected');
        setError(null);
        setIsVideoPlaying(true);
        setCurrentVideoId(result.videoId || 'video-' + Date.now());
        setCurrentVideoUrl(result.videoUrl || null);
        setCurrentVideoName(result.videoName || null);

        // Start new tracking for video
        coinDeductionService.startChatDurationTracking();
      } else if (result.matchType === 'staff') {
        // Handle staff match - start WebRTC
        setConnectionState('connecting');
        setError(null);
        // Staff will connect via WebRTC
      } else if (result.matchType === 'real_user') {
        // Handle real user match - start WebRTC
        setConnectionState('connecting');
        setError(null);
        // Real user will connect via WebRTC
      } else {
        // Handle any other match type
        setConnectionState('connecting');
        setError(null);
      }
    } else {
      // Only show disconnected state if no match is found
      // Keep connecting state for a moment to show loading
      setTimeout(() => {
        setConnectionState('disconnected');
        setError('No match found');
      }, 2000); // Show loading for 2 seconds before showing "No match found"
    }
  } catch {
    // Keep connecting state for a moment to show loading
    setTimeout(() => {
      setError('Failed to find next match');
      setConnectionState('failed');
    }, 2000); // Show loading for 2 seconds before showing error
  }
};
