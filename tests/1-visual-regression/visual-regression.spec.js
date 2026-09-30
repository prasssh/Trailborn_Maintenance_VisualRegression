import { test, expect } from '@playwright/test';
import { pagesUnderTest } from '../../pages.config.js';
import { triggerLazyImages } from '../../utils/lazy-load.js';
import { getFlakyElements, pauseBackgroundVideo } from '../../utils/flaky-elements.js';

/**
 * Accept the Complianz cookie banner so it doesn't appear in screenshots.
 * The banner is dismissed by clicking the "Accept" button.
 */
async function acceptCookieBanner(page) {
  const acceptButton = page.locator('.cmplz-accept, .cmplz-cookiebanner-container .cmplz-accept, [class*="cmplz"] button:has-text("Accept")');
  if (await acceptButton.count()) {
    await acceptButton.first().click({ timeout: 5000 }).catch(() => {
      // If the banner doesn't appear or can't be dismissed, continue anyway
    });
  }
}

test.describe('Visual regression', () => {
  for (const pageUnderTest of pagesUnderTest) {
    test(`${pageUnderTest.name} — full page matches baseline`, async ({ page }) => {
      if (pageUnderTest.hasLeadspaceVideo) {
        // Block the Vimeo player entirely so it never loads/animates —
        // far more reliable than pausing it after the fact via postMessage,
        // which is async and can lag on slower CI runners, causing the
        // screenshot's "wait for stable frame" check to time out.
        await page.route('**://player.vimeo.com/**', (route) => route.abort());
      }

      await page.goto(pageUnderTest.path, { waitUntil: 'load' });

      //handles sandboxcontinue
      const sandboxContinue = page.locator('button.pds-button[onclick="cont()"]');
      await sandboxContinue.waitFor({ state: 'visible', timeout: 3000 }).catch(() => {});
      if (await sandboxContinue.isVisible()) {
        await sandboxContinue.click();
      }

      // Accept the cookie banner so it doesn't appear in the screenshot
      await acceptCookieBanner(page);

      if (pageUnderTest.hasLeadspaceVideo) {
        await pauseBackgroundVideo(page);
      }

      // Simulate a real visitor: scroll gradually to trigger lazy-loaded images
      await triggerLazyImages(page);

      // Exclude flaky elements from the screenshot diff
      const masks = await getFlakyElements(page);

      await expect(page).toHaveScreenshot(`${pageUnderTest.name}-full.png`, {
        fullPage: true,
        mask: masks,
      });
    });
  }
});