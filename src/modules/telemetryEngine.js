/**
 * Realistic Telemetry & Anomaly Simulation Engine
 * Generates smooth diurnal baseline traffic, realistic attack bursts with exponential decay,
 * anomaly detection flags, and mathematically synchronized 24h metrics.
 */

let currentTimeIndex = 0;
let activeBurst = null; // { type: 'DDoS', multiplier: 3.2, duration: 4, elapsed: 0 }
let telemetryHistory = []; // Array of { timestamp, rate, isAnomaly, dominantType, baseline }

const BASE_MIN = 45;
const BASE_MAX = 70;

// Generate historical 6 hours of telemetry data on init
function initHistory() {
  telemetryHistory = [];
  const now = Date.now();
  const totalPoints = 360; // 6 hours (1 point per minute)

  let simBurst = null;

  for (let i = totalPoints; i >= 0; i--) {
    const timestamp = new Date(now - i * 60 * 1000);
    const minute = timestamp.getMinutes();
    const hour = timestamp.getHours();

    // 1. Smooth Diurnal Baseline Wave (sine wave over 24h + small smooth noise)
    const diurnalFactor = Math.sin(((hour * 60 + minute) / 1440) * 2 * Math.PI - Math.PI / 2); // -1 to +1
    const baseline = BASE_MIN + (BASE_MAX - BASE_MIN) * ((diurnalFactor + 1) / 2) + (Math.sin(i * 0.3) * 3);

    // 2. Check or trigger simulated bursts
    if (!simBurst && Math.random() < 0.06) {
      const burstTypes = ["DDoS", "Port Scan", "Malware", "Brute Force"];
      const type = burstTypes[Math.floor(Math.random() * burstTypes.length)];
      simBurst = {
        type,
        multiplier: 2.2 + Math.random() * 1.8, // 2.2x to 4.0x
        duration: Math.floor(Math.random() * 4) + 3, // 3 to 6 mins
        elapsed: 0
      };
    }

    let rate = baseline;
    let dominantType = "Port Scan";
    let isAnomaly = false;

    if (simBurst) {
      // Exponential decay: multiplier decreases smoothly
      const decayFactor = Math.exp(-simBurst.elapsed / 2.0);
      const currentMult = 1 + (simBurst.multiplier - 1) * decayFactor;
      rate = Math.round(baseline * currentMult);
      dominantType = simBurst.type;

      if (currentMult > 1.4) {
        isAnomaly = true;
      }

      simBurst.elapsed++;
      if (simBurst.elapsed >= simBurst.duration) {
        simBurst = null;
      }
    } else {
      rate = Math.round(baseline + (Math.sin(i * 0.5) * 4));
      dominantType = rate > 60 ? "DDoS" : "Port Scan";
    }

    telemetryHistory.push({
      timestamp: timestamp.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false }),
      isoTime: timestamp.toISOString(),
      rate: Math.max(20, rate),
      baseline: Math.round(baseline),
      isAnomaly,
      dominantType
    });
  }
}

initHistory();

// Advance engine by 1 minute on each tick
export function tickTelemetry() {
  const now = new Date();
  const minute = now.getMinutes();
  const hour = now.getHours();

  const diurnalFactor = Math.sin(((hour * 60 + minute) / 1440) * 2 * Math.PI - Math.PI / 2);
  const baseline = BASE_MIN + (BASE_MAX - BASE_MIN) * ((diurnalFactor + 1) / 2) + (Math.sin(currentTimeIndex * 0.3) * 3);

  if (!activeBurst && Math.random() < 0.08) {
    const burstTypes = ["DDoS", "Port Scan", "Malware", "Brute Force"];
    const type = burstTypes[Math.floor(Math.random() * burstTypes.length)];
    activeBurst = {
      type,
      multiplier: 2.2 + Math.random() * 1.8,
      duration: Math.floor(Math.random() * 4) + 3,
      elapsed: 0
    };
  }

  let rate = baseline;
  let dominantType = "Port Scan";
  let isAnomaly = false;

  if (activeBurst) {
    const decayFactor = Math.exp(-activeBurst.elapsed / 2.0);
    const currentMult = 1 + (activeBurst.multiplier - 1) * decayFactor;
    rate = Math.round(baseline * currentMult);
    dominantType = activeBurst.type;

    if (currentMult > 1.4) {
      isAnomaly = true;
    }

    activeBurst.elapsed++;
    if (activeBurst.elapsed >= activeBurst.duration) {
      activeBurst = null;
    }
  } else {
    rate = Math.round(baseline + (Math.sin(currentTimeIndex * 0.5) * 4));
    dominantType = rate > 60 ? "DDoS" : "Port Scan";
  }

  currentTimeIndex++;

  const newPoint = {
    timestamp: now.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false }),
    isoTime: now.toISOString(),
    rate: Math.max(20, rate),
    baseline: Math.round(baseline),
    isAnomaly,
    dominantType
  };

  telemetryHistory.shift();
  telemetryHistory.push(newPoint);

  return newPoint;
}

// Get slice for specified time window: '30m' (30 points), '1h' (60 points), '6h' (360 points)
export function getTelemetryWindow(windowType = '1h') {
  let count = 60;
  if (windowType === '30m') count = 30;
  else if (windowType === '6h') count = 360;

  const slice = telemetryHistory.slice(-count);

  // Downsample if 6h to keep 30 points for smooth performance
  if (windowType === '6h') {
    const step = Math.ceil(slice.length / 30);
    return slice.filter((_, idx) => idx % step === 0);
  }

  return slice;
}

// Mathematically consistent 24h total and hourly trend delta
export function get24hMetrics() {
  const latestRate = telemetryHistory[telemetryHistory.length - 1]?.rate || 75;
  const prevHourRate = telemetryHistory[Math.max(0, telemetryHistory.length - 60)]?.rate || 65;

  const avgRate = telemetryHistory.reduce((acc, curr) => acc + curr.rate, 0) / telemetryHistory.length;
  const total24h = Math.round(avgRate * 60 * 24);

  const deltaPct = (((latestRate - prevHourRate) / prevHourRate) * 100).toFixed(1);
  const isUp = deltaPct >= 0;

  return {
    total24h,
    deltaPct: `${isUp ? '+' : ''}${deltaPct}%`,
    isUp,
    currentRate: latestRate,
    peakRate: Math.max(...telemetryHistory.map(p => p.rate)),
    avgRate: Math.round(avgRate)
  };
}

export function getActiveBurst() {
  return activeBurst;
}
