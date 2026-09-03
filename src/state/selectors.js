import { getEvents } from './eventStore.js';
import { getState } from './appState.js';
import { getThreatIntelFeed } from '../modules/threatIntelProvider.js';
import { ATTACK_TYPES } from '../utils/colors.js';

export function getFilteredEvents(customFilters = {}) {
  const state = getState();
  const allEvents = getEvents();

  const country = customFilters.country !== undefined ? customFilters.country : state.selectedCountry;
  const countryCode = customFilters.countryCode !== undefined ? customFilters.countryCode : state.selectedCountryCode;
  const severity = customFilters.severity || state.severityFilter;
  const attackTypes = customFilters.attackTypes || state.attackTypeFilters;
  const timeRange = customFilters.timeRange || state.terminalTimeRange;
  const search = customFilters.search !== undefined ? customFilters.search : state.terminalSearchQuery;

  const now = Date.now();

  return allEvents.filter(event => {
    // 1. Country Filter
    if (country) {
      const cLower = country.toLowerCase();
      const codeLower = (countryCode || '').toLowerCase();
      const srcMatch = (event.source_country || '').toLowerCase().includes(cLower) ||
                       (event.source_code || '').toLowerCase() === codeLower ||
                       (event.source_code || '').toLowerCase() === cLower;
      const tgtMatch = (event.target_country || '').toLowerCase().includes(cLower) ||
                       (event.target_code || '').toLowerCase() === codeLower ||
                       (event.target_code || '').toLowerCase() === cLower;
      if (!srcMatch && !tgtMatch) return false;
    }

    // 2. Severity Filter
    if (severity && severity !== 'all') {
      if ((event.severity || '').toLowerCase() !== severity.toLowerCase()) return false;
    }

    // 3. Attack Types Filter
    if (attackTypes && attackTypes.size > 0) {
      if (!attackTypes.has(event.attack_type)) return false;
    }

    // 4. Time Range Filter
    if (timeRange && timeRange !== 'live') {
      const eventTime = new Date(event.timestamp).getTime();
      const diffMin = (now - eventTime) / 60000;
      if (timeRange === '5m' && diffMin > 5) return false;
      if (timeRange === '15m' && diffMin > 15) return false;
      if (timeRange === '30m' && diffMin > 30) return false;
      if (timeRange === '1h' && diffMin > 60) return false;
      if (timeRange === '6h' && diffMin > 360) return false;
      if (timeRange === '24h' && diffMin > 1440) return false;
    }

    // 5. Search Query
    if (search && search.trim()) {
      const s = search.toLowerCase().trim();
      const matchString = `${event.id || ''} ${event.source_code} ${event.target_code} ${event.source_ip || ''} ${event.target_ip || ''} ${event.source_country} ${event.target_country} ${event.attack_type}`.toLowerCase();
      if (!matchString.includes(s)) return false;
    }

    return true;
  });
}

export function getCountryStats(countryName) {
  if (!countryName) return null;
  const allEvents = getEvents();
  const lower = countryName.toLowerCase();

  let inbound = 0;
  let outbound = 0;
  const severities = { critical: 0, high: 0, medium: 0, low: 0 };
  const attackTypes = {};
  const recentEvents = [];

  allEvents.forEach(event => {
    const srcMatch = (event.source_country || '').toLowerCase().includes(lower) ||
                     (event.source_code || '').toLowerCase() === lower;
    const tgtMatch = (event.target_country || '').toLowerCase().includes(lower) ||
                     (event.target_code || '').toLowerCase() === lower;

    if (srcMatch || tgtMatch) {
      if (tgtMatch) inbound++;
      if (srcMatch) outbound++;

      const sev = (event.severity || 'low').toLowerCase();
      if (severities[sev] !== undefined) severities[sev]++;

      attackTypes[event.attack_type] = (attackTypes[event.attack_type] || 0) + 1;

      if (recentEvents.length < 5) {
        recentEvents.push(event);
      }
    }
  });

  // Calculate 12 discrete 5-minute buckets for the last 60 minutes
  const buckets = new Array(12).fill(0);
  const now = Date.now();
  allEvents.forEach(event => {
    const srcMatch = (event.source_country || '').toLowerCase().includes(lower) ||
                     (event.source_code || '').toLowerCase() === lower;
    const tgtMatch = (event.target_country || '').toLowerCase().includes(lower) ||
                     (event.target_code || '').toLowerCase() === lower;

    if (srcMatch || tgtMatch) {
      const ageMin = (now - new Date(event.timestamp).getTime()) / 60000;
      if (ageMin <= 60) {
        const bucketIdx = Math.min(11, Math.max(0, 11 - Math.floor(ageMin / 5)));
        buckets[bucketIdx]++;
      }
    }
  });

  const peak = Math.max(1, ...buckets);
  const avg = Math.round(buckets.reduce((a, b) => a + b, 0) / buckets.length);

  return {
    inbound,
    outbound,
    total: inbound + outbound,
    severities,
    attackTypes,
    recentEvents,
    historyBuckets: buckets,
    peak,
    avg
  };
}

