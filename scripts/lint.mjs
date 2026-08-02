import { readFile, stat } from 'node:fs/promises';

const errors = [];
const critical = [
  'tsconfig.json', '.gitignore', '.gitattributes', '.editorconfig', '.prettierrc', '.eslintrc.json',
  'VERSION_1_0_FREEZE.md', 'manifest/freeze-v1.0.json', 'workflows/InvoiceRouter-v1-production.json',
];
for (const file of critical) {
  try { if ((await stat(file)).size === 0) errors.push(`${file} is empty`); }
  catch { errors.push(`${file} is missing`); }
}
const pkg = JSON.parse(await readFile('package.json', 'utf8'));
for (const path of pkg.n8n?.nodes ?? []) {
  const source = path.replace(/^dist\//, '').replace(/\.js$/, '.ts');
  try { await stat(source); } catch { errors.push(`n8n entry source is missing: ${source}`); }
}
if ((pkg.n8n?.nodes ?? []).length !== 8) errors.push('Exactly eight n8n nodes must be registered.');
if (pkg.n8n?.credentials) errors.push('Version 1 must not register the obsolete separate credential type.');
if (pkg.invoiceRouterFreeze?.implementationStatus !== 'COMPLETE') errors.push('Implementation must be marked COMPLETE.');
if (!['VERSION_1_0_FREEZE.md', 'docs/freeze/v1.0/V2_0_0_MASTER_UNIVERSAL_PROVIDER_LIFECYCLE.md'].includes(pkg.invoiceRouterFreeze?.sourceOfTruth)) errors.push('Source of truth must be a frozen InvoiceRouter architecture document.');
if (errors.length) {
  console.error('Lint failed:');
  for (const error of errors) console.error(`- ${error}`);
  process.exit(1);
}
console.log('Project lint passed.');
