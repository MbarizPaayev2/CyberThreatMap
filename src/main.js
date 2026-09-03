import { initGlobe } from './modules/globe.js';
import { initRealtime } from './modules/realtimeEvents.js';
import { initStatsPanel } from './modules/statsPanel.js';
import { initFilters } from './modules/filters.js';
import { initChart } from './modules/charts.js';
import { initSound } from './utils/sound.js';
import { initNavigation } from './modules/navigation.js';
import { initLiveFeed } from './modules/liveFeed.js';
import { initThreatIntelPanel } from './modules/threatIntelPanel.js';
import { initCountryDetail } from './modules/countryDetail.js';
import { initAbuseIPDBStream } from './modules/abuseipdbProvider.js';
import { initOTXStream } from './modules/otxProvider.js';
import { initVirusTotalStream } from './modules/virustotalProvider.js';
import { initAbuseChStream } from './modules/abusechProvider.js';
import { initTelemetryTracker } from './utils/telemetryTracker.js';
import { qs, setText } from './utils/dom.js';

// Initialize the live clock
function startClock() {
  const updateClock = () => {
    const now = new Date();
    setText('#live-clock', now.toLocaleTimeString('en-US', { hour12: false }) + ' UTC');
  };
  updateClock();
  setInterval(updateClock, 1000);
}

// App Initialization
document.addEventListener('DOMContentLoaded', async () => {
  console.log("Initializing CyberThreat Map SOC platform with AbuseIPDB, OTX, VirusTotal, and Abuse.ch integration...");
  
  startClock();
  initTelemetryTracker();
  initSound('mute-btn');
  initNavigation((targetTab) => {
    if (targetTab === 'view-map') {
      window.dispatchEvent(new Event('resize'));
    }
  });

  initFilters();
  initChart();
  initStatsPanel();
  initThreatIntelPanel();
  initCountryDetail();
  initLiveFeed();

  // Initialize 3D Globe
  await initGlobe('globe-container');

  // Initialize Realtime Event Engine & Store
  initRealtime();

  // Initialize Real Live Threat Ingestion from AbuseIPDB API
  await initAbuseIPDBStream();

  // Initialize Real Live Threat Ingestion from OTX (AlienVault)
  await initOTXStream();

  // Initialize VirusTotal (on-demand lookup service, 4/min, 500/day limits)
  await initVirusTotalStream();

  // Initialize Abuse.ch Hunting API (false positive list)
  await initAbuseChStream();
});
