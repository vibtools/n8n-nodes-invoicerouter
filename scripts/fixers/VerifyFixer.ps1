# ============================================
# InvoiceRouter
# Verify Fixer
# Version: 1.0.0
# ============================================

$ErrorActionPreference = "Stop"

Write-Host ""
Write-Host "Verify Fixer" -ForegroundColor Cyan
Write-Host "---------------------------------------"

# --------------------------------------------------
# Statistics
# --------------------------------------------------

$Passed  = 0
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
# Helper
# --------------------------------------------------

function Invoke-Verify {

    param(
        [string]$Title,
        [string]$Command
    )

    Write-Host ""
    Write-Host "[VERIFY] $Title"

    cmd /c $Command

    if ($LASTEXITCODE -eq 0) {

        Write-Host "[PASS]" -ForegroundColor Green
        $script:Passed++

    }
    else {

        Write-Host "[FAILED]" -ForegroundColor Red
        $script:Failed++

    }

}

# --------------------------------------------------
# Verify : Build
# --------------------------------------------------

if ($Config.verify.enabled -and $Config.verify.build) {

    Invoke-Verify `
        "Build" `
        $Config.commands.build

}
else {

    Write-Host ""
    Write-Host "[SKIP] Build"

    $Skipped++

}

# --------------------------------------------------
# Verify : Lint
# --------------------------------------------------

if ($Config.verify.enabled -and $Config.verify.lint) {

    Invoke-Verify `
        "Lint" `
        $Config.commands.lint

}
else {

    Write-Host ""
    Write-Host "[SKIP] Lint"

    $Skipped++

}

# --------------------------------------------------
# Verify : TypeScript
# --------------------------------------------------

if ($Config.verify.enabled -and $Config.verify.typescript) {

    Invoke-Verify `
        "TypeScript" `
        $Config.commands.typescript

}
else {

    Write-Host ""
    Write-Host "[SKIP] TypeScript"

    $Skipped++

}

# --------------------------------------------------
# Verify : Doctor
# --------------------------------------------------

if ($Config.verify.enabled -and $Config.verify.doctor) {

    $DoctorScript = Join-Path `
        (Resolve-Path (Join-Path $PSScriptRoot "..")) `
        "doctor.ps1"

    if (Test-Path $DoctorScript) {

        Write-Host ""
        Write-Host "[VERIFY] Doctor"

        powershell.exe `
            -ExecutionPolicy Bypass `
            -File $DoctorScript

        if ($LASTEXITCODE -eq 0) {

            Write-Host "[PASS]" -ForegroundColor Green
            $Passed++

        }
        else {

            Write-Host "[FAILED]" -ForegroundColor Red
            $Failed++

        }

    }
    else {

        Write-Host ""
        Write-Host "[SKIP] doctor.ps1 not found" `
            -ForegroundColor Yellow

        $Skipped++

    }

}
else {

    Write-Host ""
    Write-Host "[SKIP] Doctor"

    $Skipped++

}

# --------------------------------------------------
# Verify : Dist Folder
# --------------------------------------------------

Write-Host ""
Write-Host "[VERIFY] Build Output"

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

    Write-Host ("Files   : {0}" -f $Files)
    Write-Host ("Folders : {0}" -f $Folders)
    Write-Host ("Size    : {0} MB" -f $SizeMB)

    Write-Host "[PASS]" -ForegroundColor Green

    $Passed++

}
else {

    Write-Host "dist folder not found." `
        -ForegroundColor Red

    $Failed++

}

# --------------------------------------------------
# Summary
# --------------------------------------------------

Write-Host ""
Write-Host "======================================="
Write-Host "Verify Fix Summary"
Write-Host "======================================="

Write-Host ("Passed  : {0}" -f $Passed)
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