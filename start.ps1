# Inicia Mercao: la API y el frontend compilado en http://localhost:8000.
# Uso, desde la raíz del proyecto (después de setup.ps1): powershell -ExecutionPolicy Bypass -File .\start.ps1

$ErrorActionPreference = 'Stop'
Set-Location $PSScriptRoot

$python = Join-Path $PSScriptRoot '.venv\Scripts\python.exe'
if (-not (Test-Path $python)) {
    Write-Host 'No se encontró el entorno de Python. Ejecute primero .\setup.ps1' -ForegroundColor Red
    exit 1
}

$missing = @()
if (-not (Test-Path 'data\processed\mercao.db')) { $missing += 'la base de datos data\processed\mercao.db' }
if (-not (Test-Path 'models\metadata.json')) { $missing += 'los modelos entrenados en models\' }
if ($missing.Count -gt 0) {
    Write-Host "Falta $($missing -join ' y ')." -ForegroundColor Red
    Write-Host 'Cópielos desde la entrega o reconstrúyalos desde cero (ver README.md, sección "Reconstrucción completa"):'
    Write-Host '  .venv\Scripts\python -m backend.scripts.download_raw'
    Write-Host '  .venv\Scripts\python -m backend.scripts.build_database'
    Write-Host '  .venv\Scripts\python -m backend.scripts.train_models'
    Write-Host '  .venv\Scripts\python -m backend.scripts.generate_forecasts'
    exit 1
}

if (-not (Test-Path 'frontend\dist\index.html')) {
    Write-Host 'No hay frontend compilado (frontend\dist): solo estará disponible la API. Ejecute .\setup.ps1 con Node.js instalado.' -ForegroundColor Yellow
}

Write-Host ''
Write-Host 'Mercao está en http://localhost:8000  (detener con Ctrl+C)' -ForegroundColor Green
Write-Host ''
& $python -m uvicorn backend.app.main:app --host 127.0.0.1 --port 8000
