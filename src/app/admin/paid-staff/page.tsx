"use client";

import React, { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import DataTable from "@/components/admin/DataTable";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faSearch, faEdit } from "@fortawesome/free-solid-svg-icons";

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

export default function PaidStaff() {
  const router = useRouter();
  const [staff, setStaff] = useState<Staff[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [onlineFilter, setOnlineFilter] = useState("");
  const [genderFilter, setGenderFilter] = useState("");
  const [timeFilter, setTimeFilter] = useState("");
  const [currentPage, setCurrentPage] = useState(1);

  useEffect(() => {
    const fetchData = async () => {
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
          },
          {
            id: "3",
            name: "Jay",
            username: "jay76",
            email: "jay76@gmail.com",
            totalActivityTime: "6h20m",
            period: "Today",
            onlineStatus: "online",
            assignedGender: "M",
            status: "active",
            regDate: "05/15/2025"
          },
          {
            id: "4",
            name: "Adam",
            username: "adam1",
            email: "adam1@gmail.com",
            totalActivityTime: "3h45m",
            period: "Today",
            onlineStatus: "offline",
            assignedGender: "M",
            status: "disabled",
            regDate: "03/10/2025"
          },
          {
            id: "5",
            name: "William",
            username: "william6789",
            email: "william6789@gmail.com",
            totalActivityTime: "4h10m",
            period: "Today",
            onlineStatus: "online",
            assignedGender: "M",
            status: "active",
            regDate: "02/28/2025"
          },
          {
            id: "6",
            name: "Cambell",
            username: "cambell876",
            email: "cambell876@gmail.com",
            totalActivityTime: "2h30m",
            period: "Today",
            onlineStatus: "offline",
            assignedGender: "M",
            status: "active",
            regDate: "01/15/2025"
          },
          {
            id: "7",
            name: "Sara",
            username: "sara098",
            email: "sara098@gmail.com",
            totalActivityTime: "7h15m",
            period: "Today",
            onlineStatus: "online",
            assignedGender: "F",
            status: "active",
            regDate: "06/1/2025"
          },
          {
            id: "8",
            name: "Alison",
            username: "alison678",
            email: "alison678@gmail.com",
            totalActivityTime: "1h45m",
            period: "Today",
            onlineStatus: "offline",
            assignedGender: "F",
            status: "active",
            regDate: "05/20/2025"
          },
          {
            id: "9",
            name: "Greyi",
            username: "greyi76",
            email: "greyi76@gmail.com",
            totalActivityTime: "5h50m",
            period: "Today",
            onlineStatus: "online",
            assignedGender: "F",
            status: "active",
            regDate: "04/12/2025"
          },
          {
            id: "10",
            name: "Flora",
            username: "flora65",
            email: "flora65@gmail.com",
            totalActivityTime: "3h20m",
            period: "Today",
            onlineStatus: "offline",
            assignedGender: "F",
            status: "disabled",
            regDate: "03/25/2025"
          },
          {
            id: "11",
            name: "Marsh",
            username: "marsh67",
            email: "marsh67@gmail.com",
            totalActivityTime: "4h40m",
            period: "Today",
            onlineStatus: "online",
            assignedGender: "M",
            status: "active",
            regDate: "02/18/2025"
          },
          {
            id: "12",
            name: "Emma",
            username: "emma234",
            email: "emma234@gmail.com",
            totalActivityTime: "6h30m",
            period: "Today",
            onlineStatus: "online",
            assignedGender: "F",
            status: "active",
            regDate: "06/10/2025"
          }
        ];

        setStaff(mockStaff);
      } catch (error) {
        console.error("Failed to fetch staff data:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [currentPage, onlineFilter, genderFilter, timeFilter, searchQuery]);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    setCurrentPage(1);
  };

  const columns = [
    { key: "name", label: "Name" },
    { key: "username", label: "Username" },
    { key: "email", label: "Email Address" },
    {
      key: "totalActivityTime",
      label: "Total Activity Time",
      render: (value: unknown, row: Record<string, unknown>) => (
        <div className="flex items-center space-x-2">
          <span>{value}</span>
          <select className="text-xs border-none bg-transparent text-gray-500">
            <option>Today</option>
            <option>Weekly</option>
            <option>Monthly</option>
          </select>
        </div>
      )
    },
    {
      key: "onlineStatus",
      label: "Online/Offline Status",
      render: (value: unknown) => (
        <div className="flex items-center space-x-2">
          <div className={`w-2 h-2 rounded-full ${value === 'online' ? 'bg-green-500' : 'bg-gray-400'}`}></div>
          <span className={`text-sm ${value === 'online' ? 'text-green-600' : 'text-gray-500'}`}>
            {value === 'online' ? 'Online' : 'Offline'}
          </span>
        </div>
      )
    },
    { key: "assignedGender", label: "Assigned Gender" },
    {
      key: "status",
      label: "Status",
      render: (value: unknown) => (
        <div className="flex items-center space-x-2">
          <div className={`w-2 h-2 rounded-full ${value === 'active' ? 'bg-green-500' : 'bg-gray-400'}`}></div>
          <span className={`text-sm ${value === 'active' ? 'text-green-600' : 'text-gray-500'}`}>
            {value === 'active' ? 'Active' : 'Disabled'}
          </span>
        </div>
      )
    },
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

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold text-gray-900 font-poppins">Paid Staff</h1>
        <div className="flex items-center space-x-4">
          <div className="relative">
            <form onSubmit={handleSearch} className="flex items-center space-x-2">
              <input
                type="text"
                placeholder="Search"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent w-64 bg-white text-black font-poppins"
              />
              <FontAwesomeIcon
                icon={faSearch}
                className="absolute left-3 top-2.5 h-5 w-5 text-gray-400"
              />
            </form>
          </div>
          <button
            onClick={() => router.push("/admin/paid-staff/add")}
            className="bg-purple-600 text-white px-4 py-2 rounded-lg hover:bg-purple-700 transition-colors font-poppins"
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
          <option value="">Online</option>
          <option value="online">Online</option>
          <option value="offline">Offline</option>
        </select>

        <select
          value={genderFilter}
          onChange={(e) => setGenderFilter(e.target.value)}
          className="border border-gray-300 rounded-lg px-3 py-2 text-sm bg-white text-black font-poppins focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent"
        >
          <option value="">Gender</option>
          <option value="M">Male</option>
          <option value="F">Female</option>
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
        <DataTable columns={columns} data={staff as unknown as Record<string, unknown>[]} />
      </div>
    </div>
  );
}
