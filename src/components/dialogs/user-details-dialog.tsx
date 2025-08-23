"use client";

import Image from "next/image";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "../ui/dialog";
import { Input } from "../ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../ui/select";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { userService, CreateUserRequest } from "../../api/services/userService";
import { useSetUser } from "@/store/auth";
import { useAuthStore } from "@/store/auth";

// Add prop types for the dialog
interface dialogProps {
  showDialog: boolean;
  setShowDialog: (open: boolean) => void;
  setShowPlansDialog: (open: boolean) => void;
  onOpenLogin?: () => void; // Callback to open login dialog
}

export default function UserDetailsDialog({
  showDialog,
  setShowDialog,
  setShowPlansDialog,
  onOpenLogin,
}: dialogProps) {
  const [email, setEmail] = useState("");
  const [age, setAge] = useState("");
  const [gender, setGender] = useState("");
  const [interest, setInterest] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");
  // const [successMessage, setSuccessMessage] = useState(""); // Removed - no success messages needed
  const [showLoginOption, setShowLoginOption] = useState(false);

  const router = useRouter();
  const setUser = useSetUser();

  // Email validation regex (simple version)
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  const isEmailValid = emailRegex.test(email);
  const isFormValid =
    isEmailValid &&
    age.trim() !== "" &&
    parseInt(age) > 0 &&
    gender.trim() !== "" &&
    interest.trim() !== "";
  const [emailTouched, setEmailTouched] = useState(false);

  const createUserAccount = async () => {
    if (!isFormValid || isLoading) return;

    setIsLoading(true);
    setError("");
    setShowLoginOption(false);

    try {
      const userData: CreateUserRequest = {
        user: {
          email,
          age: parseInt(age),
          gender: gender as 'male' | 'female' | 'other',
          interested_in: interest as 'male' | 'female' | 'other',
        }
      };

      console.log('🚀 Creating user account...', userData);
      const response = await userService.createUser(userData);

      if (response.success) {
        // Check if user already exists
        if (response.data.user_exists) {
          // User already exists, show login option
          setShowLoginOption(true);
          return;
        }

        // Store user data locally for quick access
        userService.storeUserLocally(response.data.user, response.data.token);

        // Update auth store with user data and token
        const userWithToken = { ...response.data.user, token: response.data.token };
        console.log('🔑 Storing user with token in auth store:', userWithToken);
        setUser(userWithToken);

        // Verify the token was stored
        setTimeout(() => {
          const storedToken = localStorage.getItem('juicyMeetsAuthToken');
          const authStoreUser = useAuthStore.getState().user;
          console.log('🔍 Verification - Stored token:', storedToken ? 'Yes' : 'No');
          console.log('🔍 Verification - Auth store user:', authStoreUser);
          console.log('🔍 Verification - Auth store token:', authStoreUser?.token ? 'Yes' : 'No');
        }, 100);

        console.log('✅ User created successfully:', response.data.user);
        console.log('💰 Free coins:', response.data.free_coins);
        console.log('🔑 Token received:', response.data.token ? 'Yes' : 'No');

        return response.data.user;
      } else {
        throw new Error('Failed to create user account');
      }
    } catch (err: unknown) {
      console.error('❌ Error creating user:', err);
      const errorMessage = err instanceof Error ? err.message : 'Failed to create account. Please try again.';
      setError(errorMessage);
      throw err;
    } finally {
      setIsLoading(false);
    }
  };

  const handleContinueFree = async () => {
    if (!isFormValid || isLoading) return;

    try {
      await createUserAccount();

      // Generate chat ID and navigate immediately
      const randomId =
        Math.random().toString(36).substring(2, 10) +
        Math.random().toString(36).substring(2, 10);

      setShowDialog(false);
      router.push(`/chat/${randomId}`);
    } catch (err) {
      // Error is already handled in createUserAccount
      console.error('❌ Failed to continue with free account:', err);
    }
  };

  const handlePremiumTrial = async () => {
    if (!isFormValid || isLoading) return;

    try {
      await createUserAccount();

      // Go straight to plans dialog
      setShowDialog(false);
      setShowPlansDialog(true);
    } catch (err) {
      // Error is already handled in createUserAccount
      console.error('❌ Failed to start premium trial:', err);
    }
  };

  const handleDialogClose = (open: boolean) => {
    // Only allow closing if the form is complete or if we're opening the dialog
    if (open) {
      setShowDialog(true);
    } else if (isFormValid || showLoginOption) {
      // Allow closing if form is valid or if showing login option
      setShowDialog(false);
      // Reset dialog state
      resetDialogState();
    } else {
      // Prevent closing if form is incomplete
      console.log('⚠️ Cannot close dialog - form incomplete');
      // Optionally show a message to the user
      setError('Please complete all required fields before closing.');
    }
  };

  const resetDialogState = () => {
    setEmail("");
    setAge("");
    setGender("");
    setInterest("");
    setError("");
    setShowLoginOption(false);
    setEmailTouched(false);
  };

  return (
    <Dialog open={showDialog} onOpenChange={handleDialogClose}>
      <DialogContent className="border md:border-[3px] gradient-border rounded-2xl md:rounded-3xl w-[90%] md:w-[60%]">
        <DialogHeader>
          <DialogTitle className="flex justify-center items-center h-[35px] md:h-[50px]">
            <Image src="/logo.png" alt="Juicy Meets" width={40} height={41} />
          </DialogTitle>
        </DialogHeader>
        <div className="flex flex-col items-center">
          <h1 className="font-bold w-full max-w-[675px] text-2xl md:text-4xl text-center mt-10">
            Enter Your Details
          </h1>
          <p className="mt-6 w-full max-w-[675px] font-light leading-[100%] md:leading-[160%] text-lg md:text-xl text-center">
            Please provide your information to start chatting.
          </p>
        </div>

        <div className="flex flex-col items-center gap-4 mt-14">
          {/* Show login option when user already exists */}
          {showLoginOption && (
            <div className="w-full max-w-[398px] text-center">
              <p className="text-sm text-gray-600 mb-4">
                This email is already registered. Please login with your password.
              </p>
              <button
                onClick={() => {
                  setShowDialog(false);
                  // Use the callback to open login dialog if provided
                  if (onOpenLogin) {
                    onOpenLogin();
                  }
                }}
                className="bg-linear-180 from-[#420099] to-[#9747FF] rounded-xl py-3 w-full text-white"
              >
                Go to Login
              </button>
            </div>
          )}

          {/* Only show form fields if not showing login option */}
          {!showLoginOption && (
            <>
              <Input
                type="email"
                placeholder="Email *"
                className="w-full max-w-[398px]"
                id="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                onBlur={() => setEmailTouched(true)}
                required
              />
              {emailTouched && !isEmailValid && (
                <div className="text-red-500 text-sm w-full max-w-[398px] text-left">
                  Please enter a valid email address.
                </div>
              )}

              <Input
                type="number"
                placeholder="Age *"
                className="w-full max-w-[398px]"
                id="age"
                value={age}
                onChange={(e) => setAge(e.target.value)}
                min="18"
                max="100"
                required
              />

              {error && (
                <div className="text-red-500 text-sm w-full max-w-[398px] text-center">
                  {error}
                </div>
              )}

              <Select value={gender} onValueChange={setGender}>
                <SelectTrigger
                  className="w-full max-w-[398px]"
                  style={{
                    backgroundColor: gender ? '#e8f1ff' : 'transparent',
                    color: gender ? '#000000' : '#6b7280'
                  }}
                >
                  <SelectValue placeholder="Gender *" />
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
                  <SelectValue placeholder="Interested in *" />
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
                disabled={!isFormValid || isLoading}
                style={{ opacity: (isFormValid && !isLoading) ? 1 : 0.5 }}
              >
                {isLoading ? "Creating Account..." : "Continue Free"}
              </button>

              <button
                onClick={handlePremiumTrial}
                className="bg-linear-180 from-[#420099] to-[#9747FF] rounded-xl py-3 w-full max-w-[398px] cursor-pointer"
                disabled={!isFormValid || isLoading}
                style={{ opacity: (isFormValid && !isLoading) ? 1 : 0.5 }}
              >
                {isLoading ? "Creating Account..." : "Premium Trial 👑"}
              </button>

              {/* Show close button only when form is complete */}
              {isFormValid && (
                <button
                  onClick={() => setShowDialog(false)}
                  className="text-gray-500 underline text-sm mt-4"
                >
                  Close
                </button>
              )}
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
