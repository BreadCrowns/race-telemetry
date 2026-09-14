// scripts/test_autox_timing.js
const fs = require('fs');
const path = require('path');

function latLonToMeters(lat, lon, anchorLat, anchorLon) {
  const y = (lat - anchorLat) * 111139.0;
  const x = (lon - anchorLon) * (111139.0 * Math.cos(anchorLat * Math.PI / 180.0));
  return { x, y };
}

function checkSegmentIntersection(p1, p2, g1, g2) {
  const rx = p2.x - p1.x;
  const ry = p2.y - p1.y;
  const sx = g2.x - g1.x;
  const sy = g2.y - g1.y;

  const denom = rx * sy - ry * sx;
  if (Math.abs(denom) < 1e-9) return null;

  const q_px = g1.x - p1.x;
  const q_py = g1.y - p1.y;

  const t = (q_px * sy - q_py * sx) / denom;
  const u = (q_px * ry - q_py * rx) / denom;

  if (t >= 0.0 && t <= 1.0 && u >= 0.0 && u <= 1.0) {
    const normalX = -sy;
    const normalY = sx;
    const dot = rx * normalX + ry * normalY;
    return { fraction: t, dotProduct: dot, forward: dot > 0 };
  }
  return null;
}

const anchor = { lat: 38.160, lon: -122.455 };

function createGate(p1Lat, p1Lon, p2Lat, p2Lon) {
  return {
    g1: latLonToMeters(p1Lat, p1Lon, anchor.lat, anchor.lon),
    g2: latLonToMeters(p2Lat, p2Lon, anchor.lat, anchor.lon)
  };
}

// Start Gate (across track at 38.16078, -122.45547)
const startGate = createGate(38.16075, -122.45558, 38.16082, -122.45538);
// Finish Gate (across track at 38.15897, -122.45478)
const finishGate = createGate(38.15901, -122.45470, 38.15894, -122.45488);

const lines = fs.readFileSync(path.join(__dirname, '..', 'telemetry_raw.csv'), 'utf8').trim().split('\n');
console.log(`Loaded ${lines.length} raw telemetry points from telemetry_raw.csv.`);

let state = 'IDLE'; // IDLE, ARMED, RUNNING
let standstillCount = 0;
let runStartTs = null;
let runPoints = [];
const detectedRuns = [];

for (let i = 1; i < lines.length - 1; i++) {
  const curRaw = lines[i].split(',');
  const nextRaw = lines[i+1].split(',');

  const p1 = {
    ts: Number(curRaw[0]),
    lat: parseFloat(curRaw[2]),
    lon: parseFloat(curRaw[3]),
    speed: parseFloat(curRaw[4]),
    heading: parseFloat(curRaw[5] || 0),
    ...latLonToMeters(parseFloat(curRaw[2]), parseFloat(curRaw[3]), anchor.lat, anchor.lon)
  };

  const p2 = {
    ts: Number(nextRaw[0]),
    lat: parseFloat(nextRaw[2]),
    lon: parseFloat(nextRaw[3]),
    speed: parseFloat(nextRaw[4]),
    heading: parseFloat(nextRaw[5] || 0),
    ...latLonToMeters(parseFloat(nextRaw[2]), parseFloat(nextRaw[3]), anchor.lat, anchor.lon)
  };

  // Check distance to start gate
  const distToStart = Math.hypot(p1.x - ((startGate.g1.x + startGate.g2.x)/2), p1.y - ((startGate.g1.y + startGate.g2.y)/2));

  if (state === 'IDLE') {
    if (distToStart < 25 && p1.speed < 2.0) {
      standstillCount++;
      if (standstillCount >= 3) {
        state = 'ARMED';
        // console.log(`[${new Date(p1.ts).toLocaleTimeString()}] System ARMED at start line.`);
      }
    } else {
      standstillCount = 0;
    }
  } else if (state === 'ARMED') {
    // Check for launch crossing start gate
    const hitStart = checkSegmentIntersection(p1, p2, startGate.g1, startGate.g2);
    if (hitStart && p2.speed > 3.0) {
      state = 'RUNNING';
      runStartTs = p1.ts + hitStart.fraction * (p2.ts - p1.ts);
      runPoints = [p1, p2];
      // console.log(`[${new Date(runStartTs).toLocaleTimeString()}] LAUNCH! Timing started.`);
    } else if (distToStart > 40 && p1.speed < 2.0) {
      // Driver backed away or left staging
      state = 'IDLE';
      standstillCount = 0;
    }
  } else if (state === 'RUNNING') {
    runPoints.push(p2);
    const hitFinish = checkSegmentIntersection(p1, p2, finishGate.g1, finishGate.g2);
    if (hitFinish && p2.speed > 5.0) {
      const runFinishTs = p1.ts + hitFinish.fraction * (p2.ts - p1.ts);
      const durationMs = Math.round(runFinishTs - runStartTs);
      if (durationMs > 25000 && durationMs < 120000) { // Valid autocross duration (25s - 120s)
        detectedRuns.push({
          startTs: runStartTs,
          finishTs: runFinishTs,
          durationMs,
          pointCount: runPoints.length
        });
      }
      state = 'IDLE';
      standstillCount = 0;
      runStartTs = null;
      runPoints = [];
    } else if (runStartTs && (p2.ts - runStartTs > 150000)) {
      // Timeout run if longer than 2.5 minutes (e.g. aborted run)
      state = 'IDLE';
      standstillCount = 0;
      runStartTs = null;
      runPoints = [];
    }
  }
}

console.log(`\nDetected ${detectedRuns.length} completed autocross runs automatically from raw stream!`);
detectedRuns.slice(0, 10).forEach((r, i) => {
  console.log(`AutoRun #${i + 1}: ${new Date(r.startTs).toLocaleTimeString()} -> ${(r.durationMs/1000).toFixed(2)}s (${r.pointCount} points)`);
});
