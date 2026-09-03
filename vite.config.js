import { defineConfig } from 'vite';
import https from 'https';

const ABUSEIPDB_API_KEY = process.env.ABUSEIPDB_API_KEY;
if (!ABUSEIPDB_API_KEY) {
  console.warn('WARNING: ABUSEIPDB_API_KEY environment variable not set. API will not function.');
}

let blacklistCache = null;
let lastBlacklistFetch = 0;

// Input validation helpers (same as production)
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
          const limit = url.searchParams.get('limit') || '50';
          const confidenceMinimum = url.searchParams.get('confidenceMinimum') || '80';
          const ip = url.searchParams.get('ip');

          res.setHeader('Content-Type', 'application/json');
          
          // Restrict CORS for dev server
          const allowedOrigins = ['http://localhost:5173', 'http://localhost:3000'];
          const origin = req.headers.origin;
          if (allowedOrigins.includes(origin)) {
            res.setHeader('Access-Control-Allow-Origin', origin);
          }

          // Add security headers
          res.setHeader('X-Content-Type-Options', 'nosniff');
          res.setHeader('X-Frame-Options', 'DENY');
          res.setHeader('X-XSS-Protection', '1; mode=block');

          try {
            // Validate action
            if (!isValidAction(action)) {
              res.statusCode = 400;
              res.end(JSON.stringify({ error: 'Invalid action parameter' }));
              return;
            }

            if (action === 'blacklist') {
              // Validate limit and confidence
              if (!isValidLimit(limit)) {
                res.statusCode = 400;
                res.end(JSON.stringify({ error: 'Invalid limit parameter. Must be between 10 and 100.' }));
                return;
              }
              if (!isValidConfidence(confidenceMinimum)) {
                res.statusCode = 400;
                res.end(JSON.stringify({ error: 'Invalid confidenceMinimum parameter. Must be between 50 and 100.' }));
                return;
              }

              const now = Date.now();
              if (blacklistCache && (now - lastBlacklistFetch < 60000)) {
                res.end(JSON.stringify({ source: 'cache', ...blacklistCache }));
                return;
              }

              const limitNum = parseInt(limit, 10);
              const confNum = parseInt(confidenceMinimum, 10);

              const path = `/api/v2/blacklist?confidenceMinimum=${confNum}&limit=${limitNum}`;
              const data = await fetchFromAbuseIPDB(path);
              blacklistCache = data;
              lastBlacklistFetch = now;
              res.end(JSON.stringify({ source: 'live', ...data }));
            } else if (action === 'check') {
              // Validate IP
              if (!ip || !isValidIP(ip)) {
                res.statusCode = 400;
                res.end(JSON.stringify({ error: 'Invalid IP address parameter' }));
                return;
              }

              const path = `/api/v2/check?ipAddress=${encodeURIComponent(ip)}&verbose=true&maxAgeInDays=90`;
              const data = await fetchFromAbuseIPDB(path);
              res.end(JSON.stringify(data));
            } else {
              res.statusCode = 400;
              res.end(JSON.stringify({ error: 'Invalid parameters' }));
            }
          } catch (e) {
            console.error('Vite AbuseIPDB middleware error:', e);
            res.statusCode = 500;
            res.end(JSON.stringify({ error: 'Internal server error' }));
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
