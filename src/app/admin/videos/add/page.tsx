"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faArrowLeft } from "@fortawesome/free-solid-svg-icons";
import { useCreateVideo } from "@/api/hooks/useVideosQueries";
import { usePools, useSequences } from "@/api/hooks/usePoolsQueries";
import { useVideoFilters } from "@/api/hooks/useVideosQueries";
import FileUploader from "@/components/FileUploader";
import type { CreateVideoRequest } from "@/api/services/videosService";

export default function AddVideo() {
  const router = useRouter();
  const [formData, setFormData] = useState({
    name: "",
    gender: "",
    status: "",
    pool_id: "",
    sequence_id: "",
  });
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});

  // Fetch data
  const { data: poolsData, isLoading: poolsLoading } = usePools();
  const { data: filtersData, isLoading: filtersLoading } = useVideoFilters();
  const { data: sequencesData, isLoading: sequencesLoading } = useSequences(
    formData.pool_id ? Number(formData.pool_id) : 0
  );

  const createVideoMutation = useCreateVideo();

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));

    // Clear sequence when pool changes
    if (name === 'pool_id') {
      setFormData(prev => ({
        ...prev,
        [name]: value,
        sequence_id: ""
      }));
    }

    // Clear error when field is updated
    if (errors[name]) {
      setErrors(prev => ({
        ...prev,
        [name]: ""
      }));
    }
  };

  const handleFileSelect = (file: File) => {
    setSelectedFile(file);
    if (errors.video_file) {
      setErrors(prev => ({
        ...prev,
        video_file: ""
      }));
    }
  };

  const handleFileRemove = () => {
    setSelectedFile(null);
  };

  const validateForm = () => {
    const newErrors: Record<string, string> = {};

    if (!formData.name.trim()) {
      newErrors.name = "Video name is required";
    }

    if (!formData.gender) {
      newErrors.gender = "Please select a gender";
    }

    if (!formData.status) {
      newErrors.status = "Please select a status";
    }

    if (!formData.pool_id) {
      newErrors.pool_id = "Please select a pool";
    }

    if (!formData.sequence_id) {
      newErrors.sequence_id = "Please select a sequence";
    }

    if (!selectedFile) {
      newErrors.video_file = "Please select a video file";
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!validateForm()) {
      return;
    }

    if (!selectedFile) {
      setErrors(prev => ({ ...prev, video_file: "Please select a video file" }));
      return;
    }

    const videoData: CreateVideoRequest = {
      name: formData.name,
      gender: formData.gender as 'male' | 'female' | 'other',
      status: formData.status as 'active' | 'pending' | 'inactive',
      pool_id: Number(formData.pool_id),
      sequence_id: Number(formData.sequence_id),
      video_file: selectedFile,
    };

    try {
      await createVideoMutation.mutateAsync(videoData);
      router.push("/admin/videos");
                 } catch (error: unknown) {
      
      // Handle specific error messages from the API
      if (error && typeof error === 'object' && 'response' in error) {
        const response = (error as { response?: { data?: { errors?: Record<string, unknown> } } }).response;
        if (response?.data?.errors) {
          const apiErrors = response.data.errors;
          const newErrors: Record<string, string> = {};

          Object.keys(apiErrors).forEach(key => {
            newErrors[key] = Array.isArray(apiErrors[key]) ? apiErrors[key][0] : apiErrors[key];
          });

          setErrors(newErrors);
        } else {
          setErrors({ general: "Failed to create video" });
        }
      } else {
        setErrors({ general: error instanceof Error ? error.message : "Failed to create video" });
      }
    }
  };

  const pools = poolsData || [];
  const sequences = sequencesData || [];
  const filters = filtersData || { genders: [], statuses: [] };

  if (poolsLoading || filtersLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-600"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-4">
          <button
            onClick={() => router.back()}
            className="flex items-center space-x-2 text-gray-600 hover:text-gray-900 transition-colors"
          >
            <FontAwesomeIcon icon={faArrowLeft} className="w-4 h-4" />
            <span className="font-poppins">Back</span>
          </button>
          <h1 className="text-2xl font-semibold text-gray-900 font-poppins">Add New Video</h1>
        </div>
      </div>

      {/* Form */}
      <div className="bg-gray-100 rounded-2xl p-6 shadow-md">
        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Video Upload */}
          <FileUploader
            onFileSelect={handleFileSelect}
            onFileRemove={handleFileRemove}
            selectedFile={selectedFile}
            accept="video/*"
            maxSize={100}
            label="Video Upload"
            placeholder="Click to upload or drag and drop video file"
            error={errors.video_file}
            disabled={createVideoMutation.isPending}
          />

          {/* Video Name */}
          <div className="space-y-2">
            <label htmlFor="name" className="block text-sm font-medium text-gray-700 font-poppins">
              Video Name
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
              placeholder="Enter video name"
              required
            />
            {errors.name && (
              <p className="text-sm text-red-600 font-poppins">{errors.name}</p>
            )}
          </div>

          {/* Gender */}
          <div className="space-y-2">
            <label htmlFor="gender" className="block text-sm font-medium text-gray-700 font-poppins">
              Gender
            </label>
            <select
              id="gender"
              name="gender"
              value={formData.gender}
              onChange={handleInputChange}
              className={`w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent bg-white text-black font-poppins ${
                errors.gender ? 'border-red-500' : 'border-gray-300'
              }`}
              required
            >
              <option value="">Select gender</option>
              {filters.genders.map((gender) => (
                <option key={gender.value} value={gender.value}>
                  {gender.label}
                </option>
              ))}
            </select>
            {errors.gender && (
              <p className="text-sm text-red-600 font-poppins">{errors.gender}</p>
            )}
          </div>

          {/* Pool */}
          <div className="space-y-2">
            <label htmlFor="pool_id" className="block text-sm font-medium text-gray-700 font-poppins">
              Pool
            </label>
            <select
              id="pool_id"
              name="pool_id"
              value={formData.pool_id}
              onChange={handleInputChange}
              className={`w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent bg-white text-black font-poppins ${
                errors.pool_id ? 'border-red-500' : 'border-gray-300'
              }`}
              required
            >
              <option value="">Select pool</option>
              {pools.map((pool) => (
                <option key={pool.id} value={pool.id}>
                  {pool.name}
                </option>
              ))}
            </select>
            {errors.pool_id && (
              <p className="text-sm text-red-600 font-poppins">{errors.pool_id}</p>
            )}
          </div>

          {/* Sequence */}
          <div className="space-y-2">
            <label htmlFor="sequence_id" className="block text-sm font-medium text-gray-700 font-poppins">
              Sequence
            </label>
            <select
              id="sequence_id"
              name="sequence_id"
              value={formData.sequence_id}
              onChange={handleInputChange}
              className={`w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent bg-white text-black font-poppins ${
                errors.sequence_id ? 'border-red-500' : 'border-gray-300'
              }`}
              required
              disabled={!formData.pool_id || sequencesLoading}
            >
              <option value="">
                {!formData.pool_id
                  ? "Select a pool first"
                  : sequencesLoading
                    ? "Loading sequences..."
                    : "Select sequence"
                }
              </option>
              {sequences.map((sequence) => (
                <option key={sequence.id} value={sequence.id}>
                  {sequence.name}
                </option>
              ))}
            </select>
            {errors.sequence_id && (
              <p className="text-sm text-red-600 font-poppins">{errors.sequence_id}</p>
            )}
          </div>

          {/* Status */}
          <div className="space-y-2">
            <label htmlFor="status" className="block text-sm font-medium text-gray-700 font-poppins">
              Status
            </label>
            <select
              id="status"
              name="status"
              value={formData.status}
              onChange={handleInputChange}
              className={`w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent bg-white text-black font-poppins ${
                errors.status ? 'border-red-500' : 'border-gray-300'
              }`}
              required
            >
              <option value="">Select status</option>
              {filters.statuses.map((status) => (
                <option key={status.value} value={status.value}>
                  {status.label}
                </option>
              ))}
            </select>
            {errors.status && (
              <p className="text-sm text-red-600 font-poppins">{errors.status}</p>
            )}
          </div>

          {/* General Error */}
          {errors.general && (
            <div className="text-red-600 text-sm font-poppins bg-red-50 p-3 rounded-lg">
              {errors.general}
            </div>
          )}

          {/* Submit Button */}
          <div className="flex justify-end space-x-4 pt-6">
            <button
              type="button"
              onClick={() => router.back()}
              className="px-6 py-2 border border-gray-300 rounded-lg text-gray-700 font-poppins hover:bg-gray-50 transition-colors"
              disabled={createVideoMutation.isPending}
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={createVideoMutation.isPending || !selectedFile}
              className="px-6 py-2 bg-purple-600 text-white rounded-lg font-poppins hover:bg-purple-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {createVideoMutation.isPending ? "Uploading..." : "Upload Video"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
