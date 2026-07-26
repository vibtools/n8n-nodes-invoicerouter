import { readFile, readdir, writeFile } from 'node:fs/promises';
import { extname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(fileURLToPath(new URL('../', import.meta.url)));
const mode = process.argv.includes('--write') ? 'write' : 'check';
const allowed = new Set(['.ts', '.js', '.mjs', '.cjs', '.json', '.yml', '.yaml', '.ps1']);
const excluded = new Set(['.git', 'node_modules', 'dist', 'release', 'temp']);
const roots = ['credentials', 'nodes', 'providers', 'shared', 'tests', 'scripts', 'workflows', '.github/workflows'];
const topFiles = ['package.json', 'package-lock.json', 'tsconfig.json', '.prettierrc', '.eslintrc.json'];

async function walk(directory, output = []) {
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    if (excluded.has(entry.name)) continue;
    const path = join(directory, entry.name);
    if (entry.isDirectory()) await walk(path, output);
    else if (allowed.has(extname(entry.name))) output.push(path);
  }
  return output;
}

const files = [];
for (const directory of roots) files.push(...(await walk(join(root, directory))));
for (const file of topFiles) files.push(join(root, file));

const changed = [];
for (const file of files) {
  const original = await readFile(file, 'utf8');
  const normalized = original
    .replace(/^\uFEFF/, '')
    .replace(/\r\n?/g, '\n')
    .split('\n')
    .map((line) => line.replace(/[ \t]+$/g, ''))
    .join('\n')
    .replace(/\n*$/, '\n');
  if (normalized !== original) {
    changed.push(relative(root, file));
    if (mode === 'write') await writeFile(file, normalized, 'utf8');
  }
}

if (changed.length > 0 && mode === 'check') {
  console.error('Formatting differences found:');
  for (const file of changed) console.error(`- ${file}`);
  process.exit(1);
}
console.log(mode === 'write' ? `Formatted ${changed.length} file(s).` : 'Formatting check passed.');
