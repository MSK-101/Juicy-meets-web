"use client";

import { useParams, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { useDeductionRule, useUpdateDeductionRule } from "@/api";
import Toast from "@/components/ui/toast";

export default function EditDeductionRulePage() {
  const params = useParams<{ id: string }>();
  const id = Number(params.id);
  const router = useRouter();
  const { data, isLoading } = useDeductionRule(id);
  const { mutate, isPending, error } = useUpdateDeductionRule(id);
  const [toast, setToast] = useState<{ message: string; type: "success" | "error"; isVisible: boolean }>({
    message: "",
    type: "success",
    isVisible: false,
  });

  const [name, setName] = useState("");
  const [thresholdSeconds, setThresholdSeconds] = useState<string>("");
  const [coins, setCoins] = useState<string>("");
  const [active, setActive] = useState<boolean>(true);
  const [deductionType, setDeductionType] = useState<'duration' | 'per_swipe'>('duration');

  useEffect(() => {
    const rule = data?.data?.deduction_rule;
    if (rule) {
      setName(rule.name || "");
      setThresholdSeconds(String(rule.threshold_seconds || ""));
      setCoins(String(rule.coins));
      setActive(rule.active);
      setDeductionType(rule.deduction_type || 'duration');
    }
  }, [data]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const threshold = deductionType === 'duration' ? parseInt(thresholdSeconds, 10) : null;
    const coinsNum = parseInt(coins, 10);
    mutate(
      {
        name,
        threshold_seconds: threshold,
        coins: coinsNum,
        active,
        deduction_type: deductionType
      },
      {
        onSuccess: () => {
          setToast({ message: "Rule updated successfully", type: "success", isVisible: true });
          setTimeout(() => router.push("/admin/deduction-rules"), 700);
        },
        onError: (err: unknown) => {
          const message = err instanceof Error ? err.message : "Failed to update rule";
          setToast({ message, type: "error", isVisible: true });
        },
      }
    );
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-600"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-gray-900 text-center">Edit Deduction Rule</h1>
      <form onSubmit={handleSubmit} className="bg-gray-100 rounded-2xl p-6 shadow-md space-y-4 w-full max-w-4xl mx-auto">
        <div>
          <label className="block text-sm font-medium text-gray-700">Deduction Type</label>
          <select
            value={deductionType}
            onChange={(e) => setDeductionType(e.target.value as 'duration' | 'per_swipe')}
            className="mt-1 block w-full py-1 px-2 rounded-md border-gray-300 shadow-sm focus:border-purple-500 focus:ring-purple-500 bg-white text-black font-poppins"
            required
          >
            <option value="duration">Duration-based (deducts at specific time intervals)</option>
            <option value="per_swipe">Per Swipe (deducts on each successful swipe)</option>
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700">Name (optional)</label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="mt-1 block w-full rounded-md border-gray-300 py-1 px-2 shadow-sm focus:border-purple-500 focus:ring-purple-500 bg-white text-black font-poppins"
          />
        </div>
        {deductionType === 'duration' && (
          <div>
            <label className="block text-sm font-medium text-gray-700">Threshold seconds</label>
            <input
              type="number"
              min={1}
              value={thresholdSeconds}
              onChange={(e) => setThresholdSeconds(e.target.value)}
              className="mt-1 block w-full rounded-md border-gray-300 shadow-sm py-1 px-2  focus:border-purple-500 focus:ring-purple-500 bg-white text-black font-poppins"
              required
            />
          </div>
        )}
        <div>
          <label className="block text-sm font-medium text-gray-700">Coins</label>
          <input
            type="number"
            min={1}
            value={coins}
            onChange={(e) => setCoins(e.target.value)}
            className="mt-1 block w-full rounded-md py-1 px-2  border-gray-300 shadow-sm focus:border-purple-500 focus:ring-purple-500 bg-white text-black font-poppins"
            required
          />
        </div>
        <div className="flex items-center space-x-2">
          <input
            id="active"
            type="checkbox"
            checked={active}
            onChange={(e) => setActive(e.target.checked)}
            className="h-4 w-4 text-purple-600 focus:ring-purple-500 border-gray-300 rounded"
          />
          <label htmlFor="active" className="text-sm text-gray-700">Active</label>
        </div>
        {error && (
          <p className="text-sm text-red-600">Failed to update rule</p>
        )}
        <div className="flex justify-center space-x-3">
          <button
            type="submit"
            disabled={isPending}
            className="bg-purple-600 text-white px-4 py-2 rounded-lg hover:bg-purple-700 transition-colors"
          >
            {isPending ? "Saving..." : "Save"}
          </button>
          <button
            type="button"
            onClick={() => router.push("/admin/deduction-rules")}
            className="bg-gray-200 text-black px-4 py-2 rounded-lg hover:bg-gray-300 transition-colors"
          >
            Cancel
          </button>
        </div>
      </form>
      <Toast
        message={toast.message}
        type={toast.type}
        isVisible={toast.isVisible}
        onClose={() => setToast((t) => ({ ...t, isVisible: false }))}
      />
    </div>
  );
}
