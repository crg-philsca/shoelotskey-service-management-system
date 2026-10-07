/**
 * Shoelotskey SMS - Client-Side Security & Input Sanitization
 * Protects against XSS, script injection, XML/XXE payloads, and SQLi syntax in user input.
 */

// Script & DOM Event Patterns
const SCRIPT_PATTERN = /<\s*script[^>]*>|<\s*\/\s*script\s*>|javascript\s*:|vbscript\s*:|data\s*:\s*text\/(?:html|javascript)|on\w+\s*=|<\s*(?:iframe|object|embed|svg|meta|link)\b/i;

// XML & XXE Patterns
const XML_PATTERN = /<\?xml\b|<!DOCTYPE\b|<!ENTITY\b|SYSTEM\s+["']|PUBLIC\s+["']|xmlns/i;

// SQL Injection Patterns
const SQL_PATTERN = /['"];\s*(--|\/\*)|--\s*|\/\*[\s\S]*?\*\/|\bUNION(?:\s+ALL)?\s+SELECT\b|\bOR\s+1\s*=\s*1\b|\bAND\s+1\s*=\s*1\b/i;

/**
 * Sanitizes an authorization code input on the client.
 * Removes null bytes, angle brackets, quotes, and limits length.
 */
export function sanitizeClientAuthCode(input: string): string {
    if (!input) return '';
    // Strip null bytes and control characters
    let clean = input.replace(/[\x00-\x1F\x7F]/g, '');
    // Strip HTML/script tag characters
    clean = clean.replace(/[<>'"`;\\]/g, '');
    // Limit to 64 chars
    return clean.slice(0, 64);
}

/**
 * Sanitizes username input on the client.
 */
export function sanitizeClientUsername(input: string): string {
    if (!input) return '';
    let clean = input.replace(/[\x00-\x1F\x7F]/g, '');
    clean = clean.replace(/[<>'"`;\\=()]/g, '');
    return clean.slice(0, 50);
}

/**
 * Checks whether an input contains potentially dangerous cyberattack patterns.
 */
export function hasMaliciousPattern(input: string): boolean {
    if (!input) return false;
    return SCRIPT_PATTERN.test(input) || XML_PATTERN.test(input) || SQL_PATTERN.test(input) || input.includes('\x00');
}
