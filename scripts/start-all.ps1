$ErrorActionPreference = "Stop"

$root = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path
$logsDir = Join-Path $root ".run-logs"
$localDir = Join-Path $root ".local"
$postgresZip = Join-Path $localDir "postgres-binaries.zip"
$postgresRoot = Join-Path $localDir "postgresql"
$postgresBin = Join-Path $postgresRoot "pgsql\bin"
$postgresData = Join-Path $localDir "postgres-data"
$postgresLog = Join-Path $logsDir "postgres.log"
$postgresPort = 55432

function Write-Step([string]$text) {
  Write-Host "[start-all] $text"
}

function Test-Port([int]$port) {
  $match = netstat -ano | Select-String (":$port") | Select-String "LISTENING"
  return $null -ne $match
}

function Ensure-ServiceRunning([string]$serviceName) {
  $svc = Get-Service -Name $serviceName -ErrorAction SilentlyContinue
  if (-not $svc) {
    Write-Step "Service '$serviceName' not found."
    return
  }

  if ($svc.Status -ne "Running") {
    Write-Step "Starting service '$serviceName'..."
    Start-Service -Name $serviceName
  }
}

function Ensure-PostgresPortable() {
  if (-not (Test-Path $postgresBin)) {
    Write-Step "Portable PostgreSQL not found; downloading binaries zip..."
    New-Item -ItemType Directory -Force -Path $localDir | Out-Null
    if (-not (Test-Path $postgresZip)) {
      & curl.exe -L -o $postgresZip "https://get.enterprisedb.com/postgresql/postgresql-16.12-1-windows-x64-binaries.zip"
    }
    New-Item -ItemType Directory -Force -Path $postgresRoot | Out-Null
    & tar -xf $postgresZip -C $postgresRoot
  }

  if (-not (Test-Path (Join-Path $postgresData "PG_VERSION"))) {
    Write-Step "Initializing local PostgreSQL data directory..."
    New-Item -ItemType Directory -Force -Path $postgresData | Out-Null
    & (Join-Path $postgresBin "initdb.exe") `
      -D $postgresData `
      -U exam `
      -A trust `
      --encoding=UTF8 `
      --locale=C
  }

  if (-not (Test-Port $postgresPort)) {
    Write-Step "Starting local PostgreSQL on port $postgresPort..."
    New-Item -ItemType Directory -Force -Path $logsDir | Out-Null
    & (Join-Path $postgresBin "pg_ctl.exe") `
      -D $postgresData `
      -l $postgresLog `
      -o "-p $postgresPort -h 127.0.0.1" start | Out-Null
    Start-Sleep -Seconds 2
  }

  Write-Step "Ensuring database 'exam_portal' exists..."
  $exists = & (Join-Path $postgresBin "psql.exe") `
    -h 127.0.0.1 `
    -p $postgresPort `
    -U exam `
    -d postgres `
    -tAc "SELECT 1 FROM pg_database WHERE datname='exam_portal'" 2>$null

  if ($exists -notmatch "1") {
    & (Join-Path $postgresBin "createdb.exe") -h 127.0.0.1 -p $postgresPort -U exam exam_portal
  }
}

function Ensure-BackendEnv() {
  $backendEnv = Join-Path $root "backend\.env"
  $backendEnvExample = Join-Path $root "backend\.env.example"

  if (-not (Test-Path $backendEnv)) {
    Copy-Item $backendEnvExample $backendEnv
  }

  $updated = Get-Content $backendEnv
  $updated = $updated -replace '^DATABASE_URL=.*', "DATABASE_URL=postgresql://exam@127.0.0.1:$postgresPort/exam_portal"
  $updated = $updated -replace '^MONGO_URL=.*', 'MONGO_URL=mongodb://127.0.0.1:27017/exam_portal'
  $updated = $updated -replace '^REDIS_URL=.*', 'REDIS_URL=redis://127.0.0.1:6379'
  $updated = $updated -replace '^AI_ENGINE_URL=.*', 'AI_ENGINE_URL=http://127.0.0.1:8090'
  Set-Content $backendEnv $updated
}

function Start-ProcessIfPortFree([int]$port, [string]$filePath, [string[]]$processArgs, [string]$workDir, [string]$name) {
  if (Test-Port $port) {
    Write-Step "$name already running on port $port."
    return
  }

  Write-Step "Starting $name..."
  Start-Process `
    -FilePath $filePath `
    -ArgumentList $processArgs `
    -WorkingDirectory $workDir `
    -RedirectStandardOutput (Join-Path $logsDir "$name.out.log") `
    -RedirectStandardError (Join-Path $logsDir "$name.err.log")
}

Write-Step "Preparing log directory..."
New-Item -ItemType Directory -Force -Path $logsDir | Out-Null

Write-Step "Ensuring MongoDB and Redis services are running..."
Ensure-ServiceRunning -serviceName "MongoDB"
Ensure-ServiceRunning -serviceName "Redis"

Write-Step "Preparing local PostgreSQL..."
Ensure-PostgresPortable

Write-Step "Updating backend environment..."
Ensure-BackendEnv

Write-Step "Checking AI Python dependencies..."
& python -c "import fastapi, uvicorn, cv2, numpy" 2>$null
if ($LASTEXITCODE -ne 0) {
  Write-Step "Installing AI Python dependencies..."
  & python -m pip install -r (Join-Path $root "ai-engine\requirements.txt") | Out-Null
}

$backendAlreadyRunning = Test-Port 8080
if (-not $backendAlreadyRunning) {
  Write-Step "Applying Prisma schema + seed data..."
  Push-Location (Join-Path $root "backend")
  & npm run prisma:generate | Out-Null
  & npx prisma db push | Out-Null
  & npm run seed | Out-Null
  Pop-Location
} else {
  Write-Step "Backend already running; skipping Prisma/seed step."
}

Start-ProcessIfPortFree -port 8090 -filePath "python" -processArgs @("-m", "uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8090") -workDir (Join-Path $root "ai-engine") -name "ai"
Start-ProcessIfPortFree -port 8080 -filePath "npm.cmd" -processArgs @("run", "dev") -workDir (Join-Path $root "backend") -name "backend"
Start-ProcessIfPortFree -port 5173 -filePath "npm.cmd" -processArgs @("run", "dev") -workDir (Join-Path $root "apps\candidate") -name "candidate"
Start-ProcessIfPortFree -port 5174 -filePath "npm.cmd" -processArgs @("run", "dev") -workDir (Join-Path $root "apps\mobile") -name "mobile"
Start-ProcessIfPortFree -port 5175 -filePath "npm.cmd" -processArgs @("run", "dev") -workDir (Join-Path $root "apps\admin") -name "admin"

Write-Step "Done."
Write-Host "Candidate: http://localhost:5173"
Write-Host "Mobile:    http://localhost:5174"
Write-Host "Admin:     http://localhost:5175"
Write-Host "Backend:   http://localhost:8080/api/v1/health"
Write-Host "AI:        http://localhost:8090/health"
