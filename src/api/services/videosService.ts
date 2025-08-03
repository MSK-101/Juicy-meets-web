import { adminApi } from "../adminBaseAPI";
import type {
  Video,
  CreateVideoRequest,
  UpdateVideoRequest,
  VideoFilters,
  VideoListResponse
} from "../types";

// API endpoints
const ENDPOINTS = {
  videos: "/videos",
  video: (id: number) => `/videos/${id}`,
  filters: "/videos/filters",
} as const;

// Service functions
export const videosService = {
  // Video operations
  async getVideos(params?: {
    page?: number;
    per_page?: number;
    pool_id?: number;
    sequence_id?: number;
    gender?: string;
    status?: string;
    search?: string;
  }): Promise<VideoListResponse> {
    const queryParams = new URLSearchParams();
    if (params) {
      Object.entries(params).forEach(([key, value]) => {
        if (value !== undefined && value !== null && value !== "") {
          queryParams.append(key, value.toString());
        }
      });
    }

    const endpoint = queryParams.toString()
      ? `${ENDPOINTS.videos}?${queryParams.toString()}`
      : ENDPOINTS.videos;

    const response = await adminApi.get<{ success: boolean; data: VideoListResponse }>(endpoint);
    return response.data;
  },

  async getVideo(id: number): Promise<Video> {
    const response = await adminApi.get<{ success: boolean; data: { video: Video } }>(ENDPOINTS.video(id));
    return response.data.video;
  },

  async createVideo(data: CreateVideoRequest): Promise<Video> {
    const formData = new FormData();
    formData.append("video[name]", data.name);
    formData.append("video[gender]", data.gender);
    formData.append("video[status]", data.status);
    formData.append("video[pool_id]", data.pool_id.toString());
    formData.append("video[sequence_id]", data.sequence_id.toString());
    formData.append("video[video_file]", data.video_file);

    const response = await adminApi.post<{ success: boolean; data: { video: Video } }>(ENDPOINTS.videos, formData);
    return response.data.video;
  },

  async updateVideo(id: number, data: UpdateVideoRequest): Promise<Video> {
    const formData = new FormData();

    if (data.name) formData.append("video[name]", data.name);
    if (data.gender) formData.append("video[gender]", data.gender);
    if (data.status) formData.append("video[status]", data.status);
    if (data.pool_id) formData.append("video[pool_id]", data.pool_id.toString());
    if (data.sequence_id) formData.append("video[sequence_id]", data.sequence_id.toString());
    if (data.video_file) formData.append("video[video_file]", data.video_file);

    const response = await adminApi.put<{ success: boolean; data: { video: Video } }>(ENDPOINTS.video(id), formData);
    return response.data.video;
  },

  async deleteVideo(id: number): Promise<void> {
    await adminApi.delete(ENDPOINTS.video(id));
  },

  async getVideoFilters(): Promise<VideoFilters> {
    const response = await adminApi.get<{ success: boolean; data: VideoFilters }>(ENDPOINTS.filters);
    return response.data;
  },
};

// Export types for convenience
export type {
  Video,
  CreateVideoRequest,
  UpdateVideoRequest,
  VideoFilters,
  VideoListResponse,
};
