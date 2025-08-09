"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { deductionRulesService, CreateDeductionRuleRequest, UpdateDeductionRuleRequest } from "../services/deductionRulesService";

export const useDeductionRules = (params?: { q?: string; active?: boolean; page?: number; per_page?: number }) =>
  useQuery({
    queryKey: ["deduction_rules", params],
    queryFn: () => deductionRulesService.list(params),
  });

export const useDeductionRule = (id: number) =>
  useQuery({
    queryKey: ["deduction_rule", id],
    queryFn: () => deductionRulesService.get(id),
    enabled: !!id,
  });

export const useCreateDeductionRule = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: CreateDeductionRuleRequest) => deductionRulesService.create(payload),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["deduction_rules"] });
    },
  });
};

export const useUpdateDeductionRule = (id: number) => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: UpdateDeductionRuleRequest) => deductionRulesService.update(id, payload),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["deduction_rules"] });
      qc.invalidateQueries({ queryKey: ["deduction_rule", id] });
    },
  });
};

export const useDeleteDeductionRule = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => deductionRulesService.delete(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["deduction_rules"] });
    },
  });
};
