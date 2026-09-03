import { getSeverityColor, getAttackTypeColor, getConfidenceColor } from '../utils/colors.js';
import { qs, qsa, setText } from '../utils/dom.js';
import { getState, setState, resetAllFilters, subscribe } from '../state/appState.js';
import { getFilteredEvents } from '../state/selectors.js';
import { onNewEvent, getEvents, getEventsPerSecond } from '../state/eventStore.js';
import { getIOCsByCountry } from './threatIntelProvider.js';
import { escapeHtml } from '../utils/sanitize.js';

let sparklineHistory = new Array(60).fill(0);
let unseenNewEventsCount = 0;
let isUserScrolledDown = false;
let lastEventTimestamp = Date.now();

const MITRE_LOOKUP = {
  'Zero-Day Exploit': 'T1212 — Exploitation for Credential Access',
  'Ransomware': 'T1486 — Data Encrypted for Impact',
  'Command Injection': 'T1059 — Command and Scripting Interpreter',
  'DDoS': 'T1498 — Network Denial of Service',
  'SQL Injection': 'T1190 — Exploit Public-Facing Application',
  'Man-in-the-Middle': 'T1557 — Adversary-in-the-Middle',
  'Brute Force': 'T1110 — Brute Force',
  'Credential Stuffing': 'T1110.004 — Credential Stuffing',
  'Phishing': 'T1566 — Phishing',
  'Cross-Site Scripting (XSS)': 'T1189 — Drive-by Compromise',
  'API Abuse': 'T1078 — Valid Accounts',
  'DNS Tunneling': 'T1071.004 — DNS Protocol Impairment',
  'Port Scan': 'T1046 — Network Service Discovery',
  'Malware': 'T1204 — User Execution: Malicious File'
};

export function initLiveFeed() {
  setupTerminalControls();
  setupKeyboardShortcuts();
  setupAutoScrollWatcher();

  // Reactive subscription
  subscribe((state, prevState, updates) => {
    if (
      updates.selectedCountry !== undefined ||
      updates.severityFilter !== undefined ||
      updates.attackTypeFilters !== undefined ||
      updates.terminalTimeRange !== undefined ||
      updates.terminalSearchQuery !== undefined
    ) {
      updateFilterControlsUI();
      reRenderFeed();
    }

    if (updates.isStreamPaused !== undefined) {
      updatePauseButtonUI(updates.isStreamPaused);
    }

    if (updates.selectedEvent !== undefined) {
      if (updates.selectedEvent) {
        showInvestigationDrawer(updates.selectedEvent);
      } else {
        hideInvestigationDrawer();
      }
    }
  });

  // New events listener
  onNewEvent((event) => {
    lastEventTimestamp = Date.now();
    const { isStreamPaused } = getState();

    if (isStreamPaused) return;

    const feedList = qs('#live-feed-list');
    if (!feedList) return;

    // Check if event passes active filters
    const matching = getFilteredEvents({ customEvent: event });
    const isMatch = matching.some(e => e.id === event.id);
    if (!isMatch) return;

    if (isUserScrolledDown) {
      unseenNewEventsCount++;
      const jumpBtn = qs('#jump-to-live-btn');
      if (jumpBtn) {
        jumpBtn.style.display = 'flex';
        setText('#jump-live-count', unseenNewEventsCount);
      }
    }

    const row = createFeedRowElement(event, true);
    feedList.insertBefore(row, feedList.firstChild);

    if (feedList.children.length > 70) {
      feedList.removeChild(feedList.lastChild);
    }
  });

  // 1-second interval loop for telemetry strip & sparkline
  setInterval(updateTerminalTelemetry, 1000);

  updateFilterControlsUI();
  reRenderFeed();
}

