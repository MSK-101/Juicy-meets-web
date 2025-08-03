"use client";

import React, { useState, useEffect } from "react";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faTimes } from "@fortawesome/free-solid-svg-icons";
import type { Sequence } from "@/api/services/poolsService";

interface SequenceEditModalProps {
  isOpen: boolean;
  onClose: () => void;
  sequence?: Sequence | null;
  onSave: (data: { name: string; active: boolean; video_count: number }) => void;
  isLoading?: boolean;
  mode: "create" | "edit";
}

export default function SequenceEditModal({
  isOpen,
  onClose,
  sequence,
  onSave,
  isLoading = false,
  mode
}: SequenceEditModalProps) {
  const [formData, setFormData] = useState({
    name: "",
    active: true,
    video_count: 0
  });
  const [errors, setErrors] = useState<Record<string, string>>({});

  // Initialize form data when sequence changes
  useEffect(() => {
    if (sequence && mode === "edit") {
      setFormData({
        name: sequence.name || "",
        active: sequence.active,
        video_count: sequence.video_count
      });
    } else if (mode === "create") {
      setFormData({
        name: "",
        active: true,
        video_count: 0
      });
    }
    setErrors({});
  }, [sequence, mode]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value, type, checked } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: type === "checkbox" ? checked : value
    }));

    // Clear error when field is updated
    if (errors[name]) {
      setErrors(prev => ({
        ...prev,
        [name]: ""
      }));
    }
  };

  const validateForm = () => {
    const newErrors: Record<string, string> = {};

    if (!formData.name.trim()) {
      newErrors.name = "Sequence name is required";
    }

    if (formData.video_count < 0) {
      newErrors.video_count = "Video count must be 0 or greater";
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (!validateForm()) {
      return;
    }

    onSave({
      name: formData.name.trim(),
      active: formData.active,
      video_count: formData.video_count
    });
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-2xl p-6 w-full max-w-md mx-4 shadow-xl">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-xl font-semibold text-gray-900 font-poppins">
            {mode === "create" ? "Create New Sequence" : "Edit Sequence"}
          </h2>
          <button
            onClick={onClose}
            className="w-8 h-8 bg-gray-100 text-gray-600 rounded-lg flex items-center justify-center hover:bg-gray-200 transition-colors"
          >
            <FontAwesomeIcon icon={faTimes} className="w-4 h-4" />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Name */}
          <div className="space-y-2">
            <label htmlFor="name" className="block text-sm font-medium text-gray-700 font-poppins">
              Sequence Name
            </label>
            <input
              type="text"
              id="name"
              name="name"
              value={formData.name}
              onChange={handleInputChange}
              className={`w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent bg-white text-black font-poppins ${
                errors.name ? 'border-red-500' : 'border-gray-300'
              }`}
              placeholder="Enter sequence name"
              required
            />
            {errors.name && (
              <p className="text-sm text-red-600 font-poppins">{errors.name}</p>
            )}
          </div>

          {/* Video Count */}
          <div className="space-y-2">
            <label htmlFor="video_count" className="block text-sm font-medium text-gray-700 font-poppins">
              Video Count
            </label>
            <input
              type="number"
              id="video_count"
              name="video_count"
              value={formData.video_count}
              onChange={handleInputChange}
              min="0"
              className={`w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent bg-white text-black font-poppins ${
                errors.video_count ? 'border-red-500' : 'border-gray-300'
              }`}
              placeholder="Enter video count"
              required
            />
            {sequence && (
              <p className="text-xs text-gray-500 font-poppins">
                Currently has {sequence.videos_count} videos
              </p>
            )}
            {errors.video_count && (
              <p className="text-sm text-red-600 font-poppins">{errors.video_count}</p>
            )}
          </div>

          {/* Active Status */}
          <div className="flex items-center justify-between">
            <label htmlFor="active" className="block text-sm font-medium text-gray-700 font-poppins">
              Active Status
            </label>
            <button
              type="button"
              onClick={() => setFormData(prev => ({ ...prev, active: !prev.active }))}
              className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors duration-200 ${
                formData.active ? 'bg-purple-600' : 'bg-gray-300'
              }`}
            >
              <span
                className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform duration-200 ${
                  formData.active ? 'translate-x-6' : 'translate-x-1'
                }`}
              />
            </button>
          </div>

          {/* Buttons */}
          <div className="flex justify-end space-x-3 pt-4">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 border border-gray-300 rounded-lg text-gray-700 font-poppins hover:bg-gray-50 transition-colors"
              disabled={isLoading}
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isLoading}
              className="px-4 py-2 bg-purple-600 text-white rounded-lg font-poppins hover:bg-purple-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isLoading ? "Saving..." : mode === "create" ? "Create Sequence" : "Save Changes"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
