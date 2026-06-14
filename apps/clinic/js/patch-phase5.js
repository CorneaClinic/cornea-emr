/**
 * Phase 5: remove inline script block and wire new module tags.
 */
const fs = require('fs');
const path = require('path');

const htmlPath = path.join(__dirname, '..', 'Cornea.html');
let content = fs.readFileSync(htmlPath, 'utf8');

const inlineBlock = /<script>\r?\n\/\*\*\r?\n \* Cornea Clinic Management System[\s\S]*?<\/script>\r?\n(?=<script src="js\/anterior-drawing\.js">)/;
if (!inlineBlock.test(content)) {
  console.error('Could not find inline script block to remove');
  process.exit(1);
}
content = content.replace(inlineBlock, '');

content = content.replace(
  '<script src="js/ui.js"></script>',
  `<script src="js/ui.js"></script>
<script src="js/clinical-fields.js"></script>`
);

content = content.replace(
  '<script src="js/printing.js"></script>',
  `<script src="js/printing.js"></script>
<script src="js/lid-autocomplete.js"></script>
<script src="js/clinical-exam.js"></script>
<script src="js/medical-advice.js"></script>
<script src="js/follow-up.js"></script>`
);

content = content.replace(
  '<script src="js/keratoplasty.js"></script>',
  `<script src="js/keratoplasty.js"></script>
<script src="js/init.js"></script>`
);

fs.writeFileSync(htmlPath, content, 'utf8');
console.log('Patched Cornea.html for Phase 5');
