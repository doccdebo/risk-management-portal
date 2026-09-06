$ErrorActionPreference = 'Stop'

$projectRoot = Split-Path -Parent $MyInvocation.MyCommand.Path
$apiDirectory = Join-Path $projectRoot 'api'
$clientDirectory = Join-Path $projectRoot 'client'
$pythonExecutable = Join-Path $apiDirectory '.venv\Scripts\python.exe'

if (-not (Get-Command py -ErrorAction SilentlyContinue)) {
    throw 'Python is required. Install Python 3.10 or later, then run this script again.'
}
if (-not (Get-Command npm.cmd -ErrorAction SilentlyContinue)) {
    throw 'Node.js and npm are required. Install Node.js 18 or later, then run this script again.'
}

if (-not (Test-Path $pythonExecutable)) {
    Write-Host 'Creating Python virtual environment...'
    & py -3 -m venv (Join-Path $apiDirectory '.venv')
}

Write-Host 'Installing backend dependencies...'
& $pythonExecutable -m pip install --upgrade pip
& $pythonExecutable -m pip install -r (Join-Path $apiDirectory 'requirements.txt')

Write-Host 'Installing frontend dependencies...'
Push-Location $clientDirectory
try {
    & npm.cmd install
}
finally {
    Pop-Location
}

$apiRunning = Get-NetTCPConnection -LocalPort 8000 -State Listen -ErrorAction SilentlyContinue
if (-not $apiRunning) {
    Write-Host 'Starting backend at http://localhost:8000 ...'
    Start-Process -FilePath $pythonExecutable -WorkingDirectory $apiDirectory -ArgumentList '-m uvicorn main:app --port 8000'
}
else {
    Write-Host 'Backend is already running at http://localhost:8000.'
}

Write-Host 'Starting Risk Management Portal at http://localhost:5173 ...'
Push-Location $clientDirectory
try {
    & npm.cmd run dev -- --host 127.0.0.1
}
finally {
    Pop-Location
}