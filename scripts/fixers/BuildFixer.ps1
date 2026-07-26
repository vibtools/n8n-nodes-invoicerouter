# ============================================
# InvoiceRouter
# Build Fixer
# Version: 1.0.0
# ============================================

$ErrorActionPreference = "Stop"

Write-Host ""
Write-Host "Build Fixer" -ForegroundColor Cyan
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

    $Config = Get-Content $ConfigFile -Raw | ConvertFrom-Json

}
catch {

    Write-Host "Invalid configuration file." -ForegroundColor Red
    exit 1

}

# --------------------------------------------------
# Check package.json
# --------------------------------------------------

if (!(Test-Path "package.json")) {

    Write-Host "package.json not found." -ForegroundColor Red
    exit 1

}

# --------------------------------------------------
# Check node_modules
# --------------------------------------------------

if (!(Test-Path "node_modules")) {

    Write-Host "node_modules not found." -ForegroundColor Red
    Write-Host "Run DependencyFixer first." -ForegroundColor Yellow
    exit 1

}

# --------------------------------------------------
# TypeScript Validation
# --------------------------------------------------

Write-Host ""
Write-Host "[CHECK] TypeScript"

cmd /c $Config.commands.typescript

if ($LASTEXITCODE -eq 0) {

    Write-Host "[PASS]" -ForegroundColor Green

}
else {

    Write-Host "[FAILED]" -ForegroundColor Yellow
    $Failed++

}

# --------------------------------------------------
# Build
# --------------------------------------------------

Write-Host ""
Write-Host "[BUILD]"

cmd /c $Config.commands.build

if ($LASTEXITCODE -eq 0) {

    Write-Host "[PASS]" -ForegroundColor Green
    $Fixed++

}
else {

    Write-Host "[FAILED]" -ForegroundColor Red
    $Failed++

}

# --------------------------------------------------
# Verify Dist Folder
# --------------------------------------------------

if (Test-Path "dist") {

    $Files = (
        Get-ChildItem `
            "dist" `
            -Recurse `
            -File
    ).Count

    $Folders = (
        Get-ChildItem `
            "dist" `
            -Recurse `
            -Directory
    ).Count

    $Size = (
        (
            Get-ChildItem `
                "dist" `
                -Recurse `
                -File |
            Measure-Object Length -Sum
        ).Sum
    )

    $SizeMB = [Math]::Round($Size / 1MB,2)

    Write-Host ""
    Write-Host "Build Output"

    Write-Host ("Files   : {0}" -f $Files)
    Write-Host ("Folders : {0}" -f $Folders)
    Write-Host ("Size    : {0} MB" -f $SizeMB)

}
else {

    Write-Host ""
    Write-Host "dist folder not found." `
        -ForegroundColor Yellow

    $Failed++

}

# --------------------------------------------------
# Summary
# --------------------------------------------------

Write-Host ""
Write-Host "======================================="
Write-Host "Build Fix Summary"
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