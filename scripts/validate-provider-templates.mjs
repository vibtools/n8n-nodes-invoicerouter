import { access, readFile, readdir } from 'node:fs/promises';
import { constants } from 'node:fs';

const providersRoot = 'template/providers';
const canonicalHeaders = (await readFile('template/status-writeback-columns.csv', 'utf8')).trim();
const requiredFiles = ['provider.template.ygit', 'provider.csv', 'email_list.csv', 'invoice_results.csv', 'provider.lifecycle.json', 'README.md'];
const errors = [];

function validateDeclarativeRecipe(recipe, source) {
  if (recipe.runtime?.type !== 'declarative_http') return;
  const steps = Array.isArray(recipe.steps) ? recipe.steps : [];
  if (steps.length === 0) errors.push(`${source} declarative recipe requires steps`);
  for (const [index, step] of steps.entries()) {
    if (!step || typeof step !== 'object' || Array.isArray(step)) { errors.push(`${source} steps[${index}] must be an object`); continue; }
    const request = step.request && typeof step.request === 'object' ? step.request : step;
    if (!step.id) errors.push(`${source} steps[${index}].id is missing`);
    if (!request.method) errors.push(`${source} steps[${index}].request.method is missing`);
    if (!request.url) errors.push(`${source} steps[${index}].request.url is missing`);
    if (!step.responseMap && !step.resultMap && /invoice\.create/.test(String(step.id))) errors.push(`${source} invoice.create step should map providerInvoiceId`);
  }
}


async function exists(path) {
  try { await access(path, constants.R_OK); return true; } catch { return false; }
}

const providerIds = (await readdir(providersRoot, { withFileTypes: true }))
  .filter((entry) => entry.isDirectory())
  .map((entry) => entry.name)
  .sort();

if (providerIds.length === 0) errors.push('template/providers must contain at least one provider template pack.');

for (const providerId of providerIds) {
  const base = `${providersRoot}/${providerId}`;
  for (const file of requiredFiles) if (!(await exists(`${base}/${file}`))) errors.push(`${base}/${file} is missing`);
  if (providerId === 'odoo') for (const file of ['retry_queue.csv', 'writeback_queue.csv', 'account_report.csv', 'campaign_report.csv']) if (!(await exists(`${base}/${file}`))) errors.push(`${base}/${file} is missing`);
  if (await exists(`${base}/provider.template.ygit`)) {
    const manifest = JSON.parse(await readFile(`${base}/provider.template.ygit`, 'utf8'));
    if (manifest.providerId !== providerId) errors.push(`${base}/provider.template.ygit providerId must be ${providerId}`);
    const expectedTemplateVersion = providerId === 'odoo' ? '2.1.1' : '2.0.0';
    if (manifest.templateVersion !== expectedTemplateVersion) errors.push(`${base}/provider.template.ygit templateVersion must be ${expectedTemplateVersion}`);
    for (const field of ['provider', 'emailList', 'invoiceResults', 'lifecycleRecipe', 'readme']) {
      if (!manifest.files?.[field]) errors.push(`${base}/provider.template.ygit is missing files.${field}`);
    }
  }
  if (await exists(`${base}/invoice_results.csv`)) {
    const headers = (await readFile(`${base}/invoice_results.csv`, 'utf8')).trim();
    if (headers !== canonicalHeaders) errors.push(`${base}/invoice_results.csv does not match template/status-writeback-columns.csv`);
  }
  if (await exists(`${base}/provider.lifecycle.json`)) {
    const recipe = JSON.parse(await readFile(`${base}/provider.lifecycle.json`, 'utf8'));
    if (recipe.providerId !== providerId) errors.push(`${base}/provider.lifecycle.json providerId must be ${providerId}`);
    if (!Array.isArray(recipe.lifecycleModes) || recipe.lifecycleModes.length === 0) errors.push(`${base}/provider.lifecycle.json requires lifecycleModes`);
    if (!Array.isArray(recipe.steps) || recipe.steps.length === 0) errors.push(`${base}/provider.lifecycle.json requires steps`);
    validateDeclarativeRecipe(recipe, `${base}/provider.lifecycle.json`);
  }
  if (await exists(`${base}/generic-http.declarative-example.json`)) {
    validateDeclarativeRecipe(JSON.parse(await readFile(`${base}/generic-http.declarative-example.json`, 'utf8')), `${base}/generic-http.declarative-example.json`);
  }
}


