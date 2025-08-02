"use client";

import Image from "next/image";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "../ui/dialog";
import { useState } from "react";
import { useUser } from "@/store/auth";
import ForgotPasswordDialog from "./forgot-password-dialog";
import RegisterDialog from "./register-dialog";
import Toast from "../ui/toast";
import LoginForm from "../auth/login-form";
import UserInfo from "../auth/user-info";

// Add prop types for the dialog
interface dialogProps {
  showDialog: boolean;
  setShowDialog: (open: boolean) => void;
}

export default function LoginDialog({
  showDialog,
  setShowDialog,
}: dialogProps) {
  const [showForgotPassword, setShowForgotPassword] = useState(false);
  const [showRegister, setShowRegister] = useState(false);
  const [toast, setToast] = useState<{ message: string; type: "success" | "error"; isVisible: boolean }>({
    message: "",
    type: "success",
    isVisible: false,
  });

  const user = useUser();

  return (
    <>
      <Dialog open={showDialog} onOpenChange={setShowDialog}>
        <DialogContent className="border md:border-[3px] gradient-border rounded-2xl md:rounded-3xl w-[90%] md:w-[60%]">
          <DialogHeader>
            <DialogTitle className="flex justify-center items-center h-[35px] md:h-[50px]">
              <Image src="/logo.png" alt="Juicy Meets" width={40} height={41} />
            </DialogTitle>
          </DialogHeader>

          {user ? (
            // User is logged in - show user info and logout
            <UserInfo
              user={user}
              onLogoutSuccess={() => {
                setToast({
                  message: "Successfully logged out!",
                  type: "success",
                  isVisible: true,
                });
              }}
            />
          ) : (
            // User is not logged in - show login form
            <>
              <LoginForm
                onSuccess={() => {
                  setToast({
                    message: "Successfully logged in!",
                    type: "success",
                    isVisible: true,
                  });
                  setShowDialog(false);
                }}
                onError={(message) => {
                  setToast({
                    message,
                    type: "error",
                    isVisible: true,
                  });
                }}
              />

              <div className="flex flex-col items-center gap-4 mt-4">
                <button
                  type="button"
                  onClick={() => setShowForgotPassword(true)}
                  className="underline"
                >
                  Forgot your Password?
                </button>

              </div>
            </>
          )}
        </DialogContent>

        <ForgotPasswordDialog
          showDialog={showForgotPassword}
          setShowDialog={setShowForgotPassword}
        />

        <RegisterDialog
          showDialog={showRegister}
          setShowDialog={setShowRegister}
        />
      </Dialog>

      <Toast
        message={toast.message}
        type={toast.type}
        isVisible={toast.isVisible}
        onClose={() => setToast(prev => ({ ...prev, isVisible: false }))}
      />
    </>
  );
}
