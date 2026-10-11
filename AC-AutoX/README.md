# 🏁 AC-AutoX: Sonoma Autocross Digital Twin for Assetto Corsa

A complete digital twin and course recreation pipeline for the **Sonoma Raceway Paddock Autocross** track, featuring high-accuracy GPS telemetry, an interactive web course editor, photographic video frame calibration, and an Assetto Corsa 3D track package.

---

## 🚀 Live Interactive Course Editor (GitHub Pages)

Experience and fine-tune the autocross course directly in your browser:

* 🎯 **[AC-AutoX Course & Cone Editor](https://breadcrowns.github.io/race-telemetry/AC-AutoX/course-editor.html)**
* 🌐 **[Direct URL](https://breadcrowns.github.io/race-telemetry/AC-AutoX/)**

### Editor Features
- **High-Resolution Satellite Canvas:** 19-zoom satellite imagery of the Sonoma Paddock with millimeter-level coordinate mapping.
- **GPS Racing Line Telemetry:** Consensus racing line overlay recorded from Iron Duke Fiero test runs.
- **Interactive Cone Positioning:**
  - **Drag & Drop:** Move any cone across the paddock.
  - **Add Cone Tool:** Click or Shift+Click anywhere to drop standing orange cones, yellow apex cones, pointer cones, or timing gates.
  - **Cone Rotation:** Slider and ±15° quick-rotate buttons for pointer/directional cones.
  - **Delete & Clone:** Select any cone to delete (`Del` / `Backspace`) or duplicate.
  - **Undo Stack:** Full undo history (`Ctrl+Z`).
- **High-Res Panoramic Reference Modal:** Instant in-app access to a 3430x1920 stitched panoramic photo from the onboard Iron Duke camera to confirm physical cone placements.
- **Instant Export:** Download updated cone configurations as `course_cones_adjusted.json`, CSV, or Assetto Corsa coordinates.

---

## 🏎️ Assetto Corsa Track Installation

A ready-to-use track folder is included in [`content/tracks/sonoma_autocross`](content/tracks/sonoma_autocross).

### Quick Install Instructions:
1. Locate your Assetto Corsa installation folder:
   ```text
   C:\Program Files (x86)\Steam\steamapps\common\assettocorsa\content\tracks\
   ```
2. Copy the entire [`content/tracks/sonoma_autocross`](content/tracks/sonoma_autocross) directory into your `content/tracks/` folder.
3. Launch Assetto Corsa (or Content Manager) and select **Sonoma Raceway - Paddock Autocross**!

### Track Specifications:
- **Surface Mesh:** `1ROAD_paddock` (Physical asphalt with realistic friction, grip, and tire wear curves configured in [`data/surfaces.ini`](content/tracks/sonoma_autocross/data/surfaces.ini)).
- **Cone Models:** 127 individual 3D cones procedurally mapped with authentic orange, yellow, and pointer orientations.
- **Timing Gates:** Optic timing beam posts and AC timing trigger empties (`AC_TIME_0` Start, `AC_TIME_1` Finish).
- **Spawn Positions:** Paddock staging (`AC_PIT_0`), Start line (`AC_START_0`), and Hotlap launch (`AC_HOTLAP_START_0`).

---

## 📁 Directory Structure

```text
AC-AutoX/
├── README.md                              # This documentation
├── course-editor.html                     # Interactive course editor web application
├── index.html                             # Alias entry point for GitHub Pages
├── course_data.js                         # Course metadata, GPS bounds, 127 cones, spline telemetry
├── course_cones_adjusted.json             # Calibrated cone layout (127 cones)
├── course_cones_adjusted.csv              # Tabular CSV export of all cones
├── course_cones.json                      # Canonical cone dataset
├── sonoma_paddock_z19.jpg                 # Zoom 19 satellite baseplate of Sonoma paddock
├── sonoma_autocross_panorama.jpg          # 3430x1920 stitched panoramic reference photo
├── sonoma_autocross_satellite_overlay.png # Satellite map with full track overlay
├── content/
│   └── tracks/
│       └── sonoma_autocross/              # Assetto Corsa track package
│           ├── sonoma_autocross.obj       # 3D mesh (road, cones, sensors)
│           ├── sonoma_autocross.mtl       # Material definitions
│           ├── models.ini                 # Model loader configuration
│           ├── data/
│           │   └── surfaces.ini           # Asphalt and boundary physical properties
│           └── ui/
│               ├── ui_track.json          # In-game track info, tags, and specs
│               ├── preview.png            # UI preview graphic
│               └── outline.png            # Minimap track outline
└── scripts/
    ├── generate_3d_track.ps1              # Generates OBJ & MTL from cone JSON
    ├── import_to_blender.py               # Blender script to import OBJ, create empties, and export FBX
    ├── build_panorama.ps1                 # FFmpeg stitcher for video frame panoramic photo
    ├── build_track_configs.ps1            # AC configuration builder
    ├── analyze_course.ps1                 # Course telemetry and sector splitter
    └── calc_gates.ps1                     # Timing gate vector calculator
```

---

## 🛠️ Modifying & Rebuilding the 3D Track

If you adjust cones in the [Course Editor](https://breadcrowns.github.io/race-telemetry/AC-AutoX/course-editor.html):

1. Click **Export JSON** and save as `course_cones_adjusted.json` in this folder.
2. Re-run the 3D track generator in PowerShell:
   ```powershell
   powershell.exe -ExecutionPolicy Bypass -File scripts/generate_3d_track.ps1
   ```
   This will immediately regenerate `content/tracks/sonoma_autocross/sonoma_autocross.obj` with your new cone coordinates.
3. **Optional (Blender workflow):**
   Open Blender and run `scripts/import_to_blender.py` to inspect the 3D scene, refine materials, or export directly to FBX / `kn5` via the Kunos SDK Editor.

---

## 📐 Calibration & Geolocation Data

- **Paddock Center Datum:** `38.161100° N, -122.454800° W`
- **Paddock Elevation:** ~15.0 m with a natural $1.2\%$ south slope and $0.3\%$ east slope.
- **Coordinate Transformation:**
  - $X$ = Meters East
  - $Y$ = Meters North
  - In Assetto Corsa 3D: $X = X_{\text{East}}$, $Y = Z_{\text{Elevation}}$, $Z = -Y_{\text{North}}$
