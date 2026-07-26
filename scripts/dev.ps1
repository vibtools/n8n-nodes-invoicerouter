
# ============================================
# InvoiceRouter
# Development Mode
# Version: 1.0
# ============================================

Clear-Host

Write-Host ""
Write-Host "==========================================="
Write-Host "     InvoiceRouter Development Mode"
Write-Host "==========================================="
Write-Host ""

# ------------------------------------------------------------
# Project Root
# ------------------------------------------------------------

$ProjectRoot = Resolve-Path (Join-Path $PSScriptRoot "..")

Set-Location $ProjectRoot

# ------------------------------------------------------------
# Check package.json
# ------------------------------------------------------------

if (!(Test-Path "package.json")) {

    Write-Host "[ERROR] package.json not found." -ForegroundColor Red
    exit 1

}

# ------------------------------------------------------------
# Check node_modules
# ------------------------------------------------------------

if (!(Test-Path "node_modules")) {

    Write-Host "[ERROR] node_modules not found." -ForegroundColor Red
    Write-Host ""
    Write-Host "Run:"
    Write-Host "    .\scripts\install.ps1"
    Write-Host ""
    exit 1

}

# ------------------------------------------------------------
# Check npm
# ------------------------------------------------------------

$Npm = Get-Command npm -ErrorAction SilentlyContinue

if ($null -eq $Npm) {

    Write-Host "[ERROR] npm not found." -ForegroundColor Red
    exit 1

}

# ------------------------------------------------------------
# Start Development
# ------------------------------------------------------------

Write-Host "Starting Development Environment..."
Write-Host ""

npm run dev

$ExitCode = $LASTEXITCODE

Write-Host ""

# ------------------------------------------------------------
# Summary
# ------------------------------------------------------------

if ($ExitCode -eq 0) {

    Write-Host "===========================================" -ForegroundColor Green
    Write-Host " Development Session Ended" -ForegroundColor Green
    Write-Host "===========================================" -ForegroundColor Green

}
else {

    Write-Host "===========================================" -ForegroundColor Red
    Write-Host " Development Session Ended With Errors" -ForegroundColor Red
    Write-Host "===========================================" -ForegroundColor Red

}

Write-Host ""

exit $ExitCode