const odooProviderFields = [
  'Issuer_Key', 'Company_ID', 'Company_Name', 'Odoo_Server_Version',
  'Odoo_Major_Version', 'Capability_Status', 'Issuer_Compatibility',
];
for (const filename of ['provider.csv', 'provider.live.csv', 'provider.sandbox.csv']) {
  const source = `${providersRoot}/odoo/${filename}`;
  if (!(await exists(source))) { errors.push(`${source} is missing`); continue; }
  const headers = (await readFile(source, 'utf8')).split(/\r?\n/, 1)[0].split(',');
  for (const field of odooProviderFields) if (!headers.includes(field)) errors.push(`${source} is missing ${field}.`);
}
for (const filename of ['provider.lifecycle.json', 'provider.recipe.json']) {
  const source = `${providersRoot}/odoo/${filename}`;
  const contract = JSON.parse(await readFile(source, 'utf8'));
  if (!contract.requiredAccountFields?.includes('Issuer_Key')) errors.push(`${source} must require Issuer_Key.`);
  if (JSON.stringify(contract.compatibility?.profiledOdooMajorVersions) !== JSON.stringify([18, 19])) errors.push(`${source} must retain documented Odoo 18 and 19 metadata profiles.`);
  if (contract.compatibility?.unknownVersionPolicy !== 'capability_driven') errors.push(`${source} must use capability-driven handling for unprofiled Odoo versions.`);
  if (contract.compatibility?.versionAllowlistEnforced !== false) errors.push(`${source} must not enforce a fixed Odoo version allowlist.`);
  if (contract.compatibility?.sideEffectPermission !== 'unproven_until_live_canary') errors.push(`${source} must keep side-effect permission unproven until live canary.`);
  if (contract.issuerCompatibility?.requiredForFailoverGroups !== true) errors.push(`${source} must require legal-issuer compatibility for failover groups.`);
  if (contract.issuerCompatibility?.mismatchPolicy !== 'block_entire_failover_group') errors.push(`${source} must block the whole failover group on issuer mismatch.`);
}
if (!(await exists('shared/odoo/OdooCapabilityManifest.ts'))) errors.push('shared/odoo/OdooCapabilityManifest.ts is missing.');
else {
  const manifestSource = await readFile('shared/odoo/OdooCapabilityManifest.ts', 'utf8');
  for (const marker of ['SUPPORTED_ODOO_MAJOR_VERSIONS', '18:', '19:', 'account.move.send.wizard', 'action_send_and_print']) {
    if (!manifestSource.includes(marker)) errors.push(`Shared Odoo capability manifest is missing ${marker}.`);
  }
}


