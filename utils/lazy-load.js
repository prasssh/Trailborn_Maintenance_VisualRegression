/**
 * Ensures all images on the page are fully loaded before taking a visual screenshot.
 *
 * Scrolls gradually down the page in small increments to trigger lazy-loaded
 * images, then scrolls back to the top. This simulates a real visitor and
 * ensures all IntersectionObserver/JS-based image loaders have fired.
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

  // 2. Scroll gradually down the page to trigger lazy-loaded images.
  //    Using small increments with pauses ensures IntersectionObserver-based
  //    loaders have time to fire and images start downloading.
  await page.evaluate(async () => {
    const scrollHeight = document.body.scrollHeight;
    const viewportHeight = window.innerHeight;
    const step = Math.max(200, Math.floor(viewportHeight * 0.8));
    const pauseMs = 300;

    for (let pos = 0; pos <= scrollHeight; pos += step) {
      window.scrollTo(0, pos);
      await new Promise((resolve) => setTimeout(resolve, pauseMs));
    }

    // Scroll back to the top gradually
    for (let pos = scrollHeight; pos >= 0; pos -= step) {
      window.scrollTo(0, pos);
      await new Promise((resolve) => setTimeout(resolve, pauseMs));
    }
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
  }, { timeout: 30000 });
}