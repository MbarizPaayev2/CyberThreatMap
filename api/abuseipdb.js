import https from 'https';
import { maskApiKey, logAPIUsage, logRateLimitExceeded, logSecurityViolation } from '../lib/security/auditLogger.js';
import { initializeAPIKeys, getAPIKey, validateAPIRequest, PERMISSION_LEVELS } from '../lib/security/permissions.js';
import { startKeyRotationService } from '../lib/security/keyRotation.js';

// Initialize API keys from environment variables (one-time setup)
try {
  initializeAPIKeys();
  startKeyRotationService();
} catch (e) {
  console.warn('Security system initialization warning:', e.message);
}

const ABUSEIPDB_API_KEY = getAPIKey('ABUSEIPDB') || process.env.ABUSEIPDB_API_KEY || '15ee4525bb80b3e86917eb91eeb8cc734ccf0b330ff827af688b63ecd8ed0f6bf7a041b3f81debac';

// In-memory cache to respect API rate limits (6 hours TTL = max 4 requests/day)
let blacklistCache = null;
let lastBlacklistFetch = 0;
const CACHE_TTL_MS = 6 * 60 * 60 * 1000; // 6 hours cache

// Cache for individual IP checks (1,000/day limit on free tier)
const ipCheckCache = new Map();
const IP_CHECK_CACHE_TTL = 2 * 60 * 60 * 1000; // 2 hours

// Daily API usage tracking (strict limits to stay safely below AbuseIPDB quotas)
const DAILY_LIMITS = {
  blacklist: 4,    // AbuseIPDB free tier limit: 5 per day
  check: 900       // AbuseIPDB free tier limit: 1,000 per day
};

const dailyUsage = {
  blacklist: 0,
  check: 0,
  lastReset: Date.now()
};

// Curated high-confidence real fallback records
const FALLBACK_BLACKLIST = [
  { ipAddress: '8.216.5.214', countryCode: 'JP', abuseConfidenceScore: 100, lastReportedAt: new Date().toISOString() },
  { ipAddress: '66.132.195.107', countryCode: 'US', abuseConfidenceScore: 100, lastReportedAt: new Date().toISOString() },
  { ipAddress: '185.216.145.170', countryCode: 'GB', abuseConfidenceScore: 100, lastReportedAt: new Date().toISOString() },
  { ipAddress: '172.212.228.106', countryCode: 'US', abuseConfidenceScore: 100, lastReportedAt: new Date().toISOString() },
  { ipAddress: '194.26.29.112', countryCode: 'RU', abuseConfidenceScore: 98, lastReportedAt: new Date().toISOString() },
  { ipAddress: '103.149.130.18', countryCode: 'CN', abuseConfidenceScore: 100, lastReportedAt: new Date().toISOString() },
  { ipAddress: '45.143.203.22', countryCode: 'DE', abuseConfidenceScore: 95, lastReportedAt: new Date().toISOString() },
  { ipAddress: '89.208.103.241', countryCode: 'RO', abuseConfidenceScore: 100, lastReportedAt: new Date().toISOString() },
  { ipAddress: '185.196.11.75', countryCode: 'FR', abuseConfidenceScore: 92, lastReportedAt: new Date().toISOString() },
  { ipAddress: '179.43.146.90', countryCode: 'CH', abuseConfidenceScore: 99, lastReportedAt: new Date().toISOString() },
  { ipAddress: '103.203.57.18', countryCode: 'AZ', abuseConfidenceScore: 88, lastReportedAt: new Date().toISOString() },
  { ipAddress: '177.136.252.12', countryCode: 'BR', abuseConfidenceScore: 96, lastReportedAt: new Date().toISOString() }
];

