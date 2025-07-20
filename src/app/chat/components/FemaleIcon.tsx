import React from "react";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faVenus, faTimes } from "@fortawesome/free-solid-svg-icons";

export default function FemaleIcon() {
  // Hard-coded disabled state for now
  const isDisabled = false;

  return (
    <div className="relative">
      <button
        className={`flex items-center justify-center w-12 h-12 rounded-full transition-colors duration-200 shadow-lg ${
          isDisabled
            ? 'bg-gray-400 cursor-not-allowed'
            : 'bg-pink-500 hover:bg-pink-600'
        }`}
        disabled={isDisabled}
      >
        <FontAwesomeIcon
          icon={faVenus}
          className="w-6 h-6 text-white"
        />
      </button>

      {/* Cross overlay when disabled */}
      {isDisabled && (
        <div className="absolute inset-0 flex items-center justify-center">
          <FontAwesomeIcon
            icon={faTimes}
            className="w-8 h-8 text-red-500 drop-shadow-lg"
          />
        </div>
      )}
    </div>
  );
}
