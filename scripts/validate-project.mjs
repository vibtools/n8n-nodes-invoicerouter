import { access, readFile, readdir, stat } from 'node:fs/promises';
import { constants } from 'node:fs';
import { execFileSync } from 'node:child_process';

const requiredFiles = [
  'package.json', 'package-lock.json', 'tsconfig.json', '.gitignore', '.gitattributes', '.editorconfig',
  'README.md', 'ARCHITECTURE.md', 'LICENSE', 'CHANGELOG.md', 'VERSION_1_0_FREEZE.md',
  'manifest/freeze-v1.0.json',
  'docs/freeze/v1.0/README.md', 'docs/freeze/v1.0/FINAL_ARCHITECTURE.md',
  'docs/freeze/v1.0/NODE_CONTRACTS.md', 'docs/freeze/v1.0/PROVIDER_SHEET_CONTRACT.md',
  'docs/freeze/v1.0/SECURITY_DECISION.md', 'docs/freeze/v1.0/IMPLEMENTATION_GAP_MATRIX.md',
  'docs/freeze/v1.0/IMPLEMENTATION_ORDER.md', 'docs/freeze/v1.0/NOTION_SOURCE_MAP.md',
  'docs/freeze/v1.0/CLEAN_REPOSITORY_CONTRACT.md', 'docs/freeze/v1.0/IMPLEMENTATION_AUDIT.md',
  'assets/architecture/invoice-router-architecture-v1.0.pdf',
  'assets/architecture/invoice-router-architecture-v1.0.png',
  'examples/google_sheets/InvoiceRouter_20_Provider_Production_Presets_v1.0.xlsx',
  'workflows/InvoiceRouter-v1-production.json',
  'scripts/clean.mjs', 'scripts/format.mjs', 'scripts/lint.mjs', 'scripts/validate-project.mjs',
];

const nodeFolders = [
  ['01_ProviderLoader', 'ProviderLoader'], ['02_ProviderSelector', 'ProviderSelector'],
  ['03_InvoiceTemplate', 'InvoiceTemplate'], ['04_EmailList', 'EmailList'],
  ['05_RequestBuilder', 'RequestBuilder'], ['06_InvoiceSender', 'InvoiceSender'],
  ['07_StatusChecker', 'StatusChecker'], ['08_StatusManager', 'StatusManager'],
];

const requiredDirectories = [
  '.github/workflows', 'assets/architecture', 'assets/node-cards/v1.0', 'docs/freeze/v1.0',
  'examples/google_sheets', 'manifest', 'nodes', 'providers', 'scripts', 'shared', 'tests', 'workflows',
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

for (const path of ['package.json', 'package-lock.json', 'manifest/freeze-v1.0.json', 'workflows/InvoiceRouter-v1-production.json']) {
  try { JSON.parse(await readFile(path, 'utf8')); }
  catch (error) { errors.push(`${path} is invalid JSON: ${error.message}`); }
}

const pkg = JSON.parse(await readFile('package.json', 'utf8'));
const nodes = pkg.n8n?.nodes ?? [];
if (!Array.isArray(nodes) || nodes.length !== 8) errors.push('package.json must register exactly eight frozen custom nodes.');
if (pkg.n8n?.credentials) errors.push('package.json must not register a separate credential type in the Version 1 Sheet-credential flow.');
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
