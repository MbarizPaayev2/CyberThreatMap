import { qs, setText } from '../utils/dom.js';
import { SEVERITY_COLORS, getSeverityColor, getConfidenceColor } from '../utils/colors.js';
import { getIOCsByCountry } from './threatIntelProvider.js';
import { getState, setState, subscribe } from '../state/appState.js';
import { getCountryStats } from '../state/selectors.js';
import { onNewEvent } from '../state/eventStore.js';

const REGION_MAP = {
  'morocco': 'North Africa',
  'libya': 'North Africa',
  'egypt': 'North Africa',
  'algeria': 'North Africa',
  'azerbaijan': 'Caucasus / Caspian',
  'turkey': 'Middle East / Eurasia',
  'georgia': 'Caucasus',
  'armenia': 'Caucasus',
  'russia': 'Eastern Europe / North Asia',
  'united states': 'North America',
  'canada': 'North America',
  'united kingdom': 'Western Europe',
  'germany': 'Western Europe',
  'france': 'Western Europe',
  'italy': 'Southern Europe',
  'china': 'East Asia',
  'japan': 'East Asia',
  'south korea': 'East Asia',
  'india': 'South Asia',
  'brazil': 'South America',
  'australia': 'Oceania'
};

function formatTitleCase(str) {
  if (!str) return '';
  return str.toLowerCase().split(' ').map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' ');
}

function getRegion(countryName) {
  const key = (countryName || '').toLowerCase();
  return REGION_MAP[key] || 'Global Region';
}

export function initCountryDetail() {
  const closeBtn = qs('#close-detail-btn');
  if (closeBtn) {
    closeBtn.addEventListener('click', closeCountryDetailPanel);
  }

  // Reactive subscription to central state
  subscribe((state, prevState, updates) => {
    if (updates.selectedCountry !== undefined) {
      if (updates.selectedCountry) {
        renderDetailPanel(updates.selectedCountry);
      } else {
        const panel = qs('#country-detail-panel');
        if (panel) panel.style.display = 'none';
      }
    }
  });

  // Re-render country drawer on live events if matching
  onNewEvent((event) => {
    const { selectedCountry } = getState();
    if (!selectedCountry) return;

    const lower = selectedCountry.toLowerCase();
    const srcMatch = (event.source_country || '').toLowerCase().includes(lower) || (event.source_code || '').toLowerCase() === lower;
    const tgtMatch = (event.target_country || '').toLowerCase().includes(lower) || (event.target_code || '').toLowerCase() === lower;

    if (srcMatch || tgtMatch) {
      const indicator = qs('#detail-live-status');
      if (indicator) {
        indicator.classList.add('pulse-active');
        setTimeout(() => indicator.classList.remove('pulse-active'), 400);
      }
      renderDetailPanel(selectedCountry);
    }
  });
}

export function openCountryDetailPanel(countryName) {
  if (!countryName) return;
  setState({ selectedCountry: countryName });
}

export function closeCountryDetailPanel() {
  setState({ selectedCountry: null, selectedCountryCode: null });
}

export function getSelectedCountry() {
  return getState().selectedCountry;
}

export function handleCountryEvent(event) {
  // Event Store subscriber handles live updates automatically
}

