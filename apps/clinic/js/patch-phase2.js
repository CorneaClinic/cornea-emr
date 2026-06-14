/**
 * Phase 2: remove extracted blocks from Cornea.html and add script tags.
 */
const fs = require('fs');
const path = require('path');

const htmlPath = path.join(__dirname, '..', 'Cornea.html');
let lines = fs.readFileSync(htmlPath, 'utf8').split(/\r?\n/);

function removeRange(startLine, endLineInclusive) {
  lines.splice(startLine - 1, endLineInclusive - startLine + 1);
}

// Remove in reverse order (1-based line numbers before any removal)
removeRange(6470, 6659);   // exportDatabase, importDatabase, clearAllData
removeRange(5526, 5616);   // tab logic + sidebar mobile
removeRange(5267, 5342);   // initDB
removeRange(4211, 4260);   // modal globals + open/close/initEmrModals
removeRange(4194, 4209);   // PAGE_META + escapeHtml
removeRange(4160, 4169);   // window.db + DB store constants

// Insert script tags before main inline script
const scriptOpen = '<script>';
const insert = `<script src="js/storage.js"></script>
<script src="js/ui.js"></script>
<script>`;

let content = lines.join('\n');
if (!content.includes(scriptOpen)) {
  console.error('Could not find opening script tag');
  process.exit(1);
}
content = content.replace(scriptOpen, insert);

fs.writeFileSync(htmlPath, content, 'utf8');
console.log('Patched Cornea.html for Phase 2');
