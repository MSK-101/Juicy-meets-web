"use client";
import Image from "next/image";

type ImageSliderProps = {};

export default function MobileImageSlider({}: ImageSliderProps) {
  const bg_images = [
    "c11.jpg",
    "c12.jpg",
    "c13.jpg",
    "c14.jpg",
    "c15.jpg",
    "c16.jpg",
    "c17.jpg",

    "c21.jpg",
    "c22.jpg",
    "c23.jpg",
    "c24.jpg",
    "c25.jpg",
    "c27.jpg",

    "c31.jpg",
    "c32.jpg",
    "c33.jpg",
    "c34.jpg",
    "c35.jpg",
    "c36.jpg",
    "c37.jpg",
  ];

  // Dynamic splitting based on array length
  const totalImages = bg_images.length;
  const imagesPerColumn = Math.ceil(totalImages / 3);

  const bg_images_col_1 = bg_images.slice(0, imagesPerColumn);
  const bg_images_col_2 = bg_images.slice(imagesPerColumn, imagesPerColumn * 2);
  const bg_images_col_3 = bg_images.slice(imagesPerColumn * 2, totalImages);

  return (
    <div
      className="w-[120%] h-screen relative -translate-x-[10%]"
      style={{
        animation: "slide 40s linear infinite",
      }}
    >
      {/* 369px */}
      <div className="flex gap-4 items-start h-screen">
        <div className="flex flex-col gap-4 flex-1">
          {bg_images_col_1.map((img, index) => {
            return (
              <div className="aspect-[148/370]" key={index}>
                <Image
                  src={`/home/${img}`}
                  width={1000}
                  height={1000}
                  alt="Image"
                  className="w-full h-full object-cover object-center rounded-full"
                />
              </div>
            );
          })}
        </div>
        <div className="flex flex-col gap-4 flex-1 slef-end -mt-[110px]">
          {bg_images_col_2.map((img, index) => {
            return (
              <div className="aspect-[148/370]" key={index}>
                <Image
                  src={`/home/${img}`}
                  width={1000}
                  height={1000}
                  alt="Image"
                  className="w-full h-full object-cover object-center rounded-full"
                />
              </div>
            );
          })}
        </div>
        <div className="flex flex-col gap-4 flex-1">
          {bg_images_col_3.map((img, index) => {
            return (
              <div className="aspect-[148/370]" key={index}>
                <Image
                  src={`/home/${img}`}
                  width={1000}
                  height={1000}
                  alt="Image"
                  className="w-full h-full object-cover object-center rounded-full"
                />
              </div>
            );
          })}
        </div>
      </div>
      <style jsx>{`
        @keyframes slide {
          0% {
            transform: translateY(0);
          }
          100% {
            transform: translateY(-100%);
          }
        }
      `}</style>
    </div>
  );
}
