"use client";

import Image from "next/image";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "../ui/dialog";
import { Input } from "../ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../ui/select";
import { useState } from "react";
import { useRouter } from "next/navigation";

// Add prop types for the dialog
interface dialogProps {
  showDialog: boolean;
  setShowDialog: (open: boolean) => void;
  setShowPlansDialog: (open: boolean) => void;
}

export default function UserDetailsDialog({
  showDialog,
  setShowDialog,
  setShowPlansDialog,
}: dialogProps) {
  const [email, setEmail] = useState("");
  const [age, setAge] = useState("");
  const [gender, setGender] = useState("");
  const [interest, setInterest] = useState("");

  const router = useRouter();

  // Email validation regex (simple version)
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  const isEmailValid = emailRegex.test(email);
  const isFormValid =
    isEmailValid &&
    age.trim() !== "" &&
    gender.trim() !== "" &&
    interest.trim() !== "";
  const [emailTouched, setEmailTouched] = useState(false);

  const saveUserDetails = () => {
    const userDetails = {
      email,
      age,
      gender,
      interest,
    };
    localStorage.setItem("juicyMeetsUserDetails", JSON.stringify(userDetails));
  };

  const handleContinueFree = () => {
    if (!isFormValid) return;
    saveUserDetails();
    const randomId =
      Math.random().toString(36).substring(2, 10) +
      Math.random().toString(36).substring(2, 10);
    router.push(`/chat/${randomId}`);
  };

  const handlePremiumTrial = () => {
    if (!isFormValid) return;
    saveUserDetails();
    setShowDialog(false);
    setShowPlansDialog(true);
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
            You are almost ready!
          </h1>
          <p className="mt-6 w-full max-w-[675px] font-light leading-[100%] md:leading-[160%] text-lg md:text-xl text-center">
            Please enter your details to setup your account.
          </p>
        </div>

        <div className="flex flex-col items-center gap-4 mt-14">
          <Input
            type="email"
            placeholder="Email"
            className="w-full max-w-[398px]"
            id="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            onBlur={() => setEmailTouched(true)}
          />
          {emailTouched && !isEmailValid && (
            <div className="text-red-500 text-sm w-full max-w-[398px] text-left">
              Please enter a valid email address.
            </div>
          )}

          <Input
            type="text"
            placeholder="Age"
            className="w-full max-w-[398px]"
            id="age"
            value={age}
            onChange={(e) => setAge(e.target.value)}          />
          <Select value={gender} onValueChange={setGender}>
            <SelectTrigger
              className="w-full max-w-[398px]"
              style={{
                backgroundColor: gender ? '#e8f1ff' : 'transparent',
                color: gender ? '#000000' : '#6b7280'
              }}
            >
              <SelectValue placeholder="Gender" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="male">Male</SelectItem>
              <SelectItem value="female">Female</SelectItem>
              <SelectItem value="other">Other</SelectItem>
            </SelectContent>
          </Select>
          <Select value={interest} onValueChange={setInterest}>
            <SelectTrigger
              className="w-full max-w-[398px]"
              style={{
                backgroundColor: interest ? '#e8f1ff' : 'transparent',
                color: interest ? '#000000' : '#6b7280'
              }}
            >
              <SelectValue placeholder="Interested in" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="male">Male</SelectItem>
              <SelectItem value="female">Female</SelectItem>
              <SelectItem value="other">Other</SelectItem>
            </SelectContent>
          </Select>

          <button
            className="gradient-border border rounded-xl py-3 w-full max-w-[398px] cursor-pointer mt-6"
            onClick={handleContinueFree}
            disabled={!isFormValid}
            style={{ opacity: isFormValid ? 1 : 0.5 }}
          >
            Continue Free
          </button>

          <button
            onClick={handlePremiumTrial}
            className="bg-linear-180 from-[#420099] to-[#9747FF] rounded-xl py-3 w-full max-w-[398px] cursor-pointer"
            disabled={!isFormValid}
            style={{ opacity: isFormValid ? 1 : 0.5 }}
          >
            Premium Trial 👑
          </button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
