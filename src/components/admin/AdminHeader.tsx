"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faSearch, faSignOutAlt } from "@fortawesome/free-solid-svg-icons";

export default function AdminHeader() {
  const [searchQuery, setSearchQuery] = useState("");
  const router = useRouter();

  const handleLogout = () => {
    localStorage.removeItem("adminToken");
    router.push("/admin/login");
  };

  return (
    <></>

  );
}
