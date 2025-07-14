import React from "react";

export default function MockVideo({ flip = false, imgSrc }: { flip?: boolean; imgSrc: string }) {
  return (
    <div className="w-full h-full flex items-center justify-center bg-black/80 relative overflow-hidden">
      <img
        src={imgSrc}
        alt="User video"
        className={`object-cover w-full h-full ${flip ? 'scale-x-[-1]' : ''}`}
      />
    </div>
  );
}
