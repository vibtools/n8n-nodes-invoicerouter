
# ============================================
# InvoiceRouter
# Bootstrap
# Version: 1.0.0
# ============================================

Clear-Host

$BootstrapStart = Get-Date

Write-Host ""
Write-Host "===============================================" -ForegroundColor Cyan
Write-Host " InvoiceRouter Bootstrap"
Write-Host "===============================================" -ForegroundColor Cyan
Write-Host ""

# ------------------------------------------------------------
# Project Root
# ------------------------------------------------------------

$ProjectRoot = Resolve-Path (Join-Path $PSScriptRoot "..")
Set-Location $ProjectRoot

# ------------------------------------------------------------
# Helper
# ------------------------------------------------------------

function Invoke-Step {

    param(
        [string]$Title,
        [string]$Script
    )

    Write-Host ""
    Write-Host "-----------------------------------------------"
    Write-Host $Title -ForegroundColor Yellow
    Write-Host "-----------------------------------------------"

    $Path = Join-Path $ProjectRoot "scripts\$Script"

    if (!(Test-Path $Path)) {

        Write-Host "[ERROR] Missing: $Script" -ForegroundColor Red
        exit 1

    }

    & powershell.exe -ExecutionPolicy Bypass -File $Path

    if ($LASTEXITCODE -ne 0) {

        Write-Host ""
        Write-Host "[FAILED] $Script" -ForegroundColor Red
        exit $LASTEXITCODE

    }

}

# ------------------------------------------------------------
# Bootstrap Pipeline
# ------------------------------------------------------------

Invoke-Step "Creating Project Architecture" "create-architecture.ps1"

Invoke-Step "Validating Architecture" "auto-validator.ps1"

Invoke-Step "Installing Dependencies" "install.ps1"

Invoke-Step "Formatting Source Code" "format.ps1"

Invoke-Step "Running ESLint" "lint.ps1"

Invoke-Step "Building Project" "build.ps1"

Invoke-Step "Running Tests" "test.ps1"

Invoke-Step "Project Health Report" "doctor.ps1"

# ------------------------------------------------------------
# Summary
# ------------------------------------------------------------

$BootstrapEnd = Get-Date
$Duration = $BootstrapEnd - $BootstrapStart

Write-Host ""
Write-Host "===============================================" -ForegroundColor Green
Write-Host " Bootstrap Completed Successfully" -ForegroundColor Green
Write-Host "===============================================" -ForegroundColor Green

Write-Host ("Started  : {0}" -f $BootstrapStart)
Write-Host ("Finished : {0}" -f $BootstrapEnd)
Write-Host ("Duration : {0:N2} Seconds" -f $Duration.TotalSeconds)

Write-Host ""
Write-Host "Project is ready for development." -ForegroundColor Green
Write-Host ""
Write-Host "Next Command:"
Write-Host "    .\scripts\dev.ps1" -ForegroundColor Cyan
Write-Host ""

exit 0