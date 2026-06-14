/**
 * Phase 4: build diagnosis.js, dashboard.js, printing.js from Cornea.html extracts.
 */
const fs = require('fs');
const path = require('path');

const htmlPath = path.join(__dirname, '..', 'Cornea.html');
const lines = fs.readFileSync(htmlPath, 'utf8').split(/\r?\n/);

function slice(start, end) {
  return lines.slice(start - 1, end).join('\n');
}

const diagnosisBody =
  slice(4193, 4227) + '\n\n' + slice(4445, 4804);

const dashboardBody = slice(4858, 4914);

const printingBody = slice(5400, 5734);

const diagnosis = `/**
 * Cornea Clinic — WHO ICD-11 diagnosis lookup and autocomplete
 * Phase 4 extraction from Cornea.html
 */

${diagnosisBody}

window.renderIcdReadOnlyView = renderIcdReadOnlyView;
window.updateDiagnosisIcdStatusMessage = updateDiagnosisIcdStatusMessage;
window.repositionOpenDiagnosisAutocomplete = repositionOpenDiagnosisAutocomplete;
`;

const dashboard = `/**
 * Cornea Clinic — dashboard stats and recent activity
 * Phase 4 extraction from Cornea.html
 */

${dashboardBody}
`;

const printing = `/**
 * Cornea Clinic — clinical report and medical advice printing
 * Phase 4 extraction from Cornea.html
 */

${printingBody}
`;

fs.writeFileSync(path.join(__dirname, 'diagnosis.js'), diagnosis, 'utf8');
fs.writeFileSync(path.join(__dirname, 'dashboard.js'), dashboard, 'utf8');
fs.writeFileSync(path.join(__dirname, 'printing.js'), printing, 'utf8');
console.log('Wrote diagnosis.js, dashboard.js, printing.js');
