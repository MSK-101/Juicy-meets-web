"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "../ui/dialog";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faCheck } from "@fortawesome/free-solid-svg-icons";
import { useCoinPackages } from "@/api/hooks/useCoinPackagesQueries";
import { useCreatePurchase } from "@/api/hooks/usePurchaseQueries";
import type { CoinPackage } from "@/api/types";

import { Swiper, SwiperSlide } from "swiper/react";
import { Pagination } from "swiper/modules";

// Import Swiper styles
import "swiper/css";
import "swiper/css/pagination";

// Add prop types for the dialog
interface dialogProps {
  showDialog: boolean;
  setShowDialog: (open: boolean) => void;
}

export default function PlansDialog({
  showDialog,
  setShowDialog,
}: dialogProps) {
  const router = useRouter();
  const { data: coinPackages, isLoading, error } = useCoinPackages();
  const createPurchaseMutation = useCreatePurchase();
  const [selectedPackage, setSelectedPackage] = useState<CoinPackage | null>(null);

  const features = [
    "Premium features",
    "Better scrolling",
    "High resolution videos",
    "24/7 dedicated support",
    "Better engagements",
  ];

  const handlePackageClick = (coinPackage: CoinPackage) => {
    setSelectedPackage(coinPackage);
  };

  const handleBuyClick = async () => {
    if (!selectedPackage) return;

    try {
      await createPurchaseMutation.mutateAsync({
        coin_package_id: selectedPackage.id,
      });

      // Close dialog and redirect to success page
      setShowDialog(false);
      setSelectedPackage(null);

      // Redirect to success page with package details
      const successUrl = `/purchase/success?package=${encodeURIComponent(selectedPackage.name)}&coins=${selectedPackage.coins_count}`;
      router.push(successUrl);
    } catch (error) {

      alert("Purchase failed. Please try again.");
    }
  };

  return (
    <Dialog open={showDialog} onOpenChange={setShowDialog}>
      <DialogContent className="border md:border-[3px] gradient-border rounded-2xl md:rounded-3xl w-[90%] lg:w-[80%] xl:w-[60%]">
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
            Select one of the options to proceed the payment.
          </p>
        </div>

        <div className="mt-14">
          {isLoading ? (
            <div className="flex items-center justify-center py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-600"></div>
            </div>
          ) : error ? (
            <div className="flex items-center justify-center py-8">
              <div className="text-center">
                <p className="text-red-600">Error loading packages. Please try again.</p>
              </div>
            </div>
          ) : coinPackages && coinPackages.length > 0 ? (
            <Swiper
              modules={[Pagination]}
              pagination={true}
              className="plan-swiper"
              spaceBetween={10}
              initialSlide={coinPackages.length > 1 ? 1 : 0}
              slidesPerView={1}
              centeredSlides={true}
              breakpoints={{
                1024: {
                  slidesPerView: 3,
                  centeredSlides: false,
                },
              }}
            >
              {coinPackages.map((coinPackage, index) => (
                <SwiperSlide key={coinPackage.id} className="my-auto pb-10">
                  <div
                    className={`py-4 px-6 xl:py-6 xl:px-8 border rounded-3xl cursor-pointer transition-all duration-200 ${
                      selectedPackage?.id === coinPackage.id
                        ? "border-[#9747FF] shadow-lg"
                        : "border-[#515151] hover:border-[#9747FF]"
                    } ${index === 1 ? "py-7 xl:py-9 gradient-border" : ""}`}
                    onClick={() => handlePackageClick(coinPackage)}
                  >
                    <div className="text-center lg:text-left">
                      <h3 className="font-bold text-3xl text-[#9747FF]">{coinPackage.name}</h3>
                      <div className="my-6">One time billing</div>

                      <div className="flex items-center gap-3 justify-center lg:justify-start">
                        <div className="shrink font-bold text-5xl text-[#9747FF]">
                          ${coinPackage.price}
                        </div>
                        <div className="font-bold">
                          <div>{coinPackage.coins_count} Coins{coinPackage.coins_count > 200 ? "+" : ""}</div>
                        </div>
                      </div>

                      <div className="flex flex-col gap-3 mt-6">
                        {features.map((feature, featureIndex) => {
                          return (
                            <div
                              key={featureIndex}
                              className="flex gap-3 items-center text-lg justify-center lg:justify-start"
                            >
                              <FontAwesomeIcon
                                icon={faCheck}
                                className="text-[#9747FF]"
                              />
                              <span>{feature}</span>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  </div>
                </SwiperSlide>
              ))}
            </Swiper>
          ) : (
            <div className="flex items-center justify-center py-8">
              <div className="text-center">
                <p className="text-gray-600">No packages available.</p>
              </div>
            </div>
          )}

          {/* Buy Button */}
          {selectedPackage && coinPackages && coinPackages.length > 0 && (
            <div className="flex justify-center mt-8">
              <button
                onClick={handleBuyClick}
                disabled={createPurchaseMutation.isPending}
                className="bg-[#9747FF] text-white px-8 py-3 rounded-xl font-semibold text-lg hover:bg-purple-700 transition-colors duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {createPurchaseMutation.isPending ? "Processing..." : `Buy ${selectedPackage.name} Package`}
              </button>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
