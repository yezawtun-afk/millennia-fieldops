# bundle-db-sql.ps1
#
# Concatenates the numbered SQL files in supabase/ into ONE script, so a fresh
# Supabase project can be set up with a single copy-paste instead of five.
#
# The Supabase SQL Editor has no "upload file" button, so this saves a lot of
# error-prone copy-pasting.
#
# Usage (from anywhere):
#     powershell -ExecutionPolicy Bypass -File tools\bundle-db-sql.ps1
#
# Output: supabase\setup_all.sql   (generated - do not edit by hand, and it is
# git-ignored on purpose; re-run this script after changing the numbered files)
#
# 07_demo_data.sql is deliberately NOT included: it deletes existing records and
# expects at least one signed-up account, so it is run separately and later.
# 08_backfill_profiles.sql is also separate: it only repairs accounts that were
# created before the schema existed.

param(
    [string]$Root = (Split-Path -Parent $PSScriptRoot),
    [string]$OutFile = "supabase\setup_all.sql",
    [string[]]$Include = @(
        "01_schema.sql",
        "02_policies.sql",
        "03_storage.sql",
        "04_triggers.sql",
        "05_seed.sql",
        "06_severity_levels.sql",
        "09_delete_own_pending.sql",
        "10_audit_logs.sql"
    )
)

$ErrorActionPreference = "Stop"

$supabaseDir = Join-Path $Root "supabase"
$outPath = Join-Path $Root $OutFile

$sb = New-Object System.Text.StringBuilder
[void]$sb.AppendLine("-- GENERATED FILE - do not edit.")
[void]$sb.AppendLine("-- Built by tools/bundle-db-sql.ps1 from the numbered files in supabase/.")
[void]$sb.AppendLine("-- Paste this whole file into Supabase -> SQL Editor -> New query, then Run.")
[void]$sb.AppendLine("-- Run it on a FRESH project only; it is not meant to be re-run on a live one.")
[void]$sb.AppendLine()

foreach ($name in $Include) {
    $path = Join-Path $supabaseDir $name
    if (-not (Test-Path $path)) {
        throw "Missing $path"
    }

    [void]$sb.AppendLine("-- " + ("=" * 69))
    [void]$sb.AppendLine("-- $name")
    [void]$sb.AppendLine("-- " + ("=" * 69))
    [void]$sb.AppendLine()
    [void]$sb.AppendLine((Get-Content -LiteralPath $path -Raw))
    [void]$sb.AppendLine()
}

Set-Content -LiteralPath $outPath -Value $sb.ToString() -Encoding UTF8

$lines = (Get-Content -LiteralPath $outPath | Measure-Object).Count
$kb = [math]::Round((Get-Item -LiteralPath $outPath).Length / 1KB, 1)
Write-Output "wrote $outPath ($lines lines, $kb KB)"
Write-Output "Files included: $($Include -join ', ')"
Write-Output ""
Write-Output "Next: open the file, select all, copy, paste into the Supabase SQL Editor, Run."
