import { spawn } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { mkdir, copyFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';

const root = fileURLToPath(new URL('..', import.meta.url));
const cli = createRequire(import.meta.url).resolve('@playwright/test/cli');
const projects = ['chromium', 'mobile-chromium'];

function execute(args, env) {
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, [cli, ...args], { cwd: root, env, stdio: 'inherit', windowsHide: true });
    child.once('error', reject);
    child.once('exit', (code) => resolve(code ?? 1));
  });
}

export function browserArguments(args) {
  const selected = [];
  const forwarded = [];
  for (let index = 0; index < args.length; index++) {
    const argument = args[index];
    if (argument === '--project') selected.push(args[++index]);
    else if (argument.startsWith('--project=')) selected.push(argument.slice('--project='.length));
    else if (/^(?:--config|--reporter|--output|-c)(?:=|$)/.test(argument)) {
      throw new Error('The isolated browser runner manages configuration, reporters and output. Use npx playwright test for custom configuration.');
    } else forwarded.push(argument);
  }
  if (selected.some(project => !projects.includes(project))) throw new Error('Select chromium or mobile-chromium.');
  return { selected: selected.length ? [...new Set(selected)] : projects, forwarded };
}

export async function runBrowserTests(args = [], { run = execute, environment = process.env, prepare = mkdir, copy = copyFile } = {}) {
  const { selected, forwarded } = browserArguments(args);
  const reports = path.join(root, 'test-results', 'browser-blobs', randomUUID());
  const merged = path.join(reports, 'merged');
  await prepare(merged, { recursive: true });
  let failed = false;
  for (const project of selected) {
    // Each Playwright invocation owns a fresh API process, rate-limit budget,
    // MongoDB replica set and explicit shutdown. Never reset production limits.
    const report = path.join(reports, project);
    const env = { ...environment, YAANS_TEST_RUN_ID: randomUUID(), YAANS_TEST_PROJECT: project, YAANS_TEST_BLOB_DIR: report };
    const code = await run(['test', ...forwarded, `--project=${project}`], env);
    failed ||= code !== 0;
    await copy(path.join(report, 'report.zip'), path.join(merged, `${project}.zip`));
  }
  // Merge failed runs too, and never let a successful merge hide a failed test.
  const mergeCode = await run(['merge-reports', '--config=playwright.config.js', merged], {
    ...environment, YAANS_TEST_PROJECT: '', YAANS_TEST_BLOB_DIR: ''
  });
  return failed || mergeCode !== 0 ? 1 : 0;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try { process.exitCode = await runBrowserTests(process.argv.slice(2)); }
  catch (error) { console.error(`[browser verification] ${error.message}`); process.exitCode = 1; }
}
