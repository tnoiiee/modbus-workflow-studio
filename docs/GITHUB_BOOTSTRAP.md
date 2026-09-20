# GitHub Bootstrap v1.2.8 Rev2

This bootstrap is generated directly from the approved v1.2.8 source ZIP. It corrects repository documentation that previously retained outdated v1.0.18 and single-running-workflow statements.

## Initial baseline

```powershell
git init
git branch -M main
git add .
git commit -m "docs: establish corrected v1.2.8 github baseline"
git remote add origin https://github.com/YOUR-ACCOUNT/modbus-workflow-studio.git
git push -u origin main
```

Do not create tag `v1.2.8` until `npm run check` or approved CI passes.

## Lockfile process

The approved source ZIP does not contain a trusted cross-platform lockfile. Create it from a clean local state:

```powershell
Remove-Item -Recurse -Force node_modules -ErrorAction SilentlyContinue
Remove-Item -Recurse -Force client\node_modules -ErrorAction SilentlyContinue
Remove-Item -Recurse -Force server\node_modules -ErrorAction SilentlyContinue
Remove-Item -Force package-lock.json -ErrorAction SilentlyContinue
npm install --include=optional
npm run check
```

Confirm the generated lockfile contains the Linux Rollup optional package before committing:

```powershell
Select-String -Path package-lock.json -Pattern 'node_modules/@rollup/rollup-linux-x64-gnu'
```

After committing a validated lockfile, change CI installation to:

```yaml
run: npm ci --include=optional
```

## Tagging

After CI passes:

```powershell
git tag -a v1.2.8 -m "MODBUS WORKFLOW STUDIO v1.2.8 baseline"
git push origin v1.2.8
```
