import https from 'https';

const ABUSEIPDB_API_KEY = process.env.ABUSEIPDB_API_KEY;
if (!ABUSEIPDB_API_KEY) {
  throw new Error('ABUSEIPDB_API_KEY environment variable is required');
}

// In-memory cache to respect API rate limits
let blacklistCache = null;
let lastBlacklistFetch = 0;
const CACHE_TTL_MS = 60 * 1000; // 1 minute cache

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

// Simple rate limiting in-memory
const rateLimitMap = new Map();
const RATE_LIMIT_WINDOW = 60000; // 1 minute
const RATE_LIMIT_MAX_REQUESTS = 60;

function checkRateLimit(identifier) {
  const now = Date.now();
  const userRequests = rateLimitMap.get(identifier) || [];
  
  // Remove requests outside the time window
  const validRequests = userRequests.filter(timestamp => now - timestamp < RATE_LIMIT_WINDOW);
  
  if (validRequests.length >= RATE_LIMIT_MAX_REQUESTS) {
    return false;
  }
  
  validRequests.push(now);
  rateLimitMap.set(identifier, validRequests);
  return true;
}

export default async function handler(req, res) {
  // Restrict CORS to specific origins (configure as needed)
  const allowedOrigins = process.env.ALLOWED_ORIGINS ? process.env.ALLOWED_ORIGINS.split(',') : ['http://localhost:5173', 'http://localhost:3000'];
  const origin = req.headers.origin;
  
  if (allowedOrigins.includes(origin)) {
    res.setHeader('Access-Control-Allow-Origin', origin);
  }
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Key');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  // Rate limiting
  const clientIP = req.headers['x-forwarded-for'] || req.headers['x-real-ip'] || 'unknown';
  if (!checkRateLimit(clientIP)) {
    return res.status(429).json({ error: 'Rate limit exceeded. Please try again later.' });
  }

  const { action = 'blacklist', limit = 50, confidenceMinimum = 80, ip } = req.query || {};

  try {
    // Validate action
    if (!isValidAction(action)) {
      return res.status(400).json({ error: 'Invalid action parameter' });
    }

    if (action === 'blacklist') {
      // Validate limit and confidence
      if (!isValidLimit(limit)) {
        return res.status(400).json({ error: 'Invalid limit parameter. Must be between 10 and 100.' });
      }
      if (!isValidConfidence(confidenceMinimum)) {
        return res.status(400).json({ error: 'Invalid confidenceMinimum parameter. Must be between 50 and 100.' });
      }

      const now = Date.now();
      if (blacklistCache && (now - lastBlacklistFetch < CACHE_TTL_MS)) {
        return res.status(200).json({ source: 'cache', ...blacklistCache });
      }

      const limitNum = parseInt(limit, 10);
      const confNum = parseInt(confidenceMinimum, 10);

      const path = `/api/v2/blacklist?confidenceMinimum=${confNum}&limit=${limitNum}`;
      const data = await fetchFromAbuseIPDB(path);

      blacklistCache = data;
      lastBlacklistFetch = now;

      return res.status(200).json({ source: 'live', ...data });
    } else if (action === 'check') {
      // Validate IP
      if (!ip || !isValidIP(ip)) {
        return res.status(400).json({ error: 'Invalid IP address parameter' });
      }

      const path = `/api/v2/check?ipAddress=${encodeURIComponent(ip)}&verbose=true&maxAgeInDays=90`;
      const data = await fetchFromAbuseIPDB(path);
      return res.status(200).json(data);
    } else {
      return res.status(400).json({ error: 'Invalid action or missing parameters' });
    }
  } catch (error) {
    console.error('AbuseIPDB API Error:', error);
    return res.status(500).json({ error: error.message || 'Failed to fetch from AbuseIPDB' });
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
