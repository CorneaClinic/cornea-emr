import { readFileSync, mkdirSync, writeFileSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const transcript =
  'C:/Users/Hp/.cursor/projects/c-Users-Hp-Documents/agent-transcripts/3833f64a-beb1-46a7-9fa9-5de60e0b25b5/3833f64a-beb1-46a7-9fa9-5de60e0b25b5.jsonl';

const lines = readFileSync(transcript, 'utf8').split('\n');
const reportLine = lines.find((line) =>
  line.includes('Cloud EMR Migration Analysis Report')
);

if (!reportLine) {
  console.error('Migration report not found in transcript.');
  process.exit(1);
}

const obj = JSON.parse(reportLine);
const text = obj.message.content.find((c) => c.type === 'text')?.text || '';

const outDir = join(__dirname, '../docs');
mkdirSync(outDir, { recursive: true });
const outPath = join(outDir, 'MIGRATION_BLUEPRINT.md');

const header = `# Cornea Clinic — Cloud EMR Migration Blueprint

> Saved from the migration analysis report.  
> Source: \`Cornea.html\` + \`clinic-server.js\`  
> Last updated: ${new Date().toISOString().slice(0, 10)}

---

`;

writeFileSync(outPath, header + text.replace(/^# Cornea Clinic HTML Application — Cloud EMR Migration Analysis Report\n\n/, ''), 'utf8');
console.log('Wrote', outPath, `(${(header.length + text.length).toLocaleString()} chars)`);
