import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { videosService, CreateVideoRequest, UpdateVideoRequest } from "../services/videosService";

// Query key factory for consistent caching
export const videosKeys = {
  all: ["videos"] as const,
  lists: () => [...videosKeys.all, "list"] as const,
  list: (filters: Record<string, unknown>) => [...videosKeys.lists(), filters] as const,
  details: () => [...videosKeys.all, "detail"] as const,
  detail: (id: number) => [...videosKeys.details(), id] as const,
  filters: () => [...videosKeys.all, "filters"] as const,
};

// Query hooks (for fetching data)
export const useVideos = (params?: {
  page?: number;
  per_page?: number;
  pool_id?: number;
  sequence_id?: number;
  gender?: string;
  status?: string;
  search?: string;
}) => {
  return useQuery({
    queryKey: videosKeys.list(params || {}),
    queryFn: () => videosService.getVideos(params),
    staleTime: 5 * 60 * 1000, // 5 minutes
  });
};

export const useVideo = (id: number) => {
  return useQuery({
    queryKey: videosKeys.detail(id),
    queryFn: () => videosService.getVideo(id),
    enabled: !!id,
    staleTime: 5 * 60 * 1000, // 5 minutes
  });
};

export const useVideoFilters = () => {
  return useQuery({
    queryKey: videosKeys.filters(),
    queryFn: () => videosService.getVideoFilters(),
    staleTime: 10 * 60 * 1000, // 10 minutes
  });
};

// Mutation hooks (for changing data)
export const useCreateVideo = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: CreateVideoRequest) => videosService.createVideo(data),
    onSuccess: () => {
      // Invalidate and refetch videos list
      queryClient.invalidateQueries({ queryKey: videosKeys.lists() });
    },
    onError: (error) => {
    },
  });
};

export const useUpdateVideo = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, data }: { id: number; data: UpdateVideoRequest }) =>
      videosService.updateVideo(id, data),
    onSuccess: (_, { id }) => {
      // Invalidate and refetch videos list and specific video
      queryClient.invalidateQueries({ queryKey: videosKeys.lists() });
      queryClient.invalidateQueries({ queryKey: videosKeys.detail(id) });
    },
    onError: (error) => {
    },
  });
};

export const useDeleteVideo = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: number) => videosService.deleteVideo(id),
    onSuccess: () => {
      // Invalidate and refetch videos list
      queryClient.invalidateQueries({ queryKey: videosKeys.lists() });
    },
    onError: (error) => {
    },
  });
};
