# ============================================
# InvoiceRouter
# Release Builder
# Version: 2.0.0
# ============================================
if (-not $env:CI) { Clear-Host }
$ReleaseStart = Get-Date

Write-Host ""
Write-Host "===============================================" -ForegroundColor Cyan
Write-Host " InvoiceRouter Release Builder"
Write-Host " Version 2.0"
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

function Stop-Release {

    param([string]$Message)

    Write-Host ""
    Write-Host "[ERROR] $Message" -ForegroundColor Red
    exit 1

}

# ------------------------------------------------------------
# Validate Required Files
# ------------------------------------------------------------

if (!(Test-Path "package.json")) {

    Stop-Release "package.json not found."

}

if (!(Test-Path "dist")) {

    Stop-Release "dist folder not found."

}

if (!(Test-Path "manifest\release.json")) {

    Stop-Release "manifest\release.json not found."

}

# ------------------------------------------------------------
# Load package.json
# ------------------------------------------------------------

try {

    $Package = Get-Content package.json -Raw | ConvertFrom-Json

}
catch {

    Stop-Release "package.json is invalid."

}

# ------------------------------------------------------------
# Load release.json
# ------------------------------------------------------------

try {

    $ReleaseConfig = Get-Content `
        "manifest\release.json" `
        -Raw |
        ConvertFrom-Json

}
catch {

    Stop-Release "release.json is invalid."

}

# ------------------------------------------------------------
# Project Info
# ------------------------------------------------------------

$ProjectName = $Package.name
$Version = $Package.version

Write-Host "Project : $ProjectName"
Write-Host "Version : $Version"

# ------------------------------------------------------------
# Create Release Folder
# ------------------------------------------------------------

$ReleaseRoot = $ReleaseConfig.releaseFolder

if (!(Test-Path $ReleaseRoot)) {

    New-Item `
        -ItemType Directory `
        -Path $ReleaseRoot | Out-Null

}

$ReleasePath = Join-Path `
    $ReleaseRoot `
    "$ProjectName-$Version"

if (Test-Path $ReleasePath) {

    Remove-Item `
        $ReleasePath `
        -Recurse `
        -Force

}

New-Item `
    -ItemType Directory `
    -Path $ReleasePath | Out-Null

# ------------------------------------------------------------
# Copy Release Files
# ------------------------------------------------------------

Write-Host ""
Write-Host "Copying Release Files..."
Write-Host ""

foreach($Item in $ReleaseConfig.include){

    if(Test-Path $Item){

        Copy-Item `
            $Item `
            $ReleasePath `
            -Recurse `
            -Force

        Write-Host "[COPY] $Item"

    }
    else{

        Write-Host "[SKIP] $Item" -ForegroundColor Yellow

    }

}

# ------------------------------------------------------------
# Statistics
# ------------------------------------------------------------

$Files = Get-ChildItem `
    $ReleasePath `
    -Recurse `
    -File

$Folders = Get-ChildItem `
    $ReleasePath `
    -Recurse `
    -Directory

$FileCount = $Files.Count
$FolderCount = $Folders.Count

$Size = (
    $Files |
    Measure-Object Length -Sum
).Sum

$SizeMB = [Math]::Round($Size / 1MB,2)

# ------------------------------------------------------------
# Generate RELEASE_INFO.json
# ------------------------------------------------------------

$ReleaseInfo = @{

    project = $ProjectName

    version = $Version

    releaseDate = (Get-Date).ToString("yyyy-MM-dd HH:mm:ss")

    buildType = "Release"

    files = $FileCount

    folders = $FolderCount

    sizeMB = $SizeMB

    generatedBy = "release.ps1"

    status = "Ready"

}

$ReleaseInfo |
ConvertTo-Json -Depth 5 |
Set-Content `
    (Join-Path $ReleasePath "RELEASE_INFO.json") `
    -Encoding UTF8

# ------------------------------------------------------------
# Summary
# ------------------------------------------------------------

$ReleaseEnd = Get-Date

$Duration = $ReleaseEnd - $ReleaseStart

Write-Host ""
Write-Host "===============================================" -ForegroundColor Green
Write-Host " Release Package Created"
Write-Host "===============================================" -ForegroundColor Green

Write-Host ("Project      : {0}" -f $ProjectName)
Write-Host ("Version      : {0}" -f $Version)
Write-Host ("Folder       : {0}" -f $ReleasePath)

Write-Host ""

Write-Host ("Files        : {0}" -f $FileCount)
Write-Host ("Folders      : {0}" -f $FolderCount)
Write-Host ("Size         : {0} MB" -f $SizeMB)

Write-Host ""

Write-Host ("Duration     : {0:N2} Seconds" -f $Duration.TotalSeconds)

Write-Host ""

Write-Host "Status       : READY TO PUBLISH" -ForegroundColor Green

Write-Host ""

Write-Host "Next Command"

Write-Host "------------"

Write-Host ".\scripts\publish.ps1" -ForegroundColor Cyan

Write-Host ""

exit 0
