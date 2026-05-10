import { NextFunction, Request, Response } from 'express';
import logger from '../../logging/AppLogger';
import { ValidationError } from 'yup';

/**
 * Sanitizes error messages to prevent exposing technical details to users.
 */
function sanitizeErrorMessage(errorMessage: string): string {
  const normalizedErrorMessage = errorMessage.toLowerCase();

  // Check for technical details (database, technical stack, etc.)
  const technologyExposurePattern = /\b(mongodb|mongoose|redis|node\.js|express|internal)\b/i;
  if (technologyExposurePattern.test(errorMessage)) {
    return 'Unable to process request due to a service error. Please try again later.';
  }

  // Network/Connection errors
  if (normalizedErrorMessage.includes('network error') || normalizedErrorMessage.includes('econnrefused')) {
    return 'Unable to connect to the service. Please try again later.';
  }

  // General fallback for stack traces or unexpected technical strings
  if (errorMessage.includes('\n    at ') || errorMessage.includes('TypeError')) {
    return 'An unexpected error occurred. Please contact support if the issue persists.';
  }

  return errorMessage;
}

/**
 * Global error handling middleware.
 * Formats errors into a consistent, user-friendly structure.
 */
function handleErrors(err: any, req: Request, res: Response, next: NextFunction): void {
  // Log the full error stack for debugging
  logger.error(`[ERROR_HANDLER] ${err.message}`, { stack: err.stack });

  // Handle Yup Validation Errors
  if (err instanceof ValidationError) {
    res.status(400).json({
      status: 'error',
      message: 'Validation failed',
      errors: err.errors, // e.g., ["amount is required", "currency must be exactly 3 characters"]
    });
    return;
  }

  // Handle standard errors
  const statusCode = err.status || 500;
  const message = statusCode === 500 ? sanitizeErrorMessage(err.message) : err.message;

  res.status(statusCode).json({
    status: 'error',
    message: message,
    timestamp: new Date().toISOString(),
  });
}

export default handleErrors;
