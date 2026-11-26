/* =====================================================================
   Mirage AI: write the copy, design a palette, draft a layout.
   Bring your own Gemini key. Calls go from the browser to Google only.
   ===================================================================== */
(() => {
'use strict';
const M = window.Mirage;
if(!M) return;
const $ = id => document.getElementById(id);
const LS = {get:k=>{ try{ return localStorage.getItem(k); }catch(_){ return null; } }, set:(k,v)=>{ try{ localStorage.setItem(k,v); }catch(_){} }};

const FONTS = [...$('dFontD').options].map(o => o.value);
const mode = () => { const on = $('aiMode').querySelector('.on'); return on ? on.dataset.m : 'copy'; };
const setMode = m => { [...$('aiMode').children].forEach(b => b.classList.toggle('on', b.dataset.m===m)); hint(); };
const HINTS = {
  copy:'Rewrites every piece of text on this page to fit the brief. The layout stays as drawn.',
  design:'Picks colours, fonts and shape for the brief and switches the style to Custom.',
  layout:'Draws a new page of boxes for the brief. Your current page is kept; this adds a new one.',
};
const hint = () => { $('aiNote').textContent = HINTS[mode()]; };
[...$('aiMode').children].forEach(b => b.addEventListener('click', hint));
M.on('ai-mode', setMode);

$('aiKey').value = LS.get('mirage.gemini') || '';
$('aiModel').value = LS.get('mirage.geminiModel') || $('aiModel').value;
['aiKey','aiModel','aiBrief'].forEach(id => $(id).addEventListener('keydown', e => {
  e.stopPropagation();
  if(id==='aiBrief' && e.key==='Enter' && (e.metaKey||e.ctrlKey)){ e.preventDefault(); run(); }
}));
$('bAI').onclick = () => { $('mAI').classList.add('on'); hint(); setTimeout(() => $('aiBrief').focus(), 0); };

async function gemini(prompt, imageDataUrl){
  const key = $('aiKey').value.trim(), model = $('aiModel').value.trim() || 'gemini-2.5-flash';
  if(!key) throw new Error('Add a Gemini API key first');
  LS.set('mirage.gemini', key); LS.set('mirage.geminiModel', model);
  const res = await fetch('https://generativelanguage.googleapis.com/v1beta/models/'+encodeURIComponent(model)+':generateContent', {
    method:'POST',
    headers:{'Content-Type':'application/json', 'x-goog-api-key':key},
    body: JSON.stringify({
      contents:[{role:'user', parts:[{text:prompt}].concat(imageDataUrl ? [{inline_data:{
        mime_type:imageDataUrl.slice(5, imageDataUrl.indexOf(';')), data:imageDataUrl.slice(imageDataUrl.indexOf(',')+1)}}] : [])}],
      generationConfig:{responseMimeType:'application/json', temperature:0.8},
    }),
  });
  const j = await res.json().catch(() => ({}));
  if(!res.ok) throw new Error((j.error && j.error.message) || ('Gemini returned '+res.status));
  const t = (((j.candidates||[])[0]||{}).content||{}).parts;
  const text = t && t.map(p => p.text||'').join('');
  if(!text) throw new Error('Empty answer from Gemini');
  return JSON.parse(text.replace(/^```(?:json)?\s*|\s*```$/g,''));
}

/* every editable string on the page, straight from the live preview */
function fields(){
  const by = {};
  document.querySelectorAll('#sheet .ed').forEach(el => {
    const i = +el.dataset.b, k = el.dataset.k;
    if(k==='code' || k==='img' || /^gal\d/.test(k)) return;
    by[i] = by[i] || {box:i, type:M.NICE[M.classify().list[i].type], fields:{}};
    by[i].fields[k] = el.textContent;
  });
  return Object.values(by);
}

const RUN = {
  async copy(brief){
    const f = fields();
    if(!f.length) throw new Error('Draw something first, then write its copy');
    const out = await gemini(
      'You write website copy. Brief: '+JSON.stringify(brief)+'\n'+
      'Here is every text field on the page, grouped by component, with placeholder text:\n'+JSON.stringify(f)+'\n'+
      'Rewrite each field for the brief. Keep each about as long as the placeholder, plain text, no markdown, no emoji. '+
      'Headings short and specific. Button labels two or three words. Keep the same keys.\n'+
      'Answer as JSON: {"boxes":[{"box":<number>,"fields":{"<key>":"<text>"}}]}');
    let n = 0;
    (out.boxes||[]).forEach(b => {
      if(!M.boxes[b.box] || !b.fields) return;
      Object.entries(b.fields).forEach(([k,v]) => { if(typeof v==='string'){ M.setTxt(b.box, k, v.slice(0,400)); n++; } });
    });
    M.push(); M.render();
    return 'Rewrote '+n+' pieces of text. ⌘Z to undo.';
  },
  async design(brief){
    const out = await gemini(
      'You are a brand designer. Brief: '+JSON.stringify(brief)+'\n'+
      'Choose a design system. Fonts must come from this list: '+JSON.stringify(FONTS)+'.\n'+
      'Colours as #RRGGBB. Text must have at least 4.5:1 contrast on the background.\n'+
      'Answer as JSON: {"bg":"","fg":"","mut":"","line":"","acc":"","fontD":"","fontB":"","weight":300-900,'+
      '"track":-60..20,"radius":0..32,"border":0..4,"pad":14..48,"shadow":"none"|"soft"|"hard","why":"one sentence"}');
    const hex = v => /^#[0-9a-f]{6}$/i.test(v||'') ? v.toUpperCase() : null;
    const num = (v,a,b,d) => Number.isFinite(+v) ? Math.max(a,Math.min(b,Math.round(+v))) : d;
    const D = M.design, nd = {...D};
    ['bg','fg','mut','line','acc'].forEach(k => { const h = hex(out[k]); if(h) nd[k]=h; });
    if(FONTS.indexOf(out.fontD)>=0) nd.fontD = out.fontD;
    if(FONTS.indexOf(out.fontB)>=0) nd.fontB = out.fontB;
    nd.weight = num(out.weight,300,900,D.weight); nd.weight = Math.round(nd.weight/100)*100;
    nd.track = num(out.track,-60,20,D.track); nd.track = Math.round(nd.track/5)*5;
    nd.radius = num(out.radius,0,32,D.radius); nd.border = num(out.border,0,4,D.border); nd.pad = num(out.pad,14,48,D.pad);
    nd.shadow = {none:'none', soft:'0 2px 10px rgba(0,0,0,.08)', hard:'5px 5px 0 currentColor'}[out.shadow] || D.shadow;
    M.design = nd; M.theme = '__custom'; M.render(); M.scheduleSave(); M.emit('change');
    return (out.why ? out.why+' ' : '')+'Applied as the Custom style. Tweak it in Design.';
  },
  async layout(brief){
    const out = await gemini(
      'You lay out web pages as boxes on a grid that is '+M.COLS+' columns wide; rows are the same size as columns. Brief: '+JSON.stringify(brief)+'\n'+
      'The page is built by reading box geometry, so draw shapes that read correctly:\n'+
      '- nav: first row, full width (16), 2 tall\n- footer: last row, full width, 2 tall\n'+
      '- hero: near the top, full width or the widest in its row, at least 5 tall\n'+
      '- card grid: 2 to 4 boxes of equal width in one row, each at most 8 wide, 4 to 6 tall\n'+
      '- logo row: 4 to 6 equal boxes, 1 to 2 tall\n- image: roughly square, at most 8 wide, beside other boxes\n'+
      '- text block: wide and 4 or more tall\n- CTA banner: full width, 3 to 4 tall\n- side nav: at most 4 wide, tall\n'+
      'Boxes in the same row share the same top (cy). No overlaps. x from 0, widths in a row add up to 16. 6 to 12 boxes.\n'+
      'Answer as JSON: {"name":"short page name","boxes":[{"cx":0,"cy":0,"cw":16,"ch":2}]}');
    const raw = (out.boxes||[]).map(b => ({x:+b.cx, y:+b.cy, w:+b.cw, h:+b.ch}))
      .filter(r => [r.x,r.y,r.w,r.h].every(Number.isFinite) && r.w>=1 && r.h>=1);
    if(!raw.length) throw new Error('Gemini did not return any boxes');
    const boxes = M.rectsToBoxes(raw, M.COLS);
    M.addPage((out.name||'AI draft').slice(0,30));
    M.boxes = boxes; M.sel = -1; M.resize(); M.commit(true); M.syncPages();
    return 'Drew '+boxes.length+' boxes on a new page. Run "Write the copy" next to fill it in.';
  },
};

async function run(){
  const brief = $('aiBrief').value.trim();
  if(!brief){ $('aiOut').textContent = 'Write a one-line brief first.'; return; }
  const btn = $('bAIRun'); btn.disabled = true; btn.textContent = 'Working…';
  $('aiOut').textContent = '';
  try{
    const msg = await RUN[mode()](brief);
    $('aiOut').textContent = msg; M.toast(msg.split('.')[0], 2400);
  }catch(err){
    $('aiOut').textContent = 'Could not finish: '+err.message;
  }finally{ btn.disabled = false; btn.textContent = 'Generate'; }
}
$('bAIRun').onclick = run;
M.gemini = gemini;   // shared with the import panel for reading handwritten labels
hint();
})();