const odooCanonicalPath = 'template/providers/odoo/n8n-import-workflow-production-v2.1.1.json';
const odooCompatibilityPath = 'template/providers/odoo/n8n-import-workflow-live-bulk.json';
if (!(await exists(odooCanonicalPath))) errors.push(`${odooCanonicalPath} is missing`);
if (!(await exists(odooCompatibilityPath))) errors.push(`${odooCompatibilityPath} is missing`);
if (await exists(odooCanonicalPath) && await exists(odooCompatibilityPath)) {
  const canonicalSource = await readFile(odooCanonicalPath, 'utf8');
  const compatibilitySource = await readFile(odooCompatibilityPath, 'utf8');
  if (canonicalSource !== compatibilitySource) errors.push('Odoo canonical and live-bulk workflow templates must be byte-identical.');
  const workflow = JSON.parse(canonicalSource);
  const byName = Object.fromEntries((workflow.nodes ?? []).map((node) => [node.name, node]));
  const customNodes = (workflow.nodes ?? []).filter((node) => String(node.type).startsWith('n8n-nodes-invoicerouter.'));
  if (customNodes.length !== 8) errors.push('Odoo production workflow must preserve exactly eight custom node instances.');
  for (const name of [
    'Google Sheets - Retry Provider Accounts', 'Prepare Retry Provider Rehydration', 'Restore Retry Provider Rehydration',
    'Google Sheets - Failover Provider Accounts', 'Prepare Failover Provider Rehydration', 'Restore Failover Provider Rehydration',
  ]) if (!byName[name]) errors.push(`Odoo production workflow is missing ${name}.`);
  const targets = (source) => ((((workflow.connections ?? {})[source]?.main ?? [])[0] ?? []).map((entry) => [entry.node, entry.index]));
  if (JSON.stringify(targets('Wait Before Retry')) !== JSON.stringify([['Google Sheets - Retry Provider Accounts', 0]])) {
    errors.push('Wait Before Retry must reread provider accounts before retry selection.');
  }
  if (JSON.stringify(targets('Google Sheets - Retry Provider Accounts')) !== JSON.stringify([['Prepare Retry Provider Rehydration', 0]])) {
    errors.push('Retry provider Sheet read must feed Prepare Retry Provider Rehydration.');
  }
  if (JSON.stringify(targets('Prepare Retry Provider Rehydration')) !== JSON.stringify([['Provider Loader', 0]])) {
    errors.push('Retry provider rehydration must feed the existing Provider Loader.');
  }
  if (JSON.stringify(targets('Restore Retry Provider Rehydration')) !== JSON.stringify([['Provider Selector', 1]])) {
    errors.push('Restored retry context must re-enter Provider Selector work input.');
  }
  if (JSON.stringify(targets('Wait Before Failover')) !== JSON.stringify([['Google Sheets - Failover Provider Accounts', 0]])) {
    errors.push('Wait Before Failover must reread provider accounts before failover selection.');
  }
  if (JSON.stringify(targets('Google Sheets - Failover Provider Accounts')) !== JSON.stringify([['Prepare Failover Provider Rehydration', 0]])) {
    errors.push('Failover provider Sheet read must feed Prepare Failover Provider Rehydration.');
  }
  if (JSON.stringify(targets('Prepare Failover Provider Rehydration')) !== JSON.stringify([['Provider Loader', 0]])) {
    errors.push('Failover provider rehydration must feed the existing Provider Loader.');
  }
  if (JSON.stringify(targets('Restore Failover Provider Rehydration')) !== JSON.stringify([['Provider Selector', 1]])) {
    errors.push('Restored failover context must re-enter Provider Selector work input.');
  }
  const loaderTargets = targets('Provider Loader').map(([name]) => name).sort();
  const expectedLoaderTargets = ['Google Sheets - Issuer Mismatch Account Report Read', 'Prepare Preflight Provider Status', 'Restore Failover Provider Rehydration', 'Restore Retry Provider Rehydration'].sort();
  if (JSON.stringify(loaderTargets) !== JSON.stringify(expectedLoaderTargets)) {
    errors.push('Provider Loader must route initial, retry-rehydration, and failover-rehydration results through filtered branches.');
  }
  if (!String(byName['Prepare Preflight Provider Status']?.parameters?.jsCode ?? '').includes('rehydration')) {
    errors.push('Initial preflight writeback must ignore Provider Loader rehydration executions.');
  }
  for (const name of ['Google Sheets - Retry Provider Accounts', 'Google Sheets - Failover Provider Accounts']) {
    const node = byName[name];
    if (node?.parameters?.operation !== 'read' || node?.parameters?.sheetName?.value !== 'provider') {
      errors.push(`${name} must read the provider tab.`);
    }
    if (node?.retryOnFail !== true || node?.maxTries !== 3) errors.push(`${name} must use three read retries.`);
  }

  if (workflow.meta?.invoiceRouterHardeningPhase !== 'phase-07-final-corrective-audit') {
    errors.push('Odoo production workflow must identify the Phase 07 final release gate while retaining monotonic reporting and stale-writer protection.');
  }
  if (workflow.meta?.invoiceRouterSharedOdooCapabilityManifest !== true) errors.push('Odoo production workflow must declare the shared Odoo capability manifest.');
  if (JSON.stringify(workflow.meta?.invoiceRouterProfiledOdooMajorVersions) !== JSON.stringify([18, 19])) errors.push('Odoo production workflow must retain documented Odoo 18 and 19 metadata profiles.');
  if (workflow.meta?.invoiceRouterUnknownOdooVersionPolicy !== 'capability_driven') errors.push('Odoo production workflow must use capability-driven handling for unprofiled Odoo versions.');
  if (workflow.meta?.invoiceRouterVersionAllowlistEnforced !== false) errors.push('Odoo production workflow must not enforce a fixed Odoo version allowlist.');
  if (workflow.meta?.invoiceRouterLegalIssuerCompatibility !== true) errors.push('Odoo production workflow must declare legal-issuer compatibility enforcement.');
  if (workflow.meta?.invoiceRouterFinalCorrectiveAudit !== true) errors.push('Odoo production workflow must declare the final corrective audit flag.');
  for (const name of ['Google Sheets - Provider Lease Verify', 'Verify Provider Lease Before Side Effect']) if (!byName[name]) errors.push(`Odoo production workflow is missing ${name}.`);
    const identityBootstrapNode = byName['Google Sheets - Persist Job Identity'];
  if (identityBootstrapNode?.parameters?.operation !== 'update' || JSON.stringify(identityBootstrapNode?.parameters?.columns?.matchingColumns) !== JSON.stringify(['row_number'])) errors.push('Initial Row_ID persistence must update the exact virtual Google Sheets row_number.');
  if (!String(byName['Prepare Job Identity Row']?.parameters?.jsCode ?? '').includes('Google Sheets source row_number')) errors.push('Prepare Job Identity Row must fail closed without the source row_number.');
const providerPendingCode = String(byName['Build Durable Work Items']?.parameters?.jsCode ?? '');
  if (!providerPendingCode.includes('providerPendingByJob') || !providerPendingCode.includes('operationRecovery:providerPending') || !providerPendingCode.includes('latestWritebackByRepair')) errors.push('Odoo production workflow must reconcile PROVIDER_PENDING at startup.');
  const providerEnvelopeCode = String(byName['Prepare Provider Operation Envelope']?.parameters?.jsCode ?? '');
  if (!providerEnvelopeCode.includes('ready.invoice') || !providerEnvelopeCode.includes('cannot enter PROVIDER_PENDING without a stable provider reference')) errors.push('Provider operation envelope must contain the exact built stable reference.');
  const phase04Fields = ['Issuer_Key', 'Company_ID', 'Company_Name', 'Odoo_Server_Version', 'Odoo_Major_Version', 'Capability_Status', 'Issuer_Compatibility'];
  const preflightCode = String(byName['Prepare Preflight Provider Status']?.parameters?.jsCode ?? '');
  const preflightMapping = byName['Google Sheets - Preflight Provider Status']?.parameters?.columns?.value ?? {};
  for (const field of phase04Fields) {
    if (!preflightCode.includes(field)) errors.push(`Prepare Preflight Provider Status is missing ${field}.`);
    if (!(field in preflightMapping)) errors.push(`Google Sheets - Preflight Provider Status is missing ${field}.`);
  }
  const preflightStatusNode = byName['Google Sheets - Preflight Provider Status'];
  if (preflightStatusNode?.parameters?.operation !== 'update' || JSON.stringify(preflightStatusNode?.parameters?.columns?.matchingColumns) !== JSON.stringify(['row_number'])) errors.push('Provider preflight status must update the original provider row by row_number.');
  if (!preflightCode.includes('row_number')) errors.push('Prepare Preflight Provider Status must preserve the source row_number.');
  const leaseCode = String(byName['Prepare Campaign Lease']?.parameters?.jsCode ?? '');
  if (!leaseCode.includes('no eligible provider account') || !leaseCode.includes('LEASE_RECOVERED_BEFORE_PROVIDER_SIDE_EFFECT') || !leaseCode.includes('PROVIDER_PENDING')) errors.push('Campaign lease acquisition must block zero-provider runs and safely reclaim only pre-provider failed leases.');
  if (workflow.meta?.invoiceRouterAccountCountPolicy !== 'all-enabled-provider-rows' || workflow.meta?.invoiceRouterProviderCountLimit !== null) errors.push('Workflow must remain provider-account-count agnostic.');
  for (const name of [
    'Google Sheets - Invoice Results Input', 'Google Sheets - Campaign Report Input', 'Prepare Campaign Lease',
    'Google Sheets - Campaign Lease Acquire', 'Google Sheets - Campaign Lease Verify', 'Verify Campaign Lease',
    'Google Sheets - Campaign Release Read', 'Prepare Campaign Lease Release', 'Google Sheets - Campaign Lease Release',
  ]) if (!byName[name]) errors.push(`Odoo production workflow is missing ${name}.`);
  const phase02Edges = [
    ['Google Sheets - Retry Queue Input', [['Prepare Invoice Results Read', 0]]],
    ['Prepare Invoice Results Read', [['Google Sheets - Invoice Results Input', 0]]],
    ['Google Sheets - Invoice Results Input', [['Prepare Campaign Report Read', 0]]],
    ['Prepare Campaign Report Read', [['Google Sheets - Campaign Report Input', 0]]],
    ['Google Sheets - Campaign Report Input', [['Prepare Account Report Read', 0]]],
    ['Attach Provider Library', [['Prepare Campaign Lease', 0]]],
    ['Prepare Campaign Lease', [['Google Sheets - Campaign Lease Acquire', 0]]],
    ['Google Sheets - Campaign Lease Acquire', [['Prepare Campaign Lease Verify Read', 0]]],
    ['Prepare Campaign Lease Verify Read', [['Google Sheets - Campaign Lease Verify', 0]]],
    ['Google Sheets - Campaign Lease Verify', [['Verify Campaign Lease', 0]]],
    ['Verify Campaign Lease', [['Loop Over Recipient Jobs', 0]]],
    ['Campaign Complete', [['Prepare Campaign Release Read', 0]]],
    ['Google Sheets - Campaign Lease Release', [['Campaign Released', 0]]],
  ];
  for (const [source, expected] of phase02Edges) {
    if (JSON.stringify(targets(source)) !== JSON.stringify(expected)) errors.push(`${source} Phase 02 connection is incorrect.`);
  }
  const durableBuild = String(byName['Build Durable Work Items']?.parameters?.jsCode ?? '');
  for (const marker of ['Google Sheets - Invoice Results Input', 'Google Sheets - Campaign Report Input', 'Mixed pending campaigns found']) {
    if (!durableBuild.includes(marker)) errors.push(`Build Durable Work Items is missing ${marker}.`);
  }
  const leaseFields = ['Run_State', 'Run_ID', 'Lock_Acquired_At', 'Lock_Expires_At', 'Revision', 'Last_Attempt_At'];
  for (const name of ['Google Sheets - Campaign Lease Acquire', 'Google Sheets - Campaign Report', 'Repair Campaign Report Row', 'Google Sheets - Campaign Lease Release']) {
    const mapping = byName[name]?.parameters?.columns?.value ?? {};
    for (const field of leaseFields) if (!(field in mapping)) errors.push(`${name} is missing ${field}.`);
  }
  const campaignHeaders = (await readFile(`${providersRoot}/odoo/campaign_report.csv`, 'utf8')).trim().split(',');
  for (const field of leaseFields) if (!campaignHeaders.includes(field)) errors.push(`campaign_report.csv is missing ${field}.`);

  for (const flag of ['invoiceRouterMonotonicReporting', 'invoiceRouterStaleWriterProtection', 'invoiceRouterDurableAggregateRebuild', 'invoiceRouterIssuerMismatchReporting']) {
    if (workflow.meta?.[flag] !== true) errors.push(`Odoo production workflow must enable ${flag}.`);
  }
  const phase06Nodes = [
    'Google Sheets - Campaign Report Revision Read', 'Verify Campaign Report Revision',
    'Google Sheets - Account Report Revision Read', 'Verify Account Report Revision',
    'Google Sheets - Issuer Mismatch Account Report Read', 'Prepare Issuer Mismatch Account Report',
    'Google Sheets - Issuer Mismatch Account Report',
  ];
  for (const name of phase06Nodes) if (!byName[name]) errors.push(`Odoo production workflow is missing ${name}.`);
  for (const name of ['Google Sheets - Campaign Report', 'Google Sheets - Account Report', 'Google Sheets - Issuer Mismatch Account Report']) {
    const mapping = byName[name]?.parameters?.columns?.value ?? {};
    for (const field of ['Base_Revision', 'Revision', 'Writer_Run_ID', 'Aggregate_Source']) {
      if (!(field in mapping)) errors.push(`${name} is missing ${field}.`);
    }
  }
  const accountHeaders = (await readFile(`${providersRoot}/odoo/account_report.csv`, 'utf8')).trim().split(',');
  for (const field of ['Issuer_Key', 'Company_ID', 'Company_Name', 'Issuer_Compatibility', 'Issuer_Mismatch', 'Base_Revision', 'Revision', 'Writer_Run_ID', 'Aggregate_Source']) {
    if (!accountHeaders.includes(field)) errors.push(`account_report.csv is missing ${field}.`);
  }
}

const docsManifest = JSON.parse(await readFile('docs/docs.minifest.ygit', 'utf8'));
const defaultDocument = `docs/${docsManifest.documentation?.defaultDocument ?? 'index.md'}`;
if (!(await exists(defaultDocument))) errors.push(`docs manifest default document is missing: ${defaultDocument}`);
for (const section of docsManifest.structure?.sections ?? []) {
  const sectionIndex = `docs/${section.path}index.md`;
  if (!(await exists(sectionIndex))) errors.push(`docs manifest section index is missing: ${sectionIndex}`);
}

if (errors.length > 0) {
  console.error('Provider template validation failed:');
  for (const error of errors) console.error(`- ${error}`);
  process.exit(1);
}

console.log(`Provider template validation passed. Provider template packs: ${providerIds.length}.`);
