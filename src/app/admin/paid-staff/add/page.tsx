"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faArrowLeft, faSave } from "@fortawesome/free-solid-svg-icons";
import { staffService } from "@/api/services/staffService";
import { usePools, useSequences } from "@/api/hooks/usePoolsQueries";

export default function AddStaff() {
  const router = useRouter();

  const [formData, setFormData] = useState({
    user: {
      email: "",
      age: "",
      gender: ""
    },
    staff_assignment: {
      pool_id: "",
      sequence_id: "",
      status: "active"
    }
  });

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Fetch data using existing hooks
  const { data: poolsData, isLoading: poolsLoading } = usePools();
  const { data: sequencesData, isLoading: sequencesLoading } = useSequences(
    formData.staff_assignment.pool_id ? Number(formData.staff_assignment.pool_id) : 0
  );

  const handleInputChange = (section: 'user' | 'staff_assignment', field: string, value: string) => {
    setFormData(prev => ({
      ...prev,
      [section]: {
        ...prev[section],
        [field]: value
      }
    }));

    // Clear sequence when pool changes
    if (section === 'staff_assignment' && field === 'pool_id') {
      setFormData(prev => ({
        ...prev,
        staff_assignment: {
          ...prev.staff_assignment,
          pool_id: value,
          sequence_id: ""
        }
      }));
    }
  };

  const getSequencesForPool = (poolId: string) => {
    if (!poolId || !sequencesData) return [];
    return sequencesData.filter(seq => seq.pool_id === parseInt(poolId));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError(null);

    try {
      // Validate required fields
      if (!formData.user.email || !formData.staff_assignment.pool_id || !formData.staff_assignment.sequence_id) {
        throw new Error("Please fill in all required fields");
      }

      // Prepare data with proper types
      const submitData = {
        user: {
          email: formData.user.email,
          age: formData.user.age ? parseInt(formData.user.age) : undefined,
          gender: (formData.user.gender as "male" | "female" | "other") || undefined
        },
        staff_assignment: {
          pool_id: parseInt(formData.staff_assignment.pool_id),
          sequence_id: parseInt(formData.staff_assignment.sequence_id),
          status: formData.staff_assignment.status as "active" | "inactive"
        }
      };

      // Create staff member
      const response = await staffService.createStaff(submitData);

      if (response.success) {
        // Redirect back to staff page
        router.push("/admin/paid-staff");
      } else {
        setError("Failed to create staff member");
      }
    } catch (error) {
      console.error("Error creating staff:", error);
      setError(error instanceof Error ? error.message : "Failed to create staff member");
    } finally {
      setSaving(false);
    }
  };

  const pools = poolsData || [];
  const sequences = getSequencesForPool(formData.staff_assignment.pool_id);

  if (poolsLoading) {
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
          <h1 className="text-2xl font-semibold text-gray-900 font-poppins">Add New Staff Member</h1>
        </div>
      </div>

      {/* Error Message */}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <p className="text-red-600 font-poppins">{error}</p>
        </div>
      )}

      {/* Form */}
      <div className="bg-gray-100 rounded-2xl p-6 shadow-md">
        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Email */}
            <div className="space-y-2">
              <label htmlFor="email" className="block text-sm font-medium text-gray-700 font-poppins">
                Email Address *
              </label>
              <input
                type="email"
                id="email"
                value={formData.user.email}
                onChange={(e) => handleInputChange('user', 'email', e.target.value)}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent bg-white text-black font-poppins"
                placeholder="Enter email address"
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
                value={formData.user.age}
                onChange={(e) => handleInputChange('user', 'age', e.target.value)}
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
                value={formData.user.gender}
                onChange={(e) => handleInputChange('user', 'gender', e.target.value)}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent bg-white text-black font-poppins"
              >
                <option value="">Select gender</option>
                <option value="male">Male</option>
                <option value="female">Female</option>
                <option value="other">Other</option>
              </select>
            </div>

            {/* Pool */}
            <div className="space-y-2">
              <label htmlFor="pool_id" className="block text-sm font-medium text-gray-700 font-poppins">
                Pool *
              </label>
              <select
                id="pool_id"
                value={formData.staff_assignment.pool_id}
                onChange={(e) => handleInputChange('staff_assignment', 'pool_id', e.target.value)}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent bg-white text-black font-poppins"
                required
              >
                <option value="">Select pool</option>
                {pools.map(pool => (
                  <option key={pool.id} value={pool.id}>{pool.name}</option>
                ))}
              </select>
            </div>

            {/* Sequence */}
            <div className="space-y-2">
              <label htmlFor="sequence_id" className="block text-sm font-medium text-gray-700 font-poppins">
                Sequence *
              </label>
              <select
                id="sequence_id"
                value={formData.staff_assignment.sequence_id}
                onChange={(e) => handleInputChange('staff_assignment', 'sequence_id', e.target.value)}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent bg-white text-black font-poppins"
                required
                disabled={!formData.staff_assignment.pool_id || sequencesLoading}
              >
                <option value="">
                  {!formData.staff_assignment.pool_id
                    ? "Select a pool first"
                    : sequencesLoading
                      ? "Loading sequences..."
                      : "Select sequence"
                  }
                </option>
                {sequences.map(sequence => (
                  <option key={sequence.id} value={sequence.id}>{sequence.name}</option>
                ))}
              </select>
            </div>



            {/* Status */}
            <div className="space-y-2">
              <label htmlFor="status" className="block text-sm font-medium text-gray-700 font-poppins">
                Status *
              </label>
              <select
                id="status"
                value={formData.staff_assignment.status}
                onChange={(e) => handleInputChange('staff_assignment', 'status', e.target.value)}
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
              disabled={saving}
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving}
              className="px-6 py-2 bg-purple-600 text-white rounded-lg font-poppins hover:bg-purple-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center space-x-2"
            >
              <FontAwesomeIcon icon={faSave} className="w-4 h-4" />
              <span>{saving ? "Creating..." : "Create Staff Member"}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
