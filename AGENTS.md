# Repository Development Governance

These rules apply to every code change, hotfix, release, and release package in this repository.

## Authority and precedence

When instructions conflict, use this order:

1. The project owner's latest explicit instruction.
2. The approved final scope for the target version.
3. This `AGENTS.md` file.
4. `docs/CURRENT_STATE.md`.
5. The acceptance test for the target version.
6. `docs/ROADMAP.md`.
7. Older proposals that were not approved.

If a new instruction changes a permanent rule, update this file in a separate, clearly described change.

## Scope approval gate

Do not modify source code or create a release ZIP until all required information is complete.

Before implementation:

1. Inspect the actual base source.
2. Verify the base version, tag, branch, or commit.
3. Summarize the final scope.
4. List expected files to change.
5. List protected areas and explicit exclusions.
6. Obtain explicit project-owner approval.

Do not ask for approval again after final scope approval unless a material scope change is required.

## Versioning

- Every code change creates a new application version.
- Never overwrite an approved version, tag, release, or release ZIP.
- Hotfixes also increment the version.
- Keep the root, client, server, UI, health API, startup banner, README, changelog, and current-state versions synchronized.
- Create release tags only from source that passed the approved validation workflow.

## Source verification

Before editing:

- Confirm the base source exists and can be opened.
- Verify `package.json`, `client/package.json`, and `server/package.json` versions.
- Verify ZIP integrity when a ZIP is the source.
- Record the base tag or commit SHA. For ZIP imports, record SHA-256.
- Never reconstruct a newer approved version from an older source when the correct base is unavailable.

## Protected areas

The following behavior is stable and must not regress unless the approved scope explicitly changes it:

- React Flow workflow editor and canvas rendering.
- Node synchronization, positions, drag behavior, selection, and deletion.
- Dynamic input/output ports and handle alignment.
- Connection creation and deletion.
- Undo/redo, Fit View, pan, zoom, and MiniMap.
- Workflow CRUD and selector behavior.
- Independent concurrent workflow runtime sessions.
- Reliable auto-save, save serialization, and revision conflict recovery.
- Manual Trigger modes.
- Shared Modbus device connections and per-device queues.
- Modbus output guards, write-on-change, commanded/effective/read-back separation, and output ownership protection.
- Audit Viewer and read-only Modbus Monitor.
- Logic symbols, Boolean status lamps, and Linear Mapping.

Backend work must not cause Workflow UI or React Flow regression.

## Modbus safety

- All protocol addresses are zero-based unless an approved requirement explicitly states otherwise.
- Disconnect must stop affected polling and reject stale queued requests.
- Manual disconnect must not auto-reconnect unless a later approved policy adds it.
- Stopped or deleted workflows must not write.
- Stale commands must not execute after reconnect.
- Writes require all configured safety guards.
- Keep Commanded Value, Effective Value, and Read-back Value distinguishable.
- Preserve shared device connections and queues.
- The Modbus Monitor is read-only unless a later approved scope explicitly changes it.

## Packaging environment

When preparing a ZIP in the assistant packaging environment:

- Do not run `npm install`.
- Do not run `npm ci`.
- Do not run `npm run check`.
- Do not run `npm run build`.
- Do not create or include `node_modules`.
- Do not include `dist`, coverage, build caches, runtime data, generated workflows, generated monitor lists, logs, temporary files, local secrets, or credential-bearing environment files.

The project owner runs local validation. GitHub Actions may run validation in its isolated CI environment after the project owner enables the workflow.

## Validation reporting

- Static inspection is not equivalent to `npm run check`.
- Never state that typecheck, tests, or build passed unless those commands actually completed successfully.
- Report exactly which checks were performed and which were not.
- The standard validation command is `npm run check`.

## Release handoff

Every release handoff must include:

- Base version and target version.
- Base tag/commit SHA or source ZIP SHA-256.
- Changed files.
- Implemented scope and explicit exclusions.
- Static checks performed.
- Tests not performed.
- Known limitations.
- Local validation commands.
- Release ZIP SHA-256.
