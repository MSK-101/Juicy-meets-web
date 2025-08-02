"use client";

import { useState } from "react";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faArrowRightToBracket } from "@fortawesome/free-solid-svg-icons";
import { Input } from "@/components/ui/input";
import { useLogin } from "@/api/hooks/useAuthQueries";

interface LoginFormProps {
  onSuccess: () => void;
  onError: (message: string) => void;
}

export default function LoginForm({ onSuccess, onError }: LoginFormProps) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const { mutate: login, isPending, error } = useLogin();

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    login({ email, password }, {
      onSuccess: () => {
        onSuccess();
      },
      onError: () => {
        onError("Login failed. Please check your credentials.");
      },
    });
  };

  return (
    <>
      <div className="flex flex-col items-center">
        <h1 className="font-bold w-full max-w-[675px] text-2xl md:text-4xl text-center mt-10">
          Welcome to Juicy Meets Chats.
        </h1>
        <p className="mt-6 w-full max-w-[675px] font-light leading-[100%] md:leading-[160%] text-lg md:text-xl text-center">
          Today is a new day. It&apos;s your day. You shape it. Sign in to
          start chatting with strangers & make friends.
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
        <Input
          type="password"
          placeholder="Password"
          className="w-full max-w-[398px]"
          id="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
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
          {isPending ? "Signing in..." : "Sign in"}
        </button>
      </form>
    </>
  );
}