function renderDetailPanel(countryName) {
  if (!countryName) return;

  const panel = qs('#country-detail-panel');
  if (panel) panel.style.display = 'flex';

  const stats = getCountryStats(countryName);
  if (!stats) return;

  const region = getRegion(countryName);
  setText('#detail-country-name', formatTitleCase(countryName));
  setText('#detail-country-sub', `${region} · ${stats.total} active observations`);

  // 1. Live Activity State
  const liveIndicator = qs('#detail-live-status');
  const activityText = qs('#detail-activity-text');
  if (stats.recentEvents.length > 0) {
    if (liveIndicator) liveIndicator.className = 'live-activity-indicator live';
    if (activityText) activityText.innerText = `● LIVE · ${stats.peak * 6} events/min`;
  } else {
    if (liveIndicator) liveIndicator.className = 'live-activity-indicator idle';
    if (activityText) activityText.innerText = `○ IDLE · No recent activity`;
  }

  // 2. Telemetry Numbers
  setText('#detail-inbound-count', stats.inbound.toLocaleString());
  setText('#detail-outbound-count', stats.outbound.toLocaleString());

  // 3. Analytical Severity Marks
  const totalSev = Object.values(stats.severities).reduce((a, b) => a + b, 0) || 1;
  const sevContainer = qs('#detail-severity-bars');
  const sevOrder = ['critical', 'high', 'medium', 'low'];
  const sevLabels = { critical: 'Critical', high: 'High', medium: 'Medium', low: 'Low' };

  if (sevContainer) {
    sevContainer.innerHTML = sevOrder.map(sev => {
      const count = stats.severities[sev] || 0;
      const pct = Math.round((count / totalSev) * 100);
      const color = SEVERITY_COLORS[sev] || SEVERITY_COLORS.low;
      const label = sevLabels[sev];

      return `
        <div class="sev-matrix-row">
          <span class="sev-matrix-label" style="color: ${color};">${label}</span>
          <div class="sev-matrix-track">
            <div class="sev-matrix-fill" style="width: ${pct}%; background-color: ${color};"></div>
          </div>
          <span class="sev-matrix-count font-mono">${count}</span>
          <span class="sev-matrix-pct font-mono">${pct}%</span>
        </div>
      `;
    }).join('');
  }

  // 4. Top Attack Vectors
  const typesContainer = qs('#detail-attack-types-list');
  if (typesContainer) {
    const totalTypes = Object.values(stats.attackTypes).reduce((a, b) => a + b, 0) || 1;
    const sortedTypes = Object.entries(stats.attackTypes).sort((a, b) => b[1] - a[1]);

    const vectorColors = {
      "DDoS": "#F97316", "Malware": "#38BDF8", "Port Scan": "#F59E0B",
      "Brute Force": "#E11D48", "Phishing": "#8B5CF6", "SQL Injection": "#10B981",
      "Zero-Day Exploit": "#E11D48", "Ransomware": "#E11D48", "Command Injection": "#F97316"
    };

    typesContainer.innerHTML = sortedTypes.slice(0, 5).map(([type, count]) => {
      const pct = Math.round((count / totalTypes) * 100);
      const dotColor = vectorColors[type] || "#38BDF8";

      return `
        <div class="vector-matrix-row">
          <span class="vector-matrix-name">
            <span class="vector-dot" style="background-color: ${dotColor};"></span>
            ${type}
          </span>
          <span class="vector-matrix-count font-mono">${count}</span>
          <span class="vector-matrix-pct font-mono">${pct}%</span>
        </div>
      `;
    }).join('');
  }

  // 5. Recent Activity Log
  const recentContainer = qs('#detail-recent-list');
  if (recentContainer) {
    if (stats.recentEvents.length === 0) {
      recentContainer.innerHTML = `
        <div class="log-empty-state">
          <span class="pulse-waiting-dot"></span>
          <span>Waiting for next event</span>
        </div>
      `;
    } else {
      recentContainer.innerHTML = stats.recentEvents.map(ev => {
        const time = new Date(ev.timestamp || Date.now()).toLocaleTimeString('en-US', { hour12: false });
        const sev = (ev.severity || 'low').toLowerCase();
        const color = getSeverityColor(sev);
        const sevLabel = sev.charAt(0).toUpperCase() + sev.slice(1);

        return `
          <div class="recent-log-row">
            <span class="log-time font-mono">${time}</span>
            <span class="log-type">${ev.attack_type}</span>
            <span class="log-sev font-mono" style="color: ${color};">${sevLabel}</span>
          </div>
        `;
      }).join('');
    }
  }

  // 6. Risk Level / Verdict
  renderRiskVerdict(stats, region);

  // 7. Activity Trend Sparkline
  renderActivityTrend(stats);

  // 8. Related Indicators
  renderRelatedIndicators(countryName);
}

