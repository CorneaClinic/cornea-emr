/**
 * Phase 3: build patient-form.js and visits.js from Cornea.html extracts.
 */
const fs = require('fs');
const path = require('path');

const htmlPath = path.join(__dirname, '..', 'Cornea.html');
const lines = fs.readFileSync(htmlPath, 'utf8').split(/\r?\n/);

function slice(start, end) {
  return lines.slice(start - 1, end).join('\n');
}

function fixGlobals(code) {
  return code
    .replace(/let _lastAutofillPatientId = '';\r?\n/g, '')
    .replace(/\b_currentViewRecordId\b/g, 'window._currentViewRecordId')
    .replace(/\b_lastAutofillPatientId\b/g, 'window._lastAutofillPatientId');
}

const patientBody = fixGlobals(
  slice(4189, 4526) + '\n\n' + slice(5377, 5659)
);

const visitsBody = fixGlobals(
  slice(6018, 6236) + '\n\n' + slice(6575, 6605)
);

const patientForm = `/**
 * Cornea Clinic — patient form, read-only views, visit history sidebar
 * Phase 3 extraction from Cornea.html
 */
window._lastAutofillPatientId = '';

${patientBody}

window.loadPatientVisits = loadPatientVisits;
window.collectFormDataObject = collectFormDataObject;
window.populateFormFromData = populateFormFromData;
window.renderEmrReadOnlyGrid = renderEmrReadOnlyGrid;
`;

const visits = `/**
 * Cornea Clinic — visit persistence, records list, form reset
 * Phase 3 extraction from Cornea.html
 */

${visitsBody}

window.loadRecords = loadRecords;
`;

fs.writeFileSync(path.join(__dirname, 'patient-form.js'), patientForm, 'utf8');
fs.writeFileSync(path.join(__dirname, 'visits.js'), visits, 'utf8');
console.log('Wrote patient-form.js and visits.js');
