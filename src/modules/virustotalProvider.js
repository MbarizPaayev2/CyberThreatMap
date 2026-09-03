import { addEvent } from '../state/eventStore.js';
import { addThreatEventToGlobe } from './globe.js';
import { playCriticalAlert } from '../utils/sound.js';
import { recordEvent } from '../utils/telemetryTracker.js';
import { getCountryByIsoCode, ALL_COUNTRIES } from '../utils/countries.js';

let cachedVTData = [];
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
  'Botnet'
];

export async function checkVirusTotal(resource, type = 'ip') {
  try {
    const res = await fetch(`/api/virustotal?action=${type}&resource=${encodeURIComponent(resource)}`);
    if (!res.ok) {
      if (res.status === 429) {
        console.warn('VirusTotal rate limit or daily limit reached.');
        return null;
      }
      console.warn('VirusTotal API endpoint returned status:', res.status);
      return null;
    }
    const json = await res.json();
    return json.data || null;
  } catch (err) {
    console.warn('Failed to fetch from VirusTotal API:', err);
    return null;
  }
}

export function getCachedVTData() {
  return cachedVTData;
}

export async function initVirusTotalStream() {
  if (isPollingActive) return;
  isPollingActive = true;

  console.log('Connecting to VirusTotal API...');
  
  // Note: VirusTotal has strict limits (4/min, 500/day)
  // We'll do periodic checks rather than continuous polling
  // This is more of an on-demand lookup service
  
  // Periodic check every 15 minutes (4 checks per hour = 96 per day, well under 500 limit)
  setInterval(async () => {
    // We'll check a sample of IPs from AbuseIPDB or OTX
    // This is a placeholder for future enhancement
    console.log('VirusTotal periodic check skipped - use on-demand lookups instead');
  }, 15 * 60 * 1000);
}

function convertVTToEvent(vtData, resource, type) {
  // Extract relevant information from VirusTotal response
  const attributes = vtData.attributes || {};
  
  // Determine severity based on VirusTotal stats
  let severity = 'medium';
  const stats = attributes.last_analysis_stats || {};
  const malicious = stats.malicious || 0;
  const suspicious = stats.suspicious || 0;
  const total = stats.harmless + stats.malicious + stats.suspicious + stats.undetected || 1;
  
  const threatScore = (malicious + suspicious) / total;
  if (threatScore > 0.7) severity = 'critical';
  else if (threatScore > 0.4) severity = 'high';
  else if (threatScore > 0.1) severity = 'medium';
  else severity = 'low';

  // Get country from IP geolocation if available
  let sourceCountry = ALL_COUNTRIES[Math.floor(Math.random() * ALL_COUNTRIES.length)];
  let sourceIP = resource;
  
  if (type === 'ip' && attributes.country) {
    sourceCountry = getCountryByIsoCode(attributes.country);
  } else if (type === 'domain') {
    sourceIP = '198.51.100.' + Math.floor(Math.random() * 254);
  }
  
  // Pick random target location
  let target = ALL_COUNTRIES[Math.floor(Math.random() * ALL_COUNTRIES.length)];
  while (target.code === sourceCountry.code) {
    target = ALL_COUNTRIES[Math.floor(Math.random() * ALL_COUNTRIES.length)];
  }

  // Deterministically map attack type
  const hashVal = resource.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
  const attackType = ATTACK_CATEGORY_MAP[hashVal % ATTACK_CATEGORY_MAP.length];

  return {
    id: 'VT-' + resource.replace(/[^0-9a-zA-Z]/g, '').substring(0, 8),
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
    timestamp: new Date().toISOString(),
    resource: resource,
    resource_type: type,
    vt_stats: stats,
    vt_reputation: attributes.reputation || 0,
    source: 'VirusTotal'
  };
}

// On-demand lookup function for specific resources
export async function lookupResource(resource, type = 'ip') {
  const vtData = await checkVirusTotal(resource, type);
  if (vtData) {
    const event = convertVTToEvent(vtData, resource, type);
    recordEvent();
    addEvent(event);
    addThreatEventToGlobe(event);
    
    if (event.severity === 'critical') {
      playCriticalAlert();
    }
    
    return event;
  }
  return null;
}
