/**
 * HTML sanitization utilities to prevent XSS attacks
 */

/**
 * Escape HTML special characters to prevent XSS
 * @param {string} str - The string to escape
 * @returns {string} - The escaped string
 */
export function escapeHtml(str) {
  if (typeof str !== 'string') return str;
  
  const map = {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#039;',
    '/': '&#x2F;'
  };
  
  return str.replace(/[&<>"'/]/g, char => map[char]);
}

/**
 * Sanitize an object by escaping all string values
 * @param {object} obj - The object to sanitize
 * @returns {object} - The sanitized object
 */
export function sanitizeObject(obj) {
  if (!obj || typeof obj !== 'object') return obj;
  
  if (Array.isArray(obj)) {
    return obj.map(item => sanitizeObject(item));
  }
  
  const sanitized = {};
  for (const key in obj) {
    if (obj.hasOwnProperty(key)) {
      const value = obj[key];
      if (typeof value === 'string') {
        sanitized[key] = escapeHtml(value);
      } else if (typeof value === 'object') {
        sanitized[key] = sanitizeObject(value);
      } else {
        sanitized[key] = value;
      }
    }
  }
  
  return sanitized;
}

/**
 * Create a safe text node (prevents XSS when setting text content)
 * @param {string} text - The text content
 * @returns {Text} - A text node
 */
export function createSafeTextNode(text) {
  return document.createTextNode(escapeHtml(String(text)));
}

/**
 * Safely set innerHTML by escaping content first
 * @param {HTMLElement} element - The element to set content on
 * @param {string} html - The HTML content (will be escaped)
 */
export function setSafeHtml(element, html) {
  element.textContent = html; // This automatically escapes HTML
}
