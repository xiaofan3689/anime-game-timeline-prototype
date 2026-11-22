/* Yeqingky/acg-api: one landscape request per page visit. */
(() => {
  'use strict';
  const banner = document.querySelector('.hero-character img');
  if (!banner || banner.dataset.randomBannerInitialized) return;
  banner.dataset.randomBannerInitialized = 'true';
  // Keep the local image visible until a complete remote image is available.
  const candidate = new Image();
  candidate.decoding = 'async';
  candidate.referrerPolicy = 'no-referrer';
  let settled = false;
  const finish = (loaded) => {
    if (settled) return;
    settled = true;
    clearTimeout(timeout);
    candidate.onload = candidate.onerror = null;
    if (loaded && candidate.naturalWidth > 0) {
      banner.referrerPolicy = 'no-referrer';
      banner.src = candidate.src;
      banner.dataset.bannerSource = 'acg-api';
    } else {
      banner.dataset.bannerSource = 'local-fallback';
      candidate.src = '';
    }
  };
  const timeout = setTimeout(() => finish(false), 15000);
  candidate.onload = () => finish(true);
  candidate.onerror = () => finish(false);
  const endpoint = new URL('https://api.yppp.net/pc.php');
  endpoint.searchParams.set('v', `${Date.now()}-${Math.random().toString(36).slice(2)}`);
  candidate.src = endpoint.href;
})();
