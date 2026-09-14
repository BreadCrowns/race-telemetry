// scripts/build_analysis_html.js
const fs = require('fs');
const path = require('path');

const bundledData = fs.readFileSync(path.join(__dirname, '..', 'runs_telemetry.json'), 'utf8');

const htmlContent = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no"/>
  <title>Sonoma Autocross GPS Racing Lines & Telemetry Analysis</title>

  <!-- Cache-Control Meta Tags -->
  <meta http-equiv="Cache-Control" content="no-cache, no-store, must-revalidate" />
  <meta http-equiv="Pragma" content="no-cache" />
  <meta http-equiv="Expires" content="0" />

  <!-- Leaflet CSS & JS -->
  <link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css" />
  <script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>

  <style>
    :root {
      --bg: #050811;
      --card-bg: #0f172a;
      --border: #1e293b;
      --accent: #f97316;
      --text: #f8fafc;
      --text-muted: #94a3b8;
      --color-liam: #06b6d4;
      --color-jeff: #f97316;
      --color-ryan: #22c55e;
      --color-matt: #a855f7;
    }

    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      background: var(--bg);
      color: var(--text);
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, monospace;
      height: 100vh;
      overflow: hidden;
      display: flex;
      flex-direction: column;
    }

    /* TOP NAV HEADER */
    .app-header {
      background: rgba(15, 23, 42, 0.95);
      border-bottom: 1px solid var(--border);
      padding: 10px 16px;
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 12px;
      z-index: 1000;
      flex-shrink: 0;
    }
    .header-left {
      display: flex;
      align-items: center;
      gap: 12px;
    }
    .btn-back {
      background: #1e293b;
      color: #94a3b8;
      border: 1px solid #334155;
      padding: 6px 12px;
      border-radius: 6px;
      font-size: 12px;
      font-weight: 700;
      text-decoration: none;
      transition: all 0.15s;
      display: inline-flex;
      align-items: center;
      gap: 6px;
      white-space: nowrap;
      flex-shrink: 0;
    }
    .btn-back:hover { background: #334155; color: #fff; }
    .header-title {
      font-size: 15px;
      font-weight: 900;
      letter-spacing: 0.5px;
      display: flex;
      align-items: center;
      gap: 8px;
      white-space: nowrap;
    }
    .title-short { display: none; }
    .header-tag {
      background: #ea580c;
      color: #fff;
      font-size: 10px;
      font-weight: 800;
      padding: 2px 6px;
      border-radius: 4px;
      letter-spacing: 1px;
      text-transform: uppercase;
    }
    .header-stats {
      display: flex;
      gap: 8px;
      font-size: 12px;
      color: var(--text-muted);
    }
    .stat-chip {
      background: rgba(30, 41, 59, 0.6);
      border: 1px solid rgba(255,255,255,0.06);
      padding: 3px 8px;
      border-radius: 4px;
      font-family: ui-monospace, monospace;
      white-space: nowrap;
    }
    .stat-chip strong { color: #38bdf8; }

    .header-controls {
      display: flex;
      align-items: center;
      gap: 6px;
    }
    .ctrl-btn {
      background: #1e293b;
      color: #cbd5e1;
      border: 1px solid #334155;
      padding: 6px 11px;
      border-radius: 6px;
      font-size: 12px;
      font-weight: 700;
      cursor: pointer;
      transition: all 0.15s;
      display: inline-flex;
      align-items: center;
      gap: 5px;
      white-space: nowrap;
      flex-shrink: 0;
    }
    .ctrl-btn:hover { border-color: var(--accent); color: #fff; }
    .ctrl-btn.active {
      background: var(--accent);
      border-color: var(--accent);
      color: #fff;
    }

    .desktop-quick-bar {
      display: flex;
      align-items: center;
      gap: 6px;
    }

    .btn-options-toggle {
      background: #1e293b;
      color: #cbd5e1;
      border: 1px solid #334155;
    }
    .btn-options-toggle.active, .btn-options-toggle:hover {
      border-color: var(--accent);
      color: #fff;
    }

    /* OPTIONS DROPDOWN & BACKDROP */
    .options-backdrop {
      position: fixed;
      inset: 0;
      background: rgba(0, 0, 0, 0.65);
      backdrop-filter: blur(2px);
      z-index: 1150;
      opacity: 0;
      pointer-events: none;
      transition: opacity 0.2s ease;
    }
    .options-backdrop.active {
      opacity: 1;
      pointer-events: auto;
    }

    .options-dropdown {
      position: fixed;
      top: 54px;
      right: 14px;
      width: 330px;
      max-width: calc(100vw - 28px);
      background: #0f172a;
      border: 1px solid #334155;
      border-radius: 12px;
      padding: 16px;
      box-shadow: 0 20px 45px rgba(0,0,0,0.75);
      z-index: 1200;
      display: none;
      flex-direction: column;
      gap: 14px;
    }
    .options-dropdown.open {
      display: flex;
    }
    .options-dropdown-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      border-bottom: 1px solid #1e293b;
      padding-bottom: 8px;
    }
    .options-dropdown-title {
      font-size: 13px;
      font-weight: 800;
      color: #38bdf8;
      text-transform: uppercase;
      letter-spacing: 0.5px;
    }
    .btn-close-options {
      background: #1e293b;
      border: 1px solid #334155;
      color: #94a3b8;
      width: 26px;
      height: 26px;
      border-radius: 6px;
      cursor: pointer;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 12px;
      font-weight: bold;
    }
    .btn-close-options:hover { color: #fff; border-color: var(--accent); }
    .options-section {
      display: flex;
      flex-direction: column;
      gap: 6px;
      border-bottom: 1px solid #1e293b;
      padding-bottom: 10px;
    }
    .options-label {
      font-size: 11px;
      font-weight: 700;
      color: #94a3b8;
      text-transform: uppercase;
      letter-spacing: 0.5px;
    }
    .options-btn-group {
      display: flex;
      gap: 6px;
      flex-wrap: wrap;
    }
    .opt-btn {
      flex: 1;
      min-width: 80px;
      background: #1e293b;
      color: #cbd5e1;
      border: 1px solid #334155;
      padding: 7px 10px;
      border-radius: 6px;
      font-size: 11px;
      font-weight: 700;
      cursor: pointer;
      text-align: center;
      transition: all 0.15s;
      white-space: nowrap;
    }
    .opt-btn:hover { border-color: var(--accent); color: #fff; }
    .opt-btn.active {
      background: var(--accent);
      border-color: var(--accent);
      color: #fff;
    }
    .opt-checkbox-row {
      display: flex;
      align-items: center;
      gap: 8px;
      cursor: pointer;
      color: #e2e8f0;
      font-size: 12px;
      padding: 4px 0;
    }
    .opt-checkbox-row input {
      accent-color: var(--accent);
      width: 16px;
      height: 16px;
      cursor: pointer;
    }
    .opt-subtext {
      font-size: 10px;
      color: #64748b;
      line-height: 1.4;
    }
    .opt-action-btn {
      width: 100%;
      background: #1e293b;
      border: 1px solid #334155;
      color: #cbd5e1;
      padding: 8px 12px;
      border-radius: 6px;
      font-size: 12px;
      font-weight: 800;
      cursor: pointer;
      transition: all 0.15s;
    }
    .opt-action-btn:hover { background: var(--accent); border-color: var(--accent); color: #fff; }

    /* BUTTON TO OPEN SIDEBAR (MOBILE HEADER) */
    .btn-toggle-sidebar {
      background: #ea580c;
      color: #fff;
      border: none;
      padding: 6px 12px;
      border-radius: 6px;
      font-size: 12px;
      font-weight: 800;
      cursor: pointer;
      display: none;
      align-items: center;
      gap: 6px;
      white-space: nowrap;
      flex-shrink: 0;
    }
    .btn-toggle-sidebar:hover { background: #c2410c; }

    /* MAIN WORKSPACE LAYOUT */
    .main-workspace {
      display: flex;
      flex: 1;
      height: calc(100vh - 53px);
      position: relative;
      overflow: hidden;
    }

    /* BACKDROP OVERLAY FOR MOBILE DRAWER */
    .sidebar-backdrop {
      position: fixed;
      inset: 0;
      background: rgba(0, 0, 0, 0.65);
      backdrop-filter: blur(2px);
      z-index: 1300;
      opacity: 0;
      pointer-events: none;
      transition: opacity 0.25s ease;
    }
    .sidebar-backdrop.active {
      opacity: 1;
      pointer-events: auto;
    }

    /* SIDEBAR (DESKTOP DEFAULT) */
    .sidebar {
      width: 380px;
      background: #090e1a;
      border-right: 1px solid var(--border);
      display: flex;
      flex-direction: column;
      flex-shrink: 0;
      z-index: 500;
      transition: transform 0.25s ease, margin 0.25s ease;
    }
    .sidebar.collapsed {
      transform: translateX(-380px);
      margin-right: -380px;
    }
    .sidebar-header {
      padding: 12px 14px;
      border-bottom: 1px solid var(--border);
      display: flex;
      flex-direction: column;
      gap: 10px;
      background: #0f172a;
    }
    .sidebar-title-bar {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 8px;
    }
    .sidebar-heading {
      font-size: 12px;
      font-weight: 800;
      letter-spacing: 0.5px;
      color: #94a3b8;
      text-transform: uppercase;
      display: flex;
      align-items: center;
      gap: 6px;
    }
    .sidebar-heading .badge {
      background: var(--accent);
      color: #fff;
      font-size: 10px;
      padding: 1px 6px;
      border-radius: 10px;
      font-weight: 800;
    }
    .btn-close-sidebar {
      background: #1e293b;
      color: #cbd5e1;
      border: 1px solid #334155;
      padding: 4px 10px;
      border-radius: 6px;
      font-size: 11px;
      font-weight: 800;
      cursor: pointer;
      display: none;
    }
    .btn-close-sidebar:hover { background: #334155; color: #fff; }

    .driver-filter-pills {
      display: flex;
      gap: 4px;
    }
    .filter-pill {
      flex: 1;
      background: #1e293b;
      color: #94a3b8;
      border: 1px solid #334155;
      padding: 6px 4px;
      border-radius: 6px;
      font-size: 11px;
      font-weight: 800;
      text-align: center;
      cursor: pointer;
      text-transform: uppercase;
      transition: all 0.15s;
    }
    .filter-pill:hover { color: #fff; }
    .filter-pill.active {
      background: #334155;
      color: #fff;
      border-color: #64748b;
    }
    .filter-pill.active[data-driver="Liam"] { background: var(--color-liam); color:#000; border-color: var(--color-liam); }
    .filter-pill.active[data-driver="Jeff"] { background: var(--color-jeff); color:#fff; border-color: var(--color-jeff); }
    .filter-pill.active[data-driver="Ryan"] { background: var(--color-ryan); color:#000; border-color: var(--color-ryan); }
    .filter-pill.active[data-driver="Matt"] { background: var(--color-matt); color:#fff; border-color: var(--color-matt); }

    .quick-actions {
      display: flex;
      justify-content: space-between;
      align-items: center;
      font-size: 11px;
    }
    .link-action {
      color: #38bdf8;
      cursor: pointer;
      text-decoration: none;
      font-weight: 700;
    }
    .link-action:hover { text-decoration: underline; }

    .sidebar-footer {
      display: none;
      padding: 10px 14px;
      background: #0f172a;
      border-top: 1px solid var(--border);
      flex-shrink: 0;
    }
    .btn-drawer-apply {
      width: 100%;
      background: var(--accent);
      color: #fff;
      border: none;
      padding: 11px 14px;
      border-radius: 8px;
      font-size: 13px;
      font-weight: 800;
      cursor: pointer;
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 6px;
      box-shadow: 0 4px 12px rgba(234, 88, 12, 0.4);
    }
    .btn-drawer-apply:hover { background: #c2410c; }

    /* RUNS LIST */
    .runs-list {
      flex: 1;
      overflow-y: auto;
      padding: 8px;
      display: flex;
      flex-direction: column;
      gap: 6px;
    }
    .run-card {
      background: #0f172a;
      border: 1px solid var(--border);
      border-radius: 8px;
      padding: 10px 12px;
      display: flex;
      align-items: center;
      gap: 10px;
      cursor: pointer;
      transition: all 0.15s;
      position: relative;
    }
    .run-card:hover {
      border-color: #475569;
      background: #131d35;
    }
    .run-card.selected {
      border-color: var(--accent);
      background: #1e293b;
      box-shadow: 0 2px 10px rgba(0,0,0,0.3);
    }
    .run-checkbox {
      width: 16px;
      height: 16px;
      cursor: pointer;
      accent-color: var(--accent);
    }
    .run-driver-bar {
      width: 4px;
      height: 38px;
      border-radius: 2px;
      flex-shrink: 0;
    }
    .run-info-col {
      flex: 1;
      min-width: 0;
    }
    .run-title-row {
      display: flex;
      align-items: baseline;
      justify-content: space-between;
      gap: 6px;
    }
    .run-driver-name {
      font-weight: 800;
      font-size: 13px;
      color: #fff;
    }
    .run-num-badge {
      font-size: 11px;
      font-weight: 700;
      color: #94a3b8;
    }
    .run-time-display {
      font-size: 15px;
      font-weight: 900;
      font-family: ui-monospace, monospace;
      color: #4ade80;
    }
    .run-time-display.dnf { color: #f87171; }
    .run-meta-row {
      display: flex;
      align-items: center;
      gap: 8px;
      font-size: 11px;
      color: #94a3b8;
      margin-top: 3px;
      font-family: ui-monospace, monospace;
    }
    .run-cones-tag {
      background: rgba(234, 88, 12, 0.2);
      color: #fb923c;
      padding: 1px 4px;
      border-radius: 3px;
      font-weight: 800;
      font-size: 10px;
    }
    .run-notes-snippet {
      font-size: 11px;
      color: #cbd5e1;
      font-style: italic;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
      margin-top: 2px;
    }

    /* MAP CONTAINER */
    .map-container-wrap {
      flex: 1;
      display: flex;
      flex-direction: column;
      position: relative;
      background: #020617;
    }
    #map {
      flex: 1;
      width: 100%;
      height: 100%;
      background: #020617;
    }

    /* MAP OVERLAY FLOATING CONTROLS */
    .map-floating-overlay {
      position: absolute;
      top: 14px;
      right: 14px;
      z-index: 800;
      display: flex;
      flex-direction: column;
      gap: 8px;
    }
    .map-tool-card {
      background: rgba(15, 23, 42, 0.9);
      backdrop-filter: blur(8px);
      border: 1px solid var(--border);
      border-radius: 8px;
      padding: 8px 12px;
      font-size: 12px;
      color: #fff;
      box-shadow: 0 4px 16px rgba(0,0,0,0.5);
    }
    .map-legend {
      display: flex;
      flex-direction: column;
      gap: 6px;
    }
    .legend-row {
      display: flex;
      align-items: center;
      gap: 8px;
      font-size: 11px;
      font-weight: 700;
    }
    .legend-color-box {
      width: 14px;
      height: 14px;
      border-radius: 3px;
    }
    .heatmap-bar {
      width: 130px;
      height: 10px;
      border-radius: 5px;
      background: linear-gradient(to right, #38bdf8, #22c55e, #eab308, #ef4444);
      margin-top: 2px;
    }
    .heatmap-labels {
      display: flex;
      justify-content: space-between;
      font-size: 10px;
      color: #94a3b8;
      font-family: ui-monospace, monospace;
    }

    /* FLOATING RUNS BUTTON (MOBILE) */
    .floating-runs-btn {
      display: none;
      position: absolute;
      top: 14px;
      left: 14px;
      z-index: 850;
      background: rgba(15, 23, 42, 0.92);
      backdrop-filter: blur(8px);
      color: #fff;
      border: 1px solid rgba(249, 115, 22, 0.6);
      padding: 8px 14px;
      border-radius: 20px;
      font-size: 12px;
      font-weight: 800;
      box-shadow: 0 4px 16px rgba(0,0,0,0.6);
      cursor: pointer;
      align-items: center;
      gap: 6px;
      transition: all 0.15s;
    }
    .floating-runs-btn:active { transform: scale(0.96); }
    .floating-runs-btn .badge {
      background: var(--accent);
      color: #fff;
      font-size: 10px;
      padding: 1px 6px;
      border-radius: 10px;
      font-weight: 800;
    }

    /* BOTTOM TELEMETRY GRAPH & SCRUBBER PANEL */
    .bottom-telemetry-panel {
      height: 160px;
      background: rgba(15, 23, 42, 0.96);
      border-top: 1px solid var(--border);
      display: flex;
      flex-direction: column;
      padding: 8px 16px;
      gap: 6px;
      flex-shrink: 0;
      z-index: 900;
      transition: height 0.22s cubic-bezier(0.16, 1, 0.3, 1);
    }
    .bottom-telemetry-panel.minimized {
      height: 52px;
    }
    .bottom-telemetry-panel.minimized .graph-container {
      display: none;
    }
    .bottom-telemetry-panel.minimized .readout-dist,
    .bottom-telemetry-panel.minimized .readout-time {
      display: none;
    }

    .telemetry-controls-row {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 10px;
      flex-shrink: 0;
    }
    .playback-btns {
      display: flex;
      align-items: center;
      gap: 6px;
      flex-shrink: 0;
    }
    .play-btn {
      background: #16a34a;
      color: #fff;
      border: none;
      padding: 6px 13px;
      border-radius: 6px;
      font-size: 12px;
      font-weight: 800;
      cursor: pointer;
      display: flex;
      align-items: center;
      gap: 5px;
      transition: background 0.15s;
      white-space: nowrap;
    }
    .play-btn:hover { background: #15803d; }
    .speed-multiplier {
      background: #1e293b;
      color: #94a3b8;
      border: 1px solid #334155;
      padding: 4px 7px;
      border-radius: 4px;
      font-size: 11px;
      font-weight: 700;
      cursor: pointer;
      white-space: nowrap;
    }
    .playback-scrubber {
      flex: 1;
      margin: 0 8px;
      accent-color: var(--accent);
      cursor: pointer;
      min-width: 60px;
    }
    .telemetry-readout {
      display: flex;
      align-items: baseline;
      gap: 10px;
      font-family: ui-monospace, monospace;
      flex-shrink: 0;
    }
    .readout-speed {
      font-size: 19px;
      font-weight: 900;
      color: #f8fafc;
      white-space: nowrap;
    }
    .readout-speed small {
      font-size: 10px;
      color: var(--accent);
      margin-left: 2px;
    }
    .readout-dist {
      font-size: 12px;
      color: #38bdf8;
      white-space: nowrap;
    }
    .readout-time {
      font-size: 12px;
      color: #94a3b8;
      white-space: nowrap;
    }
    .btn-toggle-graph {
      background: #1e293b;
      color: #cbd5e1;
      border: 1px solid #334155;
      padding: 5px 8px;
      border-radius: 6px;
      font-size: 11px;
      font-weight: 700;
      cursor: pointer;
      white-space: nowrap;
      flex-shrink: 0;
      display: flex;
      align-items: center;
      gap: 4px;
    }
    .btn-toggle-graph:hover { background: #334155; color: #fff; }

    /* CANVAS GRAPH */
    .graph-container {
      flex: 1;
      width: 100%;
      position: relative;
      min-height: 48px;
    }
    #speed-chart {
      width: 100%;
      height: 100%;
      display: block;
    }

    .floating-scroll-btn, .btn-scroll-top { display: none; }

    /* RESPONSIVE MOBILE BREAKPOINTS */
    @media (max-width: 900px) {
      html {
        height: auto;
        overflow-y: auto;
        overflow-x: hidden;
      }
      body {
        height: auto !important;
        min-height: 100% !important;
        min-height: 100dvh !important;
        overflow-y: auto !important;
        overflow-x: hidden !important;
        -webkit-overflow-scrolling: touch;
      }
      .app-header {
        flex-direction: row;
        align-items: center;
        justify-content: space-between;
        padding: 8px 10px;
        gap: 4px;
      }
      .header-left {
        width: auto;
        display: flex;
        align-items: center;
        gap: 6px;
      }
      .header-title {
        font-size: 13px;
        white-space: nowrap;
      }
      .title-full {
        display: none;
      }
      .title-short {
        display: inline;
        font-weight: 800;
        font-size: 12px;
      }
      .header-tag {
        display: none;
      }
      .header-stats {
        display: none;
      }
      .btn-toggle-sidebar {
        display: inline-flex;
        padding: 5px 8px;
        font-size: 11px;
      }
      .btn-back {
        padding: 5px 8px;
        font-size: 11px;
        white-space: nowrap;
      }
      .header-controls {
        width: auto;
        overflow: visible;
        display: flex;
        align-items: center;
        gap: 6px;
      }
      .desktop-quick-bar {
        display: none !important;
      }
      .btn-options-toggle {
        display: inline-flex;
        padding: 5px 9px;
        font-size: 11px;
      }
      .floating-runs-btn {
        display: none !important;
      }
      .options-dropdown {
        top: 52px;
        right: 10px;
        left: 10px;
        width: auto;
        max-width: none;
      }

      .main-workspace {
        height: auto;
        min-height: calc(100dvh - 84px);
        overflow: visible;
        display: flex;
        flex-direction: column;
      }
      .map-container-wrap {
        height: auto;
        overflow: visible;
        flex: none;
        display: flex;
        flex-direction: column;
      }
      #map {
        height: 52vh;
        min-height: 340px;
        max-height: 440px;
        width: 100%;
        flex: none;
      }

      /* SIDEBAR AS MODAL OFF-CANVAS DRAWER */
      .sidebar {
        position: fixed;
        top: 0;
        bottom: 0;
        left: 0;
        width: min(88vw, 360px);
        z-index: 1500;
        transform: translateX(-100%);
        transition: transform 0.28s cubic-bezier(0.16, 1, 0.3, 1);
        box-shadow: none;
      }
      .sidebar.open {
        transform: translateX(0);
        box-shadow: 10px 0 35px rgba(0, 0, 0, 0.85);
      }
      .sidebar.collapsed {
        transform: translateX(-100%);
        margin-right: 0;
      }
      .btn-close-sidebar {
        display: block;
      }
      .sidebar-footer {
        display: block;
      }
      .floating-runs-btn {
        display: flex;
      }

      /* MAP OVERLAY LEGEND ON MOBILE */
      .map-floating-overlay {
        top: 8px;
        right: 8px;
        max-width: 190px;
      }
      .map-tool-card {
        padding: 6px 10px;
      }
      #legend-driver-content {
        display: grid;
        grid-template-columns: 1fr 1fr;
        gap: 3px 6px;
      }
      .legend-row {
        font-size: 10px;
        gap: 4px;
      }
      .legend-color-box {
        width: 10px;
        height: 10px;
      }

      /* BOTTOM TIMELINE & TELEMETRY PANEL ON MOBILE */
      .bottom-telemetry-panel {
        height: auto;
        min-height: 195px;
        padding: 12px 14px;
        padding-bottom: calc(28px + env(safe-area-inset-bottom, 20px));
        background: #090e1a;
        border-top: 2px solid var(--accent);
        flex-shrink: 0;
        overflow: visible;
      }
      .bottom-telemetry-panel.minimized {
        height: 54px;
        min-height: 54px;
        padding-bottom: calc(12px + env(safe-area-inset-bottom, 8px));
      }
      .play-btn {
        padding: 6px 12px;
        font-size: 12px;
      }
      .speed-multiplier {
        padding: 4px 7px;
        font-size: 10px;
      }
      .playback-scrubber {
        margin: 0 6px;
      }
      .readout-speed {
        font-size: 18px;
      }
      .readout-speed small {
        font-size: 10px;
      }
      .readout-dist, .readout-time {
        font-size: 11px;
      }
      .graph-container {
        height: 105px;
        min-height: 105px;
        margin-top: 8px;
      }

      .floating-scroll-btn {
        display: inline-flex;
        position: absolute;
        bottom: 14px;
        left: 14px;
        z-index: 850;
        background: rgba(15, 23, 42, 0.92);
        backdrop-filter: blur(8px);
        color: #cbd5e1;
        border: 1px solid #334155;
        padding: 6px 12px;
        border-radius: 20px;
        font-size: 11px;
        font-weight: 800;
        cursor: pointer;
        align-items: center;
        gap: 4px;
        box-shadow: 0 4px 12px rgba(0,0,0,0.5);
      }
      .floating-scroll-btn:hover { color: #fff; border-color: var(--accent); }
      .btn-scroll-top {
        display: inline-flex;
        background: #1e293b;
        color: #cbd5e1;
        border: 1px solid #334155;
        padding: 5px 8px;
        border-radius: 6px;
        font-size: 11px;
        font-weight: 700;
        cursor: pointer;
        align-items: center;
        gap: 4px;
        white-space: nowrap;
        flex-shrink: 0;
      }
      .btn-scroll-top:hover { color: #fff; border-color: var(--accent); }
    }

    @media (max-width: 480px) {
      .header-title {
        font-size: 12px;
      }
      .btn-back {
        padding: 5px 8px;
        font-size: 11px;
      }
      .btn-toggle-sidebar {
        padding: 5px 8px;
        font-size: 11px;
      }
      .telemetry-readout {
        gap: 6px;
      }
      .readout-dist {
        display: none;
      }
    }

    /* CUSTOM LEAFLET TOOLTIP */
    .leaflet-popup-content-wrapper {
      background: #0f172a !important;
      color: #fff !important;
      border: 1px solid var(--border);
      border-radius: 8px;
    }
    .leaflet-popup-tip {
      background: #0f172a !important;
    }
    .popup-box {
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, monospace;
      display: flex;
      flex-direction: column;
      gap: 4px;
    }
    .popup-title {
      font-size: 13px;
      font-weight: 800;
      color: var(--accent);
    }
    .popup-row {
      font-size: 11px;
      color: #cbd5e1;
      font-family: ui-monospace, monospace;
    }
  </style>
</head>
<body>

  <!-- TOP HEADER -->
  <header class="app-header">
    <div class="header-left">
      <button type="button" class="btn-toggle-sidebar" id="btn-toggle-sidebar" onclick="toggleSidebar()">☰ Runs (4)</button>
      <div class="header-title">
        <span class="title-full">🏁 SONOMA RACEWAY</span>
        <span class="title-short">🏁 SONOMA</span>
        <span class="header-tag">GPS ANALYSIS</span>
      </div>
      <a href="pitwall.html" class="btn-back">← Pit Wall</a>
      <div class="header-stats">
        <div class="stat-chip">Runs: <strong id="stat-total-runs">47</strong></div>
        <div class="stat-chip">Event Best: <strong id="stat-best-time">00:54.16</strong></div>
        <div class="stat-chip">Top Speed: <strong id="stat-top-speed">45.6 MPH</strong></div>
      </div>
    </div>

    <div class="header-controls">
      <!-- DESKTOP QUICK TOOLBAR -->
      <div class="desktop-quick-bar">
        <!-- MAP LAYER SWITCHER -->
        <button type="button" class="ctrl-btn active" id="btn-layer-sat" onclick="setMapLayer('satellite')">🛰️ Satellite</button>
        <button type="button" class="ctrl-btn" id="btn-layer-dark" onclick="setMapLayer('dark')">🌑 Dark</button>
        <button type="button" class="ctrl-btn" id="btn-layer-street" onclick="setMapLayer('street')">🗺️ Street</button>

        <!-- COLOR MODE SWITCHER -->
        <button type="button" class="ctrl-btn active" id="btn-color-driver" onclick="setColorMode('driver')">🎨 Driver Color</button>
        <button type="button" class="ctrl-btn" id="btn-color-heat" onclick="setColorMode('heatmap')">🔥 Speed Heatmap</button>

        <!-- LINE SMOOTHING SWITCHER -->
        <button type="button" class="ctrl-btn active" id="btn-smooth-lines" onclick="toggleLineSmoothing()" title="Toggle Heading-Guided Kinematic Racing Line Smoothing">🏎️ Smooth Lines</button>

        <button type="button" class="ctrl-btn" onclick="fitTrackBounds()" title="Center view on track">🎯 Center</button>
      </div>

      <!-- OPTIONS DROPDOWN BUTTON (MOBILE & DESKTOP) -->
      <button type="button" class="ctrl-btn btn-options-toggle" id="btn-options-toggle" onclick="toggleOptionsMenu()" title="Display & Map Options">
        ⚙️ Options
      </button>
    </div>
  </header>

  <!-- OPTIONS BACKDROP & DROPDOWN MENU -->
  <div class="options-backdrop" id="options-backdrop" onclick="closeOptionsMenu()"></div>
  <div class="options-dropdown" id="options-dropdown">
    <div class="options-dropdown-header">
      <div class="options-dropdown-title">⚙️ Map & Analysis Options</div>
      <button type="button" class="btn-close-options" onclick="closeOptionsMenu()">✕</button>
    </div>

    <div class="options-section">
      <div class="options-label">Map Background</div>
      <div class="options-btn-group">
        <button type="button" class="opt-btn active" id="opt-layer-sat" onclick="setMapLayer('satellite')">🛰️ Satellite</button>
        <button type="button" class="opt-btn" id="opt-layer-dark" onclick="setMapLayer('dark')">🌑 Dark</button>
        <button type="button" class="opt-btn" id="opt-layer-street" onclick="setMapLayer('street')">🗺️ Street</button>
      </div>
    </div>

    <div class="options-section">
      <div class="options-label">Line Colors</div>
      <div class="options-btn-group">
        <button type="button" class="opt-btn active" id="opt-color-driver" onclick="setColorMode('driver')">🎨 Driver Colors</button>
        <button type="button" class="opt-btn" id="opt-color-heat" onclick="setColorMode('heatmap')">🔥 Speed Heatmap</button>
      </div>
    </div>

    <div class="options-section">
      <div class="options-label">GPS Smoothing</div>
      <div class="options-btn-group">
        <button type="button" class="opt-btn active" id="opt-smooth-lines" onclick="setSmoothingMode(true)">🏎️ Smooth (Heading)</button>
        <button type="button" class="opt-btn" id="opt-raw-lines" onclick="setSmoothingMode(false)">📍 Raw (1 Hz)</button>
      </div>
    </div>

    <div class="options-section">
      <div class="options-label">Actual Track Racing Line</div>
      <label class="opt-checkbox-row">
        <input type="checkbox" id="opt-toggle-consensus" checked onchange="toggleConsensusLine(this.checked)" />
        <span><strong>🏁 Actual Racing Line</strong> (Dotted)</span>
      </label>
      <div class="opt-subtext">Consensus track groove extracted from 2,500+ GPS points across all 47 runs via 2D density heatmap. Rendered on the bottom layer.</div>
    </div>

    <div class="options-section" style="border-bottom:none; margin-bottom:0; padding-bottom:0;">
      <button type="button" class="opt-action-btn" onclick="fitTrackBounds(); closeOptionsMenu();">
        🎯 Reset & Center Track Map
      </button>
    </div>
  </div>

  <!-- MAIN WORKSPACE -->
  <div class="main-workspace">
    <!-- BACKDROP FOR MOBILE DRAWER -->
    <div class="sidebar-backdrop" id="sidebar-backdrop" onclick="closeSidebar()"></div>

    <!-- SIDEBAR: RUN SELECTION & FILTERS -->
    <aside class="sidebar" id="sidebar">
      <div class="sidebar-header">
        <div class="sidebar-title-bar">
          <div class="sidebar-heading">
            <span>Select Runs</span>
            <span class="badge badge-run-count" id="sidebar-run-count">4</span>
          </div>
          <button type="button" class="btn-close-sidebar" onclick="closeSidebar()">✕ Done</button>
        </div>

        <div class="driver-filter-pills">
          <button type="button" class="filter-pill active" data-driver="ALL" onclick="filterDriver('ALL')">ALL (47)</button>
          <button type="button" class="filter-pill" data-driver="Liam" onclick="filterDriver('Liam')">LIAM (10)</button>
          <button type="button" class="filter-pill" data-driver="Jeff" onclick="filterDriver('Jeff')">JEFF (12)</button>
          <button type="button" class="filter-pill" data-driver="Ryan" onclick="filterDriver('Ryan')">RYAN (14)</button>
          <button type="button" class="filter-pill" data-driver="Matt" onclick="filterDriver('Matt')">MATT (11)</button>
        </div>

        <div class="quick-actions">
          <span class="link-action" onclick="selectFastestPerDriver()">⚡ Best Run Per Driver</span>
          <span class="link-action" onclick="selectTopN(3)">🏆 Top 3 Overall</span>
          <span class="link-action" onclick="clearAllSelections()">Clear All</span>
        </div>
      </div>

      <!-- RUNS LIST -->
      <div class="runs-list" id="runs-list-container">
        <!-- Rendered by JS -->
      </div>

      <!-- MOBILE DRAWER FOOTER -->
      <div class="sidebar-footer">
        <button type="button" class="btn-drawer-apply" onclick="closeSidebar()">
          <span id="btn-drawer-apply-text">✓ View on Map (4 selected)</span>
        </button>
      </div>
    </aside>

    <!-- MAP CONTAINER -->
    <div class="map-container-wrap">
      <div id="map"></div>

      <!-- FLOATING SCROLL BUTTON (MOBILE) -->
      <button type="button" class="floating-scroll-btn" id="btn-scroll-timeline" onclick="scrollToTimeline()">
        ⬇ Timeline
      </button>

      <!-- FLOATING MAP LEGEND & STATS OVERLAY -->
      <div class="map-floating-overlay">
        <div class="map-tool-card" id="map-legend-card">
          <div class="map-legend" id="legend-driver-content">
            <div class="legend-row"><span class="legend-color-box" style="background:var(--color-liam);"></span> Liam</div>
            <div class="legend-row"><span class="legend-color-box" style="background:var(--color-jeff);"></span> Jeff</div>
            <div class="legend-row"><span class="legend-color-box" style="background:var(--color-ryan);"></span> Ryan</div>
            <div class="legend-row"><span class="legend-color-box" style="background:var(--color-matt);"></span> Matt</div>
            <div class="legend-row" style="margin-top:6px; padding-top:6px; border-top:1px solid #334155; font-size:11px;">
              <span style="color:#f8fafc; font-weight:900; letter-spacing:2px; font-size:12px;">···</span> Track Line
            </div>
          </div>
          <div class="map-legend" id="legend-heat-content" style="display:none;">
            <div style="font-size:11px; font-weight:800;">Speed Gradient</div>
            <div class="heatmap-bar"></div>
            <div class="heatmap-labels">
              <span>0 MPH</span>
              <span>25 MPH</span>
              <span>45+ MPH</span>
            </div>
          </div>
        </div>
      </div>

      <!-- BOTTOM TELEMETRY GRAPH & PLAYBACK SCRUBBER -->
      <div class="bottom-telemetry-panel" id="bottom-telemetry-panel">
        <div class="telemetry-controls-row">
          <div class="playback-btns">
            <button type="button" class="play-btn" id="btn-play" onclick="togglePlayback()">
              <span id="play-icon">▶</span> <span id="play-label">Play</span>
            </button>
            <button type="button" class="speed-multiplier" id="btn-speed-mult" onclick="cyclePlaybackSpeed()">1x</button>
          </div>

          <input type="range" class="playback-scrubber" id="playback-slider" min="0" max="1000" value="0" oninput="onScrub(this.value)" />

          <div class="telemetry-readout">
            <div class="readout-speed"><span id="telemetry-live-speed">0.0</span><small>MPH</small></div>
            <div class="readout-dist"><span id="telemetry-live-dist">0m</span></div>
            <div class="readout-time"><span id="telemetry-live-time">00:00.00</span></div>
          </div>

          <button type="button" class="btn-toggle-graph" id="btn-toggle-graph" onclick="toggleGraphPanel()" title="Toggle speed chart">
            📉
          </button>

          <button type="button" class="btn-scroll-top" onclick="scrollToMap()" title="Back to Map view">
            ⬆ Map
          </button>
        </div>

        <!-- CANVAS SPEED VS DISTANCE PROFILE CHART -->
        <div class="graph-container">
          <canvas id="speed-chart"></canvas>
        </div>
      </div>
    </div>
  </div>

  <!-- EMBEDDED TELEMETRY DATASET -->
  <script id="embedded-data" type="application/json">
${bundledData}
  </script>

  <script>
    // --- APP STATE ---
    let telemetryData = null;
    let map = null;
    let currentTileLayer = null;
    let activeLayerType = "satellite"; // "satellite", "dark", "street"
    let activeColorMode = "driver"; // "driver", "heatmap"
    let currentDriverFilter = "ALL";
    let selectedRunIds = new Set();
    let primaryRunId = null; // Single run being scrubbed/animated
    let runPolylines = new Map(); // runId -> [L.Polyline]
    let mapMarkers = [];
    let carAnimMarker = null;
    let activeLineSmoothing = true; // Heading-guided Hermite kinematic smoothing

    // Playback state
    let isPlaying = false;
    let playbackSpeed = 1;
    let animFraction = 0; // 0.0 to 1.0
    let lastAnimTimestamp = null;
    let animFrameId = null;

    // Driver colors
    const DRIVER_COLORS = {
      Liam: "#06b6d4",
      Jeff: "#f97316",
      Ryan: "#22c55e",
      Matt: "#a855f7"
    };

    // Tile Providers
    const TILE_URLS = {
      satellite: "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}",
      dark: "https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png",
      street: "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
    };
    const TILE_ATTRIB = {
      satellite: "Tiles &copy; Esri &mdash; Source: Esri, i-cubed, USDA, USGS, AEX, GeoEye, Getmapping, Aerogrid, IGN, IGP, UPR-EGP, and the GIS User Community",
      dark: "&copy; <a href='https://www.openstreetmap.org/copyright'>OpenStreetMap</a> &copy; <a href='https://carto.com/attributions'>CARTO</a>",
      street: "&copy; <a href='https://www.openstreetmap.org/copyright'>OpenStreetMap</a>"
    };

    // --- INITIALIZATION ---
    window.addEventListener("DOMContentLoaded", () => {
      loadTelemetryData();
      initMap();
      renderRunsList();
      selectFastestPerDriver(); // Default selection: 1 best run per driver
      initSpeedChart();
    });

    function loadTelemetryData() {
      try {
        const rawJson = document.getElementById("embedded-data").textContent.trim();
        telemetryData = JSON.parse(rawJson);
        console.log("Loaded bundled telemetry runs:", telemetryData.runs.length);
      } catch (err) {
        console.error("Failed to parse embedded telemetry:", err);
      }

      // Update header metrics
      if (telemetryData) {
        document.getElementById("stat-total-runs").textContent = telemetryData.runs.length;
        const validRuns = telemetryData.runs.filter(r => !r.isDnf);
        if (validRuns.length > 0) {
          const sortedByTime = [...validRuns].sort((a, b) => a.rawTimeMs - b.rawTimeMs);
          document.getElementById("stat-best-time").textContent = \`\${sortedByTime[0].finalFormatted} (\${sortedByTime[0].driver})\`;
          const sortedBySpeed = [...validRuns].sort((a, b) => b.maxSpeedMph - a.maxSpeedMph);
          document.getElementById("stat-top-speed").textContent = \`\${sortedBySpeed[0].maxSpeedMph} MPH (\${sortedBySpeed[0].driver})\`;
        }
      }
    }

    // --- LEAFLET MAP SETUP ---
    function initMap() {
      const center = (telemetryData && telemetryData.center) || [38.1596365, -122.4551010];
      map = L.map("map", {
        center: center,
        zoom: 18,
        minZoom: 14,
        maxZoom: 21,
        zoomControl: false
      });
      L.control.zoom({ position: "bottomright" }).addTo(map);

      setMapLayer("satellite");
      initConsensusRacingLine();

      window.addEventListener("resize", () => {
        if (map) map.invalidateSize();
      });
    }

    function setMapLayer(type) {
      activeLayerType = type;
      if (currentTileLayer) {
        map.removeLayer(currentTileLayer);
      }

      currentTileLayer = L.tileLayer(TILE_URLS[type], {
        maxZoom: 21,
        maxNativeZoom: type === "satellite" ? 19 : 20,
        attribution: TILE_ATTRIB[type]
      }).addTo(map);

      document.querySelectorAll("#btn-layer-sat, #opt-layer-sat").forEach(el => el.classList.toggle("active", type === "satellite"));
      document.querySelectorAll("#btn-layer-dark, #opt-layer-dark").forEach(el => el.classList.toggle("active", type === "dark"));
      document.querySelectorAll("#btn-layer-street, #opt-layer-street").forEach(el => el.classList.toggle("active", type === "street"));
    }

    function fitTrackBounds() {
      if (!telemetryData || !telemetryData.bounds) return;
      const b = telemetryData.bounds;
      map.fitBounds([
        [b.minLat, b.minLon],
        [b.maxLat, b.maxLon]
      ], { padding: [40, 40] });
    }

    function setColorMode(mode) {
      activeColorMode = mode;
      document.querySelectorAll("#btn-color-driver, #opt-color-driver").forEach(el => el.classList.toggle("active", mode === "driver"));
      document.querySelectorAll("#btn-color-heat, #opt-color-heat").forEach(el => el.classList.toggle("active", mode === "heatmap"));

      document.getElementById("legend-driver-content").style.display = mode === "driver" ? "flex" : "none";
      document.getElementById("legend-heat-content").style.display = mode === "heatmap" ? "flex" : "none";

      updateMapPolylines();
    }

    // --- SPEED HEATMAP COLOR MAPPER ---
    // 0 -> Cyan (#38bdf8), 22 -> Green (#22c55e), 33 -> Yellow/Orange (#eab308), 44+ -> Red (#ef4444)
    function getSpeedColor(speedMph) {
      if (speedMph < 18) return "#38bdf8"; // slow / braking
      if (speedMph < 27) return "#22c55e"; // moderate
      if (speedMph < 35) return "#eab308"; // fast sweeper
      return "#ef4444"; // full throttle
    }

    // --- HEADING-GUIDED KINEMATIC RACING LINE SMOOTHING ---
    const TRACK_CENTER_LAT = 38.1598, TRACK_CENTER_LON = -122.4551;
    const METERS_PER_LAT = 111030;
    const METERS_PER_LON = 111030 * Math.cos(TRACK_CENTER_LAT * Math.PI / 180);

    function toTrackXY(lat, lon) {
      return { x: (lon - TRACK_CENTER_LON) * METERS_PER_LON, y: (lat - TRACK_CENTER_LAT) * METERS_PER_LAT };
    }
    function toTrackLatLon(x, y) {
      return { lat: TRACK_CENTER_LAT + y / METERS_PER_LAT, lon: TRACK_CENTER_LON + x / METERS_PER_LON };
    }

    function hermiteBasis(p0, p1, t0, t1, t) {
      const t2 = t * t;
      const t3 = t2 * t;
      const h00 = 2 * t3 - 3 * t2 + 1;
      const h10 = t3 - 2 * t2 + t;
      const h01 = -2 * t3 + 3 * t2;
      const h11 = t3 - t2;
      return {
        x: h00 * p0.x + h10 * t0.x + h01 * p1.x + h11 * t1.x,
        y: h00 * p0.y + h10 * t0.y + h01 * p1.y + h11 * t1.y
      };
    }

    function getSmoothedCoords(run) {
      if (run._smoothedCoords) return run._smoothedCoords;
      if (!run.coords || run.coords.length < 2) return run.coords;

      const coords = run.coords;
      const xyPts = coords.map((c, i) => {
        const xy = toTrackXY(c.lat, c.lon);
        const spdMs = Math.max(1.5, (c.speed || 0) * 0.44704);
        
        let hdg = c.heading;
        if (!hdg && hdg !== 0) {
          if (i < coords.length - 1) {
            const nextXY = toTrackXY(coords[i+1].lat, coords[i+1].lon);
            hdg = (Math.atan2(nextXY.x - xy.x, nextXY.y - xy.y) * 180 / Math.PI + 360) % 360;
          } else if (i > 0) {
            const prevXY = toTrackXY(coords[i-1].lat, coords[i-1].lon);
            hdg = (Math.atan2(xy.x - prevXY.x, xy.y - prevXY.y) * 180 / Math.PI + 360) % 360;
          } else {
            hdg = 0;
          }
        }
        const rad = (hdg || 0) * Math.PI / 180;
        return {
          ...c,
          x: xy.x,
          y: xy.y,
          vx: spdMs * Math.sin(rad),
          vy: spdMs * Math.cos(rad)
        };
      });

      const smoothed = [];
      const steps = 5;
      for (let i = 0; i < xyPts.length - 1; i++) {
        const p0 = xyPts[i];
        const p1 = xyPts[i + 1];
        let dt = (p1.ts - p0.ts) / 1000;
        if (isNaN(dt) || dt <= 0 || dt > 5) dt = 1.0;

        const chordDist = Math.hypot(p1.x - p0.x, p1.y - p0.y);
        let scale0 = dt;
        let scale1 = dt;
        const t0Mag = Math.hypot(p0.vx, p0.vy) * dt;
        const t1Mag = Math.hypot(p1.vx, p1.vy) * dt;

        const maxTan = 1.25 * chordDist;
        if (t0Mag > maxTan && chordDist > 0) scale0 = maxTan / Math.hypot(p0.vx, p0.vy);
        if (t1Mag > maxTan && chordDist > 0) scale1 = maxTan / Math.hypot(p1.vx, p1.vy);

        const t0 = { x: p0.vx * scale0, y: p0.vy * scale0 };
        const t1 = { x: p1.vx * scale1, y: p1.vy * scale1 };

        for (let s = 0; s < steps; s++) {
          const t = s / steps;
          const interXY = hermiteBasis(p0, p1, t0, t1, t);
          const ll = toTrackLatLon(interXY.x, interXY.y);
          const speed = p0.speed + t * (p1.speed - p0.speed);
          const relMs = p0.relMs !== undefined ? p0.relMs + t * (p1.relMs - p0.relMs) : 0;
          const distM = p0.distM !== undefined ? p0.distM + t * (p1.distM - p0.distM) : 0;

          smoothed.push({
            lat: Number(ll.lat.toFixed(7)),
            lon: Number(ll.lon.toFixed(7)),
            speed: Number(speed.toFixed(1)),
            relMs: Math.round(relMs),
            distM: Number(distM.toFixed(1)),
            heading: p0.heading
          });
        }
      }
      smoothed.push({ ...coords[coords.length - 1] });
      run._smoothedCoords = smoothed;
      return smoothed;
    }

    function setSmoothingMode(enabled) {
      activeLineSmoothing = enabled;
      const btn = document.getElementById("btn-smooth-lines");
      if (btn) {
        btn.classList.toggle("active", activeLineSmoothing);
        btn.innerHTML = activeLineSmoothing ? "🏎️ Smooth Lines" : "📍 Raw 1Hz GPS";
      }
      const optSmooth = document.getElementById("opt-smooth-lines");
      const optRaw = document.getElementById("opt-raw-lines");
      if (optSmooth) optSmooth.classList.toggle("active", activeLineSmoothing);
      if (optRaw) optRaw.classList.toggle("active", !activeLineSmoothing);
      updateMapPolylines();
    }

    function toggleLineSmoothing() {
      setSmoothingMode(!activeLineSmoothing);
    }

    // --- OPTIONS DROPDOWN MENU HANDLERS ---
    function toggleOptionsMenu() {
      const dd = document.getElementById("options-dropdown");
      const bd = document.getElementById("options-backdrop");
      const btn = document.getElementById("btn-options-toggle");
      if (!dd) return;
      const isOpen = dd.classList.toggle("open");
      if (bd) bd.classList.toggle("active", isOpen);
      if (btn) btn.classList.toggle("active", isOpen);
    }

    function closeOptionsMenu() {
      const dd = document.getElementById("options-dropdown");
      const bd = document.getElementById("options-backdrop");
      const btn = document.getElementById("btn-options-toggle");
      if (dd) dd.classList.remove("open");
      if (bd) bd.classList.remove("active");
      if (btn) btn.classList.remove("active");
    }

    // --- ACTUAL TRACK RACING LINE (HEATMAP CONSENSUS DOTTED OVERLAY) ---
    let consensusPolylineGroup = null;
    let showConsensusLine = true;

    function initConsensusRacingLine() {
      if (!map || !telemetryData || !telemetryData.consensusLine) return;

      // Dedicated pane rendered strictly BELOW overlayPane (zIndex: 390 vs 400)
      if (!map.getPane('consensusPane')) {
        map.createPane('consensusPane');
        map.getPane('consensusPane').style.zIndex = 390;
        map.getPane('consensusPane').style.pointerEvents = 'none';
      }

      const latlngs = telemetryData.consensusLine;
      if (!latlngs || latlngs.length < 2) return;

      // Contrast halo for high visibility on satellite imagery
      const halo = L.polyline(latlngs, {
        pane: 'consensusPane',
        color: '#000000',
        weight: 5.5,
        opacity: 0.8,
        lineCap: 'round',
        lineJoin: 'round'
      });

      // Core crisp dotted track racing line
      const core = L.polyline(latlngs, {
        pane: 'consensusPane',
        color: '#f8fafc',
        weight: 2.5,
        dashArray: '3, 6',
        opacity: 0.92,
        lineCap: 'round',
        lineJoin: 'round'
      });

      halo.bindTooltip("🏁 Consensus Track Racing Line (Heatmap Peak)", { direction: "top", sticky: true });
      core.bindTooltip("🏁 Consensus Track Racing Line (Heatmap Peak)", { direction: "top", sticky: true });

      consensusPolylineGroup = L.layerGroup([halo, core]);
      if (showConsensusLine) {
        consensusPolylineGroup.addTo(map);
      }
    }

    function toggleConsensusLine(visible) {
      showConsensusLine = visible;
      const chk = document.getElementById("opt-toggle-consensus");
      if (chk) chk.checked = visible;

      if (!consensusPolylineGroup) return;
      if (showConsensusLine) {
        if (!map.hasLayer(consensusPolylineGroup)) {
          map.addLayer(consensusPolylineGroup);
        }
      } else {
        if (map.hasLayer(consensusPolylineGroup)) {
          map.removeLayer(consensusPolylineGroup);
        }
      }
    }

    // --- RENDER RUN POLYLINES ON MAP ---
    function updateMapPolylines() {
      // Clear existing
      runPolylines.forEach(layers => {
        layers.forEach(l => map.removeLayer(l));
      });
      runPolylines.clear();

      mapMarkers.forEach(m => map.removeLayer(m));
      mapMarkers = [];

      if (!telemetryData) return;

      selectedRunIds.forEach(runId => {
        const run = telemetryData.runs.find(r => r.id === runId);
        if (!run || !run.coords || run.coords.length < 2) return;

        const isPrimary = run.id === primaryRunId;
        const driverColor = DRIVER_COLORS[run.driver] || "#f97316";
        const layers = [];
        const renderCoords = activeLineSmoothing ? getSmoothedCoords(run) : run.coords;

        if (activeColorMode === "driver") {
          // Single solid colored line with glow
          const latlngs = renderCoords.map(c => [c.lat, c.lon]);

          // Glow backdrop
          const glow = L.polyline(latlngs, {
            color: "#000",
            weight: isPrimary ? 8 : 6,
            opacity: 0.6,
            lineCap: "round",
            lineJoin: "round"
          }).addTo(map);
          layers.push(glow);

          const line = L.polyline(latlngs, {
            color: driverColor,
            weight: isPrimary ? 5 : 3.5,
            opacity: isPrimary ? 1.0 : 0.8,
            lineCap: "round",
            lineJoin: "round"
          }).addTo(map);

          line.bindPopup(\`
            <div class="popup-box">
              <div class="popup-title">\${run.driver} - Run #\${run.runNum}</div>
              <div class="popup-row">Time: <strong>\${run.finalFormatted}</strong></div>
              <div class="popup-row">Top Speed: <strong>\${run.maxSpeedMph} MPH</strong></div>
              <div class="popup-row">Distance: <strong>\${run.totalDistanceMeters}m</strong></div>
              \${run.notes ? \`<div class="popup-row" style="color:#f59e0b; margin-top:2px;">"\${run.notes}"</div>\` : ""}
            </div>
          \`);
          layers.push(line);
        } else {
          // Speed Heatmap Mode: segmented polylines
          for (let i = 0; i < renderCoords.length - 1; i++) {
            const p1 = renderCoords[i];
            const p2 = renderCoords[i + 1];
            const segColor = getSpeedColor((p1.speed + p2.speed) / 2);

            const seg = L.polyline([[p1.lat, p1.lon], [p2.lat, p2.lon]], {
              color: segColor,
              weight: isPrimary ? 5.5 : 3.5,
              opacity: isPrimary ? 1.0 : 0.75,
              lineCap: "round"
            }).addTo(map);

            seg.bindPopup(\`
              <div class="popup-box">
                <div class="popup-title">\${run.driver} - Run #\${run.runNum}</div>
                <div class="popup-row">Speed: <strong>\${p1.speed} MPH</strong></div>
                <div class="popup-row">Dist from Start: <strong>\${p1.distM}m</strong></div>
                <div class="popup-row">Elapsed: <strong>\${(p1.relMs / 1000).toFixed(2)}s</strong></div>
              </div>
            \`);
            layers.push(seg);
          }
        }

        // Add Start & Finish flag markers for primary run
        if (isPrimary && run.coords.length > 0) {
          const startPt = run.coords[0];
          const finishPt = run.coords[run.coords.length - 1];

          const startMarker = L.circleMarker([startPt.lat, startPt.lon], {
            radius: 7,
            fillColor: "#22c55e",
            color: "#fff",
            weight: 2,
            opacity: 1,
            fillOpacity: 1
          }).addTo(map).bindTooltip("🟢 START", { permanent: true, direction: "top", className: "map-label" });
          mapMarkers.push(startMarker);

          const finishMarker = L.circleMarker([finishPt.lat, finishPt.lon], {
            radius: 7,
            fillColor: "#ef4444",
            color: "#fff",
            weight: 2,
            opacity: 1,
            fillOpacity: 1
          }).addTo(map).bindTooltip("🏁 FINISH", { permanent: true, direction: "bottom", className: "map-label" });
          mapMarkers.push(finishMarker);
        }

        runPolylines.set(run.id, layers);
      });

      renderAnimatedMarker();
      drawSpeedChart();
    }

    // --- CAR ANIMATION MARKER ON TRACK ---
    function renderAnimatedMarker() {
      if (!primaryRunId || !telemetryData) return;
      const run = telemetryData.runs.find(r => r.id === primaryRunId);
      if (!run || !run.coords || run.coords.length < 2) return;

      const activeCoords = activeLineSmoothing ? getSmoothedCoords(run) : run.coords;
      const totalPoints = activeCoords.length;
      const idx = Math.min(totalPoints - 1, Math.floor(animFraction * (totalPoints - 1)));
      const pt = activeCoords[idx];

      if (!carAnimMarker) {
        carAnimMarker = L.circleMarker([pt.lat, pt.lon], {
          radius: 8,
          fillColor: DRIVER_COLORS[run.driver] || "#fff",
          color: "#ffffff",
          weight: 3,
          opacity: 1,
          fillOpacity: 1
        }).addTo(map);
      } else {
        carAnimMarker.setLatLng([pt.lat, pt.lon]);
        carAnimMarker.setStyle({ fillColor: DRIVER_COLORS[run.driver] || "#fff" });
      }

      // Update telemetry readout text
      document.getElementById("telemetry-live-speed").textContent = pt.speed.toFixed(1);
      document.getElementById("telemetry-live-dist").textContent = \`\${Math.round(pt.distM)}m / \${Math.round(run.totalDistanceMeters)}m\`;
      document.getElementById("telemetry-live-time").textContent = formatMs(pt.relMs);
      document.getElementById("playback-slider").value = Math.round(animFraction * 1000);
    }

    function formatMs(ms) {
      const min = Math.floor(ms / 60000);
      const sec = Math.floor((ms % 60000) / 1000);
      const hun = Math.floor((ms % 1000) / 10);
      return \`\${String(min).padStart(2,'0')}:\${String(sec).padStart(2,'0')}.\${String(hun).padStart(2,'0')}\`;
    }

    // --- PLAYBACK ENGINE ---
    function togglePlayback() {
      isPlaying = !isPlaying;
      document.getElementById("play-icon").textContent = isPlaying ? "⏸" : "▶";
      document.getElementById("play-label").textContent = isPlaying ? "Pause" : "Play";
      document.getElementById("btn-play").style.background = isPlaying ? "#ea580c" : "#16a34a";

      if (isPlaying) {
        if (animFraction >= 0.99) animFraction = 0;
        lastAnimTimestamp = performance.now();
        animFrameId = requestAnimationFrame(animStep);
      } else {
        cancelAnimationFrame(animFrameId);
      }
    }

    function cyclePlaybackSpeed() {
      const speeds = [1, 2, 4];
      const currIdx = speeds.indexOf(playbackSpeed);
      playbackSpeed = speeds[(currIdx + 1) % speeds.length];
      document.getElementById("btn-speed-mult").textContent = \`\${playbackSpeed}x\`;
    }

    function animStep(now) {
      if (!isPlaying) return;
      const deltaMs = now - lastAnimTimestamp;
      lastAnimTimestamp = now;

      const run = telemetryData.runs.find(r => r.id === primaryRunId);
      const durationMs = (run && run.rawTimeMs) ? run.rawTimeMs : 60000;

      animFraction += (deltaMs * playbackSpeed) / durationMs;
      if (animFraction >= 1.0) {
        animFraction = 1.0;
        isPlaying = false;
        document.getElementById("play-icon").textContent = "▶";
        document.getElementById("play-label").textContent = "Play";
        document.getElementById("btn-play").style.background = "#16a34a";
      }

      renderAnimatedMarker();
      drawSpeedChart();

      if (isPlaying) {
        animFrameId = requestAnimationFrame(animStep);
      }
    }

    function onScrub(sliderVal) {
      animFraction = sliderVal / 1000;
      renderAnimatedMarker();
      drawSpeedChart();
    }

    // --- SPEED VS DISTANCE CHART ---
    function initSpeedChart() {
      const canvas = document.getElementById("speed-chart");
      const resize = () => {
        canvas.width = canvas.parentElement.clientWidth;
        canvas.height = canvas.parentElement.clientHeight;
        drawSpeedChart();
      };
      window.addEventListener("resize", resize);
      resize();
    }

    function drawSpeedChart() {
      const canvas = document.getElementById("speed-chart");
      if (!canvas) return;
      const ctx = canvas.getContext("2d");
      const w = canvas.width;
      const h = canvas.height;

      ctx.clearRect(0, 0, w, h);

      if (!telemetryData || selectedRunIds.size === 0) {
        ctx.fillStyle = "#64748b";
        ctx.font = "12px sans-serif";
        ctx.textAlign = "center";
        ctx.fillText("Select runs to view speed profile telemetry", w / 2, h / 2);
        return;
      }

      // Compute max distance and max speed across selected runs
      let maxDist = 100;
      let maxSpeed = 50;

      selectedRunIds.forEach(runId => {
        const r = telemetryData.runs.find(x => x.id === runId);
        if (r) {
          if (r.totalDistanceMeters > maxDist) maxDist = r.totalDistanceMeters;
          if (r.maxSpeedMph > maxSpeed) maxSpeed = r.maxSpeedMph;
        }
      });
      maxSpeed = Math.ceil(maxSpeed / 10) * 10;

      // Draw grid lines
      ctx.strokeStyle = "rgba(255, 255, 255, 0.08)";
      ctx.lineWidth = 1;
      const padding = { top: 12, bottom: 20, left: 35, right: 15 };
      const chartW = w - padding.left - padding.right;
      const chartH = h - padding.top - padding.bottom;

      // Y-axis grid (Speed)
      ctx.fillStyle = "#64748b";
      ctx.font = "10px monospace";
      ctx.textAlign = "right";
      for (let s = 0; s <= maxSpeed; s += 10) {
        const y = padding.top + chartH - (s / maxSpeed) * chartH;
        ctx.beginPath();
        ctx.moveTo(padding.left, y);
        ctx.lineTo(w - padding.right, y);
        ctx.stroke();
        ctx.fillText(\`\${s}\`, padding.left - 4, y + 3);
      }

      // Draw Speed Curves for each selected run
      selectedRunIds.forEach(runId => {
        const r = telemetryData.runs.find(x => x.id === runId);
        if (!r || !r.coords || r.coords.length < 2) return;

        const isPrimary = r.id === primaryRunId;
        const color = DRIVER_COLORS[r.driver] || "#f97316";
        const coords = activeLineSmoothing ? getSmoothedCoords(r) : r.coords;

        ctx.strokeStyle = color;
        ctx.lineWidth = isPrimary ? 2.5 : 1.5;
        ctx.globalAlpha = isPrimary ? 1.0 : 0.6;
        ctx.beginPath();

        coords.forEach((pt, i) => {
          const x = padding.left + (pt.distM / maxDist) * chartW;
          const y = padding.top + chartH - (pt.speed / maxSpeed) * chartH;
          if (i === 0) ctx.moveTo(x, y);
          else ctx.lineTo(x, y);
        });
        ctx.stroke();
        ctx.globalAlpha = 1.0;
      });

      // Draw Current Playback Cursor
      if (primaryRunId) {
        const r = telemetryData.runs.find(x => x.id === primaryRunId);
        if (r && r.coords && r.coords.length > 0) {
          const coords = activeLineSmoothing ? getSmoothedCoords(r) : r.coords;
          const curIdx = Math.min(coords.length - 1, Math.floor(animFraction * (coords.length - 1)));
          const curPt = coords[curIdx];
          const cursorX = padding.left + (curPt.distM / maxDist) * chartW;

          ctx.strokeStyle = "#ffffff";
          ctx.lineWidth = 1.5;
          ctx.setLineDash([4, 4]);
          ctx.beginPath();
          ctx.moveTo(cursorX, padding.top);
          ctx.lineTo(cursorX, padding.top + chartH);
          ctx.stroke();
          ctx.setLineDash([]);

          // Cursor speed dot
          const cursorY = padding.top + chartH - (curPt.speed / maxSpeed) * chartH;
          ctx.fillStyle = "#ffffff";
          ctx.beginPath();
          ctx.arc(cursorX, cursorY, 4.5, 0, Math.PI * 2);
          ctx.fill();
        }
      }
    }

    // --- SIDEBAR RUNS LIST RENDERING ---
    function renderRunsList() {
      const container = document.getElementById("runs-list-container");
      container.innerHTML = "";
      if (!telemetryData || !telemetryData.runs) return;

      const filtered = telemetryData.runs.filter(r => {
        if (currentDriverFilter === "ALL") return true;
        return r.driver.toLowerCase() === currentDriverFilter.toLowerCase();
      });

      filtered.forEach(run => {
        const isSelected = selectedRunIds.has(run.id);
        const driverColor = DRIVER_COLORS[run.driver] || "#f97316";

        const card = document.createElement("div");
        card.className = \`run-card \${isSelected ? "selected" : ""}\`;
        card.dataset.id = run.id;

        card.innerHTML = \`
          <input type="checkbox" class="run-checkbox" \${isSelected ? "checked" : ""} onclick="event.stopPropagation(); toggleRunSelection('\${run.id}')" />
          <div class="run-driver-bar" style="background:\${driverColor};"></div>
          <div class="run-info-col">
            <div class="run-title-row">
              <div>
                <span class="run-driver-name" style="color:\${driverColor}">\${run.driver}</span>
                <span class="run-num-badge">Run #\${run.runNum}</span>
              </div>
              <div class="run-time-display \${run.isDnf ? "dnf" : ""}">\${run.finalFormatted}</div>
            </div>
            <div class="run-meta-row">
              <span>⚡ \${run.maxSpeedMph} MPH max</span>
              <span>📏 \${run.totalDistanceMeters}m</span>
              \${run.cones > 0 ? \`<span class="run-cones-tag">+\${run.cones * 2}s (\${run.cones}c)</span>\` : ""}
            </div>
            \${run.notes ? \`<div class="run-notes-snippet">"\${run.notes}"</div>\` : ""}
          </div>
        \`;

        card.onclick = () => {
          setPrimaryRun(run.id);
        };

        container.appendChild(card);
      });
    }

    function filterDriver(driver) {
      currentDriverFilter = driver;
      document.querySelectorAll(".filter-pill").forEach(p => {
        p.classList.toggle("active", p.dataset.driver === driver);
      });
      renderRunsList();
    }

    function toggleRunSelection(runId) {
      if (selectedRunIds.has(runId)) {
        selectedRunIds.delete(runId);
        if (primaryRunId === runId) {
          primaryRunId = Array.from(selectedRunIds)[0] || null;
        }
      } else {
        selectedRunIds.add(runId);
        if (!primaryRunId) primaryRunId = runId;
      }
      renderRunsList();
      updateMapPolylines();
      updateSelectionBadges();
    }

    function setPrimaryRun(runId) {
      primaryRunId = runId;
      selectedRunIds.add(runId);
      animFraction = 0;
      renderRunsList();
      updateMapPolylines();
      updateSelectionBadges();
    }

    function selectFastestPerDriver() {
      selectedRunIds.clear();
      const drivers = ["Liam", "Jeff", "Ryan", "Matt"];
      drivers.forEach(d => {
        const driverRuns = telemetryData.runs.filter(r => r.driver === d && !r.isDnf);
        if (driverRuns.length > 0) {
          driverRuns.sort((a, b) => a.rawTimeMs - b.rawTimeMs);
          selectedRunIds.add(driverRuns[0].id);
        }
      });
      primaryRunId = Array.from(selectedRunIds)[0] || null;
      renderRunsList();
      updateMapPolylines();
      updateSelectionBadges();
      fitTrackBounds();
    }

    function selectTopN(n = 3) {
      selectedRunIds.clear();
      const validRuns = telemetryData.runs.filter(r => !r.isDnf);
      validRuns.sort((a, b) => a.rawTimeMs - b.rawTimeMs);
      validRuns.slice(0, n).forEach(r => selectedRunIds.add(r.id));
      primaryRunId = Array.from(selectedRunIds)[0] || null;
      renderRunsList();
      updateMapPolylines();
      updateSelectionBadges();
      fitTrackBounds();
    }

    function clearAllSelections() {
      selectedRunIds.clear();
      primaryRunId = null;
      renderRunsList();
      updateMapPolylines();
      updateSelectionBadges();
    }

    function openSidebar() {
      const sidebar = document.getElementById("sidebar");
      const backdrop = document.getElementById("sidebar-backdrop");
      sidebar.classList.add("open");
      sidebar.classList.remove("collapsed");
      if (backdrop) backdrop.classList.add("active");
    }

    function closeSidebar() {
      const sidebar = document.getElementById("sidebar");
      const backdrop = document.getElementById("sidebar-backdrop");
      sidebar.classList.remove("open");
      if (backdrop) backdrop.classList.remove("active");
      if (window.innerWidth > 900) {
        sidebar.classList.add("collapsed");
      }
      setTimeout(() => {
        if (map) map.invalidateSize();
        if (typeof drawSpeedChart === "function") drawSpeedChart();
      }, 300);
    }

    function toggleSidebar() {
      const sidebar = document.getElementById("sidebar");
      if (window.innerWidth <= 900) {
        if (sidebar.classList.contains("open")) {
          closeSidebar();
        } else {
          openSidebar();
        }
      } else {
        sidebar.classList.toggle("collapsed");
        setTimeout(() => {
          if (map) map.invalidateSize();
          if (typeof drawSpeedChart === "function") drawSpeedChart();
        }, 300);
      }
    }

    function toggleGraphPanel() {
      const panel = document.getElementById("bottom-telemetry-panel");
      const btn = document.getElementById("btn-toggle-graph");
      if (!panel || !btn) return;
      panel.classList.toggle("minimized");
      const isMin = panel.classList.contains("minimized");
      btn.innerHTML = isMin ? "📈 Show" : "📉 Hide";
      setTimeout(() => {
        if (map) map.invalidateSize();
        if (!isMin && typeof drawSpeedChart === "function") drawSpeedChart();
      }, 250);
    }

    function updateSelectionBadges() {
      const count = selectedRunIds.size;
      document.querySelectorAll(".badge-run-count").forEach(el => {
        el.textContent = count;
      });
      const toggleBtn = document.getElementById("btn-toggle-sidebar");
      if (toggleBtn) {
        toggleBtn.textContent = "☰ Runs (" + count + ")";
      }
      const footerBtnText = document.getElementById("btn-drawer-apply-text");
      if (footerBtnText) {
        footerBtnText.textContent = "✓ View on Map (" + count + " selected)";
      }
    }

    function scrollToTimeline() {
      const panel = document.getElementById("bottom-telemetry-panel");
      if (panel) {
        panel.scrollIntoView({ behavior: "smooth", block: "start" });
      }
    }

    function scrollToMap() {
      window.scrollTo({ top: 0, behavior: "smooth" });
    }
  </script>
</body>
</html>
`;

const outputPath = path.join(__dirname, '..', 'analysis.html');
fs.writeFileSync(outputPath, htmlContent, 'utf8');
console.log(`Generated ${outputPath} (${(fs.statSync(outputPath).size / 1024).toFixed(1)} KB) with all 47 runs embedded!`);
