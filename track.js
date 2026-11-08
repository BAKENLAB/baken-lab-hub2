(() => {
  const path = location.pathname === '' ? '/' : location.pathname;
  const payload = JSON.stringify({ path });
  try {
    if (navigator.sendBeacon) {
      const blob = new Blob([payload], { type: 'application/json' });
      if (navigator.sendBeacon('/api/track-view', blob)) return;
    }
  } catch {}
  fetch('/api/track-view', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: payload,
    keepalive: true,
    cache: 'no-store',
    credentials: 'same-origin'
  }).catch(() => {});
})();
