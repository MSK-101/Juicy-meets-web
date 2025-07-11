"use client";

import { useState } from "react";
import Image from "next/image";
import Link from "next/link";
import LoginDialog from "@/components/dialogs/login-dialog";
import UserDetailsDialog from "@/components/dialogs/user-details-dialog";
import { useRouter } from "next/navigation";
import PlansDialog from "@/components/dialogs/plans-dialog";
import ImageSlider from "../components/ui/image-slider";
import MobileImageSlider from "@/components/ui/mobile-image-slider";

export default function Home() {
  const [showLoginDialog, setShowLoginDialog] = useState(false);
  const [showUserDetailsDialog, setUserDetailsDialog] = useState(false);
  const [showPlansDialog, setShowPlansDialog] = useState(false);
  const router = useRouter();

  const startVideoChatHandler = () => {
    if (typeof window !== "undefined") {
      const userDetails = localStorage.getItem("juicyMeetsUserDetails");
      if (userDetails) {
        // Generate a random chat id (e.g., 16 chars alphanumeric)
        const randomId =
          Math.random().toString(36).substring(2, 10) +
          Math.random().toString(36).substring(2, 10);
        router.push(`/chat/${randomId}`);
      } else {
        setUserDetailsDialog(true);
      }
    }
  };

  return (
    <div className="min-h-screen flex flex-col md:bg-[url('/home/hero_bg.png')] md:bg-cover md:bg-center md:bg-no-repeat relative bg-radial-[at_50%_50%] from-[#A866FF] from-20% via-[#8B33FF] via-40% to-[#0B001A] to-70%">
      <header className="flex justify-between items-center md:bg-black/10 md:backdrop-blur-xs md:shadow-2xl p-5 lg:px-14 lg:py-8 z-10">
        <Link href="/">
          <Image
            src="/logo.png"
            alt="Juicy Meets"
            width={56}
            height={40}
            className="h-8 w-auto cursor-pointer hover:scale-105 duration-300"
          />
        </Link>
        <div className="flex items-center md:gap-14">
          <div className="hidden md:block text-lg">
            <span className="font-semibold">3,435,789</span> Online Video
            Chatters
          </div>

          <button
            className="bg-linear-180 from-[#420099] to-[#9747FF] cursor-pointer px-5 py-2 rounded-full"
            onClick={() => {
              setShowLoginDialog(true);
            }}
          >
            Log In
          </button>
          <LoginDialog
            showDialog={showLoginDialog}
            setShowDialog={setShowLoginDialog}
          />
        </div>
      </header>

      <main className="mt-auto mb-10 flex flex-col items-center justify-center z-20">
        <button
          className="py-6 px-12 rounded-full font-bold text-base md:text-xl my-6 cursor-pointer duration-300 hover:scale-105 order-3 md:order-1"
          style={{
            background:
              "linear-gradient(90deg, #a91dfd 0%, #b231f5 25%, #a91dfd 50%, #c66cf3 85%, #de48ff 100%)",
            border: "1px solid #e02fff",
            boxShadow:
              "inset 0px 0px 0px 0px rgba(0, 255, 0, 0.3), inset 0px 0px 20px 2px #e426ff, 0 0 200px #df42ff",
          }}
          onClick={startVideoChatHandler}
        >
          START VIDEO CHAT
        </button>

        <UserDetailsDialog
          showDialog={showUserDetailsDialog}
          setShowDialog={setUserDetailsDialog}
          setShowPlansDialog={setShowPlansDialog}
        />

        <PlansDialog
          showDialog={showPlansDialog}
          setShowDialog={setShowPlansDialog}
        />

        <h1 className="text-2xl sm:text-3xl md:text-4xl lg:text-[3rem] my-4 text-center order-1 md:order-2">
          Welcome to Juicy Meets Chats.
        </h1>

        <p className="text-sm sm:text-base md:text-lg lg:text-xl max-w-[700px] leading-relaxed animate-in fade-in slide-in-from-bottom duration-500 delay-300 text-center order-2 md:order-3">
          Connecting people worldwide to build meaningful relationships across
          cultures and borders.
        </p>
      </main>

      <div className="h-full absolute  top-0 left-0 right-0 overflow-hidden">
        <div className="hidden md:block pt-40">
          <ImageSlider imageCount={4} basePath="/home/hero_img_" />
        </div>

        <div className="block md:hidden scale-120">
          <MobileImageSlider imageCount={4} basePath="/home/hero_img_" />
        </div>
      </div>
    </div>
  );
}
