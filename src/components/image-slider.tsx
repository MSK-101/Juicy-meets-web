"use client";
import Image from "next/image";

export default function ImageSlider() {
  const images = [
    "c11.jpg",
    "c12.jpg",
    "c13.jpg",
    "c14.jpg",
    "c15.jpg",
    "c16.jpg",
    "c17.jpg",
    "c26.jpg",
    "c22.jpg",
    "c24.jpg",
    "c11.jpg",
    "c12.jpg",
    "c13.jpg",
    "c14.jpg",
    "c15.jpg",
    "c16.jpg",
    "c17.jpg",
    "c26.jpg",
    "c22.jpg",
    "c24.jpg",
  ];

  return (
    <div className="overflow-hidden w-full">
      {/*
        the width calculation is as follows:
        total images: 20
        one image width: 300
        gap between images: 25
        total width: [(20*300) / 2 ] + [(30*20)/2] => 3300
      */}
      <div
        className="flex w-[3300px] gap-[30px]"
        style={{
          animation: "slideX 40s linear infinite",
        }}
      >
        {images.map((image, index) => (
          // width: 300px
          <div
            key={index}
            className="w-[300px] aspect-[334/594] flex-none cursor-pointer hover:grayscale-100 transition-[filter] duration-700"
          >
            <Image
              src={`/home/${image}`}
              alt={`Image`}
              width={1000}
              height={1000}
              className="h-full shadow-lg rounded-xl object-cover object-center"
            />
          </div>
        ))}
      </div>

      <style jsx>{`
        @keyframes slideX {
          0% {
            transform: translateX(0);
          }
          100% {
            transform: translateX(-100%);
          }
        }
      `}</style>
    </div>
  );
}
