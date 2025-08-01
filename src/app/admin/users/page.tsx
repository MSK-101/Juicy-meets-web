"use client";

import { useEffect, useState } from "react";
import { adminApi } from "@/lib/admin-api";
import { User } from "@/lib/admin-types";
import DataTable from "@/components/admin/DataTable";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faSearch } from "@fortawesome/free-solid-svg-icons";

export default function Users() {
  const [users, setUsers] = useState<User[]>([]);
  const [stats, setStats] = useState({ registered: 0, inactive: 0, newUsers: 0 });
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [currentPage, setCurrentPage] = useState(1);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [usersResponse, statsResponse] = await Promise.all([
          adminApi.getUsers(currentPage, 10, statusFilter === "all" ? undefined : statusFilter, searchQuery || undefined),
          adminApi.getUserStats(),
        ]);

        setUsers(usersResponse.data.data);
        setStats(statsResponse.data);
      } catch (error) {
        console.error("Failed to fetch users data:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [currentPage, statusFilter, searchQuery]);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    setCurrentPage(1);
  };

  const columns = [
    { key: "username", label: "Username" },
    { key: "email", label: "Email" },
    { key: "coinPurchased", label: "Coin Purchased" },
    { key: "deposits", label: "Deposits" },
    { key: "totalSpent", label: "Total Spent" },
    { key: "lastLogin", label: "Last Login" },
  ];

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-600"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">Users</h1>
                  <div className="relative">
            <form onSubmit={handleSearch} className="flex items-center space-x-2">
              <input
                type="text"
                placeholder="Search"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent w-64"
              />
              <FontAwesomeIcon
                icon={faSearch}
                className="absolute left-3 top-2.5 h-5 w-5 text-gray-400"
              />
            </form>
          </div>
      </div>

      <div className="flex items-center space-x-4">
        <div className="flex space-x-2">
          <button
            onClick={() => setStatusFilter("all")}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              statusFilter === "all"
                ? "bg-purple-600 text-white"
                : "bg-gray-200 text-gray-700 hover:bg-gray-300"
            }`}
          >
            All
          </button>
          <button
            onClick={() => setStatusFilter("active")}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              statusFilter === "active"
                ? "bg-purple-600 text-white"
                : "bg-gray-200 text-gray-700 hover:bg-gray-300"
            }`}
          >
            Active
          </button>
          <button
            onClick={() => setStatusFilter("banned")}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              statusFilter === "banned"
                ? "bg-purple-600 text-white"
                : "bg-gray-200 text-gray-700 hover:bg-gray-300"
            }`}
          >
            Banned
          </button>
          <button
            onClick={() => setStatusFilter("pending")}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              statusFilter === "pending"
                ? "bg-purple-600 text-white"
                : "bg-gray-200 text-gray-700 hover:bg-gray-300"
            }`}
          >
            Pending
          </button>
        </div>

        <div className="flex items-center space-x-6 ml-auto">
          <div className="text-center">
            <p className="text-2xl font-bold text-gray-900">{stats.registered}</p>
            <p className="text-sm text-gray-600">Registered</p>
          </div>
          <div className="text-center">
            <p className="text-2xl font-bold text-gray-900">{stats.inactive}</p>
            <p className="text-sm text-gray-600">Inactive</p>
          </div>
          <div className="text-center">
            <p className="text-2xl font-bold text-gray-900">{stats.newUsers}</p>
            <p className="text-sm text-gray-600">New Users</p>
          </div>
        </div>
      </div>

      <DataTable columns={columns} data={users as unknown as Record<string, unknown>[]} />
    </div>
  );
}
