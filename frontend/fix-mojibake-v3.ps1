$ErrorActionPreference = "Stop"

$path = ".\src\pages\Browse.tsx"

if (-not (Test-Path $path)) {
    Write-Host ERROR_FILE_NOT_FOUND
    exit 1
}

Copy-Item $path "$path.bak3" -Force

$utf8 = [System.Text.Encoding]::UTF8
$cp1252 = [System.Text.Encoding]::GetEncoding(1252)

$original = [System.IO.File]::ReadAllText((Resolve-Path $path), $utf8)
$bytesAsCp1252 = $cp1252.GetBytes($original)
$fixed = $utf8.GetString($bytesAsCp1252)

if ($fixed -eq $original) {
    Write-Host NO_CHANGE_DETECTED
    exit 0
}

$utf8NoBom = New-Object System.Text.UTF8Encoding($false)
[System.IO.File]::WriteAllText((Resolve-Path $path), $fixed, $utf8NoBom)

Write-Host FIXED_OK
