import { readFile, stat } from 'node:fs/promises';

const errors = [];
const critical = [
  'tsconfig.json',
  '.gitignore',
  '.gitattributes',
  '.editorconfig',
  '.prettierrc',
  '.eslintrc.json',
  'VERSION_1_0_FREEZE.md',
  'manifest/freeze-v1.0.json',
];

for (const file of critical) {
  try {
    if ((await stat(file)).size === 0) errors.push(`${file} is empty`);
  } catch {
    errors.push(`${file} is missing`);
  }
}

const pkg = JSON.parse(await readFile('package.json', 'utf8'));
for (const path of pkg.n8n?.nodes ?? []) {
  const source = path.replace(/^dist\//, '').replace(/\.js$/, '.ts');
  try {
    await stat(source);
  } catch {
    errors.push(`n8n entry source is missing: ${source}`);
  }
}

if (pkg.invoiceRouterFreeze?.targetNodeCount !== 8) {
  errors.push('package.json must declare the frozen targetNodeCount as 8.');
}
if (pkg.invoiceRouterFreeze?.sourceOfTruth !== 'VERSION_1_0_FREEZE.md') {
  errors.push('package.json must point to VERSION_1_0_FREEZE.md as source of truth.');
}

if (errors.length) {
  console.error('Lint failed:');
  for (const error of errors) console.error(`- ${error}`);
  process.exit(1);
}
console.log('Project lint passed.');
