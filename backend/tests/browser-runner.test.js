import assert from 'node:assert/strict';
import { test } from 'node:test';
import path from 'node:path';
import { browserArguments, runBrowserTests } from '../../scripts/run-browser-tests.mjs';

function harness(codes = [0, 0, 0]) {
  const calls = [], copies = [];
  let active = false;
  return { calls, copies, options: {
    environment: { CI: 'true', YAANS_TEST_RUN_ID: 'inherited', YAANS_TEST_PROJECT: 'inherited' },
    prepare: async () => {},
    copy: async (source, destination) => copies.push([source, destination]),
    run: async (args, env) => {
      assert.equal(active, false, 'Projects must never overlap on the reserved loopback ports');
      active = true;
      calls.push({ args, env });
      await new Promise(resolve => setImmediate(resolve));
      active = false;
      return codes[calls.length - 1];
    }
  } };
}

test('browser projects run sequentially with fresh API identities and retain both reports', async () => {
  const { calls, copies, options } = harness();
  assert.equal(await runBrowserTests(['--grep', 'cart'], options), 0);
  assert.deepEqual(calls.map(call => call.args.slice(0, 1)), [['test'], ['test'], ['merge-reports']]);
  assert.deepEqual(calls.slice(0, 2).map(call => call.args), [
    ['test', '--grep', 'cart', '--project=chromium'],
    ['test', '--grep', 'cart', '--project=mobile-chromium']
  ]);
  const [desktop, mobile, merge] = calls.map(call => call.env);
  assert.notEqual(desktop.YAANS_TEST_RUN_ID, mobile.YAANS_TEST_RUN_ID);
  for (const env of [desktop, mobile]) {
    assert.notEqual(env.YAANS_TEST_RUN_ID, 'inherited');
    assert.equal(env.CI, 'true');
  }
  assert.notEqual(desktop.YAANS_TEST_BLOB_DIR, mobile.YAANS_TEST_BLOB_DIR);
  assert.equal(copies.length, 2);
  assert.notEqual(copies[0][1], copies[1][1]);
  assert.equal(path.dirname(copies[0][1]), path.dirname(copies[1][1]));
  assert.equal(merge.YAANS_TEST_PROJECT, '');
  assert.equal(merge.YAANS_TEST_BLOB_DIR, '');
});

test('failed projects remain failed after report merge, without retries or skipping the other project', async () => {
  for (const codes of [[1, 0, 0], [0, 1, 0], [0, 0, 1]]) {
    const { calls, copies, options } = harness(codes);
    assert.equal(await runBrowserTests([], options), 1);
    assert.equal(calls.length, 3);
    assert.equal(copies.length, 2);
  }
});

test('missing reports fail verification instead of merging stale successes', async () => {
  const { calls, options } = harness();
  options.copy = async () => { throw new Error('missing report'); };
  await assert.rejects(runBrowserTests([], options), /missing report/);
  assert.equal(calls.length, 1);
});

test('project filters select one isolated run and cannot override managed output or configuration', async () => {
  assert.deepEqual(browserArguments(['--project', 'mobile-chromium', '--grep=cart']), {
    selected: ['mobile-chromium'], forwarded: ['--grep=cart']
  });
  for (const args of [['--project'], ['--project=unknown'], ['--reporter=dot'], ['--config=external.js'], ['--output', 'elsewhere']]) {
    assert.throws(() => browserArguments(args));
  }
  const { calls, copies, options } = harness([0, 0]);
  assert.equal(await runBrowserTests(['--project=chromium'], options), 0);
  assert.equal(calls.length, 2);
  assert.equal(copies.length, 1);
});
