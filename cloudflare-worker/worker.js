/**
 * ==============================================================================
 * CLOUDFLARE WORKER: TRACCAR GPS INGESTOR & RACE ANALYSIS DATABASE
 * ==============================================================================
 */

const DEFAULT_FIREBASE_URL = "https://fiero-telemetry-default-rtdb.firebaseio.com/raceTelemetry.json";
const DEFAULT_EVENT_ID = "sonoma-lemons-2026";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization"
};

// In-memory cache for recent telemetry to power the /debug endpoint
let lastReceivedPacket = null;
let lastD1Error = null;

export default {
  async fetch(request, env, ctx) {
    if (request.method === "OPTIONS") {
      return new Response(null, { headers: corsHeaders });
    }

    const url = new URL(request.url);
    const path = url.pathname.replace(/\/+$/, "") || "/";

    try {
      // 1. DIAGNOSTIC / DEBUG ENDPOINT (visit in browser to verify DB & connectivity)
      if (path === "/debug") {
        return await handleDebug(env);
      }

      // 2. HEALTH CHECK
      if (path === "/health") {
        return new Response(JSON.stringify({ status: "ok", timestamp: Date.now() }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" }
        });
      }

      // 3. REST APIS FOR PIT WALL (Laps, Stints, Pitstops, Exports, Analysis)
      if (path === "/api/lap" && request.method === "POST") {
        return await handleRecordLap(request, env);
      }
      if (path === "/api/stint" && request.method === "POST") {
        return await handleRecordStint(request, env);
      }
      if (path === "/api/pitstop" && request.method === "POST") {
        return await handleRecordPitstop(request, env);
      }
      if (path === "/api/export/csv") {
        return await handleExportCsv(url, env);
      }
      if (path === "/api/export/gpx") {
        return await handleExportGpx(url, env);
      }
      if (path === "/api/analysis") {
        return await handleAnalysisSummary(url, env);
      }

      // 4. TRACCAR & GPS INGESTION (CATCH-ALL)
      // Any other path (/, /traccar, /gps, /positions, etc.) is handled as telemetry ingestion.
      return await handleTraccarIngestion(request, env);
    } catch (err) {
      console.error("Worker error:", err);
      return new Response(JSON.stringify({ error: err.message }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      });
    }
  }
};

/**
 * Robust Traccar Ingestion Engine
 * Handles:
 * - GET with query params (?lat=...&lon=...&speed=...)
 * - POST with query params in the URL (standard OsmAnd/Traccar format)
 * - POST with form body or JSON
 */
