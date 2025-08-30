import { cleanVideoChatService } from "@/services/cleanVideoChatService";
import { coinDeductionService } from "@/services/coinDeductionService";

export const nextSwipe = async (
  setConnectionState: (state: 'disconnected' | 'connecting' | 'connected' | 'failed') => void,
  setError: (error: string | null) => void,
  setIsVideoPlaying: (playing: boolean) => void,
  setCurrentVideoId: (id: string | null) => void,
  setCurrentVideoUrl: (url: string | null) => void,
  setCurrentVideoName: (name: string | null) => void,
  setMessages: (messages: any[]) => void
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
