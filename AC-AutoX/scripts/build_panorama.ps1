Add-Type -AssemblyName System.Drawing

$frames = @(
    @{ Path = "media/frames/frame_001.jpg"; Title = "Sector 1: Start Gate and Staging"; Sector = 1; XOffset = 0; YOffset = 0 },
    @{ Path = "media/frames/frame_002.jpg"; Title = "Sector 1: Entry Chicane and Turn 1"; Sector = 1; XOffset = 540; YOffset = 30 },
    @{ Path = "media/frames/frame_004.jpg"; Title = "Sector 2: Mid-Paddock Slalom"; Sector = 2; XOffset = 1100; YOffset = 70 },
    @{ Path = "media/frames/frame_006.jpg"; Title = "Sector 3: Hairpin and Back Straight"; Sector = 3; XOffset = 1750; YOffset = 120 },
    @{ Path = "media/frames/frame_007.jpg"; Title = "Sector 3: Finish Gate and Garages"; Sector = 3; XOffset = 2350; YOffset = 140 }
)

# Total panorama canvas width and height
$panoWidth = 3430
$panoHeight = 1920

Write-Output "Creating Panorama canvas: ${panoWidth} x ${panoHeight}..."
$panoBmp = New-Object System.Drawing.Bitmap $panoWidth, $panoHeight
$g = [System.Drawing.Graphics]::FromImage($panoBmp)
$g.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
$g.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::HighQuality
$g.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality
$g.Clear([System.Drawing.Color]::FromArgb(15, 23, 42))

# Draw each frame with feathered alpha blending on the left overlap
for ($i = 0; $i -lt $frames.Count; $i++) {
    $f = $frames[$i]
    $img = [System.Drawing.Bitmap]::FromFile($f.Path)
    $destX = $f.XOffset
    $destY = $f.YOffset
    
    Write-Output "Drawing frame $($i+1): $($f.Title) at X=$destX, Y=$destY"
    
    if ($i -eq 0) {
        $g.DrawImage($img, $destX, $destY, $img.Width, $img.Height)
    } else {
        $prevX = $frames[$i-1].XOffset
        $overlapWidth = ($prevX + 1080) - $destX
        if ($overlapWidth -gt 350) { $overlapWidth = 350 }
        
        $nonOverlapSrcX = [int]$overlapWidth
        $nonOverlapWidth = $img.Width - $nonOverlapSrcX
        $srcRect = New-Object System.Drawing.Rectangle $nonOverlapSrcX, 0, $nonOverlapWidth, $img.Height
        $destRect = New-Object System.Drawing.Rectangle ($destX + $nonOverlapSrcX), $destY, $nonOverlapWidth, $img.Height
        $g.DrawImage($img, $destRect, $srcRect, [System.Drawing.GraphicsUnit]::Pixel)
        
        $slices = 20
        $sliceWidth = [Math]::Ceiling($overlapWidth / $slices)
        for ($s = 0; $s -lt $slices; $s++) {
            $alpha = [float]($s + 1) / [float]$slices
            $colorMatrix = New-Object System.Drawing.Imaging.ColorMatrix
            $colorMatrix.Matrix33 = $alpha
            $imageAttr = New-Object System.Drawing.Imaging.ImageAttributes
            $imageAttr.SetColorMatrix($colorMatrix, [System.Drawing.Imaging.ColorMatrixFlag]::Default, [System.Drawing.Imaging.ColorAdjustType]::Bitmap)
            
            $sx = [int]($s * $sliceWidth)
            $sw = [int]$sliceWidth
            if ($sx + $sw -gt $img.Width) { $sw = $img.Width - $sx }
            
            $sliceSrc = New-Object System.Drawing.Rectangle $sx, 0, $sw, $img.Height
            $sliceDest = New-Object System.Drawing.Rectangle ($destX + $sx), $destY, $sw, $img.Height
            $g.DrawImage($img, $sliceDest, $sliceSrc.X, $sliceSrc.Y, $sliceSrc.Width, $sliceSrc.Height, [System.Drawing.GraphicsUnit]::Pixel, $imageAttr)
            $imageAttr.Dispose()
        }
    }
    $img.Dispose()
}

# --- ADD HIGH-VISIBILITY REFERENCE LABELS ---
Write-Output "Adding reference overlays and annotations..."

# Top Banner Bar
$bannerBrush = New-Object System.Drawing.SolidBrush ([System.Drawing.Color]::FromArgb(235, 9, 13, 22))
$g.FillRectangle($bannerBrush, 0, 0, $panoWidth, 75)
$bannerBrush.Dispose()

# Accent line
$accentPen = New-Object System.Drawing.Pen ([System.Drawing.Color]::FromArgb(249, 115, 22), 4)
$g.DrawLine($accentPen, 0, 75, $panoWidth, 75)
$accentPen.Dispose()

