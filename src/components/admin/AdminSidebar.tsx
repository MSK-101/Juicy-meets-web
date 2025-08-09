"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { cn } from "@/lib/utils";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import Image from "next/image";
import {
  faChartBar,
  faUsers,
  faVideo,
  faChartLine,
  faShieldAlt,
  faChartArea,
  faChartPie,
  faCog,
  faFileAlt,
  faSignOutAlt,
} from "@fortawesome/free-solid-svg-icons";
import { useAdminLogout } from "@/api/hooks/useAdminAuthQueries";

const navigationItems = [
  {
    name: "Dashboard",
    href: "/admin/dashboard",
    icon: faChartBar,
  },
  {
    name: "Users",
    href: "/admin/users",
    icon: faUsers,
  },
  {
    name: "Videos",
    href: "/admin/videos",
    icon: faVideo,
  },
  {
    name: "Algorithm",
    href: "/admin/algorithm",
    icon: faChartLine,
  },
  {
    name: "Paid Staff",
    href: "/admin/paid-staff",
    icon: faShieldAlt,
  },
  {
    name: "Monetization",
    href: "/admin/monetization",
    icon: faChartArea,
  },
  {
    name: "Deduction Rules",
    href: "/admin/deduction-rules",
    icon: faCog,
  },
  {
    name: "Analytics",
    href: "/admin/analytics",
    icon: faChartPie,
  },
  {
    name: "Settings",
    href: "/admin/settings",
    icon: faCog,
  },
  {
    name: "Reports",
    href: "/admin/reports",
    icon: faFileAlt,
  },
];

export default function AdminSidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const { mutate: logout, isPending } = useAdminLogout();

  const handleLogout = () => {
    logout(undefined, {
      onSuccess: () => {
        router.push("/admin/login");
      },
    });
  };

  return (
    <div className="w-64 bg-[#f5f5f5] min-h-screen px-6 py-6 font-poppins flex-shrink-0">
      {/* Logo */}
      <div className="flex py-3 justify-center mb-8">
        <Link href="/admin/dashboard">
          <Image
            src='/admin_logo.png'
            alt="Juicy Meets"
            width={56}
            height={40}
            className="h-8 w-auto cursor-pointer hover:scale-105 duration-300"
          />
        </Link>
      </div>

      {/* Navigation */}
      <nav className="space-y-2">
        {navigationItems.map((item) => {
          const isActive = pathname.includes(item.href);
          return (
            <Link
              key={item.name}
              href={item.href}
              className={cn(
                "flex items-center rounded-2xl mb-6 px-4 py-3 transition-all duration-200 w-full",
                isActive ? "bg-black shadow-lg" : "hover:bg-gray-200"
              )}
            >
              <div
                className={cn(
                  "w-8 h-8 rounded-lg flex items-center justify-center mr-3 flex-shrink-0",
                  isActive ? "bg-white" : "bg-white"
                )}
              >
                <FontAwesomeIcon
                  icon={item.icon}
                  className={cn(
                    "w-4 h-4",
                    isActive ? "text-black" : "text-black"
                  )}
                />
              </div>
              <span
                className={cn(
                  "ml-2 text-md font-sm flex-1",
                  isActive ? "text-white" : "text-black"
                )}
              >
                {item.name}
              </span>
            </Link>
          );
        })}

        {/* Logout Button */}
        <button
          onClick={handleLogout}
          disabled={isPending}
          className={cn(
            "flex items-center rounded-2xl mb-6 px-4 py-3 transition-all duration-200 w-full hover:bg-gray-200"
          )}
        >
          <div className="w-8 h-8 rounded-lg flex items-center justify-center mr-3 flex-shrink-0 bg-white">
            <FontAwesomeIcon
              icon={faSignOutAlt}
              className="w-4 h-4 text-black"
            />
          </div>
          <span className="ml-2 text-md font-sm text-black">
            {isPending ? "Logging out..." : "Logout"}
          </span>
        </button>
      </nav>
    </div>
  );
}
