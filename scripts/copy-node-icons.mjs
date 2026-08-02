import { copyFile, mkdir, readdir } from 'node:fs/promises';
import { join } from 'node:path';

const nodeRoot = 'nodes';
const distRoot = join('dist', 'nodes');

for (const folder of await readdir(nodeRoot)) {
  const sourceFolder = join(nodeRoot, folder);
  const distFolder = join(distRoot, folder);
  const entries = await readdir(sourceFolder);
  for (const entry of entries) {
    if (!entry.endsWith('.svg')) continue;
    await mkdir(distFolder, { recursive: true });
    await copyFile(join(sourceFolder, entry), join(distFolder, entry));
  }
}

console.log('Node icon assets copied to dist.');
