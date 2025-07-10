import React from 'react';

const LogoIcon = () => (
  <svg width="32" height="32" viewBox="0 0 40 40" fill="none" xmlns="http://www.w3.org/2000/svg">
    <rect width="40" height="40" rx="12" fill="white" fillOpacity="0.0"/>
    <path d="M13 18c0-3.866 3.134-7 7-7s7 3.134 7 7" stroke="#fff" strokeWidth="2.5" strokeLinecap="round"/>
    <circle cx="13.5" cy="13.5" r="2.5" fill="#fff"/>
  </svg>
);

export default function LogoPill() {
  return (
    <div className="absolute top-4 left-4 z-20 w-8 h-8 flex items-center justify-center">
      <LogoIcon />
    </div>
  );
}
