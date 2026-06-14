const fs = require('fs');
const path = require('path');
const dir = __dirname;
const htmlPath = path.join(dir, '..', 'Cornea.html');

let drawing = fs.readFileSync(path.join(dir, '_drawing-body.txt'), 'utf8');
let kp = fs.readFileSync(path.join(dir, '_keratoplasty-body.txt'), 'utf8');

const drawingHeader = `/**
 * Cornea Clinic — anterior segment drawing studio
 * Phase 1 extraction from Cornea.html
 */
`;

const drawingFooter = `
if (typeof window !== 'undefined') {
  window.renderAnteriorDrawingPreview = renderAnteriorDrawingPreview;
  window.initAnteriorDrawingStudio = initAnteriorDrawingStudio;
  window.preloadDrawingSketch = preloadDrawingSketch;
}
`;

const kpHeader = `/**
 * Cornea Clinic — keratoplasty register, tissue inventory & matching
 * Phase 1 extraction from Cornea.html
 */
const STORE_KP_PATIENTS = 'kpPatients';
const STORE_KP_TISSUES = 'kpTissues';

`;

kp = kp.replace(
  /\/\/ ========== KERATOPLASTY REGISTER ==========\nlet _kpPatientsCache = \[\];\nlet _kpTissuesCache = \[\];\n\n/,
  'let _kpPatientsCache = [];\nlet _kpTissuesCache = [];\n\n'
);
kp = kp.replace(/_kpSelectedPatientId/g, 'window._kpSelectedPatientId');
kp = kp.replace(/_kpSelectedTissueId/g, 'window._kpSelectedTissueId');

fs.writeFileSync(path.join(dir, 'anterior-drawing.js'), drawingHeader + drawing + drawingFooter, 'utf8');
fs.writeFileSync(path.join(dir, 'keratoplasty.js'), kpHeader + kp, 'utf8');

console.log('Built anterior-drawing.js and keratoplasty.js');
