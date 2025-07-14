"use client";

import Image from "next/image";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "../ui/dialog";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faArrowRightToBracket } from "@fortawesome/free-solid-svg-icons";
import Link from "next/link";
import { Input } from "../ui/input";

// Add prop types for the dialog
interface dialogProps {
  showDialog: boolean;
  setShowDialog: (open: boolean) => void;
}

export default function LoginDialog({
  showDialog,
  setShowDialog,
}: dialogProps) {
  return (
    <Dialog open={showDialog} onOpenChange={setShowDialog}>
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
            Today is a new day. It&apos;s your day. You shape it. Sign in to
            start chatting with strangers & make friends.
          </p>
        </div>

        <div className="flex flex-col items-center gap-4 mt-14">
          <Input
            type="email"
            placeholder="Email"
            className="w-full max-w-[398px]"
            id="email"
          />
          <Input
            type="password"
            placeholder="Password"
            className="w-full max-w-[398px]"
            id="password"
          />
          <button className="bg-linear-180 from-[#420099] to-[#9747FF] rounded-xl py-3 w-full max-w-[398px] cursor-pointer flex gap-3 justify-center">
            <FontAwesomeIcon
              icon={faArrowRightToBracket}
              className="text-[20px]"
            />
            Sign in
          </button>

          <Link href="#" className="mt-5">
            Forgot your Password?
          </Link>
        </div>
      </DialogContent>
    </Dialog>
  );
}
