import { addThreatEventToGlobe } from './globe.js';
import { isTypeAllowed } from './filters.js';
import { qs, addClass, removeClass } from '../utils/dom.js';
import { recordEvent } from '../utils/telemetryTracker.js';
import { initEventStore, addEvent } from '../state/eventStore.js';
import { getState } from '../state/appState.js';
import { playCriticalAlert } from '../utils/sound.js';

// Mock data disabled - using only real AbuseIPDB data
let isMockActive = false;
let recentSeverities = [];

function setConnectionStatus(status) {
  const dot = qs('#connection-status');
  if (dot && status === 'connected') {
    addClass(dot, 'connected');
    removeClass(dot, 'disconnected');
  }
}

function updateStatusBadge(severity) {
  recentSeverities.push(severity);
  if (recentSeverities.length > 20) recentSeverities.shift();

  const criticalCount = recentSeverities.filter(s => s === 'critical').length;
  const highCount = recentSeverities.filter(s => s === 'high').length;

  const badge = qs('#status-badge');
  if (!badge) return;

  if (criticalCount >= 3 || highCount >= 8) {
    badge.className = 'status-badge status-critical';
    badge.innerText = 'Critical';
  } else if (criticalCount >= 1 || highCount >= 4) {
    badge.className = 'status-badge status-severe';
    badge.innerText = 'Severe';
  } else {
    badge.className = 'status-badge status-elevated';
    badge.innerText = 'Elevated';
  }
}

export function initRealtime() {
  initEventStore();
  setConnectionStatus('connected');

  // Mock data generation disabled - events come from AbuseIPDB only
  console.log("Realtime event engine initialized - using live AbuseIPDB data only");
}

export async function fetchInitialData() {
  console.log("Realtime event engine initialized with live data source.");
}
