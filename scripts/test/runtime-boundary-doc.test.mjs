import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
const read = path => fs.readFileSync(new URL('../../' + path, import.meta.url), 'utf8');
const doc = read('docs/ACCEPTANCE_TESTS/O2-B1-RUNTIME-BOUNDARY-v1.4.0-dev.8.md');
test('documented files match actual production persistence source', () => {
  for (const [source, file] of [['overviewControlStates.ts','overview-control-states.json'], ['definitionCatalog.ts','source-definitions.json'], ['acquisitionConfig.ts','shared-tag-acquisition.json'], ['overviewPages.ts','overview-pages.json']]) {
    assert.ok(read('server/src/' + source).includes(file)); assert.ok(doc.includes(file));
  }
  const pages = read('server/src/overviewPages.ts'); assert.ok(pages.includes("path.join(dataDir, 'overview-pages')")); assert.ok(pages.includes('`${id}.json`')); assert.ok(doc.includes('overview-pages/{0}.json'));
});
test('PowerShell checks DATA_DIR and enumerates optional/nested files, revisions and SHA256', () => {
  for (const text of ['DATA_DIR: {0}', 'IsNullOrWhiteSpace($env:DATA_DIR)', '-PathType Container', 'Optional file absent:', 'Get-ChildItem', '-Algorithm SHA256', '$revisions', 'BeforeExists', 'AfterExists', 'Sort-Object -Unique']) assert.ok(doc.includes(text), text);
});
test('comparison is readable, read-only and retains prior before hashes', () => {
  for (const text of ['FileName  Unchanged', 'Format-List', 'Write-Host', '$BeforeBoundary', '$AfterBoundary', '$BeforeHashes', 'cannot retroactively prove']) assert.ok(doc.includes(text), text);
  const code = [...doc.matchAll(/```powershell\n([\s\S]*?)```/g)].map(m => m[1]).join('\n');
  assert.equal([...doc.matchAll(/```powershell/g)].length, 3);
  assert.doesNotMatch(code, /Set-Content|Out-File|Remove-Item|New-Item|WriteAll|Invoke-RestMethod|Invoke-WebRequest|Format-Table/);
});
test('no claim of Browser sample observation or hash proof for Draft history', () => {
  for (const text of ['NOT DIRECTLY OBSERVABLE BY DESIGN IN O2-B1', 'NOT provable by file hashes', 'PENDING Owner', 'Mapping persistence is expected', 'no restored sample/last-good', 'No diagnostics endpoint']) assert.ok(doc.includes(text), text);
});
