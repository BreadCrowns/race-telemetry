$baseDir = Split-Path -Parent $PSScriptRoot
$jsonPath = if (Test-Path "$baseDir/course_cones_adjusted.json") { "$baseDir/course_cones_adjusted.json" } else { "$baseDir/course_cones.json" }
$cones = Get-Content $jsonPath | ConvertFrom-Json
$trackDir = "$baseDir/content/tracks/sonoma_autocross"
$objPath = "$trackDir/sonoma_autocross.obj"
$mtlPath = "$trackDir/sonoma_autocross.mtl"

# 1. Write MTL File
$mtlContent = @"
# Sonoma Autocross Materials
newmtl MAT_ASPHALT_PADDOCK
Ka 0.8 0.8 0.8
Kd 1.0 1.0 1.0
Ks 0.05 0.05 0.05
Ns 10.0
d 1.0
map_Kd sonoma_paddock_z19.jpg

newmtl MAT_CONE_ORANGE
Ka 0.8 0.2 0.0
Kd 0.95 0.35 0.05
Ks 0.2 0.2 0.2
Ns 20.0
d 1.0

newmtl MAT_CONE_YELLOW
Ka 0.8 0.8 0.0
Kd 0.9 0.95 0.1
Ks 0.2 0.2 0.2
Ns 20.0
d 1.0

newmtl MAT_CHALK
Ka 0.9 0.9 0.9
Kd 0.95 0.95 0.95
Ks 0.0 0.0 0.0
Ns 5.0
d 0.85

newmtl MAT_TIMING_SENSOR
Ka 0.1 0.7 0.2
Kd 0.1 0.9 0.2
Ks 0.5 0.5 0.5
Ns 30.0
d 1.0
"@
Set-Content -Path $mtlPath -Value $mtlContent

# 2. OBJ Generator with vertex indexing
$sb = New-Object System.Text.StringBuilder
[void]$sb.AppendLine("# Sonoma Raceway Paddock Autocross 3D Model")
[void]$sb.AppendLine("mtllib sonoma_autocross.mtl")

$vIndex = 1

function GetElevation($x, $y) {
    return [Math]::Round(0.012 * $y + 0.003 * $x, 3)
}

# --- A. PADDOCK ROAD MESH (1ROAD_paddock) ---
[void]$sb.AppendLine("o 1ROAD_paddock")
[void]$sb.AppendLine("usemtl MAT_ASPHALT_PADDOCK")

$minX = -70.0; $maxX = 100.0; $stepX = 5.0
$minY = -120.0; $maxY = 140.0; $stepY = 5.0
$nx = [int](($maxX - $minX) / $stepX) + 1
$ny = [int](($maxY - $minY) / $stepY) + 1

$gridVStart = $vIndex

$lat0 = 38.1598; $lon0 = -122.4551
$mPerLat = 111030.0
$mPerLon = 111030.0 * [Math]::Cos($lat0 * [Math]::PI / 180.0)
$zoom = 19
$minTileX = 83802; $minTileY = 201934
$n = [Math]::Pow(2.0, $zoom) * 256.0
$imgW = 1536.0; $imgH = 1792.0

# Vertices
for ($iy = 0; $iy -lt $ny; $iy++) {
    $y2d = $minY + $iy * $stepY
    for ($ix = 0; $ix -lt $nx; $ix++) {
        $x2d = $minX + $ix * $stepX
        $zElev = GetElevation $x2d $y2d
        # Convert to 3D (X = East, Y = Up, Z = -Y2d)
        $x3d = $x2d
        $y3d = $zElev
        $z3d = -$y2d
        
        # Satellite UV mapping
        $lat = $lat0 + ($y2d / $mPerLat)
        $lon = $lon0 + ($x2d / $mPerLon)
        $latRad = $lat * [Math]::PI / 180.0
        $sinLat = [Math]::Sin($latRad)
        $px = ($lon + 180.0) / 360.0 * $n - ($minTileX * 256.0)
        $py = (0.5 - [Math]::Log((1.0 + $sinLat) / (1.0 - $sinLat)) / (4.0 * [Math]::PI)) * $n - ($minTileY * 256.0)
        $u = [Math]::Round($px / $imgW, 6)
        $v = [Math]::Round(1.0 - ($py / $imgH), 6)

        [void]$sb.AppendLine(("v {0:F3} {1:F3} {2:F3}" -f $x3d, $y3d, $z3d))
        [void]$sb.AppendLine(("vt {0:F6} {1:F6}" -f $u, $v))
        $vIndex++
    }
}
# Normals (Up)
[void]$sb.AppendLine("vn 0.0 1.0 0.0")
$normIdx = 1

