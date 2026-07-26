# ============================================
# InvoiceRouter
# Project Doctor
# Read-Only Health Checker
# Version: 1.0.0
# ============================================

Clear-Host

Write-Host ""
Write-Host "===============================================" -ForegroundColor Cyan
Write-Host " InvoiceRouter Project Doctor" -ForegroundColor Cyan
Write-Host "===============================================" -ForegroundColor Cyan
Write-Host ""

# ------------------------------------------------------------
# Project Root
# ------------------------------------------------------------

$ProjectRoot = Resolve-Path (Join-Path $PSScriptRoot "..")
Set-Location $ProjectRoot

$Warnings = 0
$Errors = 0

# ------------------------------------------------------------
# Helper Functions
# ------------------------------------------------------------

function Show-Result {

    param(
        [bool]$Passed,
        [string]$Label,
        [string]$Value=""
    )

    if ($Passed) {

        Write-Host ("[ OK ] {0,-22} {1}" -f $Label, $Value)

    }
    else {

        Write-Host ("[FAIL] {0,-22} {1}" -f $Label, $Value) -ForegroundColor Red
        $script:Errors++

    }

}

function Show-Warning {

    param([string]$Message)

    Write-Host ("[WARN] {0}" -f $Message) -ForegroundColor Yellow
    $script:Warnings++

}

function Test-JsonFile {

    param([string]$Path)

    if (!(Test-Path $Path)) {

        Show-Result $false $Path "Missing"
        return

    }

    try {

        Get-Content $Path -Raw | ConvertFrom-Json | Out-Null
        Show-Result $true $Path "Valid"

    }
    catch {

        Show-Result $false $Path "Invalid JSON"

    }

}

# ------------------------------------------------------------
# Load Architecture
# ------------------------------------------------------------

Write-Host "Architecture"
Write-Host "-----------------------------------------------"

$ArchitectureFile = "manifest\architecture.json"

if (!(Test-Path $ArchitectureFile)) {

    Show-Result $false "architecture.json" "Missing"
    exit 1

}

try {

    $Architecture = Get-Content $ArchitectureFile -Raw | ConvertFrom-Json
    Show-Result $true "architecture.json" "Loaded"

}
catch {

    Show-Result $false "architecture.json" "Invalid"
    exit 1

}

# ------------------------------------------------------------
# Project
# ------------------------------------------------------------

Write-Host ""
Write-Host "Project"
Write-Host "-----------------------------------------------"

if (Test-Path "package.json") {

    try {

        $Package = Get-Content package.json -Raw | ConvertFrom-Json

        Write-Host ("Name        : {0}" -f $Package.name)
        Write-Host ("Version     : {0}" -f $Package.version)
        Write-Host ("License     : {0}" -f $Package.license)

    }
    catch {

        Show-Warning "package.json is invalid."

    }

}
else {

    Show-Warning "package.json not found."

}

# ------------------------------------------------------------
# Environment
# ------------------------------------------------------------

Write-Host ""
Write-Host "Environment"
Write-Host "-----------------------------------------------"

Show-Result ($PSVersionTable.PSVersion) "PowerShell" $PSVersionTable.PSVersion

$Node = Get-Command node -ErrorAction SilentlyContinue
Show-Result ($null -ne $Node) "Node.js"

$Npm = Get-Command npm -ErrorAction SilentlyContinue
Show-Result ($null -ne $Npm) "npm"

$Git = Get-Command git -ErrorAction SilentlyContinue
Show-Result ($null -ne $Git) "Git"

$Tsc = Get-Command tsc -ErrorAction SilentlyContinue
Show-Result ($null -ne $Tsc) "TypeScript"

# ------------------------------------------------------------
# Root Folders
# ------------------------------------------------------------

Write-Host ""
Write-Host "Folders"
Write-Host "-----------------------------------------------"

foreach($Folder in $Architecture.folders){

    Show-Result (Test-Path $Folder) $Folder

}

# ------------------------------------------------------------
# Root Files
# ------------------------------------------------------------

Write-Host ""
Write-Host "Root Files"
Write-Host "-----------------------------------------------"

foreach($File in $Architecture.rootFiles){

    Show-Result (Test-Path $File) $File

    if(Test-Path $File){

        if((Get-Item $File).Length -eq 0){

            Show-Warning "$File is empty."

        }

    }

}

# ------------------------------------------------------------
# Nodes
# ------------------------------------------------------------

