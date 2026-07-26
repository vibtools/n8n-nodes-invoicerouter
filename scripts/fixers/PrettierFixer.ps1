# ============================================
# InvoiceRouter
# Prettier Fixer
# Version: 1.0.0
# ============================================

$ErrorActionPreference = "Stop"

Write-Host ""
Write-Host "Prettier Fixer" -ForegroundColor Cyan
Write-Host "---------------------------------------"

# --------------------------------------------------
# Statistics
# --------------------------------------------------

$Fixed   = 0
$Skipped = 0
$Failed  = 0

# --------------------------------------------------
# Load Configuration
# --------------------------------------------------

$ConfigFile = Join-Path $PSScriptRoot "..\..\manifest\auto-fix.json"

if (!(Test-Path $ConfigFile)) {

    Write-Host "Configuration not found." -ForegroundColor Red
    exit 1

}

try {

    $Config = Get-Content `
        $ConfigFile `
        -Raw |
        ConvertFrom-Json

}
catch {

    Write-Host "Invalid configuration file." -ForegroundColor Red
    exit 1

}

# --------------------------------------------------
# package.json
# --------------------------------------------------

if (!(Test-Path "package.json")) {

    Write-Host "package.json not found." -ForegroundColor Red
    exit 1

}

# --------------------------------------------------
# node_modules
# --------------------------------------------------

if (!(Test-Path "node_modules")) {

    Write-Host "node_modules not found." -ForegroundColor Red
    Write-Host "Run DependencyFixer first." -ForegroundColor Yellow
    exit 1

}

# --------------------------------------------------
# Check Prettier
# --------------------------------------------------

Write-Host ""
Write-Host "[CHECK] Prettier"

cmd /c "npx prettier --version"

if ($LASTEXITCODE -ne 0) {

    Write-Host "[FAILED] Prettier not found." `
        -ForegroundColor Red

    exit 1

}

Write-Host "[PASS]" -ForegroundColor Green

# --------------------------------------------------
# Run Prettier
# --------------------------------------------------

Write-Host ""
Write-Host "[FORMAT] Running Prettier"

cmd /c $Config.commands.format

if ($LASTEXITCODE -eq 0) {

    Write-Host "[PASS]" -ForegroundColor Green
    $Fixed++

}
else {

    Write-Host "[FAILED]" -ForegroundColor Red
    $Failed++

}

# --------------------------------------------------
# Summary
# --------------------------------------------------

Write-Host ""
Write-Host "======================================="
Write-Host "Prettier Fix Summary"
Write-Host "======================================="

Write-Host ("Fixed   : {0}" -f $Fixed)
Write-Host ("Skipped : {0}" -f $Skipped)
Write-Host ("Failed  : {0}" -f $Failed)

Write-Host ""

if ($Failed -eq 0) {

    Write-Host "Status : SUCCESS" `
        -ForegroundColor Green

    exit 0

}
else {

    Write-Host "Status : FAILED" `
        -ForegroundColor Red

    exit 1

}