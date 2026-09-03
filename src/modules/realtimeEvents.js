import { addThreatEventToGlobe } from './globe.js';
import { isTypeAllowed } from './filters.js';
import { qs, addClass, removeClass } from '../utils/dom.js';
import { recordEvent } from '../utils/telemetryTracker.js';
import { initEventStore, createEvent, addEvent } from '../state/eventStore.js';
import { getState } from '../state/appState.js';
import { playCriticalAlert } from '../utils/sound.js';

let isMockActive = true;
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

  function triggerAttackBurst() {
    if (!isMockActive) return;

    const { isStreamPaused } = getState();

    if (!isStreamPaused) {
      const isBurst = Math.random() > 0.75;
      const numAttacks = isBurst ? Math.floor(Math.random() * 3) + 2 : 1;

      for (let i = 0; i < numAttacks; i++) {
        const event = createEvent();

        if (isTypeAllowed(event.attack_type)) {
          recordEvent();
          addEvent(event);
          updateStatusBadge(event.severity);
          addThreatEventToGlobe(event);

          if (event.severity === 'critical') {
            playCriticalAlert();
          }
        }
      }
    }

    const nextDelay = Math.random() * 1800 + 300;
    setTimeout(triggerAttackBurst, nextDelay);
  }

  triggerAttackBurst();
}

export async function fetchInitialData() {
  console.log("Realtime event engine initialized with single source of truth.");
}
