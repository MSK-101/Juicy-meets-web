import { api } from '../baseAPI';

export interface ReportResponse {
  success: boolean;
  message: string;
}

export interface BlockedUser {
  id: string;
  email: string;
}

export const reportService = {
  // Report a user
  async reportUser(reportedUserId: string): Promise<ReportResponse> {
    const response = await api.post('/reports', { reported_user_id: reportedUserId }) as ReportResponse;
    return response;
  },

  // Get user's reports
  async getUserReports() {
    const response = await api.get('/reports') as any;
    return response;
  },

  // Get blocked users
  async getBlockedUsers(): Promise<{ success: boolean; blocked_users: BlockedUser[] }> {
    const response = await api.get('/reports/blocked_users') as { success: boolean; blocked_users: BlockedUser[] };
    return response;
  },

  // Unblock a user
  async unblockUser(userId: string): Promise<{ success: boolean; message: string }> {
    const response = await api.delete(`/reports/unblock/${userId}`) as { success: boolean; message: string };
    return response;
  }
};
