"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAdmin } from "../store/adminAuth";

interface ProtectedRouteProps {
  children: React.ReactNode;
  requiredRole?: 'super_admin' | 'admin' | 'moderator';
}

export default function ProtectedRoute({ children, requiredRole }: ProtectedRouteProps) {
  const admin = useAdmin();
  const router = useRouter();

  useEffect(() => {
    if (!admin) {
      router.push('/admin/login');
      return;
    }

    // Check role permissions if required
    if (requiredRole) {
      const roleHierarchy = {
        'super_admin': 3,
        'admin': 2,
        'moderator': 1
      };

      const adminRoleLevel = roleHierarchy[admin.role];
      const requiredRoleLevel = roleHierarchy[requiredRole];

      if (adminRoleLevel < requiredRoleLevel) {
        router.push('/admin/dashboard');
        return;
      }
    }
  }, [admin, requiredRole, router]);

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
