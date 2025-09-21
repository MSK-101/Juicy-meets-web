"use client";

import React, { useState, useEffect } from "react";
import { useRouter, useParams } from "next/navigation";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faArrowLeft, faSave } from "@fortawesome/free-solid-svg-icons";
import { staffService, Staff } from "@/api/services/staffService";
import { usePools, useSequences } from "@/api/hooks/usePoolsQueries";

export default function EditStaff() {
  const router = useRouter();
  const params = useParams();
  const staffId = params.id as string;

  const [formData, setFormData] = useState<Staff>({
    id: "",
    name: "",
    username: "",
    email: "",
    age: undefined,
    totalActivityTime: "",
    period: "",
    status: "offline",
    gender: "male",
    assignmentStatus: "active",
    regDate: "",
    pool: "",
    sequence: "",
    lastActivityAt: "",
    pool_id: 0,
    sequence_id: 0
  });

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Fetch data using existing hooks
  const { data: poolsData, isLoading: poolsLoading } = usePools();
  const { data: sequencesData, isLoading: sequencesLoading } = useSequences(
    formData.pool_id ? formData.pool_id : 0
  );

  useEffect(() => {
    fetchStaffData();
  }, [staffId]);

  const fetchStaffData = async () => {
    try {
      setLoading(true);
      setError(null);
      const staffData = await staffService.getStaffMember(staffId);
      setFormData(staffData);
    } catch (error) {
      
      setError("Failed to fetch staff data. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const handleInputChange = (field: string, value: string | number | undefined) => {
    setFormData(prev => ({
      ...prev,
      [field]: value
    }));

    // Clear sequence when pool changes
    if (field === 'pool_id') {
      setFormData(prev => ({
        ...prev,
        pool_id: value as number,
        sequence_id: 0
      }));
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError(null);

    try {
      // Prepare data with proper types
      const submitData = {
        user: {
          email: formData.email,
          age: formData.age || undefined,
          gender: formData.gender as "male" | "female" | "other" | undefined
        },
        staff_assignment: {
          pool_id: formData.pool_id || 0,
          sequence_id: formData.sequence_id || 0,
          status: formData.assignmentStatus as "active" | "inactive"
        }
      };

      // Update staff member
      const response = await staffService.updateStaff(staffId, submitData);

      if (response.success) {
        // Redirect back to staff page
        router.push("/admin/paid-staff");
      } else {
        setError("Failed to update staff member");
      }
    } catch (error) {
      
      setError(error instanceof Error ? error.message : "Failed to update staff member");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-600"></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <p className="text-red-600 mb-4">{error}</p>
          <button
            onClick={fetchStaffData}
            className="bg-purple-600 text-white px-4 py-2 rounded-lg hover:bg-purple-700 transition-colors"
          >
            Retry
          </button>
        </div>
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
          <h1 className="text-2xl font-semibold text-gray-900 font-poppins">Edit Staff Member</h1>
        </div>
      </div>

      {/* Form */}
      <div className="bg-gray-100 rounded-2xl p-6 shadow-md">
        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Email */}
            <div className="space-y-2">
              <label htmlFor="email" className="block text-sm font-medium text-gray-700 font-poppins">
                Email Address
              </label>
              <input
                type="email"
                id="email"
                value={formData.email}
                onChange={(e) => handleInputChange('email', e.target.value)}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent bg-white text-black font-poppins"
                placeholder="Enter email"
                required
              />
            </div>

            {/* Age */}
            <div className="space-y-2">
              <label htmlFor="age" className="block text-sm font-medium text-gray-700 font-poppins">
                Age
              </label>
                              <input
                  type="number"
                  id="age"
                  value={formData.age || ''}
                  onChange={(e) => handleInputChange('age', e.target.value ? parseInt(e.target.value) : undefined)}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent bg-white text-black font-poppins"
                  placeholder="Enter age"
                  min="18"
                  max="100"
                />
            </div>

            {/* Gender */}
            <div className="space-y-2">
              <label htmlFor="gender" className="block text-sm font-medium text-gray-700 font-poppins">
                Gender
              </label>
              <select
                id="gender"
                value={formData.gender || ''}
                onChange={(e) => handleInputChange('gender', e.target.value)}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent bg-white text-black font-poppins"
              >
                <option value="">Select gender</option>
                <option value="male">Male</option>
                <option value="female">Female</option>
                <option value="other">Other</option>
              </select>
            </div>

            {/* Pool Selection */}
            <div className="space-y-2">
              <label htmlFor="pool_id" className="block text-sm font-medium text-gray-700 font-poppins">
                Pool *
              </label>
              <select
                id="pool_id"
                value={formData.pool_id || ''}
                onChange={(e) => handleInputChange('pool_id', parseInt(e.target.value))}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent bg-white text-black font-poppins"
                required
                disabled={poolsLoading}
              >
                <option value="">
                  {poolsLoading ? "Loading pools..." : "Select pool"}
                </option>
                {poolsData?.map(pool => (
                  <option key={pool.id} value={pool.id}>{pool.name}</option>
                ))}
              </select>
            </div>

            {/* Sequence Selection */}
            <div className="space-y-2">
              <label htmlFor="sequence_id" className="block text-sm font-medium text-gray-700 font-poppins">
                Sequence *
              </label>
              <select
                id="sequence_id"
                value={formData.sequence_id || ''}
                onChange={(e) => handleInputChange('sequence_id', parseInt(e.target.value))}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent bg-white text-black font-poppins"
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
                {sequencesData?.map(sequence => (
                  <option key={sequence.id} value={sequence.id}>{sequence.name}</option>
                ))}
              </select>
            </div>

            {/* Status */}
            <div className="space-y-2">
              <label htmlFor="status" className="block text-sm font-medium text-gray-700 font-poppins">
                Status
              </label>
              <select
                id="status"
                value={formData.assignmentStatus || 'active'}
                onChange={(e) => handleInputChange('assignmentStatus', e.target.value)}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent bg-white text-black font-poppins"
                required
              >
                <option value="active">Active</option>
                <option value="inactive">Inactive</option>
              </select>
            </div>

          </div>

          {/* Submit Button */}
          <div className="flex justify-end space-x-4 pt-6">
            <button
              type="button"
              onClick={() => router.back()}
              className="px-6 py-2 border border-gray-300 rounded-lg text-gray-700 font-poppins hover:bg-gray-50 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving}
              className="px-6 py-2 bg-purple-600 text-white rounded-lg font-poppins hover:bg-purple-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center space-x-2"
            >
              <FontAwesomeIcon icon={faSave} className="w-4 h-4" />
              <span>{saving ? "Saving..." : "Save Changes"}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