export function getAnalyticsMetrics(timeRangeStr = '30m') {
  const allEvents = getEvents();
  const now = Date.now();
  let maxMinutes = 30;
  let numBuckets = 15;

  if (timeRangeStr === '1h') {
    maxMinutes = 60;
    numBuckets = 20;
  } else if (timeRangeStr === '6h') {
    maxMinutes = 360;
    numBuckets = 24;
  }

  const eventsInRange = allEvents.filter(e => {
    const diffMin = (now - new Date(e.timestamp).getTime()) / 60000;
    return diffMin <= maxMinutes;
  });

  const totalIncidents = eventsInRange.length;

  // Bucketing for Volume Rate Chart
  const bucketDurationMin = maxMinutes / numBuckets;
  const volumeBuckets = new Array(numBuckets).fill(0);
  const bucketLabels = [];

  for (let i = 0; i < numBuckets; i++) {
    const timeForBucket = new Date(now - (numBuckets - 1 - i) * bucketDurationMin * 60000);
    const hours = String(timeForBucket.getHours()).padStart(2, '0');
    const mins = String(timeForBucket.getMinutes()).padStart(2, '0');
    bucketLabels.push(`${hours}:${mins}`);
  }

  eventsInRange.forEach(e => {
    const ageMin = (now - new Date(e.timestamp).getTime()) / 60000;
    const bucketIdx = Math.min(numBuckets - 1, Math.max(0, numBuckets - 1 - Math.floor(ageMin / bucketDurationMin)));
    volumeBuckets[bucketIdx]++;
  });

  const ratesPerMin = volumeBuckets.map(b => Math.round((b / bucketDurationMin) * 60));
  const peakRate = Math.max(12, ...ratesPerMin);
  const avgRate = Math.round(ratesPerMin.reduce((a, b) => a + b, 0) / ratesPerMin.length);
  const baselineRate = Math.round(avgRate * 0.78);

  // Attack Type Distribution
  const attackCounts = {};
  ATTACK_TYPES.forEach(t => { attackCounts[t] = 0; });
  eventsInRange.forEach(e => {
    attackCounts[e.attack_type] = (attackCounts[e.attack_type] || 0) + 1;
  });

  // Top Origin and Target Countries
  const originCounts = {};
  const targetCounts = {};

  eventsInRange.forEach(e => {
    const orig = e.source_country;
    const targ = e.target_country;
    if (orig) originCounts[orig] = (originCounts[orig] || 0) + 1;
    if (targ) targetCounts[targ] = (targetCounts[targ] || 0) + 1;
  });

  const topOrigins = Object.entries(originCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([country, count]) => ({
      country,
      count,
      pct: totalIncidents > 0 ? Math.round((count / totalIncidents) * 100) : 0
    }));

  const topTargets = Object.entries(targetCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([country, count]) => ({
      country,
      count,
      pct: totalIncidents > 0 ? Math.round((count / totalIncidents) * 100) : 0
    }));

  return {
    timeRangeStr,
    totalIncidents,
    peakRate,
    avgRate,
    baselineRate,
    chartLabels: bucketLabels,
    chartData: volumeBuckets,
    attackCounts,
    topOrigins,
    topTargets
  };
}

export function getAllCountryRankings() {
  const allEvents = getEvents();
  const countryMap = {};

  allEvents.forEach(e => {
    const src = e.source_country;
    const tgt = e.target_country;

    if (src) {
      if (!countryMap[src]) {
        countryMap[src] = { country: src, code: e.source_code, inbound: 0, outbound: 0, critical: 0, high: 0, total: 0 };
      }
      countryMap[src].outbound++;
      countryMap[src].total++;
      if (e.severity === 'critical') countryMap[src].critical++;
      if (e.severity === 'high') countryMap[src].high++;
    }

    if (tgt) {
      if (!countryMap[tgt]) {
        countryMap[tgt] = { country: tgt, code: e.target_code, inbound: 0, outbound: 0, critical: 0, high: 0, total: 0 };
      }
      countryMap[tgt].inbound++;
      countryMap[tgt].total++;
      if (e.severity === 'critical') countryMap[tgt].critical++;
      if (e.severity === 'high') countryMap[tgt].high++;
    }
  });

  return Object.values(countryMap).sort((a, b) => b.total - a.total);
}

export function getFilteredThreatIntel() {
  const { threatIntelTypeFilter, threatIntelConfidenceFilter, threatIntelSearch } = getState();
  const allIOCs = getThreatIntelFeed();

  return allIOCs.filter(ioc => {
    if (threatIntelTypeFilter && threatIntelTypeFilter !== 'All') {
      if (ioc.type !== threatIntelTypeFilter) return false;
    }
    if (threatIntelConfidenceFilter && threatIntelConfidenceFilter !== 'All') {
      if (ioc.confidence !== threatIntelConfidenceFilter) return false;
    }
    if (threatIntelSearch && threatIntelSearch.trim()) {
      const q = threatIntelSearch.toLowerCase().trim();
      const matchTarget = `${ioc.indicator} ${ioc.fullIndicator} ${ioc.associatedCVE} ${ioc.threatActor} ${ioc.source} ${ioc.country || ''}`.toLowerCase();
      if (!matchTarget.includes(q)) return false;
    }
    return true;
  });
}
