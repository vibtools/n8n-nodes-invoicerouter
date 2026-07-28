import { rm } from 'node:fs/promises';

for (const path of ['dist', 'release', 'coverage', 'logs', 'temp']) {
  await rm(path, { recursive: true, force: true });
}

console.log('Generated directories removed.');
