
# ============================================
# InvoiceRouter
# Lint Source Code
# Version: 1.0
# ============================================

Clear-Host

Write-Host ""
Write-Host "==========================================="
Write-Host "        InvoiceRouter Linter"
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
# Check ESLint
# ------------------------------------------------------------

$ESLint = Join-Path $ProjectRoot "node_modules\.bin\eslint.cmd"

if (!(Test-Path $ESLint)) {

    Write-Host "[ERROR] ESLint is not installed." -ForegroundColor Red
    Write-Host ""
    Write-Host "Run:"
    Write-Host "    npm install"
    Write-Host ""
    exit 1

}

# ------------------------------------------------------------
# Run ESLint
# ------------------------------------------------------------

Write-Host "Running ESLint..."
Write-Host ""

& $ESLint `
    "nodes/**/*.ts" `
    "providers/**/*.ts" `
    "shared/**/*.ts" `
    "tests/**/*.ts"

$ExitCode = $LASTEXITCODE

Write-Host ""

# ------------------------------------------------------------
# Summary
# ------------------------------------------------------------

if ($ExitCode -eq 0) {

    Write-Host "===========================================" -ForegroundColor Green
    Write-Host " No Lint Errors Found" -ForegroundColor Green
    Write-Host "===========================================" -ForegroundColor Green

}
else {

    Write-Host "===========================================" -ForegroundColor Red
    Write-Host " Lint Errors Detected" -ForegroundColor Red
    Write-Host "===========================================" -ForegroundColor Red

}

Write-Host ""

exit $ExitCode