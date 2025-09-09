import { adminApi } from "../adminBaseAPI";

export interface DeductionRule {
  id: number;
  name?: string;
  threshold_seconds?: number;
  coins: number;
  active: boolean;
  deduction_type: 'duration' | 'per_swipe';
  created_at: string;
  updated_at: string;
}

export interface DeductionRulesListResponse {
  deduction_rules: DeductionRule[];
  pagination: {
    current_page: number;
    total_pages: number;
    total_count: number;
    per_page: number;
  };
}

export interface CreateDeductionRuleRequest {
  name?: string;
  threshold_seconds?: number;
  coins: number;
  active?: boolean;
  deduction_type: 'duration' | 'per_swipe';
}

export interface UpdateDeductionRuleRequest {
  name?: string;
  threshold_seconds?: number;
  coins?: number;
  active?: boolean;
  deduction_type?: 'duration' | 'per_swipe';
}

export const deductionRulesService = {
  list: (params?: { q?: string; active?: boolean; page?: number; per_page?: number }) =>
    adminApi.get<{ success: boolean; data: DeductionRulesListResponse }>(
      `/admin/deduction_rules${buildQuery(params)}`
    ),
  get: (id: number) => adminApi.get<{ success: boolean; data: { deduction_rule: DeductionRule } }>(`/admin/deduction_rules/${id}`),
  create: (payload: CreateDeductionRuleRequest) =>
    adminApi.post<{ success: boolean; data: { deduction_rule: DeductionRule } }>(`/admin/deduction_rules`, { deduction_rule: payload }),
  update: (id: number, payload: UpdateDeductionRuleRequest) =>
    adminApi.patch<{ success: boolean; data: { deduction_rule: DeductionRule } }>(`/admin/deduction_rules/${id}`, { deduction_rule: payload }),
  delete: (id: number) => adminApi.delete<{ success: boolean; message: string }>(`/admin/deduction_rules/${id}`),
};

function buildQuery(params?: Record<string, unknown>) {
  if (!params) return "";
  const search = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (value === undefined || value === null || value === "") return;
    search.set(key, String(value));
  });
  const qs = search.toString();
  return qs ? `?${qs}` : "";
}







