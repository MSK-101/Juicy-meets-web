"use client";

import React, { useState, useEffect, useCallback } from "react";
import DataTable from "@/components/admin/DataTable";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faTrash, faPlus, faEye, faEyeSlash } from "@fortawesome/free-solid-svg-icons";
import { useAdminAuthStore } from "@/store/adminAuth";
import { adminAuthService } from "@/api/services/adminAuthService";

interface Admin {
  id: number;
  email: string;
  display_name: string;
  role: string | null;
  created_at: string;
  updated_at: string;
}

interface PasswordFormData {
  oldPassword: string;
  newPassword: string;
  confirmPassword: string;
}

interface NewAdminFormData {
  email: string;
  password: string;
  confirmPassword: string;
}

export default function Settings() {
  // Get current admin from store
  const { admin: currentAdmin } = useAdminAuthStore();

  // Password change state
  const [passwordData, setPasswordData] = useState<PasswordFormData>({
    oldPassword: "",
    newPassword: "",
    confirmPassword: ""
  });
  const [showOldPassword, setShowOldPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [passwordLoading, setPasswordLoading] = useState(false);

  // New admin state
  const [newAdminData, setNewAdminData] = useState<NewAdminFormData>({
    email: "",
    password: "",
    confirmPassword: ""
  });
  const [showNewAdminPassword, setShowNewAdminPassword] = useState(false);
  const [showNewAdminConfirmPassword, setShowNewAdminConfirmPassword] = useState(false);
  const [newAdminLoading, setNewAdminLoading] = useState(false);
  const [showNewAdminForm, setShowNewAdminForm] = useState(false);

  // Admins state
  const [admins, setAdmins] = useState<Admin[]>([]);

  const loadAdmins = useCallback(async () => {
    try {
      const adminsData = await adminAuthService.getAdmins();
      setAdmins(adminsData);
    } catch (error) {

      // Fallback to current admin if API fails
      if (currentAdmin) {
        setAdmins([currentAdmin]);
      }
    }
  }, [currentAdmin]);

  // Load admins on component mount
  useEffect(() => {
    loadAdmins();
  }, [loadAdmins]);

  const handlePasswordChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setPasswordData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const handleNewAdminChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setNewAdminData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const handlePasswordSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setPasswordLoading(true);

    try {
      // Validate passwords match
      if (passwordData.newPassword !== passwordData.confirmPassword) {
        alert("New passwords do not match!");
        return;
      }

      await adminAuthService.changePassword(passwordData.oldPassword, passwordData.newPassword);

      // Reset form
      setPasswordData({
        oldPassword: "",
        newPassword: "",
        confirmPassword: ""
      });

      alert("Password updated successfully!");
    } catch (error) {

      alert("Failed to update password. Please try again.");
    } finally {
      setPasswordLoading(false);
    }
  };

  const handleNewAdminSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setNewAdminLoading(true);

    try {
      // Validate passwords match
      if (newAdminData.password !== newAdminData.confirmPassword) {
        alert("Passwords do not match!");
        return;
      }

      const newAdmin = await adminAuthService.createAdmin(newAdminData.email, newAdminData.password);
      setAdmins(prev => [...prev, newAdmin]);

      // Reset form
      setNewAdminData({
        email: "",
        password: "",
        confirmPassword: ""
      });
      setShowNewAdminForm(false);

      alert("New admin added successfully!");
    } catch (error) {

      // Show the actual error message from the API
      if (error instanceof Error) {
        alert(`Failed to create admin: ${error.message}`);
      } else {
        alert("Failed to add new admin. Please try again.");
      }
    } finally {
      setNewAdminLoading(false);
    }
  };

  const handleDeleteAdmin = async (adminId: number, adminEmail: string) => {
    // Prevent deleting current admin
    if (currentAdmin && adminId === currentAdmin.id) {
      alert("You cannot delete your own account!");
      return;
    }

    // Confirm deletion
    if (!confirm(`Are you sure you want to delete admin "${adminEmail}"? This action cannot be undone.`)) {
      return;
    }

    try {
      await adminAuthService.deleteAdmin(adminId);
      setAdmins(prev => prev.filter(admin => admin.id !== adminId));
      alert("Admin deleted successfully!");
    } catch (error) {

      alert("Failed to delete admin. Please try again.");
    }
  };

  const adminColumns = [
    { key: "display_name", label: "Name" },
    { key: "email", label: "Email" },
    {
      key: "created_at",
      label: "Created",
      render: (value: unknown) => (
        <span className="text-sm text-gray-600">
          {new Date(value as string).toLocaleDateString()}
        </span>
      )
    },
    {
      key: "action",
      label: "Actions",
      render: (_value: unknown, row: Record<string, unknown>) => {
        // Don't show delete button for current admin
        if (currentAdmin && row.id === currentAdmin.id) {
          return <span className="text-gray-400 text-sm">Current User</span>;
        }

        return (
          <button
            onClick={() => handleDeleteAdmin(row.id as number, row.email as string)}
            className="text-red-600 hover:text-red-700 transition-colors"
            title="Delete admin"
          >
            <FontAwesomeIcon icon={faTrash} className="w-4 h-4" />
          </button>
        );
      }
    },
  ];

  return (
    <div className="space-y-8 min-h-full">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 font-poppins">Settings</h1>
          <p className="text-gray-600 font-poppins mt-1">Manage your account and team members</p>
        </div>
      </div>

      {/* Current User Info */}
      <div className="bg-white rounded-2xl p-8 shadow-lg border border-gray-100">
        <div className="flex items-center space-x-4 mb-6">
          <div className="w-12 h-12 bg-purple-600 rounded-full flex items-center justify-center">
            <span className="text-white font-bold text-lg">{currentAdmin?.display_name?.charAt(0) || "A"}</span>
          </div>
          <div>
            <h2 className="text-xl font-semibold text-gray-900 font-poppins">Current User</h2>
            <p className="text-gray-600 font-poppins">Account information</p>
          </div>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="space-y-2">
            <label className="text-sm font-medium text-gray-500 font-poppins uppercase tracking-wide">Name</label>
            <p className="text-lg font-semibold text-gray-900 font-poppins">
              {currentAdmin?.display_name || "Loading..."}
            </p>
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium text-gray-500 font-poppins uppercase tracking-wide">Email</label>
            <p className="text-lg font-semibold text-gray-900 font-poppins">
              {currentAdmin?.email || "Loading..."}
            </p>
          </div>
        </div>
      </div>

      {/* Password Change Section */}
      <div className="bg-white rounded-2xl p-8 shadow-lg border border-gray-100">
        <div className="flex items-center space-x-3 mb-8">
          <div className="w-10 h-10 bg-purple-100 rounded-lg flex items-center justify-center">
            <svg className="w-5 h-5 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
            </svg>
          </div>
          <div>
            <h2 className="text-xl font-semibold text-gray-900 font-poppins">Change Password</h2>
            <p className="text-gray-600 font-poppins">Update your account password</p>
          </div>
        </div>
        <form onSubmit={handlePasswordSubmit} className="space-y-6 max-w-lg">
          {/* Old Password */}
          <div className="space-y-2">
            <label htmlFor="oldPassword" className="block text-sm font-medium text-gray-700 font-poppins">
              Old Password
            </label>
            <div className="relative">
              <input
                type={showOldPassword ? "text" : "password"}
                id="oldPassword"
                name="oldPassword"
                value={passwordData.oldPassword}
                onChange={handlePasswordChange}
                className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-purple-500 bg-gray-50 text-gray-900 font-poppins pr-12 transition-all duration-200"
                placeholder="Enter your current password"
                required
              />
              <button
                type="button"
                onClick={() => setShowOldPassword(!showOldPassword)}
                className="absolute right-4 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600 transition-colors"
              >
                <FontAwesomeIcon icon={showOldPassword ? faEyeSlash : faEye} className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* New Password */}
          <div className="space-y-2">
            <label htmlFor="newPassword" className="block text-sm font-medium text-gray-700 font-poppins">
              New Password
            </label>
            <div className="relative">
              <input
                type={showNewPassword ? "text" : "password"}
                id="newPassword"
                name="newPassword"
                value={passwordData.newPassword}
                onChange={handlePasswordChange}
                className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-purple-500 bg-gray-50 text-gray-900 font-poppins pr-12 transition-all duration-200"
                placeholder="Enter your new password"
                required
              />
              <button
                type="button"
                onClick={() => setShowNewPassword(!showNewPassword)}
                className="absolute right-4 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600 transition-colors"
              >
                <FontAwesomeIcon icon={showNewPassword ? faEyeSlash : faEye} className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Confirm Password */}
          <div className="space-y-2">
            <label htmlFor="confirmPassword" className="block text-sm font-medium text-gray-700 font-poppins">
              Confirm Password
            </label>
            <div className="relative">
              <input
                type={showConfirmPassword ? "text" : "password"}
                id="confirmPassword"
                name="confirmPassword"
                value={passwordData.confirmPassword}
                onChange={handlePasswordChange}
                className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-purple-500 bg-gray-50 text-gray-900 font-poppins pr-12 transition-all duration-200"
                placeholder="Confirm your new password"
                required
              />
              <button
                type="button"
                onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                className="absolute right-4 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600 transition-colors"
              >
                <FontAwesomeIcon icon={showConfirmPassword ? faEyeSlash : faEye} className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Submit Button */}
          <button
            type="submit"
            disabled={passwordLoading}
            className="w-full px-6 py-3 bg-purple-600 text-white rounded-xl font-semibold font-poppins hover:bg-purple-700 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed shadow-lg hover:shadow-xl"
          >
            {passwordLoading ? "Updating Password..." : "Update Password"}
          </button>
        </form>
      </div>

      {/* Admins Section */}
      <div className="space-y-6">
        {/* Add New Admin Form */}
        {showNewAdminForm && (
          <div className="bg-white rounded-2xl p-8 shadow-lg border border-gray-100">
            <div className="flex items-center justify-between mb-8">
              <div className="flex items-center space-x-3">
                <div className="w-10 h-10 bg-green-100 rounded-lg flex items-center justify-center">
                  <svg className="w-5 h-5 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                  </svg>
                </div>
                <div>
                  <h2 className="text-xl font-semibold text-gray-900 font-poppins">Add New Admin</h2>
                  <p className="text-gray-600 font-poppins">Create a new admin account</p>
                </div>
              </div>
              <button
                onClick={() => setShowNewAdminForm(false)}
                className="w-8 h-8 rounded-full bg-gray-100 hover:bg-gray-200 flex items-center justify-center text-gray-500 hover:text-gray-700 transition-colors"
              >
                ✕
              </button>
            </div>
            <form onSubmit={handleNewAdminSubmit} className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Email */}
                <div className="space-y-2">
                  <label htmlFor="email" className="block text-sm font-medium text-gray-700 font-poppins">
                    Email
                  </label>
                  <input
                    type="email"
                    id="email"
                    name="email"
                    value={newAdminData.email}
                    onChange={handleNewAdminChange}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent bg-white text-black font-poppins"
                    placeholder="Enter email address"
                    required
                  />
                </div>

                {/* Empty div for grid layout */}
                <div></div>

                {/* Password */}
                <div className="space-y-2">
                  <label htmlFor="password" className="block text-sm font-medium text-gray-700 font-poppins">
                    Password
                  </label>
                  <div className="relative">
                    <input
                      type={showNewAdminPassword ? "text" : "password"}
                      id="password"
                      name="password"
                      value={newAdminData.password}
                      onChange={handleNewAdminChange}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent bg-white text-black font-poppins pr-10"
                      placeholder="Enter password"
                      required
                    />
                    <button
                      type="button"
                      onClick={() => setShowNewAdminPassword(!showNewAdminPassword)}
                      className="absolute right-3 top-2.5 text-gray-400 hover:text-gray-600"
                    >
                      <FontAwesomeIcon icon={showNewAdminPassword ? faEyeSlash : faEye} className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                {/* Confirm Password */}
                <div className="space-y-2">
                  <label htmlFor="confirmPassword" className="block text-sm font-medium text-gray-700 font-poppins">
                    Confirm Password
                  </label>
                  <div className="relative">
                    <input
                      type={showNewAdminConfirmPassword ? "text" : "password"}
                      id="confirmPassword"
                      name="confirmPassword"
                      value={newAdminData.confirmPassword}
                      onChange={handleNewAdminChange}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent bg-white text-black font-poppins pr-10"
                      placeholder="Confirm password"
                      required
                    />
                    <button
                      type="button"
                      onClick={() => setShowNewAdminConfirmPassword(!showNewAdminConfirmPassword)}
                      className="absolute right-3 top-2.5 text-gray-400 hover:text-gray-600"
                    >
                      <FontAwesomeIcon icon={showNewAdminConfirmPassword ? faEyeSlash : faEye} className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </div>

              {/* Submit Button */}
              <div className="flex justify-end space-x-4">
                <button
                  type="button"
                  onClick={() => setShowNewAdminForm(false)}
                  className="px-6 py-2 border border-gray-300 rounded-lg text-gray-700 font-poppins hover:bg-gray-50 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={newAdminLoading}
                  className="px-6 py-2 bg-purple-600 text-white rounded-lg font-poppins hover:bg-purple-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {newAdminLoading ? "Adding..." : "Add Admin"}
                </button>
              </div>
            </form>
          </div>
        )}

        {/* Admins Table */}
        <div className="bg-white rounded-2xl p-8 shadow-lg border border-gray-100">
          <div className="flex items-center justify-between mb-8">
            <div className="flex items-center space-x-3">
              <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
                <svg className="w-5 h-5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197m13.5-9a2.5 2.5 0 11-5 0 2.5 2.5 0 015 0z" />
                </svg>
              </div>
              <div>
                <h2 className="text-xl font-semibold text-gray-900 font-poppins">Admins</h2>
                <p className="text-gray-600 font-poppins">Manage admin accounts and access</p>
              </div>
            </div>
            <button
              onClick={() => setShowNewAdminForm(true)}
              className="px-6 py-3 bg-purple-600 text-white rounded-xl font-semibold font-poppins hover:bg-purple-700 transition-all duration-200 flex items-center space-x-2 shadow-lg hover:shadow-xl"
            >
              <FontAwesomeIcon icon={faPlus} className="w-4 h-4" />
              <span>Add Admin</span>
            </button>
          </div>
          <DataTable
            columns={adminColumns}
            data={admins as unknown as Record<string, unknown>[]}
          />
        </div>
      </div>
    </div>
  );
}
