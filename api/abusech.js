import https from 'https';
import { logAPIUsage, logRateLimitExceeded } from '../lib/security/auditLogger.js';

const ABUSE_CH_AUTH_KEY = process.env.ABUSE_CH_AUTH_KEY;
if (!ABUSE_CH_AUTH_KEY) {
  throw new Error('ABUSE_CH_AUTH_KEY environment variable is required');
}

// Daily API usage tracking (Abuse.ch free tier limits)
const DAILY_LIMITS = {
  fplist: 49,   // Abuse.ch limit: ~50 per day
  collections: 49
};

const dailyUsage = {
  fplist: 0,
  collections: 0,
  lastReset: Date.now()
};

// Reset daily counters at midnight
function checkAndResetDailyCounters() {
  const now = Date.now();
  const oneDay = 24 * 60 * 60 * 1000;
  
  if (now - dailyUsage.lastReset >= oneDay) {
    dailyUsage.fplist = 0;
    dailyUsage.collections = 0;
    dailyUsage.lastReset = now;
    console.log('Daily Abuse.ch API counters reset');
  }
}

function checkDailyLimit(endpoint) {
  checkAndResetDailyCounters();
  
  if (dailyUsage[endpoint] >= DAILY_LIMITS[endpoint]) {
    console.warn(`Abuse.ch ${endpoint} daily limit reached (${dailyUsage[endpoint]}/${DAILY_LIMITS[endpoint]})`);
    return false;
  }
  
  dailyUsage[endpoint]++;
  return true;
}

// Rate limiting
const rateLimitMap = new Map();
const RATE_LIMIT_WINDOW = 60000; // 1 minute
const RATE_LIMIT_MAX_REQUESTS = 30;

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

// Input validation
function isValidQuery(query) {
  const validQueries = ['get_fplist', 'create_collection'];
  return validQueries.includes(query);
}

function isValidFormat(format) {
  return ['json', 'csv'].includes(format);
}

function isValidCollectionName(name) {
  if (!name || typeof name !== 'string') return false;
  if (name.length < 1 || name.length > 100) return false;
  // Allowed chars: A-Z a-z 0-9 . - _ :
  const validChars = /^[A-Za-z0-9._\-:]+$/;
  return validChars.test(name);
}

export default async function handler(req, res) {
  // Restrict CORS to specific origins
  const allowedOrigins = process.env.ALLOWED_ORIGINS ? process.env.ALLOWED_ORIGINS.split(',') : ['http://localhost:5173', 'http://localhost:3000'];
  const origin = req.headers.origin;
  
  if (allowedOrigins.includes(origin)) {
    res.setHeader('Access-Control-Allow-Origin', origin);
  }
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  // Add security headers
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('X-XSS-Protection', '1; mode=block');
  if (process.env.NODE_ENV === 'production') {
    res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
  }

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  // Rate limiting
  const clientIP = req.headers['x-forwarded-for'] || req.headers['x-real-ip'] || 'unknown';
  if (!checkRateLimit(clientIP)) {
    logRateLimitExceeded('Abuse.ch', clientIP, { usage: 'Rate limit exceeded' });
    return res.status(429).json({ error: 'Rate limit exceeded. Please try again later.' });
  }

  const { query, format = 'json', collection_name, description, anonymous = 0 } = req.body || {};

  try {
    // Validate query
    if (!query || !isValidQuery(query)) {
      return res.status(400).json({ error: 'Invalid query parameter. Must be get_fplist or create_collection' });
    }

    // Log API usage
    logAPIUsage('Abuse.ch', query, clientIP, { format });

    if (query === 'get_fplist') {
      // Check daily limit
      if (!checkDailyLimit('fplist')) {
        logRateLimitExceeded('Abuse.ch', clientIP, { 
          endpoint: 'fplist',
          usage: `${dailyUsage.fplist}/${DAILY_LIMITS.fplist}`
        });
        return res.status(429).json({ 
          error: 'Daily API limit reached for false positive list',
          usage: `${dailyUsage.fplist}/${DAILY_LIMITS.fplist}`,
          message: 'Please try again tomorrow'
        });
      }

      // Validate format
      if (!isValidFormat(format)) {
        return res.status(400).json({ error: 'Invalid format parameter. Must be json or csv' });
      }

      const data = await fetchFromAbuseCh({ query, format });
      return res.status(200).json(data);
    } else if (query === 'create_collection') {
      // Check daily limit
      if (!checkDailyLimit('collections')) {
        logRateLimitExceeded('Abuse.ch', clientIP, { 
          endpoint: 'collections',
          usage: `${dailyUsage.collections}/${DAILY_LIMITS.collections}`
        });
        return res.status(429).json({ 
          error: 'Daily API limit reached for collection creation',
          usage: `${dailyUsage.collections}/${DAILY_LIMITS.collections}`,
          message: 'Please try again tomorrow'
        });
      }

      // Validate collection_name
      if (!collection_name || !isValidCollectionName(collection_name)) {
        return res.status(400).json({ 
          error: 'Invalid collection_name. Must be 1-100 chars, allowed: A-Z a-z 0-9 . - _ :' 
        });
      }

      // Validate description
      if (description && description.length > 400) {
        return res.status(400).json({ error: 'Description must be less than 400 characters' });
      }

      // Validate anonymous
      const anonValue = parseInt(anonymous, 10);
      if (isNaN(anonValue) || (anonValue !== 0 && anonValue !== 1)) {
        return res.status(400).json({ error: 'Anonymous must be 0 or 1' });
      }

      const data = await fetchFromAbuseCh({ 
        query, 
        collection_name, 
        description, 
        anonymous: anonValue 
      });
      return res.status(200).json(data);
    } else {
      return res.status(400).json({ error: 'Invalid query parameter' });
    }
  } catch (error) {
    console.error('Abuse.ch API Error:', error);
    const errorMessage = process.env.NODE_ENV === 'production' 
      ? 'Internal server error' 
      : (error.message || 'Failed to fetch from Abuse.ch');
    return res.status(500).json({ error: errorMessage });
  }
}

function fetchFromAbuseCh(payload) {
  return new Promise((resolve, reject) => {
    const postData = JSON.stringify(payload);
    
    const options = {
      hostname: 'hunting-api.abuse.ch',
      path: '/api/v1/',
      method: 'POST',
      headers: {
        'Auth-Key': ABUSE_CH_AUTH_KEY,
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        'User-Agent': 'CyberThreatMap/2.0',
        'Content-Length': Buffer.byteLength(postData)
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
            reject(new Error('Invalid JSON received from Abuse.ch'));
          }
        } else {
          reject(new Error(`Abuse.ch returned status ${response.statusCode}: ${data}`));
        }
      });
    });

    request.on('error', (err) => reject(err));
    request.setTimeout(15000, () => {
      request.destroy();
      reject(new Error('Abuse.ch request timeout'));
    });

    request.write(postData);
    request.end();
  });
}
