import { test, expect } from '@playwright/test';

test.describe('Clinic script load', () => {
  test('no SyntaxError on boot; switchKpPanel is defined', async ({ page }) => {
    const pageErrors = [];
    const syntaxErrors = [];

    page.on('pageerror', (err) => pageErrors.push(String(err)));
    page.on('console', (msg) => {
      if (msg.type() === 'error' && /SyntaxError/i.test(msg.text())) {
        syntaxErrors.push(msg.text());
      }
    });

    await page.goto('/Cornea.html?cloud=1');
    await page.waitForFunction(() => typeof window.switchKpPanel === 'function', null, {
      timeout: 30_000
    });

    expect(syntaxErrors, `console SyntaxErrors: ${syntaxErrors.join('; ')}`).toHaveLength(0);
    expect(
      pageErrors.filter((e) => /SyntaxError/i.test(e)),
      `page SyntaxErrors: ${pageErrors.join('; ')}`
    ).toHaveLength(0);

    const defined = await page.evaluate(() => ({
      switchKpPanel: typeof window.switchKpPanel === 'function',
      CorneaApi: typeof window.CorneaApi === 'object',
      initKeratoplastyTab: typeof window.initKeratoplastyTab === 'function'
    }));

    expect(defined.switchKpPanel).toBe(true);
    expect(defined.CorneaApi).toBe(true);
    expect(defined.initKeratoplastyTab).toBe(true);
  });
});
