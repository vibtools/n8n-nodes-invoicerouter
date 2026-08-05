import { access, readFile, readdir, stat } from 'node:fs/promises';
import { constants } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { extname, join } from 'node:path';

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
  'scripts/diagnose-n8n-package.mjs', 'scripts/audit-release-source.mjs',
  'scripts/phase07-n8n-engine-smoke.mjs', 'scripts/phase07-final-release-gate.mjs',
  'workflows/InvoiceRouter-v1.6-simple-bulk-email.json', 'workflows/InvoiceRouter-v2-master-universal.json',
  'docs/user/provider-support-matrix.md', 'docs/user/providers/odoo-complete-bulk-email.md',
  'docs/developer/odoo-email-evidence-contract.md', 'docs/developer/lifecycle-retry-resume.md',
  'docs/troubleshooting/index.md', 'docs/troubleshooting/odoo-email-sending.md',
  'template/providers/odoo/README.md', 'template/providers/odoo/QUICKSTART.md',
  'template/providers/odoo/ODOO_SETUP.md', 'template/providers/odoo/TROUBLESHOOTING.md',
  'template/providers/odoo/LIVE_TEST_CHECKLIST.md', 'template/providers/odoo/email_list.csv',
  'template/providers/odoo/account_report.csv', 'template/providers/odoo/campaign_report.csv',
  'template/providers/odoo/n8n-import-workflow-production-v2.1.1.json',
  'template/providers/odoo/n8n-import-workflow-live-bulk.json',
  'template/providers/odoo/provider.lifecycle.json', 'template/providers/odoo/provider.recipe.json',
  'tests/helpers/phase07-runtime-worker.cjs',
  'tests/fixtures/n8n/InvoiceRouter-Phase-07-Engine-Smoke.json',
  'tests/fixtures/odoo/odoo-18-phase07-e2e.json', 'tests/fixtures/odoo/odoo-19-phase07-e2e.json',
  'evidence/phase07/README.md', 'evidence/phase07/n8n-engine-smoke.template.json',
  'evidence/phase07/canary-evidence.template.json', 'evidence/phase07/pilot-evidence.template.json',
  'docs/developer/phase07-final-release-gate.md',
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
  'docs/user', 'docs/developer', 'docs/troubleshooting', 'template/providers/odoo',
  'tests/helpers', 'tests/fixtures/n8n', 'tests/fixtures/odoo', 'evidence/phase07',
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

async function walkFiles(directory, output = []) {
  if (!(await exists(directory))) return output;
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) await walkFiles(path, output);
    else output.push(path);
  }
  return output;
}

