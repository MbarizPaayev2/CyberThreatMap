import https from 'https';

const VIRUSTOTAL_API_KEY = process.env.VIRUSTOTAL_API_KEY;
if (!VIRUSTOTAL_API_KEY) {
  throw new Error('VIRUSTOTAL_API_KEY environment variable is required');
}

// Daily API usage tracking (VirusTotal free tier limits)
const DAILY_LIMITS = {
  lookups: 499   // VirusTotal limit: 500 per day
};

const dailyUsage = {
  lookups: 0,
  lastReset: Date.now()
};

// Reset daily counters at midnight
function checkAndResetDailyCounters() {
  const now = Date.now();
  const oneDay = 24 * 60 * 60 * 1000;
  
  if (now - dailyUsage.lastReset >= oneDay) {
    dailyUsage.lookups = 0;
    dailyUsage.lastReset = now;
    console.log('Daily VirusTotal API counters reset');
  }
}

function checkDailyLimit(endpoint) {
  checkAndResetDailyCounters();
  
  if (dailyUsage[endpoint] >= DAILY_LIMITS[endpoint]) {
    console.warn(`VirusTotal ${endpoint} daily limit reached (${dailyUsage[endpoint]}/${DAILY_LIMITS[endpoint]})`);
    return false;
  }
  
  dailyUsage[endpoint]++;
  return true;
}

// Rate limiting: 4 requests per minute (VirusTotal free tier limit)
const rateLimitMap = new Map();
const RATE_LIMIT_WINDOW = 60000; // 1 minute
const RATE_LIMIT_MAX_REQUESTS = 4; // VirusTotal limit: 4/min

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
function isValidResource(resource) {
  if (!resource || typeof resource !== 'string') return false;
  if (resource.length > 256) return false;
  // Basic sanitization
  const sanitized = resource.replace(/[<>]/g, '');
  return sanitized === resource;
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

  // Rate limiting (4/min per IP)
  const clientIP = req.headers['x-forwarded-for'] || req.headers['x-real-ip'] || 'unknown';
  if (!checkRateLimit(clientIP)) {
    logRateLimitExceeded('VirusTotal', clientIP, { usage: 'Rate limit exceeded (4/min)' });
    return res.status(429).json({ 
      error: 'Rate limit exceeded. VirusTotal allows 4 requests per minute.',
      retry_after: 60
    });
  }

  // Log API usage
  logAPIUsage('VirusTotal', action, clientIP, { resource });

  const { action = 'ip', resource } = req.query || {};

  try {
    // Validate action
    if (!['ip', 'domain', 'file', 'url'].includes(action)) {
      return res.status(400).json({ error: 'Invalid action parameter' });
    }

    // Check daily limit
    if (!checkDailyLimit('lookups')) {
      return res.status(429).json({ 
        error: 'Daily API limit reached for VirusTotal',
        usage: `${dailyUsage.lookups}/${DAILY_LIMITS.lookups}`,
        message: 'Please try again tomorrow'
      });
    }

    // Validate resource
    if (!resource || !isValidResource(resource)) {
      return res.status(400).json({ error: 'Invalid resource parameter' });
    }

    let path;
    if (action === 'ip') {
      path = `/api/v3/ip_addresses/${encodeURIComponent(resource)}`;
    } else if (action === 'domain') {
      path = `/api/v3/domains/${encodeURIComponent(resource)}`;
    } else if (action === 'file') {
      path = `/api/v3/files/${encodeURIComponent(resource)}`;
    } else if (action === 'url') {
      path = `/api/v3/urls/${encodeURIComponent(btoa(resource))}`;
    }

    const data = await fetchFromVirusTotal(path);
    return res.status(200).json(data);
  } catch (error) {
    console.error('VirusTotal API Error:', error);
    const errorMessage = process.env.NODE_ENV === 'production' 
      ? 'Internal server error' 
      : (error.message || 'Failed to fetch from VirusTotal');
    return res.status(500).json({ error: errorMessage });
  }
}

function fetchFromVirusTotal(path) {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: 'www.virustotal.com',
      path,
      method: 'GET',
      headers: {
        'x-apikey': VIRUSTOTAL_API_KEY,
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
            reject(new Error('Invalid JSON received from VirusTotal'));
          }
        } else {
          reject(new Error(`VirusTotal returned status ${response.statusCode}: ${data}`));
        }
      });
    });

    request.on('error', (err) => reject(err));
    request.setTimeout(15000, () => {
      request.destroy();
      reject(new Error('VirusTotal request timeout'));
    });

    request.end();
  });
}
