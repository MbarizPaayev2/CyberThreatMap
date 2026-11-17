import { getCountryByIsoCode, ALL_COUNTRIES } from '../utils/countries.js';
import { addEvent } from '../state/eventStore.js';
import { addThreatEventToGlobe } from './globe.js';
import { playCriticalAlert } from '../utils/sound.js';
import { recordEvent } from '../utils/telemetryTracker.js';

let cachedAbuseIPs = [];
let isPollingActive = false;

// Client-side LocalStorage cache settings (6 hours = at most 4 requests / 24h, staying within 5/day limit)
const LOCAL_STORAGE_KEY = 'threatmap_abuseipdb_blacklist';
const LOCAL_STORAGE_TIME = 'threatmap_abuseipdb_timestamp';
const CLIENT_CACHE_TTL = 6 * 60 * 60 * 1000; // 6 hours

// In-memory cache for individual IP checks (1,000 / day quota on AbuseIPDB)
const ipCheckMemoryCache = new Map();

const ATTACK_CATEGORY_MAP = [
  'Port Scan',
  'DDoS',
  'Brute Force',
  'Credential Stuffing',
  'SQL Injection',
  'Malware',
  'Command Injection',
  'DNS Tunneling'
];

const FALLBACK_RECORDS = [
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

export async function fetchAbuseIPDBBlacklist(limit = 80, minConfidence = 75) {
  try {
    const res = await fetch(`/api/abuseipdb?action=blacklist&limit=${limit}&confidenceMinimum=${minConfidence}`);
    if (!res.ok) {
      console.warn('[AbuseIPDB] API returned status:', res.status);
      return getStoredOrFallbackBlacklist();
    }
    const json = await res.json();
    if (json && Array.isArray(json.data) && json.data.length > 0) {
      cachedAbuseIPs = json.data;
      saveBlacklistToStorage(json.data);
      console.log(`[AbuseIPDB] Loaded ${json.data.length} records (${json.source || 'api'})`);
      return json.data;
    }
    return getStoredOrFallbackBlacklist();
  } catch (err) {
    console.warn('[AbuseIPDB] Fetch error:', err);
    return getStoredOrFallbackBlacklist();
  }
}

function getStoredOrFallbackBlacklist() {
  try {
    const stored = localStorage.getItem(LOCAL_STORAGE_KEY);
    if (stored) {
      const parsed = JSON.parse(stored);
      if (Array.isArray(parsed) && parsed.length > 0) {
        cachedAbuseIPs = parsed;
        return parsed;
      }
    }
  } catch (e) {
    // ignore json error
  }
  cachedAbuseIPs = FALLBACK_RECORDS;
  return FALLBACK_RECORDS;
}

function saveBlacklistToStorage(records) {
  try {
    localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(records));
    localStorage.setItem(LOCAL_STORAGE_TIME, String(Date.now()));
  } catch (e) {
    console.warn('[AbuseIPDB] Failed to save cache in localStorage:', e);
  }
}

export async function checkIPDetails(ip) {
  if (!ip) return null;

  // 1. In-memory cache check (avoids wasting the 1,000/day check limit on duplicate clicks)
  if (ipCheckMemoryCache.has(ip)) {
    return ipCheckMemoryCache.get(ip);
  }

  try {
    const res = await fetch(`/api/abuseipdb?action=check&ip=${encodeURIComponent(ip)}`);
    if (!res.ok) {
      return null;
    }
    const json = await res.json();
    if (json && json.data) {
      ipCheckMemoryCache.set(ip, json.data);
      return json.data;
    }
    return null;
  } catch (err) {
    console.warn('[AbuseIPDB] Failed to check IP details:', err);
    return null;
  }
}

export function getCachedAbuseIPs() {
  if (cachedAbuseIPs.length === 0) {
    return getStoredOrFallbackBlacklist();
  }
  return cachedAbuseIPs;
}

