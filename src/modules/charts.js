import Chart from 'chart.js/auto';
import { SEVERITY_COLORS, getSeverityColor, getTypicalSeverity } from '../utils/colors.js';
import { qs, qsa, setText } from '../utils/dom.js';
import { getState, setState, subscribe } from '../state/appState.js';
import { getAnalyticsMetrics } from '../state/selectors.js';
import { onNewEvent } from '../state/eventStore.js';

let attackChart = null;
let volumeChart = null;

export function initChart() {
  initTypeChart();
  initVolumeChart();
  setupWindowToggleControls();

  // Reactive subscription to state changes
  subscribe((state, prevState, updates) => {
    if (updates.analyticsTimeRange || updates.currentView === 'view-analytics') {
      refreshAnalyticsDashboard();
    }
  });

  // Re-render when new events arrive if user is on Analytics view
  onNewEvent(() => {
    const { currentView } = getState();
    if (currentView === 'view-analytics') {
      refreshAnalyticsDashboard();
    }
  });

  refreshAnalyticsDashboard();
}

function setupWindowToggleControls() {
  const btns = qsa('.window-btn');
  btns.forEach(btn => {
    btn.addEventListener('click', (e) => {
      btns.forEach(b => b.classList.remove('active'));
      const targetBtn = e.currentTarget;
      targetBtn.classList.add('active');

      const windowVal = targetBtn.dataset.window || '1h';
      setState({ analyticsTimeRange: windowVal });
    });
  });
}

function initTypeChart() {
  const canvas = qs('#attack-type-chart');
  if (!canvas) return;

  attackChart = new Chart(canvas, {
    type: 'doughnut',
    data: {
      labels: [],
      datasets: [{
        data: [],
        backgroundColor: [],
        borderWidth: 0,
        hoverOffset: 6
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      cutout: '74%',
      plugins: {
        legend: { display: false },
        tooltip: {
          backgroundColor: 'rgba(11, 15, 25, 0.95)',
          titleColor: '#38BDF8',
          bodyColor: '#F8FAFC',
          borderColor: 'rgba(56, 189, 248, 0.3)',
          borderWidth: 1,
          padding: 10,
          displayColors: true
        }
      }
    }
  });
}

function initVolumeChart() {
  const canvas = qs('#volume-chart');
  if (!canvas) return;

  const ctx = canvas.getContext('2d');
  const gradient = ctx.createLinearGradient(0, 0, 0, 220);
  gradient.addColorStop(0, 'rgba(56, 189, 248, 0.35)');
  gradient.addColorStop(1, 'rgba(56, 189, 248, 0.0)');

  volumeChart = new Chart(canvas, {
    type: 'line',
    data: {
      labels: [],
      datasets: [
        {
          label: 'Incident Rate',
          data: [],
          borderColor: '#38BDF8',
          backgroundColor: gradient,
          fill: true,
          tension: 0.32,
          borderWidth: 2,
          pointRadius: 3,
          pointHoverRadius: 6,
          pointBackgroundColor: '#38BDF8',
          pointBorderColor: '#0284C7'
        },
        {
          label: 'Baseline Threshold',
          data: [],
          borderColor: 'rgba(148, 163, 184, 0.35)',
          borderWidth: 1,
          borderDash: [4, 4],
          pointRadius: 0,
          fill: false
        }
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      scales: {
        x: { 
          display: true,
          grid: { color: 'rgba(148, 163, 184, 0.08)' },
          ticks: { color: '#64748B', font: { size: 10, family: 'IBM Plex Mono' } }
        },
        y: { 
          display: true,
          min: 0,
          grid: { color: 'rgba(148, 163, 184, 0.08)' },
          ticks: { color: '#64748B', font: { size: 10, family: 'IBM Plex Mono' } }
        }
      },
      plugins: {
        legend: { display: false },
        tooltip: {
          backgroundColor: 'rgba(11, 15, 25, 0.95)',
          titleColor: '#38BDF8',
          bodyColor: '#F8FAFC',
          borderColor: 'rgba(56, 189, 248, 0.3)',
          borderWidth: 1,
          padding: 12
        }
      }
    }
  });
}

export function refreshAnalyticsDashboard() {
  const { analyticsTimeRange } = getState();
  const metrics = getAnalyticsMetrics(analyticsTimeRange);

  // Sync button active class
  qsa('.window-btn').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.window === analyticsTimeRange);
  });

  // Update volume chart
  if (volumeChart) {
    volumeChart.data.labels = metrics.chartLabels;
    volumeChart.data.datasets[0].data = metrics.chartData;
    volumeChart.data.datasets[1].data = metrics.chartData.map(() => metrics.baselineRate);
    volumeChart.update();
  }

  // Update KPI Metrics
  setText('#today-counter', metrics.totalIncidents.toLocaleString());
  setText('#telemetry-peak-val', `${metrics.peakRate} / min`);
  setText('#telemetry-avg-val', `${metrics.avgRate} / min`);

  // Update Donut Chart
  const attackDataCounts = Object.entries(metrics.attackCounts).map(([type, count]) => ({
    attackType: type,
    count
  }));
  updateDonutChart(attackDataCounts);
}

