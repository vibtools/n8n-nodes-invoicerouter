#!/usr/bin/env node
import { access, readFile } from 'node:fs/promises';
import { constants } from 'node:fs';
import { createRequire } from 'node:module';
import path from 'node:path';
import process from 'node:process';

const packageRoot = path.resolve(process.argv[2] || process.cwd());
const errors = [];
const warnings = [];

async function exists(filePath) {
  try {
    await access(filePath, constants.R_OK);
    return true;
  } catch {
    return false;
  }
}

async function readJson(filePath) {
  try {
    return JSON.parse(await readFile(filePath, 'utf8'));
  } catch (error) {
    errors.push(`Unable to read JSON at ${filePath}: ${error.message}`);
    return null;
  }
}

function reportList(title, values) {
  console.log(`\n${title}`);
  for (const value of values) console.log(`- ${value}`);
}

const pkgPath = path.join(packageRoot, 'package.json');
const pkg = await readJson(pkgPath);
if (!pkg) process.exit(1);

console.log(`InvoiceRouter package diagnostic`);
console.log(`Package root: ${packageRoot}`);
console.log(`Package: ${pkg.name}@${pkg.version}`);

if (pkg.name !== 'n8n-nodes-invoicerouter') errors.push(`Unexpected package name: ${pkg.name}`);
if (!pkg.keywords?.includes('n8n-community-node-package')) errors.push('package.json keywords must include n8n-community-node-package for n8n registry discovery.');
if (pkg.peerDependencies?.['n8n-workflow']) errors.push('Runtime peerDependency n8n-workflow should not be required for installed package discovery.');
if (pkg.n8n?.n8nNodesApiVersion !== 1) errors.push('package.json n8n.n8nNodesApiVersion must be 1.');
if (!Array.isArray(pkg.n8n?.nodes) || pkg.n8n.nodes.length !== 8) errors.push('package.json n8n.nodes must register exactly 8 compiled node files.');

const requireFromPackage = createRequire(path.join(packageRoot, 'package.json'));
const loadedNodes = [];
for (const relativePath of pkg.n8n?.nodes ?? []) {
  const absolutePath = path.join(packageRoot, relativePath);
  if (!(await exists(absolutePath))) {
    errors.push(`Missing compiled node file: ${relativePath}`);
    continue;
  }
  try {
    const loaded = requireFromPackage(`./${relativePath}`);
    const exportedNames = Object.keys(loaded);
    if (!exportedNames.length) errors.push(`Node file has no exports: ${relativePath}`);
    loadedNodes.push(`${relativePath} -> ${exportedNames.join(', ')}`);
  } catch (error) {
    errors.push(`Unable to require ${relativePath}: ${error.message}`);
  }
}

const iconChecks = [];
for (const relativePath of pkg.n8n?.nodes ?? []) {
  const nodeFolder = path.dirname(relativePath);
  const compiledDescriptionPath = relativePath.replace(/\.node\.js$/, '.description.js');
  const absoluteDescriptionPath = path.join(packageRoot, compiledDescriptionPath);
  if (!(await exists(absoluteDescriptionPath))) {
    warnings.push(`Compiled description file not found for icon check: ${compiledDescriptionPath}`);
    continue;
  }
  try {
    const source = await readFile(absoluteDescriptionPath, 'utf8');
    const iconMatch = source.match(/icon:\s*['"]file:([^'"]+)['"]/);
    if (!iconMatch) {
      errors.push(`No file icon declaration found in ${compiledDescriptionPath}`);
      continue;
    }
    const iconRelativePath = path.join(nodeFolder, iconMatch[1]);
    if (!(await exists(path.join(packageRoot, iconRelativePath)))) errors.push(`Missing packaged node icon: ${iconRelativePath}`);
    else iconChecks.push(iconRelativePath);
  } catch (error) {
    errors.push(`Unable to inspect ${compiledDescriptionPath}: ${error.message}`);
  }
}

if (loadedNodes.length) reportList('Loaded node modules', loadedNodes);
if (iconChecks.length) reportList('Packaged runtime icons', iconChecks);
if (warnings.length) reportList('Warnings', warnings);

if (errors.length) {
  reportList('Errors', errors);
  process.exit(1);
}

console.log('\nDiagnostic result: PASS');
console.log('The package manifest, compiled node bindings, and packaged icons are structurally loadable.');
console.log('If n8n still does not show the nodes, verify npm registry publish status, install path, container volume, and n8n restart/cache logs.');
