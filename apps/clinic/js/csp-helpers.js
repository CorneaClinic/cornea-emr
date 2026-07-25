/** CSP-safe helpers for handlers that were previously inline onclick expressions. */
function openImportFilePicker() {
  document.getElementById('importFile')?.click();
}

function openDrawingLoadPicker() {
  document.getElementById('drawingLoadInput')?.click();
}

function toggleElementClass(id, className) {
  document.getElementById(id)?.classList.toggle(className || 'is-open');
}

window.openImportFilePicker = openImportFilePicker;
window.openDrawingLoadPicker = openDrawingLoadPicker;
window.toggleElementClass = toggleElementClass;
