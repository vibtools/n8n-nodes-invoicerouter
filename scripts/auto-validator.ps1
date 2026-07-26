# ============================================
# InvoiceRouter
# Architecture Auto Validator
# Version: 1.0
# ============================================

Clear-Host

Write-Host ""
Write-Host "=============================================="
Write-Host " InvoiceRouter Architecture Validator"
Write-Host "=============================================="
Write-Host ""

$ProjectRoot = Resolve-Path (Join-Path $PSScriptRoot "..")
Set-Location $ProjectRoot

$Errors = 0
$Warnings = 0
$FoldersChecked = 0
$FilesChecked = 0
$JsonChecked = 0

# ------------------------------------------------------------
# Helper Functions
# ------------------------------------------------------------

function Ensure-Directory {

    param([string]$Path)

    $script:FoldersChecked++

    if (!(Test-Path $Path)) {

        New-Item -ItemType Directory -Path $Path | Out-Null

        Write-Host "[CREATE] Folder : $Path" -ForegroundColor Green

    }
    else {

        Write-Host "[ OK ] Folder : $Path"

    }

}

function Ensure-File {

    param([string]$Path)

    $script:FilesChecked++

    if (!(Test-Path $Path)) {

        New-Item -ItemType File -Path $Path | Out-Null

        Write-Host "[CREATE] File   : $Path" -ForegroundColor Green

        return

    }

    Write-Host "[ OK ] File   : $Path"

    if ((Get-Item $Path).Length -eq 0) {

        Write-Host "         Warning: Empty File" -ForegroundColor Yellow

        $script:Warnings++

    }

}

function Test-Json {

    param([string]$Path)

    if (!(Test-Path $Path)) {

        return

    }

    $script:JsonChecked++

    try {

        Get-Content $Path -Raw | ConvertFrom-Json | Out-Null

        Write-Host "[ OK ] JSON   : $Path"

    }
    catch {

        Write-Host "[FAIL] JSON   : $Path" -ForegroundColor Red

        $script:Errors++

    }

}

# ------------------------------------------------------------
# Root Folders
# ------------------------------------------------------------

$Folders = @(
"assets",
"docs",
"examples",
"manifest",
"providers",
"shared",
"nodes",
"tests",
"scripts"
)

foreach($Folder in $Folders){

    Ensure-Directory $Folder

}

# ------------------------------------------------------------
# Root Files
# ------------------------------------------------------------

$RootFiles = @(
"README.md",
"LICENSE",
".gitignore",
"package.json"
)

foreach($File in $RootFiles){

    Ensure-File $File

}

# ------------------------------------------------------------
# Manifest
# ------------------------------------------------------------

$ManifestFiles = @(
"manifest\PROJECT_MANIFEST.json",
"manifest\ARCHITECTURE.md",
"manifest\ROADMAP.md",
"manifest\PROVIDERS.md"
)

foreach($File in $ManifestFiles){

    Ensure-File $File

}

# ------------------------------------------------------------
# Nodes
# ------------------------------------------------------------

$Nodes = @(
@{ Folder="01_ProviderLoader"; Prefix="ProviderLoader" },
@{ Folder="02_ProviderSelector"; Prefix="ProviderSelector" },
@{ Folder="03_RequestBuilder"; Prefix="RequestBuilder" },
@{ Folder="04_InvoiceSender"; Prefix="InvoiceSender" },
@{ Folder="05_StatusChecker"; Prefix="StatusChecker" }
)

foreach($Node in $Nodes){

    $Folder = "nodes\$($Node.Folder)"
    $Prefix = $Node.Prefix

    Ensure-Directory $Folder

    Ensure-File "$Folder\index.ts"
    Ensure-File "$Folder\$Prefix.node.ts"
    Ensure-File "$Folder\$Prefix.description.ts"
    Ensure-File "$Folder\$Prefix.execute.ts"
    Ensure-File "$Folder\$Prefix.types.ts"
    Ensure-File "$Folder\$Prefix.constants.ts"
    Ensure-File "$Folder\$Prefix.helpers.ts"
    Ensure-File "$Folder\README.md"

}

# ------------------------------------------------------------
# Providers
# ------------------------------------------------------------

$Providers = @(
"Stripe",
"Zoho",
"InvoiceNinja",
"Xero",
"QuickBooks",
"ERPNext",
"Odoo",
"Custom"
)

foreach($Provider in $Providers){

    $Folder = "providers\$Provider"

    Ensure-Directory $Folder

    Ensure-File "$Folder\index.ts"
    Ensure-File "$Folder\$Provider`Provider.ts"
    Ensure-File "$Folder\$Provider`Payload.ts"
    Ensure-File "$Folder\$Provider`Parser.ts"
    Ensure-File "$Folder\$Provider`Validator.ts"
    Ensure-File "$Folder\$Provider`Types.ts"
    Ensure-File "$Folder\$Provider`Constants.ts"
    Ensure-File "$Folder\$Provider`Helpers.ts"
    Ensure-File "$Folder\README.md"

}

# ------------------------------------------------------------
# JSON Validation
# ------------------------------------------------------------

Test-Json "package.json"
Test-Json "manifest\PROJECT_MANIFEST.json"

# ------------------------------------------------------------
# Summary
# ------------------------------------------------------------

Write-Host ""
Write-Host "=============================================="
Write-Host " Architecture Validation Summary"
Write-Host "=============================================="

Write-Host ("Folders Checked : {0}" -f $FoldersChecked)
Write-Host ("Files Checked   : {0}" -f $FilesChecked)
Write-Host ("JSON Checked    : {0}" -f $JsonChecked)
Write-Host ("Warnings        : {0}" -f $Warnings) -ForegroundColor Yellow
Write-Host ("Errors          : {0}" -f $Errors)

Write-Host ""

if ($Errors -eq 0) {

    Write-Host "Architecture Status : VALID" -ForegroundColor Green

}
else {

    Write-Host "Architecture Status : INVALID" -ForegroundColor Red

}

Write-Host ""