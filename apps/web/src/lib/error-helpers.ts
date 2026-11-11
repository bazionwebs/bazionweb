/**
 * Centralized API Error Parsing & Normalization Helper
 *
 * Normalizes Axios errors, Fetch Response errors, NestJS HTTP exception payloads,
 * standard Error objects, and arbitrary rejection values into a uniform format.
 */

export interface ParsedApiError {
  message: string;
  statusCode: number;
  details?: unknown;
}

/**
 * Parses any incoming error into a structured { message, statusCode, details } object.
 */
export function parseApiError(err: unknown): ParsedApiError {
  if (!err) {
    return { message: 'An unexpected error occurred.', statusCode: 500 };
  }

  if (typeof err === 'string') {
    return { message: err, statusCode: 500 };
  }

  const anyErr = err as Record<string, any>;
  const status =
    anyErr.status ||
    anyErr.statusCode ||
    anyErr.response?.status ||
    anyErr.response?.statusCode ||
    500;

  const responseData = anyErr.response?.data;
  const rawMsg =
    responseData?.error ||
    responseData?.message ||
    anyErr.message ||
    'Operation failed.';

  const message = Array.isArray(rawMsg)
    ? rawMsg.join(', ')
    : typeof rawMsg === 'object' && rawMsg !== null
      ? rawMsg.message || JSON.stringify(rawMsg)
      : String(rawMsg);

  return {
    message: message || 'Operation failed.',
    statusCode: Number(status) || 500,
    details: responseData,
  };
}

/**
 * Extracts a human-readable error message string from any caught error.
 */
export function getApiErrorMessage(err: unknown): string {
  return parseApiError(err).message;
}
