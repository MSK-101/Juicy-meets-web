"use client";

import { useState } from "react";
import Image from "next/image";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faArrowRightToBracket } from "@fortawesome/free-solid-svg-icons";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { useForgotPassword } from "@/api/hooks/useAuthQueries";
import Toast from "../ui/toast";

interface dialogProps {
  showDialog: boolean;
  setShowDialog: (open: boolean) => void;
}

export default function ForgotPasswordDialog({
  showDialog,
  setShowDialog,
}: dialogProps) {
  const [email, setEmail] = useState("");
  const [toast, setToast] = useState<{ message: string; type: "success" | "error"; isVisible: boolean }>({
    message: "",
    type: "success",
    isVisible: false,
  });
  const { mutate: forgotPassword, isPending, error } = useForgotPassword();

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    forgotPassword({ email }, {
      onSuccess: () => {
        setToast({
          message: "New password has been sent to your email!",
          type: "success",
          isVisible: true,
        });
        setShowDialog(false);
        setEmail("");
      },
      onError: () => {
        setToast({
          message: "Failed to send password reset. Please try again.",
          type: "error",
          isVisible: true,
        });
      },
    });
  };

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
            Forgot Your Password?
          </h1>
          <p className="mt-6 w-full max-w-[675px] font-light leading-[100%] md:leading-[160%] text-lg md:text-xl text-center">
            Enter your email address and we&apos;ll send you a new password.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="flex flex-col items-center gap-4 mt-14">
          <Input
            type="email"
            placeholder="Email"
            className="w-full max-w-[398px]"
            id="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />
          {error && (
            <div className="text-red-500 text-sm w-full max-w-[398px] text-center">
              {error.message}
            </div>
          )}
          <button
            type="submit"
            disabled={isPending}
            className="bg-linear-180 from-[#420099] to-[#9747FF] rounded-xl py-3 w-full max-w-[398px] cursor-pointer flex gap-3 justify-center disabled:opacity-50"
          >
            <FontAwesomeIcon
              icon={faArrowRightToBracket}
              className="text-[20px]"
            />
            {isPending ? "Sending..." : "Send New Password"}
          </button>
        </form>
      </DialogContent>

      <Toast
        message={toast.message}
        type={toast.type}
        isVisible={toast.isVisible}
        onClose={() => setToast(prev => ({ ...prev, isVisible: false }))}
      />
    </Dialog>
  );
}
