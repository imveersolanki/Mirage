/* =====================================================================
   Mirage themes: a visual picker over the style <select>. Cards are drawn
   from each theme's own tokens, read from the stylesheets. Hover previews.
   ===================================================================== */
(() => {
'use strict';
const M = window.Mirage;
if(!M) return;
const $ = id => document.getElementById(id);
const sel = $('themeSel'), sheet = $('sheet'), wrap = sel.closest('.sel');
const esc = M.esc;

/* tokens per theme, straight from the CSS rules "#sheet.th-x{...}" */
let TOK = null;
function tokens(){
  if(TOK) return TOK;
  TOK = {};
  const want = ['--c-bg','--c-fg','--c-mut','--c-acc','--c-fd','--c-r','--c-line'];
  for(const ss of document.styleSheets){
    let rules; try{ rules = ss.cssRules; }catch(_){ continue; }
    for(const r of rules || []){
      const m = r.selectorText && r.selectorText.match(/^#sheet(?:\.th-([a-z0-9-]+))?$/);
      if(!m) continue;
      const k = m[1] || '', t = TOK[k] || (TOK[k] = {});
      want.forEach(v => { const x = r.style.getPropertyValue(v).trim(); if(x) t[v] = x; });
    }
  }
  return TOK;
}
const tok = v => {
  if(v === '__custom'){ const d = M.design; return {'--c-bg':d.bg,'--c-fg':d.fg,'--c-mut':d.mut,'--c-acc':d.acc,'--c-fd':'"'+d.fontD+'"','--c-r':d.radius+'px','--c-line':d.line}; }
  const base = tokens()[''] || {};
  return Object.assign({}, base, tokens()[v] || {});
};
const swatch = (v, big) => {
  const t = tok(v);
  return '<span class="th-sw'+(big?' big':'')+'" style="background:'+t['--c-bg']+';border-color:'+(t['--c-line']||'#ddd')+'">'+
    '<b style="color:'+t['--c-fg']+';font-family:'+(t['--c-fd']||'inherit')+'">Aa</b>'+
    '<i style="background:'+t['--c-acc']+'"></i></span>';
};

/* the button that replaces the dropdown */
wrap.classList.add('th-hidden');
const btn = document.createElement('button');
btn.className = 'btn th-btn'; btn.id = 'thBtn'; btn.setAttribute('aria-haspopup', 'dialog'); btn.title = 'Style';
wrap.after(btn);
const name = v => { const o = [...sel.options].find(o => o.value === v); return o ? o.textContent : 'Plain'; };
const paintBtn = () => { btn.innerHTML = swatch(sel.value) + '<span>' + esc(name(sel.value)) + '</span><svg width="10" height="7" viewBox="0 0 9 6" fill="none"><path d="M1 1l3.5 3.5L8 1" stroke="currentColor" stroke-width="1.4"/></svg>'; };

/* popover */
const pop = document.createElement('div');
pop.className = 'th-pop'; pop.id = 'thPop'; pop.setAttribute('role', 'dialog'); pop.setAttribute('aria-label', 'Choose a style');
pop.innerHTML = '<div class="th-top"><input class="tin" id="thQ" placeholder="Search '+sel.options.length+' styles" autocomplete="off"><span class="th-n" id="thN"></span></div><div class="th-list" id="thList"></div>';
document.body.appendChild(pop);
let previewing = null;
function build(){
  const q = $('thQ').value.trim().toLowerCase(), list = $('thList');
  list.innerHTML = '';
  let n = 0;
  [...sel.querySelectorAll('optgroup')].forEach(g => {
    const opts = [...g.querySelectorAll('option')].filter(o => !q || o.textContent.toLowerCase().includes(q) || g.label.toLowerCase().includes(q));
    if(!opts.length) return;
    const sec = document.createElement('section');
    sec.innerHTML = '<h5>'+esc(g.label)+'</h5><div class="th-grid"></div>';
    opts.forEach(o => {
      n++;
      const c = document.createElement('button');
      c.className = 'th-card' + (o.value === sel.value ? ' on' : '');
      c.dataset.v = o.value;
      c.innerHTML = swatch(o.value, true) + '<span>' + esc(o.textContent) + '</span>';
      c.onmouseenter = () => { previewing = o.value; sheet.className = (o.value ? 'th-'+o.value : ''); };
      c.onclick = () => choose(o.value);
      sec.querySelector('.th-grid').appendChild(c);
    });
    list.appendChild(sec);
  });
  $('thN').textContent = n + ' shown';
}
const restore = () => { if(previewing !== null){ previewing = null; sheet.className = M.theme ? 'th-'+M.theme : ''; } };
function choose(v){
  previewing = null;
  sel.value = v; sel.dispatchEvent(new Event('change'));
  close(); paintBtn();
}
function open(){
  const r = btn.getBoundingClientRect();
  pop.style.top = (r.bottom + 8) + 'px';
  pop.style.right = Math.max(8, innerWidth - r.right) + 'px';
  pop.classList.add('on'); $('thQ').value = ''; build();
  setTimeout(() => $('thQ').focus(), 0);
}
function close(){ pop.classList.remove('on'); restore(); }
btn.onclick = e => { e.stopPropagation(); pop.classList.contains('on') ? close() : open(); };
pop.addEventListener('mouseleave', restore);
pop.addEventListener('click', e => e.stopPropagation());
document.addEventListener('click', () => { if(pop.classList.contains('on')) close(); });
$('thQ').addEventListener('input', build);
$('thQ').addEventListener('keydown', e => {
  e.stopPropagation();
  if(e.key === 'Escape') close();
  if(e.key === 'Enter'){ const first = $('thList').querySelector('.th-card'); if(first) choose(first.dataset.v); }
});
sel.addEventListener('change', paintBtn);
M.on('load', paintBtn); M.on('change', paintBtn);
paintBtn();
M.openThemes = open;
})();
