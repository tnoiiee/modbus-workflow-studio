# Development Rules

`AGENTS.md` is authoritative. This file provides the practical workflow.

## Per-version workflow

1. Identify base tag/commit and target version.
2. Read `AGENTS.md`, `CURRENT_STATE.md`, protected areas, and target acceptance test.
3. Inspect source before proposing implementation.
4. Summarize final scope, exclusions, and expected files.
5. Obtain explicit project-owner approval.
6. Create a dedicated branch.
7. Implement only the approved scope.
8. Run CI or have the project owner run `npm run check`.
9. Resolve failures without altering protected behavior.
10. Merge, tag, release, and update current-state/changelog documentation.

## Branch naming

- `hotfix/vX.Y.Z-short-description`
- `feature/vX.Y.Z-short-description`
- `docs/short-description`

## Commit examples

- `fix(monitor): prevent overlapping read cycles`
- `fix(websocket): reconnect and resynchronize live state`
- `perf(traffic): batch websocket diagnostics`
- `docs: establish v1.2.8 repository baseline`
