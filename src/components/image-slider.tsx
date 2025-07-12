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

    "c21.jpg",
    "c22.jpg",
    "c23.jpg",
    "c24.jpg",
    "c25.jpg",
    "c26.jpg",
    "c27.jpg",

    "c31.jpg",
    "c32.jpg",
    "c33.jpg",
    "c34.jpg",
    "c35.jpg",
    "c36.jpg",
    "c37.jpg",
  ];

  return (
    <div className="overflow-hidden my-5 px-5 w-full">
      <div
        className="flex gap-6 md:gap-8 lg:gap-32"
        style={{
          animation: "slideX 40s linear infinite",
        }}
      >
        {images.map((image, index) => (
          <div
            key={index}
            className="w-[334px] aspect-[334/594] lg:w-[300px] shrink-0 cursor-pointer hover:grayscale-100 transition-all duration-300"
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
            transform: translateX(calc(-1 * (150px + 1.5rem) * ${21}));
          }
        }

        @media (min-width: 768px) {
          @keyframes slideX {
            0% {
              transform: translateX(0);
            }
            100% {
              transform: translateX(calc(-1 * (200px + 2rem) * ${21}));
            }
          }
        }

        @media (min-width: 1024px) {
          @keyframes slideX {
            0% {
              transform: translateX(0);
            }
            100% {
              transform: translateX(calc(-1 * (280px + 2.5rem) * ${21}));
            }
          }
        }
      `}</style>
    </div>
  );
}
