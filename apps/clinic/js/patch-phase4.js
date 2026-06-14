/**
 * Phase 4: remove extracted blocks from Cornea.html and add script tags.
 */
const fs = require('fs');
const path = require('path');

const htmlPath = path.join(__dirname, '..', 'Cornea.html');
let lines = fs.readFileSync(htmlPath, 'utf8').split(/\r?\n/);

function removeRange(startLine, endLineInclusive) {
  lines.splice(startLine - 1, endLineInclusive - startLine + 1);
}

// Remove in reverse order (1-based line numbers in pre-patch file)
removeRange(5400, 5734);   // printing
removeRange(4858, 4914);   // dashboard
removeRange(4445, 4804);   // ICD (after lid autocomplete)
removeRange(4193, 4227);   // ICD modal helpers

const marker = '<script src="js/visits.js"></script>';
const insert = `<script src="js/visits.js"></script>
<script src="js/diagnosis.js"></script>
<script src="js/dashboard.js"></script>
<script src="js/printing.js"></script>`;

let content = lines.join('\n');
if (!content.includes(marker)) {
  console.error('Could not find visits.js script tag');
  process.exit(1);
}
content = content.replace(marker, insert);

fs.writeFileSync(htmlPath, content, 'utf8');
console.log('Patched Cornea.html for Phase 4');
