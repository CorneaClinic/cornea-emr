/** CSP-safe helpers for handlers that were previously inline onclick expressions. */
function openImportFilePicker() {
  document.getElementById('importFile')?.click();
}

window.openImportFilePicker = openImportFilePicker;
