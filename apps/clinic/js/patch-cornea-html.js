const fs = require('fs');
const path = require('path');

const htmlPath = path.join(__dirname, '..', 'Cornea.html');
let lines = fs.readFileSync(htmlPath, 'utf8').split(/\r?\n/);

function removeRange(startLine, endLineExclusive) {
  // 1-based inclusive start, 1-based inclusive end
  const start = startLine - 1;
  const end = endLineExclusive - 1;
  lines.splice(start, end - start + 1);
}

// Remove in reverse order (1-based line numbers from original file)
removeRange(8032, 9021);   // keratoplasty main block
removeRange(5538, 5628);   // keratoplasty UI helpers
removeRange(4262, 5197);   // anterior drawing studio

const content = lines.join('\n');
const marker = '<script src="cornea-sync-client.js"></script>';
const insert = `<script src="js/anterior-drawing.js"></script>
<script src="js/keratoplasty.js"></script>
<script src="cornea-sync-client.js"></script>`;

if (!content.includes(marker)) {
  console.error('Marker not found');
  process.exit(1);
}

const updated = content.replace(marker, insert);
fs.writeFileSync(htmlPath, updated, 'utf8');
console.log('Patched Cornea.html — removed ~', 936 + 1081, 'lines, added script tags');
