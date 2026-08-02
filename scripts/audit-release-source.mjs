import { readdir, stat } from 'node:fs/promises';
import { join } from 'node:path';

const root = process.argv[2] ?? '.';
const forbiddenNames = new Set(['.git', 'node_modules', 'dist']);
const forbiddenExtensions = new Set(['.tgz', '.swp']);
const errors = [];

async function walk(dir) {
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    const relative = full.replace(/^\.\/?/, '');
    if (forbiddenNames.has(entry.name)) {
      errors.push(`forbidden release source path: ${relative}`);
      continue;
    }
    for (const ext of forbiddenExtensions) {
      if (entry.name.endsWith(ext)) errors.push(`forbidden release source file: ${relative}`);
    }
    if (entry.name === 'project') errors.push('project/ must not be included in public release source.');
    if (entry.isDirectory()) await walk(full);
    else if ((await stat(full)).size === 0 && !entry.name.endsWith('.csv')) errors.push(`empty release file: ${relative}`);
  }
}

await walk(root);
if (errors.length > 0) {
  console.error('Release source audit failed:');
  for (const error of errors) console.error(`- ${error}`);
  process.exit(1);
}
console.log(`Release source audit passed: ${root}`);
