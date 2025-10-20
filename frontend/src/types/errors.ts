/**
 * Structured error response from the backend API
 * Matches the ResponseError type from backend/pkg/errors
 */
export interface ResponseError {
  status_code: number;
  message: string;
  error?: string;
}

/**
 * Type guard to check if an object is a ResponseError
 */
export function isResponseError(obj: unknown): obj is ResponseError {
  return (
    obj !== null &&
    typeof obj === 'object' &&
    'status_code' in obj &&
    'message' in obj &&
    typeof (obj as Record<string, unknown>).status_code === 'number' &&
    typeof (obj as Record<string, unknown>).message === 'string'
  );
}

/**
 * Extracts a user-friendly error message from various error formats
 */
export function getErrorMessage(error: unknown): string {
  // If it's a structured ResponseError from backend
  if (isResponseError(error)) {
    // Prioritize the 'error' field if it contains more specific information
    // than the generic 'message' field
    if (error.error && error.error !== error.message) {
      return error.error;
    }
    return error.message || error.error || 'An error occurred';
  }
  
  // If it's a string
  if (typeof error === 'string') {
    return error;
  }
  
  // If it's an Error object
  if (error instanceof Error) {
    return error.message;
  }
  
  // If it has an error or message property
  if (error && typeof error === 'object') {
    const errorObj = error as Record<string, unknown>;
    return (errorObj.error as string) || (errorObj.message as string) || 'An error occurred';
  }
  
  return 'An unknown error occurred';
}

