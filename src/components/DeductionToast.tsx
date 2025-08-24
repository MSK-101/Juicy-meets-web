import { useEffect, useState } from 'react';

interface DeductionToastProps {
  isVisible: boolean;
  message: string;
  type: 'success' | 'warning' | 'error';
  onClose: () => void;
}

export default function DeductionToast({ isVisible, message, type, onClose }: DeductionToastProps) {
  useEffect(() => {
    if (isVisible) {
      const timer = setTimeout(() => {
        onClose();
      }, 5000); // Auto-hide after 5 seconds

      return () => clearTimeout(timer);
    }
  }, [isVisible, onClose]);

  if (!isVisible) return null;

  const bgColor = {
    success: 'bg-green-600',
    warning: 'bg-yellow-600',
    error: 'bg-red-600'
  }[type];

  const icon = {
    success: '✅',
    warning: '⚠️',
    error: '❌'
  }[type];

  return (
    <div className={`fixed top-4 right-4 z-50 ${bgColor} text-white px-6 py-4 rounded-lg shadow-lg max-w-sm animate-slide-in`}>
      <div className="flex items-center space-x-3">
        <span className="text-xl">{icon}</span>
        <div>
          <p className="font-medium">{message}</p>
        </div>
        <button
          onClick={onClose}
          className="ml-4 text-white hover:text-gray-200 focus:outline-none"
        >
          ✕
        </button>
      </div>
    </div>
  );
}
