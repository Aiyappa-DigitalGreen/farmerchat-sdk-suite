// usage in --js: clickText('English') — waits until the text exists and no row spinner shows
window.__clickText = (txt, sel) => new Promise((r) => {
  const t = setInterval(() => {
    if (document.querySelector('.fcsdk-c-radio .fcsdk-c-progress')) return;
    const e = [...document.querySelectorAll(sel || 'button, [role=button], a')].find((e) => e.textContent.trim().includes(txt));
    if (e) { clearInterval(t); setTimeout(() => { e.click(); r(); }, 300); }
  }, 300);
});
