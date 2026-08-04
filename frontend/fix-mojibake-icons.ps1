<#
  fix-mojibake-icons.ps1
  Fixes double-encoded (mojibake) icon characters in Browse.tsx
  caused by a prior UTF-8 -> Latin-1 -> UTF-8 round-trip.

  Usage:
    cd E:\BuddiesPride\frontend
    powershell -ExecutionPolicy Bypass -File .\fix-mojibake-icons.ps1
#>

$ErrorActionPreference = "Stop"

$path = ".\src\pages\Browse.tsx"

if (-not (Test-Path $path)) {
    Write-Host "ERROR: Could not find $path (run this from E:\BuddiesPride\frontend)" -ForegroundColor Red
    exit 1
}

Copy-Item $path "$path.bak2" -Force
Write-Host "Backed up -> Browse.tsx.bak2" -ForegroundColor Green

# Read raw bytes, decode as UTF8 (this is how the mojibake currently sits in the file)
$content = Get-Content -Path $path -Raw -Encoding UTF8

# Known corrupted -> correct mappings (extend this list if Select-String finds more)
$map = @{
    "âœ•" = "✕"   # pass button
    "â˜…" = "★"   # superlike button
}

$changed = 0
foreach ($bad in $map.Keys) {
    if ($content.Contains($bad)) {
        $content = $content.Replace($bad, $map[$bad])
        $changed++
        Write-Host "Replaced '$bad' -> '$($map[$bad])'" -ForegroundColor Cyan
    }
}

if ($changed -eq 0) {
    Write-Host "No known mojibake patterns found. Run:" -ForegroundColor Yellow
    Write-Host '  Select-String -Path .\src\pages\Browse.tsx -Pattern "swipe-btn" -Context 0,5'
    Write-Host "and paste output — there may be a new corrupted sequence to add to the map."
    exit 0
}

# Write back WITHOUT BOM, pure UTF-8
$utf8NoBom = New-Object System.Text.UTF8Encoding($false)
[System.IO.File]::WriteAllText((Resolve-Path $path), $content, $utf8NoBom)

Write-Host ""
Write-Host "Fixed $changed pattern(s) and saved Browse.tsx as clean UTF-8 (no BOM)." -ForegroundColor Green
Write-Host "Verify with:" -ForegroundColor Yellow
Write-Host '  [Console]::OutputEncoding = [System.Text.Encoding]::UTF8'
Write-Host '  Select-String -Path .\src\pages\Browse.tsx -Pattern "swipe-btn-pass" -Context 0,3'
