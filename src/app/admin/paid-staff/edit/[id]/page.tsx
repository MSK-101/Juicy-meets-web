"use client";

import React, { useState, useEffect } from "react";
import { useRouter, useParams } from "next/navigation";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faArrowLeft, faSave } from "@fortawesome/free-solid-svg-icons";

interface Staff {
  id: string;
  name: string;
  username: string;
  email: string;
  totalActivityTime: string;
  period: string;
  onlineStatus: "online" | "offline";
  assignedGender: "M" | "F";
  status: "active" | "disabled";
  regDate: string;
}

export default function EditStaff() {
  const router = useRouter();
  const params = useParams();
  const staffId = params.id as string;

  const [formData, setFormData] = useState<Staff>({
    id: "",
    name: "",
    username: "",
    email: "",
    totalActivityTime: "",
    period: "Today",
    onlineStatus: "offline",
    assignedGender: "M",
    status: "active",
    regDate: ""
  });

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const fetchStaffData = async () => {
      try {
        // Mock data - replace with actual API call
        const mockStaff: Staff[] = [
          {
            id: "1",
            name: "Anna",
            username: "anna143",
            email: "anna143@gmail.com",
            totalActivityTime: "5h20m",
            period: "Today",
            onlineStatus: "online",
            assignedGender: "F",
            status: "active",
            regDate: "06/7/2025"
          },
          {
            id: "2",
            name: "Mark",
            username: "mark09",
            email: "mark09@gmail.com",
            totalActivityTime: "1h20m",
            period: "Today",
            onlineStatus: "offline",
            assignedGender: "M",
            status: "active",
            regDate: "04/24/2025"
          }
        ];

        const staff = mockStaff.find(s => s.id === staffId);
        if (staff) {
          setFormData(staff);
        }
      } catch (error) {
        console.error("Failed to fetch staff data:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchStaffData();
  }, [staffId]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);

    try {
      // Mock API call - replace with actual API
      console.log("Updated Staff Data:", formData);

      // Simulate API delay
      await new Promise(resolve => setTimeout(resolve, 1000));

      // Redirect back to staff page
      router.push("/admin/paid-staff");
    } catch (error) {
      console.error("Error updating staff:", error);
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
            {/* Name */}
            <div className="space-y-2">
              <label htmlFor="name" className="block text-sm font-medium text-gray-700 font-poppins">
                Name
              </label>
              <input
                type="text"
                id="name"
                name="name"
                value={formData.name}
                onChange={handleInputChange}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent bg-white text-black font-poppins"
                placeholder="Enter name"
                required
              />
            </div>

            {/* Username */}
            <div className="space-y-2">
              <label htmlFor="username" className="block text-sm font-medium text-gray-700 font-poppins">
                Username
              </label>
              <input
                type="text"
                id="username"
                name="username"
                value={formData.username}
                onChange={handleInputChange}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent bg-white text-black font-poppins"
                placeholder="Enter username"
                required
              />
            </div>

            {/* Email */}
            <div className="space-y-2">
              <label htmlFor="email" className="block text-sm font-medium text-gray-700 font-poppins">
                Email Address
              </label>
              <input
                type="email"
                id="email"
                name="email"
                value={formData.email}
                onChange={handleInputChange}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent bg-white text-black font-poppins"
                placeholder="Enter email"
                required
              />
            </div>

            {/* Total Activity Time */}
            <div className="space-y-2">
              <label htmlFor="totalActivityTime" className="block text-sm font-medium text-gray-700 font-poppins">
                Total Activity Time
              </label>
              <input
                type="text"
                id="totalActivityTime"
                name="totalActivityTime"
                value={formData.totalActivityTime}
                onChange={handleInputChange}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent bg-white text-black font-poppins"
                placeholder="e.g., 5h20m"
                required
              />
            </div>

            {/* Period */}
            <div className="space-y-2">
              <label htmlFor="period" className="block text-sm font-medium text-gray-700 font-poppins">
                Period
              </label>
              <select
                id="period"
                name="period"
                value={formData.period}
                onChange={handleInputChange}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent bg-white text-black font-poppins"
                required
              >
                <option value="Today">Today</option>
                <option value="Weekly">Weekly</option>
                <option value="Monthly">Monthly</option>
              </select>
            </div>

            {/* Online Status */}
            <div className="space-y-2">
              <label htmlFor="onlineStatus" className="block text-sm font-medium text-gray-700 font-poppins">
                Online/Offline Status
              </label>
              <select
                id="onlineStatus"
                name="onlineStatus"
                value={formData.onlineStatus}
                onChange={handleInputChange}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent bg-white text-black font-poppins"
                required
              >
                <option value="online">Online</option>
                <option value="offline">Offline</option>
              </select>
            </div>

            {/* Assigned Gender */}
            <div className="space-y-2">
              <label htmlFor="assignedGender" className="block text-sm font-medium text-gray-700 font-poppins">
                Assigned Gender
              </label>
              <select
                id="assignedGender"
                name="assignedGender"
                value={formData.assignedGender}
                onChange={handleInputChange}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent bg-white text-black font-poppins"
                required
              >
                <option value="M">Male</option>
                <option value="F">Female</option>
              </select>
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
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent bg-white text-black font-poppins"
                required
              >
                <option value="active">Active</option>
                <option value="disabled">Disabled</option>
              </select>
            </div>

            {/* Registration Date */}
            <div className="space-y-2">
              <label htmlFor="regDate" className="block text-sm font-medium text-gray-700 font-poppins">
                Registration Date
              </label>
              <input
                type="text"
                id="regDate"
                name="regDate"
                value={formData.regDate}
                onChange={handleInputChange}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent bg-white text-black font-poppins"
                placeholder="MM/DD/YYYY"
                required
              />
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
