# ============================================
# InvoiceRouter
# Dependency Fixer
# Version: 1.0.0
# ============================================

$ErrorActionPreference = "Stop"

Write-Host ""
Write-Host "Dependency Fixer" -ForegroundColor Cyan
Write-Host "---------------------------------------"

# --------------------------------------------------
# Statistics
# --------------------------------------------------

$Fixed = 0
$Skipped = 0
$Failed = 0

# --------------------------------------------------
# Helper
# --------------------------------------------------

function Run-Command {

    param(
        [string]$Title,
        [string]$Command
    )

    Write-Host ""
    Write-Host "[RUN] $Title"

    cmd /c $Command

    if ($LASTEXITCODE -eq 0) {

        Write-Host "[PASS]" -ForegroundColor Green
        $script:Fixed++

    }
    else {

        Write-Host "[FAILED]" -ForegroundColor Red
        $script:Failed++

    }

}

# --------------------------------------------------
# Node.js
# --------------------------------------------------

try {

    node --version | Out-Null

    Write-Host "Node.js : OK"

}
catch {

    Write-Host "Node.js is not installed." -ForegroundColor Red

    exit 1

}

# --------------------------------------------------
# npm
# --------------------------------------------------

try {

    npm --version | Out-Null

    Write-Host "npm : OK"

}
catch {

    Write-Host "npm is not installed." -ForegroundColor Red

    exit 1

}

# --------------------------------------------------
# package.json
# --------------------------------------------------

if (!(Test-Path "package.json")) {

    Write-Host "package.json not found." `
        -ForegroundColor Red

    exit 1

}

Write-Host "package.json : OK"

# --------------------------------------------------
# node_modules
# --------------------------------------------------

if (!(Test-Path "node_modules")) {

    Run-Command `
        "Installing Dependencies" `
        "npm install"

}
else {

    Write-Host "node_modules : OK"

    $Skipped++

}

# --------------------------------------------------
# package-lock.json
# --------------------------------------------------

if (!(Test-Path "package-lock.json")) {

    Run-Command `
        "Generating package-lock.json" `
        "npm install"

}
else {

    Write-Host "package-lock.json : OK"

    $Skipped++

}

# --------------------------------------------------
# Dedupe
# --------------------------------------------------

Run-Command `
    "Removing Duplicate Packages" `
    "npm dedupe"

# --------------------------------------------------
# Audit
# --------------------------------------------------

Run-Command `
    "Security Audit Fix" `
    "npm audit fix"

# --------------------------------------------------
# Verify
# --------------------------------------------------

Write-Host ""
Write-Host "Verifying..."

cmd /c "npm ls --depth=0"

if ($LASTEXITCODE -eq 0) {

    Write-Host ""
    Write-Host "Dependency verification passed." `
        -ForegroundColor Green

}
else {

    Write-Host ""
    Write-Host "Dependency verification failed." `
        -ForegroundColor Yellow

}

# --------------------------------------------------
# Summary
# --------------------------------------------------

Write-Host ""
Write-Host "======================================="
Write-Host "Dependency Fix Summary"
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