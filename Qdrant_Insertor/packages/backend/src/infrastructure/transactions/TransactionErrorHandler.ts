/**
 * Transaction error handling
 */

export class TransactionError extends Error {
  constructor(
    message: string,
    public readonly transactionId?: string,
  ) {
    super(message);
    this.name = 'TransactionError';
  }
}

export const createTransactionError = (
  message: string,
  transactionId?: string,
): TransactionError => {
  return new TransactionError(message, transactionId);
};
