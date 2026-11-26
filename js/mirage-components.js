/* =====================================================================
   Mirage components: define your own component with a shape rule,
   an HTML template ({{key|default}} for editable text) and CSS.
   They are read by the classifier, rendered, exported and shared like the built-ins.
   ===================================================================== */
(() => {
'use strict';
const M = window.Mirage;
if(!M) return;
const $ = id => document.getElementById(id);
const esc = M.esc;
let editing = null;   // key being edited, or '' for a new one

const EXAMPLES = [
  {name:'FAQ', rule:{minW:10, minH:6, row:'alone'},
   template:'<section class="c-x-faq">\n  <h2>{{title|Questions, answered}}</h2>\n  <details open><summary>{{q1|Is it really free?}}</summary><p>{{a1|Yes. It is MIT licensed and runs in your browser.}}</p></details>\n  <details><summary>{{q2|Where are my sketches stored?}}</summary><p>{{a2|In this browser, with IndexedDB. Nothing is uploaded.}}</p></details>\n  <details><summary>{{q3|Can I use my own components?}}</summary><p>{{a3|You are looking at one.}}</p></details>\n</section>',
   css:'.c-x-faq{padding:var(--c-pad);border-bottom:var(--c-bw) solid var(--c-line)}\n.c-x-faq h2{font-family:var(--c-fd);font-weight:var(--c-hw);letter-spacing:var(--c-tt);font-size:24px;margin-bottom:14px}\n.c-x-faq details{border-top:1px solid var(--c-line);padding:12px 0}\n.c-x-faq summary{cursor:pointer;font-weight:600}\n.c-x-faq p{color:var(--c-mut);margin-top:6px;line-height:1.6}'},
  {name:'Testimonial', rule:{minW:5, maxW:9, minH:3, maxH:5, row:'shared'}, auto:false,
   template:'<figure class="c-x-testi">\n  <blockquote>{{quote|It turned a napkin into a landing page before lunch.}}</blockquote>\n  <figcaption><b>{{name|Priya Rao}}</b> <span>{{role|Founder, Northwind}}</span></figcaption>\n</figure>',
   css:'.c-x-testi{padding:var(--c-pad);margin:0;border-bottom:var(--c-bw) solid var(--c-line)}\n.c-x-testi blockquote{font-family:var(--c-fd);font-size:19px;line-height:1.4;margin:0 0 12px}\n.c-x-testi figcaption span{color:var(--c-mut)}'},
];

const slug = s => 'x_'+(String(s||'component').toLowerCase().replace(/[^a-z0-9]+/g,'_').replace(/^_|_$/g,'')||'component');
function list(){
  const el = $('compList'), cs = M.components;
  el.innerHTML = cs.length ? '' : '<p class="empty2">None yet. Start from an example or a blank one.</p>';
  cs.forEach(c => {
    const d = document.createElement('div'); d.className = 'li';
    const r = c.rule||{};
    const shape = r.auto===false ? 'pick only' : [r.minW||r.maxW ? 'w '+(r.minW||1)+'–'+(r.maxW||16) : '', r.minH||r.maxH ? 'h '+(r.minH||1)+'–'+(r.maxH||'∞') : '', r.where&&r.where!=='any'?r.where:'', r.row&&r.row!=='any'?r.row:''].filter(Boolean).join(' · ')||'any shape';
    d.innerHTML = '<b>'+esc(c.name)+'</b><span class="m">'+esc(shape)+' · '+M.templateFields(c.template).length+' fields</span><span class="a"><button>Edit</button></span>';
    d.querySelector('button').onclick = () => edit(c);
    el.appendChild(d);
  });
}
function edit(c){
  editing = c ? c.key : '';
  const r = (c && c.rule) || {};
  $('compEdit').hidden = false; $('compCode').hidden = false; $('bCompSave').hidden = false; $('bCompDel').hidden = !c;
  $('compName').value = c ? c.name : '';
  $('cMinW').value = r.minW||''; $('cMaxW').value = r.maxW||''; $('cMinH').value = r.minH||''; $('cMaxH').value = r.maxH||'';
  $('cWhere').value = r.where||'any'; $('cRow').value = r.row||'any'; $('cAuto').checked = r.auto!==false;
  $('compTpl').value = c ? c.template : '<section class="c-x-new">\n  <h2>{{title|A heading}}</h2>\n  <p>{{body|Some text you can edit in the preview.}}</p>\n</section>';
  $('compCss').value = c ? c.css : '.c-x-new{padding:var(--c-pad);border-bottom:var(--c-bw) solid var(--c-line)}\n.c-x-new h2{font-family:var(--c-fd);font-weight:var(--c-hw)}';
  $('compNote').textContent = 'Use the theme tokens (--c-bg, --c-fg, --c-acc, --c-pad…) so it follows every style.';
}
function save(){
  const name = $('compName').value.trim();
  if(!name){ M.toast('Give it a name'); return; }
  const tpl = $('compTpl').value.trim();
  if(!/class="c-/.test(tpl)){ M.toast('The outer element needs a class starting with c-'); return; }
  const num = id => { const v = parseInt($(id).value,10); return Number.isFinite(v) ? v : null; };
  const rule = {minW:num('cMinW'), maxW:num('cMaxW'), minH:num('cMinH'), maxH:num('cMaxH'), where:$('cWhere').value, row:$('cRow').value, auto:$('cAuto').checked};
  Object.keys(rule).forEach(k => rule[k]===null && delete rule[k]);
  const cs = M.components.filter(c => c.key!==editing);
  let key = editing || slug(name);
  while(!editing && cs.some(c => c.key===key)) key += '_2';
  cs.push({key, name, template:tpl, css:$('compCss').value, rule});
  M.setComponents(cs);
  editing = key; list(); $('bCompDel').hidden = false;
  M.toast('Saved "'+name+'". Draw a box that fits its shape, or pick it in the inspector.', 3000);
}
$('bCompSave').onclick = save;
$('bCompDel').onclick = () => {
  const c = M.components.find(x => x.key===editing); if(!c) return;
  if(!confirm('Delete "'+c.name+'"? Boxes using it go back to being read from their shape.')) return;
  M.boxes.forEach(b => { if(b.type===c.key){ delete b.type; delete b.locked; } });
  M.setComponents(M.components.filter(x => x.key!==editing));
  editing = null; $('compEdit').hidden = true; $('compCode').hidden = true; $('bCompSave').hidden = true; $('bCompDel').hidden = true;
  list();
};
$('bCompNew').onclick = () => edit(null);
$('bCompEx').onclick = () => {
  const have = new Set(M.components.map(c => c.name));
  const ex = EXAMPLES.find(e => !have.has(e.name)) || EXAMPLES[0];
  edit(null);
  $('compName').value = ex.name; $('compTpl').value = ex.template; $('compCss').value = ex.css;
  const r = ex.rule; $('cMinW').value = r.minW||''; $('cMaxW').value = r.maxW||''; $('cMinH').value = r.minH||''; $('cMaxH').value = r.maxH||'';
  $('cWhere').value = r.where||'any'; $('cRow').value = r.row||'any'; $('cAuto').checked = ex.auto!==false;
};
['compName','cMinW','cMaxW','cMinH','cMaxH','compTpl','compCss'].forEach(id => $(id).addEventListener('keydown', e => {
  e.stopPropagation();
  if((id==='compTpl'||id==='compCss') && e.key==='Tab'){ e.preventDefault(); const t = e.target, s = t.selectionStart; t.setRangeText('  ', s, t.selectionEnd, 'end'); }
}));
$('bComps').onclick = () => { list(); $('mComp').classList.add('on'); };
})();
