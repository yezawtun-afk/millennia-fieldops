# onedrive-links.ps1
#
# Keeps Node's heavy, regenerable folders OUT of OneDrive.
#
# Why this exists
# ---------------
# This project lives inside a OneDrive folder. OneDrive tries to sync
# node_modules and .next - tens of thousands of small files plus hundreds of
# megabytes of cache. That is slow, and it has already silently reverted one of
# our dependency files once (that is what broke `npx expo start`).
#
# What this script does
# ---------------------
# For each folder below it moves the real contents to
#     %LOCALAPPDATA%\node_modules-store\...
# (outside OneDrive) and leaves a "junction" behind - a folder shortcut that
# Windows, Node, Metro and Next.js all treat as a normal folder. OneDrive skips
# junctions, so those files stop syncing.
#
# Folders handled:
#     mobile\node_modules   Expo / React Native dependencies
#     web\node_modules      Next.js dependencies
#     web\.next             Next.js build + dev cache
#
# When to run it
# --------------
# - after a fresh clone, or
# - after copying the project to another PC, or
# - any time one of those folders reappears as a real folder in the project.
#
# Usage (from anywhere):
#     powershell -ExecutionPolicy Bypass -File tools\onedrive-links.ps1
#
# Safe to run repeatedly.

$ErrorActionPreference = "Stop"

$repoRoot  = Split-Path -Parent $PSScriptRoot
$storeRoot = Join-Path $env:LOCALAPPDATA "node_modules-store"

$links = @(
    [pscustomobject]@{
        Label  = "mobile deps"
        Path   = Join-Path $repoRoot "mobile\node_modules"
        Target = Join-Path $storeRoot "millennia-fieldops-mobile\node_modules"
        Deps   = $true
    }
    [pscustomobject]@{
        Label  = "web deps"
        Path   = Join-Path $repoRoot "web\node_modules"
        Target = Join-Path $storeRoot "millennia-fieldops-web\node_modules"
        Deps   = $true
    }
    [pscustomobject]@{
        Label  = "web build cache"
        Path   = Join-Path $repoRoot "web\.next"
        Target = Join-Path $storeRoot "millennia-fieldops-web\next-dist"
        Deps   = $false
    }
)

foreach ($item in $links) {
    $link   = $item.Path
    $target = $item.Target

    if (-not (Test-Path (Split-Path -Parent $link))) {
        Write-Host "skip  $($item.Label) (project folder missing)" -ForegroundColor DarkGray
        continue
    }

    if (Test-Path $link) {
        $existing = Get-Item -LiteralPath $link -Force
        $isLink   = ($existing.Attributes -band [IO.FileAttributes]::ReparsePoint) -ne 0

        if ($isLink -and ($existing.Target -contains $target)) {
            Write-Host "ok    $($item.Label) -> already linked" -ForegroundColor Green
            continue
        }

        if ($isLink) {
            $old = $existing.Target -join ", "
            if (-not (Test-Path $target)) {
                throw "$($item.Label) is a link to '$old', but $target does not exist. Move that folder to $target manually, then re-run."
            }
            Write-Host "relink $($item.Label) (was -> $old)" -ForegroundColor Yellow
            cmd /c rmdir "$link"
        } else {
            # a real folder: move it out of OneDrive first
            if (Test-Path $target) {
                throw "$target already exists. Delete it, then run this script again."
            }
            New-Item -ItemType Directory -Force -Path (Split-Path -Parent $target) | Out-Null
            Move-Item -LiteralPath $link -Destination $target
            Write-Host "moved $($item.Label) -> $target" -ForegroundColor Cyan
        }
    }

    if (-not (Test-Path $target)) {
        New-Item -ItemType Directory -Force -Path $target | Out-Null
        if ($item.Deps) {
            Write-Host "tip   $($item.Label) is empty - run 'npm install' in that project" -ForegroundColor Yellow
        }
    }

    cmd /c mklink /J "$link" "$target" | Out-Null
    Write-Host "linked $($item.Label) -> $target" -ForegroundColor Green
}

Write-Host ""
Write-Host "node_modules store: $storeRoot" -ForegroundColor Cyan
