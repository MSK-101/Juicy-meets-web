import React from "react";
import Image from "next/image";

export default function DiamondCountBar({ count }: { count: number }) {
  return (
    <div className="rotating-border-btn w-[102px] h-[37px] md:w-[142px] md:h-[47px] shadow-md">
      <Image
        src="/diamond.svg"
        alt="Diamond"
        className="mr-2 w-6 h-4 md:w-8 md:h-5"
        height={21}
        width={32}
      />
      <span className="font-bold text-white text-sm md:text-[17px] leading-none">
        {count?.toLocaleString() || 0}
      </span>
    </div>
  );
}
