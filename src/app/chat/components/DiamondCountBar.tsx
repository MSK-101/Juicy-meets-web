"use client";

import React, { useState } from "react";
import Image from "next/image";
import PlansDialog from "@/components/dialogs/plans-dialog";

export default function DiamondCountBar({ count }: { count: number }) {
  const [showDialog, setShowDialog] = useState(false);

  return (
    <>
      <div
        className="rotating-border-btn w-[102px] h-[37px] md:w-[142px] md:h-[47px] shadow-md cursor-pointer"
        onClick={() => setShowDialog(true)}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") setShowDialog(true);
        }}
        aria-label="Open coin packages"
      >
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

      <PlansDialog showDialog={showDialog} setShowDialog={setShowDialog} />
    </>
  );
}
