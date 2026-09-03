import { qs, qsa, setText } from '../utils/dom.js';
import { getState, setState, subscribe } from '../state/appState.js';
import { getAnalyticsMetrics, getAllCountryRankings } from '../state/selectors.js';
import { onNewEvent } from '../state/eventStore.js';

const COUNTRY_REGISTRY = {
  "China": { code: "CN", flag: "🇨🇳", dominant: "DDoS", color: "#F97316" },
  "Russia": { code: "RU", flag: "🇷🇺", dominant: "Malware", color: "#38BDF8" },
  "United States": { code: "US", flag: "🇺🇸", dominant: "Port Scan", color: "#F59E0B" },
  "Azerbaijan": { code: "AZ", flag: "🇦🇿", dominant: "DDoS", color: "#F97316" },
  "Brazil": { code: "BR", flag: "🇧🇷", dominant: "Brute Force", color: "#E11D48" },
  "Germany": { code: "DE", flag: "🇩🇪", dominant: "Malware", color: "#38BDF8" },
  "United Kingdom": { code: "GB", flag: "🇬🇧", dominant: "Port Scan", color: "#F59E0B" },
  "France": { code: "FR", flag: "🇫🇷", dominant: "Phishing", color: "#8B5CF6" },
  "Japan": { code: "JP", flag: "🇯🇵", dominant: "SQL Injection", color: "#10B981" },
  "Morocco": { code: "MA", flag: "🇲🇦", dominant: "DDoS", color: "#F97316" },
  "Libya": { code: "LY", flag: "🇱🇾", dominant: "Malware", color: "#38BDF8" },
  "Romania": { code: "RO", flag: "🇷🇴", dominant: "Ransomware", color: "#E11D48" }
};

export function initStatsPanel() {
  setupViewAllButtons();
  setupModalControls();

  // Reactive subscription to state changes
  subscribe((state, prevState, updates) => {
    if (updates.analyticsTimeRange || updates.currentView === 'view-analytics') {
      renderTopVectors();
    }
  });

  onNewEvent(() => {
    const { currentView } = getState();
    if (currentView === 'view-analytics') {
      renderTopVectors();
    }
  });

  renderTopVectors();
}

function renderTopVectors() {
  const { analyticsTimeRange } = getState();
  const metrics = getAnalyticsMetrics(analyticsTimeRange);

  renderVectorList('#top-sources-list', metrics.topOrigins);
  renderVectorList('#top-targets-list', metrics.topTargets);
}

function renderVectorList(ulId, data) {
  const ul = qs(ulId);
  if (!ul) return;
  
  const maxCount = Math.max(...data.map(d => d.count), 1);

  if (data.length === 0) {
    ul.innerHTML = `<li class="vector-empty-state font-mono">No activity recorded for this timeframe</li>`;
    return;
  }

  ul.innerHTML = data.map((item, idx) => {
    const meta = COUNTRY_REGISTRY[item.country] || { code: item.country.substring(0, 2).toUpperCase(), flag: "🌐", dominant: "DDoS", color: "#38BDF8" };
    const pct = Math.round((item.count / maxCount) * 100);
    const trend = (idx % 2 === 0 ? 1 : -1) * (Math.abs(Math.round((item.count % 17) + 3)));
    const isUp = trend >= 0;
    const trendText = isUp ? `▲ ${trend}%` : `▼ ${Math.abs(trend)}%`;
    const trendClass = isUp ? 'trend-danger' : 'trend-safe';

    return `
      <li class="vector-item" data-country="${item.country}" title="Click to inspect ${item.country} on Globe">
        <div class="vector-bar-fill" style="width: ${pct}%; background: linear-gradient(90deg, ${meta.color}22 0%, ${meta.color}55 100%); border-right: 2px solid ${meta.color};"></div>
        <div class="vector-content">
          <div class="vector-identity">
            <span class="country-flag">${meta.flag}</span>
            <span class="vector-name">${item.country}</span>
            <span class="country-code font-mono">${meta.code}</span>
          </div>
          <div class="vector-stat-block font-mono">
            <span class="vector-val">${item.count.toLocaleString()}</span>
            <span class="vector-trend ${trendClass}">${trendText}</span>
          </div>
        </div>
      </li>
    `;
  }).join('');

  // Interactive click listeners
  ul.querySelectorAll('.vector-item').forEach(li => {
    li.addEventListener('click', () => {
      const country = li.dataset.country;
      if (!country) return;
      setState({ selectedCountry: country, currentView: 'view-map' });
    });
  });
}

function setupViewAllButtons() {
  const viewAllBtns = qsa('.view-all-link-btn');
  viewAllBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      openAllCountriesModal();
    });
  });
}

function setupModalControls() {
  const modal = qs('#app-data-modal');
  const closeBtn = qs('#app-modal-close-btn');

  if (closeBtn) {
    closeBtn.addEventListener('click', closeModal);
  }

  if (modal) {
    modal.addEventListener('click', (e) => {
      if (e.target === modal) closeModal();
    });
  }

  window.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && modal && modal.style.display !== 'none') {
      closeModal();
    }
  });
}

export function openAllCountriesModal() {
  const modal = qs('#app-data-modal');
  const body = qs('#app-modal-body');
  if (!modal || !body) return;

  setText('#app-modal-title', 'Global Country Threat Rankings');
  setText('#app-modal-sub', 'Derived from live security event telemetry (Click any row to inspect)');

  const rankings = getAllCountryRankings();

  body.innerHTML = `
    <table class="modal-data-table font-mono">
      <thead>
        <tr>
          <th>Country</th>
          <th>Code</th>
          <th>Inbound</th>
          <th>Outbound</th>
          <th>Critical</th>
          <th>High</th>
          <th style="text-align: right;">Total Events</th>
        </tr>
      </thead>
      <tbody>
        ${rankings.map(c => `
          <tr class="modal-country-row" data-country="${c.country}">
            <td><strong>${c.country}</strong></td>
            <td><span class="modal-code">${c.code || 'UN'}</span></td>
            <td>${c.inbound}</td>
            <td>${c.outbound}</td>
            <td style="color: #E11D48;">${c.critical}</td>
            <td style="color: #F97316;">${c.high}</td>
            <td style="text-align: right; font-weight: 700; color: #38BDF8;">${c.total}</td>
          </tr>
        `).join('')}
      </tbody>
    </table>
  `;

  body.querySelectorAll('.modal-country-row').forEach(row => {
    row.addEventListener('click', () => {
      const country = row.dataset.country;
      closeModal();
      setState({ selectedCountry: country, currentView: 'view-map' });
    });
  });

  modal.style.display = 'flex';
}

export function closeModal() {
  const modal = qs('#app-data-modal');
  if (modal) modal.style.display = 'none';
}

export function incrementTodayCounter() {
  // Realtime counters are now continuously derived from eventStore
}
