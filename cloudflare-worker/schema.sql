CREATE TABLE IF NOT EXISTS events (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    track_name TEXT NOT NULL,
    format TEXT NOT NULL DEFAULT 'endurance',
    start_date TEXT NOT NULL,
    end_date TEXT,
    car_name TEXT DEFAULT 'Fiero Race Car',
    notes TEXT,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS drivers (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    car_number TEXT DEFAULT '42',
    color_hex TEXT DEFAULT '#f97316',
    total_laps INTEGER DEFAULT 0,
    total_miles REAL DEFAULT 0.0,
    best_lap_ms INTEGER DEFAULT NULL,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS stints (
    id TEXT PRIMARY KEY,
    event_id TEXT NOT NULL,
    stint_num INTEGER NOT NULL,
    driver_name TEXT NOT NULL,
    start_time INTEGER NOT NULL,
    end_time INTEGER,
    duration_ms INTEGER,
    lap_count INTEGER DEFAULT 0,
    miles_driven REAL DEFAULT 0.0,
    start_fuel_gal REAL,
    end_fuel_gal REAL,
    avg_lap_time_ms INTEGER,
    best_lap_time_ms INTEGER,
    notes TEXT,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (event_id) REFERENCES events(id)
);

CREATE TABLE IF NOT EXISTS laps (
    id TEXT PRIMARY KEY,
    event_id TEXT NOT NULL,
    stint_id TEXT,
    lap_num INTEGER NOT NULL,
    driver_name TEXT NOT NULL,
    lap_time_ms INTEGER NOT NULL,
    lap_time_formatted TEXT NOT NULL,
    delta_to_best_ms INTEGER DEFAULT 0,
    top_speed_mph REAL,
    avg_speed_mph REAL,
    fuel_used_gal REAL,
    status TEXT DEFAULT 'CLEAN',
    cones INTEGER DEFAULT 0,
    adjusted_time_ms INTEGER,
    flag_condition TEXT DEFAULT 'GREEN',
    start_time INTEGER NOT NULL,
    finish_time INTEGER NOT NULL,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (event_id) REFERENCES events(id),
    FOREIGN KEY (stint_id) REFERENCES stints(id)
);

CREATE TABLE IF NOT EXISTS pitstops (
    id TEXT PRIMARY KEY,
    event_id TEXT NOT NULL,
    pit_num INTEGER NOT NULL,
    in_time INTEGER NOT NULL,
    out_time INTEGER,
    duration_sec INTEGER,
    driver_out TEXT,
    driver_in TEXT,
    fuel_added_gal REAL DEFAULT 0.0,
    fuel_level_after_gal REAL,
    tires_changed TEXT,
    tire_pressures_psi TEXT,
    checklist_complete INTEGER DEFAULT 1,
    penalty_served INTEGER DEFAULT 0,
    notes TEXT,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (event_id) REFERENCES events(id)
);

CREATE TABLE IF NOT EXISTS telemetry_raw (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    event_id TEXT NOT NULL,
    device_id TEXT,
    timestamp INTEGER NOT NULL,
    iso_time TEXT NOT NULL,
    latitude REAL NOT NULL,
    longitude REAL NOT NULL,
    speed_mph REAL NOT NULL,
    heading REAL,
    altitude_m REAL,
    accuracy_m REAL,
    battery_level REAL,
    odometer_mi REAL,
    lap_num INTEGER,
    driver_name TEXT,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_telemetry_event_time ON telemetry_raw(event_id, timestamp);
CREATE INDEX IF NOT EXISTS idx_telemetry_driver ON telemetry_raw(driver_name);
CREATE INDEX IF NOT EXISTS idx_laps_event ON laps(event_id, lap_num);
CREATE INDEX IF NOT EXISTS idx_laps_driver ON laps(driver_name);
CREATE INDEX IF NOT EXISTS idx_stints_event ON stints(event_id, stint_num);
CREATE INDEX IF NOT EXISTS idx_pitstops_event ON pitstops(event_id, pit_num);
