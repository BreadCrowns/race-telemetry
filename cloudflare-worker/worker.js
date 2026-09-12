/**
 * ==============================================================================
 * CLOUDFLARE WORKER: TRACCAR GPS INGESTOR & RACE ANALYSIS DATABASE
 * ==============================================================================
 * 
 * Functions:
 * 1. Ingests background GPS packets from Traccar Client (iOS/Android).
 * 2. Streams real-time live telemetry to Firebase Realtime Database (for Pit Wall & PRISM Overlay).
 * 3. Archives every GPS fix into Cloudflare D1 (SQLite) for permanent storage.
 * 4. Provides REST API endpoints for logging and querying Stints, Laps, Pit Stops, and GPX/CSV exports.
 */

// Firebase RTDB URL (can also be configured via Cloudflare Environment Variable FIREBASE_URL)
const DEFAULT_FIREBASE_URL = "https://fiero-telemetry-default-rtdb.firebaseio.com/raceTelemetry.json";
const DEFAULT_EVENT_ID = "sonoma-lemons-2026";

// CORS Headers helper
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization"
};

export default {
  async fetch(request, env, ctx) {
    // Handle CORS preflight
    if (request.method === "OPTIONS") {
      return new Response(null, { headers: corsHeaders });
    }

    const url = new URL(request.url);
    const path = url.pathname;

    try {
      // 1. TRACCAR GPS INGESTION ENDPOINT (Accepts GET or POST at root or /traccar)
      if (path === "/" || path === "/traccar" || path === "/gps") {
        return await handleTraccarIngestion(request, env);
      }

      // 2. LAP RECORDING API
      if (path === "/api/lap" && request.method === "POST") {
        return await handleRecordLap(request, env);
      }

      // 3. STINT RECORDING API
      if (path === "/api/stint" && request.method === "POST") {
        return await handleRecordStint(request, env);
      }

      // 4. PIT STOP RECORDING API
      if (path === "/api/pitstop" && request.method === "POST") {
        return await handleRecordPitstop(request, env);
      }

      // 5. EXPORT APIS (CSV & GPX)
      if (path === "/api/export/csv") {
        return await handleExportCsv(url, env);
      }
      if (path === "/api/export/gpx") {
        return await handleExportGpx(url, env);
      }

      // 6. ANALYSIS SUMMARY API
      if (path === "/api/analysis") {
        return await handleAnalysisSummary(url, env);
      }

      // 7. HEALTH CHECK
      if (path === "/health") {
        return new Response(JSON.stringify({ status: "ok", timestamp: Date.now() }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" }
        });
      }

      return new Response("Not Found", { status: 404, headers: corsHeaders });

    } catch (err) {
      console.error("Worker processing error:", err);
      return new Response(JSON.stringify({ error: err.message }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      });
    }
  }
};

/**
 * Parses and processes incoming Traccar Client packets.
 * Traccar Client sends: id, lat, lon, timestamp, speed (in knots), bearing, altitude, batt.
 */
