# Starts the TapMenu Open Hospitality Platform for local development on Windows
#   HMS API      http://127.0.0.1:8001   (FastAPI)
#   HMS app      http://localhost:5174   (/app, /dine/<token>)
#   Website API  http://127.0.0.1:3001   (Fastify; requires local Postgres)
#   Website      http://localhost:5173

$rootDir = Split-Path -Parent $PSScriptRoot

Write-Host "Starting TapMenu Platform locally..." -ForegroundColor Cyan

$p1 = Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd '$rootDir\backend'; uvicorn backend.app.main:app --port 8001 --reload" -PassThru
$p2 = Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd '$rootDir\frontend\hms'; npm run dev -- --port 5174" -PassThru
$p3 = Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd '$rootDir\backend\website'; npm run dev" -PassThru
$p4 = Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd '$rootDir\frontend\website'; npm run dev -- --port 5173" -PassThru

Write-Host "Services launched in background windows." -ForegroundColor Green
Write-Host "Press Enter to stop all services..."
Read-Host

Stop-Process -Id $p1.Id, $p2.Id, $p3.Id, $p4.Id -ErrorAction SilentlyContinue
Write-Host "All local services stopped." -ForegroundColor Yellow

