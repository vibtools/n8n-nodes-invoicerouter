# InvoiceRouter Forensic Audit Report

**Audit target:** `InvoiceRouter.zip`  
**Audited package version:** `1.0.0`  
**Audit date:** 2026-07-25  
**Result:** Corrected, buildable MVP scaffold

## Executive Summary

The uploaded archive was not a runnable n8n community-node package. It was primarily an architecture/documentation scaffold with many empty configuration and TypeScript files. The CI failures were symptoms of deeper structural defects rather than isolated workflow formatting problems.

The corrected project now has deterministic validation, formatting, linting, TypeScript compilation, smoke tests, valid GitHub Actions YAML, valid manifests/examples, safe PowerShell wrappers, and npm package-entry verification.

The package remains an **MVP scaffold**. It does not claim or perform live provider invoice transmission. `Invoice Sender` defaults to safe dry-run behavior. Provider-specific authentication, HTTP transport, retries, webhook processing, and integration tests remain future implementation work.

## Scope

The audit covered:

- Repository and directory structure
- `package.json` and `package-lock.json`
- GitHub Actions workflows
- TypeScript configuration and source entry points
- n8n node registration paths
- Provider adapter structure
- PowerShell automation scripts and fixers
- JSON/YAML syntax and internal manifest consistency
- Documentation and example files
- Build output and npm package contents
- Basic secret-pattern scanning
- Runtime smoke tests

## Critical Findings and Fixes

### 1. Empty core configuration files

The original `.editorconfig`, `.gitignore`, `.prettierrc`, `.eslintrc.json`, and `tsconfig.json` were empty or BOM-only.

**Fix:** Added valid deterministic configuration and normalized UTF-8/LF encoding.

### 2. TypeScript sources were placeholders

Most node, provider, and shared TypeScript files contained no executable implementation.

**Fix:** Added compile-safe MVP scaffolds for five core nodes, shared types/utilities, provider adapter contracts, and eleven provider directories.

### 3. n8n entry-path mismatch

`package.json` registered generic files such as `Node.node.js`, while matching source entry files did not exist.

**Fix:** Added stable generic entry aliases and verified every declared `dist/.../Node.node.js` artifact after build.

### 4. Recursive npm/PowerShell scripts

The original `build.ps1`, `test.ps1`, and `dev.ps1` called their own npm aliases, creating recursion.

**Fix:** Replaced recursive calls with direct TypeScript compiler and Node test-runner commands.

### 5. Missing formatter/linter tools

The CI formatter failed because `format.ps1` required Prettier although Prettier was not installed. Lint scripts had the same architectural issue with ESLint.

**Fix:** Added dependency-free deterministic formatter and structural linter scripts. PowerShell wrappers now call those tools directly. This removes the missing-Prettier CI failure without silently downloading tools.

### 6. Node.js engine mismatch

The workflow used Node.js 20 while the installed dependency graph contained `isolated-vm@6.1.2`, which requires Node.js 22 or newer.

**Fix:** CI workflows use Node.js 24. Package compatibility is declared as Node.js `>=22.0.0 <25` to remain compatible with supported n8n hosts while using Node 24 for reproducible CI native builds.

### 7. Incorrect dependency topology

`n8n-workflow` was declared as both a production dependency and a peer dependency, which could bundle/duplicate the host runtime.

**Fix:** Moved `n8n-workflow` to `devDependencies` and retained it as a `peerDependency`. Regenerated lockfile metadata.

### 8. Invalid GitHub Actions YAML

Inline JavaScript commands in Build and Documentation workflows contained unquoted colon-bearing text that caused YAML scanner errors.

**Fix:** Converted those commands to block scripts and validated all four workflow files with duplicate-key detection.

### 9. Workflow chain and artifact weaknesses

The original workflows had inconsistent Node versions, fragile cache behavior, ambiguous script detection, and missing artifact validation.

**Fix:** Standardized Node 24, `npm ci`, exact scripts, deterministic checkout refs, required artifact checks, restricted permissions, and release provenance support.

