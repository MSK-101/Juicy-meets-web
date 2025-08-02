"use client";

import { usePathname } from "next/navigation";
import AdminSidebar from "@/components/admin/AdminSidebar";
import ProtectedRoute from "./components/ProtectedRoute";
interface AdminLayoutProps {
  children: React.ReactNode;
}

export default function AdminLayout({ children }: AdminLayoutProps) {
  const pathname = usePathname();

  // If on login page, don't show sidebar or protection
  if (pathname === "/admin/login") {
    return <>{children}</>;
  }

  return (
    <ProtectedRoute>
      <div className="min-h-screen bg-white admin-panel">
        <div className="flex min-h-screen">
          <AdminSidebar />
          <div className="flex-1 flex flex-col min-h-screen">
            <main className="flex-1 p-6 bg-white">{children}</main>
          </div>
        </div>
      </div>
    </ProtectedRoute>
  );
}