async function handleTraccarIngestion(request, env) {
  const url = new URL(request.url);
  let params = {};

  // 1. ALWAYS read query string parameters first (works for both GET and POST with URL params)
  for (const [k, v] of url.searchParams.entries()) {
    params[k.toLowerCase()] = v;
  }

  // 2. If request is POST/PUT, also inspect body
  if (request.method === "POST" || request.method === "PUT") {
    try {
      const contentType = (request.headers.get("content-type") || "").toLowerCase();
      if (contentType.includes("application/json")) {
        const json = await request.json();
        for (const [k, v] of Object.entries(json)) {
          params[k.toLowerCase()] = v;
        }
      } else if (contentType.includes("form") || contentType.includes("urlencoded")) {
        const formData = await request.formData();
        for (const [k, v] of formData.entries()) {
          params[k.toLowerCase()] = v;
        }
      } else {
        const text = await request.text();
        if (text && text.includes("=")) {
          const bodyParams = new URLSearchParams(text);
          for (const [k, v] of bodyParams.entries()) {
            params[k.toLowerCase()] = v;
          }
        }
      }
    } catch (e) {
      // Ignore body parse errors and fall back to query parameters
    }
  }

  // Extract core parameters
  const deviceId = params.id || params.deviceid || "car-phone";
  const rawLat = parseFloat(params.lat || params.latitude);
  const rawLon = parseFloat(params.lon || params.lng || params.longitude || params.long);

  if (isNaN(rawLat) || isNaN(rawLon)) {
    // Return 200 OK so Traccar doesn't loop fail on probe requests
    return new Response(`OK (No coordinates received. Parameters: ${JSON.stringify(params)})`, {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "text/plain" }
    });
  }

  // Parse Timestamp (Epoch ms or seconds, or ISO string)
  let rawTs = Date.now();
  const rawTsVal = params.timestamp || params.tst;
  if (rawTsVal) {
    if (typeof rawTsVal === "number" || /^\d+$/.test(rawTsVal)) {
      const num = Number(rawTsVal);
      rawTs = num < 10000000000 ? num * 1000 : num;
    } else {
      const parsed = Date.parse(rawTsVal);
      if (!isNaN(parsed) && parsed > 0) rawTs = parsed;
    }
  }

  // Speed: Traccar default is KNOTS. 1 knot = 1.15078 MPH.
  let rawSpeed = parseFloat(params.speed || params.vel || 0);
  let speedMph = rawSpeed * 1.15078;
  if (isNaN(speedMph) || speedMph < 2.0) speedMph = 0;

  const heading = parseFloat(params.bearing || params.heading || 0);
  const altitude = parseFloat(params.altitude || params.alt || 0);
  const accuracy = Math.round(parseFloat(params.accuracy || params.acc || 0));
  const battery = parseFloat(params.batt || params.battery || 100);
  const eventId = env.EVENT_ID || DEFAULT_EVENT_ID;

  // Use current arrival time for lastGpsTimestamp to guarantee real-time watchdog is LIVE
  const arrivalTime = Date.now();

  const packet = {
    speed: speedMph,
    latitude: rawLat,
    longitude: rawLon,
    lat: rawLat,
    lon: rawLon,
    accuracy: accuracy,
    heading: heading,
    altitude: altitude,
    battery: battery,
    lastGpsTimestamp: arrivalTime,
    deviceTimestamp: rawTs,
    unit: "MPH"
  };
  lastReceivedPacket = packet;

  // 1. Push to Firebase Realtime Database
  const firebaseUrl = env.FIREBASE_URL || DEFAULT_FIREBASE_URL;
  const firebasePromise = fetch(firebaseUrl, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(packet)
  }).catch(e => console.warn("Firebase PATCH error:", e));

  // 2. Archive to Cloudflare D1 Database (supports env.DB or env.db)
  const d1 = env.DB || env.db;
  let d1Promise = Promise.resolve();
  if (d1) {
    const isoTime = new Date(rawTs).toISOString();
    d1Promise = d1.prepare(`
      INSERT INTO telemetry_raw (event_id, device_id, timestamp, iso_time, latitude, longitude, speed_mph, heading, altitude_m, accuracy_m, battery_level)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).bind(eventId, deviceId, rawTs, isoTime, rawLat, rawLon, speedMph, heading, altitude, accuracy, battery)
      .run()
      .then(() => { lastD1Error = null; })
      .catch(e => {
        console.error("D1 Insert Error:", e);
        lastD1Error = e.message || String(e);
      });
  }

  await Promise.all([firebasePromise, d1Promise]);

  // Traccar requires HTTP 200 to mark points as delivered
  return new Response("OK", {
    status: 200,
    headers: { ...corsHeaders, "Content-Type": "text/plain" }
  });
}

/**
 * Diagnostic endpoint: returns D1 binding status and last received telemetry
 */
async function handleDebug(env) {
  const d1 = env.DB || env.db;
  let dbStatus = "Not bound";
  let rowCount = 0;

  if (d1) {
    try {
      const res = await d1.prepare("SELECT COUNT(*) as count FROM telemetry_raw").first();
      dbStatus = "Connected & Active";
      rowCount = res ? res.count : 0;
    } catch (e) {
      dbStatus = `Error: ${e.message}`;
    }
  }

  return new Response(JSON.stringify({
    status: "ok",
    workerTime: new Date().toISOString(),
    d1Database: {
      bindingPresent: !!d1,
      status: dbStatus,
      totalTelemetryRows: rowCount,
      lastD1InsertError: lastD1Error || "None"
    },
    firebaseUrl: env.FIREBASE_URL || DEFAULT_FIREBASE_URL,
    lastReceivedPacket: lastReceivedPacket || "No packets received yet"
  }, null, 2), {
    headers: { ...corsHeaders, "Content-Type": "application/json" }
  });
}

/**
 * Records a completed lap from the pit wall into D1.
 */
async function handleRecordLap(request, env) {
  const d1 = env.DB || env.db;
  if (!d1) return new Response(JSON.stringify({ error: "D1 DB not bound" }), { status: 500, headers: corsHeaders });

  const body = await request.json();
  const id = body.id || `lap-${Date.now()}`;
  const eventId = body.eventId || env.EVENT_ID || DEFAULT_EVENT_ID;
  const stintId = body.stintId || null;
  const lapNum = parseInt(body.lapNum || 1, 10);
  const driverName = body.driver || "Driver";
  const lapTimeMs = parseInt(body.timeMs || 0, 10);
  const lapTimeFormatted = body.timeFormatted || "00:00.00";
  const deltaMs = parseInt(body.deltaMs || 0, 10);
  const topSpeed = parseFloat(body.topSpeed || 0);
  const avgSpeed = parseFloat(body.avgSpeed || 0);
  const fuelUsed = parseFloat(body.fuelUsed || 0);
  const status = body.status || "CLEAN";
  const cones = parseInt(body.cones || 0, 10);
  const adjustedTimeMs = parseInt(body.adjustedTimeMs || lapTimeMs, 10);
  const flag = body.flag || "GREEN";
  const finishTime = body.finishTime || Date.now();
  const startTime = body.startTime || (finishTime - lapTimeMs);

  await d1.prepare(`
    INSERT INTO laps (id, event_id, stint_id, lap_num, driver_name, lap_time_ms, lap_time_formatted, delta_to_best_ms, top_speed_mph, avg_speed_mph, fuel_used_gal, status, cones, adjusted_time_ms, flag_condition, start_time, finish_time)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).bind(id, eventId, stintId, lapNum, driverName, lapTimeMs, lapTimeFormatted, deltaMs, topSpeed, avgSpeed, fuelUsed, status, cones, adjustedTimeMs, flag, startTime, finishTime)
    .run();

  return new Response(JSON.stringify({ success: true, lapId: id }), {
    status: 200,
    headers: { ...corsHeaders, "Content-Type": "application/json" }
  });
}

