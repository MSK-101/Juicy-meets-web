import type { FormErrors } from "@/api/types";

export interface ValidationRule {
  required?: boolean;
  minLength?: number;
  maxLength?: number;
  pattern?: RegExp;
  custom?: (value: unknown) => string | null;
}

export interface ValidationSchema {
  [key: string]: ValidationRule;
}

export const validateField = (
  value: unknown,
  rules: ValidationRule
): string | null => {
  // Required check
  if (rules.required && (!value || (typeof value === 'string' && value.trim() === ''))) {
    return 'This field is required';
  }

  // Skip other validations if value is empty and not required
  if (!value || (typeof value === 'string' && value.trim() === '')) {
    return null;
  }

  // Type check
  if (typeof value !== 'string') {
    return 'Invalid value type';
  }

  // Length checks
  if (rules.minLength && value.length < rules.minLength) {
    return `Minimum length is ${rules.minLength} characters`;
  }

  if (rules.maxLength && value.length > rules.maxLength) {
    return `Maximum length is ${rules.maxLength} characters`;
  }

  // Pattern check
  if (rules.pattern && !rules.pattern.test(value)) {
    return 'Invalid format';
  }

  // Custom validation
  if (rules.custom) {
    return rules.custom(value);
  }

  return null;
};

export const validateForm = (
  data: Record<string, unknown>,
  schema: ValidationSchema
): FormErrors => {
  const errors: FormErrors = {};

  Object.keys(schema).forEach(field => {
    const value = data[field];
    const rules = schema[field];
    const error = validateField(value, rules);

    if (error) {
      errors[field] = error;
    }
  });

  return errors;
};

// Common validation schemas
export const videoValidationSchema: ValidationSchema = {
  name: {
    required: true,
    minLength: 1,
    maxLength: 100,
  },
  gender: {
    required: true,
    custom: (value) => {
      const validGenders = ['male', 'female', 'other'];
      return validGenders.includes(value as string) ? null : 'Please select a valid gender';
    },
  },
  status: {
    required: true,
    custom: (value) => {
      const validStatuses = ['active', 'pending', 'inactive'];
      return validStatuses.includes(value as string) ? null : 'Please select a valid status';
    },
  },
  pool_id: {
    required: true,
    custom: (value) => {
      return value && Number(value) > 0 ? null : 'Please select a pool';
    },
  },
  sequence_id: {
    required: true,
    custom: (value) => {
      return value && Number(value) > 0 ? null : 'Please select a sequence';
    },
  },
  video_file: {
    required: true,
    custom: (value) => {
      return value instanceof File ? null : 'Please select a video file';
    },
  },
};

export const sequenceValidationSchema: ValidationSchema = {
  name: {
    required: true,
    minLength: 1,
    maxLength: 100,
  },
  pool_id: {
    required: true,
    custom: (value) => {
      return value && Number(value) > 0 ? null : 'Please select a pool';
    },
  },
  video_count: {
    custom: (value) => {
      if (!value) return null;
      const num = Number(value);
      return num >= 0 ? null : 'Video count must be 0 or greater';
    },
  },
};
