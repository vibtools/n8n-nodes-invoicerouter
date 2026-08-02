# Node Icon and Card Wiring

Step 11B wires the eight InvoiceRouter custom nodes to n8n runtime icons. Step 11C polishes those runtime SVGs using the existing Version 1.0 node-card asset style, without changing node behavior, workflow logic, package identity, or the frozen eight-node architecture.

## Runtime icon contract

Each custom node description declares an explicit SVG icon using n8n's file-based icon convention:

```ts
icon: 'file:invoice-router-<node>.svg'
```

The SVG file lives beside the node source file under `nodes/<node-folder>/` and is copied to the matching `dist/nodes/<node-folder>/` directory during `npm run build`. This keeps the icon next to the compiled `.node.js` file that n8n loads at runtime.

The Step 11C SVGs are hand-authored vector icons inspired by the existing PNG node cards. They are not automated PNG-to-SVG conversions and do not embed raster image data. Each icon uses the shared card motif from `assets/node-cards/v1.0/`: purple rounded frame, side connector dots, bottom status pills, small accent sparkles, and a node-specific center symbol. Runtime SVGs intentionally avoid `<text>` and `font-family` so n8n rendering remains consistent across hosts.

## Icons wired

| Node | Runtime icon file |
|---|---|
| Provider Loader | `invoice-router-provider-loader.svg` |
| Provider Selector | `invoice-router-provider-selector.svg` |
| Invoice Template | `invoice-router-invoice-template.svg` |
| Email List | `invoice-router-email-list.svg` |
| Request Builder | `invoice-router-request-builder.svg` |
| Invoice Sender | `invoice-router-invoice-sender.svg` |
| Status Checker | `invoice-router-status-checker.svg` |
| Status Manager | `invoice-router-status-manager.svg` |

## Build and package behavior

`npm run build` now runs:

```bash
npm run clean && tsc -p tsconfig.json && node scripts/copy-node-icons.mjs
```

The source SVG icons are not registered as separate n8n nodes. They are static runtime assets copied into `dist` and shipped through the existing `dist` package entry.

## Node-card assets

The existing PNG files under `assets/node-cards/v1.0/` remain design/documentation assets and the visual reference for the polished runtime SVGs. They are not required by n8n for runtime node cards. In the n8n editor, the visible node card/icon is driven by the `description.icon` value and the packaged SVG asset.

The PNG card assets remain out of the npm `files` list to avoid a large package-size increase. Add them to package files only if a future release explicitly needs to ship design-reference images through npm.

## Validation gates

Step 11B adds validation and smoke coverage that checks:

- every frozen node source description declares an `icon` value;
- every source icon SVG exists;
- every compiled `dist` node folder contains the icon after build;
- every runtime description loaded from `dist` references the expected SVG file;
- every runtime SVG carries the `asset-card-v1` design-source marker;
- runtime SVGs avoid font-dependent text glyphs;
- the npm package includes this wiring document.
