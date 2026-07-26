# ============================================
# InvoiceRouter
# JSON Fixer
# Version: 1.0.0
# ============================================

$ErrorActionPreference = "Stop"

Write-Host ""
Write-Host "JSON Fixer" -ForegroundColor Cyan
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
# JSON Files
# --------------------------------------------------

$JsonFiles = @()

if ($Config.jsonFiles) {

    $JsonFiles += $Config.jsonFiles

}

# Automatically include all JSON files except ignored folders

$IgnoreFolders = @()

if ($Config.ignore) {

    $IgnoreFolders = $Config.ignore

}

$AutoFiles = Get-ChildItem `
    -Path "." `
    -Recurse `
    -Filter "*.json" `
    -File |
Where-Object {

    $Skip = $false

    foreach ($Folder in $IgnoreFolders) {

        if ($_.FullName -match [regex]::Escape($Folder)) {

            $Skip = $true
            break

        }

    }

    -not $Skip

}

foreach ($File in $AutoFiles) {

    if ($JsonFiles -notcontains $File.FullName.Replace((Get-Location).Path + "\", "").Replace("\","/")) {

        $JsonFiles += $File.FullName.Replace((Get-Location).Path + "\", "").Replace("\","/")

    }

}

$JsonFiles = $JsonFiles | Sort-Object -Unique

# --------------------------------------------------
# Process Files
# --------------------------------------------------

foreach ($File in $JsonFiles) {

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

        Write-Host "[FAILED] Invalid JSON" `
            -ForegroundColor Red

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

        $Depth = 100

        $Formatted = $Object |
            ConvertTo-Json `
                -Depth $Depth

        Set-Content `
            -Path $File `
            -Value $Formatted `
            -Encoding UTF8

        Write-Host "[FIXED] Formatted"

        $Fixed++

    }
    catch {

        Write-Host "[FAILED] Cannot write file." `
            -ForegroundColor Red

        $Failed++

    }

}

# --------------------------------------------------
# Summary
# --------------------------------------------------

Write-Host ""
Write-Host "======================================="
Write-Host "JSON Fix Summary"
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