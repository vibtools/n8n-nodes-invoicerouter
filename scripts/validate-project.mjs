import { access, readFile, readdir, stat } from 'node:fs/promises';
import { constants } from 'node:fs';
import { execFileSync } from 'node:child_process';

const requiredFiles = [
  'package.json', 'package-lock.json', 'tsconfig.json', '.gitignore', '.gitattributes', '.editorconfig',
  'README.md', 'ARCHITECTURE.md', 'LICENSE', 'CHANGELOG.md', 'VERSION_1_0_FREEZE.md',
  'manifest/freeze-v1.0.json',
  'docs/freeze/v1.0/README.md', 'docs/freeze/v1.0/FINAL_ARCHITECTURE.md',
  'docs/freeze/v1.0/NODE_CONTRACTS.md', 'docs/freeze/v1.0/PROVIDER_SHEET_CONTRACT.md',
  'docs/freeze/v1.0/SECURITY_DECISION.md', 'docs/freeze/v1.0/N8N_DRY_RUN_VALIDATION.md',
  'docs/freeze/v1.0/PROVIDER_REQUEST_RESPONSE_MAPPING.md', 'docs/freeze/v1.0/STATUS_WRITEBACK_WIRING.md',
  'docs/freeze/v1.0/RETRY_ERROR_CLASSIFICATION.md', 'docs/freeze/v1.0/SANDBOX_LIVE_ACTIVATION.md',
  'docs/freeze/v1.0/NODE_ICON_CARD_WIRING.md', 'docs/freeze/v1.0/BULK_RUN_SAFETY.md',
  'docs/freeze/v1.0/PRODUCTION_PRESET_SELF_CHECK_AND_RETRY_WIRING.md',
  'docs/freeze/v1.0/IMPLEMENTATION_GAP_MATRIX.md',
  'docs/freeze/v1.0/IMPLEMENTATION_ORDER.md', 'docs/freeze/v1.0/NOTION_SOURCE_MAP.md',
  'docs/freeze/v1.0/CLEAN_REPOSITORY_CONTRACT.md', 'docs/freeze/v1.0/IMPLEMENTATION_AUDIT.md',
  'docs/freeze/v1.0/N8N_REGISTRY_UI_INSTALL_COMPATIBILITY.md',
  'assets/architecture/invoice-router-architecture-v1.0.pdf',
  'assets/architecture/invoice-router-architecture-v1.0.png',
  'examples/google_sheets/InvoiceRouter_20_Provider_Production_Presets_v1.0.xlsx',
  'examples/n8n_dry_run_validation/README.md',
  'examples/n8n_dry_run_validation/provider-accounts-dry-run.csv',
  'examples/n8n_dry_run_validation/email-list-dry-run.csv',
  'examples/n8n_dry_run_validation/status-writeback-columns.csv',
  'examples/n8n_dry_run_validation/expected-dry-run-outcomes.json',
  'workflows/InvoiceRouter-v1-production.json',
  'scripts/clean.mjs', 'scripts/format.mjs', 'scripts/lint.mjs', 'scripts/validate-project.mjs', 'scripts/copy-node-icons.mjs',
  'scripts/diagnose-n8n-package.mjs',
];

const nodeFolders = [
  ['01_ProviderLoader', 'ProviderLoader'], ['02_ProviderSelector', 'ProviderSelector'],
  ['03_InvoiceTemplate', 'InvoiceTemplate'], ['04_EmailList', 'EmailList'],
  ['05_RequestBuilder', 'RequestBuilder'], ['06_InvoiceSender', 'InvoiceSender'],
  ['07_StatusChecker', 'StatusChecker'], ['08_StatusManager', 'StatusManager'],
];

const requiredDirectories = [
  '.github/workflows', 'assets/architecture', 'assets/node-cards/v1.0', 'docs/freeze/v1.0',
  'examples/google_sheets', 'examples/n8n_dry_run_validation', 'manifest', 'nodes', 'providers', 'scripts', 'shared', 'tests', 'workflows',
];

const forbiddenPaths = [
  'credentials', 'COPY_LOCAL_NODE_ASSETS.cmd', 'INSTALL.md', 'FORENSIC_AUDIT.md', 'PRODUCTION_GUIDE.md',
  'user-docs', 'manifest/PROJECT_MANIFEST.json', 'manifest/architecture.json', 'manifest/auto-fix.json',
  'manifest/release.json', 'docs/Feature-Freeze.md', 'scripts/fixers', 'scripts/auto-fix.ps1',
  'scripts/bootstrap.ps1', '.github/workflows/01-bootstrap.yml', '.github/workflows/02-build.yml',
  '.github/workflows/03-docs.yml', '.github/workflows/04-release.yml',
];

