/**
 * Ensures all images on the page are fully loaded before taking a visual screenshot.
 *
 * @param {import('@playwright/test').Page} page
 */
export async function triggerLazyImages(page) {
  // 1. Force native lazy images to load immediately
  await page.evaluate(() => {
    document.querySelectorAll('img[loading="lazy"]').forEach((img) => {
      img.setAttribute('loading', 'eager');
    });
  });

  // 2. Scroll to bottom and back to trigger any IntersectionObserver/JS-based image loaders
  await page.evaluate(async () => {
    window.scrollTo(0, document.body.scrollHeight);
    await new Promise((resolve) => setTimeout(resolve, 500));
    window.scrollTo(0, 0);
  });

  // 3. Wait for all content <img> elements to finish loading.
  //    Tracking pixels (adroll, bing, etc.) return empty responses and always
  //    have naturalWidth === 0, so we exclude them from the wait condition.
  await page.waitForFunction(() => {
    const trackingDomains = ['adroll.com', 'bat.bing.com', 'google-analytics.com', 'facebook.net', 'doubleclick.net'];
    const images = Array.from(document.querySelectorAll('img')).filter((img) => {
      const src = img.src || '';
      return !trackingDomains.some((domain) => src.includes(domain));
    });
    return images.every((img) => img.complete && img.naturalWidth > 0);
  }, { timeout: 15000 });
}