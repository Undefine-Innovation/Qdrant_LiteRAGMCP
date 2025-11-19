// Legacy layer for type exports that now live in CoreError.
import type {
  ErrorSeverity,
  ErrorRecoveryStrategy,
  ErrorType,
  ErrorContext,
  ErrorOptions,
  ErrorTypeConfig,
} from './CoreError.js';

import { BaseErrorType } from './ErrorCodes.js';

export * from './CoreError.js';

// Re-export BaseErrorType for compatibility
export { BaseErrorType } from './ErrorCodes.js';

// Compatibility type that was referenced by legacy code paths.
export type ErrorAnalysis = {
  isUnifiedError: boolean;
  isAppError: boolean;
  isTransactionError: boolean;
  baseType?: string;
  severity?: ErrorSeverity;
  recoveryStrategy?: ErrorRecoveryStrategy;
  shouldRetry: boolean;
  shouldAlert: boolean;
};
