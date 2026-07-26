# ============================================
# InvoiceRouter
# N8N Fixer
# Version: 1.0.0
# ============================================

$ErrorActionPreference = "Stop"

Write-Host ""
Write-Host "N8N Fixer" -ForegroundColor Cyan
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
# Workflow Files
# --------------------------------------------------

$WorkflowFiles = @()

if ($Config.workflowFiles) {

    foreach ($Pattern in $Config.workflowFiles) {

        $WorkflowFiles += Get-ChildItem `
            -Path "." `
            -Recurse `
            -Filter $Pattern `
            -File `
            -ErrorAction SilentlyContinue

    }

}

$WorkflowFiles = $WorkflowFiles | Sort-Object FullName -Unique

if ($WorkflowFiles.Count -eq 0) {

    Write-Host "No n8n workflow files found."
    exit 0

}

# --------------------------------------------------
# Process Workflows
# --------------------------------------------------

foreach ($Workflow in $WorkflowFiles) {

    Write-Host ""
    Write-Host "Checking : $($Workflow.FullName)"

    try {

        $Json = Get-Content `
            $Workflow.FullName `
            -Raw |
            ConvertFrom-Json

    }
    catch {

        Write-Host "[FAILED] Invalid JSON" `
            -ForegroundColor Red

        $Failed++
        continue

    }

    $Changed = $false

    # --------------------------------------------------
    # Nodes
    # --------------------------------------------------

    if ($null -eq $Json.nodes) {

        Write-Host "[FAILED] Missing nodes"

        $Failed++
        continue

    }

    # --------------------------------------------------
    # Connections
    # --------------------------------------------------

    if ($null -eq $Json.connections) {

        if ($Config.n8nFixer.fixConnections) {

            $Json | Add-Member `
                -NotePropertyName connections `
                -NotePropertyValue @{} `
                -Force

            Write-Host "[FIX] Added empty connections"

            $Changed = $true

        }

    }

    # --------------------------------------------------
    # Node IDs
    # --------------------------------------------------

    if ($Config.n8nFixer.fixNodeIds) {

        foreach ($Node in $Json.nodes) {

            if ([string]::IsNullOrWhiteSpace($Node.id)) {

                $Node.id = [guid]::NewGuid().ToString()

                Write-Host "[FIX] Generated node id : $($Node.name)"

                $Changed = $true

            }

        }

    }

    # --------------------------------------------------
    # Node Positions
    # --------------------------------------------------

    if ($Config.n8nFixer.fixNodePositions) {

        foreach ($Node in $Json.nodes) {

            if ($null -eq $Node.position) {

                $Node | Add-Member `
                    -NotePropertyName position `
                    -NotePropertyValue @(0,0) `
                    -Force

                Write-Host "[FIX] Added default position : $($Node.name)"

                $Changed = $true

            }

        }

    }

    # --------------------------------------------------
    # Expressions
    # --------------------------------------------------

    if ($Config.n8nFixer.fixExpressions) {

        foreach ($Node in $Json.nodes) {

            if ($null -eq $Node.parameters) {

                $Node | Add-Member `
                    -NotePropertyName parameters `
                    -NotePropertyValue @{} `
                    -Force

                Write-Host "[FIX] Added parameters : $($Node.name)"

                $Changed = $true

            }

        }

    }

    # --------------------------------------------------
    # Save
    # --------------------------------------------------

    if ($Changed) {

        try {

            $Json |
            ConvertTo-Json `
                -Depth 100 |
            Set-Content `
                $Workflow.FullName `
                -Encoding UTF8

            Write-Host "[SAVED]" `
                -ForegroundColor Green

            $Fixed++

        }
        catch {

            Write-Host "[FAILED] Save error" `
                -ForegroundColor Red

            $Failed++

        }

    }
    else {

        Write-Host "[OK] No changes required"

        $Skipped++

    }

}

# --------------------------------------------------
# Summary
# --------------------------------------------------

Write-Host ""
Write-Host "======================================="
Write-Host "N8N Fix Summary"
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