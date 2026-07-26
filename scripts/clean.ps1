
# ============================================
# InvoiceRouter
# Project Cleaner
# Version: 1.0.0
# ============================================

Clear-Host

Write-Host ""
Write-Host "===============================================" -ForegroundColor Cyan
Write-Host " InvoiceRouter Project Cleaner" -ForegroundColor Cyan
Write-Host "===============================================" -ForegroundColor Cyan
Write-Host ""

# ------------------------------------------------------------
# Project Root
# ------------------------------------------------------------

$ProjectRoot = Resolve-Path (Join-Path $PSScriptRoot "..")
Set-Location $ProjectRoot

$Deleted = 0
$Skipped = 0

# ------------------------------------------------------------
# Helper
# ------------------------------------------------------------

function Remove-Safely {

    param(
        [string]$Path
    )

    if (Test-Path $Path) {

        Remove-Item $Path -Recurse -Force

        Write-Host "[DELETE] $Path" -ForegroundColor Green

        $script:Deleted++

    }
    else {

        Write-Host "[SKIP]   $Path"

        $script:Skipped++

    }

}

# ------------------------------------------------------------
# Clean Folders
# ------------------------------------------------------------

Write-Host "Cleaning Folders..."
Write-Host ""

$Folders = @(

"dist",
"build",
"coverage",
".nyc_output",
".turbo",
".cache",
".tmp",
"temp",
"logs"

)

foreach($Folder in $Folders){

    Remove-Safely $Folder

}

# ------------------------------------------------------------
# Clean Files
# ------------------------------------------------------------

Write-Host ""
Write-Host "Cleaning Log Files..."
Write-Host ""

$Patterns = @(

"*.log",
"*.tmp",
"*.cache"

)

foreach($Pattern in $Patterns){

    Get-ChildItem `
        -Recurse `
        -File `
        -Filter $Pattern `
        -ErrorAction SilentlyContinue | ForEach-Object {

            Remove-Item $_.FullName -Force

            Write-Host "[DELETE] $($_.FullName)" -ForegroundColor Green

            $script:Deleted++

        }

}

# ------------------------------------------------------------
# Summary
# ------------------------------------------------------------

Write-Host ""
Write-Host "==============================================="
Write-Host " Clean Summary"
Write-Host "==============================================="

Write-Host ("Deleted : {0}" -f $Deleted)
Write-Host ("Skipped : {0}" -f $Skipped)

Write-Host ""

Write-Host "Project cleaned successfully." -ForegroundColor Green

Write-Host ""