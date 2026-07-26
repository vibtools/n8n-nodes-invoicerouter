# ============================================
# InvoiceRouter
# Install Dependencies
# Version: 1.0
# ============================================

Clear-Host

Write-Host ""
Write-Host "==========================================="
Write-Host "   InvoiceRouter Dependency Installer"
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
# Check Node.js
# ------------------------------------------------------------

$Node = Get-Command node -ErrorAction SilentlyContinue

if ($null -eq $Node) {

    Write-Host "[ERROR] Node.js is not installed." -ForegroundColor Red
    exit 1

}

# ------------------------------------------------------------
# Check npm
# ------------------------------------------------------------

$Npm = Get-Command npm -ErrorAction SilentlyContinue

if ($null -eq $Npm) {

    Write-Host "[ERROR] npm is not installed." -ForegroundColor Red
    exit 1

}

# ------------------------------------------------------------
# Install Dependencies
# ------------------------------------------------------------

Write-Host "Installing project dependencies..."
Write-Host ""

npm install

$ExitCode = $LASTEXITCODE

Write-Host ""

# ------------------------------------------------------------
# Verify Installation
# ------------------------------------------------------------

if ($ExitCode -eq 0) {

    if (Test-Path "node_modules") {

        Write-Host "[ OK ] node_modules created."

    }
    else {

        Write-Host "[WARN] node_modules folder not found." -ForegroundColor Yellow

    }

}

Write-Host ""

# ------------------------------------------------------------
# Summary
# ------------------------------------------------------------

if ($ExitCode -eq 0) {

    Write-Host "===========================================" -ForegroundColor Green
    Write-Host " Installation Completed Successfully" -ForegroundColor Green
    Write-Host "===========================================" -ForegroundColor Green

}
else {

    Write-Host "===========================================" -ForegroundColor Red
    Write-Host " Installation Failed" -ForegroundColor Red
    Write-Host "===========================================" -ForegroundColor Red

}

Write-Host ""

exit $ExitCode