import https from 'https';

const ABUSEIPDB_API_KEY = process.env.ABUSEIPDB_API_KEY || '15ee4525bb80b3e86917eb91eeb8cc734ccf0b330ff827af688b63ecd8ed0f6bf7a041b3f81debac';

// In-memory cache to respect API rate limits
let blacklistCache = null;
let lastBlacklistFetch = 0;
const CACHE_TTL_MS = 60 * 1000; // 1 minute cache

export default async function handler(req, res) {
  // Enable CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Key');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  const { action = 'blacklist', limit = 50, confidenceMinimum = 80, ip } = req.query || {};

  try {
    if (action === 'blacklist') {
      const now = Date.now();
      if (blacklistCache && (now - lastBlacklistFetch < CACHE_TTL_MS)) {
        return res.status(200).json({ source: 'cache', ...blacklistCache });
      }

      const limitNum = Math.min(100, Math.max(10, parseInt(limit, 10) || 50));
      const confNum = Math.min(100, Math.max(50, parseInt(confidenceMinimum, 10) || 80));

      const path = `/api/v2/blacklist?confidenceMinimum=${confNum}&limit=${limitNum}`;
      const data = await fetchFromAbuseIPDB(path);

      blacklistCache = data;
      lastBlacklistFetch = now;

      return res.status(200).json({ source: 'live', ...data });
    } else if (action === 'check' && ip) {
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
