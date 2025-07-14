import React, { useState } from "react";

export default function FlagButton() {
  const [showModal, setShowModal] = useState(false);

  return (
    <div className="relative flex items-center justify-center">
      <button
        className="w-12 h-12 gradient-border rounded-full bg-black border-2"
        onClick={() => setShowModal(true)}
        aria-label="Report"
      >
        {/* Flag PNG icon */}
        <img src="/flag.png" alt="Flag" className="mx-auto" style={{ width: 25, height: 21 }} />
      </button>
      {/* Modal/Alert */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="bg-[#181028] border-2 gradient-border rounded-2xl shadow-xl p-6 min-w-[300px] max-w-[90vw] flex flex-col items-center">
            <div className="text-xl font-bold text-white mb-2">Report</div>
            <div className="text-white mb-6 text-center">Do you want to report this user?</div>
            <div className="flex gap-4 w-full justify-center">
              <button
                className="px-4 py-2 rounded-lg bg-gray-700 text-white hover:bg-gray-600 transition"
                onClick={() => setShowModal(false)}
              >
                Cancel
              </button>
              <button
                className="px-4 py-2 rounded-lg bg-[#a91dfd] text-white font-bold hover:bg-[#8a1bc7] transition"
                onClick={() => setShowModal(false)}
              >
                Report
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
