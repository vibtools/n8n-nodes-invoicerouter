import { createHash } from 'node:crypto';
import { mkdtemp, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { basename, dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';

const TARGET_N8N_VERSION = '2.31.6';
const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const fixturePath = resolve(root, 'tests/fixtures/n8n/InvoiceRouter-Phase-07-Engine-Smoke.json');
const canonicalPath = resolve(root, 'template/providers/odoo/n8n-import-workflow-production-v2.1.1.json');
const evidencePath = resolve(root, process.env.INVOICEROUTER_PHASE07_ENGINE_EVIDENCE || 'evidence/phase07/n8n-engine-smoke.json');
const logPath = resolve(root, process.env.INVOICEROUTER_PHASE07_ENGINE_LOG || 'evidence/phase07/n8n-engine-smoke.log');
const npmRegistry = process.env.INVOICEROUTER_PHASE07_NPM_REGISTRY || 'https://registry.npmjs.org';
const baseEnv = { ...process.env, npm_config_registry: npmRegistry, TERM: process.env.TERM || 'dumb' };

function sha256(value) {
  return createHash('sha256').update(value).digest('hex');
}

async function packageContentSha256(packEntry) {
  const files = Array.isArray(packEntry?.files) ? [...packEntry.files] : [];
  if (files.length === 0) throw new Error('npm pack did not report package file contents.');
  const records = [];
  for (const file of files.sort((a, b) => String(a.path).localeCompare(String(b.path)))) {
    const relative = String(file.path || '').replaceAll('\\', '/');
    if (!relative || relative.includes('..')) throw new Error(`npm pack reported an invalid package path: ${relative}`);
    const content = await readFile(resolve(root, relative));
    records.push(`${relative}\0${sha256(content)}`);
  }
  return sha256(records.join('\n'));
}

function engineBindingSha256(value) {
  return sha256(JSON.stringify({
    targetN8nVersion: value.targetN8nVersion, packageName: value.packageName, packageVersion: value.packageVersion,
    fixtureSha256: value.fixtureSha256, canonicalWorkflowSha256: value.canonicalWorkflowSha256,
    packageContentSha256: value.packageContentSha256, customNodeCount: value.customNodeCount,
    canonicalImportedNodeCount: value.canonicalImportedNodeCount, canonicalImportedEdgeCount: value.canonicalImportedEdgeCount,
    canonicalImportedCustomNodeCount: value.canonicalImportedCustomNodeCount, sideEffects: value.sideEffects,
  }));
}

function commandDisplay(command, args) {
  return [command, ...args].map((value) => /\s/.test(value) ? JSON.stringify(value) : value).join(' ');
}

function run(command, args, options = {}) {
  const result = spawnSync(command, args, {
    cwd: options.cwd ?? root,
    env: options.env ?? process.env,
    encoding: 'utf8',
    maxBuffer: 64 * 1024 * 1024,
    shell: false,
    windowsHide: true,
  });
  const stdout = result.stdout ?? '';
  const stderr = result.stderr ?? '';
  if (result.error || result.status !== 0) {
    const message = result.error?.message || `${commandDisplay(command, args)} exited with status ${result.status}`;
    const error = new Error(`${message}\n${stdout}\n${stderr}`.trim());
    error.result = { command, args, status: result.status, stdout, stderr };
    throw error;
  }
  return { command, args, status: result.status, stdout, stderr };
}

function npmCliPath() {
  const value = String(process.env.npm_execpath || '').trim();
  if (!value) throw new Error('npm_execpath is missing. Run this gate through "npm run verify:phase07:engine".');
  return value;
}

function runNpm(args, options = {}) {
  return run(process.execPath, [npmCliPath(), ...args], { ...options, env: options.env ?? baseEnv });
}

function extractVersion(output) {
  const match = String(output).match(/(?:^|\s)(\d+\.\d+\.\d+)(?:\s|$)/m);
  return match?.[1] ?? '';
}

function countEdges(workflow) {
  let count = 0;
  for (const value of Object.values(workflow.connections ?? {})) {
    for (const groups of Object.values(value ?? {})) for (const group of groups ?? []) count += group.length;
  }
  return count;
}

function validateFixture(fixture) {
  if (fixture?.meta?.invoiceRouterEngineTarget !== TARGET_N8N_VERSION) throw new Error('Engine fixture target version is not pinned to n8n 2.31.6.');
  if (fixture?.meta?.sideEffects !== 'dry-run-only') throw new Error('Engine fixture must be dry-run-only.');
  const custom = (fixture.nodes ?? []).filter((node) => String(node.type).startsWith('n8n-nodes-invoicerouter.'));
  if (custom.length !== 8) throw new Error(`Engine fixture must contain exactly eight InvoiceRouter custom nodes; found ${custom.length}.`);
  const sender = (fixture.nodes ?? []).find((node) => node.name === 'Invoice Sender');
  if (sender?.parameters?.dryRun !== true) throw new Error('Engine fixture Invoice Sender must remain dryRun=true.');
}

function validateCanonical(workflow) {
  const custom = (workflow.nodes ?? []).filter((node) => String(node.type).startsWith('n8n-nodes-invoicerouter.'));
  if (workflow.nodes?.length !== 132 || countEdges(workflow) !== 148 || custom.length !== 8) {
    throw new Error(`Canonical workflow topology mismatch; expected 132 nodes / 148 edges / 8 custom nodes, found ${workflow.nodes?.length ?? 0} / ${countEdges(workflow)} / ${custom.length}.`);
  }
}

await mkdir(dirname(evidencePath), { recursive: true });
const startedAt = new Date().toISOString();
const fixtureBytes = await readFile(fixturePath);
const canonicalBytes = await readFile(canonicalPath);
const fixture = JSON.parse(fixtureBytes.toString('utf8'));
const canonical = JSON.parse(canonicalBytes.toString('utf8'));
validateFixture(fixture);
validateCanonical(canonical);
const packageJson = JSON.parse(await readFile(join(root, 'package.json'), 'utf8'));
const tempRoot = await mkdtemp(join(tmpdir(), 'invoicerouter-phase07-'));
const logs = [];
let evidence;
try {
  logs.push(runNpm(['run', 'build']));
  const packDir = join(tempRoot, 'pack');
  await mkdir(packDir, { recursive: true });
  const pack = runNpm(['pack', '--json', '--ignore-scripts', '--pack-destination', packDir]);
  logs.push(pack);
  const packJson = JSON.parse(pack.stdout);
  const tarballName = packJson[0]?.filename;
  if (!tarballName) throw new Error('npm pack did not report a tarball filename.');
  const tarballPath = join(packDir, basename(tarballName));
  const tarballBytes = await readFile(tarballPath);
  const packedContentSha256 = await packageContentSha256(packJson[0]);

  const engineRoot = join(tempRoot, 'engine');
  await mkdir(engineRoot, { recursive: true });
  await writeFile(join(engineRoot, 'package.json'), JSON.stringify({ private: true }, null, 2));
  logs.push(runNpm(['install', `n8n@${TARGET_N8N_VERSION}`, tarballPath, '--no-audit', '--no-fund', '--save-exact'], { cwd: engineRoot }));
  const installedPackage = join(engineRoot, 'node_modules', packageJson.name);
  const n8nPackage = JSON.parse(await readFile(join(engineRoot, 'node_modules', 'n8n', 'package.json'), 'utf8'));
  const n8nBinRelative = typeof n8nPackage.bin === 'string' ? n8nPackage.bin : n8nPackage.bin?.n8n;
  if (!n8nBinRelative) throw new Error('Installed n8n package does not expose the n8n CLI binary.');
  const n8nBin = join(engineRoot, 'node_modules', 'n8n', n8nBinRelative);

  const versionRun = run(process.execPath, [n8nBin, '--version'], { env: baseEnv });
  logs.push(versionRun);
  const observedVersion = extractVersion(`${versionRun.stdout}\n${versionRun.stderr}`);
  if (observedVersion !== TARGET_N8N_VERSION) throw new Error(`Expected n8n ${TARGET_N8N_VERSION}, observed ${observedVersion || '[unreadable]'}.`);

  const n8nUserFolder = join(tempRoot, 'n8n-user');
  await mkdir(n8nUserFolder, { recursive: true });
  const engineEnv = {
    ...baseEnv,
    N8N_USER_FOLDER: n8nUserFolder,
    N8N_CUSTOM_EXTENSIONS: installedPackage,
    N8N_COMMUNITY_PACKAGES_ENABLED: 'true',
    N8N_UNVERIFIED_PACKAGES_ENABLED: 'true',
    N8N_DIAGNOSTICS_ENABLED: 'false',
    N8N_VERSION_NOTIFICATIONS_ENABLED: 'false',
    N8N_TEMPLATES_ENABLED: 'false',
    N8N_LOG_LEVEL: 'warn',
    N8N_RUNNERS_ENABLED: 'false',
    N8N_ENCRYPTION_KEY: 'InvoiceRouter-Phase07-Engine-Smoke-Only-2026',
    N8N_SECURE_COOKIE: 'false',
  };

  const executeRun = run(process.execPath, [n8nBin, 'execute', '--file', fixturePath], { env: engineEnv });
  logs.push(executeRun);
  const executionLog = `${executeRun.stdout}\n${executeRun.stderr}`;
  if (/unrecognized node type|not found|unknown node/i.test(executionLog)) throw new Error('n8n engine reported an unknown or unloaded node type.');

  const canonicalImportDir = join(tempRoot, 'canonical-import');
  await mkdir(canonicalImportDir, { recursive: true });
  await writeFile(join(canonicalImportDir, basename(canonicalPath)), canonicalBytes);
  const importRun = run(process.execPath, [n8nBin, 'import:workflow', '--separate', '--input', canonicalImportDir], { env: engineEnv });
  logs.push(importRun);
  const exportedPath = join(tempRoot, 'canonical-export.json');
  const exportRun = run(process.execPath, [n8nBin, 'export:workflow', '--all', '--output', exportedPath], { env: engineEnv });
  logs.push(exportRun);
  const exportedRaw = JSON.parse(await readFile(exportedPath, 'utf8'));
  const exportedList = Array.isArray(exportedRaw) ? exportedRaw : [exportedRaw];
  const importedCanonical = exportedList.find((entry) => entry?.name === canonical.name) ?? exportedList[0];
  if (!importedCanonical) throw new Error('n8n did not export the imported canonical workflow.');
  validateCanonical(importedCanonical);
  const importedCustom = importedCanonical.nodes.filter((node) => String(node.type).startsWith('n8n-nodes-invoicerouter.'));

  evidence = {
    schemaVersion: '1.2',
    gate: 'n8n-workflow-engine-smoke',
    status: 'PASS',
    targetN8nVersion: TARGET_N8N_VERSION,
    observedN8nVersion: observedVersion,
    packageName: packageJson.name,
    packageVersion: packageJson.version,
    fixture: 'tests/fixtures/n8n/InvoiceRouter-Phase-07-Engine-Smoke.json',
    fixtureSha256: sha256(fixtureBytes),
    canonicalWorkflow: 'template/providers/odoo/n8n-import-workflow-production-v2.1.1.json',
    canonicalWorkflowSha256: sha256(canonicalBytes),
    packageTarballSha256: sha256(tarballBytes),
    packageContentSha256: packedContentSha256,
    customNodeCount: 8,
    sideEffects: 'dry-run-only',
    executeExitCode: executeRun.status,
    executeLogSha256: sha256(executionLog),
    canonicalImportExitCode: importRun.status,
    canonicalExportExitCode: exportRun.status,
    canonicalImportedNodeCount: importedCanonical.nodes.length,
    canonicalImportedEdgeCount: countEdges(importedCanonical),
    canonicalImportedCustomNodeCount: importedCustom.length,
    canonicalImportLogSha256: sha256(`${importRun.stdout}\n${importRun.stderr}\n${exportRun.stdout}\n${exportRun.stderr}`),
    startedAt,
    completedAt: new Date().toISOString(),
  };
  evidence.engineBindingSha256 = engineBindingSha256(evidence);
} catch (error) {
  const detail = error instanceof Error ? error.message : String(error);
  evidence = {
    schemaVersion: '1.2', gate: 'n8n-workflow-engine-smoke', status: 'FAIL',
    targetN8nVersion: TARGET_N8N_VERSION, packageName: packageJson.name, packageVersion: packageJson.version,
    fixture: 'tests/fixtures/n8n/InvoiceRouter-Phase-07-Engine-Smoke.json', fixtureSha256: sha256(fixtureBytes),
    canonicalWorkflow: 'template/providers/odoo/n8n-import-workflow-production-v2.1.1.json', canonicalWorkflowSha256: sha256(canonicalBytes),
    error: detail.slice(0, 8000), startedAt, completedAt: new Date().toISOString(),
  };
  await writeFile(evidencePath, `${JSON.stringify(evidence, null, 2)}\n`);
  const combinedLog = logs.map((entry) => [`$ ${commandDisplay(entry.command, entry.args)}`, entry.stdout, entry.stderr].join('\n')).join('\n\n');
  await writeFile(logPath, `${combinedLog}\n\nERROR\n${detail}\n`);
  await rm(tempRoot, { recursive: true, force: true });
  console.error(`InvoiceRouter Phase 07 n8n ${TARGET_N8N_VERSION} engine smoke FAILED.`);
  console.error(detail);
  process.exit(1);
}

await writeFile(evidencePath, `${JSON.stringify(evidence, null, 2)}\n`);
const combinedLog = logs.map((entry) => [`$ ${commandDisplay(entry.command, entry.args)}`, entry.stdout, entry.stderr].join('\n')).join('\n\n');
await writeFile(logPath, `${combinedLog}\n`);
await rm(tempRoot, { recursive: true, force: true });
console.log(`InvoiceRouter Phase 07 n8n ${TARGET_N8N_VERSION} workflow-engine smoke PASS.`);
console.log(`Evidence: ${evidencePath}`);
