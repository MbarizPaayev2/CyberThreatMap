import { getState } from './appState.js';

let events = [];
const eventListeners = new Set();
let eventsLastSecond = 0;
let secondCounter = 0;
let eventsPerSecond = 0;

// Mock data generation disabled - using only real data from AbuseIPDB
// Historical events will be loaded from database instead

// Seed historical events over the last 24 hours
export function initEventStore() {
  events = [];
  
  // No longer generating mock historical events
  // Events will come from AbuseIPDB live feed and database
  console.log("Event store initialized - ready for live data from AbuseIPDB");

  // 1-second interval tracker for events/sec calculation
  setInterval(() => {
    eventsPerSecond = secondCounter;
    secondCounter = 0;
  }, 1000);
}

export function getEvents() {
  return events;
}

export function getEventsPerSecond() {
  const { isStreamPaused } = getState();
  return isStreamPaused ? 0 : eventsPerSecond;
}

export function addEvent(event) {
  secondCounter++;
  events.unshift(event);
  if (events.length > 1000) {
    events.pop();
  }

  eventListeners.forEach(listener => {
    try {
      listener(event);
    } catch (e) {
      console.error('Error in event store listener:', e);
    }
  });
}

export function onNewEvent(callback) {
  eventListeners.add(callback);
  return () => eventListeners.delete(callback);
}
