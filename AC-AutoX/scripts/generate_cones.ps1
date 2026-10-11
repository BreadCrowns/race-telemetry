$json = Get-Content "data/runs_telemetry.json" | ConvertFrom-Json
$lat0 = 38.1598; $lon0 = -122.4551
$mPerLat = 111030.0; $mPerLon = 111030.0 * [Math]::Cos($lat0 * [Math]::PI / 180.0)

function ToXY($lat, $lon) {
    return @{ X = ($lon - $lon0) * $mPerLon; Y = ($lat - $lat0) * $mPerLat }
}

# 1. Parse Spline Points
$spline = @()
$cumDist = 0
for ($i = 0; $i -lt $json.consensusLine.Count; $i++) {
    $p = $json.consensusLine[$i]
    $xy = ToXY $p[0] $p[1]
    if ($i -gt 0) {
        $dx = $xy.X - $spline[$i-1].X
        $dy = $xy.Y - $spline[$i-1].Y
        $cumDist += [Math]::Sqrt($dx*$dx + $dy*$dy)
    }
    $spline += [PSCustomObject]@{
        Index = $i
        X = $xy.X
        Y = $xy.Y
        Dist = $cumDist
    }
}

# Calculate tangents and normals along spline
for ($i = 0; $i -lt $spline.Count; $i++) {
    $prev = if ($i -gt 0) { $spline[$i-1] } else { $spline[0] }
    $next = if ($i -lt $spline.Count - 1) { $spline[$i+1] } else { $spline[-1] }
    $tx = $next.X - $prev.X
    $ty = $next.Y - $prev.Y
    $len = [Math]::Sqrt($tx*$tx + $ty*$ty)
    if ($len -gt 0) { $tx /= $len; $ty /= $len }
    # Normal is 90 deg counter-clockwise (-ty, tx) -> Left normal
    $nx = -$ty
    $ny = $tx
    $spline[$i] | Add-Member -MemberType NoteProperty -Name "Tx" -Value $tx
    $spline[$i] | Add-Member -MemberType NoteProperty -Name "Ty" -Value $ty
    $spline[$i] | Add-Member -MemberType NoteProperty -Name "Nx" -Value $nx
    $spline[$i] | Add-Member -MemberType NoteProperty -Name "Ny" -Value $ny
    $spline[$i] | Add-Member -MemberType NoteProperty -Name "HeadingDeg" -Value ([Math]::Round([Math]::Atan2($tx, $ty) * 180.0 / [Math]::PI, 1))
}

# Sonoma Paddock elevation slope (~1.2% slope towards south drain)
function GetElevation($x, $y) {
    return [Math]::Round(0.012 * $y + 0.003 * $x, 3)
}

$cones = @()
$coneId = 1

function AddCone($type, $x, $y, $heading, $hasChalk, $sector, $notes) {
    $global:coneId = $global:coneId
    $z = GetElevation $x $y
    $script:cones += [PSCustomObject]@{
        id = ("cone_{0:D3}" -f $script:coneId++)
        type = $type
        x = [Math]::Round($x, 3)
        y = [Math]::Round($y, 3)
        z = $z
        heading_deg = [Math]::Round($heading, 1)
        has_chalk_circle = $hasChalk
        sector = $sector
        notes = $notes
    }
}

# START GATE (Beam and Flanking Cones)
# Start Gate Left: -41.9, 105.48 | Right: -24.44, 113.25
AddCone "timing_beam_pole" -41.9 105.48 -145 $true 1 "Start Gate Left Timing Sensor"
AddCone "standing_orange" -41.4 105.7 -145 $true 1 "Start Gate Left Outer Flank Cone"
AddCone "timing_beam_pole" -24.44 113.25 -145 $true 1 "Start Gate Right Timing Sensor"
AddCone "standing_orange" -24.9 113.0 -145 $true 1 "Start Gate Right Outer Flank Cone"

# Staging Box Cones
AddCone "standing_orange" -36.5 118.0 -145 $false 1 "Staging Box Left Entry"
AddCone "standing_orange" -28.5 122.0 -145 $false 1 "Staging Box Right Entry"

