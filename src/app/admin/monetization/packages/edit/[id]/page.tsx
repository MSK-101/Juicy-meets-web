"use client";

import React, { useState, useEffect } from "react";
import { useRouter, useParams } from "next/navigation";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faArrowLeft, faSave } from "@fortawesome/free-solid-svg-icons";

interface Package {
  id: string;
  name: string;
  coins: number;
  price: number;
  status: "active" | "inactive";
}

export default function EditPackage() {
  const router = useRouter();
  const params = useParams();
  const packageId = params.id as string;

  const [formData, setFormData] = useState<Package>({
    id: "",
    name: "",
    coins: 0,
    price: 0,
    status: "active"
  });

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const fetchPackageData = async () => {
      try {
        // Mock data - replace with actual API call
        const mockPackages: Package[] = [
          {
            id: "1",
            name: "Starter Pack",
            coins: 200,
            price: 9.00,
            status: "active"
          },
          {
            id: "2",
            name: "Popular Pack",
            coins: 500,
            price: 24.00,
            status: "active"
          },
          {
            id: "3",
            name: "Premium Pack",
            coins: 1000,
            price: 39.00,
            status: "active"
          }
        ];

        const packageData = mockPackages.find(p => p.id === packageId);
        if (packageData) {
          setFormData(packageData);
        }
      } catch (error) {
        console.error("Failed to fetch package data:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchPackageData();
  }, [packageId]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: name === 'coins' || name === 'price' ? parseFloat(value) || 0 : value
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);

    try {
      // Mock API call - replace with actual API
      console.log("Updated Package Data:", formData);

      // Simulate API delay
      await new Promise(resolve => setTimeout(resolve, 1000));

      // Redirect back to monetization page
      router.push("/admin/monetization");
    } catch (error) {
      console.error("Error updating package:", error);
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
          <h1 className="text-2xl font-semibold text-gray-900 font-poppins">Edit Package</h1>
        </div>
      </div>

      {/* Form */}
      <div className="bg-gray-100 rounded-2xl p-6 shadow-md">
        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Package Name */}
            <div className="space-y-2">
              <label htmlFor="name" className="block text-sm font-medium text-gray-700 font-poppins">
                Package Name
              </label>
              <input
                type="text"
                id="name"
                name="name"
                value={formData.name}
                onChange={handleInputChange}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent bg-white text-black font-poppins"
                placeholder="e.g., Starter Pack"
                required
              />
            </div>

            {/* Number of Coins */}
            <div className="space-y-2">
              <label htmlFor="coins" className="block text-sm font-medium text-gray-700 font-poppins">
                Number of Coins
              </label>
              <input
                type="number"
                id="coins"
                name="coins"
                value={formData.coins}
                onChange={handleInputChange}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent bg-white text-black font-poppins"
                placeholder="e.g., 500"
                min="1"
                required
              />
            </div>

            {/* Price */}
            <div className="space-y-2">
              <label htmlFor="price" className="block text-sm font-medium text-gray-700 font-poppins">
                Price ($)
              </label>
              <input
                type="number"
                id="price"
                name="price"
                value={formData.price}
                onChange={handleInputChange}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent bg-white text-black font-poppins"
                placeholder="e.g., 24.00"
                min="0"
                step="0.01"
                required
              />
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
