/**
 * Phase 5: extract remaining inline logic into focused modules.
 */
const fs = require('fs');
const path = require('path');

const htmlPath = path.join(__dirname, '..', 'Cornea.html');
const lines = fs.readFileSync(htmlPath, 'utf8').split(/\r?\n/);

function slice(start, end) {
  return lines.slice(start - 1, end).join('\n');
}

const clinicalFields = `/**
 * Cornea Clinic — anterior segment / fundus field definitions
 * Phase 5 extraction from Cornea.html
 */

${slice(4169, 4189)}
`;

const lidAutocomplete = `/**
 * Cornea Clinic — lid condition type-ahead autocomplete
 * Phase 5 extraction from Cornea.html
 */

${slice(4198, 4407)}

window.repositionOpenLidAutocompleteLists = repositionOpenLidAutocompleteLists;
`;

const clinicalExam = `/**
 * Cornea Clinic — exam finding highlights and pull-from-previous
 * Phase 5 extraction from Cornea.html
 */

${slice(4462, 4584)}

window.setupFieldListeners = setupFieldListeners;
`;

const medicalAdvice = `/**
 * Cornea Clinic — medical advice / prescription rows
 * Phase 5 extraction from Cornea.html
 */

${slice(4589, 4757)}
`;

const followUp = `/**
 * Cornea Clinic — follow-up scheduling UI
 * Phase 5 extraction from Cornea.html
 */

${slice(4760, 4943)}
`;

const init = `/**
 * Cornea Clinic — DOMContentLoaded bootstrap
 * Phase 5 extraction from Cornea.html
 */

${slice(4410, 4458)}
`;

const files = {
  'clinical-fields.js': clinicalFields,
  'lid-autocomplete.js': lidAutocomplete,
  'clinical-exam.js': clinicalExam,
  'medical-advice.js': medicalAdvice,
  'follow-up.js': followUp,
  'init.js': init,
};

for (const [name, body] of Object.entries(files)) {
  fs.writeFileSync(path.join(__dirname, name), body, 'utf8');
}
console.log('Wrote Phase 5 modules:', Object.keys(files).join(', '));
