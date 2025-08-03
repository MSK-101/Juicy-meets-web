"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAdmin, useAdminAuthStore } from "@/store/adminAuth";

interface ProtectedRouteProps {
  children: React.ReactNode;
  requiredRole?: 'super_admin' | 'admin' | 'moderator';
}

export default function ProtectedRoute({ children, requiredRole }: ProtectedRouteProps) {
  const admin = useAdmin();
  const hasHydrated = useAdminAuthStore((state) => state.hasHydrated);
  const router = useRouter();

  useEffect(() => {
    // Wait for store to hydrate before checking authentication
    if (!hasHydrated) {
      return;
    }

    if (!admin) {
      router.push('/admin/login');
      return;
    }

    // Check role permissions if required
    if (requiredRole && admin.role) {
      const roleHierarchy: Record<string, number> = {
        'super_admin': 3,
        'admin': 2,
        'moderator': 1
      };

      const adminRoleLevel = roleHierarchy[admin.role] || 0;
      const requiredRoleLevel = roleHierarchy[requiredRole] || 0;

      if (adminRoleLevel < requiredRoleLevel) {
        router.push('/admin/dashboard');
        return;
      }
    }
  }, [admin, hasHydrated, requiredRole, router]);

  // Show loading while store is hydrating
  if (!hasHydrated) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading...</p>
        </div>
      </div>
    );
  }

  if (!admin) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-bold mb-4">Access Denied</h1>
          <p className="text-gray-600">Please log in to access this page.</p>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}
