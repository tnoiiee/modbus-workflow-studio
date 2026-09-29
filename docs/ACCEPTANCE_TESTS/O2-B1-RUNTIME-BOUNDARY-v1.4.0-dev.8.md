# Owner-local persistence boundary — O2-B1 dev.8

Status: **PENDING Owner after-hash comparison**. Owner has located and captured before hashes
for the four top-level files below. Their existence and before capture are confirmed, not an
assertion that the after comparison has passed. Do not interpret truncated console columns as failure.

## What is observable

- Disk configuration bytes and Overview Page revisions: observable using the read-only procedure.
- Canonical Tag value, Quality, Sequence, epoch and last-good in Browser:
  **NOT DIRECTLY OBSERVABLE BY DESIGN IN O2-B1**.
- Browser Draft and Undo/Redo: NOT provable by file hashes. Check in-session UI separately.
- Existing automated `sharedTagAcquisition`, `acquisitionRestart`, `acquisitionLifecycle` and
  `tagRuntime` tests provide production-class memory-only/fencing/restart evidence, not a Browser
  observer. No runtime API, console observer or Tag delivery is introduced.

## Actual layout and baseline discipline

Source of truth: `server/src/overviewPages.ts` stores an array index in `overview-pages.json`
AND separate `overview-pages/<id>.json` documents. Hashing the index alone is insufficient.
`definitionCatalog.ts`, `acquisitionConfig.ts` and `overviewControlStates.ts` store, respectively,
`source-definitions.json`, `shared-tag-acquisition.json`, `overview-control-states.json`.
These three are optional until their configuration/state has been saved; an absent file is recorded,
not silently ignored. The Overview index is expected after server startup; every referenced Page
must exist. All nested Page JSON files are included, even if not currently indexed.

Use an isolated simulator DATA_DIR with writes disabled and unrelated owners stopped. Explicitly
save the intended Definitions, mapping, Page and Preview Control-state FIRST, and let startup
initialization settle. During observation do not edit/save/remove mappings, Definitions or Pages,
and do not operate Preview controls: those actions legitimately change the protected files.
Use the same PowerShell session, same server DATA_DIR and the same before snapshot throughout.
The functions below read files only and keep snapshots in memory; they do not create files.

## A. Define read-only snapshot helpers and capture Before

Set the existing server DATA_DIR in your PowerShell environment if it is not already set. The
procedure deliberately does not guess a default path or create a missing directory.

```powershell
$ErrorActionPreference = 'Stop'
Write-Host ("DATA_DIR: {0}" -f $env:DATA_DIR)
if ([string]::IsNullOrWhiteSpace($env:DATA_DIR)) { throw 'DATA_DIR is unset. Set it to the isolated server data directory.' }
if (-not (Test-Path -LiteralPath $env:DATA_DIR -PathType Container)) { throw 'DATA_DIR does not exist or is not a directory.' }
$BoundaryRoot = (Resolve-Path -LiteralPath $env:DATA_DIR).Path

function Get-BoundarySnapshot {
    param([Parameter(Mandatory=$true)][string]$Root)
    $indexPath = Join-Path $Root 'overview-pages.json'
    if (-not (Test-Path -LiteralPath $indexPath -PathType Leaf)) { throw 'Missing overview-pages.json. Complete startup before capturing the baseline.' }
    $index = @(Get-Content -LiteralPath $indexPath -Raw | ConvertFrom-Json)
    $names = @('overview-control-states.json', 'source-definitions.json', 'shared-tag-acquisition.json', 'overview-pages.json')
    $revisions = @{}
    foreach ($page in $index) {
        if ($null -eq $page -or [string]$page.id -notmatch '^[0-9a-fA-F-]{36}$') { throw 'Invalid Page ID in Overview index.' }
        $relative = 'overview-pages/{0}.json' -f $page.id
        if (-not (Test-Path -LiteralPath (Join-Path $Root $relative) -PathType Leaf)) { throw ("Missing indexed Page: {0}" -f $relative) }
        $names += $relative
        $revisions['index/' + $page.id] = [string]$page.revision
    }
    $pageDirectory = Join-Path $Root 'overview-pages'
    if (Test-Path -LiteralPath $pageDirectory -PathType Container) {
        foreach ($file in @(Get-ChildItem -LiteralPath $pageDirectory -Filter '*.json' -File)) {
            $relative = 'overview-pages/' + $file.Name
            $names += $relative
            $page = Get-Content -LiteralPath $file.FullName -Raw | ConvertFrom-Json
            $revisions[$relative] = [string]$page.revision
        }
    }
    $files = @{}
    foreach ($name in @($names | Sort-Object -Unique)) {
        $absolute = Join-Path $Root $name
        $exists = Test-Path -LiteralPath $absolute -PathType Leaf
        $hash = $null
        if ($exists) { $hash = (Get-FileHash -LiteralPath $absolute -Algorithm SHA256).Hash }
        else { Write-Host ("Optional file absent: {0}" -f $name) }
        $files[$name] = [pscustomobject]@{ FileName = $name; Exists = $exists; Hash = $hash }
    }
    [pscustomobject]@{ Root = $Root; Files = $files; Revisions = $revisions }
}

function Compare-BoundarySnapshot {
    param($Before, $After)
    if ($Before.Root -ne $After.Root) { throw 'DATA_DIR changed between snapshots.' }
    Write-Host 'FileName  Unchanged'
    foreach ($name in @( (@($Before.Files.Keys) + @($After.Files.Keys)) | Sort-Object -Unique)) {
        $a = $Before.Files[$name]; $b = $After.Files[$name]
        $unchanged = $null -ne $a -and $null -ne $b -and $a.Exists -eq $b.Exists -and $a.Hash -eq $b.Hash
        Write-Host ("{0}  {1}" -f $name, $unchanged)
        [pscustomobject]@{ FileName = $name; Before = $a.Hash; After = $b.Hash; BeforeExists = $a.Exists; AfterExists = $b.Exists; Unchanged = $unchanged } | Format-List
    }
    Write-Host 'Overview Page revisions (separate from hashes)'
    foreach ($name in @( (@($Before.Revisions.Keys) + @($After.Revisions.Keys)) | Sort-Object -Unique)) {
        $a = $Before.Revisions[$name]; $b = $After.Revisions[$name]
        $same = $Before.Revisions.ContainsKey($name) -and $After.Revisions.ContainsKey($name) -and $a -eq $b
        Write-Host ("{0}  Before={1}  After={2}  Unchanged={3}" -f $name, $a, $b, $same)
    }
}

$BeforeBoundary = Get-BoundarySnapshot -Root $BoundaryRoot
$BeforeBoundary.Files.Values | Sort-Object FileName | Format-List FileName, Exists, Hash
$BeforeBoundary.Revisions.GetEnumerator() | Sort-Object Name | Format-List Name, Value
```

