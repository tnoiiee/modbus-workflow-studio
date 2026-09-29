# O2-A v1.4.0-dev.5 — Inspector motion and saved references

- Branch: `arena/01a0d291-modbus-workflow-studio`.
- Approved base: `d801666b6a9a650f62a2d4c68eca530e0d894dd9`, v1.4.0-dev.4.
- Dev.4 Owner review: **APPROVED WITH PUNCHLIST**; other tested O2-A functionality passed.
- Owner subsequently authorized the exact read-only batch API and additive direction contract.
- Dev.5 Owner Local Manual Review **PENDING**. PR **NOT OPENED**; O2-B/O2-C/O2-D **NOT STARTED**.

## Design and behavior

Overview uses the existing 200ms layout / 120ms opacity motion tokens and easing. The stable layout
slot keeps the same number of grid tracks, including an Inspector-owned gutter; a closed Inspector
returns both its width and gutter to Canvas. Canvas stays mounted. Hidden fields unmount immediately,
so neither obsolete data nor hidden interactive controls survive a deselect. Reselect shows only the
new Element. Manual collapse preference is preserved. Reduced motion disables transitions. Lost
Inspector focus returns to the Canvas with `preventScroll`, not to another Element or a zoom action.
Workflow motion was inspected as a reference, but Workflow files/behavior were not changed.

Saved usage is visible without a diagnostic click: `0 bindings`, `1 binding`, `N bindings`.
Non-zero counts open a non-modal reading pane, grouped by readable saved Overview Page, then Element
name/type/direction, with IDs as secondary disclosures. Close/Escape return to the invoking count;
if it no longer exists, focus returns to the catalog toolbar. Tab is not trapped. Definition CRUD
remains available, and reference failures are separate from catalog failures and never shown as zero.

## Approved API contract

`POST /api/source-definitions/references/batch`

Request: `{ "sources": SourceIdentity[] }`, minimum 1, maximum 100 before deduplication. Existing
strict UUID identity schema; unsupported types, incomplete IDs and unknown fields return 400.
Malformed JSON is sanitized on this route; oversized parser payloads retain 413 protection.

Response:

```json
{
  "scope": "SAVED_OVERVIEW_PAGES",
  "unsavedDraftsIncluded": false,
  "results": [
    {
      "source": { "sourceType": "SHARED_TAG", "sourceId": "11111111-1111-4111-8111-111111111111" },
      "found": true,
      "pageCount": 2,
      "bindingCount": 3
    }
  ]
}
```

- Results follow first occurrence of each unique complete stable identity in the request.
- `found:false` differs from an existing Definition with zero bindings; missing sources return zero
  counts but the UI displays **Definition unavailable**, never a misleading zero-use claim.
- One `pages.list()` and one `pages.get()` per saved Page per request, matching all sources in an
  in-request map. No repeated per-definition scanner, persistent cache, background index or runtime.
- `pageCount` counts distinct saved Pages; `bindingCount` counts matching saved Element bindings.
- Navigation Links and legacy name/Tag text are not source-identity matches. No unsaved Draft access.
- No writes, Page revisions, Definition/Binding mutations, Workflow/Modbus actions or runtime values.

Existing individual reference GET endpoints remain compatible. Their reference entries gain optional
`direction: MONITOR | COMMAND | NONE`, copied only from saved binding configuration. Missing/invalid
legacy direction is omitted and displayed as “Not specified (legacy)”; no inference or saved rewrite.
Existing reference fields, missing-source 404 and Delete-impact behavior remain intact.

## Frontend loading and lifecycle

Catalog load/refresh dispatches sequential batches of at most 100 identities (one in flight per
catalog generation), not one request per Definition. Empty catalogs issue no batch. Rendering,
search and filters do not reload counts. Definition operations refresh/invalidate summaries/details.
Only activated non-zero counts request individual details; successful details are cached in memory
for the current catalog generation. No detail sweep, timer or runtime transport.

Generation checks prevent old catalog/count/detail responses from publishing after refresh,
navigation/unmount. Queued stale batches stop; an already in-flight request may finish under the
existing API timeout but its result is ignored. A newer detail read is not overwritten when a later
summary batch finishes. Failed batches are explicit and do not prevent later batches or normal CRUD.

