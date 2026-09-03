import { defineConfig } from 'vite';
import https from 'https';

const ABUSEIPDB_API_KEY = process.env.ABUSEIPDB_API_KEY;
if (!ABUSEIPDB_API_KEY) {
  console.warn('WARNING: ABUSEIPDB_API_KEY environment variable not set. API will not function.');
}

let blacklistCache = null;
let lastBlacklistFetch = 0;

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

          try {
            if (action === 'blacklist') {
              const now = Date.now();
              if (blacklistCache && (now - lastBlacklistFetch < 60000)) {
                res.end(JSON.stringify({ source: 'cache', ...blacklistCache }));
                return;
              }

              const path = `/api/v2/blacklist?confidenceMinimum=${confidenceMinimum}&limit=${limit}`;
              const data = await fetchFromAbuseIPDB(path);
              blacklistCache = data;
              lastBlacklistFetch = now;
              res.end(JSON.stringify({ source: 'live', ...data }));
            } else if (action === 'check' && ip) {
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
            res.end(JSON.stringify({ error: e.message }));
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
