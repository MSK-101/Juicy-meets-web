import React from "react";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faMars } from "@fortawesome/free-solid-svg-icons";

export default function MaleIcon() {
  return (
    <button className="flex items-center justify-center w-12 h-12 rounded-full bg-blue-500 hover:bg-blue-600 transition-colors duration-200 shadow-lg">
      <FontAwesomeIcon
        icon={faMars}
        className="w-6 h-6 text-white"
      />
    </button>
  );
}
