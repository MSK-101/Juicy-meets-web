'use client';

import React, { useRef, useEffect, useState } from 'react';

interface OptimizedVideoPlayerProps {
  videoUrl: string;
  videoName?: string;
  onVideoEnd?: () => void;
  onVideoError?: (error: string) => void;
  className?: string;
}

/**
 * Optimized Video Player Component
 * - Fast loading with preload optimization
 * - Error handling and fallbacks
 * - Minimal UI for performance
 */
export const OptimizedVideoPlayer: React.FC<OptimizedVideoPlayerProps> = ({
  videoUrl,
  videoName,
  onVideoEnd,
  onVideoError,
  className = "w-full h-full"
}) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [hasError, setHasError] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);

  useEffect(() => {
    const video = videoRef.current;
    if (!video || !videoUrl) return;

    setIsLoading(true);
    setHasError(false);

    // Set up video source
    video.src = videoUrl;
    video.load();

    const handleLoadedData = () => {
      setIsLoading(false);
      setDuration(video.duration);
    };

    const handleError = (e: Event) => {
      setIsLoading(false);
      setHasError(true);
      const errorMessage = `Video loading failed: ${video.error?.message || 'Unknown error'}`;
      if (onVideoError) {
        onVideoError(errorMessage);
      }
    };

    const handleTimeUpdate = () => {
      setCurrentTime(video.currentTime);
    };

    const handleEnded = () => {
      if (onVideoEnd) {
        onVideoEnd();
      }
    };

    const handleCanPlay = () => {
      // Auto-play when ready (muted to avoid browser restrictions)
      video.play().catch((error) => {
      });
    };

    // Add event listeners
    video.addEventListener('loadeddata', handleLoadedData);
    video.addEventListener('error', handleError);
    video.addEventListener('timeupdate', handleTimeUpdate);
    video.addEventListener('ended', handleEnded);
    video.addEventListener('canplay', handleCanPlay);

    // Cleanup
    return () => {
      video.removeEventListener('loadeddata', handleLoadedData);
      video.removeEventListener('error', handleError);
      video.removeEventListener('timeupdate', handleTimeUpdate);
      video.removeEventListener('ended', handleEnded);
      video.removeEventListener('canplay', handleCanPlay);
    };
  }, [videoUrl, onVideoEnd, onVideoError]);

  const formatTime = (time: number): string => {
    const minutes = Math.floor(time / 60);
    const seconds = Math.floor(time % 60);
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
  };

  const handleProgressClick = (e: React.MouseEvent<HTMLDivElement>) => {
    const video = videoRef.current;
    if (!video || !duration) return;

    const rect = e.currentTarget.getBoundingClientRect();
    const clickX = e.clientX - rect.left;
    const width = rect.width;
    const newTime = (clickX / width) * duration;

    video.currentTime = newTime;
  };

  if (hasError) {
    return (
      <div className={`${className} bg-black flex items-center justify-center rounded-lg`}>
        <div className="text-white text-center">
          <div className="text-6xl mb-4">❌</div>
          <p className="text-lg">Video failed to load</p>
          <p className="text-sm opacity-75 mt-2">Please try the next match</p>
        </div>
      </div>
    );
  }

  return (
    <div className={`${className} relative bg-black rounded-lg overflow-hidden group`}>
      {/* Video element */}
      <video
        ref={videoRef}
        className="w-full h-full object-cover"
        playsInline
        preload="metadata"
        muted={false} // Allow sound for video content
        controls={false} // Custom controls for better UX
      />

      {/* Loading overlay */}
      {isLoading && (
        <div className="absolute inset-0 bg-black bg-opacity-75 flex items-center justify-center">
          <div className="text-white text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-white mb-4 mx-auto"></div>
            <p>Loading video...</p>
          </div>
        </div>
      )}

      {/* Video title overlay */}
      {videoName && !isLoading && (
        <div className="absolute top-4 left-4 bg-black bg-opacity-75 text-white px-3 py-1 rounded transition-opacity group-hover:opacity-100 opacity-75">
          <p className="text-sm font-medium">{videoName}</p>
        </div>
      )}

      {/* Custom video controls */}
      {!isLoading && !hasError && (
        <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black to-transparent p-4 transition-opacity group-hover:opacity-100 opacity-0">
          {/* Progress bar */}
          <div className="mb-3">
            <div
              className="w-full h-2 bg-gray-600 rounded-full cursor-pointer"
              onClick={handleProgressClick}
            >
              <div
                className="h-full bg-white rounded-full transition-all duration-300"
                style={{ width: duration ? `${(currentTime / duration) * 100}%` : '0%' }}
              />
            </div>
          </div>

          {/* Control buttons and time */}
          <div className="flex items-center justify-between text-white">
            <div className="flex items-center gap-3">
              <button
                onClick={() => {
                  const video = videoRef.current;
                  if (video) {
                    if (video.paused) {
                      video.play();
                    } else {
                      video.pause();
                    }
                  }
                }}
                className="hover:bg-white hover:bg-opacity-20 rounded-full p-2 transition-colors"
              >
                <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M8 5v14l11-7z"/>
                </svg>
              </button>

              <button
                onClick={() => {
                  const video = videoRef.current;
                  if (video) {
                    video.muted = !video.muted;
                  }
                }}
                className="hover:bg-white hover:bg-opacity-20 rounded-full p-2 transition-colors"
              >
                <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M3 9v6h4l5 5V4L7 9H3zm13.5 3c0-1.77-1.02-3.29-2.5-4.03v8.05c1.48-.73 2.5-2.25 2.5-4.02zM14 3.23v2.06c2.89.86 5 3.54 5 6.71s-2.11 5.85-5 6.71v2.06c4.01-.91 7-4.49 7-8.77s-2.99-7.86-7-8.77z"/>
                </svg>
              </button>
            </div>

            <div className="text-sm">
              {formatTime(currentTime)} / {formatTime(duration)}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
