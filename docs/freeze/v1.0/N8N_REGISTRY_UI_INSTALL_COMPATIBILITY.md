# n8n Registry/UI Install Compatibility

This document records the Step 12B compatibility hardening for publishing `n8n-nodes-invoicerouter@1.5.0` to npm and installing it through the n8n Community Nodes UI.

## Purpose

The package is intended to be installed from npm through the n8n UI wherever possible. Manual `.tgz` installation is supported only as a fallback for local acceptance testing or private staging, because it can create path, container, cache, or old-version split-state issues.

## Registry discovery contract

`package.json` must keep:

- package name: `n8n-nodes-invoicerouter`
- version: `1.5.0`
- keyword: `n8n-community-node-package`
- `n8n.n8nNodesApiVersion = 1`
- exactly eight paths in `n8n.nodes`
- compiled node files under `dist/nodes/.../*.node.js`
- runtime SVG icons copied beside compiled node files

Additional search keywords are included for npm discoverability: `invoicerouter`, `invoice-router`, `bulk-invoice`, `invoice-automation`, and `n8n-invoice-router`.

## Runtime dependency boundary

The published package must not require an install-time `n8n-workflow` peer dependency. InvoiceRouter uses local compatibility types in `shared/types/N8n.ts` and does not import `n8n-workflow` at runtime.

`n8n-workflow` remains a development dependency only for ecosystem alignment during local development. It must not be declared as a runtime `peerDependency`, because self-hosted n8n UI/npm installers may try to resolve peer dependencies inside the user data directory or container runtime.

## n8n UI search names

The custom node display names are prefixed for editor searchability:

| Node type key | n8n editor display name |
|---|---|
| `providerLoader` | `InvoiceRouter Provider Loader` |
| `providerSelector` | `InvoiceRouter Provider Selector` |
| `invoiceTemplate` | `InvoiceRouter Invoice Template` |
| `emailList` | `InvoiceRouter Email List` |
| `requestBuilder` | `InvoiceRouter Request Builder` |
| `invoiceSender` | `InvoiceRouter Invoice Sender` |
| `statusChecker` | `InvoiceRouter Status Checker` |
| `statusManager` | `InvoiceRouter Status Manager` |

Existing workflow node instance names may remain short, for example `Invoice Sender`. n8n node resolution depends on the internal node type, not on the visible display name.

## Preferred production install path

1. Merge the clean source into the GitHub release repository.
2. Run `npm ci`.
3. Run `npm run verify`.
4. Run `npm pack`.
5. Publish `n8n-nodes-invoicerouter@1.5.0` to npm.
6. In n8n, install/update the package from the Community Nodes UI using the npm package name:

```text
n8n-nodes-invoicerouter
```

7. Restart n8n if the UI prompts for it or if the node panel does not refresh.
8. Search the node panel for:

```text
InvoiceRouter
```

## Manual `.tgz` fallback

Manual `.tgz` installation should be used only when npm publication is unavailable. Install from inside the same runtime/container that runs n8n:

```bash
cd ~/.n8n/nodes
npm install /absolute/path/to/n8n-nodes-invoicerouter-1.5.0.tgz --legacy-peer-deps
node ./node_modules/n8n-nodes-invoicerouter/scripts/diagnose-n8n-package.mjs ./node_modules/n8n-nodes-invoicerouter
```

Then restart n8n and check logs for `invoicerouter`, `community`, `custom`, or `node` load messages.

## Diagnostic command

The package includes a small diagnostic script in the published tarball. It validates the installed package manifest, `n8n.nodes` paths, compiled node exports, and packaged SVG icons:

```bash
node ~/.n8n/nodes/node_modules/n8n-nodes-invoicerouter/scripts/diagnose-n8n-package.mjs ~/.n8n/nodes/node_modules/n8n-nodes-invoicerouter
```

A passing diagnostic proves the installed package is structurally loadable. It does not prove n8n refreshed its UI cache, loaded the right user-data directory, or installed the package through the UI-managed community-node database.

## Common root causes when nodes do not appear

| Symptom | Likely cause | Check |
|---|---|---|
| Package installed on VPS but not visible in n8n | Installed on host instead of n8n container/user-data path | Run the diagnostic inside the container/runtime |
| Community Nodes page does not list the package | Manual npm install instead of UI-managed install | Prefer npm publish + n8n UI install |
| Search for package name returns nothing | Editor searches node display names | Search `InvoiceRouter` or `InvoiceRouter Invoice Sender` |
| Old behavior appears after reinstall | Old `1.2.0` UI install and local `1.5.0` split-state | Uninstall old package, restart, then install `1.5.0` from npm |
| `npm install` warns or fails on peer resolution | Runtime peer dependency conflict | Step 12B removes `n8n-workflow` from peerDependencies |

## Release hygiene

Do not upload or publish dirty working ZIPs that contain:

- `.git/`
- `node_modules/`
- `dist/`
- `.swp` editor swap files
- local `.tgz` packages inside the source tree

Use the generated clean source ZIP or the npm tarball produced by `npm pack`.
