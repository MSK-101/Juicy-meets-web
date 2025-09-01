"use client";

import { useSearchParams } from "next/navigation";
import Image from "next/image";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faCheckCircle } from "@fortawesome/free-solid-svg-icons";
import { Suspense } from "react";

function PurchaseSuccessContent() {
  const searchParams = useSearchParams();
  const packageName = searchParams.get("package");
  const coins = searchParams.get("coins");

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-50 to-white flex items-center justify-center p-4">
      <div className="max-w-md w-full bg-white rounded-3xl shadow-xl p-8 text-center">
        <div className="mb-6">
          <Image src="/logo.png" alt="Juicy Meets" width={60} height={61} className="mx-auto" />
        </div>

        <div className="mb-6">
          <FontAwesomeIcon
            icon={faCheckCircle}
            className="text-6xl text-green-500 mb-4"
          />
          <h1 className="text-3xl font-bold text-gray-900 mb-2">
            Purchase Successful!
          </h1>
          <p className="text-gray-600">
            Thank you for your purchase. Your coins have been added to your account.
          </p>
        </div>

        {packageName && coins && (
          <div className="bg-purple-50 rounded-xl p-6 mb-6">
            <h2 className="text-xl font-semibold text-purple-900 mb-2">
              {packageName} Package
            </h2>
            <p className="text-purple-700 font-medium">
              {coins} Coins Added
            </p>
          </div>
        )}

        <div className="space-y-4">
          <button
            onClick={() => window.location.href = "/"}
            className="w-full bg-[#9747FF] text-white py-3 rounded-xl font-semibold hover:bg-purple-700 transition-colors duration-200"
          >
            Continue to App
          </button>

          <button
            onClick={() => window.history.back()}
            className="w-full bg-gray-100 text-gray-700 py-3 rounded-xl font-semibold hover:bg-gray-200 transition-colors duration-200"
          >
            Back to Plans
          </button>
        </div>
      </div>
    </div>
  );
}

export default function PurchaseSuccessPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-gradient-to-br from-purple-50 to-white flex items-center justify-center p-4">
        <div className="max-w-md w-full bg-white rounded-3xl shadow-xl p-8 text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading...</p>
        </div>
      </div>
    }>
      <PurchaseSuccessContent />
    </Suspense>
  );
}
