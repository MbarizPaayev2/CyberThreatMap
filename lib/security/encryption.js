import crypto from 'crypto';

/**
 * Secure encryption utility for sensitive data
 * Uses AES-256-GCM for authenticated encryption
 */

// In production, this should come from a secure key management system
const ENCRYPTION_KEY = process.env.ENCRYPTION_KEY || crypto.randomBytes(32).toString('hex');
const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 16;
const SALT_LENGTH = 64;
const TAG_LENGTH = 16;
const TAG_POSITION = SALT_LENGTH + IV_LENGTH;
const ENCRYPTED_POSITION = TAG_POSITION + TAG_LENGTH;

/**
 * Encrypt sensitive data (API keys, secrets, etc.)
 * @param {string} text - Plain text to encrypt
 * @returns {string} - Encrypted string in format: salt+iv+tag+ciphertext
 */
function encrypt(text) {
  if (!text) return '';
  
  const salt = crypto.randomBytes(SALT_LENGTH);
  const key = crypto.pbkdf2Sync(ENCRYPTION_KEY, salt, 100000, 32, 'sha512');
  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv);
  
  let encrypted = cipher.update(text, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  
  const tag = cipher.getAuthTag();
  
  return salt.toString('hex') + iv.toString('hex') + tag.toString('hex') + encrypted;
}

/**
 * Decrypt sensitive data
 * @param {string} encryptedData - Encrypted string
 * @returns {string} - Decrypted plain text
 */
function decrypt(encryptedData) {
  if (!encryptedData) return '';
  
  const salt = Buffer.from(encryptedData.slice(0, SALT_LENGTH * 2), 'hex');
  const iv = Buffer.from(encryptedData.slice(SALT_LENGTH * 2, TAG_POSITION * 2), 'hex');
  const tag = Buffer.from(encryptedData.slice(TAG_POSITION * 2, ENCRYPTED_POSITION * 2), 'hex');
  const encrypted = encryptedData.slice(ENCRYPTED_POSITION * 2);
  
  const key = crypto.pbkdf2Sync(ENCRYPTION_KEY, salt, 100000, 32, 'sha512');
  const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
  
  decipher.setAuthTag(tag);
  
  let decrypted = decipher.update(encrypted, 'hex', 'utf8');
  decrypted += decipher.final('utf8');
  
  return decrypted;
}

/**
 * Hash sensitive data for comparison (one-way)
 * @param {string} text - Plain text to hash
 * @returns {string} - Hashed string
 */
function hash(text) {
  if (!text) return '';
  return crypto.createHash('sha256').update(text).digest('hex');
}

/**
 * Generate a secure random token
 * @param {number} length - Length of token in bytes
 * @returns {string} - Hex encoded random token
 */
function generateSecureToken(length = 32) {
  return crypto.randomBytes(length).toString('hex');
}

/**
 * Validate API key format (basic validation)
 * @param {string} apiKey - API key to validate
 * @returns {boolean} - True if valid format
 */
function validateApiKeyFormat(apiKey) {
  if (!apiKey || typeof apiKey !== 'string') return false;
  // Basic validation: should be at least 32 characters
  if (apiKey.length < 32) return false;
  // Should only contain hex characters or common API key characters
  const validChars = /^[a-zA-Z0-9_\-\.]+$/;
  return validChars.test(apiKey);
}

/**
 * Mask API key for logging (show only first 8 and last 4 characters)
 * @param {string} apiKey - API key to mask
 * @returns {string} - Masked API key
 */
function maskApiKey(apiKey) {
  if (!apiKey || apiKey.length < 12) return '***';
  const prefix = apiKey.substring(0, 8);
  const suffix = apiKey.substring(apiKey.length - 4);
  const maskedLength = apiKey.length - 12;
  return `${prefix}${'*'.repeat(maskedLength)}${suffix}`;
}

export {
  encrypt,
  decrypt,
  hash,
  generateSecureToken,
  validateApiKeyFormat,
  maskApiKey
};
