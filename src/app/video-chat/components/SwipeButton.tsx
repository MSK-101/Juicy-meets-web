import React from 'react';

const SwipeIcon = () => (
  <svg width="48" height="48" viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg">
    <circle cx="24" cy="24" r="24" fill="#7C3AED" fillOpacity="0.8"/>
    <path d="M18 24h12m0 0l-5-5m5 5l-5 5" stroke="#fff" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/>
  </svg>
);

type SwipeButtonProps = { onClick?: () => void };

export default function SwipeButton({ onClick }: SwipeButtonProps) {
  return (
    <div className="absolute bottom-4 left-1/2 -translate-x-1/2 z-30">
      <button
        className="bg-black bg-opacity-60 rounded-full p-3 shadow-lg border-2 border-white/10 flex items-center justify-center backdrop-blur-md"
        onClick={onClick}
      >
        <SwipeIcon />
      </button>
    </div>
  );
}
