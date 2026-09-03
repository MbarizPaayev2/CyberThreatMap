import { qs, qsa } from '../utils/dom.js';
import { getState, setState, subscribe } from '../state/appState.js';

export function initNavigation(onTabChange) {
  const tabs = qsa('.nav-tab');
  
  tabs.forEach(tab => {
    tab.addEventListener('click', () => {
      const targetId = tab.dataset.tab;
      if (!targetId) return;
      setState({ currentView: targetId });
      if (onTabChange) {
        onTabChange(targetId);
      }
    });
  });

  // Sync with central application state changes
  subscribe((state, prevState, updates) => {
    if (updates.currentView) {
      applyTabClasses(updates.currentView);
    }
  });

  applyTabClasses(getState().currentView);
}

function applyTabClasses(targetId) {
  const tabs = qsa('.nav-tab');
  tabs.forEach(t => t.classList.toggle('active', t.dataset.tab === targetId));
  qsa('.tab-view').forEach(v => v.classList.toggle('active', v.id === targetId));
}

export function switchTab(targetId) {
  setState({ currentView: targetId });
}
