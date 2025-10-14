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
export function isResponseError(obj: any): obj is ResponseError {
  return (
    obj &&
    typeof obj === 'object' &&
    typeof obj.status_code === 'number' &&
    typeof obj.message === 'string'
  );
}

/**
 * Extracts a user-friendly error message from various error formats
 */
export function getErrorMessage(error: any): string {
  // If it's a structured ResponseError from backend
  if (isResponseError(error)) {
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
    return error.error || error.message || 'An error occurred';
  }
  
  return 'An unknown error occurred';
}

