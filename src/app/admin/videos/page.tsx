"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useVideos, useVideoFilters } from "@/api/hooks/useVideosQueries";
import { usePools } from "@/api/hooks/usePoolsQueries";
import DataTable from "@/components/admin/DataTable";
import Pagination from "@/components/Pagination";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faSearch, faEdit } from "@fortawesome/free-solid-svg-icons";

export default function Videos() {
  const router = useRouter();
  const [searchQuery, setSearchQuery] = useState("");
  const [poolFilter, setPoolFilter] = useState<number | null>(null);
  const [genderFilter, setGenderFilter] = useState<string>("");
  const [statusFilter, setStatusFilter] = useState<string>("");
  const [currentPage, setCurrentPage] = useState(1);

  // Fetch data
  const { data: videosData, isLoading: videosLoading, error: videosError } = useVideos({
    page: currentPage,
    per_page: 10,
                 pool_id: poolFilter || undefined,
    gender: genderFilter || undefined,
    status: statusFilter || undefined,
    search: searchQuery || undefined,
  });

  const { data: filtersData, isLoading: filtersLoading } = useVideoFilters();
  const { data: poolsData, isLoading: poolsLoading } = usePools();

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    setCurrentPage(1);
  };

  const columns = [
    { key: "name", label: "Video Name" },
    {
      key: "gender",
      label: "Gender",
      render: (value: unknown) => typeof value === 'string' ? value.charAt(0).toUpperCase() + value.slice(1) : 'N/A'
    },
    {
      key: "status",
      label: "Status",
      render: (value: unknown) => typeof value === 'string' ? value.charAt(0).toUpperCase() + value.slice(1) : 'N/A'
    },
    {
      key: "pool",
      label: "Pool",
      render: (value: unknown) => {
        const pool = value as { name?: string };
        return pool?.name || "N/A";
      }
    },
    {
      key: "sequence",
      label: "Sequence",
      render: (value: unknown) => {
        const sequence = value as { name?: string };
        return sequence?.name || "N/A";
      }
    },
    {
      key: "admin",
      label: "Uploaded By",
      render: (value: unknown) => {
        const admin = value as { display_name?: string; email?: string };
        return admin?.display_name || admin?.email || "N/A";
      }
    },
    {
      key: "created_at",
      label: "Uploaded",
      render: (value: unknown) => {
        if (typeof value === 'string') {
          return new Date(value).toLocaleDateString();
        }
        return 'N/A';
      }
    },
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

  if (videosLoading || filtersLoading || poolsLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-600"></div>
      </div>
    );
  }

  if (videosError) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <h3 className="text-lg font-semibold text-gray-900 mb-2">Error loading videos</h3>
          <p className="text-gray-600">Please try again later.</p>
        </div>
      </div>
    );
  }

  const videos = videosData?.videos || [];
  const filters = filtersData || { pools: [], genders: [], statuses: [] };
  const pools = poolsData || [];

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
          value={poolFilter || ""}
          onChange={(e) => {
                                 setPoolFilter(e.target.value ? Number(e.target.value) : null);
            setCurrentPage(1);
          }}
          className="border border-gray-300 rounded-lg px-3 py-2 text-sm bg-white text-black font-poppins focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent"
        >
          <option value="">All Pools</option>
          {pools.map((pool) => (
            <option key={pool.id} value={pool.id}>
              {pool.name}
            </option>
          ))}
        </select>

                         {/* Sequence filter removed for now - can be added later if needed */}

        <select
          value={genderFilter}
          onChange={(e) => {
            setGenderFilter(e.target.value);
            setCurrentPage(1);
          }}
          className="border border-gray-300 rounded-lg px-3 py-2 text-sm bg-white text-black font-poppins focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent"
        >
          <option value="">All Genders</option>
          {filters.genders.map((gender) => (
            <option key={gender.value} value={gender.value}>
              {gender.label}
            </option>
          ))}
        </select>

        <select
          value={statusFilter}
          onChange={(e) => {
            setStatusFilter(e.target.value);
            setCurrentPage(1);
          }}
          className="border border-gray-300 rounded-lg px-3 py-2 text-sm bg-white text-black font-poppins focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent"
        >
          <option value="">All Statuses</option>
          {filters.statuses.map((status) => (
            <option key={status.value} value={status.value}>
              {status.label}
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
                 {videosData?.pagination && (
                   <Pagination
                     currentPage={videosData.pagination.current_page}
                     totalPages={videosData.pagination.total_pages}
                     totalCount={videosData.pagination.total_count}
                     perPage={videosData.pagination.per_page}
                     onPageChange={setCurrentPage}
                     className="mt-4"
                   />
                 )}
      </div>
    </div>
  );
}
