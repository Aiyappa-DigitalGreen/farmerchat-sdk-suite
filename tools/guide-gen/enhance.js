/* Progressive enhancement only. Every platform, section and the first code sample
   of every block are already in the static HTML — this adds tab switching, copy,
   and scroll-spy. If it never runs, the page is still complete. */
document.querySelectorAll('.cb-tab').forEach(function(t){
  t.addEventListener('click', function(){
    var g = t.dataset.cb, i = t.dataset.i;
    document.querySelectorAll('.cb-tab[data-cb="'+g+'"]').forEach(function(x){
      x.setAttribute('aria-selected', x.dataset.i === i);
    });
    document.querySelectorAll('.cb-pane[data-cb="'+g+'"]').forEach(function(pn){
      pn.hidden = pn.dataset.i !== i;
    });
  });
});
document.querySelectorAll('.cb-copy').forEach(function(btn){
  btn.addEventListener('click', function(){
    var cb = btn.closest('.cb');
    var pane = cb.querySelector('.cb-pane:not([hidden])');
    var text = pane ? pane.querySelector('code').innerText : '';
    if (navigator.clipboard) {
      navigator.clipboard.writeText(text).then(function(){
        btn.textContent = 'Copied';
        setTimeout(function(){ btn.textContent = 'Copy'; }, 1400);
      }).catch(function(){ btn.textContent = 'Press ⌘C';
        setTimeout(function(){ btn.textContent = 'Copy'; }, 1400); });
    }
  });
});
(function(){
  var links = [].slice.call(document.querySelectorAll('.nav-secs a'));
  if (!links.length || !('IntersectionObserver' in window)) return;
  var byId = {};
  links.forEach(function(a){ byId[a.getAttribute('href').slice(1)] = a; });
  var obs = new IntersectionObserver(function(entries){
    entries.forEach(function(en){
      if (en.isIntersecting) {
        links.forEach(function(a){ a.classList.remove('on'); });
        var a = byId[en.target.id];
        if (a) a.classList.add('on');
      }
    });
  }, { rootMargin: '0px 0px -78% 0px', threshold: 0 });
  document.querySelectorAll('section.sec').forEach(function(s){ obs.observe(s); });
})();
