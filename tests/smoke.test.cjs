const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const packageJson = require(path.join(root, 'package.json'));

test('package metadata is internally consistent', () => {
  assert.equal(packageJson.name, 'n8n-nodes-invoicerouter');
  assert.equal(packageJson.n8n.n8nNodesApiVersion, 1);
  assert.equal(packageJson.n8n.nodes.length, 5);
});

test('all declared n8n node build artifacts exist and export a class', () => {
  for (const relativePath of packageJson.n8n.nodes) {
    const fullPath = path.join(root, relativePath);
    assert.ok(fs.existsSync(fullPath), `${relativePath} is missing`);
    const exportsObject = require(fullPath);
    const classes = Object.values(exportsObject).filter((value) => typeof value === 'function');
    assert.ok(classes.length > 0, `${relativePath} exports no node class`);
    const instance = new classes[0]();
    assert.ok(instance.description);
    assert.equal(typeof instance.execute, 'function');
  }
});

test('main and declaration outputs exist', () => {
  assert.ok(fs.existsSync(path.join(root, packageJson.main)));
  assert.ok(fs.existsSync(path.join(root, packageJson.types)));
});
