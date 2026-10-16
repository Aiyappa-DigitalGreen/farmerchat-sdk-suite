
/* Progressive enhancement: without script every platform is on the page, stacked. */
(function(){
  var root = document.documentElement;
  root.classList.add('js');
  var reduce = window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;

  /* Hero field: crop rows in perspective running to a low dawn sun. */
  var cv = document.querySelector('.field');
  if (cv && cv.getContext) {
    var ctx = cv.getContext('2d'), w = 0, h = 0, dpr = Math.min(window.devicePixelRatio || 1, 2), t0 = performance.now();
    function size(){ var r = cv.getBoundingClientRect(); w = r.width; h = r.height; cv.width = w * dpr; cv.height = h * dpr; ctx.setTransform(dpr,0,0,dpr,0,0); }
    function draw(now){
      var t = (now - t0) / 1000;
      ctx.clearRect(0,0,w,h);
      var narrow = w < 760; var hy = h * (narrow ? 0.86 : 0.62), sx = w * (narrow ? 0.78 : 0.72);
      var g = ctx.createRadialGradient(sx, hy, 0, sx, hy, Math.max(w,h) * 0.55);
      g.addColorStop(0, 'rgba(255,214,140,0.85)'); g.addColorStop(0.18, 'rgba(246,176,74,0.35)'); g.addColorStop(1, 'rgba(246,176,74,0)');
      ctx.fillStyle = g; ctx.fillRect(0,0,w,h);
      ctx.beginPath(); ctx.arc(sx, hy, Math.min(w,h) * 0.07, Math.PI, 0); ctx.fillStyle = 'rgba(255,228,170,0.9)'; ctx.fill();
      var ground = ctx.createLinearGradient(0, hy, 0, h);
      ground.addColorStop(0, '#2E4A1C'); ground.addColorStop(1, '#0E2416');
      ctx.fillStyle = ground; ctx.fillRect(0, hy, w, h - hy);
      var n = 34;
      for (var i = -n; i <= n; i++) {
        var bx = sx + i * (w / 9);
        var shine = 0.12 + 0.1 * Math.max(0, Math.cos((i * 0.35) - t * 0.6));
        ctx.strokeStyle = 'rgba(198,236,138,' + shine.toFixed(3) + ')';
        ctx.lineWidth = 1.2;
        ctx.beginPath(); ctx.moveTo(sx, hy); ctx.lineTo(bx, h + 4); ctx.stroke();
      }
      for (var k = 1; k < 14; k++) {
        var p = Math.pow(k / 14, 2.2), y = hy + (h - hy) * p;
        ctx.strokeStyle = 'rgba(15,31,23,' + (0.25 + p * 0.35).toFixed(3) + ')';
        ctx.lineWidth = 1 + p * 2; ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(w, y); ctx.stroke();
      }
      if (!reduce) requestAnimationFrame(draw);
    }
    size(); requestAnimationFrame(draw);
    window.addEventListener('resize', function(){ size(); if (reduce) requestAnimationFrame(draw); });
  }

  /* Scroll to a page offset; if the smooth animation stalls (throttled frames), finish it instantly. */
  function glide(top){
    top = Math.max(0, Math.min(top, document.documentElement.scrollHeight - innerHeight));
    scrollTo({ top: top, behavior: reduce ? 'instant' : 'smooth' });
    setTimeout(function(){ if (Math.abs(scrollY - top) > 4) scrollTo({ top: top, behavior: 'instant' }); }, 900);
  }

  /* Three-step switcher: one platform's install / initialize / open steps at a time. */
  document.querySelectorAll('.st-chip').forEach(function(b){
    b.addEventListener('click', function(){
      var id = b.dataset.st;
      document.querySelectorAll('.st-chip').forEach(function(x){ x.setAttribute('aria-pressed', x === b); });
      document.querySelectorAll('.st-list').forEach(function(l){ l.hidden = l.dataset.st !== id; });
      // Phones: the chips fill the screen, so bring step 1 of the chosen platform into view.
      if (matchMedia('(max-width:620px)').matches) {
        var list = document.querySelector('.st-list[data-st="' + id + '"]');
        var bar = document.querySelector('.topbar, header');
        var top = list.getBoundingClientRect().top + scrollY - ((bar ? bar.offsetHeight : 0) + 12);
        glide(top);
      }
    });
  });

  /* Guide: one platform at a time; deep links (#web-theming) open the right platform. */
  var arts = [].slice.call(document.querySelectorAll('article.platform'));
  var tabs = [].slice.call(document.querySelectorAll('.ptab'));
  function platFor(id){
    if (!id) return null;
    var el = document.getElementById(id);
    var art = el && el.closest ? el.closest('article.platform') : null;
    return art ? art.id : null;
  }
  function show(pid){
    if (!pid) pid = arts[0].id;
    arts.forEach(function(a){ a.hidden = a.id !== pid; });
    tabs.forEach(function(t){ t.classList.toggle('on', t.dataset.plat === pid); });
    try { localStorage.setItem('fc_doc_platform', pid); } catch(e){}
  }
  var start = platFor(location.hash.slice(1));
  if (!start) { try { start = platFor(localStorage.getItem('fc_doc_platform')); } catch(e){} }
  show(start);
  if (location.hash && document.getElementById(location.hash.slice(1))) {
    var tgt0 = document.getElementById(location.hash.slice(1));
    setTimeout(function(){ tgt0.scrollIntoView({ behavior: 'auto' }); }, 0);
  }
  document.addEventListener('click', function(e){
    var a = e.target.closest && e.target.closest('a[href^="#"]');
    if (!a) return;
    var id = a.getAttribute('href').slice(1);
    var pid = platFor(id);
    if (!pid) return;
    e.preventDefault();
    show(pid);
    var narrow = matchMedia('(max-width:860px)').matches;
    // Phones: a platform tab lands on that platform's first topic, just below the sticky header + rail.
    var target = id === pid ? (narrow ? document.getElementById(pid) : document.getElementById('guide')) : document.getElementById(id);
    if (narrow) {
      var rail = document.querySelector('.rail');
      var bar = document.querySelector('.topbar, header');
      var cover = (bar ? bar.offsetHeight : 0) + (rail ? rail.offsetHeight : 0) + 16;
      glide(target.getBoundingClientRect().top + scrollY - cover);
    } else target.scrollIntoView({ behavior: reduce ? 'auto' : 'smooth' });
    try { history.replaceState(null, '', '#' + id); } catch(err){}
  });
  window.addEventListener('hashchange', function(){ var p = platFor(location.hash.slice(1)); if (p) show(p); });

  document.querySelectorAll('.cb-tab').forEach(function(t){
    t.addEventListener('click', function(){
      var g = t.dataset.cb, i = t.dataset.i;
      document.querySelectorAll('.cb-tab[data-cb="'+g+'"]').forEach(function(x){ x.setAttribute('aria-selected', x.dataset.i === i); });
      document.querySelectorAll('.cb-pane[data-cb="'+g+'"]').forEach(function(pn){ pn.hidden = pn.dataset.i !== i; });
    });
  });
  document.querySelectorAll('.cb-copy').forEach(function(btn){
    btn.addEventListener('click', function(){
      var pane = btn.closest('.cb').querySelector('.cb-pane:not([hidden])');
      var code = pane ? pane.querySelector('code') : null;
      var text = code ? code.innerText : '';
      function flash(t){ btn.textContent = t; setTimeout(function(){ btn.textContent = 'Copy'; }, 1400); }
      function selectIt(){ if (!code) return; var r = document.createRange(); r.selectNodeContents(code);
        var s = getSelection(); s.removeAllRanges(); s.addRange(r); flash('Press ⌘C'); }
      if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(text).then(function(){ flash('Copied'); }, selectIt);
      else selectIt();
    });
  });

  var links = [].slice.call(document.querySelectorAll('.sec-link'));
  if (links.length && 'IntersectionObserver' in window) {
    var byId = {};
    links.forEach(function(a){ byId[a.getAttribute('href').slice(1)] = a; });
    var obs = new IntersectionObserver(function(entries){
      entries.forEach(function(en){
        if (en.isIntersecting && byId[en.target.id]) {
          links.forEach(function(a){ a.classList.remove('on'); });
          byId[en.target.id].classList.add('on');
        }
      });
    }, { rootMargin: '-80px 0px -70% 0px', threshold: 0 });
    document.querySelectorAll('section.sec').forEach(function(s){ obs.observe(s); });
  }
})();

/* Comments: the button only appears where this viewer can comment. It opens the shell's composer
   on the section nearest the top of the screen; the shell posts and shows every thread. */
(function(){
  var btn = document.querySelector('.cmt');
  if (!btn || !window.claude || typeof window.claude.use !== 'function') return;
  window.claude.use('comments').then(function(comments){
    if (!comments) return;
    btn.hidden = false;
    btn.addEventListener('click', function(){
      var target = document.querySelector('.hero-copy h1');
      document.querySelectorAll('section').forEach(function(s){
        var r = s.getBoundingClientRect();
        if (r.top < 140 && r.bottom > 140) target = s.querySelector('h2, h1') || s;
      });
      comments.openComposer({ element: target }).catch(function(e){
        if (e && (e.code === 'unavailable' || e.code === 'not_granted' || e.code === 'forbidden')) btn.hidden = true;
      });
    });
  }).catch(function(){});
})();