# Fonts and Brushes
$titleFont = New-Object System.Drawing.Font("Segoe UI", [float]20.0)
$subtitleFont = New-Object System.Drawing.Font("Segoe UI", [float]11.0)
$labelFont = New-Object System.Drawing.Font("Segoe UI", [float]11.0)
$subFont = New-Object System.Drawing.Font("Segoe UI", [float]9.5)
$whiteBrush = New-Object System.Drawing.SolidBrush ([System.Drawing.Color]::White)
$cyanBrush = New-Object System.Drawing.SolidBrush ([System.Drawing.Color]::FromArgb(56, 189, 248))

$g.DrawString("SONOMA RACEWAY PADDOCK AUTOCROSS - VIDEO PANORAMIC REFERENCE", $titleFont, $whiteBrush, [float]24.0, [float]12.0)
$g.DrawString("Real-world ground cone calibration reference from 1988 Pontiac Fiero telemetry stint", $subtitleFont, $cyanBrush, [float]24.0, [float]46.0)

# Sector Reference Badges across the panorama
$landmarks = @(
    @{ Text = "START GATE / STAGING"; Sub = "Left Timing Sensor Beam"; X = 280; Y = 95; Color = [System.Drawing.Color]::FromArgb(34, 197, 94) },
    @{ Text = "SECTOR 1: ENTRY CHICANE"; Sub = "Apex Cone + Chalk Circle"; X = 860; Y = 95; Color = [System.Drawing.Color]::FromArgb(56, 189, 248) },
    @{ Text = "SECTOR 2: PADDOCK SLALOM"; Sub = "Mid-Course Speed Section"; X = 1550; Y = 95; Color = [System.Drawing.Color]::FromArgb(249, 115, 22) },
    @{ Text = "SECTOR 3: HAIRPIN APEX"; Sub = "Chalk Marking Ring + Pointers"; X = 2220; Y = 95; Color = [System.Drawing.Color]::FromArgb(234, 179, 8) },
    @{ Text = "FINISH GATE / STOP BOX"; Sub = "Exit Timing Beam and Garages"; X = 2880; Y = 95; Color = [System.Drawing.Color]::FromArgb(239, 68, 68) }
)

foreach ($lm in $landmarks) {
    $boxBrush = New-Object System.Drawing.SolidBrush ([System.Drawing.Color]::FromArgb(220, 15, 23, 42))
    $boxPen = New-Object System.Drawing.Pen ($lm.Color, 2)
    $g.FillRectangle($boxBrush, ($lm.X - 10), ($lm.Y - 5), 260, 48)
    $g.DrawRectangle($boxPen, ($lm.X - 10), ($lm.Y - 5), 260, 48)
    
    $lmBrush = New-Object System.Drawing.SolidBrush ($lm.Color)
    $g.DrawString($lm.Text, $labelFont, $lmBrush, [float]$lm.X, [float]$lm.Y)
    $g.DrawString($lm.Sub, $subFont, $whiteBrush, [float]$lm.X, [float]($lm.Y + 22))
    
    $leaderPen = New-Object System.Drawing.Pen ([System.Drawing.Color]::FromArgb(180, $lm.Color.R, $lm.Color.G, $lm.Color.B), 2)
    $leaderPen.DashStyle = [System.Drawing.Drawing2D.DashStyle]::Dash
    $g.DrawLine($leaderPen, ($lm.X + 120), ($lm.Y + 45), ($lm.X + 120), ($lm.Y + 95))
    $leaderPen.Dispose()
    
    $boxBrush.Dispose(); $boxPen.Dispose(); $lmBrush.Dispose()
}

$titleFont.Dispose(); $subtitleFont.Dispose(); $labelFont.Dispose(); $subFont.Dispose()
$whiteBrush.Dispose(); $cyanBrush.Dispose()
$g.Dispose()

# Save High Quality Jpeg
$jpgEncoder = [System.Drawing.Imaging.ImageCodecInfo]::GetImageEncoders() | Where-Object { $_.FormatID -eq [System.Drawing.Imaging.ImageFormat]::Jpeg.Guid }
$encParams = New-Object System.Drawing.Imaging.EncoderParameters 1
$encParams.Param[0] = New-Object System.Drawing.Imaging.EncoderParameter ([System.Drawing.Imaging.Encoder]::Quality, [long]92)

$outPath1 = "media/sonoma_autocross_panorama.jpg"
$outPath2 = "temp_race_telemetry/sonoma_autocross_panorama.jpg"
$outPath3 = "temp_race_telemetry/prepro/sonoma_autocross_panorama.jpg"
$outPathArtifact = "C:\Users\bazar\.gemini\antigravity\brain\0b4e14e6-53df-4eed-ab78-bed1d48e3fa1\sonoma_autocross_panorama.jpg"

$panoBmp.Save($outPath1, $jpgEncoder, $encParams)
Copy-Item $outPath1 $outPath2 -Force
Copy-Item $outPath1 $outPath3 -Force
Copy-Item $outPath1 $outPathArtifact -Force

$len = (Get-Item $outPath1).Length
$panoBmp.Dispose()
Write-Output "Panoramic photo generated successfully! File size: $len bytes."
