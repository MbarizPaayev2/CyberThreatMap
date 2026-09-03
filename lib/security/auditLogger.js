import fs from 'fs';
import path from 'path';

/**
 * Security audit logger for API usage and security events
 * Logs to file with rotation and secure storage
 */

const LOG_DIR = process.env.LOG_DIR || './logs';
const LOG_FILE = path.join(LOG_DIR, 'security-audit.log');
const MAX_LOG_SIZE = 10 * 1024 * 1024; // 10MB
const MAX_LOG_FILES = 5;

// Ensure log directory exists
if (!fs.existsSync(LOG_DIR)) {
  try {
    fs.mkdirSync(LOG_DIR, { recursive: true });
  } catch (err) {
    console.error('Failed to create log directory:', err);
  }
}

/**
 * Log security event
 * @param {string} level - Log level (INFO, WARN, ERROR, CRITICAL)
 * @param {string} event - Event type
 * @param {object} details - Event details
 */
function logSecurityEvent(level, event, details = {}) {
  const timestamp = new Date().toISOString();
  const logEntry = {
    timestamp,
    level,
    event,
    ...details
  };

  const logLine = JSON.stringify(logEntry) + '\n';

  try {
    // Rotate logs if file is too large
    rotateLogsIfNeeded();

    // Write to log file
    fs.appendFileSync(LOG_FILE, logLine, 'utf8');

    // Also log to console for development
    if (process.env.NODE_ENV !== 'production') {
      console.log(`[SECURITY ${level}] ${event}:`, details);
    }
  } catch (err) {
    console.error('Failed to write security log:', err);
  }
}

/**
 * Rotate log files if they exceed max size
 */
function rotateLogsIfNeeded() {
  try {
    if (!fs.existsSync(LOG_FILE)) return;

    const stats = fs.statSync(LOG_FILE);
    if (stats.size < MAX_LOG_SIZE) return;

    // Rotate existing logs
    for (let i = MAX_LOG_FILES - 1; i >= 1; i--) {
      const oldFile = `${LOG_FILE}.${i}`;
      const newFile = `${LOG_FILE}.${i + 1}`;
      if (fs.existsSync(oldFile)) {
        fs.renameSync(oldFile, newFile);
      }
    }

    // Move current log to .1
    fs.renameSync(LOG_FILE, `${LOG_FILE}.1`);

    // Remove oldest log if it exists
    const oldestFile = `${LOG_FILE}.${MAX_LOG_FILES + 1}`;
    if (fs.existsSync(oldestFile)) {
      fs.unlinkSync(oldestFile);
    }
  } catch (err) {
    console.error('Failed to rotate logs:', err);
  }
}

/**
 * Log API usage
 * @param {string} api - API name (AbuseIPDB, OTX, VirusTotal)
 * @param {string} endpoint - API endpoint
 * @param {string} ip - Client IP
 * @param {object} meta - Additional metadata
 */
function logAPIUsage(api, endpoint, ip, meta = {}) {
  logSecurityEvent('INFO', 'API_USAGE', {
    api,
    endpoint,
    client_ip: ip,
    ...meta
  });
}

/**
 * Log security violation
 * @param {string} violation - Type of violation
 * @param {string} ip - Client IP
 * @param {object} details - Violation details
 */
function logSecurityViolation(violation, ip, details = {}) {
  logSecurityEvent('WARN', 'SECURITY_VIOLATION', {
    violation,
    client_ip: ip,
    ...details
  });
}

/**
 * Log rate limit exceeded
 * @param {string} api - API name
 * @param {string} ip - Client IP
 * @param {object} details - Rate limit details
 */
function logRateLimitExceeded(api, ip, details = {}) {
  logSecurityEvent('WARN', 'RATE_LIMIT_EXCEEDED', {
    api,
    client_ip: ip,
    ...details
  });
}

/**
 * Log unauthorized access attempt
 * @param {string} resource - Resource being accessed
 * @param {string} ip - Client IP
 * @param {object} details - Access attempt details
 */
function logUnauthorizedAccess(resource, ip, details = {}) {
  logSecurityEvent('ERROR', 'UNAUTHORIZED_ACCESS', {
    resource,
    client_ip: ip,
    ...details
  });
}

/**
 * Log API key rotation
 * @param {string} api - API name
 * @param {object} details - Rotation details
 */
function logAPIKeyRotation(api, details = {}) {
  logSecurityEvent('INFO', 'API_KEY_ROTATION', {
    api,
    ...details
  });
}

/**
 * Get recent security logs
 * @param {number} limit - Number of recent logs to retrieve
 * @returns {Array} - Array of log entries
 */
function getRecentLogs(limit = 100) {
  try {
    if (!fs.existsSync(LOG_FILE)) return [];

    const content = fs.readFileSync(LOG_FILE, 'utf8');
    const lines = content.split('\n').filter(line => line.trim());
    
    return lines
      .slice(-limit)
      .map(line => {
        try {
          return JSON.parse(line);
        } catch {
          return null;
        }
      })
      .filter(Boolean);
  } catch (err) {
    console.error('Failed to read security logs:', err);
    return [];
  }
}

export {
  logSecurityEvent,
  logAPIUsage,
  logSecurityViolation,
  logRateLimitExceeded,
  logUnauthorizedAccess,
  logAPIKeyRotation,
  getRecentLogs
};
