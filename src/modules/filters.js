import { qs, qsa } from '../utils/dom.js';
import { ATTACK_TYPES, ATTACK_METADATA } from '../utils/colors.js';
import { getState, setState, resetAllFilters, subscribe } from '../state/appState.js';

export function initFilters() {
  const container = qs('#filter-checkboxes');
  if (container) {
    container.innerHTML = '';
    ATTACK_TYPES.forEach(type => {
      const label = document.createElement('label');
      label.className = 'filter-checkbox-label';
      label.innerHTML = `
        <input type="checkbox" checked value="${type}" class="attack-type-cb" />
        <span class="cb-text">${type}</span>
      `;
      container.appendChild(label);
    });

    container.querySelectorAll('.attack-type-cb').forEach(input => {
      input.addEventListener('change', () => {
        const checkedTypes = new Set();
        container.querySelectorAll('.attack-type-cb:checked').forEach(cb => {
          checkedTypes.add(cb.value);
        });
        setState({ attackTypeFilters: checkedTypes });
      });
    });
  }

  // Legend List
  const legend = qs('#legend-list');
  if (legend) {
    legend.innerHTML = '';
    ATTACK_TYPES.slice(0, 6).forEach(type => {
      const meta = ATTACK_METADATA[type];
      const color = meta?.color || '#38BDF8';
      const li = document.createElement('li');
      li.innerHTML = `
        <div class="legend-color-box" style="background: ${color}"></div>
        <span>${type}</span>
      `;
      legend.appendChild(li);
    });
  }

  // Reset Filters Button
  const resetBtn = qs('#reset-filters-btn');
  if (resetBtn) {
    resetBtn.addEventListener('click', () => {
      resetAllFilters();
    });
  }

  // Reactive subscription
  subscribe((state, prevState, updates) => {
    if (updates.attackTypeFilters && container) {
      container.querySelectorAll('.attack-type-cb').forEach(cb => {
        cb.checked = state.attackTypeFilters.has(cb.value);
      });
    }
  });
}

export function isTypeAllowed(type) {
  const { attackTypeFilters } = getState();
  return attackTypeFilters ? attackTypeFilters.has(type) : true;
}
