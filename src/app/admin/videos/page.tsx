"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { adminApi } from "@/lib/admin-api";
import { Video } from "@/lib/admin-types";
import DataTable from "@/components/admin/DataTable";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faSearch } from "@fortawesome/free-solid-svg-icons";

export default function Videos() {
  const router = useRouter();
  const [videos, setVideos] = useState<Video[]>([]);
  const [pools, setPools] = useState<string[]>([]);
  const [sequences, setSequences] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [poolFilter, setPoolFilter] = useState("");
  const [sequenceFilter, setSequenceFilter] = useState("");
  const [currentPage, setCurrentPage] = useState(1);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [videosResponse, filtersResponse] = await Promise.all([
          adminApi.getVideos(
            currentPage,
            10,
            poolFilter || undefined,
            sequenceFilter || undefined,
            searchQuery || undefined
          ),
          adminApi.getVideoFilters(),
        ]);

        setVideos(videosResponse.data.data);
        setPools(filtersResponse.data.pools);
        setSequences(filtersResponse.data.sequences);
      } catch (error) {
        console.error("Failed to fetch videos data:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [currentPage, poolFilter, sequenceFilter, searchQuery]);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    setCurrentPage(1);
  };

  const columns = [
    { key: "name", label: "Video Name" },
    { key: "uploader", label: "Uploader" },
    { key: "gender", label: "Gender" },
    {
      key: "sequence",
      label: "Sequence & Pool Assignment",
      render: (value: unknown, row: Record<string, unknown>) => `${row.sequence}`
    },
    {
      key: "swipeCount",
      label: "Count Swipe/View",
      render: (value: unknown, row: Record<string, unknown>) => `${row.swipeCount}/${row.viewCount}`
    },
    { key: "uploaded", label: "Uploaded" },
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
        <h1 className="text-2xl font-bold text-gray-900">Videos</h1>
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
            onClick={() => router.push("/admin/videos/add")}
            className="bg-purple-600 text-white px-4 py-2 rounded-lg hover:bg-purple-700 transition-colors font-poppins"
          >
            + Add New Video
          </button>
        </div>
      </div>

      <div className="flex items-center space-x-4">
        <select
          value={poolFilter}
          onChange={(e) => setPoolFilter(e.target.value)}
          className="border border-gray-300 rounded-lg px-3 py-2 text-sm bg-white text-black font-poppins focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent"
        >
          <option value="">Pool A</option>
          {pools.map((pool) => (
            <option key={pool} value={pool}>
              Pool {pool}
            </option>
          ))}
        </select>

        <select
          value={sequenceFilter}
          onChange={(e) => setSequenceFilter(e.target.value)}
          className="border border-gray-300 rounded-lg px-3 py-2 text-sm bg-white text-black font-poppins focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent"
        >
          <option value="">Sequence 1</option>
          {sequences.map((sequence) => (
            <option key={sequence} value={sequence}>
              Sequence {sequence}
            </option>
          ))}
        </select>
      </div>
      <div className="bg-gray-100 rounded-2xl p-4 shadow-md">
        <DataTable columns={columns} data={videos as unknown as Record<string, unknown>[]} />
      </div>
    </div>
  );
}
