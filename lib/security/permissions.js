import crypto from 'crypto';
import { encrypt, decrypt, generateSecureToken } from './encryption.js';
import { logAPIKeyRotation, logSecurityViolation } from './auditLogger.js';

/**
 * Server-side permission management system
 * Stores and manages API keys securely with rotation support
 */

// In-memory storage for API keys (in production, use a secure database)
const apiKeys = new Map();

// Permission levels
const PERMISSION_LEVELS = {
  ADMIN: 'admin',
  READ_ONLY: 'read_only',
  WRITE: 'write',
  API_ACCESS: 'api_access'
};

// API key metadata
const keyMetadata = new Map();

/**
 * Initialize API keys from environment variables (one-time setup)
 * This should be called during server startup
 */
function initializeAPIKeys() {
  const keys = [
    { name: 'ABUSEIPDB', envVar: 'ABUSEIPDB_API_KEY' },
    { name: 'OTX', envVar: 'OTX_API_KEY' },
    { name: 'VIRUSTOTAL', envVar: 'VIRUSTOTAL_API_KEY' },
    { name: 'ABUSE_CH', envVar: 'ABUSE_CH_AUTH_KEY' }
  ];

  keys.forEach(({ name, envVar }) => {
    const keyValue = process.env[envVar];
    if (keyValue) {
      const keyId = generateSecureToken(16);
      const encryptedKey = encrypt(keyValue);
      
      apiKeys.set(name, {
        id: keyId,
        encrypted: encryptedKey,
        lastRotated: Date.now(),
        rotationInterval: 30 * 24 * 60 * 60 * 1000 // 30 days
      });
      
      keyMetadata.set(name, {
        name,
        envVar,
        permission: PERMISSION_LEVELS.API_ACCESS,
        created: Date.now(),
        lastUsed: null
      });
      
      console.log(`Initialized API key for ${name} (ID: ${keyId})`);
    }
  });
}

/**
 * Get decrypted API key by name
 * @param {string} name - API key name
 * @returns {string|null} - Decrypted API key or null
 */
function getAPIKey(name) {
  const keyData = apiKeys.get(name);
  if (!keyData) {
    logSecurityViolation('API_KEY_NOT_FOUND', 'server', { keyName: name });
    return null;
  }

  try {
    const decryptedKey = decrypt(keyData.encrypted);
    
    // Update last used timestamp
    const metadata = keyMetadata.get(name);
    if (metadata) {
      metadata.lastUsed = Date.now();
    }
    
    return decryptedKey;
  } catch (error) {
    logSecurityViolation('API_KEY_DECRYPTION_FAILED', 'server', { keyName: name });
    return null;
  }
}

/**
 * Rotate API key (generate new encrypted key)
 * @param {string} name - API key name
 * @param {string} newKey - New API key value
 * @returns {boolean} - Success status
 */
function rotateAPIKey(name, newKey) {
  const keyData = apiKeys.get(name);
  if (!keyData) {
    logSecurityViolation('API_KEY_ROTATION_FAILED', 'server', { 
      keyName: name, 
      reason: 'Key not found' 
    });
    return false;
  }

  try {
    const newKeyId = generateSecureToken(16);
    const encryptedKey = encrypt(newKey);
    
    // Store old key for rollback (in production, store in database)
    const oldKeyData = { ...keyData };
    
    apiKeys.set(name, {
      id: newKeyId,
      encrypted: encryptedKey,
      lastRotated: Date.now(),
      rotationInterval: keyData.rotationInterval
    });
    
    logAPIKeyRotation(name, {
      oldKeyId: oldKeyData.id,
      newKeyId: newKeyId,
      timestamp: Date.now()
    });
    
    return true;
  } catch (error) {
    logSecurityViolation('API_KEY_ROTATION_FAILED', 'server', { 
      keyName: name, 
      error: error.message 
    });
    return false;
  }
}