export async function initAbuseIPDBStream() {
  if (isPollingActive) return;
  isPollingActive = true;

  console.log('Connecting to AbuseIPDB Live Threat Feed (with rate-limit awareness)...');

  // 1. Check local storage cache first (< 6 hours old)
  let records = null;
  try {
    const stored = localStorage.getItem(LOCAL_STORAGE_KEY);
    const storedTime = parseInt(localStorage.getItem(LOCAL_STORAGE_TIME) || '0', 10);
    const age = Date.now() - storedTime;

    if (stored && age < CLIENT_CACHE_TTL) {
      const parsed = JSON.parse(stored);
      if (Array.isArray(parsed) && parsed.length > 0) {
        records = parsed;
        cachedAbuseIPs = parsed;
        console.log(`[AbuseIPDB] Reusing ${parsed.length} local cached records (${Math.round(age / 60000)} min old)`);
      }
    }
  } catch (e) {
    // Ignore storage parse errors
  }

  // 2. If no valid client cache exists, fetch from backend (which has its own 6h server cache & daily counter)
  if (!records || records.length === 0) {
    records = await fetchAbuseIPDBBlacklist(80, 75);
  }

  if (records && records.length > 0) {
    console.log(`[AbuseIPDB] Successfully initialized with ${records.length} threat indicators`);
    
    // Seed records into reactive event store
    records.slice(0, 40).forEach((item, index) => {
      const event = convertAbuseRecordToEvent(item, index * 15000);
      addEvent(event);
    });
  }

  // 3. Continuous Live Real-time Attack Simulator & Stream using real AbuseIPDB records
  startLiveThreatDispatcher();

  // 4. Background refresh ONLY when 6 hours have elapsed (respects 5 requests/day limit)
  // Check every 30 minutes, but only call API if cache is >= 6 hours old
  setInterval(async () => {
    try {
      const storedTime = parseInt(localStorage.getItem(LOCAL_STORAGE_TIME) || '0', 10);
      if (Date.now() - storedTime >= CLIENT_CACHE_TTL) {
        console.log('[AbuseIPDB] 6h cache window expired. Refreshing live blacklist...');
        await fetchAbuseIPDBBlacklist(80, 75);
      }
    } catch (e) {
      console.warn('[AbuseIPDB] Background refresh check failed:', e);
    }
  }, 30 * 60 * 1000);
}

function convertAbuseRecordToEvent(item, ageOffsetMs = 0) {
  const sourceCountry = getCountryByIsoCode(item.countryCode);
  
  // Pick random target location different from source
  let target = ALL_COUNTRIES[Math.floor(Math.random() * ALL_COUNTRIES.length)];
  while (target.code === sourceCountry.code) {
    target = ALL_COUNTRIES[Math.floor(Math.random() * ALL_COUNTRIES.length)];
  }

  const score = item.abuseConfidenceScore || 100;
  let severity = 'critical';
  if (score < 60) severity = 'low';
  else if (score < 80) severity = 'medium';
  else if (score < 95) severity = 'high';

  // Deterministically map attack type based on IP hash
  const hashVal = item.ipAddress.split('.').reduce((acc, oct) => acc + (parseInt(oct, 10) || 0), 0);
  const attackType = ATTACK_CATEGORY_MAP[hashVal % ATTACK_CATEGORY_MAP.length];

  const eventTime = item.lastReportedAt 
    ? new Date(new Date(item.lastReportedAt).getTime() - ageOffsetMs).toISOString()
    : new Date(Date.now() - ageOffsetMs).toISOString();

  return {
    id: 'AIP-' + item.ipAddress.replace(/[^0-9a-zA-Z]/g, '').substring(0, 8),
    attack_type: attackType,
    severity,
    source_country: sourceCountry.name,
    source_code: sourceCountry.code,
    source_ip: item.ipAddress,
    target_country: target.name,
    target_code: target.code,
    target_ip: `198.51.100.${(hashVal % 250) + 1}`,
    source_lat: sourceCountry.lat + (Math.sin(hashVal) * 1.5),
    source_lng: sourceCountry.lng + (Math.cos(hashVal) * 1.5),
    target_lat: target.lat + (Math.random() - 0.5),
    target_lng: target.lng + (Math.random() - 0.5),
    timestamp: eventTime,
    abuseConfidenceScore: score,
    source: 'AbuseIPDB Live Telemetry'
  };
}

function startLiveThreatDispatcher() {
  function dispatchNextLiveAttack() {
    const list = cachedAbuseIPs.length > 0 ? cachedAbuseIPs : FALLBACK_RECORDS;
    if (list.length > 0) {
      const randomIndex = Math.floor(Math.random() * list.length);
      const rawRecord = list[randomIndex];
      
      const liveEvent = convertAbuseRecordToEvent(rawRecord, 0);
      liveEvent.timestamp = new Date().toISOString();

      recordEvent();
      addEvent(liveEvent);
      addThreatEventToGlobe(liveEvent);

      if (liveEvent.severity === 'critical') {
        playCriticalAlert();
      }
    }

    const nextDelay = Math.random() * 1500 + 400;
    setTimeout(dispatchNextLiveAttack, nextDelay);
  }

  dispatchNextLiveAttack();
}
