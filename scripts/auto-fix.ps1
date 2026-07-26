# ============================================
# InvoiceRouter
# Auto Fix Engine
# Version: 1.0.0
# ============================================

Clear-Host

$StartTime = Get-Date

Write-Host ""
Write-Host "===============================================" -ForegroundColor Cyan
Write-Host " InvoiceRouter Auto Fix Engine"
Write-Host "===============================================" -ForegroundColor Cyan
Write-Host ""

# ------------------------------------------------------------
# Project Root
# ------------------------------------------------------------

$ProjectRoot = Resolve-Path (Join-Path $PSScriptRoot "..")
Set-Location $ProjectRoot

# ------------------------------------------------------------
# Config
# ------------------------------------------------------------

$ConfigFile = Join-Path $ProjectRoot "manifest\auto-fix.json"

if (!(Test-Path $ConfigFile)) {

    Write-Host "[ERROR] manifest\auto-fix.json not found." -ForegroundColor Red
    exit 1

}

try {

    $Config = Get-Content $ConfigFile -Raw | ConvertFrom-Json

}
catch {

    Write-Host "[ERROR] Invalid auto-fix.json" -ForegroundColor Red
    exit 1

}

# ------------------------------------------------------------
# Log Folder
# ------------------------------------------------------------

$LogFolder = Join-Path $ProjectRoot $Config.report.logFolder

if (!(Test-Path $LogFolder)) {

    New-Item `
        -ItemType Directory `
        -Path $LogFolder | Out-Null

}

$LogFile = Join-Path `
    $LogFolder `
    ("AutoFix_{0}.log" -f (Get-Date -Format "yyyyMMdd_HHmmss"))

Start-Transcript `
    -Path $LogFile `
    -Force | Out-Null

# ------------------------------------------------------------
# Statistics
# ------------------------------------------------------------

$Total = 0
$Passed = 0
$Failed = 0
$Skipped = 0

# ------------------------------------------------------------
# Load Modules
# ------------------------------------------------------------

$Modules = $Config.modules |
Sort-Object priority

foreach($Module in $Modules){

    $Total++

    if(!$Module.enabled){

        $Skipped++

        Write-Host ""
        Write-Host "[SKIP] $($Module.name)" -ForegroundColor Yellow

        continue

    }

    $Script = Join-Path `
        $ProjectRoot `
        $Module.script

    if(!(Test-Path $Script)){

        $Failed++

        Write-Host ""
        Write-Host "[MISSING] $($Module.script)" `
            -ForegroundColor Red

        continue

    }

    Write-Host ""
    Write-Host "-----------------------------------------------"
    Write-Host $Module.name `
        -ForegroundColor Cyan
    Write-Host "-----------------------------------------------"

    try{

        & powershell.exe `
            -ExecutionPolicy Bypass `
            -File $Script

        if($LASTEXITCODE -eq 0){

            $Passed++

            Write-Host "[PASS]" `
                -ForegroundColor Green

        }
        else{

            $Failed++

            Write-Host "[FAILED]" `
                -ForegroundColor Red

            if($Config.settings.stopOnCriticalError){

                break

            }

        }

    }
    catch{

        $Failed++

        Write-Host $_.Exception.Message `
            -ForegroundColor Red

        if($Config.settings.stopOnCriticalError){

            break

        }

    }

}

# ------------------------------------------------------------
# Summary
# ------------------------------------------------------------

$EndTime = Get-Date
$Duration = $EndTime - $StartTime

Write-Host ""
Write-Host "===============================================" `
    -ForegroundColor Green

Write-Host " Auto Fix Summary" `
    -ForegroundColor Green

Write-Host "===============================================" `
    -ForegroundColor Green

Write-Host ("Modules   : {0}" -f $Total)
Write-Host ("Passed    : {0}" -f $Passed)
Write-Host ("Failed    : {0}" -f $Failed)
Write-Host ("Skipped   : {0}" -f $Skipped)

Write-Host ""

Write-Host ("Duration  : {0:N2} Seconds" `
    -f $Duration.TotalSeconds)

Write-Host ""

Write-Host ("Log File  : {0}" -f $LogFile)

Write-Host ""

if($Failed -eq 0){

    Write-Host "Status : SUCCESS" `
        -ForegroundColor Green

}
else{

    Write-Host "Status : COMPLETED WITH ERRORS" `
        -ForegroundColor Yellow

}

Write-Host ""

Stop-Transcript | Out-Null

exit $Failed