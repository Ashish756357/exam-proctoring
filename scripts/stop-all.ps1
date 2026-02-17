$ErrorActionPreference = "Continue"

$root = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path
$postgresBin = Join-Path $root ".local\postgresql\pgsql\bin"
$postgresData = Join-Path $root ".local\postgres-data"

function Stop-ByPort([int]$port) {
  $lines = netstat -ano | Select-String (":$port") | Select-String "LISTENING"
  if (-not $lines) {
    return
  }

  foreach ($line in $lines) {
    $parts = ($line -replace '\s+', ' ').Trim().Split(' ')
    $procId = $parts[-1]
    if ($procId -match '^\d+$') {
      Stop-Process -Id ([int]$procId) -Force -ErrorAction SilentlyContinue
    }
  }
}

Write-Host "[stop-all] Stopping web apps, backend, and AI..."
Stop-ByPort -port 5173
Stop-ByPort -port 5174
Stop-ByPort -port 5175
Stop-ByPort -port 8080
Stop-ByPort -port 8090

if (Test-Path (Join-Path $postgresBin "pg_ctl.exe")) {
  Write-Host "[stop-all] Stopping local PostgreSQL..."
  & (Join-Path $postgresBin "pg_ctl.exe") -D $postgresData stop -m fast | Out-Null
}

Write-Host "[stop-all] Done."
