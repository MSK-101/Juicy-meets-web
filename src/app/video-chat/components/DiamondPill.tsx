import React from 'react';

const DiamondIcon = () => (
  <svg width="28" height="28" viewBox="0 0 28 28" fill="none" xmlns="http://www.w3.org/2000/svg">
    <g filter="url(#filter0_d_1_2)">
      <path d="M14 4L24 14L14 24L4 14L14 4Z" fill="#7C3AED" stroke="#A78BFA" strokeWidth="2"/>
      <path d="M14 4L19 14L14 24L9 14L14 4Z" fill="#C4B5FD"/>
    </g>
    <defs>
      <filter id="filter0_d_1_2" x="0" y="0" width="28" height="28" filterUnits="userSpaceOnUse" colorInterpolationFilters="sRGB">
        <feFlood floodOpacity="0" result="BackgroundImageFix"/>
        <feBlend mode="normal" in="SourceGraphic" in2="BackgroundImageFix" result="shape"/>
        <feGaussianBlur stdDeviation="2" result="effect1_foregroundBlur_1_2"/>
      </filter>
    </defs>
  </svg>
);

type DiamondPillProps = { coins: number };

export default function DiamondPill({ coins }: DiamondPillProps) {
  return (
    <div className="absolute top-4 right-4 z-20 flex items-center space-x-2 bg-black bg-opacity-70 rounded-full px-3 py-1 backdrop-blur-md border border-purple-300 min-w-[70px] min-h-[36px] justify-end">
      <DiamondIcon />
      <span className="text-white font-medium text-base">{coins.toLocaleString()}</span>
    </div>
  );
}
