"use client";

import React, { useState } from "react";
import DataTable from "@/components/admin/DataTable";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faEdit, faPlus, faEye, faEyeSlash } from "@fortawesome/free-solid-svg-icons";

interface TeamMember {
  id: string;
  fullName: string;
  email: string;
  role: "Administrator" | "Moderator" | "Viewer";
  status: "active" | "inactive";
}

interface PasswordFormData {
  oldPassword: string;
  newPassword: string;
  confirmPassword: string;
}

interface NewUserFormData {
  email: string;
  password: string;
  confirmPassword: string;
  role: "Administrator" | "Moderator" | "Viewer";
}

export default function Settings() {
  // Current user data - replace with actual user data from context/API
  const currentUser = {
    name: "John Doe",
    email: "john.doe@example.com"
  };

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

  // New user state
  const [newUserData, setNewUserData] = useState<NewUserFormData>({
    email: "",
    password: "",
    confirmPassword: "",
    role: "Administrator"
  });
  const [showNewUserPassword, setShowNewUserPassword] = useState(false);
  const [showNewUserConfirmPassword, setShowNewUserConfirmPassword] = useState(false);
  const [newUserLoading, setNewUserLoading] = useState(false);
  const [showNewUserForm, setShowNewUserForm] = useState(false);

  // Team members state
  const [teamMembers, setTeamMembers] = useState<TeamMember[]>([
    {
      id: "1",
      fullName: "John Smith",
      email: "john.smith@example.com",
      role: "Administrator",
      status: "active"
    },
    {
      id: "2",
      fullName: "Kay Will",
      email: "kay.will@example.com",
      role: "Administrator",
      status: "active"
    },
    {
      id: "3",
      fullName: "Sarah Johnson",
      email: "sarah.johnson@example.com",
      role: "Moderator",
      status: "active"
    }
  ]);

  const handlePasswordChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setPasswordData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const handleNewUserChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setNewUserData(prev => ({
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

      // Mock API call - replace with actual API
      console.log("Password change data:", passwordData);

      // Simulate API delay
      await new Promise(resolve => setTimeout(resolve, 1000));

      // Reset form
      setPasswordData({
        oldPassword: "",
        newPassword: "",
        confirmPassword: ""
      });

      alert("Password updated successfully!");
    } catch (error) {
      console.error("Error updating password:", error);
      alert("Failed to update password. Please try again.");
    } finally {
      setPasswordLoading(false);
    }
  };

  const handleNewUserSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setNewUserLoading(true);

    try {
      // Validate passwords match
      if (newUserData.password !== newUserData.confirmPassword) {
        alert("Passwords do not match!");
        return;
      }

      // Mock API call - replace with actual API
      console.log("New user data:", newUserData);

      // Simulate API delay
      await new Promise(resolve => setTimeout(resolve, 1000));

      // Add new user to team members
      const newMember: TeamMember = {
        id: Date.now().toString(),
        fullName: newUserData.email.split('@')[0], // Use email prefix as name
        email: newUserData.email,
        role: newUserData.role,
        status: "active"
      };

      setTeamMembers(prev => [...prev, newMember]);

      // Reset form
      setNewUserData({
        email: "",
        password: "",
        confirmPassword: "",
        role: "Administrator"
      });
      setShowNewUserForm(false);

      alert("New team member added successfully!");
    } catch (error) {
      console.error("Error adding new user:", error);
      alert("Failed to add new user. Please try again.");
    } finally {
      setNewUserLoading(false);
    }
  };

  const teamMemberColumns = [
    { key: "fullName", label: "Full Name" },
    { key: "email", label: "Email" },
    { key: "role", label: "Role" },
    {
      key: "status",
      label: "Status",
      render: (value: unknown) => (
        <div className="flex items-center space-x-2">
          <div className={`w-2 h-2 rounded-full ${value === 'active' ? 'bg-green-500' : 'bg-gray-400'}`}></div>
          <span className={`text-sm ${value === 'active' ? 'text-green-600' : 'text-gray-500'}`}>
            {value === 'active' ? 'Active' : 'Inactive'}
          </span>
        </div>
      )
    },
    {
      key: "action",
      label: "Actions",
      render: (_value: unknown, row: Record<string, unknown>) => (
        <button
          onClick={() => console.log("Edit team member:", row.id)}
          className="text-purple-600 hover:text-purple-700 transition-colors"
        >
          <FontAwesomeIcon icon={faEdit} className="w-4 h-4" />
        </button>
      )
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
            <span className="text-white font-bold text-lg">{currentUser.name.charAt(0)}</span>
          </div>
          <div>
            <h2 className="text-xl font-semibold text-gray-900 font-poppins">Current User</h2>
            <p className="text-gray-600 font-poppins">Account information</p>
          </div>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="space-y-2">
            <label className="text-sm font-medium text-gray-500 font-poppins uppercase tracking-wide">Name</label>
            <p className="text-lg font-semibold text-gray-900 font-poppins">{currentUser.name}</p>
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium text-gray-500 font-poppins uppercase tracking-wide">Email</label>
            <p className="text-lg font-semibold text-gray-900 font-poppins">{currentUser.email}</p>
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

      {/* Team Members Section */}
      <div className="space-y-6">
        {/* Add New User Form */}
        {showNewUserForm && (
          <div className="bg-white rounded-2xl p-8 shadow-lg border border-gray-100">
            <div className="flex items-center justify-between mb-8">
              <div className="flex items-center space-x-3">
                <div className="w-10 h-10 bg-green-100 rounded-lg flex items-center justify-center">
                  <svg className="w-5 h-5 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                  </svg>
                </div>
                <div>
                  <h2 className="text-xl font-semibold text-gray-900 font-poppins">Add New Team Member</h2>
                  <p className="text-gray-600 font-poppins">Create a new team member account</p>
                </div>
              </div>
              <button
                onClick={() => setShowNewUserForm(false)}
                className="w-8 h-8 rounded-full bg-gray-100 hover:bg-gray-200 flex items-center justify-center text-gray-500 hover:text-gray-700 transition-colors"
              >
                ✕
              </button>
            </div>
            <form onSubmit={handleNewUserSubmit} className="space-y-6">
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
                    value={newUserData.email}
                    onChange={handleNewUserChange}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent bg-white text-black font-poppins"
                    placeholder="Enter email address"
                    required
                  />
                </div>

                {/* Role */}
                <div className="space-y-2">
                  <label htmlFor="role" className="block text-sm font-medium text-gray-700 font-poppins">
                    Role
                  </label>
                  <select
                    id="role"
                    name="role"
                    value={newUserData.role}
                    onChange={handleNewUserChange}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent bg-white text-black font-poppins"
                    required
                  >
                    <option value="Administrator">Administrator</option>
                    <option value="Moderator">Moderator</option>
                    <option value="Viewer">Viewer</option>
                  </select>
                </div>

                {/* Password */}
                <div className="space-y-2">
                  <label htmlFor="password" className="block text-sm font-medium text-gray-700 font-poppins">
                    Password
                  </label>
                  <div className="relative">
                    <input
                      type={showNewUserPassword ? "text" : "password"}
                      id="password"
                      name="password"
                      value={newUserData.password}
                      onChange={handleNewUserChange}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent bg-white text-black font-poppins pr-10"
                      placeholder="Enter password"
                      required
                    />
                    <button
                      type="button"
                      onClick={() => setShowNewUserPassword(!showNewUserPassword)}
                      className="absolute right-3 top-2.5 text-gray-400 hover:text-gray-600"
                    >
                      <FontAwesomeIcon icon={showNewUserPassword ? faEyeSlash : faEye} className="w-4 h-4" />
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
                      type={showNewUserConfirmPassword ? "text" : "password"}
                      id="confirmPassword"
                      name="confirmPassword"
                      value={newUserData.confirmPassword}
                      onChange={handleNewUserChange}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent bg-white text-black font-poppins pr-10"
                      placeholder="Confirm password"
                      required
                    />
                    <button
                      type="button"
                      onClick={() => setShowNewUserConfirmPassword(!showNewUserConfirmPassword)}
                      className="absolute right-3 top-2.5 text-gray-400 hover:text-gray-600"
                    >
                      <FontAwesomeIcon icon={showNewUserConfirmPassword ? faEyeSlash : faEye} className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </div>

              {/* Submit Button */}
              <div className="flex justify-end space-x-4">
                <button
                  type="button"
                  onClick={() => setShowNewUserForm(false)}
                  className="px-6 py-2 border border-gray-300 rounded-lg text-gray-700 font-poppins hover:bg-gray-50 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={newUserLoading}
                  className="px-6 py-2 bg-purple-600 text-white rounded-lg font-poppins hover:bg-purple-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {newUserLoading ? "Adding..." : "Add Team Member"}
                </button>
              </div>
            </form>
          </div>
        )}

                {/* Team Members Table */}
        <div className="bg-white rounded-2xl p-8 shadow-lg border border-gray-100">
          <div className="flex items-center justify-between mb-8">
            <div className="flex items-center space-x-3">
              <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
                <svg className="w-5 h-5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197m13.5-9a2.5 2.5 0 11-5 0 2.5 2.5 0 015 0z" />
                </svg>
              </div>
              <div>
                <h2 className="text-xl font-semibold text-gray-900 font-poppins">Team Members</h2>
                <p className="text-gray-600 font-poppins">Manage your team access and permissions</p>
              </div>
            </div>
            <button
              onClick={() => setShowNewUserForm(true)}
              className="px-6 py-3 bg-purple-600 text-white rounded-xl font-semibold font-poppins hover:bg-purple-700 transition-all duration-200 flex items-center space-x-2 shadow-lg hover:shadow-xl"
            >
              <FontAwesomeIcon icon={faPlus} className="w-4 h-4" />
              <span>Add Team Member</span>
            </button>
          </div>
          <DataTable
            columns={teamMemberColumns}
            data={teamMembers as unknown as Record<string, unknown>[]}
          />
        </div>
      </div>
    </div>
  );
}
