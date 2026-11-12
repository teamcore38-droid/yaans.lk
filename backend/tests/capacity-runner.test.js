import assert from 'node:assert/strict';
import { test } from 'node:test';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

test('capacity runner refuses external targets and database overrides before starting work without echoing their values', () => {
  const script = fileURLToPath(new URL('../../scripts/benchmark-capacity.mjs', import.meta.url));
  for (const option of ['--url=https://example.invalid/private-marker', '--mongodb-uri=mongodb://example.invalid/private-marker']) {
    let result;
    try { execFileSync(process.execPath, [script, option], { encoding: 'utf8', timeout: 10000, windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'] }); }
    catch (error) { result = error; }
    assert.ok(result && result.status !== 0);
    assert.match(result.stderr, /supports disposable loopback targets only/);
    assert.ok(!result.stderr.includes('private-marker'));
    assert.ok(!result.stdout.includes('wave'));
  }
});
