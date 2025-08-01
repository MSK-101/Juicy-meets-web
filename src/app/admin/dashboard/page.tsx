"use client";

import { useEffect, useState } from "react";
import { adminApi } from "@/lib/admin-api";
import { DashboardData } from "@/lib/admin-types";
import StatCard from "@/components/admin/StatCard";
import DataTable from "@/components/admin/DataTable";
import ChartComponent from "@/components/admin/ChartComponent";

export default function Dashboard() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [userFilter, setUserFilter] = useState("today");
  const [videoFilter, setVideoFilter] = useState("today");

  useEffect(() => {
    const fetchData = async () => {
      try {
        const response = await adminApi.getDashboardData();
        setData(response.data);
      } catch (error) {
        console.error("Failed to fetch dashboard data:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-600"></div>
      </div>
    );
  }

  if (!data) {
    return <div className="text-center text-gray-500">Failed to load dashboard data</div>;
  }

  const recentUsersColumns = [
    { key: "username", label: "Username" },
    { key: "email", label: "Email" },
    { key: "coinBalance", label: "Coin Balance" },
    { key: "lastLogin", label: "Last Login" },
  ];

  const topVideosColumns = [
    { key: "name", label: "Video Name/Sequence" },
    { key: "views", label: "Number of Views" },
  ];

  return (
    <div className="space-y-6 rounded-2xl pb-6">
      <div className="flex items-center justify-between">
        <h1 className="font-semibold text-gray-900 font-poppins">Total Users</h1>
        <select
           value={userFilter}
           onChange={(e) => setUserFilter(e.target.value)}
           className="border border-gray-300 rounded-lg px-4 py-2 text-sm bg-white text-black font-poppins"
         >
          <option value="today">Filter: Today</option>
          <option value="week">Filter: Week</option>
          <option value="month">Filter: Month</option>
        </select>
      </div>

      <div className="flex gap-6 items-center">
        <StatCard
          title="Views"
          value={data.stats.views.toLocaleString()}
          change="+11.01%"
          isPositive={true}
          index={0}
        />
        <StatCard
          title="Revenue"
          value={`$${data.stats.revenue.toLocaleString()}`}
          change="-0.03%"
          isPositive={false}
          index={1}
        />
        <StatCard
          title="Active Users"
          value={data.stats.activeUsers.toLocaleString()}
          change="+15.03%"
          isPositive={true}
          index={2}
        />
        <StatCard
          title="Paying Users"
          value={data.stats.payingUsers.toLocaleString()}
          change="+6.08%"
          isPositive={true}
          index={3}
        />
        <StatCard
          title="User Retention"
          value={`${data.stats.userRetention}%`}
          change="+6.08%"
          isPositive={true}
          index={4}
        />
      </div>

      <div className="bg-gray-100 rounded-lg shadow p-6">
        <div className="flex items-center justify-between mb-6">
          <div className="flex space-x-6">
            <span className="text-purple-400 text-sm font-poppins">Swipes</span>
            <span className="text-purple-600 text-sm font-poppins">Video Views</span>
            <span className="text-black text-sm font-poppins">Coins Used</span>
          </div>
            <select className="border border-gray-300 rounded-lg px-3 py-2 text-sm bg-gray-200 text-black font-poppins">
             <option value="week">Week</option>
             <option value="month">Month</option>
             <option value="year">Year</option>
           </select>
        </div>

        <div className="h-64 pb-10 mb-10">
          <ChartComponent data={data.chartData} />
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-gray-100 rounded-2xl p-4 shadow-md">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg text-gray-900 font-poppins">Recent Users</h2>
            <a href="/admin/users" className="text-black text-sm font-poppins">
              View All
            </a>
          </div>
          <DataTable
            columns={recentUsersColumns}
            data={data.recentUsers as unknown as Record<string, unknown>[]}
          />
        </div>

        <div className="bg-gray-100 rounded-2xl p-4 shadow-md">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg text-gray-900 font-poppins">Top Videos Today</h2>
            <select
               value={videoFilter}
               onChange={(e) => setVideoFilter(e.target.value)}
               className="border border-gray-300 rounded-lg px-3 py-2 text-sm bg-white text-black font-poppins"
             >
              <option value="today">Filter: Today</option>
              <option value="week">Filter: Week</option>
              <option value="month">Filter: Month</option>
            </select>
          </div>
          <DataTable
            columns={topVideosColumns}
            data={data.topVideos as unknown as Record<string, unknown>[]}
          />
        </div>
      </div>
    </div>
  );
}
