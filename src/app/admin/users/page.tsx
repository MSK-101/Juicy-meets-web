"use client";

import { useEffect, useState } from "react";
import { adminApiFunctions as adminApi } from "@/lib/admin-api";
import { User } from "@/lib/admin-types";
import DataTable from "@/components/admin/DataTable";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faSearch } from "@fortawesome/free-solid-svg-icons";
import { useAdminToken } from "@/store/adminAuth";

export default function Users() {
  const [users, setUsers] = useState<User[]>([]);
  const [stats, setStats] = useState({ registered: 0, inactive: 0, newUsers: 0 });
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalUsers, setTotalUsers] = useState(0);
  const adminToken = useAdminToken();

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [usersResponse, statsResponse] = await Promise.all([
          adminApi.getUsers(currentPage, 10, statusFilter === "all" ? undefined : statusFilter, searchQuery || undefined),
          adminApi.getUserStats(),
        ]);

        setUsers(usersResponse.data.data);
        setTotalPages(usersResponse.data.totalPages);
        setTotalUsers(usersResponse.data.total);
        setStats(statsResponse.data);
      } catch (error) {
        
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
    { key: "coinPurchased", label: "Coins Purchased" },
    { key: "deposits", label: "Number of Purchases" },
    { key: "totalSpent", label: "Total Spent ($)" },
    { key: "lastLogin", label: "Last Activity" },
  ];

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-600"></div>
      </div>
    );
  }

    return (
    <div className="space-y-6 min-h-full">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <h1 className="text-2xl font-semibold text-gray-900">Users</h1>
        <div className="relative w-full sm:w-auto">
          <form onSubmit={handleSearch} className="flex items-center space-x-2">
            <input
              type="text"
              placeholder="Search"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent w-full sm:w-64 bg-white text-black font-poppins"
            />
            <FontAwesomeIcon
              icon={faSearch}
              className="absolute left-3 top-2.5 h-5 w-5 text-gray-400"
            />
          </form>
        </div>
      </div>

      <div className="flex items-center space-x-12">
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

        <div className="flex items-center space-x-12 ml-auto">
          <div className="text-center">
            <p className="text-2xl font-semibold text-gray-900">{stats.registered}</p>
            <p className="text-sm text-gray-600">Registered</p>
          </div>
          <div className="text-center">
            <p className="text-2xl font-semibold text-gray-900">{stats.inactive}</p>
            <p className="text-sm text-gray-600">Inactive</p>
          </div>
          <div className="text-center">
            <p className="text-2xl font-semibold text-gray-900">{stats.newUsers}</p>
            <p className="text-sm text-gray-600">New Users</p>
          </div>
        </div>
      </div>
      <div className="bg-gray-100 rounded-2xl p-4 shadow-md">
        <DataTable columns={columns} data={users as unknown as Record<string, unknown>[]} />

        {/* Pagination */}
        <div className="flex items-center justify-between mt-6">
          <div className="text-sm text-gray-600">
            Showing {((currentPage - 1) * 10) + 1} to {Math.min(currentPage * 10, totalUsers)} of {totalUsers} users
          </div>
          <div className="flex items-center space-x-2">
            <button
              onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
              disabled={currentPage === 1}
              className="px-3 py-2 text-sm font-medium text-gray-500 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Previous
            </button>

            <div className="flex items-center space-x-1">
              {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                const pageNum = Math.max(1, Math.min(totalPages - 4, currentPage - 2)) + i;
                if (pageNum > totalPages) return null;

                return (
                  <button
                    key={pageNum}
                    onClick={() => setCurrentPage(pageNum)}
                    className={`px-3 py-2 text-sm font-medium rounded-lg ${
                      currentPage === pageNum
                        ? 'bg-purple-600 text-white'
                        : 'text-gray-500 bg-white border border-gray-300 hover:bg-gray-50'
                    }`}
                  >
                    {pageNum}
                  </button>
                );
              })}
            </div>

            <button
              onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
              disabled={currentPage === totalPages}
              className="px-3 py-2 text-sm font-medium text-gray-500 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Next
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
