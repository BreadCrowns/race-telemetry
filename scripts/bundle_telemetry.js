// scripts/bundle_telemetry.js
const fs = require('fs');
const path = require('path');

function haversineMeters(lat1, lon1, lat2, lon2) {
  const R = 6371000; // Earth radius in meters
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
            Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
            Math.sin(dLon / 2) * Math.sin(dLon / 2);
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

async function bundleTelemetry() {
  console.log('Loading telemetry CSV...');
  let csvPath = path.join(__dirname, '..', 'telemetry_raw.csv');
  if (!fs.existsSync(csvPath)) {
    console.log('Fetching telemetry_raw.csv from Cloudflare Worker...');
    const res = await fetch('https://race-telemetry-worker.bazarkoj.workers.dev/api/export/csv?type=telemetry');
    const text = await res.text();
    fs.writeFileSync(csvPath, text);
  }

  const csvText = fs.readFileSync(csvPath, 'utf8');
  const lines = csvText.trim().split('\n');
  const rawPoints = [];
  for (let i = 1; i < lines.length; i++) {
    const p = lines[i].split(',');
    if (p.length >= 5) {
      rawPoints.push({
        ts: Number(p[0]),
        iso: p[1],
        lat: parseFloat(p[2]),
        lon: parseFloat(p[3]),
        speed: parseFloat(p[4]),
        heading: parseFloat(p[5] || 0),
        alt: parseFloat(p[6] || 0),
        acc: parseFloat(p[7] || 0)
      });
    }
  }
  console.log(`Parsed ${rawPoints.length} total GPS telemetry points.`);

  console.log('Fetching runs from Firebase...');
  const fbRes = await fetch('https://fiero-telemetry-default-rtdb.firebaseio.com/raceTelemetry/events/sunday_autocross/runs.json');
  const fbRuns = await fbRes.json();
  const runs = Object.values(fbRuns).sort((a, b) => a.timestamp - b.timestamp);
  console.log(`Fetched ${runs.length} runs from Firebase.`);

  const bundledRuns = [];

  runs.forEach((r, idx) => {
    const startTs = r.timestamp - r.rawTimeMs;
    const endTs = r.timestamp;

    // Filter points in run window (with 400ms padding)
    const runPts = rawPoints.filter(p => p.ts >= startTs - 400 && p.ts <= endTs + 400);

    // Compute cumulative distance along the line
    let totalDistM = 0;
    const coords = [];

    for (let j = 0; j < runPts.length; j++) {
      const pt = runPts[j];
      if (j > 0) {
        const prev = runPts[j - 1];
        const stepDist = haversineMeters(prev.lat, prev.lon, pt.lat, pt.lon);
        // Only add if reasonable step (< 100 meters per second)
        if (stepDist < 100) {
          totalDistM += stepDist;
        }
      }

      coords.push({
        lat: Number(pt.lat.toFixed(7)),
        lon: Number(pt.lon.toFixed(7)),
        speed: Number(pt.speed.toFixed(1)),
        heading: Math.round(pt.heading),
        alt: Number(pt.alt.toFixed(1)),
        acc: Math.round(pt.acc),
        ts: pt.ts,
        relMs: Math.max(0, pt.ts - startTs),
        distM: Number(totalDistM.toFixed(1))
      });
    }

    const speeds = coords.map(c => c.speed);
    const maxSpeed = speeds.length ? Math.max(...speeds) : 0;
    const minSpeed = speeds.length ? Math.min(...speeds) : 0;
    const avgSpeed = speeds.length ? Number((speeds.reduce((a, b) => a + b, 0) / speeds.length).toFixed(1)) : 0;

    bundledRuns.push({
      id: r.id,
      index: idx + 1,
      runNum: r.runNum,
      driver: r.driver,
      eventName: r.eventName || 'Sunday Autocross',
      rawTimeMs: r.rawTimeMs,
      rawFormatted: r.rawFormatted,
      finalTimeMs: r.finalTimeMs,
      finalFormatted: r.finalFormatted,
      cones: r.cones || 0,
      isDnf: !!r.isDnf,
      notes: r.notes || '',
      startTs: startTs,
      endTs: endTs,
      pointCount: coords.length,
      maxSpeedMph: maxSpeed,
      minSpeedMph: minSpeed,
      avgSpeedMph: avgSpeed,
      totalDistanceMeters: Number(totalDistM.toFixed(1)),
      totalDistanceMiles: Number((totalDistM * 0.000621371).toFixed(3)),
      coords: coords
    });
  });

  const output = {
    eventName: 'Sunday Autocross',
    trackName: 'Sonoma Raceway Paddock',
    center: [38.1596365, -122.4551010],
    bounds: {
      minLat: 38.1583094,
      maxLat: 38.1609636,
      minLon: -122.4560945,
      maxLon: -122.4541076
    },
    totalRuns: bundledRuns.length,
    generatedAt: new Date().toISOString(),
    runs: bundledRuns
  };

  const outputPath = path.join(__dirname, '..', 'runs_telemetry.json');
  fs.writeFileSync(outputPath, JSON.stringify(output, null, 2));
  console.log(`Successfully bundled ${bundledRuns.length} runs into ${outputPath} (${(fs.statSync(outputPath).size / 1024).toFixed(1)} KB)`);
}

bundleTelemetry().catch(console.error);
