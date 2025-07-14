import React from "react";

export default function DiamondCountBar({ count }: { count: number }) {
  return (
    <div className="absolute top-1 right-4 flex items-center">
      <div className="p-[3px] rounded-[25px]">
        <div
          className="
            flex items-center justify-center w-[140px] h-[45px] rounded-[22px] shadow-md
            diamond-animated-btn       // Default for mobile (sm)
            md:conic-gradient-btn      // Use conic on md and up
            md:diamond-animated-btn-none // Disable diamond bg on md+ (we’ll define this)
          "
        >
          <img
            src="/diamond.svg"
            alt="Diamond"
            className="mr-2"
            style={{ width: 32, height: 21 }}
          />
          <span className="font-bold text-white text-[17px] leading-none">
            {count.toLocaleString()}
          </span>
        </div>
      </div>
    </div>
  );
}
