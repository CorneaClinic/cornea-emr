import { execSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

const root = path.join(process.cwd(), 'apps', 'clinic');

function walk(dir) {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
    const p = path.join(dir, e.name);
    return e.isDirectory() ? walk(p) : [p];
  });
}

const files = walk(root).filter((f) => f.endsWith('.js'));
const failures = [];

for (const file of files) {
  try {
    execSync(`node --check "${file}"`, { stdio: 'pipe' });
  } catch (err) {
    failures.push({ file, msg: String(err.stderr || err.stdout || err.message) });
  }
}

if (failures.length) {
  console.error('Syntax errors:');
  for (const f of failures) {
    console.error(f.file);
    console.error(f.msg);
  }
  process.exit(1);
}

console.log(`OK: ${files.length} clinic JS files`);