function setupTerminalControls() {
  // Search Input
  const searchInput = qs('#feed-search-input');
  if (searchInput) {
    let timeout = null;
    searchInput.addEventListener('input', (e) => {
      clearTimeout(timeout);
      timeout = setTimeout(() => {
        setState({ terminalSearchQuery: e.target.value.toLowerCase().trim() });
      }, 200);
    });
  }

  // Severity Segmented Filters
  const sevBtns = qsa('.sev-seg-btn');
  sevBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      const sev = btn.dataset.sev || 'all';
      setState({ severityFilter: sev });
    });
  });

  // Attack Type Dropdown
  const attackSelect = qs('#feed-attack-filter');
  if (attackSelect) {
    attackSelect.addEventListener('change', (e) => {
      const val = e.target.value;
      if (val === 'all') {
        setState({ attackTypeFilters: new Set(Object.keys(MITRE_LOOKUP)) });
      } else {
        setState({ attackTypeFilters: new Set([val]) });
      }
    });
  }

  // Country Dropdown
  const countrySelect = qs('#feed-country-select');
  if (countrySelect) {
    countrySelect.addEventListener('change', (e) => {
      const val = e.target.value;
      setState({ selectedCountry: val === 'all' ? null : val });
    });
  }

  // Time Range Dropdown
  const timeSelect = qs('#feed-time-range');
  if (timeSelect) {
    timeSelect.addEventListener('change', (e) => {
      setState({ terminalTimeRange: e.target.value });
    });
  }

  // Clear All Filters Button
  const clearAllBtn = qs('#clear-all-filters-btn');
  if (clearAllBtn) {
    clearAllBtn.addEventListener('click', () => {
      resetAllFilters();
    });
  }

  // Pause / Resume Stream Button
  const pauseBtn = qs('#terminal-pause-btn');
  if (pauseBtn) {
    pauseBtn.addEventListener('click', toggleFeedPause);
  }

  // Close Investigation Drawer Button
  const closeDrawerBtn = qs('#close-inv-drawer-btn');
  if (closeDrawerBtn) {
    closeDrawerBtn.addEventListener('click', () => {
      setState({ selectedEvent: null });
    });
  }

  // Jump to Live Button
  const jumpBtn = qs('#jump-to-live-btn');
  if (jumpBtn) {
    jumpBtn.addEventListener('click', () => {
      const container = qs('#stream-scroll-container');
      if (container) {
        container.scrollTo({ top: 0, behavior: 'smooth' });
      }
      unseenNewEventsCount = 0;
      jumpBtn.style.display = 'none';
      isUserScrolledDown = false;
    });
  }
}

function setupAutoScrollWatcher() {
  const container = qs('#stream-scroll-container');
  if (!container) return;

  container.addEventListener('scroll', () => {
    if (container.scrollTop > 50) {
      isUserScrolledDown = true;
    } else {
      isUserScrolledDown = false;
      unseenNewEventsCount = 0;
      const jumpBtn = qs('#jump-to-live-btn');
      if (jumpBtn) jumpBtn.style.display = 'none';
    }
  });
}

function setupKeyboardShortcuts() {
  window.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      setState({ selectedEvent: null });
    }
    if (e.key === '/' && document.activeElement?.tagName !== 'INPUT') {
      e.preventDefault();
      const searchInput = qs('#feed-search-input');
      if (searchInput) searchInput.focus();
    }
    if (e.code === 'Space' && document.activeElement?.tagName !== 'INPUT') {
      const terminalView = qs('#view-terminal');
      if (terminalView && terminalView.classList.contains('active')) {
        e.preventDefault();
        toggleFeedPause();
      }
    }
  });
}

export function toggleFeedPause() {
  const { isStreamPaused } = getState();
  setState({ isStreamPaused: !isStreamPaused });
  return !isStreamPaused;
}

function updatePauseButtonUI(isPaused) {
  const btn = qs('#terminal-pause-btn');
  const livePill = qs('#terminal-live-pill');

  if (btn) {
    btn.innerText = isPaused ? 'Resume Stream' : 'Pause Stream';
    btn.classList.toggle('active', isPaused);
  }
  if (livePill) {
    livePill.className = `terminal-live-pill ${isPaused ? 'paused' : 'live'}`;
    const rate = getEventsPerSecond();
    setText('#terminal-rate-text', isPaused ? 'PAUSED' : `LIVE · ${rate} events/sec`);
  }
}

