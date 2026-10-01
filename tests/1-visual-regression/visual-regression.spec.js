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

/**
 * Check if the page has a Vimeo video by looking for the Vimeo container
 * or iframe. This is more reliable than relying on a static config flag.
 */
async function hasVimeoVideo(page) {
  const vimeoContainer = page.locator('.js-vimeo-video-container, iframe[id^="vimeo-player"], iframe[src*="vimeo.com"]');
  return (await vimeoContainer.count()) > 0;
}

test.describe('Visual regression', () => {
  for (const pageUnderTest of pagesUnderTest) {
    test(`${pageUnderTest.name} — full page matches baseline`, async ({ page }) => {
      // Block the Vimeo player entirely on pages that have it —
      // far more reliable than pausing it after the fact via postMessage,
      // which is async and can lag on slower CI runners, causing the
      // screenshot's "wait for stable frame" check to time out.
      // We check both the config flag and the actual page content.
      if (pageUnderTest.hasLeadspaceVideo) {
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

      // Check for Vimeo videos on the actual page content (not just config)
      const pageHasVimeo = await hasVimeoVideo(page);
      if (pageHasVimeo) {
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