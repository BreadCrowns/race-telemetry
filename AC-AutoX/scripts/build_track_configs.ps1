$cones = Get-Content "data/course_cones.json" | ConvertFrom-Json
$trackDir = "content/tracks/sonoma_autocross"
New-Item -ItemType Directory -Path "$trackDir/data" -Force | Out-Null
New-Item -ItemType Directory -Path "$trackDir/ui" -Force | Out-Null

# 1. surfaces.ini
$surfacesIni = @"
[SURFACE_0]
KEY=ROAD
FRICTION=0.98
DAMPING=0
WAVELENGTH=500
AMPLITUDE=0
ISPITLANE=0
IS_VALID_TRACK=1
BLACK_FLAG_TIME=0
SIN_HEIGHT=0
SIN_LENGTH=0
IS_DIRT=0
VIBRATION_GAIN=0.04
VIBRATION_LENGTH=0.3

[SURFACE_1]
KEY=PADDOCK
FRICTION=0.98
DAMPING=0
WAVELENGTH=500
AMPLITUDE=0
ISPITLANE=0
IS_VALID_TRACK=1
BLACK_FLAG_TIME=0
SIN_HEIGHT=0
SIN_LENGTH=0
IS_DIRT=0
VIBRATION_GAIN=0.06
VIBRATION_LENGTH=0.35

[SURFACE_2]
KEY=CONE
FRICTION=0.75
DAMPING=0
WAVELENGTH=0
AMPLITUDE=0
ISPITLANE=0
IS_VALID_TRACK=1
BLACK_FLAG_TIME=0
SIN_HEIGHT=0
SIN_LENGTH=0
IS_DIRT=0
VIBRATION_GAIN=0.0
VIBRATION_LENGTH=0.0

[SURFACE_3]
KEY=OFFTRACK
FRICTION=0.65
DAMPING=0
WAVELENGTH=0.1
AMPLITUDE=0.015
ISPITLANE=0
IS_VALID_TRACK=0
BLACK_FLAG_TIME=5
SIN_HEIGHT=0
SIN_LENGTH=0
IS_DIRT=1
"@
Set-Content -Path "$trackDir/data/surfaces.ini" -Value $surfacesIni

# 2. models.ini
$modelsIni = @"
[MODEL_0]
FILE=sonoma_autocross.kn5
POSITION=0,0,0
ROTATION=0,0,0
"@
Set-Content -Path "$trackDir/models.ini" -Value $modelsIni

# 3. ui_track.json
$uiTrack = [ordered]@{
    name = "Sonoma Raceway - Paddock Autocross"
    description = "Exact digital twin of the Sunday Autocross course at Sonoma Raceway Paddock, recreated from 1988 Pontiac Fiero GPS telemetry, onboard multi-driver runs, and trackside video. Features all 77 surveyed cone locations, chalked apexes, pointer cones, and timing gates."
    tags = @("autocross", "sonoma", "california", "fiero", "telemetry")
    geotags = @("38.1598", "-122.4551")
    country = "United States"
    city = "Sonoma"
    length = "678 m"
    width = "5 m"
    pitboxes = "1"
    run = "clockwise"
    author = "Jeff Bazarko & Antigravity"
    version = "1.0"
}
$uiTrackJson = $uiTrack | ConvertTo-Json -Depth 5
Set-Content -Path "$trackDir/ui/ui_track.json" -Value $uiTrackJson

Write-Host "Successfully generated surfaces.ini, models.ini, and ui_track.json in $trackDir!"