const errors = [];
async function exists(path) {
  try { await access(path, constants.F_OK); return true; } catch { return false; }
}
async function requireFile(path) {
  try {
    await access(path, constants.R_OK);
    if ((await stat(path)).size === 0) errors.push(`${path} is empty`);
  } catch { errors.push(`${path} is missing`); }
}
async function requireDirectory(path) {
  try { if (!(await stat(path)).isDirectory()) errors.push(`${path} is not a directory`); }
  catch { errors.push(`${path} directory is missing`); }
}

for (const path of requiredFiles) await requireFile(path);
for (const path of requiredDirectories) await requireDirectory(path);
for (const path of forbiddenPaths) if (await exists(path)) errors.push(`legacy/conflicting path must be removed: ${path}`);
for (const [folder, className] of nodeFolders) {
  await requireFile(`nodes/${folder}/${className}.node.ts`);
  await requireFile(`nodes/${folder}/${className}.description.ts`);
  await requireFile(`nodes/${folder}/${className}.execute.ts`);
}

const expectedIcons = {
  ProviderLoader: 'invoice-router-provider-loader.svg',
  ProviderSelector: 'invoice-router-provider-selector.svg',
  InvoiceTemplate: 'invoice-router-invoice-template.svg',
  EmailList: 'invoice-router-email-list.svg',
  RequestBuilder: 'invoice-router-request-builder.svg',
  InvoiceSender: 'invoice-router-invoice-sender.svg',
  StatusChecker: 'invoice-router-status-checker.svg',
  StatusManager: 'invoice-router-status-manager.svg',
};
const expectedDisplayNames = {
  ProviderLoader: 'InvoiceRouter Provider Loader',
  ProviderSelector: 'InvoiceRouter Provider Selector',
  InvoiceTemplate: 'InvoiceRouter Invoice Template',
  EmailList: 'InvoiceRouter Email List',
  RequestBuilder: 'InvoiceRouter Request Builder',
  InvoiceSender: 'InvoiceRouter Invoice Sender',
  StatusChecker: 'InvoiceRouter Status Checker',
  StatusManager: 'InvoiceRouter Status Manager',
};
for (const [folder, className] of nodeFolders) {
  const expectedIcon = expectedIcons[className];
  await requireFile(`nodes/${folder}/${expectedIcon}`);
  const descriptionSource = await readFile(`nodes/${folder}/${className}.description.ts`, 'utf8');
  if (!descriptionSource.includes(`icon: 'file:${expectedIcon}'`)) {
    errors.push(`${className}.description.ts must declare icon: 'file:${expectedIcon}'`);
  }
  const constantsSource = await readFile(`nodes/${folder}/${className}.constants.ts`, 'utf8');
  if (!constantsSource.includes(`NODE_DISPLAY_NAME = '${expectedDisplayNames[className]}'`)) {
    errors.push(`${className}.constants.ts must use searchable InvoiceRouter display name ${expectedDisplayNames[className]}.`);
  }
  const iconSource = await readFile(`nodes/${folder}/${expectedIcon}`, 'utf8');
  if (!iconSource.includes('data-design-source="asset-card-v1"')) errors.push(`${expectedIcon} must be asset-card-v1 inspired.`);
  if (!iconSource.includes('data-icon-style="vib-tools-node-card-polished"')) errors.push(`${expectedIcon} must use the polished runtime icon style.`);
  if (/<text[\s>]/.test(iconSource) || /font-family/.test(iconSource)) errors.push(`${expectedIcon} must not depend on text glyph rendering.`);
}

for (const path of ['package.json', 'package-lock.json', 'manifest/freeze-v1.0.json', 'workflows/InvoiceRouter-v1-production.json']) {
  try { JSON.parse(await readFile(path, 'utf8')); }
  catch (error) { errors.push(`${path} is invalid JSON: ${error.message}`); }
}

