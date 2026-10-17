# eas-build.ps1
#
# Runs an EAS Build for the mobile app from this Windows + OneDrive checkout.
#
# Why this script exists
# ---------------------
# `mobile\node_modules`, `web\node_modules` and `web\.next` are junctions that
# point outside OneDrive (see onedrive-links.ps1). Before uploading, EAS CLI
# copies the whole repository into a temporary shallow clone and tries to
# recreate those junctions as **symlinks**. Windows refuses to create symlinks
# unless Developer Mode is on or the shell is elevated, so the upload dies with:
#
#     EPERM: operation not permitted, symlink '...next-dist' -> '...\web\.next'
#
# EAS does not need those folders locally: it installs dependencies and builds
# on its own servers. So we briefly remove the junction *links* (the real files
# in %LOCALAPPDATA%\node_modules-store are untouched), run the build, and put
# the links back afterwards.
#
# Usage (from anywhere):
#     powershell -ExecutionPolicy Bypass -File tools\eas-build.ps1
#     powershell -ExecutionPolicy Bypass -File tools\eas-build.ps1 -Profile production
#
# Restoring the links needs neither a download nor an `npm install`.

param(
    [ValidateSet("preview", "production")]
    [string]$Profile = "preview",
    # Fail instead of waiting for an answer. Used by automation; leave off when
    # running by hand so EAS can ask you things (e.g. keystore generation).
    [switch]$NonInteractive,
    [string]$Root = (Split-Path -Parent $PSScriptRoot)
)

$ErrorActionPreference = "Stop"

$mobileDir = Join-Path $Root "mobile"
$linkPaths = @(
    (Join-Path $Root "mobile\node_modules"),
    (Join-Path $Root "web\node_modules"),
    (Join-Path $Root "web\.next")
)

function Test-IsReparsePoint {
    param([string]$Path)
    if (-not (Test-Path -LiteralPath $Path)) { return $false }
    $item = Get-Item -LiteralPath $Path -Force
    return (($item.Attributes -band [IO.FileAttributes]::ReparsePoint) -ne 0)
}

# A running Metro/Next dev server holds handles inside those folders, which makes
# rmdir fail. Fail early with a clear message instead.
foreach ($port in @(8081, 3000)) {
    $listener = Get-NetTCPConnection -LocalPort $port -State Listen -ErrorAction SilentlyContinue
    if ($listener) {
        throw "Something is already listening on port $port (a dev server). Stop it with Ctrl+C and run this script again."
    }
}

$parked = New-Object System.Collections.ArrayList

try {
    foreach ($path in $linkPaths) {
        if (Test-IsReparsePoint -Path $path) {
            # The links are tagged System+Hidden (so OneDrive ignores them), and
            # rmdir refuses to touch such a folder until those bits are cleared.
            $null = & attrib -S -H "$path" 2>$null
            cmd /c rmdir "$path" 2>$null | Out-Null

            if (Test-Path -LiteralPath $path) {
                throw "Could not remove the folder link at $path. Close anything using it and try again."
            }

            [void]$parked.Add($path)
            Write-Host "parked  $path" -ForegroundColor Cyan
        }
        elseif (Test-Path -LiteralPath $path) {
            Write-Host "note    $path is a real folder, leaving it alone" -ForegroundColor Yellow
        }
    }

    Push-Location $mobileDir
    try {
        $easArgs = @("build", "--platform", "android", "--profile", $Profile)
        if ($NonInteractive) { $easArgs += "--non-interactive" }

        Write-Host ""
        Write-Host "Running: eas $($easArgs -join ' ')" -ForegroundColor Green
        Write-Host ""
        & eas @easArgs
    }
    finally {
        Pop-Location
    }
}
finally {
    if ($parked.Count -gt 0) {
        Write-Host ""
        Write-Host "Restoring folder links..." -ForegroundColor Cyan
        & (Join-Path $Root "tools\onedrive-links.ps1")
    }
}
