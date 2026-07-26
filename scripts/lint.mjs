import { readFile, readdir, stat } from 'node:fs/promises';
import { join } from 'node:path';

const errors = [];
const critical = ['tsconfig.json', '.gitignore', '.editorconfig', '.prettierrc', '.eslintrc.json', 'scripts/publish.ps1'];
for (const file of critical) {
  try {
    if ((await stat(file)).size === 0) errors.push(`${file} is empty`);
  } catch {
    errors.push(`${file} is missing`);
  }
}

async function walk(dir, extension, output = []) {
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) await walk(path, extension, output);
    else if (entry.name.endsWith(extension)) output.push(path);
  }
  return output;
}

for (const file of await walk('scripts', '.ps1')) {
  const text = await readFile(file, 'utf8');
  if (/\bpowershell\.exe\b/i.test(text)) errors.push(`${file} hardcodes powershell.exe`);
  if (/^\s*Clear-Host\s*$/m.test(text)) errors.push(`${file} contains unguarded Clear-Host`);

  // A PowerShell wrapper may call npm commands, but it must not call its own
  // package.json alias (for example build.ps1 -> npm run build).
  const stem = file.split('/').pop().replace(/\.ps1$/i, '');
  if (new RegExp(`npm\\s+run\\s+${stem}(?:\\s|$)`, 'i').test(text)) {
    errors.push(`${file} recursively invokes npm run ${stem}`);
  }
  if (stem === 'test' && /npm\s+test(?:\s|$)/i.test(text)) {
    errors.push(`${file} recursively invokes npm test`);
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

if (errors.length) {
  console.error('Lint failed:');
  for (const error of errors) console.error(`- ${error}`);
  process.exit(1);
}
console.log('Project lint passed.');
