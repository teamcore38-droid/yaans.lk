import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const srcDir = path.resolve(__dirname, '../src');

function walk(dir) {
  let results = [];
  const list = fs.readdirSync(dir);
  for (const file of list) {
    const fullPath = path.join(dir, file);
    const stat = fs.statSync(fullPath);
    if (stat && stat.isDirectory()) {
      results = results.concat(walk(fullPath));
    } else if (file.endsWith('.jsx')) {
      results.push(fullPath);
    }
  }
  return results;
}

const files = walk(srcDir);
let violations = 0;

for (const f of files) {
  const content = fs.readFileSync(f, 'utf8');
  const lines = content.split('\n');

  let inComponent = false;
  let componentName = '';
  let compBraceDepth = 0;
  let currentBraceDepth = 0;
  let earlyReturnSeen = false;
  let earlyReturnLine = 0;

  for (let i = 0; i < lines.length; i++) {
    const lineNum = i + 1;
    const line = lines[i];
    const trimmed = line.trim();

    // Detect function component start
    const compMatch =
      trimmed.match(/^export\s+(?:default\s+)?function\s+([A-Za-z0-9_]+)/) ||
      trimmed.match(/^function\s+([A-Z][A-Za-z0-9_]+)/);

    if (compMatch && !inComponent) {
      inComponent = true;
      componentName = compMatch[1];
      compBraceDepth = currentBraceDepth;
      earlyReturnSeen = false;
    }

    // Check if at component level (one block inside the component)
    // before updating braces for this line
    const isAtComponentLevel = inComponent && currentBraceDepth === compBraceDepth + 1;

    // Detect component-level early return:
    // e.g., if (!user) return <div... or if (loading) { return ...
    if (
      isAtComponentLevel &&
      (trimmed.startsWith('if ') || trimmed.startsWith('if(')) &&
      (trimmed.includes('return <') ||
        trimmed.includes('return (') ||
        trimmed.includes('return null') ||
        trimmed.includes('return;'))
    ) {
      earlyReturnSeen = true;
      earlyReturnLine = lineNum;
    }

    if (isAtComponentLevel && earlyReturnSeen) {
      const hook = trimmed.match(
        /\b(useMemo|useEffect|useState|useCallback|useRef|useReducer)\s*\(/
      );
      if (hook && !trimmed.startsWith('//') && !trimmed.startsWith('*')) {
        console.error(
          `\x1b[31m[HOOK RULE ERROR]\x1b[0m ${path.relative(
            process.cwd(),
            f
          )}:${lineNum} in ${componentName}: Hook '${
            hook[1]
          }' called after early return at line ${earlyReturnLine}.`
        );
        violations++;
      }
    }

    // Update brace depth
    for (const char of line) {
      if (char === '{') currentBraceDepth++;
      if (char === '}') currentBraceDepth--;
    }

    // If we closed the component's outer block
    if (inComponent && currentBraceDepth <= compBraceDepth && i > 0 && line.includes('}')) {
      inComponent = false;
      earlyReturnSeen = false;
    }
  }
}

if (violations > 0) {
  console.error(
    `\n\x1b[31mBuild aborted: Found ${violations} React Hook Rule violation(s). Move all hooks to the top level before any early return statements.\x1b[0m\n`
  );
  process.exit(1);
} else {
  console.log(
    '\x1b[32m✓ React Rules of Hooks verified: 0 conditional or late hooks detected.\x1b[0m'
  );
}