function updateFilterControlsUI() {
  const { selectedCountry, severityFilter, attackTypeFilters, terminalTimeRange, terminalSearchQuery } = getState();

  // Search input
  const searchInput = qs('#feed-search-input');
  if (searchInput && searchInput.value !== terminalSearchQuery) {
    searchInput.value = terminalSearchQuery;
  }

  // Severity segmented buttons
  qsa('.sev-seg-btn').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.sev === severityFilter);
  });

  // Country select
  const countrySelect = qs('#feed-country-select');
  if (countrySelect) {
    countrySelect.value = selectedCountry || 'all';
  }

  // Time range select
  const timeSelect = qs('#feed-time-range');
  if (timeSelect) {
    timeSelect.value = terminalTimeRange;
  }

  // Chips container
  const container = qs('#active-chips-container');
  const clearAllBtn = qs('#clear-all-filters-btn');
  if (!container) return;

  const chips = [];

  if (terminalSearchQuery) {
    chips.push({ type: 'search', label: `Search: "${terminalSearchQuery}"` });
  }
  if (severityFilter !== 'all') {
    chips.push({ type: 'severity', label: `Severity: ${severityFilter.toUpperCase()}` });
  }
  if (attackTypeFilters && attackTypeFilters.size === 1) {
    chips.push({ type: 'attack', label: `Attack: ${Array.from(attackTypeFilters)[0]}` });
  }
  if (selectedCountry) {
    chips.push({ type: 'country', label: `Country: ${selectedCountry.toUpperCase()}` });
  }
  if (terminalTimeRange !== 'live') {
    chips.push({ type: 'time', label: `Time: ${terminalTimeRange}` });
  }

  if (chips.length === 0) {
    container.style.display = 'none';
    if (clearAllBtn) clearAllBtn.style.display = 'none';
    return;
  }

  container.style.display = 'flex';
  if (clearAllBtn) clearAllBtn.style.display = 'inline-block';

  container.innerHTML = chips.map(c => `
    <span class="active-filter-chip">
      <span>${escapeHtml(c.label)}</span>
      <button class="chip-del-btn" data-type="${escapeHtml(c.type)}">✕</button>
    </span>
  `).join('');

  container.querySelectorAll('.chip-del-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      const type = e.currentTarget.dataset.type;
      if (type === 'search') setState({ terminalSearchQuery: '' });
      else if (type === 'severity') setState({ severityFilter: 'all' });
      else if (type === 'attack') setState({ attackTypeFilters: new Set(Object.keys(MITRE_LOOKUP)) });
      else if (type === 'country') setState({ selectedCountry: null, selectedCountryCode: null });
      else if (type === 'time') setState({ terminalTimeRange: 'live' });
    });
  });
}

function createFeedRowElement(event, isNew = false) {
  const sev = (event.severity || 'low').toLowerCase();
  const sevColor = getSeverityColor(sev);
  const attackColor = getAttackTypeColor(event.attack_type);
  const sevLabel = sev.charAt(0).toUpperCase() + sev.slice(1);
  const dateObj = new Date(event.timestamp || Date.now());
  const time = dateObj.toLocaleTimeString('en-US', { hour12: false });
  const isCritical = sev === 'critical';
  const { selectedEvent } = getState();
  const isSelected = selectedEvent && selectedEvent.id === event.id;

  const diffSec = Math.max(0, Math.floor((Date.now() - dateObj.getTime()) / 1000));
  const timeAgoStr = diffSec < 4 ? 'just now' : `${diffSec}s ago`;

  const li = document.createElement('li');
  li.className = `feed-grid-row ${isCritical ? 'sev-critical-row' : ''} ${isSelected ? 'selected-row' : ''} ${isNew ? 'feed-item-anim' : ''}`;
  li.dataset.eventId = event.id;

  li.innerHTML = `
    <span class="feed-col-time font-mono">${escapeHtml(time)}</span>
    <span class="feed-col-code font-mono">${escapeHtml(event.source_code || 'UN')}</span>
    <span class="feed-col-arrow">→</span>
    <span class="feed-col-code font-mono">${escapeHtml(event.target_code || 'UN')}</span>
    <div class="feed-col-badge-wrapper">
      <span class="attack-type-badge font-mono" style="color: ${attackColor}; background-color: ${attackColor}14; border-color: ${attackColor}30;">
        ${escapeHtml(event.attack_type)}
      </span>
    </div>
    <span class="feed-col-sev font-mono" style="color: ${sevColor};">
      <span class="sev-dot" style="background-color: ${sevColor};"></span>
      ${escapeHtml(sevLabel)}
    </span>
    <span class="feed-col-status font-mono">
      <span class="status-indicator"></span>Active
    </span>
    <span class="feed-col-ago font-mono">${escapeHtml(timeAgoStr)}</span>
  `;

  li.addEventListener('click', () => {
    setState({ selectedEvent: event });
  });

  return li;
}

