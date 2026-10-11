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
$cumDist = 0
for ($i = 0; $i -lt $json.consensusLine.Count; $i++) {
    $p = $json.consensusLine[$i]
    $xy = ToXY $p[0] $p[1]
    if ($i -gt 0) {
        $dx = $xy.X - $pts[$i-1].X
        $dy = $xy.Y - $pts[$i-1].Y
        $cumDist += [Math]::Sqrt($dx*$dx + $dy*$dy)
    }
    $pts += [PSCustomObject]@{
        Index = $i
        Lat = $p[0]
        Lon = $p[1]
        X = [Math]::Round($xy.X, 3)
        Y = [Math]::Round($xy.Y, 3)
        Dist = [Math]::Round($cumDist, 2)
    }
}

# Calculate tangents and curvature (turn radius)
for ($i = 0; $i -lt $pts.Count; $i++) {
    $prev = if ($i -gt 0) { $pts[$i-1] } else { $pts[0] }
    $next = if ($i -lt $pts.Count - 1) { $pts[$i+1] } else { $pts[-1] }
    $tx = $next.X - $prev.X
    $ty = $next.Y - $prev.Y
    $len = [Math]::Sqrt($tx*$tx + $ty*$ty)
    if ($len -gt 0) {
        $tx /= $len
        $ty /= $len
    }
    $pts[$i] | Add-Member -MemberType NoteProperty -Name "Tx" -Value ([Math]::Round($tx, 3))
    $pts[$i] | Add-Member -MemberType NoteProperty -Name "Ty" -Value ([Math]::Round($ty, 3))
    $pts[$i] | Add-Member -MemberType NoteProperty -Name "HeadingDeg" -Value ([Math]::Round([Math]::Atan2($tx, $ty) * 180.0 / [Math]::PI, 1))
}

Write-Host "Total points: $($pts.Count)"
Write-Host "First 5 points:"
$pts[0..4] | Format-Table -AutoSize
Write-Host "Key turns / waypoints every 50 meters:"
for ($d = 0; $d -lt $cumDist; $d += 50) {
    $pt = $pts | Where-Object { $_.Dist -ge $d } | Select-Object -First 1
    Write-Host ("Dist: {0,5:F0}m | X: {1,6:F1} | Y: {2,6:F1} | Heading: {3,5:F1} deg" -f $pt.Dist, $pt.X, $pt.Y, $pt.HeadingDeg)
}
Write-Host ("Dist: {0,5:F0}m | X: {1,6:F1} | Y: {2,6:F1} | Heading: {3,5:F1} deg" -f $pts[-1].Dist, $pts[-1].X, $pts[-1].Y, $pts[-1].HeadingDeg)
