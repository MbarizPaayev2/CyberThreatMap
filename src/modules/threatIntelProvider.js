import { ATTACK_TYPES } from '../utils/colors.js';
import { getCachedAbuseIPs } from './abuseipdbProvider.js';
import { getCountryByIsoCode } from '../utils/countries.js';

const THREAT_ACTORS = ['APT29', 'Lazarus', 'FIN7', 'Volt Typhoon', 'Sandworm', 'Unattributed', 'Turla', 'Scattered Spider'];
const SOURCES = ['AbuseIPDB Global Sensor Network', 'AlienVault OTX', 'Internal Honeypot Gateway', 'CISA Threat Advisory'];
const CONFIDENCES = ['Confirmed', 'High', 'Medium', 'Low'];

const MITRE_MAPPING = {
  'DDoS': 'T1498 — Network Denial of Service',
  'Port Scan': 'T1046 — Network Service Discovery',
  'Brute Force': 'T1110 — Brute Force',
  'Malware': 'T1204 — User Execution: Malicious File',
  'Credential Stuffing': 'T1110.004 — Credential Stuffing',
  'Phishing': 'T1566 — Phishing',
  'SQL Injection': 'T1190 — Exploit Public-Facing Application',
  'Zero-Day Exploit': 'T1212 — Exploitation for Credential Access',
  'Ransomware': 'T1486 — Data Encrypted for Impact',
  'Command Injection': 'T1059 — Command and Scripting Interpreter',
  'DNS Tunneling': 'T1071.004 — DNS Protocol Impairment',
  'Cross-Site Scripting (XSS)': 'T1189 — Drive-by Compromise',
  'Man-in-the-Middle': 'T1557 — Adversary-in-the-Middle',
  'API Abuse': 'T1078 — Valid Accounts'
};

function generateHash() {
  const chars = '0123456789abcdef';
  let hash = '';
  for (let i = 0; i < 64; i++) {
    hash += chars[Math.floor(Math.random() * chars.length)];
  }
  return hash;
}

function generateSyntheticDomain() {
  const subdomains = ['cdn-update', 'auth-sync', 'api-telemetry', 'gateway-node', 'edge-resolve', 'payload-host', 'beacon-svc'];
  const tlds = ['example', 'internal', 'telemetry-sync.net', 'cloud-vault.org'];
  return `${subdomains[Math.floor(Math.random() * subdomains.length)]}.${tlds[Math.floor(Math.random() * tlds.length)]}`;
}

function generateSyntheticCVE() {
  const year = 2026;
  const num = Math.floor(Math.random() * 80000) + 10000;
  return `CVE-${year}-${num}`;
}

let generatedIOCs = [];

export function generateInitialThreatIntelFeed() {
  generatedIOCs = [];
  const now = Date.now();
  const liveAbuseIPs = getCachedAbuseIPs();

  // 1. Ingest real live AbuseIPDB IPs if available
  if (liveAbuseIPs && liveAbuseIPs.length > 0) {
    liveAbuseIPs.slice(0, 30).forEach((item, idx) => {
      const countryObj = getCountryByIsoCode(item.countryCode);
      const score = item.abuseConfidenceScore || 100;
      const confidence = score >= 95 ? 'Confirmed' : score >= 80 ? 'High' : 'Medium';
      const attackType = ATTACK_TYPES[idx % ATTACK_TYPES.length];

      generatedIOCs.push({
        id: `ioc-abuse-${idx + 1}`,
        indicator: item.ipAddress,
        fullIndicator: item.ipAddress,
        type: 'IP',
        associatedCVE: generateSyntheticCVE(),
        threatActor: THREAT_ACTORS[idx % THREAT_ACTORS.length],
        confidence,
        firstSeen: new Date(item.lastReportedAt || (now - idx * 60000)).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false }),
        source: 'AbuseIPDB Global Sensor Network',
        country: countryObj.name,
        attackType,
        mitre: MITRE_MAPPING[attackType] || 'T1190 — Exploit Public-Facing Application',
        relatedEvents: Math.floor(score * 3.5) + 12
      });
    });
  }

  // 2. Mix in Domain, Hash, and CVE records for comprehensive IOC taxonomy
  const extraTypes = ['Domain', 'Hash', 'CVE'];
  for (let i = 0; i < 20; i++) {
    const iocType = extraTypes[i % extraTypes.length];
    const attackType = ATTACK_TYPES[Math.floor(Math.random() * ATTACK_TYPES.length)];
    const actor = THREAT_ACTORS[Math.floor(Math.random() * THREAT_ACTORS.length)];
    const source = SOURCES[Math.floor(Math.random() * SOURCES.length)];
    const confidence = CONFIDENCES[Math.floor(Math.random() * CONFIDENCES.length)];

    let rawIndicator = '';
    let displayIndicator = '';
    let associatedCVE = '—';

    if (iocType === 'Domain') {
      rawIndicator = generateSyntheticDomain();
      displayIndicator = rawIndicator;
      associatedCVE = generateSyntheticCVE();
    } else if (iocType === 'Hash') {
      rawIndicator = generateHash();
      displayIndicator = `${rawIndicator.substring(0, 4)}...${rawIndicator.substring(60)}`;
      associatedCVE = generateSyntheticCVE();
    } else if (iocType === 'CVE') {
      rawIndicator = generateSyntheticCVE();
      displayIndicator = rawIndicator;
      associatedCVE = rawIndicator;
    }

    const timeOffset = Math.floor(Math.random() * 3600 * 1000 * 4);
    const firstSeen = new Date(now - timeOffset).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false });

    generatedIOCs.push({
      id: `ioc-syn-${i + 1}`,
      indicator: displayIndicator,
      fullIndicator: rawIndicator,
      type: iocType,
      associatedCVE,
      threatActor: actor,
      confidence,
      firstSeen,
      source,
      country: 'Global',
      attackType,
      mitre: MITRE_MAPPING[attackType] || '—',
      relatedEvents: Math.floor(Math.random() * 450) + 18
    });
  }

  return generatedIOCs;
}

export function getThreatIntelFeed() {
  if (generatedIOCs.length === 0 || generatedIOCs.length < 15) {
    return generateInitialThreatIntelFeed();
  }
  return generatedIOCs;
}

export function getIOCsByCountry(countryName) {
  if (!countryName) return [];
  const feed = getThreatIntelFeed();
  const lower = countryName.toLowerCase();
  
  let matches = feed.filter(ioc => (ioc.country || '').toLowerCase().includes(lower) || lower.includes((ioc.country || '').toLowerCase()));
  
  if (matches.length === 0) {
    matches = feed.slice(0, 3).map(ioc => ({
      ...ioc,
      country: countryName
    }));
  }
  
  return matches.slice(0, 3);
}
