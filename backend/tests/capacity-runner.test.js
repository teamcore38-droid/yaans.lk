import assert from 'node:assert/strict';
import { test } from 'node:test';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { assessCapacitySample } from '../../tests/performance/targets.mjs';

test('capacity targets include slow detail, search, home and quote paths rather than hiding them behind fast lists', () => {
  const routes = { catalog: { requests: 100, p95Ms: 10 }, checkout: { requests: 10, p95Ms: 100 } };
  assert.equal(assessCapacitySample({ routes }).passed, true);
  for (const kind of ['detail', 'search', 'home', 'quote']) {
    assert.ok(assessCapacitySample({ routes: { ...routes, [kind]: { requests: 20, p95Ms: 1100 } } }).breaches.includes(`${kind}_p95`));
  }
  assert.equal(assessCapacitySample({ routes: {} }).passed, false);
  assert.equal(assessCapacitySample({ routes, statuses: { '429': 1 } }).passed, false);
  assert.equal(assessCapacitySample({ routes, unexpectedErrors: 1 }).passed, false);
  assert.equal(assessCapacitySample({ routes, aborted: true }).passed, false);
  assert.equal(assessCapacitySample({ routes: { ...routes, checkout: { requests: 10, p95Ms: 2001 } } }).passed, false);
});

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
