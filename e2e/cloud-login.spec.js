import { test, expect } from '@playwright/test';
import { signInCloud } from './helpers.js';

test.describe('Cloud login bootstrap', () => {
  test('modal closes quickly after sign-in without recursion errors', async ({ page }) => {
    const consoleErrors = [];
    page.on('console', (msg) => {
      if (msg.type() === 'error') consoleErrors.push(msg.text());
    });

    const { elapsed } = await signInCloud(page);

    expect(elapsed).toBeLessThan(12_000);

    const recursionHits = consoleErrors.filter((t) =>
      /Maximum call stack|too much recursion|refreshModuleCloudData/i.test(t)
    );
    expect(recursionHits, recursionHits.join('\n')).toHaveLength(0);

    await expect(page.locator('#corneaCloudBadgeWrap')).toContainText(/Cloud Sync|Sign out/i, {
      timeout: 15_000
    });
  });
});
