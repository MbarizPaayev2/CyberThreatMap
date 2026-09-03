import { qs, qsa, setText } from '../utils/dom.js';
import { getConfidenceColor } from '../utils/colors.js';
import { getState, setState, subscribe } from '../state/appState.js';
import { getFilteredThreatIntel } from '../state/selectors.js';
import { getThreatIntelFeed } from './threatIntelProvider.js';

let expandedRowId = null;

export function initThreatIntelPanel() {
  renderThreatIntelTable();
  setupFilterEventListeners();
  setupViewAllButton();

  subscribe((state, prevState, updates) => {
    if (
      updates.threatIntelTypeFilter !== undefined ||
      updates.threatIntelConfidenceFilter !== undefined ||
      updates.threatIntelSearch !== undefined ||
      updates.currentView === 'view-analytics'
    ) {
      renderThreatIntelTable();
    }
  });
}

function setupFilterEventListeners() {
  const typeFilter = qs('#intel-type-filter');
  if (typeFilter) {
    typeFilter.addEventListener('change', (e) => {
      setState({ threatIntelTypeFilter: e.target.value });
    });
  }

  const confFilter = qs('#intel-confidence-filter');
  if (confFilter) {
    confFilter.addEventListener('change', (e) => {
      setState({ threatIntelConfidenceFilter: e.target.value });
    });
  }

  const searchInput = qs('#intel-search-input');
  if (searchInput) {
    let timeout = null;
    searchInput.addEventListener('input', (e) => {
      clearTimeout(timeout);
      timeout = setTimeout(() => {
        setState({ threatIntelSearch: e.target.value });
      }, 200);
    });
  }
}

function setupViewAllButton() {
  const viewAllBtn = qs('.view-all-intel-btn');
  if (viewAllBtn) {
    viewAllBtn.addEventListener('click', openAllIntelModal);
  }
}

function openAllIntelModal() {
  const modal = qs('#app-data-modal');
  const body = qs('#app-modal-body');
  if (!modal || !body) return;

  setText('#app-modal-title', 'Global Threat Intelligence Indicators (IOCs)');
  setText('#app-modal-sub', 'Complete synchronized threat dataset & campaign telemetry');

  const allIOCs = getThreatIntelFeed();

  body.innerHTML = `
    <table class="modal-data-table font-mono">
      <thead>
        <tr>
          <th>Indicator</th>
          <th>Type</th>
          <th>Threat Actor</th>
          <th>Confidence</th>
          <th>Associated CVE</th>
          <th>Source</th>
          <th style="text-align: right;">Related Hits</th>
        </tr>
      </thead>
      <tbody>
        ${allIOCs.map(ioc => {
          const confColor = getConfidenceColor(ioc.confidence);
          return `
            <tr>
              <td><strong>${ioc.indicator}</strong></td>
              <td><span class="intel-type-badge badge-${ioc.type.toLowerCase()}">${ioc.type}</span></td>
              <td><span class="actor-tag">${ioc.threatActor}</span></td>
              <td><span style="color: ${confColor};">● ${ioc.confidence}</span></td>
              <td>${ioc.associatedCVE}</td>
              <td class="text-muted">${ioc.source}</td>
              <td style="text-align: right; color: #38BDF8;">${ioc.relatedEvents.toLocaleString()}</td>
            </tr>
          `;
        }).join('')}
      </tbody>
    </table>
  `;

  modal.style.display = 'flex';
}

export function renderThreatIntelTable() {
  const tableBody = qs('#threat-intel-tbody');
  if (!tableBody) return;

  const filteredData = getFilteredThreatIntel();

  if (filteredData.length === 0) {
    tableBody.innerHTML = `
      <tr>
        <td colspan="7" class="intel-empty-row font-mono">No threat indicators match the selected criteria.</td>
      </tr>
    `;
    return;
  }

  tableBody.innerHTML = filteredData.map(item => {
    const confColor = getConfidenceColor(item.confidence);
    const isExpanded = expandedRowId === item.id;

    return `
      <tr class="intel-row ${isExpanded ? 'expanded' : ''}" data-id="${item.id}">
        <td class="col-indicator font-mono">
          <span class="expand-chevron">${isExpanded ? '▼' : '▶'}</span>
          <strong>${item.indicator}</strong>
        </td>
        <td>
          <span class="intel-type-badge badge-${item.type.toLowerCase()}">${item.type}</span>
        </td>
        <td class="font-mono col-cve">${item.associatedCVE}</td>
        <td><span class="actor-tag">${item.threatActor}</span></td>
        <td>
          <span class="confidence-pill" style="color: ${confColor}; border-color: ${confColor}40; background-color: ${confColor}15;">
            ● ${item.confidence}
          </span>
        </td>
        <td class="font-mono text-muted col-time">${item.firstSeen}</td>
        <td class="text-muted col-source">${item.source}</td>
      </tr>
      ${isExpanded ? `
        <tr class="intel-detail-row">
          <td colspan="7">
            <div class="intel-expanded-content">
              <div class="expanded-grid">
                <div class="expanded-item">
                  <span class="exp-label">Full Indicator</span>
                  <span class="exp-val font-mono select-all">${item.fullIndicator}</span>
                </div>
                <div class="expanded-item">
                  <span class="exp-label">Related Events</span>
                  <span class="exp-val font-mono">${item.relatedEvents.toLocaleString()} telemetry hits</span>
                </div>
                <div class="expanded-item span-2">
                  <span class="exp-label">MITRE ATT&CK Reference</span>
                  <span class="exp-val font-mono">${item.mitre}</span>
                </div>
              </div>
            </div>
          </td>
        </tr>
      ` : ''}
    `;
  }).join('');

  // Row click listeners to toggle expansion
  const rows = qsa('.intel-row');
  rows.forEach(row => {
    row.addEventListener('click', () => {
      const id = row.dataset.id;
      expandedRowId = expandedRowId === id ? null : id;
      renderThreatIntelTable();
    });
  });
}
