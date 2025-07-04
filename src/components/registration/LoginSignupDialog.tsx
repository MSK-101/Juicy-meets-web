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
import { faEnvelope, faPhone } from "@fortawesome/free-solid-svg-icons";
import Link from "next/link";

export default function LoginSignupDialog() {
  return (
    <Dialog>
      <DialogTrigger asChild>
        <button className="bg-white text-black py-2 px-4 rounded-full cursor-pointer hover:scale-105 duration-300">
          Login/Sign Up
        </button>
      </DialogTrigger>
      <DialogContent className="border-[3px] gradient-border rounded-3xl w-[60%] h-[65%]">
        <DialogHeader>
          <DialogTitle className="flex justify-center items-center h-[50px]">
            <Image src="/logo.png" alt="Juicy Meets" width={40} height={41} />
          </DialogTitle>
        </DialogHeader>
        <div className="flex flex-col items-center">
          <h1 className="font-bold text-4xl text-center mt-10">
            Welcome to Juicy Meets Chats.
          </h1>
          <p className="mt-6 max-w-[80%] font-light leading-[160%] text-xl text-center">
            Today is a new day. It's your day. You shape it. Sign in to start
            chatting with strangers & make friends.
          </p>
        </div>

        <div className="flex flex-col items-center gap-4 mt-14">
          <button className="gradient-border border rounded-xl py-3 w-[398px] flex items-center justify-center gap-4 cursor-pointer">
            <FontAwesomeIcon icon={faApple} className="text-[24px]" /> Sign in
            with Apple
          </button>
          <button className="border-[#515151] border rounded-xl py-3 w-[398px] flex items-center justify-center gap-4 cursor-pointer">
            <FontAwesomeIcon icon={faGoogle} className="text-[20px]" />
            Sign in with Google
          </button>
          <button className="border-[#515151] border rounded-xl py-3 w-[398px] flex items-center justify-center gap-4 cursor-pointer">
            <FontAwesomeIcon icon={faEnvelope} className="text-[20px]" />
            Sign in with Email
          </button>
          <button className="border-[#515151] border rounded-xl py-3 w-[398px] flex items-center justify-center gap-4 cursor-pointer">
            <FontAwesomeIcon icon={faPhone} className="text-[20px]" />
            Sign in with Phone number
          </button>

          <Link href="#" className="mt-5">
            Don't you have an account?
            <span className="text-[#8B33FF] ml-2">Sign up</span>
          </Link>
        </div>
      </DialogContent>
    </Dialog>
  );
}
