# Release Process

1. Ensure the target branch contains only approved scope.
2. Ensure versions are synchronized across root, client, server, UI, health API, startup banner, README, changelog, and current state.
3. Run `npm run check` locally or through approved CI.
4. Create a clean source ZIP using the provided script.
5. Verify exclusions and SHA-256.
6. Merge through pull request after required checks pass.
7. Create an annotated tag such as `v1.2.9`.
8. Create a GitHub Release and attach the clean ZIP.
9. Update `docs/CURRENT_STATE.md` with the release tag, commit SHA, validation result, and known issues.
