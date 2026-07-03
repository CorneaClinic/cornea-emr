import { test, expect } from '@playwright/test';
import { signInCloud, openKcRegistryTab, openAppointmentsSchedule, setRegistryOffline } from './helpers.js';

test.describe('Registry offline policy (M2.2 / M2.4)', () => {
  test('KC: offline blocks saves; reconnect restores controls (M2.4)', async ({ page }) => {
    await signInCloud(page);
    await openKcRegistryTab(page);
    await page.locator('[data-kc-panel="kcPatientsPanel"]').click();
    await expect(page.locator('#kcPatientsPanel')).toHaveClass(/active/);

    const banner = page.locator('#kcRegistryOfflineBanner');
    const enrolBtn = page.locator('#kcPatientsPanel button.btn-primary').first();

    await setRegistryOffline(page, true, ['kc']);
    await expect(banner).toBeVisible();
    await expect(banner).toContainText(/internet/i);
    await expect(enrolBtn).toBeDisabled();

    await setRegistryOffline(page, false, ['kc']);
    await expect(banner).toBeHidden();
    await expect(enrolBtn).toBeEnabled();
  });

  test('dry eye: offline blocks saves; reconnect restores controls (M2.4)', async ({ page }) => {
    await signInCloud(page);
    await page.locator('#nav-dryEyeTab').click();
    await expect(page.locator('#dryEyeTab')).toHaveClass(/active/);
    await page.locator('[data-de-panel="deCasesPanel"]').click();

    const banner = page.locator('#dryEyeOfflineBanner');
    const newCaseBtn = page.locator('#deCasesPanel button.btn-primary').first();

    await setRegistryOffline(page, true, ['dryeye']);
    await expect(banner).toBeVisible();
    await expect(newCaseBtn).toBeDisabled();

    await setRegistryOffline(page, false, ['dryeye']);
    await expect(banner).toBeHidden();
    await expect(newCaseBtn).toBeEnabled();
  });

  test('appointments: offline blocks book; reconnect restores (M2.4)', async ({ page }) => {
    await signInCloud(page);
    await openAppointmentsSchedule(page);

    const banner = page.locator('#appointmentsOfflineBanner');
    const bookBtn = page.locator('#apptSchedulePanel button.btn-primary').first();

    await setRegistryOffline(page, true, ['appointments']);
    await expect(banner).toBeVisible();
    await expect(bookBtn).toBeDisabled();

    await setRegistryOffline(page, false, ['appointments']);
    await expect(banner).toBeHidden();
    await expect(bookBtn).toBeEnabled();
  });
});