# Faces
for ($iy = 0; $iy -lt ($ny - 1); $iy++) {
    for ($ix = 0; $ix -lt ($nx - 1); $ix++) {
        $i1 = $gridVStart + ($iy * $nx) + $ix
        $i2 = $gridVStart + ($iy * $nx) + $ix + 1
        $i3 = $gridVStart + (($iy + 1) * $nx) + $ix + 1
        $i4 = $gridVStart + (($iy + 1) * $nx) + $ix
        [void]$sb.AppendLine(("f {0}/{0}/{3} {1}/{1}/{3} {2}/{2}/{3}" -f $i1, $i2, $i3, $normIdx))
        [void]$sb.AppendLine(("f {0}/{0}/{3} {1}/{1}/{3} {2}/{2}/{3}" -f $i1, $i3, $i4, $normIdx))
    }
}

# --- B. CONES GENERATION ---
foreach ($c in $cones) {
    $objName = $c.id
    $mat = if ($c.type -eq "standing_yellow_apex") { "MAT_CONE_YELLOW" } 
           elseif ($c.type -eq "timing_beam_pole") { "MAT_TIMING_SENSOR" }
           else { "MAT_CONE_ORANGE" }

    $baseZ = GetElevation $c.x $c.y
    $cx = $c.x
    $cy = $baseZ
    $cz = -$c.y

    [void]$sb.AppendLine("o $objName")
    [void]$sb.AppendLine("usemtl $mat")

    if ($c.type -eq "pointer_flat") {
        # Pointer Cone lying flat on pavement pointing along heading
        $hRad = ($c.heading_deg) * [Math]::PI / 180.0
        $dx = [Math]::Sin($hRad) * 0.4
        $dz = -[Math]::Cos($hRad) * 0.4
        $px = -[Math]::Cos($hRad) * 0.12
        $pz = -[Math]::Sin($hRad) * 0.12

        $p1 = @($cx - $px, $cy + 0.015, $cz - $pz)
        $p2 = @($cx + $px, $cy + 0.015, $cz + $pz)
        $p3 = @($cx + $dx, $cy + 0.015, $cz + $dz)
        $pTop = @($cx, $cy + 0.05, $cz)

        $startIdx = $vIndex
        [void]$sb.AppendLine(("v {0:F3} {1:F3} {2:F3}" -f $p1[0], $p1[1], $p1[2]))
        [void]$sb.AppendLine(("v {0:F3} {1:F3} {2:F3}" -f $p2[0], $p2[1], $p2[2]))
        [void]$sb.AppendLine(("v {0:F3} {1:F3} {2:F3}" -f $p3[0], $p3[1], $p3[2]))
        [void]$sb.AppendLine(("v {0:F3} {1:F3} {2:F3}" -f $pTop[0], $pTop[1], $pTop[2]))
        $vIndex += 4

        [void]$sb.AppendLine(("f {0} {1} {2}" -f ($startIdx), ($startIdx+1), ($startIdx+2)))
        [void]$sb.AppendLine(("f {0} {1} {3}" -f ($startIdx), ($startIdx+1), ($startIdx+3)))
        [void]$sb.AppendLine(("f {1} {2} {3}" -f ($startIdx+1), ($startIdx+2), ($startIdx+3)))
        [void]$sb.AppendLine(("f {2} {0} {3}" -f ($startIdx+2), ($startIdx), ($startIdx+3)))
    }
    elseif ($c.type -eq "timing_beam_pole") {
        # Timing beam sensor pole (1.0m tall cylinder / prism)
        $startIdx = $vIndex
        $r = 0.06; $h = 1.0
        for ($a = 0; $a -lt 4; $a++) {
            $ang = $a * [Math]::PI / 2.0
            $vx = $cx + [Math]::Cos($ang) * $r
            $vz = $cz + [Math]::Sin($ang) * $r
            [void]$sb.AppendLine(("v {0:F3} {1:F3} {2:F3}" -f $vx, $cy, $vz))
            [void]$sb.AppendLine(("v {0:F3} {1:F3} {2:F3}" -f $vx, ($cy + $h), $vz))
            $vIndex += 2
        }
        for ($a = 0; $a -lt 4; $a++) {
            $b1 = $startIdx + ($a * 2)
            $t1 = $b1 + 1
            $b2 = $startIdx + ((($a + 1) % 4) * 2)
            $t2 = $b2 + 1
            [void]$sb.AppendLine(("f {0} {1} {2}" -f $b1, $b2, $t2))
            [void]$sb.AppendLine(("f {0} {1} {2}" -f $b1, $t2, $t1))
        }
    }
    else {
        # Standard Standing Cone (Base plate + Conical Body)
        # Base plate (0.28m x 0.28m x 0.02m)
        $startIdx = $vIndex
        $bHalf = 0.14
        [void]$sb.AppendLine(("v {0:F3} {1:F3} {2:F3}" -f ($cx - $bHalf), $cy, ($cz - $bHalf)))
        [void]$sb.AppendLine(("v {0:F3} {1:F3} {2:F3}" -f ($cx + $bHalf), $cy, ($cz - $bHalf)))
        [void]$sb.AppendLine(("v {0:F3} {1:F3} {2:F3}" -f ($cx + $bHalf), $cy, ($cz + $bHalf)))
        [void]$sb.AppendLine(("v {0:F3} {1:F3} {2:F3}" -f ($cx - $bHalf), $cy, ($cz + $bHalf)))
        [void]$sb.AppendLine(("v {0:F3} {1:F3} {2:F3}" -f ($cx - $bHalf), ($cy + 0.02), ($cz - $bHalf)))
        [void]$sb.AppendLine(("v {0:F3} {1:F3} {2:F3}" -f ($cx + $bHalf), ($cy + 0.02), ($cz - $bHalf)))
        [void]$sb.AppendLine(("v {0:F3} {1:F3} {2:F3}" -f ($cx + $bHalf), ($cy + 0.02), ($cz + $bHalf)))
        [void]$sb.AppendLine(("v {0:F3} {1:F3} {2:F3}" -f ($cx - $bHalf), ($cy + 0.02), ($cz + $bHalf)))
        $vIndex += 8

        # Base faces
        [void]$sb.AppendLine(("f {0} {1} {2}" -f ($startIdx+4), ($startIdx+5), ($startIdx+6)))
        [void]$sb.AppendLine(("f {0} {1} {2}" -f ($startIdx+4), ($startIdx+6), ($startIdx+7)))

        # Conical Body (6-sided pyramid, 0.45m high)
        $coneStart = $vIndex
        $rBottom = 0.09; $rTop = 0.02; $cH = 0.45
        for ($s = 0; $s -lt 6; $s++) {
            $ang = $s * [Math]::PI / 3.0
            $vx1 = $cx + [Math]::Cos($ang) * $rBottom
            $vz1 = $cz + [Math]::Sin($ang) * $rBottom
            $vx2 = $cx + [Math]::Cos($ang) * $rTop
            $vz2 = $cz + [Math]::Sin($ang) * $rTop
            [void]$sb.AppendLine(("v {0:F3} {1:F3} {2:F3}" -f $vx1, ($cy + 0.02), $vz1))
            [void]$sb.AppendLine(("v {0:F3} {1:F3} {2:F3}" -f $vx2, ($cy + $cH), $vz2))
            $vIndex += 2
        }
        for ($s = 0; $s -lt 6; $s++) {
            $b1 = $coneStart + ($s * 2)
            $t1 = $b1 + 1
            $b2 = $coneStart + ((($s + 1) % 6) * 2)
            $t2 = $b2 + 1
            [void]$sb.AppendLine(("f {0} {1} {2}" -f $b1, $b2, $t2))
            [void]$sb.AppendLine(("f {0} {1} {2}" -f $b1, $t2, $t1))
        }

        # Chalk circle if present
        if ($c.has_chalk_circle) {
            [void]$sb.AppendLine("usemtl MAT_CHALK")
            $chalkStart = $vIndex
            $rChalkIn = 0.38; $rChalkOut = 0.44
            for ($s = 0; $s -lt 8; $s++) {
                $ang = $s * [Math]::PI / 4.0
                $cInX = $cx + [Math]::Cos($ang) * $rChalkIn
                $cInZ = $cz + [Math]::Sin($ang) * $rChalkIn
                $cOutX = $cx + [Math]::Cos($ang) * $rChalkOut
                $cOutZ = $cz + [Math]::Sin($ang) * $rChalkOut
                [void]$sb.AppendLine(("v {0:F3} {1:F3} {2:F3}" -f $cInX, ($cy + 0.005), $cInZ))
                [void]$sb.AppendLine(("v {0:F3} {1:F3} {2:F3}" -f $cOutX, ($cy + 0.005), $cOutZ))
                $vIndex += 2
            }
            for ($s = 0; $s -lt 8; $s++) {
                $ci1 = $chalkStart + ($s * 2)
                $co1 = $ci1 + 1
                $ci2 = $chalkStart + ((($s + 1) % 8) * 2)
                $co2 = $ci2 + 1
                [void]$sb.AppendLine(("f {0} {1} {2}" -f $ci1, $co1, $co2))
                [void]$sb.AppendLine(("f {0} {1} {2}" -f $ci1, $co2, $ci2))
            }
        }
    }
}

# Write out OBJ file
[System.IO.File]::WriteAllText($objPath, $sb.ToString())
$fileSize = (Get-Item $objPath).Length / 1024
Write-Host "Successfully generated 3D track mesh: $objPath ($([Math]::Round($fileSize, 1)) KB)!"

