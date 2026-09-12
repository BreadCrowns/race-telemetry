# Cloudflare Worker & D1 Database Setup Guide

This Cloudflare Worker ingests background GPS data from **Traccar Client**, streams live telemetry to **Firebase Realtime Database** for the pit wall and PRISM overlay, and permanently archives every **stint, lap, driver, pit stop, and raw telemetry point** into **Cloudflare D1 (SQLite)** for post-race analysis.

---

## 1. Quick Deployment (3 Steps)

### Step 1: Install Wrangler CLI (if not already installed)
```bash
npm install -g wrangler
wrangler login
```

### Step 2: Create your Cloudflare D1 Database
Run this command from inside the `cloudflare-worker` directory:
```bash
npx wrangler d1 create race-telemetry-db
```
* Wrangler will print out a `database_id` (e.g. `xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx`).
* Copy that ID into [wrangler.toml](file:///c:/Users/bazar/Documents/antigravity/clever-fermi/cloudflare-worker/wrangler.toml) replacing `YOUR_D1_DATABASE_ID`.

### Step 3: Initialize Database Tables & Deploy
Execute the SQL schema to create the tables in D1:
```bash
npx wrangler d1 execute race-telemetry-db --file=./schema.sql
```

Then deploy the worker:
```bash
npx wrangler deploy
```
Wrangler will output your live URL:
`https://race-telemetry-worker.<your-subdomain>.workers.dev`

---

## 2. Configure Traccar Client on Cockpit Phone

In the Traccar Client app:
1. **Server URL**: `https://race-telemetry-worker.<your-subdomain>.workers.dev`
2. **Frequency**: `1` second
3. **Distance**: `0`
4. **Offline buffering**: `Enabled` (default)
5. Tap **Status**: It should show `Location update sent` with HTTP 200 OK.

---

## 3. Endpoints & Analysis Exports

Once deployed, you can use these endpoints directly from the pit wall or in a Python / Jupyter notebook for race analysis:

* `GET /` or `GET /traccar`: Traccar ingestion endpoint
* `GET /api/export/csv?type=laps`: Download all recorded laps as a CSV spreadsheet
* `GET /api/export/csv?type=stints`: Download all driver stints (lap count, miles, duration, fuel)
* `GET /api/export/csv?type=pitstops`: Download all pit stops with duration and fuel added
* `GET /api/export/csv?type=telemetry`: Download full 1Hz raw GPS telemetry points
* `GET /api/export/gpx`: Download raw `.gpx` file for RaceRender / GoPro video overlays
* `GET /api/analysis`: Returns full JSON of all race metrics for custom web dashboards or Python pandas analysis