### 10. Dangerous package updater

The original `update-package.ps1` would overwrite the package name, version, repository, and Node engine with stale values.

**Fix:** Replaced it with a safe lockfile-root metadata synchronizer that preserves package identity and configuration.

### 11. Cleaner removed required architecture folders

The original cleaner deleted `logs` and `temp`, although the manifest required those directories.

**Fix:** Cleaner now removes generated subdirectories only and preserves/recreates required roots.

### 12. Doctor used an obsolete manifest schema

`doctor.ps1` referenced fields such as `Architecture.folders` and `Architecture.rootFiles` that do not exist in the current manifest.

**Fix:** Rebuilt the doctor around the actual `directories.required`, `nodes.required`, and `providers.supported` schema.

### 13. Auto-fix schema mismatch and missing behavior

The auto-fix script read obsolete keys and ignored backup/report configuration.

**Fix:** Aligned it with `manifest/auto-fix.json`, added guarded backups, fixer result tracking, report generation, and deterministic exit behavior.

### 14. Invalid or blank examples and documentation

Provider/workflow example JSON files and CSV files were BOM-only. Several provider README files were blank. Root documentation required by CI was missing.

**Fix:** Added valid examples, CSV schemas, provider status documentation, `ARCHITECTURE.md`, and `CHANGELOG.md`.

### 15. Misleading implementation claims

Documentation described live provider API sending although the source contained no such implementation.

**Fix:** Added explicit MVP/dry-run status notices and corrected executable behavior descriptions without deleting the target architecture documentation.

### 16. Text-encoding contamination

Many files contained UTF-8 BOM markers and mixed CRLF/LF endings.

**Fix:** Normalized text to UTF-8 without BOM and LF endings. Intentional `.gitkeep` files remain empty.

## Validation Evidence

The corrected project passed:

- Project structure validation
- Structural lint
- Formatting check
- TypeScript strict compilation
- Five declared n8n entry-output checks
- Three Node smoke tests
- JSON parsing for all project JSON files
- YAML parsing and duplicate-key checks for all workflows
- Required documentation checks
- Secret-pattern scan: no embedded private keys or common token formats found
- npm package dry-run and required-file verification
- Production dependency audit: zero bundled production dependencies and zero reported production vulnerabilities

The generated npm package dry-run contained all required entry points, including:

- `dist/index.js`
- `dist/index.d.ts`
- Five `dist/nodes/.../Node.node.js` files
- `manifest/architecture.json`
- `README.md`
- `LICENSE`
- `CHANGELOG.md`

## Remaining Limitations

1. **Live provider integrations are not implemented.** The adapters are scaffolds and the sender is dry-run safe.
2. **PowerShell execution was not available in the audit container.** PowerShell scripts received static review and cross-platform corrections, but their final runtime proof will occur on Windows PowerShell 7 or GitHub Actions `pwsh`.
3. **Full development-dependency vulnerability audit could not complete** because the registry audit endpoint returned a temporary service/DNS error. The production package has no bundled runtime dependencies; rerun `npm audit` in your connected environment.
4. **Official n8n node-linter migration is still recommended** before submitting for n8n verification. The audited package uses a deterministic internal build/lint scaffold to preserve the existing architecture.
5. **Provider credential security, API error mapping, retry policy, rate limiting, and integration tests** must be designed before enabling live mode.

## Safe Overwrite Procedure

1. Back up the existing repository directory.
2. Extract the updated ZIP.
3. Copy the contents of its `InvoiceRouter` folder into the existing repository root.
4. Do not delete or replace your existing `.git` directory. The provided ZIP intentionally contains no `.git` directory.
5. Run:

```cmd
npm ci
npm run validate
npm run format:check
npm run lint
npm run typecheck
npm run build
npm test
git status
```

6. Review the diff before committing.

## Recommended Commit

```text
fix(project): repair CI, build scaffolds, manifests, and automation scripts
```
