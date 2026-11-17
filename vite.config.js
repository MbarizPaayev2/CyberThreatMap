import { defineConfig } from 'vite';
import https from 'https';

const ABUSEIPDB_API_KEY = process.env.ABUSEIPDB_API_KEY || '15ee4525bb80b3e86917eb91eeb8cc734ccf0b330ff827af688b63ecd8ed0f6bf7a041b3f81debac';

let blacklistCache = null;
let lastBlacklistFetch = 0;
const CACHE_TTL_MS = 6 * 60 * 60 * 1000; // 6 hours cache (4 requests/day max)

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

function checkAndResetDailyCounters() {
  const now = Date.now();
  const oneDay = 24 * 60 * 60 * 1000;
  
  if (now - dailyUsage.lastReset >= oneDay) {
    dailyUsage.blacklist = 0;
    dailyUsage.check = 0;
    dailyUsage.lastReset = now;
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

export default defineConfig({
  plugins: [
    {
      name: 'abuseipdb-api-middleware',
      configureServer(server) {
        server.middlewares.use('/api/abuseipdb', async (req, res) => {
          const url = new URL(req.url, `http://${req.headers.host}`);
          const action = url.searchParams.get('action') || 'blacklist';
          const limit = url.searchParams.get('limit') || '60';
          const confidenceMinimum = url.searchParams.get('confidenceMinimum') || '75';
          const ip = url.searchParams.get('ip');

          res.setHeader('Content-Type', 'application/json');
          res.setHeader('Access-Control-Allow-Origin', '*');
          res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
          res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Key');

          if (req.method === 'OPTIONS') {
            res.statusCode = 200;
            res.end();
            return;
          }

          try {
            if (!isValidAction(action)) {
              res.statusCode = 400;
              res.end(JSON.stringify({ error: 'Invalid action parameter' }));
              return;
            }

            if (action === 'blacklist') {
              const now = Date.now();

              // 1. Check in-memory cache first (preserves daily quota)
              if (blacklistCache && (now - lastBlacklistFetch < CACHE_TTL_MS)) {
                res.end(JSON.stringify({ 
                  source: 'cache', 
                  cachedAt: lastBlacklistFetch,
                  usage: `${dailyUsage.blacklist}/${DAILY_LIMITS.blacklist}`,
                  ...blacklistCache 
                }));
                return;
              }

              // 2. Check if daily limit allows call
              if (!canMakeDailyCall('blacklist')) {
                if (blacklistCache) {
                  res.end(JSON.stringify({ 
                    source: 'cache_daily_limit_reached',
                    warning: 'AbuseIPDB daily limit reached (5/day). Serving cached threat feed.',
                    usage: `${dailyUsage.blacklist}/${DAILY_LIMITS.blacklist}`,
                    ...blacklistCache 
                  }));
                  return;
                }

                res.end(JSON.stringify({
                  source: 'fallback',
                  warning: 'AbuseIPDB daily limit reached (5/day). Serving standard threat feed.',
                  usage: `${dailyUsage.blacklist}/${DAILY_LIMITS.blacklist}`,
                  data: FALLBACK_BLACKLIST
                }));
                return;
              }

              const limitNum = isValidLimit(limit) ? parseInt(limit, 10) : 60;
              const confNum = isValidConfidence(confidenceMinimum) ? parseInt(confidenceMinimum, 10) : 75;

              const path = `/api/v2/blacklist?confidenceMinimum=${confNum}&limit=${limitNum}`;
              
              try {
                const data = await fetchFromAbuseIPDB(path);
                blacklistCache = data;
                lastBlacklistFetch = now;
                recordDailyCall('blacklist');

                res.end(JSON.stringify({ 
                  source: 'live', 
                  usage: `${dailyUsage.blacklist}/${DAILY_LIMITS.blacklist}`,
                  ...data 
                }));
              } catch (fetchErr) {
                if (blacklistCache) {
                  res.end(JSON.stringify({
                    source: 'cache_fallback',
                    warning: fetchErr.message,
                    ...blacklistCache
                  }));
                  return;
                }

                res.end(JSON.stringify({
                  source: 'fallback',
                  warning: fetchErr.message,
                  data: FALLBACK_BLACKLIST
                }));
              }

            } else if (action === 'check') {
              if (!ip || !isValidIP(ip)) {
                res.statusCode = 400;
                res.end(JSON.stringify({ error: 'Invalid IP address parameter' }));
                return;
              }

              // Check IP cache
              const now = Date.now();
              const cached = ipCheckCache.get(ip);
              if (cached && (now - cached.timestamp < IP_CHECK_CACHE_TTL)) {
                res.end(JSON.stringify({ source: 'cache', data: cached.data }));
                return;
              }

              if (!canMakeDailyCall('check')) {
                res.statusCode = 429;
                res.end(JSON.stringify({ 
                  error: 'Daily API limit reached for check endpoint',
                  usage: `${dailyUsage.check}/${DAILY_LIMITS.check}`,
                  message: 'Please try again tomorrow'
                }));
                return;
              }

              const path = `/api/v2/check?ipAddress=${encodeURIComponent(ip)}&verbose=true&maxAgeInDays=90`;
              const data = await fetchFromAbuseIPDB(path);
              
              recordDailyCall('check');
              if (data && data.data) {
                ipCheckCache.set(ip, { timestamp: now, data: data.data });
              }

              res.end(JSON.stringify({ source: 'live', ...data }));
            } else {
              res.statusCode = 400;
              res.end(JSON.stringify({ error: 'Invalid parameters' }));
            }
          } catch (e) {
            console.error('Vite AbuseIPDB middleware error:', e);
            if (blacklistCache) {
              res.end(JSON.stringify({ source: 'cache_fallback', ...blacklistCache }));
              return;
            }
            res.end(JSON.stringify({ source: 'fallback', data: FALLBACK_BLACKLIST }));
          }
        });
      }
    }
  ]
});

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
            resolve(JSON.parse(data));
          } catch (e) {
            reject(new Error('Invalid JSON'));
          }
        } else {
          reject(new Error(`Status ${response.statusCode}: ${data}`));
        }
      });
    });

    request.on('error', (err) => reject(err));
    request.setTimeout(10000, () => {
      request.destroy();
      reject(new Error('Timeout'));
    });
    request.end();
  });
}
