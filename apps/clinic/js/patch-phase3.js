/**
 * Phase 3: remove extracted blocks from Cornea.html and add script tags.
 */
const fs = require('fs');
const path = require('path');

const htmlPath = path.join(__dirname, '..', 'Cornea.html');
let lines = fs.readFileSync(htmlPath, 'utf8').split(/\r?\n/);

function removeRange(startLine, endLineInclusive) {
  lines.splice(startLine - 1, endLineInclusive - startLine + 1);
}

// Remove in reverse order (1-based)
removeRange(6575, 6605);   // clearForm
removeRange(6018, 6236);   // saveToDatabase … filterRecords
removeRange(5377, 5659);   // visit history + newPatient
removeRange(4189, 4526);   // read-only helpers, form collect/populate, render read-only

const marker = '<script src="js/ui.js"></script>';
const insert = `<script src="js/ui.js"></script>
<script src="js/patient-form.js"></script>
<script src="js/visits.js"></script>`;

let content = lines.join('\n');
if (!content.includes(marker)) {
  console.error('Could not find ui.js script tag');
  process.exit(1);
}
content = content.replace(marker, insert);

fs.writeFileSync(htmlPath, content, 'utf8');
console.log('Patched Cornea.html for Phase 3');
