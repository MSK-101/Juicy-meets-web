"use client";
import { useErrorStore } from "@/store/error";

export function GlobalError() {
  const { error, clearError } = useErrorStore();

  if (!error) return null;

  return (
    <div className="fixed top-4 left-1/2 z-50 -translate-x-1/2 bg-red-600 text-white px-6 py-3 rounded shadow-lg flex items-center gap-4">
      <span>{error}</span>
      <button onClick={clearError} className="ml-4 text-white font-bold">×</button>
    </div>
  );
}