Write-Host ""
Write-Host "Nodes"
Write-Host "-----------------------------------------------"

foreach($Node in $Architecture.nodes){

    $Folder = "nodes\$($Node.folder)"
    $Prefix = $Node.prefix

    Show-Result (Test-Path $Folder) $Node.folder

    $Files = @(
        "index.ts",
        "$Prefix.node.ts",
        "$Prefix.description.ts",
        "$Prefix.execute.ts",
        "$Prefix.types.ts",
        "$Prefix.constants.ts",
        "$Prefix.helpers.ts",
        "README.md"
    )

    foreach($File in $Files){

        Show-Result (Test-Path "$Folder\$File") $File

    }

}

# ------------------------------------------------------------
# Providers
# ------------------------------------------------------------

Write-Host ""
Write-Host "Providers"
Write-Host "-----------------------------------------------"

foreach($Provider in $Architecture.providers){

    $Folder = "providers\$($Provider.folder)"
    $Prefix = $Provider.prefix

    Show-Result (Test-Path $Folder) $Provider.folder

    $Files = @(
        "index.ts",
        "$Prefix`Provider.ts",
        "$Prefix`Payload.ts",
        "$Prefix`Parser.ts",
        "$Prefix`Validator.ts",
        "$Prefix`Types.ts",
        "$Prefix`Constants.ts",
        "$Prefix`Helpers.ts",
        "README.md"
    )

    foreach($File in $Files){

        Show-Result (Test-Path "$Folder\$File") $File

    }

}

# ------------------------------------------------------------
# Dependencies
# ------------------------------------------------------------

Write-Host ""
Write-Host "Dependencies"
Write-Host "-----------------------------------------------"

Show-Result (Test-Path "package.json") "package.json"
Show-Result (Test-Path "package-lock.json") "package-lock.json"
Show-Result (Test-Path "node_modules") "node_modules"

# ------------------------------------------------------------
# JSON Validation
# ------------------------------------------------------------

Write-Host ""
Write-Host "JSON Validation"
Write-Host "-----------------------------------------------"

Test-JsonFile "package.json"
Test-JsonFile "manifest\PROJECT_MANIFEST.json"
Test-JsonFile "manifest\architecture.json"

# ------------------------------------------------------------
# Git
# ------------------------------------------------------------

Write-Host ""
Write-Host "Git"
Write-Host "-----------------------------------------------"

if(Test-Path ".git"){

    Show-Result $true ".git"

    if($Git){

        $Branch = git branch --show-current

        if($Branch){

            Write-Host ("Current Branch : {0}" -f $Branch)

        }

    }

}
else{

    Show-Warning "Git repository not initialized."

}

# ------------------------------------------------------------
# Statistics
# ------------------------------------------------------------

Write-Host ""
Write-Host "Statistics"
Write-Host "-----------------------------------------------"

$FolderCount = (Get-ChildItem -Directory -Recurse -ErrorAction SilentlyContinue).Count
$FileCount = (Get-ChildItem -File -Recurse -ErrorAction SilentlyContinue).Count

Write-Host ("Folders : {0}" -f $FolderCount)
Write-Host ("Files   : {0}" -f $FileCount)
Write-Host ("Nodes   : {0}" -f $Architecture.nodes.Count)
Write-Host ("Providers : {0}" -f $Architecture.providers.Count)

# ------------------------------------------------------------
# Recommendation
# ------------------------------------------------------------

Write-Host ""
Write-Host "Recommendation"
Write-Host "-----------------------------------------------"

if($Errors -gt 0){

    Write-Host ".\scripts\auto-validator.ps1" -ForegroundColor Yellow

}
elseif(!(Test-Path "node_modules")){

    Write-Host ".\scripts\install.ps1" -ForegroundColor Yellow

}
else{

    Write-Host ".\scripts\dev.ps1" -ForegroundColor Green

}

# ------------------------------------------------------------
# Summary
# ------------------------------------------------------------

Write-Host ""
Write-Host "==============================================="

Write-Host ("Warnings : {0}" -f $Warnings) -ForegroundColor Yellow
Write-Host ("Errors   : {0}" -f $Errors)

if($Errors -eq 0){

    Write-Host ""
    Write-Host "Project Status : HEALTHY" -ForegroundColor Green

}
else{

    Write-Host ""
    Write-Host "Project Status : NEEDS ATTENTION" -ForegroundColor Red

}

Write-Host "==============================================="
Write-Host ""

exit $Errors