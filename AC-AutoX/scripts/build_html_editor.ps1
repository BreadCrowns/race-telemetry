$conesJson = Get-Content "data/course_cones.json" -Raw
$runsJson = Get-Content "data/runs_telemetry.json" -Raw

$html = @"
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Sonoma Autocross — Precision Course & Cone Calibration</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; }
    body { background: #090d16; color: #f1f5f9; display: flex; height: 100vh; overflow: hidden; }
    
    /* Left / Top Controls Sidebar */
    #sidebar {
      width: 360px;
      background: #0f172a;
      border-right: 1px solid #1e293b;
      display: flex;
      flex-direction: column;
      z-index: 10;
      box-shadow: 4px 0 24px rgba(0,0,0,0.5);
    }
    .header {
      padding: 18px 20px;
      border-bottom: 1px solid #1e293b;
      background: #090d16;
    }
    .badge {
      display: inline-block;
      padding: 3px 8px;
      font-size: 11px;
      font-weight: 800;
      letter-spacing: 0.5px;
      text-transform: uppercase;
      border-radius: 4px;
      background: #f97316;
      color: #fff;
      margin-bottom: 6px;
    }
    .title { font-size: 18px; font-weight: 700; color: #fff; }
    .subtitle { font-size: 12px; color: #94a3b8; margin-top: 2px; }

    .stats-bar {
      display: flex;
      padding: 10px 20px;
      background: #131d35;
      border-bottom: 1px solid #1e293b;
      gap: 12px;
    }
    .stat-item { flex: 1; }
    .stat-lbl { font-size: 10px; color: #64748b; font-weight: 700; text-transform: uppercase; }
    .stat-val { font-size: 14px; font-weight: 700; color: #38bdf8; }

    .layers-panel {
      padding: 14px 20px;
      border-bottom: 1px solid #1e293b;
    }
    .section-title { font-size: 11px; font-weight: 800; color: #f97316; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 10px; }
    .layer-toggle {
      display: flex;
      align-items: center;
      justify-content: space-between;
      margin-bottom: 8px;
      font-size: 13px;
      cursor: pointer;
    }
    .layer-toggle input { cursor: pointer; }

    /* Inspector Drawer */
    #inspector {
      flex: 1;
      padding: 16px 20px;
      overflow-y: auto;
    }
    .inspector-card {
      background: #1e293b;
      border: 1px solid #334155;
      border-radius: 8px;
      padding: 14px;
      margin-top: 8px;
    }
    .field-row {
      display: flex;
      justify-content: space-between;
      margin-bottom: 8px;
      font-size: 12px;
    }
    .field-label { color: #94a3b8; }
    .field-value { font-weight: 600; color: #f8fafc; text-align: right; }

    .actions-bar {
      padding: 16px 20px;
      border-top: 1px solid #1e293b;
      background: #090d16;
      display: flex;
      flex-direction: column;
      gap: 8px;
    }
    .btn {
      padding: 9px 14px;
      font-size: 12px;
      font-weight: 700;
      border-radius: 6px;
      border: none;
      cursor: pointer;
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 6px;
      transition: all 0.15s;
    }
    .btn-primary { background: #38bdf8; color: #0f172a; }
    .btn-primary:hover { background: #7dd3fc; }
    .btn-secondary { background: #334155; color: #f8fafc; }
    .btn-secondary:hover { background: #475569; }

    /* Main Map Viewport */
    #viewport-container {
      flex: 1;
      position: relative;
      overflow: hidden;
      cursor: grab;
      background: #050811;
    }
    #viewport-container:active { cursor: grabbing; }
    canvas {
      position: absolute;
      top: 0;
      left: 0;
      transform-origin: 0 0;
    }

    /* Floating Zoom Controls */
    .map-controls {
      position: absolute;
      bottom: 24px;
      right: 24px;
      display: flex;
      flex-direction: column;
      gap: 8px;
      z-index: 10;
    }
    .ctrl-btn {
      width: 38px;
      height: 38px;
      border-radius: 8px;
      background: rgba(15, 23, 42, 0.9);
      border: 1px solid #334155;
      color: #fff;
      font-size: 18px;
      font-weight: bold;
      display: flex;
      align-items: center;
      justify-content: center;
      cursor: pointer;
      box-shadow: 0 4px 12px rgba(0,0,0,0.4);
      user-select: none;
    }
    .ctrl-btn:hover { background: #1e293b; }

    .tooltip {
      position: absolute;
      padding: 6px 10px;
      background: rgba(15, 23, 42, 0.95);
      border: 1px solid #38bdf8;
      border-radius: 6px;
      font-size: 11px;
      color: #fff;
      pointer-events: none;
      display: none;
      z-index: 20;
      box-shadow: 0 4px 12px rgba(0,0,0,0.5);
    }
  </style>
</head>
<body>

  <!-- SIDEBAR -->
  <div id="sidebar">
    <div class="header">
      <span class="badge">Sonoma Raceway</span>
      <h1 class="title">Course & Cone Calibrator</h1>
      <p class="subtitle">Drag any cone to adjust position on the satellite lot</p>
    </div>

    <div class="stats-bar">
      <div class="stat-item">
        <div class="stat-lbl">Course Length</div>
        <div class="stat-val">678 m</div>
      </div>
      <div class="stat-item">
        <div class="stat-lbl">Total Cones</div>
        <div class="stat-val" id="coneCount">77</div>
      </div>
      <div class="stat-item">
        <div class="stat-lbl">Paddock Pad</div>
        <div class="stat-val">125m &times; 200m</div>
      </div>
    </div>

    <div class="layers-panel">
      <div class="section-title">Overlay Layers</div>
      <label class="layer-toggle">
        <span>GPS Consensus Racing Line</span>
        <input type="checkbox" id="layerSpline" checked onchange="render()">
      </label>
      <label class="layer-toggle">
        <span>Surveyed Cones & Pointers</span>
        <input type="checkbox" id="layerCones" checked onchange="render()">
      </label>
      <label class="layer-toggle">
        <span>Chalk Circles</span>
        <input type="checkbox" id="layerChalk" checked onchange="render()">
      </label>
      <label class="layer-toggle">
        <span>Start / Finish Gates</span>
        <input type="checkbox" id="layerGates" checked onchange="render()">
      </label>
      <label class="layer-toggle">
        <span>Cone ID Badges</span>
        <input type="checkbox" id="layerLabels" checked onchange="render()">
      </label>
    </div>

    <div id="inspector">
      <div class="section-title">Selected Element</div>
      <div id="inspectorContent" style="color: #64748b; font-size: 13px;">
        Click or drag any cone marker on the satellite imagery to inspect and edit coordinates.
      </div>
    </div>

    <div class="actions-bar">
      <button class="btn btn-primary" onclick="exportConesJson()">
        &#128190; Export Updated JSON
      </button>
      <button class="btn btn-secondary" onclick="exportConesCsv()">
        &#128196; Export Updated CSV
      </button>
      <button class="btn btn-secondary" onclick="resetAllCones()">
        &#8634; Reset to Original Telemetry
      </button>
    </div>
  </div>

  <!-- VIEWPORT -->
  <div id="viewport-container">
    <canvas id="mapCanvas"></canvas>
    <div id="tooltip" class="tooltip"></div>

    <div class="map-controls">
      <div class="ctrl-btn" onclick="zoomIn()">+</div>
      <div class="ctrl-btn" onclick="zoomOut()">&minus;</div>
      <div class="ctrl-btn" onclick="resetView()" title="Fit View">&#8982;</div>
    </div>
  </div>

  <script>
    // 1. DATA SOURCES
    const initialCones = $conesJson;
    const runsData = $runsJson;
    let cones = JSON.parse(JSON.stringify(initialCones));

    const lat0 = 38.1598, lon0 = -122.4551;
    const mPerLat = 111030.0;
    const mPerLon = 111030.0 * Math.cos(lat0 * Math.PI / 180.0);

    const zoom = 19;
    const minTileX = 83802, minTileY = 201934;
    const n = Math.pow(2.0, zoom) * 256.0;

    function latLonToImg(lat, lon) {
      const px = (lon + 180.0) / 360.0 * n;
      const latRad = lat * Math.PI / 180.0;
      const sinLat = Math.Sin ? Math.Sin(latRad) : Math.sin(latRad);
      const py = (0.5 - Math.log((1.0 + sinLat) / (1.0 - sinLat)) / (4.0 * Math.PI)) * n;
      return { x: px - (minTileX * 256.0), y: py - (minTileY * 256.0) };
    }

    function xyToImg(x, y) {
      const lat = lat0 + (y / mPerLat);
      const lon = lon0 + (x / mPerLon);
      return latLonToImg(lat, lon);
    }

    function imgToXY(ix, iy) {
      const px = ix + (minTileX * 256.0);
      const py = iy + (minTileY * 256.0);
      const lon = (px / n) * 360.0 - 180.0;
      const mercN = Math.PI - (2.0 * Math.PI * py) / n;
      const lat = (180.0 / Math.PI) * Math.atan(0.5 * (Math.exp(mercN) - Math.exp(-mercN)));
      const x = (lon - lon0) * mPerLon;
      const y = (lat - lat0) * mPerLat;
      return { x: Number(x.toFixed(3)), y: Number(y.toFixed(3)), lat: Number(lat.toFixed(7)), lon: Number(lon.toFixed(7)) };
    }

    // 2. CANVAS & INTERACTION SETUP
    const canvas = document.getElementById('mapCanvas');
    const ctx = canvas.getContext('2d');
    const container = document.getElementById('viewport-container');
    const tooltip = document.getElementById('tooltip');

    let bgImg = new Image();
    bgImg.src = 'sonoma_paddock_z19.jpg';
    bgImg.onload = () => {
      canvas.width = bgImg.width;
      canvas.height = bgImg.height;
      resetView();
    };

    let scale = 1.0;
    let panX = 0, panY = 0;
    let isPanning = false, startPanX = 0, startPanY = 0;
    let draggedCone = null;
    let selectedCone = null;

    function resetView() {
      const rect = container.getBoundingClientRect();
      scale = Math.min(rect.width / canvas.width, rect.height / canvas.height) * 1.35;
      panX = (rect.width - canvas.width * scale) / 2 - 80;
      panY = (rect.height - canvas.height * scale) / 2 + 50;
      updateTransform();
      render();
    }

    function updateTransform() {
      canvas.style.transform = `translate(` + panX + `px, ` + panY + `px) scale(` + scale + `)`;
    }

    function zoomIn() {
      scale = Math.min(4.0, scale * 1.25);
      updateTransform();
      render();
    }
    function zoomOut() {
      scale = Math.max(0.3, scale / 1.25);
      updateTransform();
      render();
    }

    // Panning & Dragging
    container.addEventListener('mousedown', (e) => {
      const mouse = getCanvasCoords(e);
      // Check if clicked on a cone
      for (let i = cones.length - 1; i >= 0; i--) {
        const c = cones[i];
        const pt = xyToImg(c.x, c.y);
        const dist = Math.hypot(mouse.x - pt.x, mouse.y - pt.y);
        if (dist <= 12 / scale) {
          draggedCone = c;
          selectedCone = c;
          updateInspector(c);
          render();
          return;
        }
      }
      isPanning = true;
      startPanX = e.clientX - panX;
      startPanY = e.clientY - panY;
    });

    window.addEventListener('mousemove', (e) => {
      if (draggedCone) {
        const mouse = getCanvasCoords(e);
        const updated = imgToXY(mouse.x, mouse.y);
        draggedCone.x = updated.x;
        draggedCone.y = updated.y;
        updateInspector(draggedCone);
        render();
      } else if (isPanning) {
        panX = e.clientX - startPanX;
        panY = e.clientY - startPanY;
        updateTransform();
      } else {
        // Tooltip hover
        const mouse = getCanvasCoords(e);
        let found = null;
        for (let c of cones) {
          const pt = xyToImg(c.x, c.y);
          if (Math.hypot(mouse.x - pt.x, mouse.y - pt.y) <= 10 / scale) {
            found = c;
            break;
          }
        }
        if (found) {
          tooltip.style.display = 'block';
          tooltip.style.left = (e.clientX + 14) + 'px';
          tooltip.style.top = (e.clientY + 14) + 'px';
          tooltip.innerHTML = `<strong>` + found.id + `</strong> (` + found.type + `)<br>` + found.notes + `<br>X: ` + found.x + `m, Y: ` + found.y + `m`;
        } else {
          tooltip.style.display = 'none';
        }
      }
    });

    window.addEventListener('mouseup', () => {
      isPanning = false;
      draggedCone = null;
    });

    container.addEventListener('wheel', (e) => {
      e.preventDefault();
      const zoomFactor = e.deltaY < 0 ? 1.15 : 0.85;
      const rect = container.getBoundingClientRect();
      const mouseX = e.clientX - rect.left;
      const mouseY = e.clientY - rect.top;

      const newScale = Math.max(0.3, Math.min(5.0, scale * zoomFactor));
      panX = mouseX - (mouseX - panX) * (newScale / scale);
      panY = mouseY - (mouseY - panY) * (newScale / scale);
      scale = newScale;
      updateTransform();
      render();
    });

    function getCanvasCoords(e) {
      const rect = container.getBoundingClientRect();
      const viewX = e.clientX - rect.left;
      const viewY = e.clientY - rect.top;
      return {
        x: (viewX - panX) / scale,
        y: (viewY - panY) / scale
      };
    }

    // 3. RENDERING
    function render() {
      if (!bgImg.complete) return;
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(bgImg, 0, 0);

      const showSpline = document.getElementById('layerSpline').checked;
      const showCones = document.getElementById('layerCones').checked;
      const showChalk = document.getElementById('layerChalk').checked;
      const showGates = document.getElementById('layerGates').checked;
      const showLabels = document.getElementById('layerLabels').checked;

      // Draw Spline
      if (showSpline && runsData.consensusLine) {
        ctx.beginPath();
        runsData.consensusLine.forEach((p, idx) => {
          const pt = latLonToImg(p[0], p[1]);
          if (idx === 0) ctx.moveTo(pt.x, pt.y);
          else ctx.lineTo(pt.x, pt.y);
        });
        ctx.strokeStyle = 'rgba(14, 165, 233, 0.35)';
        ctx.lineWidth = 14;
        ctx.lineCap = 'round';
        ctx.stroke();

        ctx.strokeStyle = '#38bdf8';
        ctx.lineWidth = 4;
        ctx.stroke();
      }

      // Draw Gates
      if (showGates) {
        const s1 = xyToImg(-41.90, 105.48);
        const s2 = xyToImg(-24.44, 113.25);
        ctx.beginPath();
        ctx.moveTo(s1.x, s1.y); ctx.lineTo(s2.x, s2.y);
        ctx.strokeStyle = '#22c55e'; ctx.lineWidth = 5; ctx.stroke();

        const f1 = xyToImg(34.92, -87.71);
        const f2 = xyToImg(19.21, -95.49);
        ctx.beginPath();
        ctx.moveTo(f1.x, f1.y); ctx.lineTo(f2.x, f2.y);
        ctx.strokeStyle = '#ef4444'; ctx.lineWidth = 5; ctx.stroke();
      }

      // Draw Cones
      if (showCones) {
        cones.forEach((c) => {
          const pt = xyToImg(c.x, c.y);

          // Chalk circle
          if (showChalk && c.has_chalk_circle) {
            ctx.beginPath();
            ctx.arc(pt.x, pt.y, 11, 0, Math.PI * 2);
            ctx.strokeStyle = 'rgba(255, 255, 255, 0.85)';
            ctx.lineWidth = 2.5;
            ctx.stroke();
          }

          if (c.type === 'pointer_flat') {
            const rad = c.heading_deg * Math.PI / 180.0;
            const dx = Math.sin(rad) * 14.0;
            const dy = -Math.cos(rad) * 14.0;
            const px = -Math.cos(rad) * 5.0;
            const py = -Math.sin(rad) * 5.0;
            ctx.beginPath();
            ctx.moveTo(pt.x - px, pt.y - py);
            ctx.lineTo(pt.x + px, pt.y + py);
            ctx.lineTo(pt.x + dx, pt.y + dy);
            ctx.closePath();
            ctx.fillStyle = '#f97316';
            ctx.fill();
            ctx.strokeStyle = '#0f172a';
            ctx.lineWidth = 1.5;
            ctx.stroke();
          } else if (c.type === 'timing_beam_pole') {
            ctx.fillStyle = '#22c55e';
            ctx.fillRect(pt.x - 5, pt.y - 5, 10, 10);
            ctx.strokeStyle = '#0f172a';
            ctx.lineWidth = 1.5;
            ctx.strokeRect(pt.x - 5, pt.y - 5, 10, 10);
          } else {
            ctx.beginPath();
            ctx.arc(pt.x, pt.y, c.type === 'standing_yellow_apex' ? 6.5 : 5.5, 0, Math.PI * 2);
            ctx.fillStyle = c.type === 'standing_yellow_apex' ? '#facc15' : '#f97316';
            ctx.fill();
            ctx.strokeStyle = (selectedCone === c) ? '#38bdf8' : '#0f172a';
            ctx.lineWidth = (selectedCone === c) ? 3 : 1.5;
            ctx.stroke();
          }

          if (showLabels) {
            ctx.font = 'bold 9px -apple-system, sans-serif';
            ctx.fillStyle = '#ffffff';
            ctx.fillText(c.id.replace('cone_', ''), pt.x + 8, pt.y + 3);
          }
        });
      }
    }

    // 4. INSPECTOR
    function updateInspector(c) {
      const container = document.getElementById('inspectorContent');
      const geo = imgToXY(xyToImg(c.x, c.y).x, xyToImg(c.x, c.y).y);
      container.innerHTML = `
        <div class="inspector-card">
          <div style="font-size: 15px; font-weight: 700; color: #38bdf8; margin-bottom: 8px;">` + c.id + `</div>
          <div class="field-row"><span class="field-label">Type:</span><span class="field-value">` + c.type + `</span></div>
          <div class="field-row"><span class="field-label">Sector:</span><span class="field-value">Sector ` + c.sector + `</span></div>
          <div class="field-row"><span class="field-label">Local X (East):</span><span class="field-value">` + c.x.toFixed(2) + ` m</span></div>
          <div class="field-row"><span class="field-label">Local Y (North):</span><span class="field-value">` + c.y.toFixed(2) + ` m</span></div>
          <div class="field-row"><span class="field-label">Heading:</span><span class="field-value">` + c.heading_deg + `&deg;</span></div>
          <div class="field-row"><span class="field-label">Chalk Ring:</span><span class="field-value">` + (c.has_chalk_circle ? 'Yes' : 'No') + `</span></div>
          <div class="field-row"><span class="field-label">Latitude:</span><span class="field-value">` + geo.lat.toFixed(6) + `</span></div>
          <div class="field-row"><span class="field-label">Longitude:</span><span class="field-value">` + geo.lon.toFixed(6) + `</span></div>
          <div style="margin-top: 10px; font-size: 11px; color: #cbd5e1; border-top: 1px solid #334155; padding-top: 8px;">
            <strong>Notes:</strong> ` + c.notes + `
          </div>
        </div>
      `;
    }

    function exportConesJson() {
      const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(cones, null, 2));
      const downloadAnchor = document.createElement('a');
      downloadAnchor.setAttribute("href", dataStr);
      downloadAnchor.setAttribute("download", "course_cones_adjusted.json");
      document.body.appendChild(downloadAnchor);
      downloadAnchor.click();
      downloadAnchor.remove();
      alert("Exported course_cones_adjusted.json with " + cones.length + " cones!");
    }

    function exportConesCsv() {
      let csv = "id,type,x,y,z,heading_deg,has_chalk_circle,sector,notes\n";
      cones.forEach(c => {
        csv += c.id + "," + c.type + "," + c.x + "," + c.y + "," + c.z + "," + c.heading_deg + "," + c.has_chalk_circle + "," + c.sector + ",\"" + c.notes + "\"\n";
      });
      const dataStr = "data:text/csv;charset=utf-8," + encodeURIComponent(csv);
      const downloadAnchor = document.createElement('a');
      downloadAnchor.setAttribute("href", dataStr);
      downloadAnchor.setAttribute("download", "course_cones_adjusted.csv");
      document.body.appendChild(downloadAnchor);
      downloadAnchor.click();
      downloadAnchor.remove();
      alert("Exported course_cones_adjusted.csv with " + cones.length + " cones!");
    }

    function resetAllCones() {
      if (confirm("Reset all cones back to the initial telemetry positions?")) {
        cones = JSON.parse(JSON.stringify(initialCones));
        selectedCone = null;
        document.getElementById('inspectorContent').innerHTML = 'Click or drag any cone marker on the satellite imagery to inspect and edit coordinates.';
        render();
      }
    }
  </script>
</body>
</html>
"@

Set-Content -Path "sonoma_course_editor.html" -Value $html
Set-Content -Path "C:\Users\bazar\.gemini\antigravity\brain\0b4e14e6-53df-4eed-ab78-bed1d48e3fa1\sonoma_course_editor.html" -Value $html
Write-Host "sonoma_course_editor.html successfully generated in workspace and artifact directory!"
