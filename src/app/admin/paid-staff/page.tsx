"use client";

import React, { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import DataTable from "@/components/admin/DataTable";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faSearch, faEdit } from "@fortawesome/free-solid-svg-icons";
import { staffService, Staff } from "@/api/services/staffService";

export default function PaidStaff() {
  const router = useRouter();
  const [staff, setStaff] = useState<Staff[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [onlineFilter, setOnlineFilter] = useState("");
  const [genderFilter, setGenderFilter] = useState("");
  const [timeFilter, setTimeFilter] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchStaffData();
  }, [currentPage, onlineFilter, genderFilter, timeFilter, searchQuery]);

  const fetchStaffData = async () => {
    try {
      setLoading(true);
      setError(null);
      const staffData = await staffService.getStaff();
      setStaff(staffData);
    } catch (error) {
      
      setError("Failed to fetch staff data. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    setCurrentPage(1);
  };

  // Filter staff based on search and filters
  const filteredStaff = staff.filter((member) => {
    const matchesSearch =
      member.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      member.email.toLowerCase().includes(searchQuery.toLowerCase()) ||
      member.username.toLowerCase().includes(searchQuery.toLowerCase());

    const matchesOnline = !onlineFilter || member.status === onlineFilter;
    const matchesGender = !genderFilter || member.gender === genderFilter;

    return matchesSearch && matchesOnline && matchesGender;
  });

  const columns = [
    { key: "name", label: "Name" },
    { key: "username", label: "Username" },
    { key: "email", label: "Email Address" },
    {
      key: "totalActivityTime",
      label: "Total Activity Time",
      render: (value: unknown): React.ReactNode => (
        <div className="flex items-center space-x-2">
          <span>{String(value)}</span>
          {/* <select className="text-xs border-none bg-transparent text-gray-500">
            <option>Today</option>
            <option>Weekly</option>
            <option>Monthly</option>
          </select> */}
        </div>
      )
    },
    {
      key: "status",
      label: "Status",
      render: (value: unknown): React.ReactNode => {
        // Map backend enum values to frontend display
        const statusMap: Record<string, { label: string; color: string; bgColor: string }> = {
          '0': { label: 'Online', color: 'text-green-600', bgColor: 'bg-green-500' },      // online
          '1': { label: 'In Chat', color: 'text-blue-600', bgColor: 'bg-blue-500' },      // in_chat
          '2': { label: 'Busy', color: 'text-yellow-600', bgColor: 'bg-yellow-500' },     // busy
          '3': { label: 'Offline', color: 'text-gray-500', bgColor: 'bg-gray-400' }        // offline
        };

        const status = statusMap[String(value)] || statusMap['3'];

        return (
          <div className="flex items-center space-x-2">
            <div className={`w-2 h-2 rounded-full ${status.bgColor}`}></div>
            <span className={`text-sm ${status.color}`}>
              {status.label}
            </span>
          </div>
        );
      }
    },
    {
      key: "gender",
      label: "Gender",
      render: (value: unknown): React.ReactNode => {
        return value as string;
      }
    },
    // {
    //   key: "assignmentStatus",
    //   label: "Assignment Status",
    //   render: (value: unknown): React.ReactNode => (
    //     <div className="flex items-center space-x-2">
    //       <div className={`w-2 h-2 rounded-full ${value === 'active' ? 'bg-green-500' : 'bg-gray-400'}`}></div>
    //       <span className={`text-sm ${value === 'active' ? 'text-green-600' : 'text-gray-500'}`}>
    //         {value === 'active' ? 'Active' : 'Inactive'}
    //       </span>
    //     </div>
    //   )
    // },
    { key: "regDate", label: "Reg. Date" },
    {
      key: "action",
      label: "Action",
      render: (_value: unknown, row: Record<string, unknown>): React.ReactNode => (
        <button
          onClick={() => router.push(`/admin/paid-staff/edit/${row.id}`)}
          className="text-purple-600 hover:text-purple-700 transition-colors"
        >
          <FontAwesomeIcon icon={faEdit} className="w-4 h-4" />
        </button>
      )
    },
  ];

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
    <div className="space-y-6 min-h-full">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <h1 className="text-2xl font-semibold text-gray-900 font-poppins">Paid Staff</h1>
        <div className="flex flex-col sm:flex-row items-start sm:items-center space-y-2 sm:space-y-0 sm:space-x-4 w-full sm:w-auto">
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
          <button
            onClick={() => router.push("/admin/paid-staff/add")}
            className="bg-purple-600 text-white px-4 py-2 rounded-lg hover:bg-purple-700 transition-colors font-poppins w-full sm:w-auto"
          >
            + Add Staff
          </button>
        </div>
      </div>

      <div className="flex items-center space-x-4">
        <select
          value={onlineFilter}
          onChange={(e) => setOnlineFilter(e.target.value)}
          className="border border-gray-300 rounded-lg px-3 py-2 text-sm bg-white text-black font-poppins focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent"
        >
          <option value="">Status</option>
          <option value="0">Online</option>
          <option value="1">In Chat</option>
          <option value="2">Busy</option>
          <option value="3">Offline</option>
        </select>

        <select
          value={genderFilter}
          onChange={(e) => setGenderFilter(e.target.value)}
          className="border border-gray-300 rounded-lg px-3 py-2 text-sm bg-white text-black font-poppins focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent"
        >
          <option value="">Gender</option>
          <option value="male">Male</option>
          <option value="female">Female</option>
          <option value="other">Other</option>
        </select>

        <select
          value={timeFilter}
          onChange={(e) => setTimeFilter(e.target.value)}
          className="border border-gray-300 rounded-lg px-3 py-2 text-sm bg-white text-black font-poppins focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent"
        >
          <option value="">Total Time Active</option>
          <option value="1h">1h</option>
          <option value="2h">2h</option>
          <option value="3h">3h</option>
          <option value="4h">4h</option>
          <option value="5h">5h</option>
          <option value="6h">6h</option>
          <option value="7h">7h</option>
        </select>
      </div>

      <div className="bg-gray-100 rounded-2xl p-4 shadow-md">
        <DataTable columns={columns} data={filteredStaff as unknown as Record<string, unknown>[]} />
      </div>
    </div>
  );
}
