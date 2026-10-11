Add-Type -AssemblyName System.Drawing

$json = Get-Content "data/runs_telemetry.json" | ConvertFrom-Json
$cones = Get-Content "data/course_cones.json" | ConvertFrom-Json

$lat0 = 38.1598; $lon0 = -122.4551
$mPerLat = 111030.0; $mPerLon = 111030.0 * [Math]::Cos($lat0 * [Math]::PI / 180.0)

$splineXY = @()
foreach ($p in $json.consensusLine) {
    $splineXY += @{
        X = ($p[1] - $lon0) * $mPerLon
        Y = ($p[0] - $lat0) * $mPerLat
    }
}

# Bounds
$minX = -55.0; $maxX = 85.0
$minY = -105.0; $maxY = 115.0
$rangeX = $maxX - $minX
$rangeY = $maxY - $minY

# --- 1. GENERATE outline.png (512x512 transparent PNG) ---
$outlineBmp = New-Object System.Drawing.Bitmap 512, 512
$gOutline = [System.Drawing.Graphics]::FromImage($outlineBmp)
$gOutline.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::AntiAlias
$gOutline.Clear([System.Drawing.Color]::Transparent)

function MapToOutline($x, $y) {
    $px = 50 + ($x - $minX) / $rangeX * 412
    $py = 462 - ($y - $minY) / $rangeY * 412
    return New-Object System.Drawing.PointF ([float]$px), ([float]$py)
}

$splinePts = New-Object 'System.Drawing.PointF[]' $splineXY.Count
for ($i = 0; $i -lt $splineXY.Count; $i++) {
    $splinePts[$i] = MapToOutline $splineXY[$i].X $splineXY[$i].Y
}

# Draw Course Ribbon
$penTrackBg = New-Object System.Drawing.Pen ([System.Drawing.Color]::FromArgb(180, 255, 255, 255)), 8.0
$penTrackBg.StartCap = [System.Drawing.Drawing2D.LineCap]::Round
$penTrackBg.EndCap = [System.Drawing.Drawing2D.LineCap]::Round
$gOutline.DrawLines($penTrackBg, $splinePts)

$penTrack = New-Object System.Drawing.Pen ([System.Drawing.Color]::FromArgb(255, 14, 165, 233)), 4.0
$gOutline.DrawLines($penTrack, $splinePts)

# Draw Cones as little bright dots
$brushConeOrange = New-Object System.Drawing.SolidBrush ([System.Drawing.Color]::FromArgb(240, 249, 115, 22))
$brushConeYellow = New-Object System.Drawing.SolidBrush ([System.Drawing.Color]::FromArgb(255, 234, 179, 8))
$brushTiming = New-Object System.Drawing.SolidBrush ([System.Drawing.Color]::FromArgb(255, 34, 197, 94))

foreach ($c in $cones) {
    $cp = MapToOutline $c.x $c.y
    $brush = if ($c.type -eq "standing_yellow_apex") { $brushConeYellow } 
             elseif ($c.type -eq "timing_beam_pole") { $brushTiming } 
             else { $brushConeOrange }
    $gOutline.FillEllipse($brush, ($cp.X - 2.5), ($cp.Y - 2.5), 5.0, 5.0)
}

$outlinePath = "content/tracks/sonoma_autocross/ui/outline.png"
$outlineBmp.Save($outlinePath, [System.Drawing.Imaging.ImageFormat]::Png)
$gOutline.Dispose()
$outlineBmp.Dispose()

# --- 2. GENERATE preview.png (1024x576 HD Preview Card) ---
$prevBmp = New-Object System.Drawing.Bitmap 1024, 576
$gPrev = [System.Drawing.Graphics]::FromImage($prevBmp)
$gPrev.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::AntiAlias
$gPrev.TextRenderingHint = [System.Drawing.Text.TextRenderingHint]::AntiAlias

# Background dark asphalt gradient
$rect = New-Object System.Drawing.Rectangle 0, 0, 1024, 576
$brushGrad = New-Object System.Drawing.Drawing2D.LinearGradientBrush $rect, 
    ([System.Drawing.Color]::FromArgb(255, 15, 23, 42)), 
    ([System.Drawing.Color]::FromArgb(255, 2, 6, 23)), 
    ([System.Drawing.Drawing2D.LinearGradientMode]::ForwardDiagonal)
$gPrev.FillRectangle($brushGrad, $rect)

# Draw subtle grid
$penGrid = New-Object System.Drawing.Pen ([System.Drawing.Color]::FromArgb(25, 255, 255, 255)), 1.0
for ($gx = 0; $gx -lt 1024; $gx += 48) { $gPrev.DrawLine($penGrid, $gx, 0, $gx, 576) }
for ($gy = 0; $gy -lt 576; $gy += 48) { $gPrev.DrawLine($penGrid, 0, $gy, 1024, $gy) }

