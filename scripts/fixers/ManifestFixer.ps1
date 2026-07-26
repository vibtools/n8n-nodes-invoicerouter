# ============================================
# InvoiceRouter
# Manifest Fixer
# Version: 1.0.0
# ============================================

$ErrorActionPreference = "Stop"

Write-Host ""
Write-Host "Manifest Fixer" -ForegroundColor Cyan
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
# Manifest Files
# --------------------------------------------------

$ManifestFiles = @()

if ($Config.jsonFiles) {

    foreach ($File in $Config.jsonFiles) {

        if ($File -match "^manifest/") {

            $ManifestFiles += $File.Replace("/", "\")

        }

    }

}

if ($ManifestFiles.Count -eq 0) {

    Write-Host "No manifest files configured." -ForegroundColor Yellow
    exit 0

}

# --------------------------------------------------
# Process Manifest Files
# --------------------------------------------------

foreach ($File in $ManifestFiles) {

    Write-Host ""
    Write-Host "Checking : $File"

    if (!(Test-Path $File)) {

        Write-Host "[SKIP] File not found." -ForegroundColor Yellow
        $Skipped++
        continue

    }

    try {

        $Content = Get-Content $File -Raw
        $Object = $Content | ConvertFrom-Json

    }
    catch {

        Write-Host "[FAILED] Invalid JSON" -ForegroundColor Red
        $Failed++
        continue

    }

    try {

        if ($Config.jsonFixer.backup) {

            Copy-Item `
                $File `
                "$File.bak" `
                -Force

        }

        $Formatted = $Object |
            ConvertTo-Json `
                -Depth 100

        Set-Content `
            -Path $File `
            -Value $Formatted `
            -Encoding UTF8

        Write-Host "[FIXED] Manifest formatted" `
            -ForegroundColor Green

        $Fixed++

    }
    catch {

        Write-Host "[FAILED] Cannot save file." `
            -ForegroundColor Red

        $Failed++
        continue

    }

}

# --------------------------------------------------
# Summary
# --------------------------------------------------

Write-Host ""
Write-Host "======================================="
Write-Host "Manifest Fix Summary"
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