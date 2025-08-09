import { adminApi } from "../adminBaseAPI";
import type {
  Pool,
  Sequence,
  PoolWithSequences,
  CreatePoolRequest,
  UpdatePoolRequest,
  CreateSequenceRequest,
  UpdateSequenceRequest,
  ReorderSequencesRequest
} from "../types";

// API endpoints
const ENDPOINTS = {
  pools: "/pools",
  sequences: (poolId: number) => `/pools/${poolId}/sequences`,
  reorderSequences: (poolId: number) => `/pools/${poolId}/sequences/reorder`,
} as const;

// Service functions
export const poolsService = {
  // Pool operations
  async getPools(): Promise<Pool[]> {
    const response = await adminApi.get<{ pools: Pool[] }>(ENDPOINTS.pools);
    return response.pools;
  },

  async getPool(id: number): Promise<PoolWithSequences> {
    const response = await adminApi.get<{ pool: PoolWithSequences }>(`${ENDPOINTS.pools}/${id}`);
    return response.pool;
  },

  async createPool(data: CreatePoolRequest): Promise<Pool> {
    const response = await adminApi.post<{ pool: Pool }>(ENDPOINTS.pools, { pool: data });
    return response.pool;
  },

  async updatePool(id: number, data: UpdatePoolRequest): Promise<Pool> {
    const response = await adminApi.put<{ pool: Pool }>(`${ENDPOINTS.pools}/${id}`, { pool: data });
    return response.pool;
  },

  async deletePool(id: number): Promise<void> {
    await adminApi.delete(`${ENDPOINTS.pools}/${id}`);
  },

  // Sequence operations
  async getSequences(poolId: number): Promise<Sequence[]> {
    const response = await adminApi.get<{ sequences: Sequence[] }>(ENDPOINTS.sequences(poolId));
    return response.sequences;
  },

  async getSequence(poolId: number, sequenceId: number): Promise<Sequence> {
    const response = await adminApi.get<{ sequence: Sequence }>(`${ENDPOINTS.sequences(poolId)}/${sequenceId}`);
    return response.sequence;
  },

  async createSequence(poolId: number, data: CreateSequenceRequest): Promise<Sequence> {
    const response = await adminApi.post<{ sequence: Sequence }>(ENDPOINTS.sequences(poolId), { sequence: data });
    return response.sequence;
  },

  async updateSequence(poolId: number, sequenceId: number, data: UpdateSequenceRequest): Promise<Sequence> {
    const response = await adminApi.put<{ sequence: Sequence }>(`${ENDPOINTS.sequences(poolId)}/${sequenceId}`, { sequence: data });
    return response.sequence;
  },

  async deleteSequence(poolId: number, sequenceId: number): Promise<void> {
    await adminApi.delete(`${ENDPOINTS.sequences(poolId)}/${sequenceId}`);
  },

  async reorderSequences(poolId: number, sequenceIds: number[]): Promise<void> {
    await adminApi.patch(ENDPOINTS.reorderSequences(poolId), { sequence_ids: sequenceIds });
  },
};

// Export types for convenience
export type {
  Pool,
  Sequence,
  PoolWithSequences,
  CreatePoolRequest,
  UpdatePoolRequest,
  CreateSequenceRequest,
  UpdateSequenceRequest,
  ReorderSequencesRequest,
};
