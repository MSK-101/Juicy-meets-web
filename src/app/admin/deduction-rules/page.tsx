"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useDeductionRules } from "@/api";
import DataTable from "@/components/admin/DataTable";
import Pagination from "@/components/Pagination";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faSearch, faEdit, faPlus } from "@fortawesome/free-solid-svg-icons";

export default function DeductionRulesPage() {
  const router = useRouter();
  const [searchQuery, setSearchQuery] = useState("");
  const [activeFilter, setActiveFilter] = useState<string>("");
  const [currentPage, setCurrentPage] = useState(1);

  const { data, isLoading, error } = useDeductionRules({
    q: searchQuery || undefined,
    active: activeFilter === "" ? undefined : activeFilter === "true",
    page: currentPage,
    per_page: 10,
  });

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    setCurrentPage(1);
  };

  const columns = [
    { key: "threshold_seconds", label: "Threshold (s)" },
    { key: "coins", label: "Coins" },
    { key: "name", label: "Name" },
    {
      key: "active",
      label: "Active",
      render: (value: unknown) => (value ? "Yes" : "No"),
    },
    {
      key: "actions",
      label: "Actions",
      render: (_: unknown, row: Record<string, unknown>) => (
        <button
          onClick={() => router.push(`/admin/deduction-rules/edit/${row.id}`)}
          className="inline-flex items-center px-2 py-1 text-sm text-purple-600 hover:text-purple-700 hover:bg-purple-50 rounded transition-colors"
        >
          <FontAwesomeIcon icon={faEdit} className="w-4 h-4 mr-1" />
          Edit
        </button>
      ),
    },
  ];

  if (isLoading) {
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
          <h3 className="text-lg font-semibold text-gray-900 mb-2">Error loading rules</h3>
          <p className="text-gray-600">Please try again later.</p>
        </div>
      </div>
    );
  }

  const rules = data?.data?.deduction_rules || [];
  const pagination = data?.data?.pagination;

  return (
    <div className="space-y-6 min-h-full">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <h1 className="text-2xl font-bold text-gray-900">Deduction Rules</h1>
        <div className="flex flex-col sm:flex-row items-start sm:items-center space-y-2 sm:space-y-0 sm:space-x-4 w-full sm:w-auto">
          <div className="relative w-full sm:w-auto">
            <form onSubmit={handleSearch} className="flex items-center space-x-2">
              <input
                type="text"
                placeholder="Search rules..."
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
          <select
            value={activeFilter}
            onChange={(e) => {
              setActiveFilter(e.target.value);
              setCurrentPage(1);
            }}
            className="border border-gray-300 rounded-lg px-3 py-2 text-sm bg-white text-black font-poppins focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent"
          >
            <option value="">All</option>
            <option value="true">Active</option>
            <option value="false">Inactive</option>
          </select>
          <button
            onClick={() => router.push("/admin/deduction-rules/new")}
            className="bg-purple-600 text-white px-4 py-2 rounded-lg hover:bg-purple-700 transition-colors font-poppins w-full sm:w-auto"
          >
            <FontAwesomeIcon icon={faPlus} className="w-4 h-4 mr-2" />
            Add Rule
          </button>
        </div>
      </div>

      <div className="bg-gray-100 rounded-2xl p-4 shadow-md">
        <DataTable columns={columns} data={rules as any[]} />
        {pagination && (
          <Pagination
            currentPage={pagination.current_page}
            totalPages={pagination.total_pages}
            totalCount={pagination.total_count}
            perPage={pagination.per_page}
            onPageChange={setCurrentPage}
            className="mt-4"
          />
        )}
      </div>
    </div>
  );
}
