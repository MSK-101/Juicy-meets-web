import React from "react";

export default function DiamondCountBar({ count }: { count: number }) {
  return (
    <div className="absolute top-1 conic-gradient-btn right-4 flex items-center">
      <div className="p-[3px] rounded-[25px]">
        <div
          className="
            flex items-center justify-center w-[140px] h-[45px] rounded-[22px] shadow-md"
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
