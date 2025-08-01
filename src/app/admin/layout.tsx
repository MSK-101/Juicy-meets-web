"use client";

import { useEffect, useState } from "react";
import { useRouter, usePathname } from "next/navigation";
import AdminSidebar from "@/components/admin/AdminSidebar";
interface AdminLayoutProps {
  children: React.ReactNode;
}

export default function AdminLayout({ children }: AdminLayoutProps) {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    // Check if user is authenticated
    const checkAuth = () => {
      const adminToken = localStorage.getItem("adminToken");
      if (!adminToken && pathname !== "/admin/login") {
        router.push("/admin/login");
        return;
      }
      setIsAuthenticated(true);
      setIsLoading(false);
    };

    checkAuth();
  }, [pathname, router]);

  // Show loading state
  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-600"></div>
      </div>
    );
  }

  // If not authenticated and not on login page, redirect
  if (!isAuthenticated && pathname !== "/admin/login") {
    return null;
  }

  // If on login page, don't show sidebar
  if (pathname === "/admin/login") {
    return <>{children}</>;
  }

  return (
    <div className="min-h-screen bg-white admin-panel">
      <div className="flex">
        <AdminSidebar />
        <div className="flex-1 flex flex-col">
          <main className="flex-1 p-6">{children}</main>
        </div>
      </div>
    </div>
  );
}
