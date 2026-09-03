import { getSeverityColor } from '../utils/colors.js';
import { qs, setText } from '../utils/dom.js';
import { ALL_COUNTRIES } from '../utils/countries.js';
import { getState, setState, subscribe } from '../state/appState.js';
import { isTypeAllowed } from './filters.js';

let globeInstance = null;
let arcsData = [];
let ringsData = [];
let hoverPolygon = null;
let countryFeatures = [];
const activeFlashes = new Map();

export async function initGlobe(containerId) {
  const container = qs(`#${containerId}`);
  if (!container) return;

  const Globe = (await import('globe.gl')).default;

  globeInstance = Globe()(container)
    .width(container.clientWidth)
    .height(container.clientHeight)
    .globeImageUrl('//unpkg.com/three-globe/example/img/earth-blue-marble.jpg')
    .backgroundColor('rgba(0,0,0,0)')
    .showAtmosphere(true)
    .atmosphereColor('#3a6fa0')
    .atmosphereAltitude(0.18)
    .pointOfView({ lat: 25, lng: 10, altitude: 2.0 })

    // --- CLEAN SEVERITY LASER BEAMS ---
    .arcColor('color')
    .arcDashLength(0.2)
    .arcDashGap(0.8)
    .arcDashInitialGap(() => Math.random())
    .arcDashAnimateTime('time')
    .arcStroke('stroke')
    .arcAltitude('alt')

    // --- RING CONFIG ---
    .ringColor('color')
    .ringMaxRadius('maxR')
    .ringPropagationSpeed('speed')
    .ringRepeatPeriod('repeat')

    // --- COUNTRY BORDERS WITH HOVER HIGHLIGHT & CLICK FOCUS ---
    .polygonCapColor(d => {
      const { selectedCountry } = getState();
      if (d === hoverPolygon || (selectedCountry && isSameCountry(d, selectedCountry))) {
        return 'rgba(56, 189, 248, 0.25)';
      }
      if (activeFlashes.has(d)) {
        const color = activeFlashes.get(d);
        return `${color}44`;
      }
      return 'rgba(0,0,0,0)';
    })
    .polygonSideColor(() => 'rgba(0,0,0,0)')
    .polygonStrokeColor(d => {
      const { selectedCountry } = getState();
      if (d === hoverPolygon || (selectedCountry && isSameCountry(d, selectedCountry))) {
        return '#38BDF8';
      }
      if (activeFlashes.has(d)) {
        return activeFlashes.get(d);
      }
      return 'rgba(180, 210, 235, 0.45)';
    })
    .polygonAltitude(d => {
      const { selectedCountry } = getState();
      if (d === hoverPolygon || (selectedCountry && isSameCountry(d, selectedCountry))) return 0.005;
      if (activeFlashes.has(d)) return 0.003;
      return 0.001;
    })
    .polygonLabel(d => `
      <div style="
        font-family: 'IBM Plex Mono', monospace;
        background: rgba(15, 23, 42, 0.95);
        border: 1px solid rgba(56, 189, 248, 0.5);
        padding: 5px 10px;
        border-radius: 3px;
        color: #F8FAFC;
        font-size: 11px;
        box-shadow: 0 4px 10px rgba(0,0,0,0.5);
        pointer-events: none;
      ">
        ${d.properties?.name || d.properties?.ADMIN || d.properties?.NAME || 'Unknown'}
      </div>
    `)
    .onPolygonHover(polygon => {
      hoverPolygon = polygon;
      container.style.cursor = polygon ? 'pointer' : 'default';
    })
    .onPolygonClick(polygon => {
      if (!polygon) return;
      const name = polygon.properties?.name || polygon.properties?.ADMIN || polygon.properties?.NAME;
      if (name) {
        setState({ selectedCountry: name, currentView: 'view-map' });
      }
    })

    // --- COUNTRY NAME LABELS ---
    .labelsData(ALL_COUNTRIES)
    .labelText('name')
    .labelLat('lat')
    .labelLng('lng')
    .labelColor(() => 'rgba(226, 232, 240, 0.45)')
    .labelSize(0.38)
    .labelDotRadius(0)
    .labelResolution(2);

  globeInstance.arcsData(arcsData);
  globeInstance.ringsData(ringsData);

  globeInstance.controls().autoRotate = true;
  globeInstance.controls().autoRotateSpeed = 0.25;

  window.addEventListener('resize', () => {
    globeInstance.width(container.clientWidth);
    globeInstance.height(container.clientHeight);
  });

  loadCountryBorders();
  setupFocusControls();

  // Reactive subscription
  subscribe((state, prevState, updates) => {
    if (updates.selectedCountry !== undefined) {
      if (updates.selectedCountry) {
        applyCountryFocus(updates.selectedCountry);
      } else {
        clearFocusVisuals();
      }
    }
  });
}

