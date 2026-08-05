import { createHash } from 'node:crypto';
import { access, mkdir, readFile, writeFile } from 'node:fs/promises';
import { constants } from 'node:fs';
import { dirname, extname, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const staticOnly = process.argv.includes('--static-only');
const TARGET_N8N_VERSION = '2.31.6';
const EXPECTED_WORKFLOW_NODES = 126;
const EXPECTED_WORKFLOW_EDGES = 141;
const errors = [];
const SHA256 = /^[a-f0-9]{64}$/i;
const EMAIL = /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/i;

async function exists(path) {
  try { await access(resolve(root, path), constants.R_OK); return true; } catch { return false; }
}
async function text(path) { return readFile(resolve(root, path), 'utf8'); }
async function bytes(path) { return readFile(resolve(root, path)); }
async function json(path) { return JSON.parse(await text(path)); }
function sha256(value) { return createHash('sha256').update(value).digest('hex'); }
function requireValue(condition, message) { if (!condition) errors.push(message); }

function engineBindingSha256(value) {
  return sha256(JSON.stringify({
    targetN8nVersion: value.targetN8nVersion, packageName: value.packageName, packageVersion: value.packageVersion,
    fixtureSha256: value.fixtureSha256, canonicalWorkflowSha256: value.canonicalWorkflowSha256,
    packageContentSha256: value.packageContentSha256, customNodeCount: value.customNodeCount,
    canonicalImportedNodeCount: value.canonicalImportedNodeCount, canonicalImportedEdgeCount: value.canonicalImportedEdgeCount,
    canonicalImportedCustomNodeCount: value.canonicalImportedCustomNodeCount, sideEffects: value.sideEffects,
  }));
}

function isIsoTimestamp(value) { return typeof value === 'string' && value.length > 0 && Number.isFinite(Date.parse(value)); }
function countEdges(workflow) {
  let count = 0;
  for (const value of Object.values(workflow.connections ?? {})) {
    for (const groups of Object.values(value ?? {})) for (const group of groups ?? []) count += group.length;
  }
  return count;
}
function inspectEvidence(value, location = 'root') {
  if (Array.isArray(value)) return value.forEach((entry, index) => inspectEvidence(entry, `${location}[${index}]`));
  if (typeof value === 'string') {
    if (EMAIL.test(value)) errors.push(`Evidence must not contain an email address at ${location}.`);
    if (/(?:password|api[_ -]?key|api[_ -]?secret|authorization|cookie|access[_ -]?token|refresh[_ -]?token)\s*[:=]\s*\S+/i.test(value)) {
      errors.push(`Evidence contains secret-like text at ${location}.`);
    }
    return;
  }
  if (!value || typeof value !== 'object') return;
  for (const [key, entry] of Object.entries(value)) {
    if (/(password|api.?key|api.?secret|authorization|cookie|credential|access.?token|refresh.?token)/i.test(key)) {
      errors.push(`Evidence must not contain secret-bearing key ${location}.${key}.`);
    }
    inspectEvidence(entry, `${location}.${key}`);
  }
}
async function validateArtifacts(value, label) {
  requireValue(Array.isArray(value) && value.length > 0, `${label} must reference at least one sanitized evidence artifact.`);
  if (!Array.isArray(value)) return;
  const artifactRoot = resolve(root, 'evidence/phase07/artifacts');
  const allowedExtensions = new Set(['.json', '.txt', '.log', '.md']);
  for (const [index, artifact] of value.entries()) {
    requireValue(artifact && typeof artifact === 'object', `${label}[${index}] must be an object.`);
    if (!artifact || typeof artifact !== 'object') continue;
    const name = String(artifact.name ?? '').trim().replaceAll('\\', '/');
    const expected = String(artifact.sha256 ?? '').trim().toLowerCase();
    requireValue(name.length > 0 && !name.startsWith('/') && !name.includes('..'), `${label}[${index}].name is invalid.`);
    requireValue(SHA256.test(expected), `${label}[${index}].sha256 must be a SHA-256 digest.`);
    const artifactPath = resolve(artifactRoot, name);
    const containment = relative(artifactRoot, artifactPath);
    requireValue(containment.length > 0 && !containment.startsWith('..') && !containment.includes(':') && !containment.startsWith('/'), `${label}[${index}] must remain inside evidence/phase07/artifacts.`);
    requireValue(allowedExtensions.has(extname(artifactPath).toLowerCase()), `${label}[${index}] must use a sanitized JSON, TXT, LOG, or MD artifact.`);
    if (!(await exists(relative(root, artifactPath)))) {
      errors.push(`${label}[${index}] artifact file is missing: evidence/phase07/artifacts/${name}.`);
      continue;
    }
    const artifactBytes = await readFile(artifactPath);
    requireValue(sha256(artifactBytes) === expected, `${label}[${index}] artifact hash mismatch for ${name}.`);
    const artifactText = artifactBytes.toString('utf8');
    inspectEvidence(artifactText, `${label}[${index}].content`);
    if (extname(artifactPath).toLowerCase() === '.json') {
      try { inspectEvidence(JSON.parse(artifactText), `${label}[${index}].json`); }
      catch { errors.push(`${label}[${index}] JSON artifact is invalid: ${name}.`); }
    }
  }
}
function validateReview(value, label) {
  requireValue(typeof value.reviewedBy === 'string' && value.reviewedBy.trim().length >= 2 && !EMAIL.test(value.reviewedBy), `${label} reviewedBy must contain a reviewer name, not an email address.`);
  requireValue(isIsoTimestamp(value.reviewedAt), `${label} reviewedAt must be an ISO timestamp.`);
}

const pkg = await json('package.json');
const workflowBytes = await bytes('template/providers/odoo/n8n-import-workflow-production-v2.1.1.json');
const liveBytes = await bytes('template/providers/odoo/n8n-import-workflow-live-bulk.json');
const workflow = JSON.parse(workflowBytes.toString('utf8'));
const engineFixtureBytes = await bytes('tests/fixtures/n8n/InvoiceRouter-Phase-07-Engine-Smoke.json');
const engineFixture = JSON.parse(engineFixtureBytes.toString('utf8'));
const canonicalHash = sha256(workflowBytes);
const customNodes = workflow.nodes.filter((node) => String(node.type).startsWith('n8n-nodes-invoicerouter.'));
const workflowEdges = countEdges(workflow);

requireValue(pkg.version === '2.1.1', 'Package version must remain 2.1.1.');
requireValue(customNodes.length === 8, `Canonical workflow must contain 8 custom nodes; found ${customNodes.length}.`);
requireValue(workflow.nodes.length === EXPECTED_WORKFLOW_NODES && workflowEdges === EXPECTED_WORKFLOW_EDGES, `Canonical workflow topology must remain ${EXPECTED_WORKFLOW_NODES} nodes / ${EXPECTED_WORKFLOW_EDGES} edges; found ${workflow.nodes.length} / ${workflowEdges}.`);
requireValue(Buffer.compare(workflowBytes, liveBytes) === 0, 'Canonical and live-bulk workflows must remain byte-identical.');
requireValue(workflow.meta?.invoiceRouterHardeningPhase === 'phase-07-final-corrective-audit', 'Canonical workflow final corrective-audit metadata is missing.');
requireValue(workflow.meta?.invoiceRouterFinalCorrectiveAudit === true, 'Canonical workflow final corrective-audit flag is missing.');
requireValue(engineFixture.meta?.invoiceRouterEngineTarget === TARGET_N8N_VERSION, 'Engine fixture must target n8n 2.31.6.');
requireValue(engineFixture.meta?.sideEffects === 'dry-run-only', 'Engine fixture must remain dry-run-only.');
requireValue(engineFixture.nodes.filter((node) => String(node.type).startsWith('n8n-nodes-invoicerouter.')).length === 8, 'Engine fixture must contain all eight custom nodes.');
requireValue(engineFixture.nodes.find((node) => node.name === 'Invoice Sender')?.parameters?.dryRun === true, 'Engine fixture Invoice Sender must remain dryRun=true.');

for (const major of [18, 19]) {
  const fixture = await json(`tests/fixtures/odoo/odoo-${major}-phase07-e2e.json`);
  requireValue(fixture.majorVersion === major, `Odoo ${major} fixture majorVersion mismatch.`);
  requireValue(fixture.expected?.capabilityProfileId === `odoo-${major}-invoice-send`, `Odoo ${major} fixture capability profile mismatch.`);
  requireValue(fixture.expected?.emailSendStatus === 'SENT', `Odoo ${major} fixture must expect evidence-backed SENT.`);
  requireValue(fixture.expected?.pdfEvidenceStatus === 'VALID', `Odoo ${major} fixture must expect VALID PDF evidence.`);
}

for (const path of [
  'evidence/phase07/n8n-engine-smoke.template.json',
  'evidence/phase07/canary-evidence.template.json',
  'evidence/phase07/pilot-evidence.template.json',
  'evidence/phase07/README.md',
  'docs/developer/phase07-final-release-gate.md',
]) requireValue(await exists(path), `${path} is missing.`);

requireValue(pkg.scripts?.['verify:phase07:static'] === 'node scripts/phase07-final-release-gate.mjs --static-only', 'package.json Phase 07 static gate script is missing.');
requireValue(pkg.scripts?.['verify:phase07:engine'] === 'node scripts/phase07-n8n-engine-smoke.mjs', 'package.json Phase 07 engine script is missing.');
requireValue(pkg.scripts?.['verify:phase07:evidence'] === 'node scripts/phase07-final-release-gate.mjs', 'package.json Phase 07 evidence script is missing.');
const redaction = await text('shared/security/Redaction.ts');
requireValue(redaction.includes('replaceShortSecret') && redaction.includes('Short alphanumeric secrets'), 'Length/boundary-aware short-secret redaction is missing.');
const ci = await text('.github/workflows/ci.yml');
const release = await text('.github/workflows/release.yml');
requireValue(ci.includes('verify:phase07:engine'), 'CI must execute the exact n8n Phase 07 engine smoke.');
requireValue(!release.includes('run: npm run verify:phase07:evidence'), 'Tag release must not require post-publication live evidence before GitHub/npm publication.');
requireValue(release.includes('NPM_TOKEN is required for a tag release'), 'Tag release must fail closed when NPM_TOKEN is missing.');
requireValue(release.includes('npm whoami --registry=https://registry.npmjs.org'), 'Tag release must validate npm credentials before creating a GitHub release.');
requireValue(release.indexOf('Validate npm publication credentials') < release.indexOf('Create GitHub Release'), 'npm credential validation must run before GitHub release creation.');
const engineScript = await text('scripts/phase07-n8n-engine-smoke.mjs');
requireValue(engineScript.includes('npm_execpath') && engineScript.includes('process.execPath'), 'Engine smoke must use the cross-platform Node/npm CLI launcher.');
requireValue(engineScript.includes("'import:workflow'") && engineScript.includes("'export:workflow'"), 'Engine smoke must import/export the complete canonical workflow.');
requireValue(!engineScript.includes("tarballPath, '--ignore-scripts'"), 'Exact n8n installation must allow required dependency install scripts.');
const durableCode = workflow.nodes.find((node) => node.name === 'Build Durable Work Items')?.parameters?.jsCode ?? '';
requireValue(durableCode.includes('providerPendingByJob') && durableCode.includes('operationRecovery:providerPending') && durableCode.includes('latestWritebackByRepair'), 'PROVIDER_PENDING startup reconciliation is missing.');
const pendingCode = workflow.nodes.find((node) => node.name === 'Prepare Provider Operation Envelope')?.parameters?.jsCode ?? '';
requireValue(pendingCode.includes('ready.invoice') && pendingCode.includes('cannot enter PROVIDER_PENDING without a stable provider reference'), 'Pre-provider envelope must persist the exact built stable reference.');
for (const name of ['Google Sheets - Provider Lease Verify', 'Verify Provider Lease Before Side Effect']) requireValue(Boolean(workflow.nodes.find((node) => node.name === name)), `${name} is missing.`);

if (!staticOnly) {
  const requiredEvidence = {
    engine: 'evidence/phase07/n8n-engine-smoke.json',
    canary: 'evidence/phase07/canary-evidence.json',
    pilot: 'evidence/phase07/pilot-evidence.json',
  };
  for (const path of Object.values(requiredEvidence)) requireValue(await exists(path), `${path} is required for the final release gate.`);

  let engine = null;
  if (await exists(requiredEvidence.engine)) {
    const engineBytes = await bytes(requiredEvidence.engine);
    engine = JSON.parse(engineBytes.toString('utf8'));
    inspectEvidence(engine, 'engine');
    requireValue(engine.status === 'PASS', 'n8n engine evidence status must be PASS.');
    requireValue(engine.targetN8nVersion === TARGET_N8N_VERSION && engine.observedN8nVersion === TARGET_N8N_VERSION, 'n8n engine evidence must prove exact version 2.31.6.');
    requireValue(engine.packageVersion === pkg.version, 'n8n engine evidence package version mismatch.');
    requireValue(engine.fixtureSha256 === sha256(engineFixtureBytes), 'n8n engine evidence fixture hash is stale.');
    requireValue(engine.canonicalWorkflowSha256 === canonicalHash, 'n8n engine evidence canonical workflow hash is stale.');
    requireValue(SHA256.test(String(engine.packageTarballSha256 ?? '')), 'n8n engine evidence package tarball hash is missing.');
    requireValue(SHA256.test(String(engine.packageContentSha256 ?? '')), 'n8n engine evidence deterministic package-content hash is missing.');
    requireValue(engine.engineBindingSha256 === engineBindingSha256(engine), 'n8n engine deterministic binding digest is invalid.');
    requireValue(engine.customNodeCount === 8 && engine.sideEffects === 'dry-run-only', 'n8n engine evidence must prove eight-node dry-run execution.');
    requireValue(engine.canonicalImportedNodeCount === EXPECTED_WORKFLOW_NODES && engine.canonicalImportedEdgeCount === EXPECTED_WORKFLOW_EDGES && engine.canonicalImportedCustomNodeCount === 8, 'n8n engine evidence must prove the complete canonical workflow import/export topology.');
  }

  if (await exists(requiredEvidence.canary)) {
    const canary = await json(requiredEvidence.canary);
    inspectEvidence(canary, 'canary');
    requireValue(canary.status === 'PASS' && canary.approvalStatus === 'PASS', 'Canary evidence must be explicitly approved PASS.');
    requireValue(canary.packageVersion === pkg.version && canary.n8nVersion === TARGET_N8N_VERSION, 'Canary package/n8n version mismatch.');
    requireValue(SHA256.test(String(canary.campaignIdHash ?? '')) && SHA256.test(String(canary.recipientHash ?? '')), 'Canary campaign and recipient identifiers must be SHA-256 hashes.');
    requireValue(canary.canonicalWorkflowSha256 === canonicalHash, 'Canary canonical workflow hash mismatch.');
    requireValue(Boolean(engine) && canary.engineBindingSha256 === engine?.engineBindingSha256, 'Canary deterministic engine binding mismatch.');
    requireValue(Boolean(engine) && canary.packageContentSha256 === engine?.packageContentSha256, 'Canary package content must match the engine-tested package.');
    requireValue(canary.recipientCount === 1 && canary.invoiceCount === 1 && canary.duplicateInvoiceCount === 0, 'Canary must prove one recipient, one invoice, and zero duplicates.');
    requireValue(canary.invoicePosted === true && canary.providerEmailStatus === 'SENT', 'Canary must prove a posted invoice and provider-side SENT evidence.');
    requireValue(canary.pdfAttachmentValid === true && canary.inboxDeliveryConfirmed === true, 'Canary must prove valid PDF evidence and manual inbox delivery confirmation.');
    requireValue(canary.sheetWritebackMatches === true && canary.operationEnvelopeComplete === true, 'Canary must prove matching Sheet writeback and COMPLETE operation envelope.');
    requireValue(canary.rowIdStable === true && canary.profileIdStable === true, 'Canary must prove stable Row_ID and Profile_ID identity.');
    await validateArtifacts(canary.evidenceArtifacts, 'Canary evidenceArtifacts');
    validateReview(canary, 'Canary');
  }

  if (await exists(requiredEvidence.pilot)) {
    const pilot = await json(requiredEvidence.pilot);
    inspectEvidence(pilot, 'pilot');
    requireValue(pilot.status === 'PASS' && pilot.approvalStatus === 'PASS', 'Pilot evidence must be explicitly approved PASS.');
    requireValue(pilot.packageVersion === pkg.version && pilot.n8nVersion === TARGET_N8N_VERSION, 'Pilot package/n8n version mismatch.');
    requireValue(SHA256.test(String(pilot.campaignIdHash ?? '')), 'Pilot campaign identifier must be a SHA-256 hash.');
    requireValue(pilot.canonicalWorkflowSha256 === canonicalHash, 'Pilot canonical workflow hash mismatch.');
    requireValue(Boolean(engine) && pilot.engineBindingSha256 === engine?.engineBindingSha256, 'Pilot deterministic engine binding mismatch.');
    requireValue(Boolean(engine) && pilot.packageContentSha256 === engine?.packageContentSha256, 'Pilot package content must match the engine-tested package.');
    requireValue(pilot.recipientCount === 5 && pilot.terminalRecipientCount === 5, 'Pilot must prove five recipients and five terminal rows.');
    requireValue(pilot.providerAccountCount >= 2 && pilot.failoverExercised === true, 'Pilot must exercise at least two accounts and a failover path.');
    requireValue(pilot.invoiceCount === 5 && pilot.duplicateInvoiceCount === 0, 'Pilot must prove five invoices and zero duplicates.');
    requireValue(pilot.providerSentCount === 5 && pilot.inboxDeliveryConfirmedCount === 5, 'Pilot must prove five provider SENT results and five inbox confirmations.');
    requireValue(pilot.completeOperationEnvelopeCount === 5 && pilot.sheetWritebackMismatchCount === 0, 'Pilot operation envelopes/writebacks are incomplete or mismatched.');
    requireValue(pilot.staleWriterRejectionCount >= 1 && pilot.revisionRegressionCount === 0, 'Pilot must exercise stale-writer rejection without revision regression.');
    requireValue(pilot.restartOrWorkerResumeExercised === true, 'Pilot must exercise restart or other-worker resume.');
    requireValue(pilot.issuerMismatchBlocked === true, 'Pilot must prove issuer-mismatch fail-closed behavior.');
    requireValue(pilot.rowIdCollisionCount === 0 && pilot.profileIdMismatchCount === 0, 'Pilot must prove zero Row_ID collisions and zero Profile_ID writeback mismatches.');
    await validateArtifacts(pilot.evidenceArtifacts, 'Pilot evidenceArtifacts');
    validateReview(pilot, 'Pilot');
  }
}

if (errors.length > 0) {
  console.error(`InvoiceRouter Phase 07 ${staticOnly ? 'static' : 'final release'} gate FAILED:`);
  for (const error of errors) console.error(`- ${error}`);
  process.exit(1);
}

if (staticOnly) {
  console.log('InvoiceRouter Phase 07 static final-release prerequisites PASS.');
  console.log('Live canary/pilot evidence remains intentionally PENDING and is not fabricated by this gate.');
} else {
  const output = resolve(root, 'evidence/phase07/final-release-gate.json');
  await mkdir(dirname(output), { recursive: true });
  const result = {
    schemaVersion: '1.2', gate: 'InvoiceRouter-v2.1.1-final-release', status: 'PASS',
    packageVersion: pkg.version, n8nVersion: TARGET_N8N_VERSION,
    canonicalWorkflowSha256: canonicalHash, engineFixtureSha256: sha256(engineFixtureBytes),
    customNodeCount: 8, workflowNodes: EXPECTED_WORKFLOW_NODES, workflowEdges: EXPECTED_WORKFLOW_EDGES,
    engineEvidenceSha256: sha256(await bytes('evidence/phase07/n8n-engine-smoke.json')),
    canaryEvidenceSha256: sha256(await bytes('evidence/phase07/canary-evidence.json')),
    pilotEvidenceSha256: sha256(await bytes('evidence/phase07/pilot-evidence.json')),
    completedAt: new Date().toISOString(),
  };
  await writeFile(output, `${JSON.stringify(result, null, 2)}\n`);
  console.log('InvoiceRouter v2.1.1 Phase 07 FINAL RELEASE FORENSIC GATE PASS.');
  console.log(`Evidence: ${output}`);
}
