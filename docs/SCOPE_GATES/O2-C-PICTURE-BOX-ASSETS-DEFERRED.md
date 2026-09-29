# O2-C Picture Box and Assets — Scope Gate record (IMPLEMENTATION DEFERRED)

Documentation record for **v1.4.0-dev.17**. No Source behavior is described here as implemented.

## Status

- Scope Gate: **COMPLETE**
- Implementation: **DEFERRED** (deferred, **not cancelled**)
- Asset Store/API: **NOT STARTED**
- Picture Box UI: **NOT STARTED**
- Server Asset subsystem: **NOT STARTED**
- Dependencies added: **NONE**
- No O2-C Source, API, storage, schema or dependency change exists in the repository.

## Reason

The immediate priority is:

1. Workflow Shared Signal Foundation
2. Workflow access to SHARED_TAG
3. Workflow-scoped Signal and state model
4. Published Workflow Outputs
5. Modbus Write Foundation Audit
6. Controlled Simulator Write validation

O2-C requires a new Server-side asset subsystem and does not directly advance the immediate safe
Modbus Write objective.

## Scope-Gate Base

- Branch reviewed: `arena/01a0eb36-modbus-workflow-studio`
- Checkpoint reviewed: `c633a4426b72f805c279eb1e25c7deba74d2071b`
- Version reviewed: `v1.4.0-dev.16`

When O2-C resumes, implementation must use the **latest Owner-approved Base**, not automatically
the Scope-Gate Base. This record remains architectural input; every Source assumption below must
be revalidated against the new Base.

**Version numbers.** A dev.17/dev.18 split for O2-C was discussed during the Scope Gate. That was
planning-only. Those numbers are **not reserved** (dev.17 is the documentation/PR-readiness
checkpoint). Future O2-C versions are assigned from the latest approved Base at reactivation.

## Source findings at the reviewed Base (revalidate on resume)

- `PICTURE_BOX` is category MONITORING (160×120, no bindable data type, excluded from Runtime
  eligibility and Runtime Details); `STATIC_IMAGE` is category DISPLAY. Both currently render a
  placeholder in `ElementNode.tsx` (`renderPreview`). Do not assume they share one persistence contract.
- No multipart/upload support and no image library are installed. `express.raw`, Node `zlib`,
  `crypto` and `fs` exist. `cors()` is global and unrestricted; `express.json` limit is 256 kb.
  Static delivery covers only `client/dist`. Atomic tmp+rename is the DATA_DIR write convention.
- `targetWorkflowId` is top-level and is rejected on every type except `NAVIGATION_LINK`, on both
  the client (`validateOverviewElements`) and Server (`validateOverviewIdentity`).
- Workflow navigation: `overviewNavigation.navigateOverviewWorkflow` via `App.navigateFromOverview`,
  `OverviewPage.handleNavigateWorkflow` and `ElementNode.handleLinkClick`; View-only, no Start/Stop/Trigger.
- Release ZIP/verify scripts exclude only `data/*.json` and `data/*.log`; image binaries would be included.

## Proposed Implementation Split

**O2-C1 — Asset Store and API:** project-managed storage under DATA_DIR; metadata catalog; upload,
metadata/list and binary-delivery APIs; image validation; security and limits; restart persistence;
content-hash deduplication; usage reporting; Release ZIP and verification exclusions; Server tests.
No Picture Box UI.

**O2-C2 — Picture Box UI:** existing-asset selector; local file selection; upload progress and
cancellation; preview; Replace image; Remove image from Element; STATIC and WORKFLOW_LINK modes;
contain and cover fit; missing/corrupt asset presentation; Inspector; accessibility;
Draft/Save/Cancel/Undo/Redo; Browser Manual Review.

## Proposed Asset Contract

Stable identity: `assetId` (opaque UUID) and `sha256` (integrity and deduplication).
Assets are immutable; identical content reuses the same binary and assetId; renaming or label
changes never change assetId. Replace means pointing at another assetId.

Page JSON stores only `picture.mode`, `picture.assetId`, `picture.fit` and, when mode is
WORKFLOW_LINK, `targetWorkflowId`. It must **not** store Local absolute paths, DATA_DIR paths,
`file://` URLs, `blob:` URLs, Base64 image data or external image URLs. Alt text reuses the
existing `style.text`.

## Proposed Metadata

Asset catalog: assetId, sha256, sanitized original filename, verified MIME type, byte size, width,
height, animation status, created timestamp, optional label.
Derived: delivery URL, OK / MISSING / CORRUPT status, saved-page usage count.

## Proposed Storage

