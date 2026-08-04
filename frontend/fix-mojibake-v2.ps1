<#
  fix-mojibake-v2.ps1
  Reverses UTF-8 -> Windows-1252 -> UTF-8 double-encoding corruption.
  Contains NO literal special/unicode characters, so it cannot itself
  get mangled by copy-paste or download.

  Usage:
    cd E:\BuddiesPride\frontend
    powershell -ExecutionPolicy Bypass -File .\fix-mojibake-v2.ps1
#>

$ErrorActionPreference = "Stop"

$path = ".\src\pages\Browse.tsx"

if (-not (Test-Path $path)) {
    Write-Host "ERROR: Could not find $path (run this from E:\BuddiesPride\frontend)" -ForegroundColor Red
    exit 1
}

Copy-Item $path "$path.bak3" -Force
Write-Host "Backed up -> Browse.tsx.bak3" -ForegroundColor Green

# Read the file as it currently sits (UTF-8 decode of the mojibake bytes)
$utf8 = [System.Text.Encoding]::UTF8
$cp1252 = [System.Text.Encoding]::GetEncoding(1252)

$original = [System.IO.File]::ReadAllText((Resolve-Path $path), $utf8)

# Reverse the double-encoding:
#   correct-UTF8-bytes -> (mis-decoded as CP1252) -> re-encoded as UTF8 -> what's on disk now
# To undo: take the on-disk string, ENCODE it as CP1252 to get back the original bytes,
# then DECODE those bytes as UTF8 to recover the correct string.
$bytesAsCp1252 = $cp1252.GetBytes($original)
$fixed = $utf8.GetString($bytesAsCp1252)

if ($fixed -eq $original) {
    Write-Host "No change detected — file may already be clean, or corruption pattern is different." -ForegroundColor Yellow
    exit 0
}

$utf8NoBom = New-Object System.Text.UTF8Encoding($false)
[System.IO.File]::WriteAllText((Resolve-Path $path), $fixed, $utf8NoBom)

Write-Host "Reversed double-encoding and saved Browse.tsx as clean UTF-8 (no BOM)." -ForegroundColor Green
Write-Host ""
Write-Host "Verify with:" -ForegroundColor Yellow
Write-Host '  [Console]::OutputEncoding = [System.Text.Encoding]::UTF8'
Write-Host '  Select-String -Path .\src\pages\Browse.tsx -Pattern "swipe-btn-pass" -Context 0,3'
