/* =====================================================================
   Mirage quality: accessibility and SEO checks, page titles and descriptions.
   ===================================================================== */
(() => {
'use strict';
const M = window.Mirage;
if(!M) return;
const $ = id => document.getElementById(id);
const esc = M.esc;

/* ---------------- colour maths (WCAG) */
const cv = document.createElement('canvas').getContext('2d');
function rgb(c){
  cv.fillStyle = '#000'; cv.fillStyle = (c||'').trim() || '#000';
  const v = cv.fillStyle;
  if(v[0]==='#') return [1,3,5].map(i => parseInt(v.slice(i,i+2),16));
  const m = v.match(/[\d.]+/g); return m ? m.slice(0,3).map(Number) : [0,0,0];
}
const lum = c => { const a = rgb(c).map(x => { x/=255; return x<=.03928 ? x/12.92 : Math.pow((x+.055)/1.055, 2.4); });
  return .2126*a[0]+.7152*a[1]+.0722*a[2]; };
const ratio = (a,b) => { const x = lum(a), y = lum(b); return (Math.max(x,y)+.05)/(Math.min(x,y)+.05); };
M.contrast = ratio;

/* ---------------- page meta */
const meta = () => M.pageMeta || {site:{}, pages:{}};
const pmeta = id => (meta().pages||{})[id] || {};
function setMeta(fn){ const m = JSON.parse(JSON.stringify(meta())); m.site = m.site||{}; m.pages = m.pages||{}; fn(m); M.pageMeta = m; }
M.metaFor = id => { const p = M.pages.find(x => x.id===id) || {}; const m = pmeta(id), site = meta().site||{};
  return {title: m.title || (p.name ? p.name+' · '+M.project.name : M.project.name), description: m.description || '', og: m.og || '', url: site.url||'', lang: site.lang||'en'}; };

/* ---------------- checks */
function checks(){
  const out = [];
  const add = (lv, html, fix) => out.push({lv, html, fix});
  const sheet = $('sheet'), cs = getComputedStyle(sheet), v = k => cs.getPropertyValue(k).trim();
  const bg = v('--c-bg')||'#fff', fg = v('--c-fg')||'#000', mut = v('--c-mut'), acc = v('--c-acc');
  const style = M.theme==='__custom' ? 'your Custom style' : (M.theme ? 'the '+M.theme+' style' : 'Plain');
  const r1 = ratio(fg,bg);
  if(r1 < 4.5) add('err', '<b>Body text contrast is '+r1.toFixed(2)+':1</b> in '+style+'. It needs at least 4.5:1.', M.theme==='__custom' ? ['Open Design', () => $('bDesign').click()] : null);
  if(mut){ const r2 = ratio(mut,bg); if(r2 < 4.5) add(r2<3?'err':'warn', '<b>Secondary text contrast is '+r2.toFixed(2)+':1</b> in '+style+'. Aim for 4.5:1.', M.theme==='__custom' ? ['Open Design', () => $('bDesign').click()] : null); }
  if(acc){ const r3 = Math.max(ratio('#fff',acc), ratio(fg,acc)); if(r3 < 4.5) add('warn', '<b>Button text on the accent colour is '+r3.toFixed(2)+':1.</b> Aim for 4.5:1.', M.theme==='__custom' ? ['Open Design', () => $('bDesign').click()] : null); }
  const D = M.D, defaults = new Set();
  const walk = v2 => { if(Array.isArray(v2)) v2.forEach(walk); else if(typeof v2==='string') defaults.add(v2); };
  Object.values(D).forEach(walk);
  const titles = {};
  M.pages.forEach((p, j) => {
    const {list} = M.classify(p.boxes), name = '<b>'+esc(p.name)+'</b>';
    const go = i => () => { document.querySelectorAll('.modal.on').forEach(m => m.classList.remove('on')); M.switchPage(j); if(i!=null){ M.sel = i; M.syncSel(); M.paint(); } };
    if(!p.boxes.length){ add('warn', name+' is empty.', ['Open', go(null)]); return; }
    let placeholders = 0;
    list.forEach((c, i) => {
      const b = p.boxes[i];
      if(c.merged) return;
      if(c.type==='image' || c.type==='gallery'){
        const keys = c.type==='gallery' ? Array.from({length:Math.max(2,Math.min(6,c.cells||3))}, (_,k) => 'gal'+k) : ['img'];
        keys.forEach(k => {
          const src = b.c && b.c[k+':src'], alt = b.c && b.c[k+':alt'];
          if(src && !alt) add('err', name+': an image has no alt text. Screen readers will skip it.', ['Fix', go(i)]);
          if(!src) placeholders++;
        });
      }
      M.fieldsFor(c, {pageNames: M.pages.length>1 ? M.pages.map(x=>x.name) : []}).forEach(([k, def]) => {
        const val = (b.c && b.c[k]) || def;
        if(defaults.has(val) && !/^nav[PA-C]|^img$|^gal\d/.test(k)) placeholders++;
      });
    });
    if(placeholders) add('warn', name+' still has '+placeholders+' placeholder text'+(placeholders>1?'s':'')+' or images.', ['AI copy', () => { go(null)(); $('bAI').click(); M.emit('ai-mode','copy'); }]);
    if(!list.some(c => c.type==='nav')) add('warn', name+' has no nav bar, so visitors cannot move between pages.', null);
    const m = M.metaFor(p.id), own = pmeta(p.id);
    if(!own.description) add('warn', name+' has no meta description. Search results will guess one.', ['Add', openPageSet]);
    else if(own.description.length < 50 || own.description.length > 160) add('warn', name+': the description is '+own.description.length+' characters. 50 to 160 shows best in search.', ['Edit', openPageSet]);
    (titles[m.title] = titles[m.title] || []).push(p.name);
  });
  Object.entries(titles).forEach(([t, ps]) => { if(ps.length>1) add('warn', 'Pages '+ps.map(x=>'<b>'+esc(x)+'</b>').join(', ')+' share the title "'+esc(t)+'".', ['Edit', openPageSet]); });
  if(M.pages.length>1 && !(meta().site||{}).url) add('warn', 'No site URL set, so the sitemap and share previews use relative links.', ['Add', openPageSet]);
  return out;
}
M.checks = checks;
function count(){
  let list; try{ list = checks(); }catch(_){ return; }
  const errs = list.filter(x => x.lv==='err').length;
  $('chkN').textContent = list.length ? list.length : '✓';
  $('bCheck').classList.toggle('bad', errs>0);
  $('bCheck').classList.toggle('ok', !list.length);
  $('bCheck').title = errs+' errors, '+(list.length-errs)+' warnings';
}
let t = null;
const later = () => { clearTimeout(t); t = setTimeout(count, 300); };
['commit','change','load','render'].forEach(ev => M.on(ev, later));
function openChecks(){
  const list = checks(), el = $('chkList');
  el.innerHTML = list.length ? '' : '<div class="issue"><span class="lv ok">OK</span><span class="tx">Nothing to fix. Contrast, alt text, titles and descriptions all pass.</span></div>';
  list.forEach(x => {
    const d = document.createElement('div'); d.className = 'issue';
    d.innerHTML = '<span class="lv '+x.lv+'">'+(x.lv==='err'?'ERROR':'WARN')+'</span><span class="tx">'+x.html+'</span>';
    if(x.fix){ const b = document.createElement('button'); b.textContent = x.fix[0]; b.onclick = x.fix[1]; d.appendChild(b); }
    el.appendChild(d);
  });
  $('mCheck').classList.add('on');
}
$('bCheck').onclick = openChecks;

/* ---------------- page settings */
function openPageSet(){
  document.querySelectorAll('.modal.on').forEach(m => m.classList.remove('on'));
  const site = meta().site || {};
  $('siteUrl').value = site.url || ''; $('siteLang').value = site.lang || '';
  const el = $('pageMetaList'); el.innerHTML = '';
  const imgs = Object.keys(M.assets);
  M.pages.forEach(p => {
    const m = pmeta(p.id), d = document.createElement('div'); d.className = 'pmeta';
    d.innerHTML = '<h4>'+esc(p.name)+'</h4>'+
      '<input class="tin" data-k="title" placeholder="'+esc(p.name+' · '+M.project.name)+'" value="'+esc(m.title||'')+'">'+
      '<textarea class="tin" data-k="description" rows="2" placeholder="One or two sentences for search results and link previews">'+esc(m.description||'')+'</textarea>'+
      '<div class="row2"><span class="cnt"></span><div class="sel full" style="max-width:260px"><select data-k="og"><option value="">No share image</option>'+
      imgs.map((id,k) => '<option value="asset:'+id+'"'+(m.og==='asset:'+id?' selected':'')+'>Project image '+(k+1)+'</option>').join('')+
      '</select><svg width="9" height="6" viewBox="0 0 9 6" fill="none"><path d="M1 1l3.5 3.5L8 1" stroke="currentColor" stroke-width="1.4"/></svg></div></div>';
    const cnt = d.querySelector('.cnt'), ta = d.querySelector('textarea');
    const upd = () => { const n = ta.value.trim().length; cnt.textContent = n+' / 160'+(n && (n<50||n>160) ? ' · aim for 50 to 160' : ''); };
    upd();
    d.querySelectorAll('[data-k]').forEach(inp => {
      inp.addEventListener('keydown', e => e.stopPropagation());
      inp.addEventListener('input', upd);
      inp.addEventListener('change', () => setMeta(mm => { mm.pages[p.id] = mm.pages[p.id] || {}; mm.pages[p.id][inp.dataset.k] = inp.value.trim(); }));
    });
    el.appendChild(d);
  });
  $('mPage').classList.add('on');
}
['siteUrl','siteLang'].forEach(id => {
  $(id).addEventListener('keydown', e => e.stopPropagation());
  $(id).addEventListener('change', () => setMeta(m => { m.site.url = $('siteUrl').value.trim().replace(/\/+$/,''); m.site.lang = $('siteLang').value.trim(); }));
});
$('bPageSet').onclick = e => { e.preventDefault(); e.stopPropagation(); openPageSet(); };
M.openPageSet = openPageSet;
later();
})();
