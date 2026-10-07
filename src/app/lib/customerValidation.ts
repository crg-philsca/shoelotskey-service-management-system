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

/**
 * Checks for script injection (XSS) patterns including partial tags, inline events, and protocols.
 */
export const SCRIPT_INJECTION_REGEX = /<\s*\/?\s*script\b|javascript\s*:|vbscript\s*:|data\s*:\s*(text\/html|application\/)|<\s*\/?\s*(iframe|object|embed|svg|applet|meta|link|form|body|input)\b|on\w+\s*=/i;

/**
 * Checks for typical SQL injection exploitation patterns.
 */
export const SQL_INJECTION_REGEX = /(\b(UNION(\s+ALL)?\s+SELECT|SELECT\s+.*\s+FROM|INSERT\s+INTO|DELETE\s+FROM|DROP\s+TABLE|ALTER\s+TABLE|UPDATE\s+.*\s+SET|EXEC(\s+XP_)?)\b|--|\/\*|\*\/|;\s*(DROP|DELETE|UPDATE|INSERT|SELECT)|\bOR\s+['"]?1['"]?\s*=\s*['"]?1|\bAND\s+['"]?1['"]?\s*=\s*['"]?1)/i;

/**
 * Checks for operating system and command injection patterns.
 */
export const CMD_INJECTION_REGEX = /(;\s*(rm|cat|ls|sh|bash|curl|wget|nc|netcat|python|powershell)\b|\|\s*(sh|bash)|&&\s*(rm|cat|curl|wget))/i;

/**
 * Strips script tags, executable code, and cyber attack characters in real-time
 * so users literally cannot type or paste script tags or malicious payload into input fields.
 */
export function stripCyberAttackInput(val: string | null | undefined): string {
  if (!val || typeof val !== 'string') return '';
  return val
    // Remove complete script tags and inner contents
    .replace(/<\s*script[^>]*>.*?<\s*\/\s*script\s*>/gis, '')
    // Remove opening or closing script tags
    .replace(/<\s*\/?\s*script\b[^>]*>/gi, '')
    // Remove standalone or unclosed <script opening
    .replace(/<\s*script\b/gi, '')
    // Remove other dangerous executable tags
    .replace(/<\s*\/?\s*(iframe|object|embed|applet|svg|meta|link)\b[^>]*>/gi, '')
    // Remove inline event handlers (e.g. onload=, onerror=)
    .replace(/on\w+\s*=\s*(["'][^"']*["']|[^\s>]+)/gi, '')
    // Remove javascript: and vbscript: protocols
    .replace(/javascript\s*:/gi, '')
    .replace(/vbscript\s*:/gi, '')
    // Strip standalone angle brackets if part of an attempted tag
    .replace(/<\s*(\/)?\s*[a-zA-Z]/g, '')
    .replace(/</g, '')
    .replace(/>/g, '');
}

/**
 * Returns true if the string matches any cyber attack or injection vector.
 */
export function isCyberAttack(val: string | null | undefined): boolean {
  if (!val || typeof val !== 'string') return false;
  const raw = val.trim();
  return SCRIPT_INJECTION_REGEX.test(raw) || SQL_INJECTION_REGEX.test(raw) || CMD_INJECTION_REGEX.test(raw);
}

/**
 * Sanitizes generic user text input by stripping script tags, neutralizing HTML delimiters,
 * and normalizing spacing to prevent XSS and injection vulnerabilities.
 */
export function sanitizeText(val: string | null | undefined): string {
  if (!val || typeof val !== 'string') return '';
  return stripCyberAttackInput(val).trim();
}

/**
 * Validates any generic string field against script or SQL injection attempts.
 * Returns isValid: false with a user-friendly error message if malicious patterns are detected.
 */
export function validateSecurityInput(value: string | null | undefined, fieldName: string = 'Field'): { isValid: boolean; error?: string; sanitized: string } {
  if (!value || typeof value !== 'string') {
    return { isValid: true, sanitized: '' };
  }

  const raw = value.trim();
  if (SCRIPT_INJECTION_REGEX.test(raw)) {
    return {
      isValid: false,
      error: `Security Alert: Script tags and executable code are prohibited in ${fieldName}.`,
      sanitized: stripCyberAttackInput(raw)
    };
  }

  if (SQL_INJECTION_REGEX.test(raw)) {
    return {
      isValid: false,
      error: `Security Alert: Database manipulation and SQL injection characters are prohibited in ${fieldName}.`,
      sanitized: stripCyberAttackInput(raw)
    };
  }

  if (CMD_INJECTION_REGEX.test(raw)) {
    return {
      isValid: false,
      error: `Security Alert: System command characters are prohibited in ${fieldName}.`,
      sanitized: stripCyberAttackInput(raw)
    };
  }

  return {
    isValid: true,
    sanitized: stripCyberAttackInput(raw)
  };
}