# Generate Gate, Slalom, and Boundary Cones along course
# Corridors typically 3.5m to 4.5m wide in autocross
$targetDistances = @(
    @{ Dist = 15; Type = "gate"; Width = 4.2; Sector = 1; Notes = "Sector 1 Launch Gate" },
    @{ Dist = 30; Type = "slalom"; Side = "left"; Offset = 1.8; Sector = 1; Notes = "Slalom Cone 1 (Pass Right)" },
    @{ Dist = 45; Type = "slalom"; Side = "right"; Offset = 1.8; Sector = 1; Notes = "Slalom Cone 2 (Pass Left)" },
    @{ Dist = 60; Type = "apex_right"; Radius = 4.0; Sector = 1; Notes = "Turn 1 Entry Chalked Apex (Yellow)" },
    @{ Dist = 75; Type = "gate"; Width = 4.5; Sector = 1; Notes = "Turn 1 Exit Gate" },
    @{ Dist = 95; Type = "apex_left"; Radius = 3.8; Sector = 2; Notes = "Turn 2 Infield Left Apex" },
    @{ Dist = 115; Type = "gate"; Width = 4.0; Sector = 2; Notes = "Midfield Chute Gate" },
    @{ Dist = 135; Type = "slalom"; Side = "right"; Offset = 1.8; Sector = 2; Notes = "Sector 2 Slalom 1" },
    @{ Dist = 150; Type = "slalom"; Side = "left"; Offset = 1.8; Sector = 2; Notes = "Sector 2 Slalom 2" },
    @{ Dist = 170; Type = "apex_right"; Radius = 4.0; Sector = 3; Notes = "Turn 3 Sweeper Entry Apex" },
    @{ Dist = 190; Type = "gate"; Width = 4.5; Sector = 3; Notes = "Cross-Lot Transition Gate" },
    @{ Dist = 215; Type = "gate"; Width = 4.5; Sector = 3; Notes = "East Paddock Ingress Gate" },
    @{ Dist = 240; Type = "apex_left"; Radius = 4.2; Sector = 3; Notes = "East Paddock Sweeper Apex" },
    @{ Dist = 265; Type = "gate"; Width = 4.2; Sector = 4; Notes = "Far Paddock Entry Gate" },
    @{ Dist = 285; Type = "slalom"; Side = "left"; Offset = 1.8; Sector = 4; Notes = "Far Section Slalom 1" },
    @{ Dist = 305; Type = "slalom"; Side = "right"; Offset = 1.8; Sector = 4; Notes = "Far Section Slalom 2" },
    @{ Dist = 325; Type = "slalom"; Side = "left"; Offset = 1.8; Sector = 4; Notes = "Far Section Slalom 3" },
    @{ Dist = 350; Type = "gate"; Width = 4.2; Sector = 4; Notes = "Turn 4 Lead-in Gate" },
    @{ Dist = 375; Type = "apex_right"; Radius = 4.0; Sector = 4; Notes = "Turn 4 Hairpin Entry Apex" },
    @{ Dist = 400; Type = "hairpin_turnaround"; Radius = 4.5; Sector = 4; Notes = "Far North Hairpin Turnaround Key Cone" },
    @{ Dist = 425; Type = "gate"; Width = 4.5; Sector = 5; Notes = "North Turnaround Exit Gate" },
    @{ Dist = 450; Type = "slalom"; Side = "right"; Offset = 1.8; Sector = 5; Notes = "Return Blast Slalom 1" },
    @{ Dist = 475; Type = "slalom"; Side = "left"; Offset = 1.8; Sector = 5; Notes = "Return Blast Slalom 2" },
    @{ Dist = 500; Type = "gate"; Width = 4.2; Sector = 5; Notes = "Midfield Return Gate" },
    @{ Dist = 525; Type = "apex_left"; Radius = 4.0; Sector = 5; Notes = "Turn 5 Infield Return Apex" },
    @{ Dist = 550; Type = "gate"; Width = 4.2; Sector = 5; Notes = "Sector 5 Exit Gate" },
    @{ Dist = 575; Type = "apex_right"; Radius = 4.0; Sector = 6; Notes = "Final Complex Entry Apex" },
    @{ Dist = 600; Type = "slalom"; Side = "left"; Offset = 1.8; Sector = 6; Notes = "Final Slalom 1" },
    @{ Dist = 625; Type = "slalom"; Side = "right"; Offset = 1.8; Sector = 6; Notes = "Final Slalom 2" },
    @{ Dist = 650; Type = "gate"; Width = 4.5; Sector = 6; Notes = "Final Chute Gate" },
    @{ Dist = 665; Type = "gate"; Width = 4.2; Sector = 6; Notes = "Finish Approach Gate" }
)