## Required automated evidence

- Server HTTP tests: both identity types; mixed/multiple/duplicate identities; min/max/invalid/unknown
  fields; found vs zero; distinct Pages/multiple Elements; one scan per Page for 100 identities;
  saved-only scope, byte/revision/Definition preservation; direction and legacy omission; safe errors.
- Existing individual GET/Delete/MISSING and identity-isolation regressions retained.
- Client batch tests: <=100 one request, >100 bounded sequential requests, no eager details, loading,
  singular/plural/zero/missing/error, retry, refresh/operation invalidation and stale/unmount protection.
- Details: Page/Element/type/direction, current source isolation, lazy cache, error/retry, Close/Escape,
  focus entry/return/fallback, no Tab trap and explicit unsaved-Draft exclusion.
- Inspector: hidden controls absent, fresh content, focus recovery/no theft, reduced-motion CSS;
  existing Page harness verifies no geometry/history/revision/API/viewport changes on deselect/reselect.
- Protected selected-only drag, grid ID isolation, Font Size liveDraft, savedViewport, Navigation Link,
  independent Control state and Workflow/Devices integrity stay in the complete regression suites.

### Executed validation

| Gate | Result |
| --- | --- |
| Stage 1 targeted Client UX/regressions | PASS — 443 tests / 25 files |
| Stage 1 targeted Server references/routes/integration | PASS — 37 tests / 4 files |
| Client typecheck | PASS |
| Server typecheck | PASS |
| Client build | PASS |
| Full Client | PASS — 517 tests / 35 files |
| Full Server | PASS — 110 tests / 10 files |
| `npm run check` | PASS — both typechecks, full suites and both builds |

No validation correction/retry was needed. The final focus-on-source-change refinement is covered
by Full Client and `check`. Final minified JS bundle: 637.69 kB. Strict hygiene/publish/diff and
actual Remote equality are reported in the delivery handoff after final documentation verification.

SSR/component/event/CSS tests are not browser pointer, computed-width/animation, screen-reader or
visual regression evidence. Browser/manual checks below remain PENDING.

## Owner local manual review — PENDING

1. Select A, blank Canvas, select B repeatedly at normal/reduced motion; watch smooth width recovery,
   no Canvas flash, no stale fields or hidden tab stops. Exact pan/zoom/geometry/history stay unchanged.
2. Input/select/Font Size, resize/drag, dialogs, manual collapse and Data Sources navigation preserve
   selection/focus appropriately. One drag/resize/property gesture still produces one Undo.
3. Open Data Sources: automatic counts, singular/plural/zero, responsive long names/IDs and deliberate
   column/action hierarchy. No initial per-definition details requests in the browser network panel.
4. Activate a count by keyboard; inspect readable Pages/Elements/type/direction and secondary IDs.
   Close/Escape returns focus; Tab can leave the non-modal pane. Test loading, failure, retry and zero.
5. Test <=100 and >100 catalogs, rapid Refresh, source switches, route unmount, CRUD and Delete/MISSING.
   Counts/details must not regress to earlier responses or claim false zero on network failure.
6. Verify unsaved browser Draft bindings are excluded, saved changes appear after Refresh, and Delete
   confirmation/impact, Unit data, immutable IDs and resolver status meanings are unchanged.
7. Recheck Workflow grid/navigation, Workflow/Devices runtime isolation, independent Preview state,
   Page CRUD/Save/Cancel/Undo/Redo, savedViewport and Font Size liveDraft. No Production Control.

## Scope and warnings

Only approved reference calculation/routes/registration/tests plus frontend UX/version/docs change.
No other Server behavior, API shape, persistence, resolver, runtime or WS contract changes.
No O2-B/O2-C/O2-D, Picture Box, runtime Tag values/transport/acquisition, MQTT/Sparkplug or commands.
No dependency upgrade, Tag, Release or ZIP. BOUND is configuration-only, not control authority.

Advisories: **5 moderate, 1 high, 1 critical — Not resolved / Not accepted /
Not part of this Punchlist**. Known SSR useLayoutEffect and bundle-size warnings remain nonfatal.
