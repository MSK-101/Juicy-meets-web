"use client";

import Image from "next/image";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "../ui/dialog";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faCheck } from "@fortawesome/free-solid-svg-icons";

import { Swiper, SwiperSlide } from "swiper/react";
import { Pagination } from "swiper/modules";

// Import Swiper styles
import "swiper/css";
import "swiper/css/pagination";

// Add prop types for the dialog
interface dialogProps {
  showDialog: boolean;
  setShowDialog: (open: boolean) => void;
}

export default function PlansDialog({
  showDialog,
  setShowDialog,
}: dialogProps) {
  const features = [
    "Premium features",
    "Better scrolling",
    "High resolution videos",
    "24/7 dedicated support",
    "Better engagements",
  ];

  return (
    <Dialog open={showDialog} onOpenChange={setShowDialog}>
      <DialogContent className="border md:border-[3px] gradient-border rounded-2xl md:rounded-3xl w-[90%] lg:w-[80%] xl:w-[60%]">
        <DialogHeader>
          <DialogTitle className="flex justify-center items-center h-[35px] md:h-[50px]">
            <Image src="/logo.png" alt="Juicy Meets" width={40} height={41} />
          </DialogTitle>
        </DialogHeader>
        <div className="flex flex-col items-center">
          <h1 className="font-bold w-full max-w-[675px] text-2xl md:text-4xl text-center mt-10">
            You are almost ready!
          </h1>
          <p className="mt-6 w-full max-w-[675px] font-light leading-[100%] md:leading-[160%] text-lg md:text-xl text-center">
            Select one of the options to proceed the payment.
          </p>
        </div>

        <div className="mt-14">
          <Swiper
            modules={[Pagination]}
            pagination={true}
            className="plan-swiper"
            spaceBetween={10}
            initialSlide={1}
            slidesPerView={1}
            onSlideChange={() => console.log("slide change")}
            onSwiper={(swiper) => console.log(swiper)}
            breakpoints={{
              1024: {
                slidesPerView: 3,
              },
            }}
          >
            <SwiperSlide className="my-auto pb-10">
              <div className="py-4 px-6 xl:py-6 xl:px-8 border rounded-3xl border-[#515151]">
                <h3 className="font-bold text-3xl text-[#9747FF]">Silver</h3>
                <div className="my-6">One time billing</div>

                <div className="flex items-center gap-3">
                  <div className="shrink font-bold text-5xl text-[#9747FF]">
                    $15
                  </div>
                  <div className="font-bold">
                    <div>200 Coins+</div>
                    <div>40 Extra</div>
                  </div>
                </div>

                <div className="flex flex-col gap-3 mt-6">
                  {features.map((feature, index) => {
                    return (
                      <div
                        key={index}
                        className="flex gap-3 items-center text-lg"
                      >
                        <FontAwesomeIcon
                          icon={faCheck}
                          className="text-[#9747FF]"
                        />
                        <span>{feature}</span>
                      </div>
                    );
                  })}
                </div>
              </div>
            </SwiperSlide>
            <SwiperSlide className="my-auto pb-10">
              <div className="py-7 px-6 xl:py-9 xl:px-8  border gradient-border rounded-3xl border-[#515151]">
                <h3 className="font-bold text-3xl text-[#9747FF]">Gold</h3>
                <div className="my-6">One time billing</div>

                <div className="flex items-center gap-3">
                  <div className="shrink font-bold text-5xl text-[#9747FF]">
                    $25
                  </div>
                  <div className="font-bold">
                    <div>400 Coins+</div>
                    <div>80 Extra</div>
                  </div>
                </div>

                <div className="flex flex-col gap-3 mt-6">
                  {features.map((feature, index) => {
                    return (
                      <div
                        key={index}
                        className="flex gap-3 items-center text-lg"
                      >
                        <FontAwesomeIcon
                          icon={faCheck}
                          className="text-[#9747FF]"
                        />
                        <span>{feature}</span>
                      </div>
                    );
                  })}
                </div>
              </div>
            </SwiperSlide>
            <SwiperSlide className="my-auto pb-10">
              <div className="py-4 px-6 xl:py-6 xl:px-8 border rounded-3xl border-[#515151]">
                <h3 className="font-bold text-3xl text-[#9747FF]">Bronze</h3>
                <div className="my-6">One time billing</div>

                <div className="flex items-center gap-3">
                  <div className="shrink font-bold text-5xl text-[#9747FF]">
                    $10
                  </div>
                  <div className="font-bold">
                    <div>200 Coins</div>
                  </div>
                </div>

                <div className="flex flex-col gap-3 mt-6">
                  {features.map((feature, index) => {
                    return (
                      <div
                        key={index}
                        className="flex gap-3 items-center text-lg"
                      >
                        <FontAwesomeIcon
                          icon={faCheck}
                          className="text-[#9747FF]"
                        />
                        <span>{feature}</span>
                      </div>
                    );
                  })}
                </div>
              </div>
            </SwiperSlide>
          </Swiper>
        </div>
      </DialogContent>
    </Dialog>
  );
}
