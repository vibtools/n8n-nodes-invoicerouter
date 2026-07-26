# ============================================
# InvoiceRouter
# Package Fixer
# Version: 1.0.0
# ============================================

$ErrorActionPreference = "Stop"

Write-Host ""
Write-Host "Package Fixer" -ForegroundColor Cyan
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
# package.json
# --------------------------------------------------

$PackageFile = "package.json"

if (!(Test-Path $PackageFile)) {

    Write-Host "package.json not found." -ForegroundColor Red
    exit 1

}

try {

    $Package = Get-Content `
        $PackageFile `
        -Raw |
        ConvertFrom-Json

}
catch {

    Write-Host "Invalid package.json" `
        -ForegroundColor Red

    exit 1

}

# --------------------------------------------------
# Backup
# --------------------------------------------------

if ($Config.jsonFixer.backup) {

    Copy-Item `
        $PackageFile `
        "$PackageFile.bak" `
        -Force

}

# --------------------------------------------------
# Required Properties
# --------------------------------------------------

$Required = @{

    name = "InvoiceRouter"

    version = "1.0.0"

    description = ""

    license = "MIT"

    author = ""

    keywords = @()

    scripts = @{}

}

foreach ($Key in $Required.Keys) {

    if ($null -eq $Package.$Key) {

        $Package | Add-Member `
            -NotePropertyName $Key `
            -NotePropertyValue $Required[$Key] `
            -Force

        Write-Host "[FIX] Added $Key"

        $Fixed++

    }

}

# --------------------------------------------------
# Scripts
# --------------------------------------------------

$RequiredScripts = @{

    build = "npm run build"

    test = "npm test"

    lint = "npm run lint"

}

foreach ($ScriptName in $RequiredScripts.Keys) {

    if ($null -eq $Package.scripts.$ScriptName) {

        $Package.scripts |
        Add-Member `
            -NotePropertyName $ScriptName `
            -NotePropertyValue $RequiredScripts[$ScriptName] `
            -Force

        Write-Host "[FIX] Added script : $ScriptName"

        $Fixed++

    }

}

# --------------------------------------------------
# Dependencies
# --------------------------------------------------

if ($null -eq $Package.dependencies) {

    $Package |
    Add-Member `
        -NotePropertyName dependencies `
        -NotePropertyValue @{} `
        -Force

    Write-Host "[FIX] Added dependencies"

    $Fixed++

}

if ($null -eq $Package.devDependencies) {

    $Package |
    Add-Member `
        -NotePropertyName devDependencies `
        -NotePropertyValue @{} `
        -Force

    Write-Host "[FIX] Added devDependencies"

    $Fixed++

}

# --------------------------------------------------
# Files
# --------------------------------------------------

if ($null -eq $Package.files) {

    $Package |
    Add-Member `
        -NotePropertyName files `
        -NotePropertyValue @(
            "dist"
        ) `
        -Force

    Write-Host "[FIX] Added files"

    $Fixed++

}

# --------------------------------------------------
# Main
# --------------------------------------------------

if ($null -eq $Package.main) {

    $Package |
    Add-Member `
        -NotePropertyName main `
        -NotePropertyValue "dist/index.js" `
        -Force

    Write-Host "[FIX] Added main"

    $Fixed++

}

# --------------------------------------------------
# Types
# --------------------------------------------------

if ($null -eq $Package.types) {

    $Package |
    Add-Member `
        -NotePropertyName types `
        -NotePropertyValue "dist/index.d.ts" `
        -Force

    Write-Host "[FIX] Added types"

    $Fixed++

}

# --------------------------------------------------
# Save
# --------------------------------------------------

try {

    $Package |
    ConvertTo-Json `
        -Depth 100 |
    Set-Content `
        $PackageFile `
        -Encoding UTF8

    Write-Host ""
    Write-Host "[SAVED] package.json" `
        -ForegroundColor Green

}
catch {

    Write-Host ""
    Write-Host "[FAILED] Cannot save package.json" `
        -ForegroundColor Red

    $Failed++

}

# --------------------------------------------------
# Summary
# --------------------------------------------------

Write-Host ""
Write-Host "======================================="
Write-Host "Package Fix Summary"
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