## B. Observe acquisition, then display After / Unchanged

Do NOT recapture or overwrite `$BeforeBoundary` between Before and After. Explicitly connect the
existing Device to the simulator, let polling run, close/reopen Browser, manually disconnect and
wait beyond poll/stale thresholds. No configuration changes and no Preview control interactions.
Then run ONLY this block in the same session:

```powershell
$AfterBoundary = Get-BoundarySnapshot -Root $BoundaryRoot
Compare-BoundarySnapshot -Before $BeforeBoundary -After $AfterBoundary
```

Output starts with compact lines like `overview-control-states.json  True`, followed by Format-List
showing full Before/After hashes and existence flags. Long values wrap rather than being truncated
into table columns. A missing optional file on both sides is unchanged/absent, not proof that it was
hashed. New/deleted files or changed hashes/revisions report False (missing indexed pages fail clearly).
A False result requires investigating legitimate writes/startup/config edits; it is not automatically
proof that the Runtime Store persisted samples.

## C. If the Owner already has Get-FileHash before results

Keep those results; do not replace them with new hashes and call that the original baseline.
For an existing `$BeforeHashes` array of Get-FileHash records (`Path`, `Hash`), this after-only
adapter compares the recorded files without truncated columns. Assign that variable to the Owner's
existing before-result variable, not to a fresh Get-FileHash invocation. If the prior baseline is a
different shape, retain it and use A/B for a new explicitly labelled complete observation.

```powershell
if (-not (Get-Variable -Name BeforeHashes -ErrorAction SilentlyContinue)) { throw 'BeforeHashes is absent. Keep and supply the original Get-FileHash records.' }
foreach ($before in @($BeforeHashes)) {
    if (-not $before.Path -or -not $before.Hash) { throw 'Expected original Get-FileHash Path/Hash records.' }
    $after = $null
    if (Test-Path -LiteralPath $before.Path -PathType Leaf) { $after = (Get-FileHash -LiteralPath $before.Path -Algorithm SHA256).Hash }
    Write-Host ("{0}  Unchanged={1}" -f (Split-Path -Leaf $before.Path), ($null -ne $after -and $before.Hash -eq $after))
    [pscustomobject]@{ Path = $before.Path; Before = $before.Hash; After = $after; Unchanged = ($null -ne $after -and $before.Hash -eq $after) } | Format-List
}
```

This adapter cannot retroactively prove nested Page hashes, revisions, or absent-file baselines that
were not captured before. Complete those in a separate A/B observation; do not invent old evidence.

## D. Restart and acceptance record

Restart the Server with the SAME DATA_DIR without reconnecting the Device. Repeat B against the
same stable configuration baseline. Confirm the mapping is present through the existing Acquisition
configuration editor, then Cancel (no Save). Mapping persistence is expected; restoring Tag samples
is not. Restart must not auto-connect or start physical reads solely from a Browser/mapping.

Record separately:

- Definitions bytes unchanged: PENDING Owner.
- Acquisition configuration bytes unchanged under polling: PENDING Owner.
- Page index AND nested Page bytes/revisions unchanged: PENDING Owner.
- Independent Control-state bytes unchanged: PENDING Owner.
- Mapping retained after restart: PENDING Owner.
- New Store lifecycle/no restored sample/last-good: automated process-harness evidence;
  **NOT DIRECTLY OBSERVABLE BY DESIGN IN O2-B1** in Browser.
- Draft/UndoRedo no runtime mutation: separate in-session review; file hashes cannot establish it.
  A full Browser reload need not retain an unsaved Draft.
- Manual Disconnect and queue/poller shutdown: Owner PASS from dev.7, retained.

Never use RX success as proof of canonical Tag GOOD, and never create a separate console Store
and claim it observes the running service. No diagnostics endpoint or Browser Tag values required.
