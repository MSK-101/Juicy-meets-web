import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  poolsService,
  CreatePoolRequest,
  UpdatePoolRequest,
  CreateSequenceRequest,
  UpdateSequenceRequest,
} from "../services/poolsService";

// Query key factory for consistent caching
export const poolsKeys = {
  all: ["pools"] as const,
  lists: () => [...poolsKeys.all, "list"] as const,
  list: (filters: string) => [...poolsKeys.lists(), { filters }] as const,
  details: () => [...poolsKeys.all, "detail"] as const,
  detail: (id: number) => [...poolsKeys.details(), id] as const,
  sequences: (poolId: number) => [...poolsKeys.detail(poolId), "sequences"] as const,
  sequence: (poolId: number, sequenceId: number) => [...poolsKeys.sequences(poolId), sequenceId] as const,
};

// Query hooks (for fetching data)
export const usePools = () => {
  return useQuery({
    queryKey: poolsKeys.lists(),
    queryFn: poolsService.getPools,
    staleTime: 2 * 60 * 1000, // 2 minutes
  });
};

export const usePool = (id: number) => {
  return useQuery({
    queryKey: poolsKeys.detail(id),
    queryFn: () => poolsService.getPool(id),
    enabled: !!id,
    staleTime: 2 * 60 * 1000, // 2 minutes
  });
};

export const useSequences = (poolId: number) => {
  return useQuery({
    queryKey: poolsKeys.sequences(poolId),
    queryFn: () => poolsService.getSequences(poolId),
    enabled: !!poolId,
    staleTime: 2 * 60 * 1000, // 2 minutes
  });
};

export const useSequence = (poolId: number, sequenceId: number) => {
  return useQuery({
    queryKey: poolsKeys.sequence(poolId, sequenceId),
    queryFn: () => poolsService.getSequence(poolId, sequenceId),
    enabled: !!poolId && !!sequenceId,
    staleTime: 2 * 60 * 1000, // 2 minutes
  });
};

// Mutation hooks (for changing data)
export const useCreatePool = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: CreatePoolRequest) => poolsService.createPool(data),
    onSuccess: () => {
      // Invalidate and refetch pools list
      queryClient.invalidateQueries({ queryKey: poolsKeys.lists() });
    },
    onError: (error) => {
    },
  });
};

export const useUpdatePool = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, data }: { id: number; data: UpdatePoolRequest }) =>
      poolsService.updatePool(id, data),
    onSuccess: (_, { id }) => {
      // Invalidate and refetch specific pool and pools list
      queryClient.invalidateQueries({ queryKey: poolsKeys.detail(id) });
      queryClient.invalidateQueries({ queryKey: poolsKeys.lists() });
    },
    onError: (error) => {
    },
  });
};

export const useDeletePool = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: number) => poolsService.deletePool(id),
    onSuccess: () => {
      // Invalidate and refetch pools list
      queryClient.invalidateQueries({ queryKey: poolsKeys.lists() });
    },
    onError: (error) => {
    },
  });
};

export const useCreateSequence = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ poolId, data }: { poolId: number; data: CreateSequenceRequest }) =>
      poolsService.createSequence(poolId, data),
    onSuccess: (_, { poolId }) => {
      // Invalidate and refetch sequences for the pool
      queryClient.invalidateQueries({ queryKey: poolsKeys.sequences(poolId) });
      queryClient.invalidateQueries({ queryKey: poolsKeys.detail(poolId) });
    },
    onError: (error) => {
    },
  });
};

export const useUpdateSequence = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ poolId, sequenceId, data }: { poolId: number; sequenceId: number; data: UpdateSequenceRequest }) =>
      poolsService.updateSequence(poolId, sequenceId, data),
    onSuccess: (_, { poolId, sequenceId }) => {
      // Invalidate and refetch specific sequence and sequences list
      queryClient.invalidateQueries({ queryKey: poolsKeys.sequence(poolId, sequenceId) });
      queryClient.invalidateQueries({ queryKey: poolsKeys.sequences(poolId) });
      queryClient.invalidateQueries({ queryKey: poolsKeys.detail(poolId) });
    },
    onError: (error) => {
    },
  });
};

export const useDeleteSequence = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ poolId, sequenceId }: { poolId: number; sequenceId: number }) =>
      poolsService.deleteSequence(poolId, sequenceId),
    onSuccess: (_, { poolId }) => {
      // Invalidate and refetch sequences for the pool
      queryClient.invalidateQueries({ queryKey: poolsKeys.sequences(poolId) });
      queryClient.invalidateQueries({ queryKey: poolsKeys.detail(poolId) });
    },
    onError: (error) => {
    },
  });
};

export const useReorderSequences = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ poolId, sequenceIds }: { poolId: number; sequenceIds: number[] }) =>
      poolsService.reorderSequences(poolId, sequenceIds),
    onSuccess: (_, { poolId }) => {
      // Invalidate and refetch sequences for the pool
      queryClient.invalidateQueries({ queryKey: poolsKeys.sequences(poolId) });
      queryClient.invalidateQueries({ queryKey: poolsKeys.detail(poolId) });
    },
    onError: (error) => {
    },
  });
};
