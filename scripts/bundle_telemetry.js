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

  function dmsToDecimal(deg, min, sec, dir) {
    let d = deg + min / 60 + sec / 3600;
    if (dir === 'S' || dir === 'W') d = -d;
    return d;
  }

  // Exact Start: 38°09'38.8"N 122°27'19.7"W
  // Exact Finish: 38°09'32.3"N 122°27'17.2"W
  const targetStart = {
    lat: Number(dmsToDecimal(38, 9, 38.8, 'N').toFixed(7)),
    lon: Number(dmsToDecimal(122, 27, 19.7, 'W').toFixed(7))
  };

  const targetFinish = {
    lat: Number(dmsToDecimal(38, 9, 32.3, 'N').toFixed(7)),
    lon: Number(dmsToDecimal(122, 27, 17.2, 'W').toFixed(7))
  };

  const bundledRuns = [];

  runs.forEach((r, idx) => {
    const timerStartTs = r.timestamp - r.rawTimeMs;
    const timerEndTs = r.timestamp;
    const rawDurationMs = r.rawTimeMs;

    // Search window around timer: default +/- 70s, wider for edge cases
    const searchMargin = (idx === 19 || idx === 23 || idx === 31) ? 240000 : 70000;
    const windowPts = rawPoints.filter(p => p.ts >= timerStartTs - searchMargin && p.ts <= timerEndTs + searchMargin);

    // Find best start & finish pair matching target coordinates and run duration
    const startCandidates = windowPts.filter(p => haversineMeters(p.lat, p.lon, targetStart.lat, targetStart.lon) <= 20);
    const finishCandidates = windowPts.filter(p => haversineMeters(p.lat, p.lon, targetFinish.lat, targetFinish.lon) <= 20);

    let bestPair = null;
    let bestScore = Infinity;

    startCandidates.forEach(sp => {
      finishCandidates.forEach(fp => {
        if (fp.ts > sp.ts) {
          const dur = fp.ts - sp.ts;
          const durDiff = Math.abs(dur - rawDurationMs);
          if (durDiff < 15000) {
            const ds = haversineMeters(sp.lat, sp.lon, targetStart.lat, targetStart.lon);
            const df = haversineMeters(fp.lat, fp.lon, targetFinish.lat, targetFinish.lon);
            const score = durDiff * 0.05 + ds + df;
            if (score < bestScore) {
              bestScore = score;
              bestPair = { sp, fp, dur, durDiff, ds, df };
            }
          }
        }
      });
    });

    let runPts = [];
    if (bestPair) {
      runPts = rawPoints.filter(p => p.ts >= bestPair.sp.ts && p.ts <= bestPair.fp.ts);
    } else {
      console.warn(`Fallback window for run ${r.driver} #${r.runNum}`);
      runPts = rawPoints.filter(p => p.ts >= timerStartTs && p.ts <= timerEndTs);
    }

    // Build coords array
    const rawCoords = runPts.map(pt => ({
      lat: Number(pt.lat.toFixed(7)),
      lon: Number(pt.lon.toFixed(7)),
      speed: Number(pt.speed.toFixed(1)),
      heading: Math.round(pt.heading),
      alt: Number(pt.alt.toFixed(1)),
      acc: Math.round(pt.acc),
      ts: pt.ts
    }));

    // Ensure line starts at exact targetStart point
    const firstPt = rawCoords[0];
    if (!firstPt || haversineMeters(firstPt.lat, firstPt.lon, targetStart.lat, targetStart.lon) > 0.5) {
      rawCoords.unshift({
        lat: targetStart.lat,
        lon: targetStart.lon,
        speed: 0.0,
        heading: firstPt ? firstPt.heading : 145,
        alt: firstPt ? firstPt.alt : 5.0,
        acc: 0,
        ts: firstPt ? firstPt.ts - 1000 : timerStartTs
      });
    } else {
      rawCoords[0].lat = targetStart.lat;
      rawCoords[0].lon = targetStart.lon;
    }

    // Ensure line ends at exact targetFinish point
    const lastPt = rawCoords[rawCoords.length - 1];
    if (!lastPt || haversineMeters(lastPt.lat, lastPt.lon, targetFinish.lat, targetFinish.lon) > 0.5) {
      rawCoords.push({
        lat: targetFinish.lat,
        lon: targetFinish.lon,
        speed: lastPt ? lastPt.speed : 20.0,
        heading: lastPt ? lastPt.heading : 145,
        alt: lastPt ? lastPt.alt : 5.0,
        acc: 0,
        ts: lastPt ? lastPt.ts + 1000 : timerEndTs
      });
    } else {
      rawCoords[rawCoords.length - 1].lat = targetFinish.lat;
      rawCoords[rawCoords.length - 1].lon = targetFinish.lon;
    }

    // Compute cumulative distance along the line
    let totalDistM = 0;
    const startTsActual = rawCoords[0].ts;

    const finalCoords = rawCoords.map((pt, i) => {
      if (i > 0) {
        const prev = rawCoords[i - 1];
        const stepDist = haversineMeters(prev.lat, prev.lon, pt.lat, pt.lon);
        if (stepDist < 100) {
          totalDistM += stepDist;
        }
      }
      return {
        ...pt,
        relMs: Math.max(0, pt.ts - startTsActual),
        distM: Number(totalDistM.toFixed(1))
      };
    });

    const speeds = finalCoords.map(c => c.speed);
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
      startTs: timerStartTs,
      endTs: timerEndTs,
      pointCount: finalCoords.length,
      maxSpeedMph: maxSpeed,
      minSpeedMph: minSpeed,
      avgSpeedMph: avgSpeed,
      totalDistanceMeters: Number(totalDistM.toFixed(1)),
      totalDistanceMiles: Number((totalDistM * 0.000621371).toFixed(3)),
      coords: finalCoords
    });
  });

  const output = {
    eventName: 'Sunday Autocross',
    trackName: 'Sonoma Raceway Paddock',
    center: [38.1598, -122.4551],
    startCoords: [targetStart.lat, targetStart.lon],
    finishCoords: [targetFinish.lat, targetFinish.lon],
    bounds: {
      minLat: 38.1583,
      maxLat: 38.1610,
      minLon: -122.4561,
      maxLon: -122.4541
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