function renderRiskVerdict(stats, region) {
  const critCount = stats.severities.critical || 0;
  const highCount = stats.severities.high || 0;
  const totalSev = stats.total || 1;
  const critHighPct = Math.round(((critCount + highCount) / totalSev) * 100);

  let riskLevel = 'Normal';
  let riskClass = 'risk-normal';
  let contextSentence = `Within nominal baseline for ${region}`;

  if (critHighPct >= 55) {
    riskLevel = 'Critical';
    riskClass = 'risk-critical';
    contextSentence = `Significantly above baseline for ${region} region`;
  } else if (critHighPct >= 35) {
    riskLevel = 'Elevated';
    riskClass = 'risk-elevated';
    contextSentence = `Above baseline for ${region} region`;
  } else if (critHighPct >= 20) {
    riskLevel = 'Low';
    riskClass = 'risk-low';
    contextSentence = `Moderate activity observed in ${region}`;
  }

  const block = qs('#detail-risk-block');
  if (block) block.className = `risk-verdict-block ${riskClass}`;
  setText('#detail-risk-val', riskLevel);
  setText('#detail-risk-context', contextSentence);
}

function renderActivityTrend(stats) {
  const canvas = qs('#country-trend-canvas');
  if (!canvas) return;

  const ctx = canvas.getContext('2d');
  const w = canvas.width;
  const h = canvas.height;

  ctx.clearRect(0, 0, w, h);

  const data = stats.historyBuckets;
  const maxVal = Math.max(10, ...data);

  setText('#country-peak-val', `${stats.peak}/min`);
  setText('#country-avg-val', `${stats.avg}/min`);

  let strokeColor = '#38BDF8';
  let fillGradientColor = 'rgba(56, 189, 248,';

  if ((stats.severities.critical || 0) >= 4) {
    strokeColor = '#E11D48';
    fillGradientColor = 'rgba(225, 29, 72,';
  } else if ((stats.severities.high || 0) >= 6) {
    strokeColor = '#F97316';
    fillGradientColor = 'rgba(249, 115, 22,';
  }

  const grad = ctx.createLinearGradient(0, 0, 0, h);
  grad.addColorStop(0, `${fillGradientColor} 0.25)`);
  grad.addColorStop(1, `${fillGradientColor} 0.0)`);

  ctx.beginPath();
  for (let i = 0; i < data.length; i++) {
    const x = (i / (data.length - 1)) * w;
    const y = h - (data[i] / maxVal) * (h - 8) - 4;
    if (i === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  }

  ctx.lineTo(w, h);
  ctx.lineTo(0, h);
  ctx.closePath();
  ctx.fillStyle = grad;
  ctx.fill();

  ctx.beginPath();
  for (let i = 0; i < data.length; i++) {
    const x = (i / (data.length - 1)) * w;
    const y = h - (data[i] / maxVal) * (h - 8) - 4;
    if (i === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  }
  ctx.strokeStyle = strokeColor;
  ctx.lineWidth = 1.5;
  ctx.stroke();
}

function renderRelatedIndicators(countryName) {
  const container = qs('#detail-ioc-list');
  if (!container) return;

  const iocs = getIOCsByCountry(countryName);

  if (!iocs || iocs.length === 0) {
    container.innerHTML = `<div class="ioc-empty-state font-mono">No indicators linked to this region</div>`;
    return;
  }

  container.innerHTML = iocs.map(ioc => {
    const confColor = getConfidenceColor(ioc.confidence);
    return `
      <div class="related-ioc-row">
        <span class="related-ioc-val font-mono" title="${ioc.fullIndicator}">${ioc.indicator}</span>
        <span class="related-ioc-type font-mono">${ioc.type}</span>
        <span class="related-ioc-conf font-mono" style="color: ${confColor};">● ${ioc.confidence}</span>
      </div>
    `;
  }).join('');
}
