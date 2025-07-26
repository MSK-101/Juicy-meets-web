"use client";

import React, { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import DataTable from "@/components/admin/DataTable";
import StatCard from "@/components/admin/StatCard";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faEdit, faTrash } from "@fortawesome/free-solid-svg-icons";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer
} from 'recharts';

interface CoinPackage {
  id: string;
  name: string;
  coins: number;
  price: number;
  status: "active" | "inactive";
}

interface Transaction {
  id: string;
  user: string;
  package: string;
  amount: number;
  date: string;
}

interface MonetizationData {
  stats: {
    totalRevenue: number;
    revenuePerPackage: number;
    mostPopularPackage: string;
  };
  coinPackages: CoinPackage[];
  transactions: Transaction[];
  chartData: Array<{
    name: string;
    revenue: number;
  }>;
}

export default function Monetization() {
  const router = useRouter();
  const [data, setData] = useState<MonetizationData | null>(null);
  const [loading, setLoading] = useState(true);
  const [dateFilter, setDateFilter] = useState("today");
  const [transactionDateFilter, setTransactionDateFilter] = useState("today");

  useEffect(() => {
    const fetchData = async () => {
      try {
        // Mock data - replace with actual API call
        const mockData: MonetizationData = {
          stats: {
            totalRevenue: 2453,
            revenuePerPackage: 23671,
            mostPopularPackage: "500 coins"
          },
          coinPackages: [
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
            },
            {
              id: "4",
              name: "Basic Pack",
              coins: 100,
              price: 5.00,
              status: "inactive"
            },
            {
              id: "5",
              name: "Deluxe Pack",
              coins: 750,
              price: 29.00,
              status: "active"
            },
            {
              id: "6",
              name: "Ultimate Pack",
              coins: 1500,
              price: 59.00,
              status: "active"
            }
          ],
          transactions: [
            {
              id: "1",
              user: "John Doe",
              package: "500 Coins",
              amount: 24,
              date: "02/08/2025"
            },
            {
              id: "2",
              user: "Sarah Smith",
              package: "1000 Coins",
              amount: 39,
              date: "02/07/2025"
            },
            {
              id: "3",
              user: "Mike Johnson",
              package: "200 Coins",
              amount: 9,
              date: "02/06/2025"
            },
            {
              id: "4",
              user: "Emily Davis",
              package: "500 Coins",
              amount: 24,
              date: "02/05/2025"
            },
            {
              id: "5",
              user: "David Wilson",
              package: "1000 Coins",
              amount: 39,
              date: "02/04/2025"
            }
          ],
          chartData: [
            { name: "100 Coins", revenue: 15 },
            { name: "250 Coins", revenue: 28 },
            { name: "180 Coins", revenue: 22 },
            { name: "300 Coins", revenue: 35 },
            { name: "80 Coins", revenue: 12 },
            { name: "220 Coins", revenue: 26 }
          ]
        };

        setData(mockData);
      } catch (error) {
        console.error("Failed to fetch monetization data:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [dateFilter, transactionDateFilter]);

  const coinPackageColumns = [
    { key: "name", label: "Name of Package" },
    { key: "coins", label: "Coins" },
    { key: "price", label: "Price" },
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
      render: (_value: unknown, row: Record<string, unknown>): React.ReactNode => (
        <div className="flex items-center space-x-2">
          <button
            onClick={() => router.push(`/admin/monetization/packages/edit/${row.id}`)}
            className="text-green-600 hover:text-green-700 transition-colors"
          >
            <FontAwesomeIcon icon={faEdit} className="w-4 h-4" />
          </button>
          <button
            onClick={() => console.log("Delete package:", row.id)}
            className="text-red-600 hover:text-red-700 transition-colors"
          >
            <FontAwesomeIcon icon={faTrash} className="w-4 h-4" />
          </button>
        </div>
      )
    },
  ];

  const transactionColumns = [
    { key: "user", label: "User" },
    { key: "package", label: "Package" },
    {
      key: "amount",
      label: "Amount",
      render: (value: unknown) => `$${value}`
    },
    { key: "date", label: "Date" },
  ];

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
    <div className="space-y-6">
      {/* Header with Date Filter */}
      <div className="flex items-center justify-between">
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
      <div className="flex gap-6 items-center">
        <StatCard
          title="Total Revenue"
          value={`$${data.stats.totalRevenue.toLocaleString()}`}
          change="+11.01%"
          isPositive={true}
          index={0}
        />
        <StatCard
          title="Revenue Per Coin Package"
          value={`$${data.stats.revenuePerPackage.toLocaleString()}`}
          change="-0.03%"
          isPositive={false}
          index={1}
        />
        <StatCard
          title="Most Popular Package"
          value={data.stats.mostPopularPackage}
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
              data={data.coinPackages as unknown as Record<string, unknown>[]}
            />
          </div>
        </div>

        {/* Revenue Per Package Chart */}
        <div className="bg-gray-100 rounded-2xl p-4 shadow-md">
          <h2 className="text-lg text-gray-900 font-poppins mb-4">Revenue Per Package</h2>
          <div className="h-64">
            <ResponsiveContainer width="100%" height={300}>
              <BarChart
                data={data.chartData}
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
