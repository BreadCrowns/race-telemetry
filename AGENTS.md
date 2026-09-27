# Agent Collaboration Guide (Jules & Antigravity)

Welcome! This repository powers a real-time autocross and road-race telemetry system. Both **Jules** (mobile / GitHub-native async agent) and **Antigravity** (workstation pair-programming agent) collaborate on this codebase.

Please review these core architectural guidelines before modifying the codebase.

---

## 1. Directory Structure & Environment Isolation

```
├── prepro/                  # 🧪 PRE-PRODUCTION SANDBOX (ACTIVE DEVELOPMENT)
│   ├── index.html           # Control Tower Hub & Event Archive Manager
│   ├── pitwall.html         # Live Pit Wall Ledger + F1 Broadcast Visualizer
│   ├── analysis.html        # GPS Racing Lines, Speed & G-Force Heatmaps
│   ├── gates.html           # Satellite Course Gates Calibrator
│   └── overlay.html         # Stream / OBS HUD Overlay
├── cloudflare-worker/       # ☁️ INGESTION WORKER & AUTO-TIMING ENGINE
│   ├── worker.js            # Ingestion for Sensor Logger & Traccar, D1, Firebase sync
│   └── wrangler.toml        # Cloudflare Worker configuration & D1 bindings
├── scripts/                 # 🛠️ TESTING & DATA UTILITIES
│   ├── bundle_telemetry.js  # Telemetry CSV-to-JSON bundler
│   ├── test_autox_timing.js # Kinematic gate-crossing simulation
│   └── verify_*.js          # Puppeteer browser verification suites
└── [root html files]        # 🔒 FROZEN PRODUCTION FILES (Do not edit directly)
    ├── pitwall.html, analysis.html, leaderboard.html, overlay.html
```

> **CRITICAL RULE**: All frontend development, new features, and layout iterations **must be made inside `prepro/`**. The root HTML files (`/analysis.html`, `/pitwall.html`, etc.) are production-frozen and should only be touched when promoting validated prepro versions.

---

## 2. Ingestion & Telemetry Architecture

1. **In-Car Phone is Silent & Blind**:
   - The driver's phone runs **Sensor Logger** or **Traccar** in background transponder mode.
   - No interaction or display is shown inside the cockpit during runs.
   - All timing, scoring, state machines, and debriefs live on the server and Pit Wall.

2. **Sensor Logger Ingestion (`cloudflare-worker/worker.js`)**:
   - Ingests batched JSON payloads with `locations` (GPS) and `accelerometers` (3-axis).
   - Accelerometer values are in $\text{m/s}^2$ ($a_x = \text{lateral}$, $a_y = \text{longitudinal}$, $a_z = \text{vertical}$).
   - Lateral G-force formula:
     $$\text{Lat G} = \frac{|a_x|}{9.81}$$
   - Packets are stored in Firebase RTDB (`raceTelemetry`) and Cloudflare D1 SQLite (`telemetry_raw`).

3. **Multi-Event Manager & Single Active Session**:
   - Exactly **1 event** is active at any time: `raceTelemetry/activeEvent`.
   - Incoming pings automatically route to the active event's database node without needing in-car reconfiguration:
     `raceTelemetry/events/${eventId}/runs`
   - Archive mode: `pitwall.html?event=${eventId}` renders past sessions in read-only mode.

---

## 3. Key UI & Visualizer Conventions

1. **Pit Wall Ledger (`prepro/pitwall.html`)**:
   - **Order**: Always sorted by timestamp descending (newest run at the top).
   - **Arrival**: New runs insert with a non-disruptive pulse animation (`@keyframes row-new-pulse`).
   - **Accordion Debrief**: Tapping any row opens an in-place debrief drawer with:
     - **Line 1 (Benchmark)**: Slate gray line (`#94a3b8`) of the day's fastest clean run.
     - **Line 2 (Delta Line)**: Colored by speed delta ($> +1.5\text{ mph}$ green, $< -1.5\text{ mph}$ red).
     - Inline driver change, cone penalty toggles, and notes auto-saving to Firebase.
2. **F1 Broadcast Visualizer**:
   - Displayed at the top of the Pit Wall Ledger.
   - Shows running digital clock, speed chip, sector label, and real-time running delta vs. day's best lap.
   - The course ribbon is derived dynamically from consensus runs. Live GPS points are projected perpendicularly onto the course ribbon to eliminate GPS jitter.
3. **GPS Analysis View (`prepro/analysis.html`)**:
   - Supports 3 line coloring modes:
     1. `driver`: Distinct color per driver.
     2. `heatmap`: Speed gradient ($0\text{ mph}$ cyan $\rightarrow 25\text{ mph}$ green $\rightarrow 45+\text{ mph}$ red).
     3. `gforce`: Lateral acceleration ($< 0.4\text{G}$ green $\rightarrow 0.6\text{G}$ yellow $\rightarrow > 0.8\text{G}$ red).

---

## 4. Jules + Antigravity Workflow Guidelines

* **When using Jules on Mobile**:
  * Work on a feature branch (`git checkout -b feature/xyz`) and open a Pull Request.
  * Focus on scoped backend endpoints, calculation refinements, script utilities, or prepro sandbox enhancements.
  * Always target files inside `prepro/` or `cloudflare-worker/`.
* **When using Antigravity on Desktop**:
  * Pull Jules' feature branches and run automated browser verification (`node scripts/verify_*.js`).
  * Verify visual rendering, Leaflet maps, and responsive layouts across viewports.
  * Merge and deploy to `main` once validated.
