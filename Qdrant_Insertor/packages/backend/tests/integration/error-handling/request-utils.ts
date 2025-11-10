export type CollectionRequest = {
  name?: unknown;
  description?: string;
  [key: string]: unknown;
};

export type ValidationResult = {
  isValid: boolean;
  errors?: string[];
};

export function validateCollectionRequest(request: unknown): ValidationResult {
  const errors: string[] = [];

  if (!request || typeof request !== 'object') {
    errors.push('Invalid request format');
  }

  const typedRequest = request as CollectionRequest;

  if (typedRequest.name === null || typedRequest.name === undefined) {
    errors.push('Name is required');
  }

  if (typeof typedRequest.name === 'number') {
    errors.push('Name must be a string');
  }

  if (
    typeof typedRequest.description === 'string' &&
    typedRequest.description.length > 100000
  ) {
    errors.push('Request body too large');
  }

  return {
    isValid: errors.length === 0,
    errors: errors.length > 0 ? errors : undefined,
  };
}

export function sanitizeInput<TInput extends Record<string, unknown>>(
  input: TInput,
): TInput {
  if (typeof input !== 'object' || !input) {
    return input;
  }

  const sanitized = { ...input } as Record<string, unknown>;

  if (typeof sanitized.name === 'string') {
    sanitized.name = sanitized.name
      .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
      .replace(/['"\\;]|(?:--|\/\*|\*\/)/g, '')
      .replace(/\.\./g, '');
  }

  if (typeof sanitized.description === 'string') {
    sanitized.description = sanitized.description.replace(
      /['"\\;]|(?:--|\/\*|\*\/)/g,
      '',
    );
  }

  return sanitized as TInput;
}
