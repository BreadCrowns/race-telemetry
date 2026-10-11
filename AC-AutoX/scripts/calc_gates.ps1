$lat0 = 38.1598; $lon0 = -122.4551
$mPerLat = 111030.0; $mPerLon = 111030.0 * [Math]::Cos($lat0 * [Math]::PI / 180.0)

function ToXY($lat, $lon) {
    return @{ X = [Math]::Round(($lon - $lon0) * $mPerLon, 2); Y = [Math]::Round(($lat - $lat0) * $mPerLat, 2) }
}

$startP1 = ToXY 38.160750 -122.455580
$startP2 = ToXY 38.160820 -122.455380
$finishP1 = ToXY 38.159010 -122.454700
$finishP2 = ToXY 38.158940 -122.454880

Write-Host "Start Gate P1 (Left): $($startP1.X), $($startP1.Y)"
Write-Host "Start Gate P2 (Right): $($startP2.X), $($startP2.Y)"
Write-Host "Finish Gate P1 (Left): $($finishP1.X), $($finishP1.Y)"
Write-Host "Finish Gate P2 (Right): $($finishP2.X), $($finishP2.Y)"
