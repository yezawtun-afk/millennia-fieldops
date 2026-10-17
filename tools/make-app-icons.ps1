# Generates the Millennia FieldOps app icons into mobile/assets.
#
# Pure .NET (System.Drawing) - no extra npm packages required.
# Idempotent: overwrites the PNGs each run.
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

$forest = [System.Drawing.Color]::FromArgb(15, 46, 34)      # #0F2E22
$mint   = [System.Drawing.Color]::FromArgb(231, 246, 236)   # #E7F6EC

function New-Monogram {
    param(
        [string]$Path,
        [int]$Size,
        [double]$FontSize,
        [bool]$Transparent
    )

    $bmp = New-Object System.Drawing.Bitmap($Size, $Size, [System.Drawing.Imaging.PixelFormat]::Format32bppArgb)
    $g = [System.Drawing.Graphics]::FromImage($bmp)
    try {
        $g.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::AntiAlias
        $g.TextRenderingHint = [System.Drawing.Text.TextRenderingHint]::AntiAliasGridFit
        $g.Clear($(if ($Transparent) { [System.Drawing.Color]::Transparent } else { $forest }))

        $family = $null
        foreach ($name in @("Segoe UI", "Arial")) {
            $candidate = New-Object System.Drawing.FontFamily($name)
            if ($candidate -ne $null) { $family = $candidate; break }
        }
        if ($family -eq $null) { throw "No usable font family found." }

        $font = New-Object System.Drawing.Font($family, $FontSize, [System.Drawing.FontStyle]::Bold, [System.Drawing.GraphicsUnit]::Pixel)
        $brush = New-Object System.Drawing.SolidBrush($mint)

        $format = New-Object System.Drawing.StringFormat
        $format.Alignment = [System.Drawing.StringAlignment]::Center
        $format.LineAlignment = [System.Drawing.StringAlignment]::Center

        # DrawString centres the full line box (ascender + descender). Nudge the
        # rect down so the visible cap height sits optically in the middle.
        $box = New-Object System.Drawing.RectangleF(0, [float]($FontSize * 0.06), [float]$Size, [float]$Size)
        $g.DrawString("M", $font, $brush, $box, $format)

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

# Legacy/launcher icon: full-bleed background, Android and iOS mask it themselves.
New-Monogram -Path (Join-Path $assets "icon.png")           -Size 1024 -FontSize 700 -Transparent $false
# Android adaptive foreground: transparent, kept inside the ~66% safe circle.
New-Monogram -Path (Join-Path $assets "adaptive-icon.png")  -Size 1024 -FontSize 520 -Transparent $true
# Splash screen mark: transparent, drawn on the #0F2E22 splash background.
# expo-splash-screen requires an `image`; without one its generated theme still
# references @drawable/splashscreen_logo and the Android resource linking step
# fails with "resource drawable/splashscreen_logo not found".
New-Monogram -Path (Join-Path $assets "splash-icon.png")    -Size 1024 -FontSize 620 -Transparent $true

Write-Output "Done."
