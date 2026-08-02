# Node Card Assets

Run `COPY_LOCAL_NODE_ASSETS.cmd` from the repository root after adding this freeze pack.

The script copies the local designs from:

`D:\VibTools_Workspace\16_Workflow\dev`

and stores them here with repository-safe names:

- `manual-trigger.png`
- `google-sheets-provider.png`
- `google-sheets-email-list.png`
- `provider-loader.png`
- `provider-selector.png`
- `invoice-template.png`
- `email-list.png`
- `request-builder.png`
- `invoice-sender.png`
- `status-checker.png`
- `status-manager.png`

These are documentation/design assets only and must not affect package runtime or npm publishing unless explicitly added to the package files list. Step 11C uses this visual system as the reference for polished hand-authored runtime SVG icons. Runtime n8n node cards use the SVG icons declared in each custom node description and copied into `dist` by `scripts/copy-node-icons.mjs`.
