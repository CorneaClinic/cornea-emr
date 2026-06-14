/**
 * Phase 2: build storage.js and ui.js from Cornea.html extracts.
 * Run once after editing line ranges if Cornea.html structure changes.
 */
const fs = require('fs');
const path = require('path');

const htmlPath = path.join(__dirname, '..', 'Cornea.html');
const lines = fs.readFileSync(htmlPath, 'utf8').split(/\r?\n/);

function slice(start, end) {
  return lines.slice(start - 1, end).join('\n');
}

// 1-based inclusive line numbers (current Cornea.html after Phase 1)
const storageBody = `/**
 * Cornea Clinic — IndexedDB storage, export/import/clear
 * Phase 2 extraction from Cornea.html
 */
window.db = null;
var DB_NAME = "CorneaClinicDB";
var STORE_NAME = "patients";
var DB_VERSION = 6;
var STORE_USERS = 'users';
var STORE_SYNC_QUEUE = 'sync_queue';
var STORE_SYNC_META = 'sync_meta';
var STORE_SYNC_LOGS = 'sync_logs';
var STORE_KP_PATIENTS = 'kpPatients';
var STORE_KP_TISSUES = 'kpTissues';

${slice(5267, 5342)}

${slice(6470, 6659)}
`;

const uiBody = `/**
 * Cornea Clinic — navigation, modals, sidebar shell
 * Phase 2 extraction from Cornea.html
 */
window._currentViewRecordId = null;
window._kpSelectedPatientId = null;
window._kpSelectedTissueId = null;

var PAGE_META = {
    dashboardTab: { title: 'Dashboard', subtitle: 'Overview & recent activity' },
    formTab:      { title: 'Patient Form', subtitle: 'Read-only visit record · use Edit to modify' },
    recordsTab:   { title: 'Patient Records', subtitle: 'All stored patient visits' },
    flowTab:      { title: 'Patient Flow', subtitle: 'Today\\'s patients by clinic station' },
    databaseTab:  { title: 'Database Management', subtitle: 'Export, import & manage local data' },
    keratoplastyTab: { title: 'Keratoplasty Register', subtitle: 'Patient register, tissue inventory & matching' }
};

window.escapeHtml = function escapeHtml(str) {
    if (str == null) return '';
    const d = document.createElement('div');
    d.textContent = String(str);
    return d.innerHTML;
};

${slice(4216, 4260).replace('function initEmrModals', 'function initEmrModals')}

window.initEmrModals = initEmrModals;

${slice(5527, 5616)}

window.toggleSidebar = toggleSidebar;
window.closeSidebar = closeSidebar;
`;

fs.writeFileSync(path.join(__dirname, 'storage.js'), storageBody, 'utf8');
fs.writeFileSync(path.join(__dirname, 'ui.js'), uiBody, 'utf8');
console.log('Wrote storage.js and ui.js');
