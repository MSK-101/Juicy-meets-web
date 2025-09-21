/**
 * VIDEO CHAT ADAPTER
 *
 * Allows switching between original and optimized implementations
 * Set NEXT_PUBLIC_USE_OPTIMIZED_FRONTEND=true to use optimized version
 */

// Check environment variable to determine which implementation to use
export const useOptimizedFrontend = (): boolean => {
  return process.env.NEXT_PUBLIC_USE_OPTIMIZED_FRONTEND === 'true';
};

// Export the appropriate services based on environment
export const getVideoChatService = () => {
  if (useOptimizedFrontend()) {
    // Use optimized service
    const { optimizedVideoChatService } = require('@/services/optimizedVideoChatService');
    return optimizedVideoChatService;
  } else {
    // Use original service
    const { cleanVideoChatService } = require('@/services/cleanVideoChatService');
    return cleanVideoChatService;
  }
};

export const getSwipeUtils = () => {
  if (useOptimizedFrontend()) {
    // Use optimized swipe utils
    return require('@/utils/optimizedSwipeUtils');
  } else {
    // Use original swipe utils
    return require('@/utils/swipeUtils');
  }
};

// Log which version is being used
if (typeof window !== 'undefined') {
}