const pkg = JSON.parse(await readFile('package.json', 'utf8'));
const nodes = pkg.n8n?.nodes ?? [];
if (!Array.isArray(nodes) || nodes.length !== 8) errors.push('package.json must register exactly eight frozen custom nodes.');
if (pkg.n8n?.credentials) errors.push('package.json must not register a separate credential type in the Version 1 Sheet-credential flow.');
if (!(pkg.files ?? []).includes('examples/n8n_dry_run_validation')) errors.push('package.json must include the dry-run validation package in npm files.');
if (!(pkg.files ?? []).includes('docs/freeze/v1.0/N8N_DRY_RUN_VALIDATION.md')) errors.push('package.json must include the dry-run validation checklist in npm files.');
if (!(pkg.files ?? []).includes('docs/freeze/v1.0/STATUS_WRITEBACK_WIRING.md')) errors.push('package.json must include the status writeback wiring checklist in npm files.');
if (!(pkg.files ?? []).includes('docs/freeze/v1.0/RETRY_ERROR_CLASSIFICATION.md')) errors.push('package.json must include the retry/error classification contract in npm files.');
if (!(pkg.files ?? []).includes('docs/freeze/v1.0/SANDBOX_LIVE_ACTIVATION.md')) errors.push('package.json must include the sandbox/live activation safety guide in npm files.');
if (!(pkg.files ?? []).includes('docs/freeze/v1.0/NODE_ICON_CARD_WIRING.md')) errors.push('package.json must include the node icon/card wiring guide in npm files.');
if (!(pkg.files ?? []).includes('docs/freeze/v1.0/BULK_RUN_SAFETY.md')) errors.push('package.json must include the bulk run safety guide in npm files.');
if (!(pkg.files ?? []).includes('docs/freeze/v1.0/PRODUCTION_PRESET_SELF_CHECK_AND_RETRY_WIRING.md')) errors.push('package.json must include the production preset self-check and retry wiring guide in npm files.');
if (!(pkg.files ?? []).includes('docs/freeze/v1.0/N8N_REGISTRY_UI_INSTALL_COMPATIBILITY.md')) errors.push('package.json must include the n8n registry/UI install compatibility guide in npm files.');
if (!(pkg.files ?? []).includes('scripts/diagnose-n8n-package.mjs')) errors.push('package.json must include the installed-package diagnostic script in npm files.');
if (!Array.isArray(pkg.keywords) || !pkg.keywords.includes('n8n-community-node-package')) errors.push('package.json must keep the n8n-community-node-package keyword for registry discovery.');
for (const keyword of ['invoicerouter', 'invoice-router', 'bulk-invoice', 'invoice-automation', 'n8n-invoice-router']) {
  if (!pkg.keywords.includes(keyword)) errors.push(`package.json keywords must include ${keyword} for n8n/npm searchability.`);
}
if (pkg.peerDependencies?.['n8n-workflow']) errors.push('package.json must not require n8n-workflow as a runtime peer dependency.');
if (pkg.invoiceRouterFreeze?.targetNodeCount !== 8 || pkg.invoiceRouterFreeze?.currentNodeCount !== 8) errors.push('package.json must declare 8/8 frozen nodes.');
if (pkg.invoiceRouterFreeze?.implementationStatus !== 'COMPLETE') errors.push('package implementationStatus must be COMPLETE.');

const workflow = JSON.parse(await readFile('workflows/InvoiceRouter-v1-production.json', 'utf8'));
const customWorkflowNodes = workflow.nodes?.filter((node) => String(node.type).startsWith('n8n-nodes-invoicerouter.')) ?? [];
if (customWorkflowNodes.length !== 8) errors.push('Production workflow must contain all eight custom node types.');
const requestBuilderSources = [];
for (const [source, value] of Object.entries(workflow.connections ?? {})) {
  for (const output of value.main ?? []) for (const connection of output) if (connection.node === 'Request Builder') requestBuilderSources.push([source, connection.index]);
}
if (JSON.stringify(requestBuilderSources.sort((a, b) => a[1] - b[1])) !== JSON.stringify([['Provider Selector', 0], ['Invoice Template', 1], ['Email List', 2]])) {
  errors.push('Request Builder must receive Provider Selector, Invoice Template, and Email List on inputs 0, 1, and 2.');
}

