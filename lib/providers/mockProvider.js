import ThreatDataProvider from './threatDataProvider.js';
import countryCoords from '../data/countryCoords.js';

const ATTACK_TYPES = [
  { type: "DDoS", weight: 30 },
  { type: "Malware", weight: 20 },
  { type: "Phishing", weight: 15 },
  { type: "Brute Force", weight: 15 },
  { type: "SQL Injection", weight: 10 },
  { type: "Port Scan", weight: 10 }
];

const SEVERITIES = [
  { level: "low", weight: 40 },
  { level: "medium", weight: 40 },
  { level: "high", weight: 15 },
  { level: "critical", weight: 5 }
];

/**
 * Utility to pick randomly based on weight.
 */
function pickWeighted(items) {
  const totalWeight = items.reduce((acc, i) => acc + i.weight, 0);
  let rand = Math.random() * totalWeight;
  for (const item of items) {
    if (rand < item.weight) return item;
    rand -= item.weight;
  }
  return items[0];
}

function getRandomIP() {
  const getRandomByte = () => Math.floor(Math.random() * 255) + 1;
  return `${getRandomByte()}.${getRandomByte()}.${getRandomByte()}.${getRandomByte()}`;
}

class MockProvider extends ThreatDataProvider {
  async generateEvent() {
    // Pick distinct source and target
    const sourceIdx = Math.floor(Math.random() * countryCoords.length);
    let targetIdx = Math.floor(Math.random() * countryCoords.length);
    while (targetIdx === sourceIdx) {
      targetIdx = Math.floor(Math.random() * countryCoords.length);
    }
    const source = countryCoords[sourceIdx];
    const target = countryCoords[targetIdx];

    // Some jitter so the arc origins aren't exactly identical for the same country
    const jitter = () => (Math.random() - 0.5) * 4;

    return {
      source_ip: getRandomIP(),
      source_country: source.code,
      source_lat: source.lat + jitter(),
      source_lng: source.lng + jitter(),
      target_country: target.code,
      target_lat: target.lat + jitter(),
      target_lng: target.lng + jitter(),
      attack_type: pickWeighted(ATTACK_TYPES).type,
      severity: pickWeighted(SEVERITIES).level
    };
  }
}

export default MockProvider;
