# MODBUS WORKFLOW STUDIO v1.3.0
## Overview Designer Foundation

Release candidate promoted from `v1.3.0-dev.2` at approved Final O1 checkpoint
`58c3586e1f433b44fca53bf2c183be6065a796e5`.

Owner confirmed O1-A, O1-B, O1-C, O1-D and Final O1 Manual Review PASS.
Release Pull Request review and manual merge remain pending Owner action.

### Included
- Overview Page management and Overview Editor
- Element Library and Inspector
- Draft, Undo/Redo, Save and Cancel
- View/Edit boundaries
- Independent persisted Preview Control state, isolated from Page revisions
- savedViewport
- Accessibility and responsive baseline
- Draft Tag binding configuration (NOT_BOUND/DRAFT, not connected to runtime)

### Explicit exclusions
- Production Monitoring Runtime
- Live Modbus values in Overview
- Production Control Runtime
- Modbus writes from Overview
- Tag Runtime
- Variable Blocks integration
- MQTT implementation or MQTT Sparkplug adapter

MQTT Sparkplug B is a future architecture plan only. No v1.4 work is included.
Existing Workflow Modbus capabilities must not be confused with Overview runtime.

### Delivery boundaries
The PR intentionally includes the complete approved O1 implementation absent
from `main` at `5c9a6a014fe6f7cf850daf4c62beaa59638a5da1`.
The new release-preparation commit changes only version values, version-test
expectations and release/acceptance documentation. No feature behavior, API
contract, dependency version or lockfile dependency resolution changes.

No Git tag, GitHub Release, release ZIP, auto-merge or merge is authorized.

### Validation disclosure
Release automated execution results are recorded in the PR body. Existing SSR
Tooltip tests may warn about useLayoutEffect; Vite may warn about the main bundle
exceeding 500 kB. These warnings are not claimed resolved by this release.
No new browser, hardware, screen-reader or manual responsive tests are performed
by the release agent. Prior Owner Final O1 acceptance and pending release PR
review are separate decisions.