async function handleTraccarIngestion(request, env) {
  const url = new URL(request.url);
  let params = {};

  if (request.method === "GET") {
    // Traccar OsmAnd / HTTP GET format
    for (const [k, v] of url.searchParams.entries()) {
      params[k.toLowerCase()] = v;
    }
  } else if (request.method === "POST") {
    const contentType = request.headers.get("content-type") || "";
    if (contentType.includes("application/json")) {
      params = await request.json();
    } else {
      // URL-encoded form data
      const formData = await request.formData();
      for (const [k, v] of formData.entries()) {
        params[k.toLowerCase()] = v;
      }
    }
  }

  // Extract core parameters with fallbacks
  const deviceId = params.id || params.deviceid || "car-phone";
  const rawLat = parseFloat(params.lat || params.latitude);
  const rawLon = parseFloat(params.lon || params.longitude);

  if (isNaN(rawLat) || isNaN(rawLon)) {
    // Return 200 anyway so Traccar doesn't loop fail on probe requests
    return new Response("OK (Probe / No Coordinates)", { status: 200, headers: corsHeaders });
  }

  // Parse Timestamp (Traccar sends UNIX seconds or milliseconds)
  let rawTs = parseInt(params.timestamp || params.tst || Date.now(), 10);
  if (rawTs < 10000000000) {
    rawTs = rawTs * 1000; // Convert seconds to ms
  }

  // Speed conversion: Traccar default is KNOTS. 1 knot = 1.15078 MPH.
  // (If speed is already MPH or 0, cap safely)
  let rawSpeed = parseFloat(params.speed || params.vel || 0);
  let speedMph = rawSpeed * 1.15078; // Convert knots to MPH
  if (isNaN(speedMph) || speedMph < 2.0) speedMph = 0;

  const heading = parseFloat(params.bearing || params.heading || 0);
  const altitude = parseFloat(params.altitude || params.alt || 0);
  const accuracy = Math.round(parseFloat(params.accuracy || params.acc || 0));
  const battery = parseFloat(params.batt || params.battery || 100);
  const eventId = env.EVENT_ID || DEFAULT_EVENT_ID;

  // 1. Push live telemetry to Firebase Realtime Database
  const firebaseUrl = env.FIREBASE_URL || DEFAULT_FIREBASE_URL;
  const firebasePayload = {
    speed: speedMph,
    latitude: rawLat,
    longitude: rawLon,
    accuracy: accuracy,
    heading: heading,
    altitude: altitude,
    battery: battery,
    lastGpsTimestamp: rawTs,
    unit: "MPH"
  };

  const firebasePromise = fetch(firebaseUrl, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(firebasePayload)
  }).catch(e => console.warn("Firebase PATCH error:", e));

  // 2. Archive to Cloudflare D1 database (if D1 binding 'DB' is available)
  let d1Promise = Promise.resolve();
  if (env.DB) {
    const isoTime = new Date(rawTs).toISOString();
    d1Promise = env.DB.prepare(`
      INSERT INTO telemetry_raw (event_id, device_id, timestamp, iso_time, latitude, longitude, speed_mph, heading, altitude_m, accuracy_m, battery_level)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).bind(eventId, deviceId, rawTs, isoTime, rawLat, rawLon, speedMph, heading, altitude, accuracy, battery)
      .run()
      .catch(e => console.warn("D1 telemetry insert error:", e));
  }

  // Concurrently complete both operations
  await Promise.all([firebasePromise, d1Promise]);

  // Return HTTP 200 OK - Traccar requires this to mark buffered points as sent!
  return new Response("OK", {
    status: 200,
    headers: { ...corsHeaders, "Content-Type": "text/plain" }
  });
}

/**
 * Records a completed lap from the pit wall into D1.
 */
async function handleRecordLap(request, env) {
  if (!env.DB) return new Response(JSON.stringify({ error: "D1 DB not bound" }), { status: 500, headers: corsHeaders });

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

  await env.DB.prepare(`
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
  if (!env.DB) return new Response(JSON.stringify({ error: "D1 DB not bound" }), { status: 500, headers: corsHeaders });

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

  await env.DB.prepare(`
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
  if (!env.DB) return new Response(JSON.stringify({ error: "D1 DB not bound" }), { status: 500, headers: corsHeaders });

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

  await env.DB.prepare(`
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
 * Exports CSV of Laps, Stints, Pitstops, or Raw Telemetry directly from D1.
 */
async function handleExportCsv(url, env) {
  if (!env.DB) return new Response("Database not bound", { status: 500 });
  const type = url.searchParams.get("type") || "laps";
  const eventId = url.searchParams.get("eventId") || env.EVENT_ID || DEFAULT_EVENT_ID;

  let csv = "";
  let filename = `race_${type}_${Date.now()}.csv`;

  if (type === "laps") {
    const { results } = await env.DB.prepare("SELECT * FROM laps WHERE event_id = ? ORDER BY lap_num ASC").bind(eventId).all();
    csv = "Lap_Num,Driver,Time_Formatted,Time_MS,Top_Speed_MPH,Avg_Speed_MPH,Fuel_Used_Gal,Cones,Status,Start_Time_ISO,Finish_Time_ISO\n";
    results.forEach(r => {
      csv += `${r.lap_num},"${r.driver_name}",${r.lap_time_formatted},${r.lap_time_ms},${r.top_speed_mph},${r.avg_speed_mph},${r.fuel_used_gal},${r.cones},${r.status},${new Date(r.start_time).toISOString()},${new Date(r.finish_time).toISOString()}\n`;
    });
  } else if (type === "stints") {
    const { results } = await env.DB.prepare("SELECT * FROM stints WHERE event_id = ? ORDER BY stint_num ASC").bind(eventId).all();
    csv = "Stint_Num,Driver,Duration_Mins,Lap_Count,Miles_Driven,Start_Fuel_Gal,End_Fuel_Gal,Start_Time_ISO,End_Time_ISO,Notes\n";
    results.forEach(r => {
      const durMins = (r.duration_ms / 60000).toFixed(1);
      csv += `${r.stint_num},"${r.driver_name}",${durMins},${r.lap_count},${r.miles_driven},${r.start_fuel_gal},${r.end_fuel_gal},${new Date(r.start_time).toISOString()},${new Date(r.end_time).toISOString()},"${r.notes || ''}"\n`;
    });
  } else if (type === "pitstops") {
    const { results } = await env.DB.prepare("SELECT * FROM pitstops WHERE event_id = ? ORDER BY pit_num ASC").bind(eventId).all();
    csv = "Pit_Num,Duration_Sec,Driver_Out,Driver_In,Fuel_Added_Gal,In_Time_ISO,Out_Time_ISO,Notes\n";
    results.forEach(r => {
      csv += `${r.pit_num},${r.duration_sec},"${r.driver_out}","${r.driver_in}",${r.fuel_added_gal},${new Date(r.in_time).toISOString()},${new Date(r.out_time).toISOString()},"${r.notes || ''}"\n`;
    });
  } else if (type === "telemetry") {
    const { results } = await env.DB.prepare("SELECT * FROM telemetry_raw WHERE event_id = ? ORDER BY timestamp ASC LIMIT 50000").bind(eventId).all();
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
 * Exports standard GPX file of the raw telemetry points for RaceRender / GoPro video overlays.
 */
async function handleExportGpx(url, env) {
  if (!env.DB) return new Response("Database not bound", { status: 500 });
  const eventId = url.searchParams.get("eventId") || env.EVENT_ID || DEFAULT_EVENT_ID;
  const { results } = await env.DB.prepare("SELECT * FROM telemetry_raw WHERE event_id = ? ORDER BY timestamp ASC").bind(eventId).all();

  let gpx = `<?xml version="1.0" encoding="UTF-8"?>
<gpx version="1.1" creator="RaceTelemetry Cloudflare Worker" xmlns="http://www.topografix.com/GPX/1/1">
  <trk>
    <name>Race Telemetry - ${eventId}</name>
    <trkseg>
`;

  results.forEach(pt => {
    const speedMps = (pt.speed_mph * 0.44704).toFixed(2); // Convert MPH to m/s for GPX spec
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
 * Returns analysis summary JSON for post-race analysis or dashboards.
 */
async function handleAnalysisSummary(url, env) {
  if (!env.DB) return new Response(JSON.stringify({ error: "D1 DB not bound" }), { status: 500, headers: corsHeaders });
  const eventId = url.searchParams.get("eventId") || env.EVENT_ID || DEFAULT_EVENT_ID;

  const [laps, stints, pitstops] = await Promise.all([
    env.DB.prepare("SELECT * FROM laps WHERE event_id = ? ORDER BY lap_num ASC").bind(eventId).all(),
    env.DB.prepare("SELECT * FROM stints WHERE event_id = ? ORDER BY stint_num ASC").bind(eventId).all(),
    env.DB.prepare("SELECT * FROM pitstops WHERE event_id = ? ORDER BY pit_num ASC").bind(eventId).all()
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
