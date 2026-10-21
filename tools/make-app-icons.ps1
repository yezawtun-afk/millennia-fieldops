# Generates the Millennia Village app icons into mobile/assets (and the web
# favicon into web/src/app).
#
# The mark is the wordmark used on the site: "Millennia / Village" in a cream
# serif on the forest background. Pure .NET (System.Drawing) - no extra npm
# packages required. Idempotent: overwrites the PNGs each run.
#
# Usage:
#   powershell -ExecutionPolicy Bypass -File tools\make-app-icons.ps1

param(
    [string]$Root = (Split-Path -Parent $PSScriptRoot)
)

$ErrorActionPreference = "Stop"
Add-Type -AssemblyName System.Drawing

$assets = Join-Path $Root "mobile\assets"
New-Item -ItemType Directory -Force -Path $assets | Out-Null
$webApp = Join-Path $Root "web\src\app"
New-Item -ItemType Directory -Force -Path $webApp | Out-Null

$forest = [System.Drawing.Color]::FromArgb(29, 47, 36)      # #1D2F24
$cream  = [System.Drawing.Color]::FromArgb(244, 240, 228)   # #F4F0E4

# Adobe Garamond Pro matches the site's wordmark; the rest are fallbacks for a
# machine that does not have it installed.
$fontNames = @("Adobe Garamond Pro", "Palatino Linotype", "Georgia", "Times New Roman")

function Resolve-Family {
    foreach ($name in $fontNames) {
        try {
            $family = New-Object System.Drawing.FontFamily($name)
            if ($family -ne $null) { return $family }
        } catch { }
    }
    throw "No usable serif font family found."
}

# Largest font size whose "Millennia" line is exactly $TargetWidth pixels wide.
function Get-FittedSize {
    param($Graphics, $Family, [string]$Text, [double]$TargetWidth)

    $format = New-Object System.Drawing.StringFormat
    $size = 100.0
    for ($i = 0; $i -lt 6; $i++) {
        $font = New-Object System.Drawing.Font($Family, [float]$size, [System.Drawing.FontStyle]::Regular, [System.Drawing.GraphicsUnit]::Pixel)
        $measured = $Graphics.MeasureString($Text, $font, 10000, $format)
        $font.Dispose()
        if ($measured.Width -le 0) { break }
        $size = $size * ($TargetWidth / $measured.Width)
    }
    $format.Dispose()
    return $size
}

function New-Wordmark {
    param(
        [string]$Path,
        [int]$Size,
        [double]$WidthFraction,
        [bool]$Transparent
    )

    $bmp = New-Object System.Drawing.Bitmap($Size, $Size, [System.Drawing.Imaging.PixelFormat]::Format32bppArgb)
    $g = [System.Drawing.Graphics]::FromImage($bmp)
    try {
        $g.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::AntiAlias
        $g.TextRenderingHint = [System.Drawing.Text.TextRenderingHint]::AntiAliasGridFit
        $g.Clear($(if ($Transparent) { [System.Drawing.Color]::Transparent } else { $forest }))

        $family = Resolve-Family
        $fontSize = Get-FittedSize -Graphics $g -Family $family -Text "Millennia" -TargetWidth ($Size * $WidthFraction)
        $font = New-Object System.Drawing.Font($family, [float]$fontSize, [System.Drawing.FontStyle]::Regular, [System.Drawing.GraphicsUnit]::Pixel)
        $brush = New-Object System.Drawing.SolidBrush($cream)

        $format = New-Object System.Drawing.StringFormat
        $format.Alignment = [System.Drawing.StringAlignment]::Center
        $format.LineAlignment = [System.Drawing.StringAlignment]::Center

        $fontHeight = $font.GetHeight($g)
        $step = $fontHeight * 0.95            # line pitch, tighter than the default
        $centerY = ($Size / 2) - ($fontHeight * 0.015)
        $boxHeight = $fontHeight * 1.2

        $line1 = New-Object System.Drawing.RectangleF(0, [float]($centerY - $step / 2 - $boxHeight / 2), [float]$Size, [float]$boxHeight)
        $line2 = New-Object System.Drawing.RectangleF(0, [float]($centerY + $step / 2 - $boxHeight / 2), [float]$Size, [float]$boxHeight)
        $g.DrawString("Millennia", $font, $brush, $line1, $format)
        $g.DrawString("Village", $font, $brush, $line2, $format)

        $bmp.Save($Path, [System.Drawing.Imaging.ImageFormat]::Png)

        $brush.Dispose()
        $font.Dispose()
        $family.Dispose()
        $format.Dispose()
    }
    finally {
        $g.Dispose()
        $bmp.Dispose()
    }

    Write-Output ("wrote {0} ({1}x{1})" -f $Path, $Size)
}

# Launcher icon: full-bleed background, masked by the OS.
New-Wordmark -Path (Join-Path $assets "icon.png")           -Size 1024 -WidthFraction 0.76 -Transparent $false
# Android adaptive foreground: transparent, kept inside the ~66% safe circle.
New-Wordmark -Path (Join-Path $assets "adaptive-icon.png")  -Size 1024 -WidthFraction 0.57 -Transparent $true
# Splash screen mark: transparent, drawn on the forest background.
# expo-splash-screen requires an `image`; without one its generated theme still
# references @drawable/splashscreen_logo and the Android resource linking step
# fails with "resource drawable/splashscreen_logo not found".
New-Wordmark -Path (Join-Path $assets "splash-icon.png")    -Size 1024 -WidthFraction 0.78 -Transparent $true
# Web favicon (Next.js picks app/icon.png up automatically).
New-Wordmark -Path (Join-Path $webApp "icon.png")           -Size 512  -WidthFraction 0.76 -Transparent $false

Write-Output "Done."