const workflowNodesByName = Object.fromEntries((workflow.nodes ?? []).map((node) => [node.name, node]));
if (!workflowNodesByName['Prepare Status Writeback Row']) errors.push('Production workflow must include Prepare Status Writeback Row after Status Manager.');
if (!workflowNodesByName['Google Sheets - Status Writeback']) errors.push('Production workflow must include Google Sheets - Status Writeback.');
if (!workflowNodesByName['Prepare Retry Request']) errors.push('Production workflow must include Prepare Retry Request for automatic retry loop wiring.');
if (!workflowNodesByName['Wait Before Retry']) errors.push('Production workflow must include Wait Before Retry for automatic retry loop wiring.');
if (workflowNodesByName['Prepare Status Writeback Row']?.type !== 'n8n-nodes-base.code') errors.push('Prepare Status Writeback Row must use the built-in Code node.');
if (workflowNodesByName['Google Sheets - Status Writeback']?.type !== 'n8n-nodes-base.googleSheets') errors.push('Google Sheets - Status Writeback must use the built-in Google Sheets node.');
if (workflowNodesByName['Google Sheets - Status Writeback']?.parameters?.operation !== 'appendOrUpdate') errors.push('Google Sheets - Status Writeback must use appendOrUpdate operation.');
if (workflowNodesByName['Prepare Retry Request']?.type !== 'n8n-nodes-base.code') errors.push('Prepare Retry Request must use the built-in Code node.');
if (workflowNodesByName['Wait Before Retry']?.type !== 'n8n-nodes-base.wait') errors.push('Wait Before Retry must use the built-in Wait node.');
if (workflowNodesByName['Status Manager']?.parameters?.respectRetryAfterHeader !== true) errors.push('Status Manager must respect provider Retry-After headers in the production workflow.');
if (workflowNodesByName['Status Manager']?.parameters?.retryMaxDelaySeconds !== 900) errors.push('Status Manager must cap retry delays at 900 seconds in the production workflow.');
if (workflowNodesByName['Invoice Sender']?.parameters?.productionPresetMode !== 'dryRunValidation') errors.push('Invoice Sender must default to Dry Run Validation production preset self-check mode.');
if (workflowNodesByName['Invoice Sender']?.parameters?.activationSafetyMode !== 'dryRunValidation') errors.push('Invoice Sender must default to Dry Run Validation activation safety mode.');
if (workflowNodesByName['Invoice Sender']?.parameters?.expectedEnvironment !== 'sandbox') errors.push('Invoice Sender must expect sandbox requests for the first activation stage.');
if (workflowNodesByName['Invoice Sender']?.parameters?.sandboxModeConfirmation !== '') errors.push('Sandbox Mode Confirmation must be blank in the production template.');
if (workflowNodesByName['Invoice Sender']?.parameters?.liveModeConfirmation !== '') errors.push('Live Mode Confirmation must be blank in the production template.');
if (workflowNodesByName['Invoice Sender']?.parameters?.enableBulkSafety !== true) errors.push('Invoice Sender must enable bulk safety controls in the production workflow.');
if (workflowNodesByName['Invoice Sender']?.parameters?.maxInvoicesPerExecution !== 100) errors.push('Invoice Sender must cap production-template bulk runs at 100 invoices.');
if (workflowNodesByName['Invoice Sender']?.parameters?.requireUniformEnvironment !== true) errors.push('Invoice Sender must require uniform request environments for bulk runs.');
if (workflowNodesByName['Invoice Sender']?.parameters?.stopOnCriticalBulkError !== true) errors.push('Invoice Sender must stop remaining bulk items on critical errors.');
if (workflowNodesByName['Invoice Sender']?.parameters?.maxFailedSendsBeforeAbort !== 5) errors.push('Invoice Sender must abort after 5 failed sends in the production template.');
if (workflowNodesByName['Invoice Sender']?.parameters?.sandboxBulkConfirmation !== '') errors.push('Sandbox Bulk Confirmation must be blank in the production template.');
if (workflowNodesByName['Invoice Sender']?.parameters?.liveBulkConfirmation !== '') errors.push('Live Bulk Confirmation must be blank in the production template.');
const statusManagerTargets = (((workflow.connections ?? {})['Status Manager']?.main ?? [])[0] ?? []).map((connection) => connection.node);
if (!statusManagerTargets.includes('Prepare Status Writeback Row')) errors.push('Status Manager must feed Prepare Status Writeback Row.');
if (!statusManagerTargets.includes('Prepare Retry Request')) errors.push('Status Manager must feed Prepare Retry Request.');
const writebackTargets = (((workflow.connections ?? {})['Prepare Status Writeback Row']?.main ?? [])[0] ?? []).map((connection) => connection.node);
if (!writebackTargets.includes('Google Sheets - Status Writeback')) errors.push('Prepare Status Writeback Row must feed Google Sheets - Status Writeback.');
const retryTargets = (((workflow.connections ?? {})['Prepare Retry Request']?.main ?? [])[0] ?? []).map((connection) => connection.node);
if (!retryTargets.includes('Wait Before Retry')) errors.push('Prepare Retry Request must feed Wait Before Retry.');
const waitTargets = (((workflow.connections ?? {})['Wait Before Retry']?.main ?? [])[0] ?? []).map((connection) => connection.node);
if (!waitTargets.includes('Invoice Sender')) errors.push('Wait Before Retry must feed Invoice Sender for automatic retry execution.');

for (const folder of await readdir('nodes')) {
  const entries = await readdir(`nodes/${folder}`);
  if (entries.some((name) => /^Node\./.test(name))) errors.push(`duplicate alias files remain in nodes/${folder}`);
}

try {
  const trackedDist = execFileSync('git', ['ls-files', 'dist'], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim();
  if (trackedDist) errors.push('dist/ contains tracked files; generated output must not be committed.');
  const trackedPs1 = execFileSync('git', ['ls-files', 'scripts/*.ps1', 'scripts/fixers/**'], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim();
  if (trackedPs1) errors.push('legacy PowerShell automation is still tracked.');
} catch {
  // Unpacked source archives may not contain Git metadata.
}

if (errors.length) {
  console.error('Project validation failed:');
  for (const error of errors) console.error(`- ${error}`);
  process.exit(1);
}
console.log('Project validation passed. Registered nodes: 8/8. Production workflow: complete.');