// Reset daily counters at midnight UTC
function checkAndResetDailyCounters() {
  const now = Date.now();
  const oneDay = 24 * 60 * 60 * 1000;
  
  if (now - dailyUsage.lastReset >= oneDay) {
    dailyUsage.blacklist = 0;
    dailyUsage.check = 0;
    dailyUsage.lastReset = now;
    console.log('Daily AbuseIPDB API counters reset');
  }
}

function canMakeDailyCall(endpoint) {
  checkAndResetDailyCounters();
  return dailyUsage[endpoint] < DAILY_LIMITS[endpoint];
}

function recordDailyCall(endpoint) {
  checkAndResetDailyCounters();
  dailyUsage[endpoint]++;
}

// Input validation helpers
function isValidIP(ip) {
  const ipRegex = /^(?:(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.){3}(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)$|^(?:[0-9a-fA-F]{1,4}:){7}[0-9a-fA-F]{1,4}$/;
  return ipRegex.test(ip);
}

function isValidAction(action) {
  return ['blacklist', 'check'].includes(action);
}

function isValidLimit(limit) {
  const num = parseInt(limit, 10);
  return !isNaN(num) && num >= 10 && num <= 100;
}

function isValidConfidence(conf) {
  const num = parseInt(conf, 10);
  return !isNaN(num) && num >= 50 && num <= 100;
}

// Simple rate limiting in-memory per IP
const rateLimitMap = new Map();
const RATE_LIMIT_WINDOW = 60000; // 1 minute
const RATE_LIMIT_MAX_REQUESTS = 60;

function checkRateLimit(identifier) {
  const now = Date.now();
  const userRequests = rateLimitMap.get(identifier) || [];
  const validRequests = userRequests.filter(timestamp => now - timestamp < RATE_LIMIT_WINDOW);
  
  if (validRequests.length >= RATE_LIMIT_MAX_REQUESTS) {
    return false;
  }
  
  validRequests.push(now);
  rateLimitMap.set(identifier, validRequests);
  return true;
}

export default async function handler(req, res) {
  // CORS setup
  const origin = req.headers.origin || '*';
  res.setHeader('Access-Control-Allow-Origin', origin);
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Key');

  // Security headers
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('X-XSS-Protection', '1; mode=block');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  const clientIP = req.headers['x-forwarded-for'] || req.headers['x-real-ip'] || 'unknown';
  if (!checkRateLimit(clientIP)) {
    return res.status(429).json({ error: 'Rate limit exceeded. Please try again later.' });
  }

  const { action = 'blacklist', limit = 50, confidenceMinimum = 80, ip } = req.query || {};

  try {
    if (!isValidAction(action)) {
      return res.status(400).json({ error: 'Invalid action parameter' });
    }

    if (action === 'blacklist') {
      const now = Date.now();

      // 1. Check in-memory cache FIRST (saves API calls completely)
      if (blacklistCache && (now - lastBlacklistFetch < CACHE_TTL_MS)) {
        return res.status(200).json({ 
          source: 'cache', 
          cachedAt: lastBlacklistFetch,
          usage: `${dailyUsage.blacklist}/${DAILY_LIMITS.blacklist}`,
          ...blacklistCache 
        });
      }

      // 2. Check if daily limit allows a new request
      if (!canMakeDailyCall('blacklist')) {
        logRateLimitExceeded('AbuseIPDB', clientIP, { 
          endpoint: 'blacklist',
          usage: `${dailyUsage.blacklist}/${DAILY_LIMITS.blacklist}`
        });

        // Always serve cached or fallback data when limit is exhausted
        if (blacklistCache) {
          return res.status(200).json({ 
            source: 'cache_daily_limit_reached',
            warning: 'AbuseIPDB daily limit reached (5/day). Serving cached threat feed.',
            usage: `${dailyUsage.blacklist}/${DAILY_LIMITS.blacklist}`,
            ...blacklistCache 
          });
        }

        return res.status(200).json({
          source: 'fallback',
          warning: 'AbuseIPDB daily limit reached (5/day). Serving standard threat feed.',
          usage: `${dailyUsage.blacklist}/${DAILY_LIMITS.blacklist}`,
          data: FALLBACK_BLACKLIST
        });
      }

      // Validate query params
      const limitNum = isValidLimit(limit) ? parseInt(limit, 10) : 60;
      const confNum = isValidConfidence(confidenceMinimum) ? parseInt(confidenceMinimum, 10) : 75;

      const path = `/api/v2/blacklist?confidenceMinimum=${confNum}&limit=${limitNum}`;

      try {
        const data = await fetchFromAbuseIPDB(path);
        blacklistCache = data;
        lastBlacklistFetch = now;
        recordDailyCall('blacklist');

        return res.status(200).json({ 
          source: 'live', 
          usage: `${dailyUsage.blacklist}/${DAILY_LIMITS.blacklist}`,
          ...data 
        });
      } catch (fetchErr) {
        console.warn('AbuseIPDB external request failed:', fetchErr.message);
        
        // Graceful fallback to existing cache or fallback list
        if (blacklistCache) {
          return res.status(200).json({
            source: 'cache_fallback',
            warning: fetchErr.message,
            ...blacklistCache
          });
        }

        return res.status(200).json({
          source: 'fallback',
          warning: fetchErr.message,
          data: FALLBACK_BLACKLIST
        });
      }

    } else if (action === 'check') {
      if (!ip || !isValidIP(ip)) {
        return res.status(400).json({ error: 'Invalid IP address parameter' });
      }

      // 1. Check IP cache (avoid duplicate queries for same IP)
      const now = Date.now();
      const cached = ipCheckCache.get(ip);
      if (cached && (now - cached.timestamp < IP_CHECK_CACHE_TTL)) {
        return res.status(200).json({ source: 'cache', data: cached.data });
      }

      // 2. Check daily check limit (1,000 / day)
      if (!canMakeDailyCall('check')) {
        return res.status(429).json({ 
          error: 'Daily API limit reached for check endpoint',
          usage: `${dailyUsage.check}/${DAILY_LIMITS.check}`,
          message: 'Please try again tomorrow'
        });
      }

      const path = `/api/v2/check?ipAddress=${encodeURIComponent(ip)}&verbose=true&maxAgeInDays=90`;
      const data = await fetchFromAbuseIPDB(path);
      
      recordDailyCall('check');
      if (data && data.data) {
        ipCheckCache.set(ip, { timestamp: now, data: data.data });
      }

      return res.status(200).json({ source: 'live', ...data });

    } else {
      return res.status(400).json({ error: 'Invalid action or missing parameters' });
    }
  } catch (error) {
    console.error('AbuseIPDB API Error:', error);
    if (blacklistCache) {
      return res.status(200).json({ source: 'cache_fallback', ...blacklistCache });
    }
    return res.status(200).json({ source: 'fallback', data: FALLBACK_BLACKLIST });
  }
}

function fetchFromAbuseIPDB(path) {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: 'api.abuseipdb.com',
      path,
      method: 'GET',
      headers: {
        'Key': ABUSEIPDB_API_KEY,
        'Accept': 'application/json',
        'User-Agent': 'CyberThreatMap/2.0'
      }
    };

    const request = https.request(options, (response) => {
      let data = '';
      response.on('data', chunk => data += chunk);
      response.on('end', () => {
        if (response.statusCode >= 200 && response.statusCode < 300) {
          try {
            const parsed = JSON.parse(data);
            resolve(parsed);
          } catch (e) {
            reject(new Error('Invalid JSON received from AbuseIPDB'));
          }
        } else {
          reject(new Error(`AbuseIPDB returned status ${response.statusCode}: ${data}`));
        }
      });
    });

    request.on('error', (err) => reject(err));
    request.setTimeout(10000, () => {
      request.destroy();
      reject(new Error('AbuseIPDB request timeout'));
    });

    request.end();
  });
}
