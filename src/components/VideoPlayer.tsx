import React, { useRef, useEffect, useState } from 'react';

interface VideoPlayerProps {
  videoId: string;
  videoUrl?: string;
  videoName?: string;
  onVideoEnd: () => void;
}

export const VideoPlayer: React.FC<VideoPlayerProps> = ({
  videoId,
  videoUrl,
  videoName,
  onVideoEnd
}) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (videoRef.current && videoUrl) {
      videoRef.current.src = videoUrl;
      videoRef.current.load();
    }
  }, [videoUrl]);

  const handleEnded = () => {
    onVideoEnd();
  };

  const handleError = () => {
    setError('Failed to load video');
  };

  if (error) {
    return (
      <div className="w-full h-full bg-black flex items-center justify-center relative">
        <div className="text-center text-white">
          <div className="text-6xl mb-4">❌</div>
        </div>
      </div>
    );
  }

  if (!videoUrl) {
    return (
      <></>
    );
  }

  return (
    <div className="w-full h-full bg-black flex items-center justify-center relative">
      {/* Video Player */}
      <video
        ref={videoRef}
        className="w-full h-full object-cover"
        autoPlay
        playsInline
        muted={false}
        loop={false}
        onEnded={handleEnded}
        onError={handleError}
      >
        <source src={videoUrl} type="video/mp4" />
        Your browser does not support the video tag.
      </video>
    </div>
  );
};
