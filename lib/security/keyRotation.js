import { rotateKeysIfNeeded, getAllAPIKeyMetadata } from './permissions.js';
import { logSecurityEvent } from './auditLogger.js';

/**
 * API Key Rotation Service
 * Automatically checks and rotates API keys based on schedule
 */

// Check rotation status every hour
const ROTATION_CHECK_INTERVAL = 60 * 60 * 1000; // 1 hour

/**
 * Start the key rotation monitoring service
 */
function startKeyRotationService() {
  console.log('Starting API key rotation monitoring service...');
  
  // Initial check
  checkAndLogRotationStatus();
  
  // Periodic checks
  setInterval(() => {
    checkAndLogRotationStatus();
  }, ROTATION_CHECK_INTERVAL);
}

/**
 * Check if any keys need rotation and log the status
 */
function checkAndLogRotationStatus() {
  const keysNeedingRotation = rotateKeysIfNeeded();
  
  if (keysNeedingRotation.length > 0) {
    logSecurityEvent('WARN', 'API_KEYS_NEED_ROTATION', null, null, 'server', {
      keys: keysNeedingRotation,
      message: 'API keys need rotation. Please rotate them manually or configure automatic rotation.'
    });
    
    console.warn(`API keys requiring rotation: ${keysNeedingRotation.join(', ')}`);
  } else {
    console.log('API key rotation check: All keys are within rotation interval.');
  }
  
  // Log current key metadata for monitoring
  const metadata = getAllAPIKeyMetadata();
  logSecurityEvent('INFO', 'API_KEY_STATUS', null, null, 'server', {
    keys: metadata
  });
}

/**
 * Get rotation status for all API keys
 * @returns {object} - Rotation status object
 */
function getRotationStatus() {
  const metadata = getAllAPIKeyMetadata();
  const keysNeedingRotation = metadata.filter(key => key.needsRotation);
  
  return {
    totalKeys: metadata.length,
    keysNeedingRotation: keysNeedingRotation.length,
    keys: metadata,
    needsRotation: keysNeedingRotation.length > 0
  };
}

/**
 * Manual rotation trigger (for admin use)
 * @param {string} keyName - Name of the key to rotate
 * @param {string} newKey - New API key value
 * @returns {boolean} - Success status
 */
function manualRotateKey(keyName, newKey) {
  const { rotateAPIKey } = require('./permissions.js');
  
  const success = rotateAPIKey(keyName, newKey);
  
  if (success) {
    logSecurityEvent('INFO', 'API_KEY_MANUAL_ROTATION', keyName, null, 'server', {
      keyName,
      timestamp: Date.now()
    });
  }
  
  return success;
}

export {
  startKeyRotationService,
  checkAndLogRotationStatus,
  getRotationStatus,
  manualRotateKey
};
