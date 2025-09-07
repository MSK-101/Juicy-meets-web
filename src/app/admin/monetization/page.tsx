"use client";

import React, { useEffect, useState, useRef } from "react";
import { useRouter } from "next/navigation";
import DataTable from "@/components/admin/DataTable";
import StatCard from "@/components/admin/StatCard";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faEdit, faTrash } from "@fortawesome/free-solid-svg-icons";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer
} from 'recharts';
import { monetizationService, MonetizationData } from "@/api/services/monetizationService";

export default function Monetization() {
  const router = useRouter();
  const [data, setData] = useState<MonetizationData | null>(null);
  const [loading, setLoading] = useState(true);
  const [dateFilter, setDateFilter] = useState("today");
  const [transactionDateFilter, setTransactionDateFilter] = useState("today");
  const dataLoadedRef = useRef(false);

  useEffect(() => {
    const fetchData = async () => {
      try {
        console.log("🔄 Fetching monetization data for dateFilter:", dateFilter);
        setLoading(true);
        dataLoadedRef.current = false;
        const monetizationData = await monetizationService.getMonetizationData(dateFilter);
        console.log("✅ Monetization data fetched successfully");
        setData(monetizationData);
        dataLoadedRef.current = true;
      } catch (error) {
        console.error("❌ Failed to fetch monetization data:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [dateFilter]);

  useEffect(() => {
    const fetchTransactions = async () => {
      if (!dataLoadedRef.current) {
        console.log("⏳ Skipping transaction fetch - data not loaded yet");
        return;
      }

      try {
        console.log("🔄 Fetching transactions for transactionDateFilter:", transactionDateFilter);
        const transactions = await monetizationService.getTransactionHistory(transactionDateFilter);
        console.log("✅ Transactions fetched successfully");
        setData(prev => prev ? { ...prev, transactions } : null);
      } catch (error) {
        console.error("❌ Failed to fetch transaction data:", error);
      }
    };

    fetchTransactions();
  }, [transactionDateFilter]);

  const coinPackageColumns = [
    { key: "name", label: "Name of Package" },
    { key: "coins_count", label: "Coins" },
    { key: "price", label: "Price" },
    {
      key: "active",
      label: "Status",
      render: (value: unknown) => (
        <div className="flex items-center space-x-2">
          <div className={`w-2 h-2 rounded-full ${value === true ? 'bg-green-500' : 'bg-gray-400'}`}></div>
          <span className={`text-sm ${value === true ? 'text-green-600' : 'text-gray-500'}`}>
            {value === true ? 'Active' : 'Inactive'}
          </span>
        </div>
      )
    },
    {
      key: "action",
      label: "Actions",
      render: (_value: unknown, row: Record<string, unknown>): React.ReactNode => (
        <div className="flex items-center space-x-2">
          <button
            onClick={() => router.push(`/admin/monetization/packages/edit/${row.id}`)}
            className="text-green-600 hover:text-green-700 transition-colors"
          >
            <FontAwesomeIcon icon={faEdit} className="w-4 h-4" />
          </button>
          <button
            onClick={() => handleDeletePackage(row.id as string)}
            className="text-red-600 hover:text-red-700 transition-colors"
          >
            <FontAwesomeIcon icon={faTrash} className="w-4 h-4" />
          </button>
        </div>
      )
    },
  ];

  const transactionColumns = [
    { key: "user_email", label: "User" },
    { key: "package_name", label: "Package" },
    {
      key: "price",
      label: "Amount",
      render: (value: unknown) => `$${value}`
    },
    {
      key: "purchased_at",
      label: "Date",
      render: (value: unknown) => new Date(value as string).toLocaleDateString()
    },
  ];

  const handleDeletePackage = async (packageId: string) => {
    if (window.confirm("Are you sure you want to delete this package? This action cannot be undone.")) {
      try {
        await monetizationService.deleteCoinPackage(packageId);
        // Refresh data after deletion
        const monetizationData = await monetizationService.getMonetizationData(dateFilter);
        setData(monetizationData);
      } catch (error) {
        console.error("Failed to delete package:", error);
        alert("Failed to delete package. Please try again.");
      }
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-600"></div>
      </div>
    );
  }

  if (!data) {
    return <div>No data available</div>;
  }

  return (
    <div className="space-y-6 min-h-full">
      {/* Header with Date Filter */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <h1 className="text-2xl font-semibold text-gray-900 font-poppins">Monetization</h1>
        <select
          value={dateFilter}
          onChange={(e) => setDateFilter(e.target.value)}
          className="border border-gray-300 rounded-lg px-4 py-2 text-sm bg-white text-black font-poppins focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent"
        >
          <option value="today">Date Range: Today</option>
          <option value="week">Date Range: This Week</option>
          <option value="month">Date Range: This Month</option>
          <option value="year">Date Range: This Year</option>
        </select>
      </div>

      {/* Stats Cards */}
      <div className="flex gap-4 lg:gap-6 items-center">
        <StatCard
          title="Total Revenue"
          value={`$${data.stats.total_revenue.toLocaleString()}`}
          change="+11.01%"
          isPositive={true}
          index={0}
        />
        <StatCard
          title="Revenue Per Coin Package"
          value={`$${data.stats.revenue_per_package.toLocaleString()}`}
          change="-0.03%"
          isPositive={false}
          index={1}
        />
        <StatCard
          title="Most Popular Package"
          value={data.stats.most_popular_package || "N/A"}
          change="+15.03%"
          isPositive={true}
          index={2}
        />
      </div>

      {/* Coin Packages and Chart Section */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Coin Packages Table */}
        <div className="bg-gray-100 rounded-2xl p-4 shadow-md">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg text-gray-900 font-poppins">Coin Packages</h2>
            <button
              onClick={() => router.push("/admin/monetization/packages/add")}
              className="text-purple-600 hover:text-purple-700 transition-colors font-poppins"
            >
              + Add Package
            </button>
          </div>
          <div className="h-64 overflow-y-auto">
            <DataTable
              columns={coinPackageColumns}
              data={data.coin_packages as unknown as Record<string, unknown>[]}
            />
          </div>
        </div>

        {/* Revenue Per Package Chart */}
        <div className="bg-gray-100 rounded-2xl p-4 shadow-md">
          <h2 className="text-lg text-gray-900 font-poppins mb-4">Revenue Per Package</h2>
          <div className="h-64">
            <ResponsiveContainer width="100%" height={300}>
              <BarChart
                data={data.chart_data}
                margin={{ top: 5, right: 30, left: 20, bottom: 5 }}
              >
                <CartesianGrid strokeDasharray="3 3" stroke="#e0e0e0" />
                <XAxis dataKey="name" stroke="#888888" />
                <YAxis stroke="#888888" />
                <Tooltip
                  contentStyle={{ backgroundColor: '#333', border: 'none', borderRadius: '8px' }}
                  labelStyle={{ color: '#fff' }}
                  itemStyle={{ color: '#fff' }}
                />
                <Bar dataKey="revenue" fill="#8B5CF6" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* Transaction History */}
      <div className="bg-gray-100 rounded-2xl p-4 shadow-md">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg text-gray-900 font-poppins">Transaction History</h2>
          <select
            value={transactionDateFilter}
            onChange={(e) => setTransactionDateFilter(e.target.value)}
            className="border border-gray-300 rounded-lg px-3 py-2 text-sm bg-white text-black font-poppins focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent"
          >
            <option value="today">Date Range: Today</option>
            <option value="week">Date Range: This Week</option>
            <option value="month">Date Range: This Month</option>
            <option value="year">Date Range: This Year</option>
          </select>
        </div>
        <DataTable
          columns={transactionColumns}
          data={data.transactions as unknown as Record<string, unknown>[]}
        />
      </div>
    </div>
  );
}
