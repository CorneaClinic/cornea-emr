document.addEventListener('DOMContentLoaded', async () => {
    const year = String(new Date().getFullYear());
    document.getElementById('appFooterYear')?.replaceChildren(document.createTextNode(year));
    document.getElementById('sidebarFooterYear')?.replaceChildren(document.createTextNode(year));
    try {
        localStorage.removeItem('corneaClinic_icdClientId');
        localStorage.removeItem('corneaClinic_icdClientSecret');
    } catch (_) { /* ignore */ }
    const isPublic = window.CorneaAuthEnv?.isPublicDeployment?.() === true;
    const cloudQuery = new URLSearchParams(window.location.search).get('cloud') === '1';
    let cloudConnected = false;
    try {
        cloudConnected = await CorneaApi.tryConnect({
            prompt: isPublic || cloudQuery,
            forceCloud: cloudQuery || undefined
        });
    } catch (err) {
        console.warn('[CorneaApi] Cloud mode unavailable — using offline authentication.', err);
        if (window.__corneaCloudMode) cloudConnected = true;
    }
    try {
        if (window.CorneaOfflineAuth) {
            await window.CorneaOfflineAuth.initAfterCloudCheck(cloudConnected);
        }
        if (window.CorneaAudit) {
            window.CorneaAudit.installHooks();
        }
    } finally {
        const authed = window.__corneaCloudMode || window.CorneaOfflineAuth?.getCurrentUser?.();
        const cloudOpen = document.getElementById('corneaCloudLoginModal')?.classList.contains('is-open');
        const offlineOpen = document.getElementById('corneaOfflineLogin')?.classList.contains('is-open');
        if (authed) {
            document.body.classList.remove('cornea-auth-pending');
            window.CorneaAuthEnv?.unlockUi?.();
        } else if (isPublic && !cloudOpen && !offlineOpen) {
            console.warn('[Cornea] No auth UI visible — reopening cloud sign-in.');
            window.CorneaApiForceCloudSignIn?.();
        }
    }
}, { once: true });