function isSameCountry(feature, countryName) {
  if (!feature || !countryName) return false;
  const name = feature.properties?.name || feature.properties?.ADMIN || feature.properties?.NAME || '';
  return name.toLowerCase().includes(countryName.toLowerCase()) || countryName.toLowerCase().includes(name.toLowerCase());
}

function applyCountryFocus(countryName) {
  const banner = qs('#focus-banner');
  if (banner) {
    banner.style.display = 'flex';
    setText('#focus-banner-text', `Target Focus: ${countryName}`);
  }

  const feature = countryFeatures.find(f => isSameCountry(f, countryName));
  if (feature && globeInstance && feature._centroid) {
    globeInstance.pointOfView({ lat: feature._centroid.lat, lng: feature._centroid.lng, altitude: 0.85 }, 1200);
  }

  if (globeInstance) {
    globeInstance.polygonCapColor(globeInstance.polygonCapColor());
    globeInstance.polygonStrokeColor(globeInstance.polygonStrokeColor());
  }
}

function clearFocusVisuals() {
  const banner = qs('#focus-banner');
  if (banner) banner.style.display = 'none';

  if (globeInstance) {
    globeInstance.pointOfView({ lat: 25, lng: 10, altitude: 2.0 }, 1200);
    globeInstance.polygonCapColor(globeInstance.polygonCapColor());
    globeInstance.polygonStrokeColor(globeInstance.polygonStrokeColor());
  }
}

export function focusOnCountryByName(countryName) {
  if (!countryName) return;
  setState({ selectedCountry: countryName, currentView: 'view-map' });
}

export function clearCountryFocus() {
  setState({ selectedCountry: null, selectedCountryCode: null });
}

function setupFocusControls() {
  const clearBtn = qs('#clear-focus-btn');
  if (clearBtn) {
    clearBtn.addEventListener('click', clearCountryFocus);
  }
}

async function loadCountryBorders() {
  try {
    const res = await fetch(
      'https://raw.githubusercontent.com/holtzy/D3-graph-gallery/master/DATA/world.geojson'
    );
    if (!res.ok) return;
    const geo = await res.json();
    
    countryFeatures = geo.features.map(f => {
      let totalLat = 0, totalLng = 0, count = 0;
      const processCoords = (coords) => {
        if (typeof coords[0] === 'number') {
          totalLng += coords[0];
          totalLat += coords[1];
          count++;
        } else {
          coords.forEach(processCoords);
        }
      };
      processCoords(f.geometry.coordinates);
      f._centroid = count > 0 ? { lat: totalLat / count, lng: totalLng / count } : null;
      return f;
    });

    if (globeInstance) {
      globeInstance.polygonsData(countryFeatures);
    }
  } catch (e) {
    console.error('Failed to load country borders', e);
  }
}

export function addThreatEventToGlobe(event) {
  if (!globeInstance) return;
  if (!isTypeAllowed(event.attack_type)) return;

  const color = getSeverityColor(event.severity);
  const isCritical = event.severity === 'critical';

  const arc = {
    startLat: event.source_lat,
    startLng: event.source_lng,
    endLat: event.target_lat,
    endLng: event.target_lng,
    color: color,
    alt: 0.15 + Math.random() * 0.15,
    stroke: isCritical ? 0.9 : 0.5,
    time: 1400 + Math.random() * 600,
    attack_type: event.attack_type
  };

  arcsData.push(arc);
  if (arcsData.length > 25) arcsData.shift();
  globeInstance.arcsData(arcsData);

  const ring = {
    lat: event.target_lat,
    lng: event.target_lng,
    color: color,
    maxR: isCritical ? 4.5 : 2.5,
    speed: 2.5,
    repeat: 0
  };

  ringsData.push(ring);
  if (ringsData.length > 15) ringsData.shift();
  globeInstance.ringsData(ringsData);
}
