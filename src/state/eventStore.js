import { ATTACK_TYPES, ATTACK_METADATA } from '../utils/colors.js';
import { ALL_COUNTRIES, getCountryIsoCode } from '../utils/countries.js';
import { CITIES } from '../utils/cities.js';
import { getState } from './appState.js';

let events = [];
const eventListeners = new Set();
let eventsLastSecond = 0;
let secondCounter = 0;
let eventsPerSecond = 0;

function generateSyntheticIP(pfx = '198.51.100') {
  const host = Math.floor(Math.random() * 254) + 1;
  return `${pfx}.${host}`;
}

function getRandomLocation() {
  const pool = Math.random() > 0.5 ? CITIES : ALL_COUNTRIES;
  const loc = pool[Math.floor(Math.random() * pool.length)];
  const rawCountry = loc.country || loc.name;
  const isoCode = getCountryIsoCode(rawCountry);

  return {
    lat: loc.lat + (Math.random() - 0.5) * 1.5,
    lng: loc.lng + (Math.random() - 0.5) * 1.5,
    country: rawCountry,
    countryCode: isoCode
  };
}

function generateSeverityForAttack(attackType) {
  const meta = ATTACK_METADATA[attackType];
  const minSev = meta?.minSeverity || 'low';

  if (minSev === 'critical') return 'critical';
  const rand = Math.random();
  if (minSev === 'high') return rand > 0.3 ? 'high' : 'critical';
  if (minSev === 'medium') {
    if (rand > 0.82) return 'critical';
    if (rand > 0.45) return 'high';
    return 'medium';
  }
  if (rand > 0.92) return 'critical';
  if (rand > 0.7) return 'high';
  if (rand > 0.35) return 'medium';
  return 'low';
}

export function createEvent(timeOffsetMs = 0) {
  const source = getRandomLocation();
  let target = getRandomLocation();
  while (target.countryCode === source.countryCode) {
    target = getRandomLocation();
  }

  const randomType = ATTACK_TYPES[Math.floor(Math.random() * ATTACK_TYPES.length)];
  const severity = generateSeverityForAttack(randomType);
  const eventId = 'EVT-' + Math.random().toString(36).substring(2, 8).toUpperCase();
  const eventTime = new Date(Date.now() - timeOffsetMs).toISOString();

  return {
    id: eventId,
    attack_type: randomType,
    severity: severity,
    source_country: source.country,
    source_code: source.countryCode,
    source_ip: generateSyntheticIP('198.51.100'),
    target_country: target.country,
    target_code: target.countryCode,
    target_ip: generateSyntheticIP('203.0.113'),
    source_lat: source.lat,
    source_lng: source.lng,
    target_lat: target.lat,
    target_lng: target.lng,
    timestamp: eventTime
  };
}

// Seed historical events over the last 24 hours
export function initEventStore() {
  events = [];
  const now = Date.now();
  
  // Distribute ~450 historical events over the last 24 hours
  for (let i = 0; i < 450; i++) {
    // Bias more events in recent hours
    const age = Math.pow(Math.random(), 1.8) * 24 * 60 * 60 * 1000;
    events.push(createEvent(age));
  }

  // Sort chronological (newest first)
  events.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

  // 1-second interval tracker for events/sec calculation
  setInterval(() => {
    eventsPerSecond = secondCounter;
    secondCounter = 0;
  }, 1000);
}

export function getEvents() {
  return events;
}

export function getEventsPerSecond() {
  const { isStreamPaused } = getState();
  return isStreamPaused ? 0 : eventsPerSecond;
}

export function addEvent(event) {
  secondCounter++;
  events.unshift(event);
  if (events.length > 1000) {
    events.pop();
  }

  eventListeners.forEach(listener => {
    try {
      listener(event);
    } catch (e) {
      console.error('Error in event store listener:', e);
    }
  });
}

export function onNewEvent(callback) {
  eventListeners.add(callback);
  return () => eventListeners.delete(callback);
}
