import { access, readFile, stat } from 'node:fs/promises';
import { constants } from 'node:fs';

const requiredFiles = [
  'package.json',
  'package-lock.json',
  'tsconfig.json',
  '.gitignore',
  '.editorconfig',
  'README.md',
  'LICENSE',
  'CHANGELOG.md',
  'ARCHITECTURE.md',
  'credentials/InvoiceRouterApi.credentials.ts',
  'workflows/google-sheets-real-invoice-router.json',
  'workflows/README.md',
  'manifest/architecture.json',
  'manifest/auto-fix.json',
  'manifest/PROJECT_MANIFEST.json',
];
const requiredDirectories = [
  'assets',
  'credentials',
  'docs',
  'examples',
  'logs',
  'manifest',
  'nodes',
  'providers',
  'scripts',
  'shared',
  'temp',
  'tests',
  'user-docs',
  'workflows',
];
const nodeFolders = [
  '01_ProviderLoader',
  '02_ProviderSelector',
  '03_RequestBuilder',
  '04_InvoiceSender',
  '05_StatusChecker',
];
const nodeFiles = [
  'README.md',
  'index.ts',
  'Node.node.ts',
  'Node.description.ts',
  'Node.execute.ts',
  'Node.types.ts',
  'Node.constants.ts',
  'Node.helpers.ts',
];
const providerFolders = ['stripe', 'lemonsqueezy', 'paddle', 'polar'];
const providerFiles = [
  'README.md',
  'index.ts',
  'Provider.ts',
  'ProviderPayload.ts',
  'ProviderParser.ts',
  'ProviderValidator.ts',
  'ProviderTypes.ts',
  'ProviderConstants.ts',
  'ProviderHelpers.ts',
];

const errors = [];
async function requireFile(path, nonEmpty = true) {
  try {
    await access(path, constants.R_OK);
    if (nonEmpty && (await stat(path)).size === 0) errors.push(`${path} is empty`);
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
for (const folder of nodeFolders) {
  for (const file of nodeFiles) await requireFile(`nodes/${folder}/${file}`);
}
for (const folder of providerFolders) {
  for (const file of providerFiles) await requireFile(`providers/${folder}/${file}`);
}

const jsonFiles = [
  'package.json',
  'package-lock.json',
  'workflows/google-sheets-real-invoice-router.json',
  'manifest/architecture.json',
  'manifest/auto-fix.json',
  'manifest/PROJECT_MANIFEST.json',
];
for (const path of jsonFiles) {
  try {
    JSON.parse(await readFile(path, 'utf8'));
  } catch (error) {
    errors.push(`${path} is invalid JSON: ${error.message}`);
  }
}

const pkg = JSON.parse(await readFile('package.json', 'utf8'));
if (!Array.isArray(pkg.n8n?.credentials) || pkg.n8n.credentials.length === 0) {
  errors.push('package.json must register at least one n8n credential.');
}
if (!Array.isArray(pkg.n8n?.nodes) || pkg.n8n.nodes.length !== 5) {
  errors.push('package.json must register all five InvoiceRouter nodes.');
}

if (errors.length) {
  console.error('Project validation failed:');
  for (const error of errors) console.error(`- ${error}`);
  process.exit(1);
}
console.log('Project validation passed.');
