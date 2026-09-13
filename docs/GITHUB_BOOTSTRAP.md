# GitHub Bootstrap

## Initial push

From the extracted repository directory:

```powershell
git init
git branch -M main
git add .
git commit -m "docs: establish v1.2.8 github baseline"
git remote add origin https://github.com/YOUR-ACCOUNT/modbus-workflow-studio.git
git push -u origin main
```

After local or GitHub Actions validation passes:

```powershell
git tag -a v1.2.8 -m "MODBUS WORKFLOW STUDIO v1.2.8 baseline"
git push origin v1.2.8
```

Do not tag the baseline until `npm run check` passes.

## Recommended repository settings

- Protect `main`.
- Require pull requests before merge.
- Require the `check` status check.
- Block force pushes and branch deletion.
- Keep release ZIP assets in GitHub Releases, not in Git history.

## Next branch

After the baseline is tagged:

```powershell
git checkout -b hotfix/v1.2.9-monitor-websocket
```

The final v1.2.9 acceptance scope must be approved before source changes begin.

## Lockfile note

The imported v1.2.8 source does not contain `package-lock.json`. The initial CI workflow therefore uses `npm install`. After the project owner generates and commits a trusted lockfile, change CI to `npm ci`.
