import React, { useState } from "react";
import { createPortal } from "react-dom";
import { reportService } from "@/api/services/reportService";

interface FlagButtonProps {
  reportedUserId?: string;
  onReportSuccess?: () => void;
}

export default function FlagButton({ reportedUserId, onReportSuccess }: FlagButtonProps) {
  const [showModal, setShowModal] = useState(false);
  const [isReporting, setIsReporting] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);
  const [mounted, setMounted] = useState(false);

  // Ensure component is mounted before rendering portal
  React.useEffect(() => {
    setMounted(true);
  }, []);

  const handleReport = async () => {
    // If no user ID (video), just show success without backend call
    if (!reportedUserId) {
      setShowModal(false);
      setShowSuccess(true);

      // Hide success message after 3 seconds
      setTimeout(() => {
        setShowSuccess(false);
      }, 3000);
      return;
    }

    setIsReporting(true);

    try {
      console.log('Reporting user:', reportedUserId);
      const result = await reportService.reportUser(reportedUserId);
      console.log('Report result:', result);

      // Handle different response formats
      if (result && result.success === true) {
        setShowModal(false);
        setShowSuccess(true);

        // Hide success message after 3 seconds
        setTimeout(() => {
          setShowSuccess(false);
        }, 3000);

        // Call success callback if provided
        if (onReportSuccess) {
          onReportSuccess();
        }
      } else {
        const errorMessage = result?.message || "Failed to report user";
        console.error('Report failed:', errorMessage);
        alert(errorMessage);
      }
    } catch (error) {
      console.error("Report error:", error);
      alert("Failed to report user. Please try again.");
    } finally {
      setIsReporting(false);
    }
  };

  return (
    <div className="relative">
      <button
        className="w-12 h-12 gradient-border rounded-full bg-black border-2 flex items-center justify-center"
        onClick={() => setShowModal(true)}
        aria-label="Report"
      >
        {/* Flag PNG icon */}
        <img src="/flag.png" alt="Flag" className="w-5 h-4 md:w-[25px] md:h-[21px]" />
      </button>

      {/* Confirmation Modal - Using Portal */}
      {mounted && showModal && createPortal(
        <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/40 p-4">
          <div className="bg-[#181028] border-2 gradient-border rounded-2xl shadow-xl p-6 w-full max-w-sm mx-auto flex flex-col items-center">
            <div className="text-xl font-bold text-white mb-2">Report User</div>
            <div className="text-white mb-6 text-center text-sm">
              Are you sure you want to report this user? This action will block them.
            </div>
            <div className="flex gap-3 w-full">
              <button
                className="flex-1 px-4 py-2 rounded-lg bg-gray-700 text-white hover:bg-gray-600 transition"
                onClick={() => setShowModal(false)}
                disabled={isReporting}
              >
                Cancel
              </button>
              <button
                className="flex-1 px-4 py-2 rounded-lg bg-red-600 text-white font-bold hover:bg-red-700 transition disabled:opacity-50"
                onClick={handleReport}
                disabled={isReporting}
              >
                {isReporting ? "Reporting..." : "Report"}
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* Success Message - Using Portal */}
      {mounted && showSuccess && createPortal(
        <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/40 p-4">
          <div className="bg-[#181028] border-2 gradient-border rounded-2xl shadow-xl p-6 w-full max-w-sm mx-auto flex flex-col items-center">
            <div className="text-xl font-bold text-green-400 mb-2">✓ Success!</div>
            <div className="text-white mb-4 text-center text-sm">
              User has been reported and blocked successfully.
            </div>
            <button
              className="w-full px-4 py-2 rounded-lg bg-[#a91dfd] text-white font-bold hover:bg-[#8a1bc7] transition"
              onClick={() => setShowSuccess(false)}
            >
              OK
            </button>
          </div>
        </div>,
        document.body
      )}
    </div>
  );
}
