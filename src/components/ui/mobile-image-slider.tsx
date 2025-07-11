"use client";
import Image from "next/image";

type ImageSliderProps = {
  imageCount: number;
  basePath: string;
  imageExtension?: string;
  repeats?: number;
};

export default function MobileImageSlider({
  imageCount,
  basePath,
  imageExtension = "png",
  repeats = 3,
}: ImageSliderProps) {
  const imageNumbers = Array.from(
    { length: imageCount * repeats },
    (_, i) => (i % imageCount) + 1
  );

  return (
    <div className="overflow-hidden w-full h-full">
      <div
        className="grid grid-cols-3 gap-4"
        // style={{
        //   animation: "slide 40s linear infinite",
        // }}
      >
        {imageNumbers.map((num, index) => (
          <Image
            src={`${basePath}${num}.${imageExtension}`}
            alt={`Image ${num}`}
            width={1000}
            height={1000}
            className={`w-full aspect-[2/4] rounded-full object-cover object-center ${
              index % 3 == 1 ? "translate-y-20" : ""
            }`}
            key={index}
          />
        ))}
      </div>

      <style jsx>{`
        @keyframes slide {
          0% {
            transform: translateX(0);
          }
          100% {
            transform: translateX(calc(-1 * (150px + 1.5rem) * ${imageCount}));
          }
        }

        @media (min-width: 768px) {
          @keyframes slide {
            0% {
              transform: translateX(0);
            }
            100% {
              transform: translateX(calc(-1 * (200px + 2rem) * ${imageCount}));
            }
          }
        }

        @media (min-width: 1024px) {
          @keyframes slide {
            0% {
              transform: translateX(0);
            }
            100% {
              transform: translateX(
                calc(-1 * (280px + 2.5rem) * ${imageCount})
              );
            }
          }
        }
      `}</style>
    </div>
  );
}
