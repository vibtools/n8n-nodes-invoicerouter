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
  if (await exists(`${base}/provider.template.ygit`)) {
    const manifest = JSON.parse(await readFile(`${base}/provider.template.ygit`, 'utf8'));
    if (manifest.providerId !== providerId) errors.push(`${base}/provider.template.ygit providerId must be ${providerId}`);
    if (manifest.templateVersion !== '2.0.0') errors.push(`${base}/provider.template.ygit templateVersion must be 2.0.0`);
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
