"use client";

import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faSignOutAlt } from "@fortawesome/free-solid-svg-icons";
import { useLogout } from "@/api/hooks/useAuthQueries";
import type { User } from "@/store/auth";

interface UserInfoProps {
  user: User;
  onLogoutSuccess: () => void;
}

export default function UserInfo({ user, onLogoutSuccess }: UserInfoProps) {
  const { mutate: logout, isPending: isLogoutPending } = useLogout();

  const handleLogout = () => {
    logout(undefined, {
      onSuccess: () => {
        onLogoutSuccess();
      },
    });
  };

  return (
    <div className="flex flex-col items-center">
      <div className="flex flex-col items-center">
        <h1 className="font-bold w-full max-w-[675px] text-2xl md:text-4xl text-center mt-10">
          Welcome back!
        </h1>
        <p className="mt-6 w-full max-w-[675px] font-light leading-[100%] md:leading-[160%] text-lg md:text-xl text-center">
          You are logged in as: <strong>{user.email}</strong>
        </p>
      </div>

      <button
        onClick={handleLogout}
        disabled={isLogoutPending}
        className="mt-8 bg-red-500 hover:bg-red-600 rounded-xl py-3 w-full max-w-[398px] cursor-pointer flex gap-3 justify-center disabled:opacity-50 text-white"
      >
        <FontAwesomeIcon
          icon={faSignOutAlt}
          className="text-[20px]"
        />
        {isLogoutPending ? "Signing out..." : "Sign out"}
      </button>
    </div>
  );
}
