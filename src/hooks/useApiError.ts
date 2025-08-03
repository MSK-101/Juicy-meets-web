import { useState, useCallback } from "react";
import type { AdminAPIError } from "@/api/adminBaseAPI";
import type { FormErrors } from "@/api/types";

interface UseApiErrorReturn {
  error: string | null;
  formErrors: FormErrors;
  setError: (message: string) => void;
  setFormErrors: (errors: FormErrors) => void;
  clearErrors: () => void;
  handleApiError: (error: unknown) => void;
}

export const useApiError = (): UseApiErrorReturn => {
  const [error, setErrorState] = useState<string | null>(null);
  const [formErrors, setFormErrorsState] = useState<FormErrors>({});

  const setError = useCallback((message: string) => {
    setErrorState(message);
    setFormErrorsState({});
  }, []);

  const setFormErrors = useCallback((errors: FormErrors) => {
    setFormErrorsState(errors);
    setErrorState(null);
  }, []);

  const clearErrors = useCallback(() => {
    setErrorState(null);
    setFormErrorsState({});
  }, []);

  const handleApiError = useCallback((error: unknown) => {
    console.error("API Error:", error);

    if (error instanceof AdminAPIError) {
      // Handle structured API errors
      if (error.response && typeof error.response === 'object' && 'errors' in error.response) {
        const apiErrors = error.response.errors as Record<string, unknown>;
        const newErrors: FormErrors = {};

        Object.keys(apiErrors).forEach(key => {
          const value = apiErrors[key];
          if (Array.isArray(value)) {
            newErrors[key] = value[0] as string;
          } else if (typeof value === 'string') {
            newErrors[key] = value;
          }
        });

        setFormErrors(newErrors);
      } else {
        setError(error.message);
      }
    } else if (error instanceof Error) {
      setError(error.message);
    } else {
      setError("An unexpected error occurred");
    }
  }, [setError, setFormErrors]);

  return {
    error,
    formErrors,
    setError,
    setFormErrors,
    clearErrors,
    handleApiError,
  };
};