/**
 * Records a driver stint into D1.
 */
async function handleRecordStint(request, env) {
  const d1 = env.DB || env.db;
  if (!d1) return new Response(JSON.stringify({ error: "D1 DB not bound" }), { status: 500, headers: corsHeaders });

  const b = await request.json();
  const id = b.id || `stint-${Date.now()}`;
  const eventId = b.eventId || env.EVENT_ID || DEFAULT_EVENT_ID;
  const stintNum = parseInt(b.stintNum || 1, 10);
  const driverName = b.driver || "Driver";
  const startTime = parseInt(b.startTime || Date.now(), 10);
  const endTime = parseInt(b.endTime || Date.now(), 10);
  const durationMs = endTime - startTime;
  const lapCount = parseInt(b.lapCount || 0, 10);
  const milesDriven = parseFloat(b.milesDriven || 0);
  const startFuel = parseFloat(b.startFuel || 14.0);
  const endFuel = parseFloat(b.endFuel || 0);
  const notes = b.notes || "";

  await d1.prepare(`
    INSERT INTO stints (id, event_id, stint_num, driver_name, start_time, end_time, duration_ms, lap_count, miles_driven, start_fuel_gal, end_fuel_gal, notes)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).bind(id, eventId, stintNum, driverName, startTime, endTime, durationMs, lapCount, milesDriven, startFuel, endFuel, notes)
    .run();

  return new Response(JSON.stringify({ success: true, stintId: id }), {
    status: 200,
    headers: { ...corsHeaders, "Content-Type": "application/json" }
  });
}

/**
 * Records a pit stop into D1.
 */
async function handleRecordPitstop(request, env) {
  const d1 = env.DB || env.db;
  if (!d1) return new Response(JSON.stringify({ error: "D1 DB not bound" }), { status: 500, headers: corsHeaders });

  const b = await request.json();
  const id = b.id || `pit-${Date.now()}`;
  const eventId = b.eventId || env.EVENT_ID || DEFAULT_EVENT_ID;
  const pitNum = parseInt(b.pitNum || 1, 10);
  const inTime = parseInt(b.inTime || Date.now(), 10);
  const outTime = parseInt(b.outTime || Date.now(), 10);
  const durationSec = Math.round((outTime - inTime) / 1000);
  const driverOut = b.driverOut || "";
  const driverIn = b.driverIn || "";
  const fuelAdded = parseFloat(b.fuelAdded || 0);
  const notes = b.notes || "";

  await d1.prepare(`
    INSERT INTO pitstops (id, event_id, pit_num, in_time, out_time, duration_sec, driver_out, driver_in, fuel_added_gal, notes)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).bind(id, eventId, pitNum, inTime, outTime, durationSec, driverOut, driverIn, fuelAdded, notes)
    .run();

  return new Response(JSON.stringify({ success: true, pitId: id }), {
    status: 200,
    headers: { ...corsHeaders, "Content-Type": "application/json" }
  });
}