function showInvestigationDrawer(event) {
  qsa('.feed-grid-row').forEach(row => {
    row.classList.toggle('selected-row', row.dataset.eventId === event.id);
  });

  const drawer = qs('#event-investigation-drawer');
  if (drawer) drawer.style.display = 'flex';

  setText('#inv-attack-type', event.attack_type);
  setText('#inv-event-id', event.id || 'EVT-8F21A9');

  const sev = (event.severity || 'low').toLowerCase();
  const sevColor = getSeverityColor(sev);
  const sevLabel = sev.charAt(0).toUpperCase() + sev.slice(1);

  const sevPill = qs('#inv-severity-pill');
  if (sevPill) {
    sevPill.innerText = `● ${sevLabel}`;
    sevPill.style.color = sevColor;
    sevPill.style.borderColor = `${sevColor}40`;
    sevPill.style.backgroundColor = `${sevColor}15`;
  }

  const dateObj = new Date(event.timestamp || Date.now());
  const diffSec = Math.max(0, Math.floor((Date.now() - dateObj.getTime()) / 1000));
  setText('#inv-time-ago', diffSec < 4 ? 'just now' : `${diffSec}s ago`);
  setText('#inv-timestamp', `${dateObj.toISOString().replace('T', ' ').substring(0, 19)} UTC`);

  setText('#inv-src-country', `${event.source_country} (${event.source_code})`);
  setText('#inv-src-ip', event.source_ip || '198.51.100.42');

  setText('#inv-tgt-country', `${event.target_country} (${event.target_code})`);
  setText('#inv-tgt-ip', event.target_ip || '203.0.113.88');

  const mitre = MITRE_LOOKUP[event.attack_type] || 'T1190 — Exploit Public-Facing Application';
  setText('#inv-mitre-ref', mitre);

  const allEvents = getEvents();
  const relatedCount = allEvents.filter(e => e.source_code === event.source_code || e.attack_type === event.attack_type).length;
  setText('#inv-related-text', `${relatedCount} related events observed for this threat vector across active telemetry`);

  const iocsContainer = qs('#inv-iocs-container');
  if (iocsContainer) {
    const iocs = getIOCsByCountry(event.source_country);
    if (!iocs || iocs.length === 0) {
      iocsContainer.innerHTML = `<div class="inv-ioc-empty font-mono">No threat indicators linked to this origin.</div>`;
    } else {
      iocsContainer.innerHTML = iocs.map(ioc => {
        const confColor = getConfidenceColor(ioc.confidence);
        return `
          <div class="inv-ioc-row font-mono">
            <span class="inv-ioc-val" title="${escapeHtml(ioc.fullIndicator)}">${escapeHtml(ioc.indicator)}</span>
            <span class="inv-ioc-type">${escapeHtml(ioc.type)}</span>
            <span class="inv-ioc-conf" style="color: ${confColor};">● ${escapeHtml(ioc.confidence)}</span>
          </div>
        `;
      }).join('');
    }
  }
}

function hideInvestigationDrawer() {
  const drawer = qs('#event-investigation-drawer');
  if (drawer) drawer.style.display = 'none';
  qsa('.feed-grid-row').forEach(row => row.classList.remove('selected-row'));
}

function updateTerminalTelemetry() {
  const eps = getEventsPerSecond();
  sparklineHistory.shift();
  sparklineHistory.push(eps);

  const allEvents = getEvents();
  const critCount = allEvents.filter(e => (e.severity || '').toLowerCase() === 'critical').length;
  const highCount = allEvents.filter(e => (e.severity || '').toLowerCase() === 'high').length;
  const uniqueCountries = new Set(allEvents.map(e => e.source_code || e.source_country));

  setText('#strip-eps-val', `${eps}/s`);
  setText('#strip-crit-val', critCount);
  setText('#strip-high-val', highCount);
  setText('#strip-countries-val', uniqueCountries.size);

  const diffSec = Math.floor((Date.now() - lastEventTimestamp) / 1000);
  setText('#strip-lastevt-val', diffSec <= 1 ? 'just now' : `${diffSec}s ago`);

  const { isStreamPaused } = getState();
  if (!isStreamPaused) {
    setText('#terminal-rate-text', `LIVE · ${eps} events/sec`);
  }

  drawTerminalSparkline();
}

function drawTerminalSparkline() {
  const canvas = qs('#terminal-sparkline-canvas');
  if (!canvas) return;

  const ctx = canvas.getContext('2d');
  const w = canvas.width;
  const h = canvas.height;

  ctx.clearRect(0, 0, w, h);

  const maxVal = Math.max(12, ...sparklineHistory);
  ctx.beginPath();
  ctx.strokeStyle = 'rgba(56, 189, 248, 0.5)';
  ctx.lineWidth = 1.5;

  for (let i = 0; i < sparklineHistory.length; i++) {
    const x = (i / (sparklineHistory.length - 1)) * w;
    const y = h - (sparklineHistory[i] / maxVal) * (h - 2) - 1;
    if (i === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  }
  ctx.stroke();
}

function reRenderFeed() {
  const feedList = qs('#live-feed-list');
  if (!feedList) return;

  feedList.innerHTML = '';
  const filtered = getFilteredEvents().slice(0, 70);

  if (filtered.length === 0) {
    feedList.innerHTML = `
      <li class="terminal-empty-view font-mono">
        <div>No telemetry events match the active filters.</div>
        <div class="empty-sub">Try adjusting search query, severity, or active country.</div>
      </li>
    `;
    return;
  }

  filtered.forEach(ev => {
    const row = createFeedRowElement(ev, false);
    feedList.appendChild(row);
  });
}