foreach ($item in $targetDistances) {
    # Find closest spline point
    $pt = $spline | Where-Object { $_.Dist -ge $item.Dist } | Select-Object -First 1
    if (-not $pt) { continue }
    
    $tx = $pt.Tx; $ty = $pt.Ty; $nx = $pt.Nx; $ny = $pt.Ny; $h = $pt.HeadingDeg
    
    switch ($item.Type) {
        "gate" {
            $halfW = $item.Width / 2.0
            $lx = $pt.X + $nx * $halfW
            $ly = $pt.Y + $ny * $halfW
            $rx = $pt.X - $nx * $halfW
            $ry = $pt.Y - $ny * $halfW
            AddCone "standing_orange" $lx $ly $h $false $item.Sector "$($item.Notes) - Left"
            AddCone "standing_orange" $rx $ry $h $false $item.Sector "$($item.Notes) - Right"
        }
        "slalom" {
            $sign = if ($item.Side -eq "left") { 1.0 } else { -1.0 }
            $cx = $pt.X + $nx * ($item.Offset * $sign)
            $cy = $pt.Y + $ny * ($item.Offset * $sign)
            AddCone "standing_orange" $cx $cy $h $true $item.Sector "$($item.Notes)"
            # Add pointer cone flat on pavement
            $px = $cx + ($nx * -0.5 * $sign)
            $py = $cy + ($ny * -0.5 * $sign)
            $ptrHeading = if ($item.Side -eq "left") { $h - 90 } else { $h + 90 }
            AddCone "pointer_flat" $px $py $ptrHeading $false $item.Sector "$($item.Notes) - Pointer"
        }
        "apex_right" {
            $cx = $pt.X - $nx * $item.Radius
            $cy = $pt.Y - $ny * $item.Radius
            AddCone "standing_yellow_apex" $cx $cy $h $true $item.Sector "$($item.Notes) - Chalked Apex"
            $px = $cx - $nx * 0.6
            $py = $cy - $ny * 0.6
            AddCone "pointer_flat" $px $py ($h + 90) $false $item.Sector "$($item.Notes) - Pointer"
        }
        "apex_left" {
            $cx = $pt.X + $nx * $item.Radius
            $cy = $pt.Y + $ny * $item.Radius
            AddCone "standing_yellow_apex" $cx $cy $h $true $item.Sector "$($item.Notes) - Chalked Apex"
            $px = $cx + $nx * 0.6
            $py = $cy + $ny * 0.6
            AddCone "pointer_flat" $px $py ($h - 90) $false $item.Sector "$($item.Notes) - Pointer"
        }
        "hairpin_turnaround" {
            $cx = $pt.X - $nx * $item.Radius
            $cy = $pt.Y - $ny * $item.Radius
            AddCone "standing_orange" $cx $cy $h $true $item.Sector "$($item.Notes) - Center Apex"
            AddCone "standing_orange" ($cx - $tx * 1.5) ($cy - $ty * 1.5) $h $true $item.Sector "$($item.Notes) - Stack 1"
            AddCone "standing_orange" ($cx + $tx * 1.5) ($cy + $ty * 1.5) $h $true $item.Sector "$($item.Notes) - Stack 2"
            AddCone "pointer_flat" ($cx - $nx * 0.8) ($cy - $ny * 0.8) ($h + 90) $false $item.Sector "$($item.Notes) - Pointer"
        }
    }
}

# FINISH GATE & STOP BOX
# Finish Gate Left: 34.92, -87.71 | Right: 19.21, -95.49
AddCone "timing_beam_pole" 34.92 -87.71 134 $true 6 "Finish Gate Left Timing Sensor"
AddCone "standing_orange" 35.4 -87.4 134 $true 6 "Finish Gate Left Flank Cone"
AddCone "timing_beam_pole" 19.21 -95.49 134 $true 6 "Finish Gate Right Timing Sensor"
AddCone "standing_orange" 18.7 -95.7 134 $true 6 "Finish Gate Right Flank Cone"

# Stop Box Cones (after finish line)
AddCone "standing_orange" 31.0 -105.0 134 $true 6 "Stop Box Left Boundary"
AddCone "standing_orange" 16.0 -111.0 134 $true 6 "Stop Box Right Boundary"
AddCone "standing_orange" 23.5 -118.0 134 $false 6 "Stop Box End Barrier Cone"

# Save to JSON
$conesJson = $cones | ConvertTo-Json -Depth 5
Set-Content -Path "data/course_cones.json" -Value $conesJson

# Save to CSV
$csvHeader = "id,type,x,y,z,heading_deg,has_chalk_circle,sector,notes"
$csvLines = @($csvHeader)
foreach ($c in $cones) {
    $csvLines += "$($c.id),$($c.type),$($c.x),$($c.y),$($c.z),$($c.heading_deg),$($c.has_chalk_circle),$($c.sector),`"$($c.notes)`""
}
Set-Content -Path "data/course_cones.csv" -Value $csvLines

Write-Host "Successfully generated $($cones.Count) cones in data/course_cones.json and data/course_cones.csv!"