Under DATA_DIR: `assets/blobs/`, `assets/meta/`, `assets/tmp/`.
Required: atomic temporary write and rename; server-generated storage names (never the uploaded
filename); no path traversal; no directory listing; no arbitrary DATA_DIR file serving; restart
recovery (clear tmp, rebuild index, verify blob presence and size); missing/corrupt-data
reporting; no automatic orphan deletion. Assets are runtime data: excluded from Git, backed up
with DATA_DIR and excluded from Release ZIPs.

## Proposed Formats

Include PNG, JPEG, WebP and static GIF. Exclude SVG, animated GIF, APNG, animated WebP and external
URLs. Animated images are **rejected**, not frozen. Node can verify magic bytes, header dimensions,
GIF/APNG/WebP animation flags and PNG structure; full decode validity cannot be proven without a
decoder, so the Browser decode with a safe placeholder is the final check.

## Proposed Limits (for later Owner confirmation)

5 MiB per upload; 4096 px width; 4096 px height; 16 megapixels; one file per request; 200 assets;
256 MiB total asset storage; two concurrent uploads.

## Proposed Upload

Raw request body, one image per request, verified content type, sanitized display filename supplied
separately (percent-encoded header). Mutating routes are mounted before the global permissive CORS
with an Origin policy like the Tag snapshot route. **No multipart dependency is approved.**
Proposed endpoints: `POST /api/assets`, `GET /api/assets`, `GET /api/assets/:id`,
`GET /api/assets/:id/content` (explicit Content-Type, `nosniff`, immutable cache with sha256 ETag,
inline disposition, restrictive CSP, same-origin resource policy), `GET /api/assets/:id/usage`.

## Picture Box Modes

**STATIC:** displays a project-managed asset; no navigation, Runtime subscription, Modbus write or
Workflow action; Edit click selects the Element; View click has no action.

**WORKFLOW_LINK:** displays a project-managed asset; Edit click selects and never navigates; View
activation (native button, keyboard, focus ring) navigates through the existing Workflow navigation
contract; does not Start, Stop or Trigger a Workflow, send a Workflow command or mutate Runtime state.

## Fit Contract

Include later: `contain` (default), `cover` (optional). Defer: fill, original size, configurable
object position. Stored Element geometry is never resized. Missing/corrupt assets show a
non-persisted placeholder and never crash the Canvas.

## Replace, Remove and Delete

Include later: Replace image; Remove image from Element. **Defer:** Delete Asset and automatic
garbage collection, because saved-page usage checks cannot reliably account for unsaved Drafts in
other sessions.

## Server Impact

O2-C requires **Production Server changes**: asset storage, upload route, delivery route, metadata
route, image validation, Origin admission, security and cache headers, Picture Box
`targetWorkflowId` validation, and Release ZIP/verify exclusions. It is not a Client-only change.

## Security Requirements

Preserve protections against MIME spoofing, extension mismatch, polyglot files, path traversal,
unsafe filenames, oversized uploads, excessive dimensions, pixel limits, decompression bombs,
malformed images, animated content, SVG active content, external URL loading, unauthorized file
enumeration, cache poisoning and content sniffing. Origin policy is not authentication; the
trusted-network or authenticated reverse-proxy limitation remains.

## Dependency Decision

No new dependency was approved. The Scope Gate proposed existing Node and project capabilities
only. Any multipart parser or full image decoder requires separate Owner approval.

## Explicit Exclusions

Production Control; Overview Modbus writes; Workflow Start, Stop or Trigger; WORKFLOW_VARIABLE
Runtime; Tag-driven image switching; Runtime-driven animation; general String decoding; external
image URLs; SVG upload; alarm system; Historian or Trends; MQTT/Sparkplug;
Authentication/User Management; O2-D; unapproved dependency upgrades.

## Protected Areas

O2-C must not regress: O2-A Binding and Data Sources; O2-B Shared Tag Acquisition; O2-B2 Snapshot
and WebSocket transport; O2-B3 Runtime presentation and lifecycle; Runtime Details visibility;
Focus/Catalog refresh; Manual Disconnect; no-auto-connect; Runtime isolation; PREVIEW ONLY
Controls; Navigation safety; Workflow Runtime; Modbus Monitor; Traffic Monitor; `/ws/live`; Modbus
write safety; Page revision; Draft/Save/Cancel; Undo/Redo; Element geometry; savedViewport.

## Reactivation Gate

Before O2-C implementation resumes:

1. Identify the latest Owner-approved Base.
2. Verify the Platform-created successor branch.
3. Compare current Source with this record.
4. Revalidate: Picture Box schema, Navigation contract, DATA_DIR conventions, Origin policy,
   Release ZIP rules, dependency graph.
5. Confirm limits and animation policy.
6. Confirm the Asset API / Picture Box UI checkpoint split.
7. Confirm Production Server scope.
8. Assign versions from the latest approved Base.
9. Obtain explicit Owner implementation approval.

Do not repeat the complete Scope Gate unless relevant architecture changed.
