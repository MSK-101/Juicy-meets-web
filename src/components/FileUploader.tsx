"use client";

import React, { useState, useRef } from "react";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faUpload, faTimes, faPlay, faFile } from "@fortawesome/free-solid-svg-icons";

interface FileUploaderProps {
  onFileSelect: (file: File) => void;
  onFileRemove?: () => void;
  selectedFile?: File | null;
  accept?: string;
  maxSize?: number; // in MB
  label?: string;
  placeholder?: string;
  error?: string;
  disabled?: boolean;
  showPreview?: boolean;
}

export default function FileUploader({
  onFileSelect,
  onFileRemove,
  selectedFile,
  accept = "*/*",
  maxSize = 100, // 100MB default
  label = "File Upload",
  placeholder = "Click to upload or drag and drop",
  error,
  disabled = false,
  showPreview = true,
}: FileUploaderProps) {
  const [isDragOver, setIsDragOver] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = (file: File) => {
    // Validate file size
    if (file.size > maxSize * 1024 * 1024) {
      alert(`File size must be less than ${maxSize}MB`);
      return;
    }

    // Validate file type if accept is specified
    if (accept !== "*/*") {
      const acceptedTypes = accept.split(",").map(type => type.trim());
      const fileType = file.type;
      const fileExtension = `.${file.name.split('.').pop()?.toLowerCase()}`;

      const isValidType = acceptedTypes.some(type => {
        if (type.startsWith('.')) {
          return fileExtension === type.toLowerCase();
        }
        return fileType === type || fileType.startsWith(type.replace('*', ''));
      });

      if (!isValidType) {
        alert(`Please select a file with one of these types: ${accept}`);
        return;
      }
    }

    onFileSelect(file);
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      handleFileChange(file);
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);

    const file = e.dataTransfer.files[0];
    if (file) {
      handleFileChange(file);
    }
  };

  const handleRemoveFile = () => {
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
    onFileRemove?.();
  };

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return "0 Bytes";
    const k = 1024;
    const sizes = ["Bytes", "KB", "MB", "GB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];
  };

  const getFileIcon = (file: File) => {
    if (file.type.startsWith('video/')) {
      return faPlay;
    }
    return faFile;
  };

  return (
    <div className="space-y-2">
      <label className="block text-sm font-medium text-gray-700 font-poppins">
        {label}
      </label>

      <div
        className={`border-2 border-dashed rounded-lg p-6 text-center transition-colors ${
          isDragOver
            ? "border-purple-500 bg-purple-50"
            : selectedFile
            ? "border-green-500 bg-green-50"
            : "border-gray-300 hover:border-gray-400"
        } ${disabled ? "opacity-50 cursor-not-allowed" : "cursor-pointer"}`}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        onClick={() => !disabled && fileInputRef.current?.click()}
      >
        <input
          ref={fileInputRef}
          type="file"
          accept={accept}
          onChange={handleInputChange}
          className="hidden"
          disabled={disabled}
        />

        {selectedFile ? (
          <div className="space-y-3">
            <div className="flex items-center justify-center space-x-2">
              <FontAwesomeIcon
                icon={getFileIcon(selectedFile)}
                className="w-6 h-6 text-green-600"
              />
              <div className="text-left">
                <p className="text-sm font-medium text-gray-900">{selectedFile.name}</p>
                <p className="text-xs text-gray-500">{formatFileSize(selectedFile.size)}</p>
              </div>
            </div>

            {showPreview && selectedFile.type.startsWith('video/') && (
              <video
                className="max-w-full max-h-32 mx-auto rounded"
                controls
                src={URL.createObjectURL(selectedFile)}
              />
            )}

            {onFileRemove && (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  handleRemoveFile();
                }}
                className="inline-flex items-center space-x-1 text-red-600 hover:text-red-700 text-sm"
              >
                <FontAwesomeIcon icon={faTimes} className="w-4 h-4" />
                <span>Remove</span>
              </button>
            )}
          </div>
        ) : (
          <div className="space-y-2">
            <FontAwesomeIcon icon={faUpload} className="w-8 h-8 text-gray-400 mx-auto" />
            <div className="text-sm text-gray-600 font-poppins">
              <p className="font-medium">{placeholder}</p>
              <p className="text-xs mt-1">
                Max size: {maxSize}MB
                {accept !== "*/*" && ` • Accepted: ${accept}`}
              </p>
            </div>
          </div>
        )}
      </div>

                    {error && (
                <p className="text-sm text-red-600 font-poppins">{error}</p>
              )}
    </div>
  );
}
