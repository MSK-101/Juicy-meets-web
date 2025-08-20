import { adminApi } from "../adminBaseAPI";

export interface Staff {
  id: string;
  name: string;
  username: string;
  email: string;
  age?: number;
  totalActivityTime: string;
  period: string;
  status: "offline" | "online" | "in_chat" | "busy";
  gender: "male" | "female" | "other";
  assignmentStatus: "active" | "inactive";
  regDate: string;
  pool?: string;
  sequence?: string;
  lastActivityAt?: string;
  pool_id?: number;
  sequence_id?: number;
}

export interface StaffAssignment {
  pool_id: number;
  sequence_id: number;
  status: "active" | "inactive";
}

export interface CreateStaffRequest {
  user: {
    email: string;
    age?: number;
    gender?: "male" | "female" | "other";
  };
  staff_assignment: StaffAssignment;
}

export interface UpdateStaffRequest {
  user?: {
    email?: string;
    age?: number;
    gender?: "male" | "female" | "other";
  };
  staff_assignment?: Partial<StaffAssignment>;
}

export interface AvailableStaff {
  id: string;
  email: string;
  pool_id: number;
  sequence_id: number;
  last_activity_at: string;
}

// API endpoints
const ENDPOINTS = {
  staff: "/admin/staff",
  available: "/admin/staff/available",
} as const;

// Service functions
export const staffService = {
  // Get all staff members
  async getStaff(): Promise<Staff[]> {
    const response = await adminApi.get<{ staff: Staff[] }>(ENDPOINTS.staff);
    return response.staff;
  },

  // Get specific staff member
  async getStaffMember(id: string): Promise<Staff> {
    const response = await adminApi.get<{ staff: Staff }>(`${ENDPOINTS.staff}/${id}`);
    return response.staff;
  },

  // Create new staff member
  async createStaff(data: CreateStaffRequest): Promise<{ success: boolean; message: string; staff: Staff }> {
    const response = await adminApi.post<{ success: boolean; message: string; staff: Staff }>(ENDPOINTS.staff, data);
    return response;
  },

  // Update staff member
  async updateStaff(id: string, data: UpdateStaffRequest): Promise<{ success: boolean; message: string }> {
    const response = await adminApi.put<{ success: boolean; message: string }>(`${ENDPOINTS.staff}/${id}`, data);
    return response;
  },

  // Delete staff member
  async deleteStaff(id: string): Promise<{ success: boolean; message: string }> {
    const response = await adminApi.delete<{ success: boolean; message: string }>(`${ENDPOINTS.staff}/${id}`);
    return response;
  },

  // Get available staff for matching
  async getAvailableStaff(poolId?: number): Promise<AvailableStaff[]> {
    const params = new URLSearchParams();
    if (poolId) params.append("pool_id", poolId.toString());

    const response = await adminApi.get<{ available_staff: AvailableStaff[] }>(`${ENDPOINTS.available}?${params}`);
    return response.available_staff;
  },
};