/**
 * Check if API key needs rotation
 * @param {string} name - API key name
 * @returns {boolean} - True if rotation needed
 */
function needsRotation(name) {
  const keyData = apiKeys.get(name);
  if (!keyData) return false;
  
  const timeSinceRotation = Date.now() - keyData.lastRotated;
  return timeSinceRotation >= keyData.rotationInterval;
}

/**
 * Rotate all API keys that need rotation
 */
function rotateKeysIfNeeded() {
  const keysToRotate = [];
  
  apiKeys.forEach((keyData, name) => {
    if (needsRotation(name)) {
      keysToRotate.push(name);
    }
  });
  
  if (keysToRotate.length > 0) {
    console.warn(`API keys need rotation: ${keysToRotate.join(', ')}`);
    // In production, this would trigger an alert or automated rotation
  }
  
  return keysToRotate;
}

/**
 * Check user permission for a resource
 * @param {string} permission - Permission level
 * @param {string} resource - Resource being accessed
 * @returns {boolean} - True if permission granted
 */
function checkPermission(permission, resource) {
  // In production, this would check against user roles and permissions
  // For now, we implement basic permission checks
  
  const permissionHierarchy = {
    [PERMISSION_LEVELS.ADMIN]: 4,
    [PERMISSION_LEVELS.WRITE]: 3,
    [PERMISSION_LEVELS.API_ACCESS]: 2,
    [PERMISSION_LEVELS.READ_ONLY]: 1
  };
  
  const userPermission = PERMISSION_LEVELS.API_ACCESS; // Default for API access
  const requiredPermission = permissionHierarchy[permission] || 0;
  const userLevel = permissionHierarchy[userPermission] || 0;
  
  return userLevel >= requiredPermission;
}

/**
 * Validate API request with permission check
 * @param {string} apiKeyName - API key name
 * @param {string} requiredPermission - Required permission level
 * @param {string} resource - Resource being accessed
 * @returns {object} - Validation result
 */
function validateAPIRequest(apiKeyName, requiredPermission, resource) {
  const apiKey = getAPIKey(apiKeyName);
  
  if (!apiKey) {
    return {
      valid: false,
      reason: 'API_KEY_NOT_FOUND'
    };
  }
  
  if (!checkPermission(requiredPermission, resource)) {
    logSecurityViolation('PERMISSION_DENIED', 'server', {
      apiKeyName,
      requiredPermission,
      resource
    });
    
    return {
      valid: false,
      reason: 'PERMISSION_DENIED'
    };
  }
  
  return {
    valid: true,
    apiKey
  };
}

/**
 * Get API key metadata (for monitoring)
 * @param {string} name - API key name
 * @returns {object|null} - Key metadata (without actual key)
 */
function getAPIKeyMetadata(name) {
  const metadata = keyMetadata.get(name);
  const keyData = apiKeys.get(name);
  
  if (!metadata || !keyData) return null;
  
  return {
    name: metadata.name,
    id: keyData.id,
    lastRotated: keyData.lastRotated,
    created: metadata.created,
    lastUsed: metadata.lastUsed,
    needsRotation: needsRotation(name)
  };
}

/**
 * Get all API key metadata (for monitoring)
 * @returns {Array} - Array of metadata objects
 */
function getAllAPIKeyMetadata() {
  const metadata = [];
  
  keyMetadata.forEach((data, name) => {
    const keyData = apiKeys.get(name);
    if (keyData) {
      metadata.push({
        name: data.name,
        id: keyData.id,
        lastRotated: keyData.lastRotated,
        created: data.created,
        lastUsed: data.lastUsed,
        needsRotation: needsRotation(name)
      });
    }
  });
  
  return metadata;
}

export {
  initializeAPIKeys,
  getAPIKey,
  rotateAPIKey,
  needsRotation,
  rotateKeysIfNeeded,
  checkPermission,
  validateAPIRequest,
  getAPIKeyMetadata,
  getAllAPIKeyMetadata,
  PERMISSION_LEVELS
};
