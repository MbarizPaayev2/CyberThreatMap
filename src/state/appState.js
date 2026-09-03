// Central in-memory reactive application state
import { ATTACK_TYPES } from '../utils/colors.js';

const listeners = new Set();

const initialState = {
  currentView: 'view-map', // 'view-map' | 'view-analytics' | 'view-terminal'
  selectedCountry: null, // Country name (e.g. 'China', 'Morocco') or null
  selectedCountryCode: null, // ISO 2-letter code (e.g. 'CN', 'MA') or null
  severityFilter: 'all', // 'all' | 'critical' | 'high' | 'medium' | 'low'
  attackTypeFilters: new Set(ATTACK_TYPES), // Set of active attack types
  analyticsTimeRange: '30m', // '30m' | '1h' | '6h'
  terminalTimeRange: 'live', // 'live' | '5m' | '15m' | '1h' | '6h' | '24h'
  terminalSearchQuery: '',
  threatIntelTypeFilter: 'All', // 'All' | 'IP' | 'Domain' | 'Hash' | 'CVE'
  threatIntelConfidenceFilter: 'All', // 'All' | 'Confirmed' | 'High' | 'Medium' | 'Low'
  threatIntelSearch: '',
  isStreamPaused: false,
  isMuted: false, // In-memory only! No localStorage
  selectedEvent: null, // Full event object or null
  expandedThreatIntelRows: new Set(),
  activeModal: null // 'all-countries-origin' | 'all-countries-target' | 'all-intel' | null
};

let state = { ...initialState };

export function getState() {
  return state;
}

export function setState(updates) {
  const prevState = { ...state };
  state = { ...state, ...updates };
  notify(state, prevState, updates);
}

export function subscribe(callback) {
  listeners.add(callback);
  return () => listeners.delete(callback);
}

function notify(newState, prevState, changedKeys) {
  listeners.forEach(cb => {
    try {
      cb(newState, prevState, changedKeys);
    } catch (e) {
      console.error('State listener error:', e);
    }
  });
}

export function resetAllFilters() {
  setState({
    selectedCountry: null,
    selectedCountryCode: null,
    severityFilter: 'all',
    attackTypeFilters: new Set(ATTACK_TYPES),
    terminalSearchQuery: '',
    threatIntelTypeFilter: 'All',
    threatIntelConfidenceFilter: 'All',
    threatIntelSearch: '',
    selectedEvent: null
  });
}
