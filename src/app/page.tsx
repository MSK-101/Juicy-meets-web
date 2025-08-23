"use client";

import { useState } from "react";
import Image from "next/image";
import Link from "next/link";
import LoginDialog from "@/components/dialogs/login-dialog";
import UserDetailsDialog from "@/components/dialogs/user-details-dialog";
import { useRouter } from "next/navigation";
import PlansDialog from "@/components/dialogs/plans-dialog";
import ImageSlider from "../components/image-slider";
import MobileImageSlider from "@/components/mobile-image-slider";
import { useUser, useSetUser } from "@/store/auth";
import { userService, UserService } from "@/api/services/userService";

export default function Home() {
  const [showUserDetailsDialog, setUserDetailsDialog] = useState(false);
  const [showLoginDialog, setShowLoginDialog] = useState(false);
  const [showPlansDialog, setShowPlansDialog] = useState(false);
  const user = useUser(); // Call hook at component level
  const setUser = useSetUser(); // Get setUser function
  const router = useRouter();

  const startChat = () => {
    const randomId =
      Math.random().toString(36).substring(2, 10) +
      Math.random().toString(36).substring(2, 10);
    router.push(`/chat/${randomId}`);
  };

  const startVideoChatHandler = async () => {
    // Check if user is logged in or has data in localStorage
    const storedUser = userService.getUserFromLocalStorage();
    const storedUserDetails = userService.getUserDetailsFromLocalStorage();

    if (user) {
      // User is logged in via auth store, go straight to chat
      startChat();
      return;
    }

    if (storedUser) {
      // Check if stored token is still valid
      const token = localStorage.getItem('juicyMeetsAuthToken');
      if (token) {
        try {
          const validation = await UserService.validateToken(token);
          if (validation.valid && validation.user) {
            // Token is valid, update auth store and go to chat
            setUser(validation.user);
            startChat();
            return;
          } else {
            // Token is invalid, clear storage and show dialog
            console.log('❌ Stored token is invalid:', validation.message);
            userService.clearUserFromLocalStorage();
            setUserDetailsDialog(true);
            return;
          }
        } catch (error) {
          // Validation failed, clear storage and show dialog
          console.error('❌ Token validation failed:', error);
          userService.clearUserFromLocalStorage();
          setUserDetailsDialog(true);
          return;
        }
      }
    }

    if (storedUserDetails) {
      // Legacy user details exist, show dialog to create account
      setUserDetailsDialog(true);
      return;
    }

    // No user data found anywhere, show the user details dialog
    setUserDetailsDialog(true);
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

          {user ? (
            <div className="flex items-center gap-3">
              <span className="text-white text-sm hidden md:block">
                {user.email}
              </span>
              <span className="text-yellow-400 text-sm hidden md:block">
                💰 {user.coin_balance} coins
              </span>
              <button
                className="bg-linear-180 from-[#420099] to-[#9747FF] cursor-pointer px-5 py-2 rounded-full"
                onClick={() => {
                  setShowLoginDialog(true);
                }}
              >
                Account
              </button>
            </div>
          ) : (
            <button
              className="bg-linear-180 from-[#420099] to-[#9747FF] cursor-pointer px-5 py-2 rounded-full"
              onClick={() => {
                setShowLoginDialog(true);
              }}
            >
              Log In
            </button>
          )}
          <LoginDialog
            showDialog={showLoginDialog}
            setShowDialog={setShowLoginDialog}
          />
        </div>
      </header>

      <main className="mt-auto mb-10 flex flex-col items-center justify-center z-20">
        <button
          className="py-6 px-12 rounded-full bg-animated-button font-bold text-base md:text-xl my-6 cursor-pointer duration-300 hover:scale-105 order-3 md:order-1 text-white"
          style={{
            border: "1px solid #e02fff",
            boxShadow:
              "inset 0px 0px 0px 0px rgba(0, 255, 0, 0.3), inset 0px 0px 20px 2px, 0 0 200px #df42ff",
          }}
          onClick={startVideoChatHandler}
        >
          START VIDEO CHAT
        </button>


        <UserDetailsDialog
          showDialog={showUserDetailsDialog}
          setShowDialog={setUserDetailsDialog}
          setShowPlansDialog={setShowPlansDialog}
          onOpenLogin={() => {
            setUserDetailsDialog(false);
            setShowLoginDialog(true);
          }}
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
          <ImageSlider />
        </div>

        <div className="block md:hidden">
          <MobileImageSlider />
        </div>
      </div>
    </div>
  );
}