async function requireText(path, fragments) {
  const source = await readFile(path, 'utf8');
  for (const fragment of fragments) {
    if (!source.includes(fragment)) errors.push(`${path} must document ${fragment}`);
  }
  return source;
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

for (const path of ['package.json', 'package-lock.json', 'manifest/freeze-v1.0.json', 'workflows/InvoiceRouter-v1-production.json', 'workflows/InvoiceRouter-v1.6-simple-bulk-email.json', 'workflows/InvoiceRouter-v2-master-universal.json', 'template/providers/odoo/provider.lifecycle.json', 'template/providers/odoo/provider.recipe.json']) {
  try { JSON.parse(await readFile(path, 'utf8')); }
  catch (error) { errors.push(`${path} is invalid JSON: ${error.message}`); }
}

const pkg = JSON.parse(await readFile('package.json', 'utf8'));
const packageLock = JSON.parse(await readFile('package-lock.json', 'utf8'));
const vibProject = JSON.parse(await readFile('vibproject.ygit', 'utf8'));
const docsManifest = JSON.parse(await readFile('docs/docs.minifest.ygit', 'utf8'));
const readmeSource = await readFile('README.md', 'utf8');
const changelogSource = await readFile('CHANGELOG.md', 'utf8');

if (pkg.version !== '2.1.1') errors.push('package.json must use approved release version 2.1.1.');
if (packageLock.version !== pkg.version || packageLock.packages?.['']?.version !== pkg.version) errors.push('package-lock.json version must match package.json.');
if (vibProject.project?.version !== pkg.version || vibProject.release?.latestVersion !== pkg.version) errors.push('vibproject.ygit release metadata must match package.json.');
if (docsManifest.versions?.current !== pkg.version || docsManifest.versions?.latest !== pkg.version || !docsManifest.versions?.available?.includes(pkg.version)) errors.push('docs/docs.minifest.ygit version metadata must include the package release.');
if (!readmeSource.includes(`**Package version:** \`${pkg.version}\``)) errors.push('README.md current package version must match package.json.');
if (!changelogSource.includes(`## ${pkg.version} - 2026-08-03`)) errors.push('CHANGELOG.md must contain the dated 2.1.1 release entry.');
if (!(pkg.files ?? []).includes('docs/troubleshooting')) errors.push('package.json must include docs/troubleshooting in npm files.');
for (const providerId of ['odoo', 'stripe', 'zoho-books']) {
  const manifest = JSON.parse(await readFile(`template/providers/${providerId}/provider.template.ygit`, 'utf8'));
  if (manifest.invoiceRouterVersion !== pkg.version) errors.push(`${providerId} provider template invoiceRouterVersion must match package.json.`);
}
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


const workflowJsonFiles = (await walkFiles('workflows'))
  .concat(await walkFiles('template/providers'))
  .filter((path) => extname(path) === '.json' && (/workflow/i.test(path) || /N8N_IMPORT/i.test(path)));
for (const path of workflowJsonFiles) {
  const source = await readFile(path, 'utf8');
  try { JSON.parse(source); } catch (error) { errors.push(`${path} is invalid JSON: ${error.message}`); continue; }
  if (/=\{(?!\{)\s*\$/.test(source)) errors.push(`${path} contains malformed n8n expression syntax; use ={{ ... }}.`);
}

const consumerEmailPattern = /[A-Z0-9._%+-]+@(gmail|yahoo|outlook|hotmail|icloud|protonmail|proton)\.[A-Z]{2,}/gi;
const publicTextFiles = (await walkFiles('template'))
  .concat(await walkFiles('examples'))
  .filter((path) => ['.csv', '.json', '.md', '.txt', '.yml', '.yaml'].includes(extname(path).toLowerCase()));
for (const path of publicTextFiles) {
  const source = await readFile(path, 'utf8');
  const matches = source.match(consumerEmailPattern) ?? [];
  if (matches.length > 0) errors.push(`${path} contains personal-looking public sample email(s): ${[...new Set(matches)].join(', ')}`);
}

const odooSample = await readFile('template/providers/odoo/email_list.csv', 'utf8');
if (!odooSample.includes('customer@example.com')) errors.push('Odoo public email_list sample must use customer@example.com.');

const odooLifecycle = JSON.parse(await readFile('template/providers/odoo/provider.lifecycle.json', 'utf8'));
for (const status of ['QUEUED', 'SENT', 'FAILED', 'UNVERIFIED']) {
  if (!odooLifecycle.emailStatusContract?.[status]) errors.push(`Odoo lifecycle template must define emailStatusContract.${status}.`);
}
for (const field of ['email_evidence', 'lifecycle_outcome', 'lifecycle_failed_step', 'lifecycle_checkpoint', 'retry_resume_stage', 'retry_resume']) {
  if (!odooLifecycle.writebackFields?.includes(field)) errors.push(`Odoo lifecycle template writebackFields must include ${field}.`);
}
if (odooLifecycle.runtime?.emailSendModel !== 'account.move.send.wizard') errors.push('Odoo lifecycle runtime must document account.move.send.wizard.');

const odooProductionWorkflow = JSON.parse(await readFile('template/providers/odoo/n8n-import-workflow-production-v2.1.1.json', 'utf8'));
const odooLiveBulkWorkflow = await readFile('template/providers/odoo/n8n-import-workflow-live-bulk.json', 'utf8');
const odooProductionWorkflowSource = JSON.stringify(odooProductionWorkflow, null, 2) + '\n';
if (odooLiveBulkWorkflow !== odooProductionWorkflowSource) errors.push('Odoo canonical and live-bulk workflows must remain byte-identical.');
if (odooProductionWorkflow.meta?.invoiceRouterHardeningPhase !== 'phase-07-final-corrective-audit') errors.push('Odoo workflow must declare the Phase 07 final release boundary.');
if (odooProductionWorkflow.meta?.invoiceRouterN8nEngineTarget !== '2.31.6') errors.push('Odoo workflow must pin the Phase 07 n8n engine target to 2.31.6.');
if (odooProductionWorkflow.meta?.invoiceRouterFinalReleaseGate !== true || odooProductionWorkflow.meta?.invoiceRouterLiveEvidenceRequired !== true) errors.push('Odoo workflow must require the Phase 07 final release and live evidence gates.');
if (odooProductionWorkflow.meta?.invoiceRouterFinalCorrectiveAudit !== true) errors.push('Odoo workflow must declare the final corrective audit flag.');
for (const flag of ['invoiceRouterMonotonicReporting', 'invoiceRouterStaleWriterProtection', 'invoiceRouterDurableAggregateRebuild', 'invoiceRouterIssuerMismatchReporting']) {
  if (odooProductionWorkflow.meta?.[flag] !== true) errors.push(`Odoo workflow meta must enable ${flag}.`);
}
const odooNodesByName = Object.fromEntries((odooProductionWorkflow.nodes ?? []).map((node) => [node.name, node]));
for (const name of [
  'Google Sheets - Campaign Report Revision Read', 'Verify Campaign Report Revision',
  'Google Sheets - Account Report Revision Read', 'Verify Account Report Revision',
  'Google Sheets - Issuer Mismatch Account Report Read', 'Prepare Issuer Mismatch Account Report',
  'Google Sheets - Issuer Mismatch Account Report',
]) {
  if (!odooNodesByName[name]) errors.push(`Odoo Phase 06 workflow must include ${name}.`);
}
for (const name of ['Google Sheets - Campaign Report', 'Google Sheets - Account Report', 'Google Sheets - Issuer Mismatch Account Report']) {
  const mapping = odooNodesByName[name]?.parameters?.columns?.value ?? {};
  for (const field of ['Base_Revision', 'Revision', 'Writer_Run_ID', 'Aggregate_Source']) {
    if (!(field in mapping)) errors.push(`${name} must map ${field}.`);
  }
}
for (const [name, requiredFragments] of [
  ['Verify Campaign Report Revision', ['stale writer rejected', 'base+1', 'Run_ID']],
  ['Verify Account Report Revision', ['stale writer rejected', 'base+1', 'Writer_Run_ID']],
  ['Build Durable Work Items', ['DURABLE_SHEET_REBUILD', 'authoritative:true', 'emailRows', 'invoiceRows', 'queueRows']],
  ['Build Writeback Repair Items', ['revision gap', 'repairSkippedAsStale']],
]) {
  const source = odooNodesByName[name]?.parameters?.jsCode ?? '';
  for (const fragment of requiredFragments) if (!source.includes(fragment)) errors.push(`${name} must enforce ${fragment}.`);
}
const accountReportHeader = (await readFile('template/providers/odoo/account_report.csv', 'utf8')).split(/\r?\n/, 1)[0].split(',');
for (const field of ['Issuer_Key', 'Company_ID', 'Company_Name', 'Issuer_Compatibility', 'Issuer_Mismatch', 'Base_Revision', 'Revision', 'Writer_Run_ID', 'Aggregate_Source']) {
  if (!accountReportHeader.includes(field)) errors.push(`Odoo account_report.csv must include ${field}.`);
}
const campaignReportHeader = (await readFile('template/providers/odoo/campaign_report.csv', 'utf8')).split(/\r?\n/, 1)[0].split(',');
for (const field of ['Base_Revision', 'Revision', 'Writer_Run_ID', 'Aggregate_Source']) {
  if (!campaignReportHeader.includes(field)) errors.push(`Odoo campaign_report.csv must include ${field}.`);
}


// Phase 07 final release gate
for (const [name, command] of Object.entries({
  'verify:phase07:static': 'node scripts/phase07-final-release-gate.mjs --static-only',
  'verify:phase07:engine': 'node scripts/phase07-n8n-engine-smoke.mjs',
  'verify:phase07:evidence': 'node scripts/phase07-final-release-gate.mjs',
})) if (pkg.scripts?.[name] !== command) errors.push(`package.json must define ${name}.`);
const phase07EngineFixture = JSON.parse(await readFile('tests/fixtures/n8n/InvoiceRouter-Phase-07-Engine-Smoke.json', 'utf8'));
const phase07CustomNodes = phase07EngineFixture.nodes?.filter((node) => String(node.type).startsWith('n8n-nodes-invoicerouter.')) ?? [];
if (phase07EngineFixture.meta?.invoiceRouterEngineTarget !== '2.31.6' || phase07EngineFixture.meta?.sideEffects !== 'dry-run-only') errors.push('Phase 07 engine fixture must target n8n 2.31.6 and remain dry-run-only.');
if (phase07CustomNodes.length !== 8 || phase07EngineFixture.nodes?.find((node) => node.name === 'Invoice Sender')?.parameters?.dryRun !== true) errors.push('Phase 07 engine fixture must contain all eight custom nodes with Invoice Sender dryRun=true.');
for (const major of [18, 19]) {
  const fixture = JSON.parse(await readFile(`tests/fixtures/odoo/odoo-${major}-phase07-e2e.json`, 'utf8'));
  if (fixture.majorVersion !== major || fixture.expected?.capabilityProfileId !== `odoo-${major}-invoice-send`) errors.push(`Phase 07 Odoo ${major} fixture is invalid.`);
  if (fixture.expected?.emailSendStatus !== 'SENT' || fixture.expected?.pdfEvidenceStatus !== 'VALID') errors.push(`Phase 07 Odoo ${major} fixture must require evidence-backed SENT and VALID PDF.`);
}
const phase07NodesByName = Object.fromEntries((odooProductionWorkflow.nodes ?? []).map((node) => [node.name, node]));
for (const name of ['Google Sheets - Provider Lease Verify', 'Verify Provider Lease Before Side Effect']) if (!phase07NodesByName[name]) errors.push(`Phase 07 corrective workflow must include ${name}.`);
const identityBootstrapNode = phase07NodesByName['Google Sheets - Persist Job Identity'];
if (identityBootstrapNode?.parameters?.operation !== 'update' || JSON.stringify(identityBootstrapNode?.parameters?.columns?.matchingColumns) !== JSON.stringify(['row_number'])) errors.push('Initial Row_ID persistence must update the exact virtual Google Sheets row_number.');
if (!String(phase07NodesByName['Prepare Job Identity Row']?.parameters?.jsCode ?? '').includes('Google Sheets source row_number')) errors.push('Prepare Job Identity Row must fail closed without the source row_number.');
const phase07DurableCode = String(phase07NodesByName['Build Durable Work Items']?.parameters?.jsCode ?? '');
if (!phase07DurableCode.includes('providerPendingByJob') || !phase07DurableCode.includes('operationRecovery:providerPending') || !phase07DurableCode.includes('latestWritebackByRepair')) errors.push('Phase 07 corrective workflow must reconcile PROVIDER_PENDING at startup.');
const phase07EnvelopeCode = String(phase07NodesByName['Prepare Provider Operation Envelope']?.parameters?.jsCode ?? '');
if (!phase07EnvelopeCode.includes('ready.invoice') || !phase07EnvelopeCode.includes('cannot enter PROVIDER_PENDING without a stable provider reference')) errors.push('Phase 07 corrective workflow must persist an exact stable reference before provider work.');
const gitAttributes = await readFile('.gitattributes', 'utf8');
if (!gitAttributes.includes('* text=auto eol=lf')) errors.push('Release source must enforce LF text checkout through .gitattributes.');
const tsConfig = JSON.parse(await readFile('tsconfig.json', 'utf8'));
if (tsConfig?.compilerOptions?.newLine !== 'lf') errors.push('TypeScript build output must enforce LF newlines for deterministic cross-platform package hashing.');
const phase07EngineScript = await readFile('scripts/phase07-n8n-engine-smoke.mjs', 'utf8');
if (!phase07EngineScript.includes('npm_execpath') || !phase07EngineScript.includes('process.execPath')) errors.push('Phase 07 engine harness must use a cross-platform npm CLI launcher.');
if (!phase07EngineScript.includes("'import:workflow'") || !phase07EngineScript.includes("'export:workflow'")) errors.push('Phase 07 engine harness must import/export the complete canonical workflow.');
if (!phase07EngineScript.includes('packageContentSha256') || !phase07EngineScript.includes('engineBindingSha256')) errors.push('Phase 07 engine harness must emit a deterministic package-content engine binding.');
const phase07GateScript = await readFile('scripts/phase07-final-release-gate.mjs', 'utf8');
if (!phase07GateScript.includes('evidence/phase07/artifacts') || !phase07GateScript.includes('artifact hash mismatch') || !phase07GateScript.includes("new Set(['.json', '.txt', '.log', '.md'])")) errors.push('Phase 07 final gate must verify contained sanitized evidence artifact files and their actual SHA-256 hashes.');
if (phase07EngineScript.includes("tarballPath, '--ignore-scripts'")) errors.push('Phase 07 exact n8n install must allow dependency install scripts.');
const phase07Redaction = await readFile('shared/security/Redaction.ts', 'utf8');
if (!phase07Redaction.includes('replaceShortSecret') || !phase07Redaction.includes('Short alphanumeric secrets')) errors.push('Phase 07 short-secret boundary-aware redaction is missing.');
await requireText('docs/developer/phase07-final-release-gate.md', ['n8n@2.31.6', 'one-recipient', 'five-recipient', 'PENDING']);
for (const template of ['n8n-engine-smoke.template.json', 'canary-evidence.template.json', 'pilot-evidence.template.json']) {
  const evidence = JSON.parse(await readFile(`evidence/phase07/${template}`, 'utf8'));
  if (evidence.status !== 'PENDING') errors.push(`evidence/phase07/${template} must remain PENDING.`);
}

await requireText('docs/developer/odoo-email-evidence-contract.md', ['account.move.send.wizard', '`QUEUED`', '`SENT`', '`FAILED`', '`UNVERIFIED`']);
await requireText('docs/developer/lifecycle-retry-resume.md', ['invoice.post', 'invoice.send_email', 'EMAIL_UNVERIFIED']);
await requireText('template/providers/odoo/LIVE_TEST_CHECKLIST.md', ['complete project ZIP', 'n8n Community Nodes', 'recipient inbox']);

const ciWorkflow = await readFile('.github/workflows/ci.yml', 'utf8');
if (!ciWorkflow.includes('verify:phase07:engine')) errors.push('CI workflow must execute the Phase 07 n8n 2.31.6 engine smoke.');
const releaseWorkflow = await readFile('.github/workflows/release.yml', 'utf8');
if (!releaseWorkflow.includes('NPM_TOKEN is required for a tag release')) errors.push('Tag release must fail closed when NPM_TOKEN is missing.');
if (!releaseWorkflow.includes('npm whoami --registry=https://registry.npmjs.org')) errors.push('Tag release must validate npm publication credentials.');
if (releaseWorkflow.indexOf('Validate npm publication credentials') > releaseWorkflow.indexOf('Create GitHub Release')) errors.push('npm credential validation must run before GitHub release creation.');
for (const fragment of [
  'workflows/InvoiceRouter-v2-master-universal.json',
  'workflows/InvoiceRouter-v1.6-simple-bulk-email.json',
  'template/providers/odoo/.',
  'template/status-writeback-columns.csv',
  'docs/troubleshooting',
  'node scripts/audit-release-source.mjs release/bundle',
  'verify:phase07:evidence',
  'evidence/phase07',
]) {
  if (!releaseWorkflow.includes(fragment)) errors.push(`Release workflow must include ${fragment}.`);
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
