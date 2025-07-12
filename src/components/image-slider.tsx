"use client";
import Image from "next/image";

type ImageSliderProps = {
  imageCount: number;
  basePath: string;
  imageExtension?: string;
  repeats?: number;
};

export default function ImageSlider({
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
    <div className="overflow-hidden my-5 px-5 w-full">
      <div
        className="flex gap-6 md:gap-8 lg:gap-32"
        style={{
          animation: "slide 40s linear infinite",
        }}
      >
        {imageNumbers.map((num, index) => (
          <div
            key={index}
            className="w-[220px] lg:w-[300px] shrink-0 cursor-pointer hover:grayscale-100 transition-all duration-300"
          >
            <Image
              src={`${basePath}${num}.${imageExtension}`}
              alt={`Image ${num}`}
              width={1000}
              height={100}
              className="w-full shadow-lg rounded-lg"
            />
          </div>
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