function updateDonutChart(allDataCounts) {
  if (!attackChart) return;

  const total = allDataCounts.reduce((acc, curr) => acc + curr.count, 0) || 1;
  const sorted = [...allDataCounts].sort((a, b) => b.count - a.count);

  let displayItems = [];
  if (sorted.length > 6) {
    const top6 = sorted.slice(0, 6);
    const otherCount = sorted.slice(6).reduce((sum, item) => sum + item.count, 0);
    displayItems = [
      ...top6,
      { attackType: 'Other', count: otherCount }
    ];
  } else {
    displayItems = sorted;
  }

  const labels = displayItems.map(d => d.attackType);
  const data = displayItems.map(d => d.count);
  
  const palette = [
    '#F97316', '#38BDF8', '#F59E0B', '#E11D48', '#8B5CF6', '#10B981', '#64748B'
  ];
  
  const colors = displayItems.map((_, i) => palette[i % palette.length]);

  attackChart.data.labels = labels;
  attackChart.data.datasets[0].data = data;
  attackChart.data.datasets[0].backgroundColor = colors;
  attackChart.update();

  if (displayItems.length > 0) {
    const dominant = displayItems[0];
    const domPct = Math.round((dominant.count / total) * 100);
    setText('#donut-center-value', dominant.attackType);
    setText('#donut-center-label', `${domPct}% Dominant`);
  }

  renderDonutLegend(displayItems, colors, total);
}

function renderDonutLegend(items, colors, total) {
  const ul = qs('#donut-legend-list');
  if (!ul) return;

  ul.innerHTML = items.map((item, i) => {
    const pct = ((item.count / total) * 100).toFixed(1);
    const typicalSev = getTypicalSeverity(item.attackType);
    const sevColor = getSeverityColor(typicalSev);
    const sevLabel = typicalSev.charAt(0).toUpperCase() + typicalSev.slice(1);

    return `
      <li class="legend-item">
        <div class="legend-label-group">
          <span class="legend-color-dot" style="background-color: ${colors[i]};"></span>
          <span class="legend-name">${item.attackType}</span>
        </div>
        <div class="legend-meta-group">
          <span class="legend-val font-mono">${item.count.toLocaleString()}</span>
          <span class="legend-pct font-mono">${pct}%</span>
          <span class="legend-sev-indicator" style="color: ${sevColor};" title="Typical Severity: ${sevLabel}">
            ● ${sevLabel}
          </span>
        </div>
      </li>
    `;
  }).join('');
}

export function pushVolumeMetric() {
  refreshAnalyticsDashboard();
}