# Draw outline track on right side of preview card
function MapToPrev($x, $y) {
    $px = 560 + ($x - $minX) / $rangeX * 380
    $py = 480 - ($y - $minY) / $rangeY * 400
    return New-Object System.Drawing.PointF ([float]$px), ([float]$py)
}
$prevSplinePts = New-Object 'System.Drawing.PointF[]' $splineXY.Count
for ($i = 0; $i -lt $splineXY.Count; $i++) {
    $prevSplinePts[$i] = MapToPrev $splineXY[$i].X $splineXY[$i].Y
}
$penPrevGlow = New-Object System.Drawing.Pen ([System.Drawing.Color]::FromArgb(50, 14, 165, 233)), 16.0
$penPrevGlow.StartCap = [System.Drawing.Drawing2D.LineCap]::Round
$penPrevGlow.EndCap = [System.Drawing.Drawing2D.LineCap]::Round
$gPrev.DrawLines($penPrevGlow, $prevSplinePts)

$penPrevMain = New-Object System.Drawing.Pen ([System.Drawing.Color]::FromArgb(255, 56, 189, 248)), 4.0
$gPrev.DrawLines($penPrevMain, $prevSplinePts)

foreach ($c in $cones) {
    $cp = MapToPrev $c.x $c.y
    $brush = if ($c.type -eq "standing_yellow_apex") { $brushConeYellow } 
             elseif ($c.type -eq "timing_beam_pole") { $brushTiming } 
             else { $brushConeOrange }
    $gPrev.FillEllipse($brush, ($cp.X - 3.0), ($cp.Y - 3.0), 6.0, 6.0)
}

# Text & Badges on Left
$fontTitle = New-Object System.Drawing.Font "Arial", 28, [System.Drawing.FontStyle]::Bold
$fontSub = New-Object System.Drawing.Font "Arial", 14, [System.Drawing.FontStyle]::Regular
$fontStats = New-Object System.Drawing.Font "Arial", 11, [System.Drawing.FontStyle]::Bold
$fontBody = New-Object System.Drawing.Font "Arial", 10, [System.Drawing.FontStyle]::Regular

$brushWhite = New-Object System.Drawing.SolidBrush ([System.Drawing.Color]::White)
$brushMuted = New-Object System.Drawing.SolidBrush ([System.Drawing.Color]::FromArgb(200, 148, 163, 184))
$brushCyan = New-Object System.Drawing.SolidBrush ([System.Drawing.Color]::FromArgb(255, 56, 189, 248))
$brushOrange = New-Object System.Drawing.SolidBrush ([System.Drawing.Color]::FromArgb(255, 249, 115, 22))

# Event Tag
$gPrev.FillRectangle($brushOrange, 60, 60, 130, 26)
$fontBadge = New-Object System.Drawing.Font "Arial", 10, [System.Drawing.FontStyle]::Bold
$gPrev.DrawString("AUTOX REPLICA", $fontBadge, $brushWhite, 68, 65)

$gPrev.DrawString("SONOMA RACEWAY", $fontTitle, $brushWhite, 58, 98)
$gPrev.DrawString("Paddock Autocross Circuit - Digital Twin", $fontSub, $brushCyan, 60, 145)

# Stats Cards
function DrawStatCard($gx, $x, $y, $w, $h, $label, $val) {
    $cardRect = New-Object System.Drawing.Rectangle $x, $y, $w, $h
    $cardBrush = New-Object System.Drawing.SolidBrush ([System.Drawing.Color]::FromArgb(180, 30, 41, 59))
    $gx.FillRectangle($cardBrush, $cardRect)
    $penBorder = New-Object System.Drawing.Pen ([System.Drawing.Color]::FromArgb(50, 255, 255, 255)), 1.0
    $gx.DrawRectangle($penBorder, $cardRect)
    $gx.DrawString($label, $fontBody, $brushMuted, ($x + 12), ($y + 8))
    $gx.DrawString($val, $fontStats, $brushWhite, ($x + 12), ($y + 26))
}

DrawStatCard $gPrev 60 190 140 55 "COURSE LENGTH" "678 METERS"
DrawStatCard $gPrev 215 190 140 55 "BENCHMARK TIME" "00:54.16"
DrawStatCard $gPrev 60 255 140 55 "SURVEYED CONES" "77 CONES"
DrawStatCard $gPrev 215 255 140 55 "TEST VEHICLE" "1988 FIERO 2.5L"

# Description
$desc = "Recreated from 47 recorded runs, telemetry logs, and high-resolution vantage video. Engineered for vehicle dynamics calibration against real GPS telemetry."
$gPrev.DrawString($desc, $fontBody, $brushMuted, (New-Object System.Drawing.RectangleF 60, 335, 420, 80))

$previewPath = "content/tracks/sonoma_autocross/ui/preview.png"
$prevBmp.Save($previewPath, [System.Drawing.Imaging.ImageFormat]::Png)
$gPrev.Dispose()
$prevBmp.Dispose()

Write-Host "Successfully generated outline.png and preview.png!"
