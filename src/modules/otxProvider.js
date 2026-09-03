import { addEvent } from '../state/eventStore.js';
import { addThreatEventToGlobe } from './globe.js';
import { playCriticalAlert } from '../utils/sound.js';
import { recordEvent } from '../utils/telemetryTracker.js';
import { getCountryByIsoCode, ALL_COUNTRIES } from '../utils/countries.js';

let cachedOTXIndicators = [];
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
  'Ransomware'
];

export async function fetchOTXIndicators(type = 'IPv4', limit = 20) {
  try {
    const res = await fetch(`/api/otx?action=indicators&type=${type}&limit=${limit}`);
    if (!res.ok) {
      if (res.status === 429) {
        console.warn('OTX daily limit reached. Using cached data if available.');
        return cachedOTXIndicators.length > 0 ? cachedOTXIndicators : [];
      }
      console.warn('OTX API endpoint returned status:', res.status);
      return [];
    }
    const json = await res.json();
    if (json && Array.isArray(json.data)) {
      cachedOTXIndicators = json.data;
      return json.data;
    }
    return [];
  } catch (err) {
    console.warn('Failed to fetch from OTX API:', err);
    return cachedOTXIndicators.length > 0 ? cachedOTXIndicators : [];
  }
}

export async function fetchOTXPulses(indicator) {
  if (!indicator) return null;
  try {
    const res = await fetch(`/api/otx?action=pulses&indicator=${encodeURIComponent(indicator)}`);
    if (!res.ok) {
      if (res.status === 429) {
        console.warn('OTX daily limit reached for pulses endpoint.');
      }
      return null;
    }
    const json = await res.json();
    return json.data || null;
  } catch (err) {
    console.warn('Failed to fetch OTX pulses:', err);
    return null;
  }
}

export function getCachedOTXIndicators() {
  return cachedOTXIndicators;
}

export async function initOTXStream() {
  if (isPollingActive) return;
  isPollingActive = true;

  // 1. Initial live fetch
  console.log('Connecting to OTX (AlienVault Open Threat Exchange)...');
  const initialIndicators = await fetchOTXIndicators('IPv4', 30);

  if (initialIndicators.length > 0) {
    console.log(`Successfully ingested ${initialIndicators.length} threat indicators from OTX`);
    
    // Seed OTX threats into event store
    initialIndicators.forEach((item, index) => {
      const event = convertOTXIndicatorToEvent(item, index * 20000);
      addEvent(event);
    });
  }

  // 2. Continuous Live Real-time Attack Simulator using OTX records
  startOTXThreatDispatcher();

  // 3. Periodic refresh of indicators every 5 minutes (respecting OTX free tier limits)
  // Note: Daily limit is 29 calls, so this will stop working after 29 calls until next day
  setInterval(async () => {
    const result = await fetchOTXIndicators('IPv4', 30);
    if (result.length === 0 && cachedOTXIndicators.length === 0) {
      console.warn('OTX daily limit reached - no new data until tomorrow');
    }
  }, 5 * 60 * 1000);
}

function convertOTXIndicatorToEvent(item, ageOffsetMs = 0) {
  const indicator = item.indicator || item;
  const indicatorType = item.type || 'IPv4';
  
  // Extract country from indicator if it's an IP
  let sourceCountry = ALL_COUNTRIES[Math.floor(Math.random() * ALL_COUNTRIES.length)];
  let sourceIP = indicator;
  
  if (indicatorType === 'IPv4') {
    // Try to get country from OTX data if available
    if (item.country) {
      sourceCountry = getCountryByIsoCode(item.country);
    }
  } else if (indicatorType === 'domain') {
    sourceIP = '198.51.100.' + Math.floor(Math.random() * 254);
  }
  
  // Pick random target location different from source
  let target = ALL_COUNTRIES[Math.floor(Math.random() * ALL_COUNTRIES.length)];
  while (target.code === sourceCountry.code) {
    target = ALL_COUNTRIES[Math.floor(Math.random() * ALL_COUNTRIES.length)];
  }

  // Determine severity based on OTX reputation or tags
  let severity = 'medium';
  if (item.reputation && item.reputation < 20) severity = 'critical';
  else if (item.reputation && item.reputation < 40) severity = 'high';
  else if (item.reputation && item.reputation < 60) severity = 'medium';
  else severity = 'low';

  // Deterministically map attack type based on indicator hash
  const hashVal = indicator.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
  const attackType = ATTACK_CATEGORY_MAP[hashVal % ATTACK_CATEGORY_MAP.length];

  const eventTime = item.created || item.modified 
    ? new Date(new Date(item.created || item.modified).getTime() - ageOffsetMs).toISOString()
    : new Date(Date.now() - ageOffsetMs).toISOString();

  return {
    id: 'OTX-' + indicator.replace(/[^0-9a-zA-Z]/g, '').substring(0, 8),
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
    reputation: item.reputation || 50,
    source: 'OTX (AlienVault)'
  };
}

function startOTXThreatDispatcher() {
  function dispatchNextOTXAttack() {
    if (cachedOTXIndicators.length > 0) {
      // Pick random indicator from OTX cache
      const randomIndex = Math.floor(Math.random() * cachedOTXIndicators.length);
      const rawRecord = cachedOTXIndicators[randomIndex];
      
      const liveEvent = convertOTXIndicatorToEvent(rawRecord, 0);
      liveEvent.timestamp = new Date().toISOString();

      recordEvent();
      addEvent(liveEvent);
      addThreatEventToGlobe(liveEvent);

      if (liveEvent.severity === 'critical') {
        playCriticalAlert();
      }
    }

    const nextDelay = Math.random() * 2000 + 500;
    setTimeout(dispatchNextOTXAttack, nextDelay);
  }

  dispatchNextOTXAttack();
}