/**
 * Exports CSV directly from D1.
 */
async function handleExportCsv(url, env) {
  const d1 = env.DB || env.db;
  if (!d1) return new Response("Database not bound", { status: 500 });
  const type = url.searchParams.get("type") || "laps";
  const eventId = url.searchParams.get("eventId") || env.EVENT_ID || DEFAULT_EVENT_ID;

  let csv = "";
  let filename = `race_${type}_${Date.now()}.csv`;

  if (type === "laps") {
    const { results } = await d1.prepare("SELECT * FROM laps WHERE event_id = ? ORDER BY lap_num ASC").bind(eventId).all();
    csv = "Lap_Num,Driver,Time_Formatted,Time_MS,Top_Speed_MPH,Avg_Speed_MPH,Fuel_Used_Gal,Cones,Status,Start_Time_ISO,Finish_Time_ISO\n";
    results.forEach(r => {
      csv += `${r.lap_num},"${r.driver_name}",${r.lap_time_formatted},${r.lap_time_ms},${r.top_speed_mph},${r.avg_speed_mph},${r.fuel_used_gal},${r.cones},${r.status},${new Date(r.start_time).toISOString()},${new Date(r.finish_time).toISOString()}\n`;
    });
  } else if (type === "stints") {
    const { results } = await d1.prepare("SELECT * FROM stints WHERE event_id = ? ORDER BY stint_num ASC").bind(eventId).all();
    csv = "Stint_Num,Driver,Duration_Mins,Lap_Count,Miles_Driven,Start_Fuel_Gal,End_Fuel_Gal,Start_Time_ISO,End_Time_ISO,Notes\n";
    results.forEach(r => {
      const durMins = (r.duration_ms / 60000).toFixed(1);
      csv += `${r.stint_num},"${r.driver_name}",${durMins},${r.lap_count},${r.miles_driven},${r.start_fuel_gal},${r.end_fuel_gal},${new Date(r.start_time).toISOString()},${new Date(r.end_time).toISOString()},"${r.notes || ''}"\n`;
    });
  } else if (type === "pitstops") {
    const { results } = await d1.prepare("SELECT * FROM pitstops WHERE event_id = ? ORDER BY pit_num ASC").bind(eventId).all();
    csv = "Pit_Num,Duration_Sec,Driver_Out,Driver_In,Fuel_Added_Gal,In_Time_ISO,Out_Time_ISO,Notes\n";
    results.forEach(r => {
      csv += `${r.pit_num},${r.duration_sec},"${r.driver_out}","${r.driver_in}",${r.fuel_added_gal},${new Date(r.in_time).toISOString()},${new Date(r.out_time).toISOString()},"${r.notes || ''}"\n`;
    });
  } else if (type === "telemetry") {
    const { results } = await d1.prepare("SELECT * FROM telemetry_raw WHERE event_id = ? ORDER BY timestamp ASC LIMIT 50000").bind(eventId).all();
    csv = "Timestamp_MS,ISO_Time,Latitude,Longitude,Speed_MPH,Heading,Altitude_M,Accuracy_M,Battery_Pct\n";
    results.forEach(r => {
      csv += `${r.timestamp},${r.iso_time},${r.latitude},${r.longitude},${r.speed_mph},${r.heading},${r.altitude_m},${r.accuracy_m},${r.battery_level}\n`;
    });
  }

  return new Response(csv, {
    headers: {
      ...corsHeaders,
      "Content-Type": "text/csv",
      "Content-Disposition": `attachment; filename="${filename}"`
    }
  });
}

