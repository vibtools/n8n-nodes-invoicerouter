# ============================================
# InvoiceRouter
# Create Architecture
# Version: 1.0
# ============================================

Clear-Host

Write-Host ""
Write-Host "=============================================="
Write-Host " InvoiceRouter - Architecture Generator"
Write-Host "=============================================="
Write-Host ""

$Root = Resolve-Path (Join-Path $PSScriptRoot "..")

Set-Location $Root

function New-Directory {

    param([string]$Path)

    if (!(Test-Path $Path)) {

        New-Item -ItemType Directory -Path $Path | Out-Null
        Write-Host "[DIR ] $Path"

    }

}

function New-File {

    param(
        [string]$Path,
        [string]$Content=""
    )

    if (!(Test-Path $Path)) {

        Set-Content $Path $Content -Encoding UTF8

        Write-Host "[FILE] $Path"

    }

}

############################################################
# Folder Structure
############################################################

$Folders = @(

"assets",

"docs",

"examples",
"examples\providers",
"examples\workflows",
"examples\google_sheets",

"manifest",

"providers",
"providers\stripe",
"providers\zoho",
"providers\invoice_ninja",
"providers\xero",
"providers\quickbooks",
"providers\erpnext",
"providers\odoo",
"providers\custom",

"shared",
"shared\cache",
"shared\core",
"shared\http",
"shared\logger",
"shared\schemas",
"shared\types",
"shared\utils",

"nodes",
"nodes\01_ProviderLoader",
"nodes\02_ProviderSelector",
"nodes\03_RequestBuilder",
"nodes\04_InvoiceSender",
"nodes\05_StatusChecker",

"tests",
"tests\unit",
"tests\integration",
"tests\mock",

"scripts"

)

foreach($Folder in $Folders){

    New-Directory $Folder

}

############################################################
# Root Files
############################################################

New-File "README.md"
New-File ".gitignore"
New-File "LICENSE"
New-File "package.json"

############################################################
# Manifest
############################################################

New-File "manifest\PROJECT_MANIFEST.json"
New-File "manifest\ARCHITECTURE.md"
New-File "manifest\ROADMAP.md"
New-File "manifest\PROVIDERS.md"

############################################################
# Documentation
############################################################

New-File "docs\INSTALL.md"
New-File "docs\DEVELOPER_GUIDE.md"
New-File "docs\API.md"
New-File "docs\CHANGELOG.md"

############################################################
# Assets
############################################################

New-File "assets\.gitkeep"

############################################################
# Examples
############################################################

New-File "examples\README.md"

New-File "examples\google_sheets\providers.example.csv"
New-File "examples\google_sheets\customers.example.csv"

New-File "examples\providers\stripe.example.json"
New-File "examples\providers\zoho.example.json"

New-File "examples\workflows\bulk-send.json"

############################################################
# Shared
############################################################

New-File "shared\core\BaseNode.ts"
New-File "shared\core\BaseProvider.ts"

New-File "shared\http\HttpClient.ts"

New-File "shared\logger\Logger.ts"

New-File "shared\cache\MemoryCache.ts"

New-File "shared\utils\Helpers.ts"

New-File "shared\types\Common.ts"

New-File "shared\schemas\RequestSchema.ts"
New-File "shared\schemas\ResponseSchema.ts"

############################################################
# Providers
############################################################

$ProviderFiles=@(

"adapter.ts",
"payload.ts",
"parser.ts",
"validator.ts",
"README.md"

)

$ProviderFolders=@(

"stripe",
"zoho",
"invoice_ninja",
"xero",
"quickbooks",
"erpnext",
"odoo",
"custom"

)

foreach($Provider in $ProviderFolders){

    foreach($File in $ProviderFiles){

        New-File "providers\$Provider\$File"

    }

}

############################################################
# Nodes
############################################################

$NodeDefinitions = @(
    @{
        Folder = "01_ProviderLoader"
        Prefix = "ProviderLoader"
    },
    @{
        Folder = "02_ProviderSelector"
        Prefix = "ProviderSelector"
    },
    @{
        Folder = "03_RequestBuilder"
        Prefix = "RequestBuilder"
    },
    @{
        Folder = "04_InvoiceSender"
        Prefix = "InvoiceSender"
    },
    @{
        Folder = "05_StatusChecker"
        Prefix = "StatusChecker"
    }
)

foreach ($Node in $NodeDefinitions) {

    $Folder = "nodes\$($Node.Folder)"
    $Prefix = $Node.Prefix

    New-Directory $Folder

    New-File "$Folder\index.ts"

    New-File "$Folder\$Prefix.node.ts"

    New-File "$Folder\$Prefix.description.ts"

    New-File "$Folder\$Prefix.execute.ts"

    New-File "$Folder\$Prefix.types.ts"

    New-File "$Folder\$Prefix.constants.ts"

    New-File "$Folder\$Prefix.helpers.ts"

    New-File "$Folder\README.md"

}

############################################################
# Tests
############################################################

New-File "tests\README.md"

New-File "tests\unit\.gitkeep"
New-File "tests\integration\.gitkeep"
New-File "tests\mock\.gitkeep"

############################################################
# Scripts
############################################################

New-File "scripts\bootstrap.ps1"
New-File "scripts\build.ps1"
New-File "scripts\clean.ps1"
New-File "scripts\dev.ps1"
New-File "scripts\doctor.ps1"
New-File "scripts\format.ps1"
New-File "scripts\install.ps1"
New-File "scripts\lint.ps1"
New-File "scripts\publish.ps1"
New-File "scripts\release.ps1"
New-File "scripts\test.ps1"
New-File "scripts\update-package.ps1"

############################################################

Write-Host ""
Write-Host "=============================================="
Write-Host " Architecture Created Successfully"
Write-Host "=============================================="
Write-Host ""