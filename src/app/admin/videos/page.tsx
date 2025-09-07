"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { adminApi } from "@/lib/admin-api";
import { Video } from "@/lib/admin-types";
import DataTable from "@/components/admin/DataTable";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faSearch, faEdit } from "@fortawesome/free-solid-svg-icons";
import { useAdminToken } from "@/store/adminAuth";

export default function Videos() {
  const router = useRouter();
  const [videos, setVideos] = useState<Video[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [poolFilter, setPoolFilter] = useState<string>("");
  const [sequenceFilter, setSequenceFilter] = useState<string>("");
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalVideos, setTotalVideos] = useState(0);
  const [filters, setFilters] = useState<{ pools: string[]; sequences: string[] }>({ pools: [], sequences: [] });
  const adminToken = useAdminToken();

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [videosResponse, filtersResponse] = await Promise.all([
          adminApi.getVideos(currentPage, 10, poolFilter || undefined, sequenceFilter || undefined, searchQuery || undefined, adminToken || undefined),
          adminApi.getVideoFilters(adminToken || undefined),
        ]);

        setVideos(videosResponse.data.data);
        setTotalPages(videosResponse.data.totalPages);
        setTotalVideos(videosResponse.data.total);
        setFilters(filtersResponse.data);
      } catch (error) {
        console.error("Failed to fetch videos data:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [currentPage, poolFilter, sequenceFilter, searchQuery, adminToken]);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    setCurrentPage(1);
  };

  const columns = [
    { key: "name", label: "Video Name" },
    { key: "gender", label: "Gender" },
    { key: "status", label: "Status" },
    { key: "pool", label: "Pool" },
    { key: "sequence", label: "Sequence" },
    { key: "uploader", label: "Uploader" },
    { key: "swipeCount", label: "Swipes" },
    { key: "viewCount", label: "Views (min)" },
    { key: "uploaded", label: "Uploaded" },
    {
      key: "actions",
      label: "Actions",
      render: (value: unknown, row: Record<string, unknown>) => {
        const videoId = row.id as number;
        return (
          <button
            onClick={() => router.push(`/admin/videos/edit/${videoId}`)}
            className="inline-flex items-center px-2 py-1 text-sm text-purple-600 hover:text-purple-700 hover:bg-purple-50 rounded transition-colors"
          >
            <FontAwesomeIcon icon={faEdit} className="w-4 h-4 mr-1" />
            Edit
          </button>
        );
      }
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
    <div className="space-y-6 min-h-full">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <h1 className="text-2xl font-bold text-gray-900">Videos</h1>
        <div className="flex flex-col sm:flex-row items-start sm:items-center space-y-2 sm:space-y-0 sm:space-x-4 w-full sm:w-auto">
          <div className="relative w-full sm:w-auto">
            <form onSubmit={handleSearch} className="flex items-center space-x-2">
              <input
                type="text"
                placeholder="Search videos..."
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
            onClick={() => router.push("/admin/videos/add")}
            className="bg-purple-600 text-white px-4 py-2 rounded-lg hover:bg-purple-700 transition-colors font-poppins w-full sm:w-auto"
          >
            + Add New Video
          </button>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-4">
        <select
          value={poolFilter}
          onChange={(e) => {
            setPoolFilter(e.target.value);
            setCurrentPage(1);
          }}
          className="border border-gray-300 rounded-lg px-3 py-2 text-sm bg-white text-black font-poppins focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent"
        >
          <option value="">All Pools</option>
          {filters.pools.map((pool) => (
            <option key={pool} value={pool}>
              {pool}
            </option>
          ))}
        </select>

        <select
          value={sequenceFilter}
          onChange={(e) => {
            setSequenceFilter(e.target.value);
            setCurrentPage(1);
          }}
          className="border border-gray-300 rounded-lg px-3 py-2 text-sm bg-white text-black font-poppins focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent"
        >
          <option value="">All Sequences</option>
          {filters.sequences.map((sequence) => (
            <option key={sequence} value={sequence}>
              {sequence}
            </option>
          ))}
        </select>
      </div>

      <div className="bg-gray-100 rounded-2xl p-4 shadow-md">
        <DataTable
          columns={columns}
          data={videos as unknown as Record<string, unknown>[]}
        />

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between mt-4">
            <div className="text-sm text-gray-700">
              Showing {((currentPage - 1) * 10) + 1} to {Math.min(currentPage * 10, totalVideos)} of {totalVideos} videos
            </div>
            <div className="flex space-x-2">
              <button
                onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
                disabled={currentPage === 1}
                className="px-3 py-1 text-sm border border-gray-300 rounded disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50"
              >
                Previous
              </button>
              <span className="px-3 py-1 text-sm bg-purple-600 text-white rounded">
                {currentPage}
              </span>
              <button
                onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
                disabled={currentPage === totalPages}
                className="px-3 py-1 text-sm border border-gray-300 rounded disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50"
              >
                Next
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
