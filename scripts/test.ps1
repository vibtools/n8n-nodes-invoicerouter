# ============================================
# InvoiceRouter
# Test Script
# Version: 1.0
# ============================================

Clear-Host

Write-Host ""
Write-Host "==========================================="
Write-Host "        InvoiceRouter Test Runner"
Write-Host "==========================================="
Write-Host ""

# ------------------------------------------------------------
# Check package.json
# ------------------------------------------------------------

if (!(Test-Path "..\package.json")) {
    Write-Host "[ERROR] package.json not found." -ForegroundColor Red
    exit 1
}

# ------------------------------------------------------------
# Check node_modules
# ------------------------------------------------------------

if (!(Test-Path "..\node_modules")) {

    Write-Host "[WARNING] node_modules not found." -ForegroundColor Yellow
    Write-Host ""
    Write-Host "Run:"
    Write-Host "npm install"
    exit 1

}

# ------------------------------------------------------------
# Move to Project Root
# ------------------------------------------------------------

Set-Location ..

# ------------------------------------------------------------
# Run Tests
# ------------------------------------------------------------

Write-Host ""
Write-Host "Running Tests..."
Write-Host ""

npm test

$ExitCode = $LASTEXITCODE

# ------------------------------------------------------------
# Result
# ------------------------------------------------------------

Write-Host ""

if ($ExitCode -eq 0) {

    Write-Host "==========================================="
    Write-Host " All Tests Passed"
    Write-Host "===========================================" -ForegroundColor Green

}
else {

    Write-Host "==========================================="
    Write-Host " Tests Failed"
    Write-Host "===========================================" -ForegroundColor Red

}

Write-Host ""

exit $ExitCode