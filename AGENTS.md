# Repository Development Governance

These rules apply to every code change, hotfix, release, and release package.

## Authority and precedence

1. Project owner's latest explicit instruction.
2. Approved final scope for the target version.
3. This `AGENTS.md`.
4. `docs/CURRENT_STATE.md`.
5. Target acceptance test.
6. `docs/ROADMAP.md`.
7. Older unapproved proposals.

## Scope approval gate

Do not modify source code or create a release ZIP until required information is complete.

Before implementation:

1. Inspect the actual base source.
2. Verify base version, branch, tag, or commit.
3. Summarize final scope and expected files to change.
4. List protected areas and explicit exclusions.
5. Obtain explicit project-owner approval.

Do not request approval again after final approval unless a material scope change is required.

## Versioning

- Every code change creates a new application version.
- Never overwrite an approved version, tag, release, or release ZIP.
- Hotfixes also increment the version.
- Keep root, client, server, UI, health API, startup banner, README, changelog, and current-state versions synchronized.

## Source verification

- Confirm the actual base source exists and is readable.
- Verify versions in root, client, and server package files.
- Verify ZIP integrity when applicable.
- Record base commit SHA or source ZIP SHA-256.
- Never reconstruct a newer approved release from an older source if the correct base is unavailable.

## Protected areas

The following behavior must not regress unless explicitly approved:

- React Flow editor and canvas rendering.
- Node synchronization, drag, position, selection, and deletion.
- Dynamic ports and handle alignment.
- Connection creation/deletion and Undo/Redo.
- Fit View, pan, zoom, and MiniMap.
- Workflow CRUD and selector.
- Concurrent workflow runtime isolation.
- Reliable auto-save and revision recovery.
- Manual Trigger behavior.
- Shared Modbus connections and queues.
- Modbus output guards, write-on-change, read-back separation, and ownership protection.
- Audit Viewer and read-only Modbus Monitor.
- Logic symbols, Boolean lamps, and Linear Mapping.

Backend changes must not regress Workflow UI or React Flow behavior.

## Modbus safety

- Protocol addresses are zero-based unless explicitly approved otherwise.
- Disconnect stops affected polling and rejects stale queued requests.
- Manual disconnect does not auto-reconnect unless later approved.
- Stopped or deleted workflows do not write.
- Stale commands do not execute after reconnect.
- Writes require all configured safety guards.
- Commanded, Effective, and Read-back values remain distinguishable.
- Modbus Monitor remains read-only unless explicitly approved otherwise.

## Packaging environment

When the assistant prepares a ZIP:

- Do not run `npm install` or `npm ci`.
- Do not run `npm run check` or `npm run build`.
- Do not create/include `node_modules`.
- Exclude `dist`, coverage, caches, runtime data, generated workflows, generated monitor lists, logs, temporary files, credentials, and local secrets.

The project owner runs local validation. Approved GitHub Actions may run validation in isolated CI.

## Validation reporting

- Static inspection is not equivalent to `npm run check`.
- Never claim typecheck, tests, or build passed unless actually executed successfully.
- Report exactly what was and was not tested.

## Release handoff

Report base/target versions, source SHA, changed files, scope, exclusions, static checks, unperformed tests, known limits, local commands, and release ZIP SHA-256.
