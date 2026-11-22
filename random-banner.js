/* Yeqingky/acg-api: five-second rotation, without overlapping requests. */
(() => {
  'use strict';
  const banner = document.querySelector('.hero-character img');
  if (!banner || banner.dataset.randomBannerInitialized) return;
  banner.dataset.randomBannerInitialized = 'true';
  const interval = 5000;
  let timer = 0;
  let pending = null;
  let timeout = 0;

  const cancelPending = () => {
    window.clearTimeout(timeout);
    if (pending) {
      pending.onload = pending.onerror = null;
      pending.src = '';
      pending = null;
    }
  };
  const loadNext = () => {
    if (pending || document.visibilityState === 'hidden' || !banner.isConnected) return;
    const candidate = new Image();
    pending = candidate;
    candidate.decoding = 'async';
    candidate.referrerPolicy = 'no-referrer';
    const finish = (loaded) => {
      if (pending !== candidate) return;
      window.clearTimeout(timeout);
      candidate.onload = candidate.onerror = null;
      pending = null;
      if (loaded && candidate.naturalWidth > 0 && banner.isConnected && document.visibilityState !== 'hidden') {
        banner.referrerPolicy = 'no-referrer';
        banner.src = candidate.src;
        banner.dataset.bannerSource = 'acg-api';
        banner.classList.remove('banner-refresh');
        void banner.offsetWidth;
        banner.classList.add('banner-refresh');
      } else {
        candidate.src = '';
      }
    };
    timeout = window.setTimeout(() => finish(false), 15000);
    candidate.onload = () => finish(true);
    candidate.onerror = () => finish(false);
    const endpoint = new URL('https://api.yppp.net/pc.php');
    endpoint.searchParams.set('v', `${Date.now()}-${Math.random().toString(36).slice(2)}`);
    candidate.src = endpoint.href;
  };
  const pause = () => {
    window.clearInterval(timer);
    timer = 0;
    cancelPending();
  };
  const resume = () => {
    if (timer || document.visibilityState === 'hidden') return;
    loadNext();
    timer = window.setInterval(loadNext, interval);
  };
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') pause();
    else resume();
  });
  window.addEventListener('pagehide', pause);
  window.addEventListener('pageshow', resume);
  resume();
})();
