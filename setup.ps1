# Prepara Mercao para ejecutarse: entorno de Python, dependencias y, si hay Node.js, el frontend compilado.
# Uso, desde la raíz del proyecto: powershell -ExecutionPolicy Bypass -File .\setup.ps1

$ErrorActionPreference = 'Stop'
Set-Location $PSScriptRoot

function Write-Step($message) { Write-Host "==> $message" -ForegroundColor Cyan }
function Write-Skip($message) { Write-Host "    $message" -ForegroundColor DarkGray }

# 1. Entorno virtual de Python
$python = Join-Path $PSScriptRoot '.venv\Scripts\python.exe'
if (Test-Path $python) {
    Write-Skip 'El entorno virtual .venv ya existe.'
} else {
    if (-not (Get-Command python -ErrorAction SilentlyContinue)) {
        Write-Host 'No se encontró Python. Instale Python 3.12 o superior desde https://www.python.org y vuelva a ejecutar este script.' -ForegroundColor Red
        exit 1
    }
    Write-Step 'Creando el entorno virtual en .venv'
    python -m venv .venv
    if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }
}

# 2. Dependencias de Python (se reinstalan solo si cambia requirements.txt)
$stamp = Join-Path $PSScriptRoot '.venv\requirements.sha256'
$hash = (Get-FileHash requirements.txt -Algorithm SHA256).Hash
if ((Test-Path $stamp) -and ((Get-Content $stamp) -eq $hash)) {
    Write-Skip 'Las dependencias de Python ya están instaladas.'
} else {
    Write-Step 'Instalando las dependencias de Python (requirements.txt)'
    & $python -m pip install --disable-pip-version-check -r requirements.txt
    if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }
    Set-Content -Path $stamp -Value $hash
}

# 3. Frontend (opcional: requiere Node.js)
if (-not (Get-Command npm -ErrorAction SilentlyContinue)) {
    if (Test-Path 'frontend\dist\index.html') {
        Write-Skip 'Node.js no está instalado; se usará el frontend ya compilado en frontend\dist.'
    } else {
        Write-Host 'Node.js no está instalado y no hay frontend compilado: solo estará disponible la API.' -ForegroundColor Yellow
        Write-Host 'Instale Node.js 22 o superior desde https://nodejs.org y vuelva a ejecutar este script.' -ForegroundColor Yellow
    }
} else {
    Push-Location frontend
    try {
        if (Test-Path 'node_modules\.package-lock.json') {
            Write-Skip 'Las dependencias del frontend ya están instaladas.'
        } else {
            Write-Step 'Instalando las dependencias del frontend (npm install)'
            npm install
            if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }
        }

        $index = 'dist\index.html'
        $sources = Get-ChildItem -Recurse -File src, public, index.html, package.json, vite.config.ts
        $built = (Test-Path $index) -and -not ($sources | Where-Object { $_.LastWriteTime -gt (Get-Item $index).LastWriteTime })
        if ($built) {
            Write-Skip 'El frontend ya está compilado y al día.'
        } else {
            Write-Step 'Compilando el frontend (npm run build)'
            npm run build
            if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }
        }
    } finally {
        Pop-Location
    }
}

Write-Host ''
Write-Host 'Listo. Ejecute .\start.ps1 para iniciar Mercao.' -ForegroundColor Green
