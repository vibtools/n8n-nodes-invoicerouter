import { access, readFile, stat } from 'node:fs/promises';
import { constants } from 'node:fs';
import { execFileSync } from 'node:child_process';

const requiredFiles = [
  'package.json',
  'package-lock.json',
  'tsconfig.json',
  '.gitignore',
  '.gitattributes',
  '.editorconfig',
  'README.md',
  'ARCHITECTURE.md',
  'LICENSE',
  'CHANGELOG.md',
  'VERSION_1_0_FREEZE.md',
  'manifest/freeze-v1.0.json',
  'docs/freeze/v1.0/README.md',
  'docs/freeze/v1.0/FINAL_ARCHITECTURE.md',
  'docs/freeze/v1.0/NODE_CONTRACTS.md',
  'docs/freeze/v1.0/PROVIDER_SHEET_CONTRACT.md',
  'docs/freeze/v1.0/SECURITY_DECISION.md',
  'docs/freeze/v1.0/IMPLEMENTATION_GAP_MATRIX.md',
  'docs/freeze/v1.0/IMPLEMENTATION_ORDER.md',
  'docs/freeze/v1.0/NOTION_SOURCE_MAP.md',
  'docs/freeze/v1.0/CLEAN_REPOSITORY_CONTRACT.md',
  'assets/architecture/invoice-router-architecture-v1.0.pdf',
  'assets/architecture/invoice-router-architecture-v1.0.png',
  'examples/google_sheets/InvoiceRouter_20_Provider_Production_Presets_v1.0.xlsx',
  'scripts/clean.mjs',
  'scripts/format.mjs',
  'scripts/lint.mjs',
  'scripts/validate-project.mjs',
];

const requiredDirectories = [
  '.github/workflows',
  'assets/architecture',
  'assets/node-cards/v1.0',
  'credentials',
  'docs/freeze/v1.0',
  'examples/google_sheets',
  'manifest',
  'nodes',
  'providers',
  'scripts',
  'shared',
  'tests',
];

const forbiddenPaths = [
  'COPY_LOCAL_NODE_ASSETS.cmd',
  'INSTALL.md',
  'FORENSIC_AUDIT.md',
  'PRODUCTION_GUIDE.md',
  'user-docs',
  'workflows',
  'manifest/PROJECT_MANIFEST.json',
  'manifest/architecture.json',
  'manifest/auto-fix.json',
  'manifest/release.json',
  'docs/Feature-Freeze.md',
  'scripts/fixers',
  'scripts/auto-fix.ps1',
  'scripts/bootstrap.ps1',
  '.github/workflows/01-bootstrap.yml',
  '.github/workflows/02-build.yml',
  '.github/workflows/03-docs.yml',
  '.github/workflows/04-release.yml',
];

const baselineNodeFolders = [
  '01_ProviderLoader',
  '02_ProviderSelector',
  '03_RequestBuilder',
  '04_InvoiceSender',
  '05_StatusChecker',
];

const errors = [];
async function exists(path) {
  try {
    await access(path, constants.F_OK);
    return true;
  } catch {
    return false;
  }
}
async function requireFile(path) {
  try {
    await access(path, constants.R_OK);
    if ((await stat(path)).size === 0) errors.push(`${path} is empty`);
  } catch {
    errors.push(`${path} is missing`);
  }
}
async function requireDirectory(path) {
  try {
    if (!(await stat(path)).isDirectory()) errors.push(`${path} is not a directory`);
  } catch {
    errors.push(`${path} directory is missing`);
  }
}

for (const path of requiredFiles) await requireFile(path);
for (const path of requiredDirectories) await requireDirectory(path);
for (const path of forbiddenPaths) {
  if (await exists(path)) errors.push(`legacy path must be removed: ${path}`);
}
for (const folder of baselineNodeFolders) {
  await requireFile(`nodes/${folder}/Node.node.ts`);
}

for (const path of ['package.json', 'package-lock.json', 'manifest/freeze-v1.0.json']) {
  try {
    JSON.parse(await readFile(path, 'utf8'));
  } catch (error) {
    errors.push(`${path} is invalid JSON: ${error.message}`);
  }
}

const pkg = JSON.parse(await readFile('package.json', 'utf8'));
const registeredNodes = pkg.n8n?.nodes ?? [];
if (!Array.isArray(registeredNodes) || ![5, 8].includes(registeredNodes.length)) {
  errors.push('package.json must register the five-node migration baseline or the final eight nodes.');
}
if (pkg.invoiceRouterFreeze?.targetNodeCount !== 8) {
  errors.push('package.json frozen targetNodeCount must be 8.');
}

try {
  const trackedDist = execFileSync('git', ['ls-files', 'dist'], { encoding: 'utf8' }).trim();
  if (trackedDist) errors.push('dist/ contains tracked files; generated output must not be committed.');
  const trackedPs1 = execFileSync('git', ['ls-files', 'scripts/*.ps1', 'scripts/fixers/**'], { encoding: 'utf8' }).trim();
  if (trackedPs1) errors.push('legacy PowerShell automation is still tracked.');
} catch {
  // Validation can still run in an unpacked npm source tree without Git metadata.
}

if (errors.length) {
  console.error('Project validation failed:');
  for (const error of errors) console.error(`- ${error}`);
  process.exit(1);
}
console.log(`Project validation passed. Registered nodes: ${registeredNodes.length}/8.`);
