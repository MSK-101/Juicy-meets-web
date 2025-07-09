"use client";

import Image from "next/image";
import {
  Dialog,
  DialogTrigger,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "../ui/dialog";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faApple, faGoogle } from "@fortawesome/free-brands-svg-icons";
import {
  faCheck,
  faEnvelope,
  faPhone,
} from "@fortawesome/free-solid-svg-icons";
import Link from "next/link";
import { useState } from "react";
import { Input } from "../ui/input";
import { Swiper, SwiperSlide } from "swiper/react";
import { Pagination } from "swiper/modules";

// Import Swiper styles
import "swiper/css";
import "swiper/css/pagination";

export default function LoginSignupDialog() {
  const [showRegistranModal, setShowRegistrationModal] = useState(false);
  const [showSignupModal, setShowSignupModal] = useState(false);
  const [showPlanModal, setShowPlanModal] = useState(false);

  const features = [
    "Premium features",
    "Better scrolling",
    "High resolution videos",
    "24/7 dedicated support",
    "Better engagements",
  ];
  return (
    <>
      {/* Main Modal */}
      <Dialog open={showRegistranModal} onOpenChange={setShowRegistrationModal}>
        <DialogTrigger asChild>
          <button className="bg-white text-black py-2 px-4 rounded-full cursor-pointer hover:scale-105 duration-300">
            Login/Sign Up
          </button>
        </DialogTrigger>
        <DialogContent className="border md:border-[3px] gradient-border rounded-2xl md:rounded-3xl w-[90%] md:w-[60%]">
          <DialogHeader>
            <DialogTitle className="flex justify-center items-center h-[35px] md:h-[50px]">
              <Image src="/logo.png" alt="Juicy Meets" width={40} height={41} />
            </DialogTitle>
          </DialogHeader>
          <div className="flex flex-col items-center">
            <h1 className="font-bold w-full max-w-[675px] text-2xl md:text-4xl text-center mt-10">
              Welcome to Juicy Meets Chats.
            </h1>
            <p className="mt-6 w-full max-w-[675px] font-light leading-[100%] md:leading-[160%] text-lg md:text-xl text-center">
              Today is a new day. It's your day. You shape it. Sign in to start
              chatting with strangers & make friends.
            </p>
          </div>

          <div className="flex flex-col items-center gap-4 mt-14">
            <button
              onClick={() => {
                setShowRegistrationModal(false);
                setShowSignupModal(true);
              }}
              className="border-[#515151] hover:gradient-border border rounded-xl py-3 w-full max-w-[398px] flex items-center justify-center gap-4 cursor-pointer"
            >
              <FontAwesomeIcon icon={faApple} className="text-[24px]" /> Sign in
              with Apple
            </button>
            <button className="border-[#515151] hover:gradient-border border rounded-xl py-3 w-full max-w-[398px] flex items-center justify-center gap-4 cursor-pointer">
              <FontAwesomeIcon icon={faGoogle} className="text-[20px]" />
              Sign in with Google
            </button>
            <button className="border-[#515151] hover:gradient-border border rounded-xl py-3 w-full max-w-[398px] flex items-center justify-center gap-4 cursor-pointer">
              <FontAwesomeIcon icon={faEnvelope} className="text-[20px]" />
              Sign in with Email
            </button>
            <button className="border-[#515151] hover:gradient-border border rounded-xl py-3 w-full max-w-[398px] flex items-center justify-center gap-4 cursor-pointer">
              <FontAwesomeIcon icon={faPhone} className="text-[20px]" />
              Sign in with Phone number
            </button>

            <Link
              href="#"
              className="mt-5"
              onClick={() => {
                setShowRegistrationModal(false);
                setShowSignupModal(true);
              }}
            >
              Don't you have an account?
              <span className="text-[#8B33FF] ml-2">Sign up</span>
            </Link>
          </div>
        </DialogContent>
      </Dialog>

      {/* Login Modal */}
      <Dialog open={showSignupModal} onOpenChange={setShowSignupModal}>
        <DialogContent className="border md:border-[3px] gradient-border rounded-2xl md:rounded-3xl w-[90%] md:w-[60%]">
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
              Please enter your details to setup your account.
            </p>
          </div>

          <div className="flex flex-col items-center gap-4 mt-14">
            <Input
              type="text"
              placeholder="Age"
              className="w-full max-w-[398px]"
              id="age"
            />
            <Input
              type="text"
              placeholder="Gender"
              className="w-full max-w-[398px]"
              id="gender"
            />
            <Input
              type="text"
              placeholder="Interested in"
              className="w-full max-w-[398px]"
              id="interest"
            />

            <button className="gradient-border border rounded-xl py-3 w-full max-w-[398px] cursor-pointer mt-6">
              Continue Free
            </button>

            <button
              onClick={() => {
                setShowSignupModal(false);
                setShowPlanModal(true);
              }}
              className="bg-linear-180 from-[#420099] to-[#9747FF] rounded-xl py-3 w-full max-w-[398px] cursor-pointer"
            >
              Premium Trial 👑
            </button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Plans Modal */}
      <Dialog open={showPlanModal} onOpenChange={setShowPlanModal}>
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
    </>
  );
}
