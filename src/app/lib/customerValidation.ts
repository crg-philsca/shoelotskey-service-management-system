/**
 * Validation rules and utilities for Customer Name across Shoelotskey SMS.
 * Enforces realistic length limits allowing First Name, Second Name, Middle Name/Initial,
 * Last Name, and Suffix while preventing infinite characters, spam, and invalid symbols.
 */

export const CUSTOMER_NAME_MAX_LENGTH = 60;
export const CUSTOMER_NAME_MIN_LENGTH = 2;

// Allowed: letters (including unicode Latin/accented letters like ñ, Ñ, é), spaces, dots, hyphens, and apostrophes
export const CUSTOMER_NAME_REGEX = /^[a-zA-ZÀ-ÿ\s.\-']+$/;

export interface CustomerNameValidationResult {
  isValid: boolean;
  error?: string;
  sanitized: string;
}

/**
 * Validates and sanitizes a customer name.
 * - Trims and collapses multiple spaces
 * - Enforces minimum 2 and maximum 60 characters
 * - Allows letters, spaces, hyphens, apostrophes, and periods
 * - Rejects numbers and special symbols
 * - Ensures at least 2 alphabetic characters
 */
export function validateCustomerName(name: string | null | undefined): CustomerNameValidationResult {
  if (!name || typeof name !== 'string') {
    return {
      isValid: false,
      error: 'Customer name is required.',
      sanitized: ''
    };
  }

  // Normalize excessive whitespace to single space and trim
  const sanitized = name.trim().replace(/\s+/g, ' ');

  if (!sanitized) {
    return {
      isValid: false,
      error: 'Customer name is required.',
      sanitized: ''
    };
  }

  if (sanitized.length < CUSTOMER_NAME_MIN_LENGTH) {
    return {
      isValid: false,
      error: `Customer name must be at least ${CUSTOMER_NAME_MIN_LENGTH} characters.`,
      sanitized
    };
  }

  if (sanitized.length > CUSTOMER_NAME_MAX_LENGTH) {
    return {
      isValid: false,
      error: `Customer name cannot exceed ${CUSTOMER_NAME_MAX_LENGTH} characters (currently ${sanitized.length}).`,
      sanitized: sanitized.slice(0, CUSTOMER_NAME_MAX_LENGTH)
    };
  }

  if (!CUSTOMER_NAME_REGEX.test(sanitized)) {
    return {
      isValid: false,
      error: 'Customer name can only contain letters, spaces, hyphens (-), apostrophes (\'), and periods (.). Numbers and special symbols are not allowed.',
      sanitized
    };
  }

  // Must have at least 2 alphabetic letters (prevents punctuation-only inputs like ".-.")
  const letterCount = (sanitized.match(/[a-zA-ZÀ-ÿ]/g) || []).length;
  if (letterCount < 2) {
    return {
      isValid: false,
      error: 'Customer name must contain at least 2 letters.',
      sanitized
    };
  }

  return {
    isValid: true,
    sanitized
  };
}
