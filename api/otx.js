import https from 'https';

const OTX_API_KEY = process.env.OTX_API_KEY;
if (!OTX_API_KEY) {
  throw new Error('OTX_API_KEY environment variable is required');
}

// Daily API usage tracking (OTX free tier limits)
const DAILY_LIMITS = {
  indicators: 29,   // OTX limit: 30 per day
  pulses: 29        // OTX limit: 30 per day
};

const dailyUsage = {
  indicators: 0,
  pulses: 0,
  lastReset: Date.now()
};

// Reset daily counters at midnight
function checkAndResetDailyCounters() {
  const now = Date.now();
  const oneDay = 24 * 60 * 60 * 1000;
  
  if (now - dailyUsage.lastReset >= oneDay) {
    dailyUsage.indicators = 0;
    dailyUsage.pulses = 0;
    dailyUsage.lastReset = now;
    console.log('Daily OTX API counters reset');
  }
}

function checkDailyLimit(endpoint) {
  checkAndResetDailyCounters();
  
  if (dailyUsage[endpoint] >= DAILY_LIMITS[endpoint]) {
    console.warn(`OTX ${endpoint} daily limit reached (${dailyUsage[endpoint]}/${DAILY_LIMITS[endpoint]})`);
    return false;
  }
  
  dailyUsage[endpoint]++;
  return true;
}

// Simple rate limiting in-memory
const rateLimitMap = new Map();
const RATE_LIMIT_WINDOW = 60000; // 1 minute
const RATE_LIMIT_MAX_REQUESTS = 30;

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

// Input validation
function isValidIndicatorType(type) {
  const validTypes = ['IPv4', 'IPv6', 'domain', 'hostname', 'URL', 'URI', 'FileHash-MD5', 'FileHash-SHA1', 'FileHash-SHA256', 'email', 'CVE'];
  return validTypes.includes(type);
}

function isValidIndicator(indicator) {
  if (!indicator || typeof indicator !== 'string') return false;
  if (indicator.length > 256) return false;
  // Basic sanitization
  const sanitized = indicator.replace(/[<>]/g, '');
  return sanitized === indicator;
}

export default async function handler(req, res) {
  // Restrict CORS to specific origins
  const allowedOrigins = process.env.ALLOWED_ORIGINS ? process.env.ALLOWED_ORIGINS.split(',') : ['http://localhost:5173', 'http://localhost:3000'];
  const origin = req.headers.origin;
  
  if (allowedOrigins.includes(origin)) {
    res.setHeader('Access-Control-Allow-Origin', origin);
  }
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
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
    logRateLimitExceeded('OTX', clientIP, { usage: 'Rate limit exceeded' });
    return res.status(429).json({ error: 'Rate limit exceeded. Please try again later.' });
  }

  // Log API usage
  logAPIUsage('OTX', action, clientIP, { type, limit });

  const { action = 'indicators', type, indicator, limit = 20 } = req.query || {};

  try {
    // Validate action
    if (!['indicators', 'pulses'].includes(action)) {
      return res.status(400).json({ error: 'Invalid action parameter' });
    }

    if (action === 'indicators') {
      // Check daily limit
      if (!checkDailyLimit('indicators')) {
        return res.status(429).json({ 
          error: 'Daily API limit reached for indicators endpoint',
          usage: `${dailyUsage.indicators}/${DAILY_LIMITS.indicators}`,
          message: 'Please try again tomorrow'
        });
      }

      // Validate type
      if (type && !isValidIndicatorType(type)) {
        return res.status(400).json({ error: 'Invalid indicator type parameter' });
      }

      // Validate limit
      const limitNum = parseInt(limit, 10);
      if (isNaN(limitNum) || limitNum < 1 || limitNum > 50) {
        return res.status(400).json({ error: 'Invalid limit parameter. Must be between 1 and 50.' });
      }

      const path = `/api/v1/indicators/${type || 'IPv4'}?limit=${limitNum}`;
      const data = await fetchFromOTX(path);
      return res.status(200).json(data);
    } else if (action === 'pulses') {
      // Check daily limit
      if (!checkDailyLimit('pulses')) {
        return res.status(429).json({ 
          error: 'Daily API limit reached for pulses endpoint',
          usage: `${dailyUsage.pulses}/${DAILY_LIMITS.pulses}`,
          message: 'Please try again tomorrow'
        });
      }

      // Validate indicator
      if (!indicator || !isValidIndicator(indicator)) {
        return res.status(400).json({ error: 'Invalid indicator parameter' });
      }

      const path = `/api/v1/indicators/${encodeURIComponent(indicator)}/pulses`;
      const data = await fetchFromOTX(path);
      return res.status(200).json(data);
    } else {
      return res.status(400).json({ error: 'Invalid action or missing parameters' });
    }
  } catch (error) {
    console.error('OTX API Error:', error);
    const errorMessage = process.env.NODE_ENV === 'production' 
      ? 'Internal server error' 
      : (error.message || 'Failed to fetch from OTX');
    return res.status(500).json({ error: errorMessage });
  }
}

function fetchFromOTX(path) {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: 'otx.alienvault.com',
      path,
      method: 'GET',
      headers: {
        'X-OTX-API-KEY': OTX_API_KEY,
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
            reject(new Error('Invalid JSON received from OTX'));
          }
        } else {
          reject(new Error(`OTX returned status ${response.statusCode}: ${data}`));
        }
      });
    });

    request.on('error', (err) => reject(err));
    request.setTimeout(10000, () => {
      request.destroy();
      reject(new Error('OTX request timeout'));
    });

    request.end();
  });
}
