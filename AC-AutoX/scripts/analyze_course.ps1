$json = Get-Content "data/runs_telemetry.json" | ConvertFrom-Json
$lat0 = 38.1598
$lon0 = -122.4551
$mPerLat = 111030.0
$mPerLon = 111030.0 * [Math]::Cos($lat0 * [Math]::PI / 180.0)

function ToXY($lat, $lon) {
    return @{
        X = ($lon - $lon0) * $mPerLon
        Y = ($lat - $lat0) * $mPerLat
    }
}

$pts = @()
foreach ($p in $json.consensusLine) {
    $xy = ToXY $p[0] $p[1]
    $pts += [PSCustomObject]@{
        Lat = $p[0]
        Lon = $p[1]
        X = [Math]::Round($xy.X, 2)
        Y = [Math]::Round($xy.Y, 2)
    }
}

$minX = ($pts | Measure-Object -Property X -Minimum).Minimum
$maxX = ($pts | Measure-Object -Property X -Maximum).Maximum
$minY = ($pts | Measure-Object -Property Y -Minimum).Minimum
$maxY = ($pts | Measure-Object -Property Y -Maximum).Maximum

Write-Host "Total Consensus Points: $($pts.Count)"
Write-Host "X Range (East-West): $minX m to $maxX m (Width: $([Math]::Round($maxX - $minX, 1)) m)"
Write-Host "Y Range (North-South): $minY m to $maxY m (Length: $([Math]::Round($maxY - $minY, 1)) m)"
Write-Host "Start Point XY: $($pts[0].X), $($pts[0].Y)"
Write-Host "Finish Point XY: $($pts[-1].X), $($pts[-1].Y)"

# Calculate total distance along consensus line
$dist = 0
for ($i = 1; $i -lt $pts.Count; $i++) {
    $dx = $pts[$i].X - $pts[$i-1].X
    $dy = $pts[$i].Y - $pts[$i-1].Y
    $dist += [Math]::Sqrt($dx*$dx + $dy*$dy)
}
Write-Host "Total Course Spline Length: $([Math]::Round($dist, 1)) meters ($([Math]::Round($dist * 3.28084, 1)) ft)"
