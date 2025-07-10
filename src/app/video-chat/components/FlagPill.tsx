import React from 'react';

const RedFlagIcon = () => (
  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#F87171" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M4 22V4a2 2 0 0 1 2-2h13l-2 5 2 5H6"/></svg>
);

export default function FlagPill() {
  return (
    <div className="absolute top-4 right-4 z-20 w-7 h-7 flex items-center justify-center">
      <RedFlagIcon />
    </div>
  );
}