/**
 * Exports GPX directly from D1.
 */
async function handleExportGpx(url, env) {
  const d1 = env.DB || env.db;
  if (!d1) return new Response("Database not bound", { status: 500 });
  const eventId = url.searchParams.get("eventId") || env.EVENT_ID || DEFAULT_EVENT_ID;
  const { results } = await d1.prepare("SELECT * FROM telemetry_raw WHERE event_id = ? ORDER BY timestamp ASC").bind(eventId).all();

  let gpx = `<?xml version="1.0" encoding="UTF-8"?>
<gpx version="1.1" creator="RaceTelemetry Cloudflare Worker" xmlns="http://www.topografix.com/GPX/1/1">
  <trk>
    <name>Race Telemetry - ${eventId}</name>
    <trkseg>
`;

  results.forEach(pt => {
    const speedMps = (pt.speed_mph * 0.44704).toFixed(2);
    gpx += `      <trkpt lat="${pt.latitude}" lon="${pt.longitude}">
        <ele>${pt.altitude_m || 0}</ele>
        <time>${pt.iso_time}</time>
        <speed>${speedMps}</speed>
      </trkpt>\n`;
  });

  gpx += `    </trkseg>
  </trk>
</gpx>`;

  return new Response(gpx, {
    headers: {
      ...corsHeaders,
      "Content-Type": "application/gpx+xml",
      "Content-Disposition": `attachment; filename="race_telemetry_${Date.now()}.gpx"`
    }
  });
}

/**
 * Returns analysis summary JSON.
 */
async function handleAnalysisSummary(url, env) {
  const d1 = env.DB || env.db;
  if (!d1) return new Response(JSON.stringify({ error: "D1 DB not bound" }), { status: 500, headers: corsHeaders });
  const eventId = url.searchParams.get("eventId") || env.EVENT_ID || DEFAULT_EVENT_ID;

  const [laps, stints, pitstops] = await Promise.all([
    d1.prepare("SELECT * FROM laps WHERE event_id = ? ORDER BY lap_num ASC").bind(eventId).all(),
    d1.prepare("SELECT * FROM stints WHERE event_id = ? ORDER BY stint_num ASC").bind(eventId).all(),
    d1.prepare("SELECT * FROM pitstops WHERE event_id = ? ORDER BY pit_num ASC").bind(eventId).all()
  ]);

  return new Response(JSON.stringify({
    eventId,
    totalLaps: laps.results.length,
    totalStints: stints.results.length,
    totalPitstops: pitstops.results.length,
    laps: laps.results,
    stints: stints.results,
    pitstops: pitstops.results
  }), {
    headers: { ...corsHeaders, "Content-Type": "application/json" }
  });
}
