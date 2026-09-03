import { addEvent } from '../state/eventStore.js';
import { addThreatEventToGlobe } from './globe.js';
import { playCriticalAlert } from '../utils/sound.js';
import { recordEvent } from '../utils/telemetryTracker.js';
import { getCountryByIsoCode, ALL_COUNTRIES } from '../utils/countries.js';

let cachedFalsePositives = [];
let isPollingActive = false;

const ATTACK_CATEGORY_MAP = [
  'Port Scan',
  'DDoS',
  'Brute Force',
  'Credential Stuffing',
  'SQL Injection',
  'Malware',
  'Command Injection',
  'DNS Tunneling',
  'Phishing',
  'Ransomware',
  'Trojan',
  'Botnet',
  'C2 Server'
];

export async function fetchFalsePositiveList(format = 'json') {
  try {
    const res = await fetch('/api/abusech', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        query: 'get_fplist',
        format: format
      })
    });
    
    if (!res.ok) {
      if (res.status === 429) {
        console.warn('Abuse.ch daily limit reached. Using cached data if available.');
        return cachedFalsePositives.length > 0 ? cachedFalsePositives : [];
      }
      console.warn('Abuse.ch API endpoint returned status:', res.status);
      return [];
    }
    
    const json = await res.json();
    if (json && json.data) {
      cachedFalsePositives = json.data;
      return json.data;
    }
    return [];
  } catch (err) {
    console.warn('Failed to fetch from Abuse.ch API:', err);
    return cachedFalsePositives.length > 0 ? cachedFalsePositives : [];
  }
}

export async function createCollection(collectionName, description = '', anonymous = 0) {
  try {
    const res = await fetch('/api/abusech', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        query: 'create_collection',
        collection_name: collectionName,
        description: description,
        anonymous: anonymous
      })
    });
    
    if (!res.ok) {
      if (res.status === 429) {
        console.warn('Abuse.ch daily limit reached for collection creation.');
      }
      return null;
    }
    
    const json = await res.json();
    return json.data || null;
  } catch (err) {
    console.warn('Failed to create Abuse.ch collection:', err);
    return null;
  }
}

export function getCachedFalsePositives() {
  return cachedFalsePositives;
}

export async function initAbuseChStream() {
  if (isPollingActive) return;
  isPollingActive = true;

  // 1. Initial live fetch of false positive list
  console.log('Connecting to Abuse.ch Hunting API...');
  const initialFPList = await fetchFalsePositiveList('json');

  if (initialFPList.length > 0) {
    console.log(`Successfully ingested ${initialFPList.length} false positive records from Abuse.ch`);
    
    // Convert false positives to threat events (these are known false positives, so low severity)
    initialFPList.forEach((item, index) => {
      const event = convertAbuseChToEvent(item, index * 20000);
      // Mark as false positive
      event.is_false_positive = true;
      event.severity = 'low';
      addEvent(event);
    });
  }

  // 2. Continuous monitoring using cached data
  startAbuseChThreatDispatcher();

  // 3. Periodic refresh every 10 minutes (respecting Abuse.ch free tier limits)
  // Note: Daily limit is ~49 calls, so this will stop working after ~49 calls until next day
  setInterval(async () => {
    const result = await fetchFalsePositiveList('json');
    if (result.length === 0 && cachedFalsePositives.length === 0) {
      console.warn('Abuse.ch daily limit reached - no new data until tomorrow');
    }
  }, 10 * 60 * 1000);
}

function convertAbuseChToEvent(item, ageOffsetMs = 0) {
  // Extract relevant information from Abuse.ch response
  const indicator = item.indicator || item;
  const indicatorType = item.type || 'IPv4';
  
  // Get country from IP geolocation if available
  let sourceCountry = ALL_COUNTRIES[Math.floor(Math.random() * ALL_COUNTRIES.length)];
  let sourceIP = indicator;
  
  if (indicatorType === 'IPv4' && item.country) {
    sourceCountry = getCountryByIsoCode(item.country);
  } else if (indicatorType === 'domain') {
    sourceIP = '198.51.100.' + Math.floor(Math.random() * 254);
  }
  
  // Pick random target location
  let target = ALL_COUNTRIES[Math.floor(Math.random() * ALL_COUNTRIES.length)];
  while (target.code === sourceCountry.code) {
    target = ALL_COUNTRIES[Math.floor(Math.random() * ALL_COUNTRIES.length)];
  }

  // False positives are low severity by definition
  const severity = 'low';

  // Deterministically map attack type
  const hashVal = indicator.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
  const attackType = ATTACK_CATEGORY_MAP[hashVal % ATTACK_CATEGORY_MAP.length];

  const eventTime = item.last_seen || item.timestamp
    ? new Date(new Date(item.last_seen || item.timestamp).getTime() - ageOffsetMs).toISOString()
    : new Date(Date.now() - ageOffsetMs).toISOString();

  return {
    id: 'ABCH-' + indicator.replace(/[^0-9a-zA-Z]/g, '').substring(0, 8),
    attack_type: attackType,
    severity,
    source_country: sourceCountry.name,
    source_code: sourceCountry.code,
    source_ip: sourceIP,
    target_country: target.name,
    target_code: target.code,
    target_ip: `203.0.113.${(hashVal % 250) + 1}`,
    source_lat: sourceCountry.lat + (Math.sin(hashVal) * 1.5),
    source_lng: sourceCountry.lng + (Math.cos(hashVal) * 1.5),
    target_lat: target.lat + (Math.random() - 0.5),
    target_lng: target.lng + (Math.random() - 0.5),
    timestamp: eventTime,
    indicator: indicator,
    indicator_type: indicatorType,
    tags: item.tags || [],
    source: 'Abuse.ch Hunting API'
  };
}

function startAbuseChThreatDispatcher() {
  function dispatchNextAbuseChThreat() {
    if (cachedFalsePositives.length > 0) {
      // Pick random indicator from Abuse.ch cache
      const randomIndex = Math.floor(Math.random() * cachedFalsePositives.length);
      const rawRecord = cachedFalsePositives[randomIndex];
      
      const liveEvent = convertAbuseChToEvent(rawRecord, 0);
      liveEvent.timestamp = new Date().toISOString();
      liveEvent.is_false_positive = true;
      liveEvent.severity = 'low';

      recordEvent();
      addEvent(liveEvent);
      addThreatEventToGlobe(liveEvent);

      // Don't play alerts for false positives
    }

    const nextDelay = Math.random() * 3000 + 1000;
    setTimeout(dispatchNextAbuseChThreat, nextDelay);
  }

  dispatchNextAbuseChThreat();
}
