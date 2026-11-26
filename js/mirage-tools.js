/* =====================================================================
   Mirage tools: palette, snippets, versions, share links, more exports,
   site zip, Netlify deploy, Figma SVG round trip, per-box copy.
   Talks to the engine only through window.Mirage.
   ===================================================================== */
(() => {
'use strict';
const M = window.Mirage;
if(!M){ console.error('Mirage engine missing'); return; }
const $ = id => document.getElementById(id);
const esc = M.esc;
const open = id => { $(id).classList.add('on'); };
const close = id => { $(id).classList.remove('on'); };
document.querySelectorAll('[data-x]').forEach(b => b.onclick = () => close(b.dataset.x));

const slug = s => (s||'page').toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'') || 'page';
const download = (name, data, type) => {
  const blob = data instanceof Blob ? data : new Blob([data], {type: type||'text/plain'});
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob); a.download = name;
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 1500);
};
const copyText = t => (navigator.clipboard && navigator.clipboard.writeText
  ? navigator.clipboard.writeText(t) : Promise.reject()).then(
  () => M.toast('Copied'),
  () => { const ta=document.createElement('textarea'); ta.value=t; ta.style.position='fixed'; ta.style.opacity='0';
    document.body.appendChild(ta); ta.select(); try{ document.execCommand('copy'); M.toast('Copied'); }catch(_){ M.toast('Select and copy manually'); } ta.remove(); });

/* ============================================================ zip (store, no compression) */
const CRC = (() => { const t=new Uint32Array(256);
  for(let n=0;n<256;n++){ let c=n; for(let k=0;k<8;k++) c = c&1 ? 0xEDB88320^(c>>>1) : c>>>1; t[n]=c>>>0; } return t; })();
const crc32 = u8 => { let c=0xFFFFFFFF; for(let i=0;i<u8.length;i++) c = CRC[(c^u8[i])&255]^(c>>>8); return (c^0xFFFFFFFF)>>>0; };
function zip(files){            // files: [{name, data: string|Uint8Array}]
  const enc = new TextEncoder(), parts = [], central = [];
  let off = 0;
  const d = new Date(), time = (d.getHours()<<11)|(d.getMinutes()<<5)|(d.getSeconds()>>1),
        date = ((d.getFullYear()-1980)<<9)|((d.getMonth()+1)<<5)|d.getDate();
  files.forEach(f => {
    const name = enc.encode(f.name), data = typeof f.data==='string' ? enc.encode(f.data) : f.data, crc = crc32(data);
    const lh = new DataView(new ArrayBuffer(30));
    lh.setUint32(0,0x04034b50,true); lh.setUint16(4,20,true); lh.setUint16(6,0x0800,true); lh.setUint16(8,0,true);
    lh.setUint16(10,time,true); lh.setUint16(12,date,true); lh.setUint32(14,crc,true);
    lh.setUint32(18,data.length,true); lh.setUint32(22,data.length,true); lh.setUint16(26,name.length,true);
    parts.push(new Uint8Array(lh.buffer), name, data);
    const ch = new DataView(new ArrayBuffer(46));
    ch.setUint32(0,0x02014b50,true); ch.setUint16(4,20,true); ch.setUint16(6,20,true); ch.setUint16(8,0x0800,true);
    ch.setUint16(12,time,true); ch.setUint16(14,date,true); ch.setUint32(16,crc,true);
    ch.setUint32(20,data.length,true); ch.setUint32(24,data.length,true); ch.setUint16(28,name.length,true);
    ch.setUint32(42,off,true);
    central.push(new Uint8Array(ch.buffer), name);
    off += 30 + name.length + data.length;
  });
  const csize = central.reduce((n,p)=>n+p.length,0);
  const end = new DataView(new ArrayBuffer(22));
  end.setUint32(0,0x06054b50,true); end.setUint16(8,files.length,true); end.setUint16(10,files.length,true);
  end.setUint32(12,csize,true); end.setUint32(16,off,true);
  return new Blob([...parts, ...central, new Uint8Array(end.buffer)], {type:'application/zip'});
}
M.zip = zip;

/* ============================================================ assets in downloads */
const dataBytes = u => { const b = atob(u.slice(u.indexOf(',')+1)), a = new Uint8Array(b.length); for(let i=0;i<b.length;i++) a[i]=b.charCodeAt(i); return a; };
function assetFiles(dir, states){
  const used = M.usedAssets ? M.usedAssets(states || M.state()) : new Set(Object.keys(M.assets));
  return [...used].filter(id => M.assets[id]).map(id => ({name: dir+id+'.'+M.assetExt(M.assets[id]), data: dataBytes(M.assets[id])}));
}
/* run fn with exported image paths instead of inline data */
function withAssets(prefix, fn){ M.setAssetMode(prefix); try{ return fn(); } finally { M.setAssetMode('inline'); } }

/* ============================================================ site build */
function pageFiles(){
  const used = new Set();
  return M.pages.map((p,j) => {
    let f = j===0 ? 'index' : slug(p.name);
    while(used.has(f)) f += '-'+j;
    used.add(f);
    return {page:p, file:f};
  });
}
const pageClass = () => 'page' + (M.theme ? ' th-'+M.theme : '');
let SITE = null;   // shared head/sitemap builders from core
import(new URL('./core/site.js', document.currentScript.src).href).then(m => { SITE = m; });
function buildSite(){
  const files = pageFiles(), css = withAssets('assets/', () => M.exCSS());
  const links = files.map(f => ({name:f.page.name, href:f.file+'.html'}));
  const out = [{name:'mirage.css', data:css+'\n.page{max-width:1200px;margin:0 auto}\n'}];
  M.setExportLinks(M.pages.length>1 ? links : null);
  try{
    files.forEach(f => {
      const body = withAssets('assets/', () => M.exBody(f.page.boxes));
      const m = M.metaFor(f.page.id), og = m.og ? 'assets/'+m.og.slice(6)+'.'+M.assetExt(M.assets[m.og.slice(6)]||'') : '';
      out.push({name:f.file+'.html', data:SITE.pageHTML(m, f.file==='index' ? '' : f.file+'.html', og, body, pageClass())});
    });
  } finally { M.setExportLinks(null); }
  const site = ((M.pageMeta||{}).site||{}).url;
  if(site) out.push({name:'sitemap.xml', data:SITE.sitemapXML(site, files.map(f => f.file==='index' ? '' : f.file+'.html'))});
  out.push({name:'robots.txt', data:SITE.robotsTXT(site)});
  return out.concat(assetFiles('assets/'));
}
const siteZip = () => zip(buildSite());
$('bSiteZip').onclick = () => { download(slug(M.project.name)+'-site.zip', siteZip()); M.toast('Downloaded the site'); };

/* ============================================================ framework exports */
const braces = s => s.replace(/\{/g,'&#123;').replace(/\}/g,'&#125;');
const indent = (s,n) => s.split('\n').map(l => l ? ' '.repeat(n)+l : l).join('\n');
const curBody = () => M.exBody() || '  <!-- nothing drawn yet -->';

function exVue(){
  return '<!-- generated by Mirage · Vue SFC -->\n<template>\n  <main class="'+pageClass()+'">\n'+
    indent(braces(curBody()),2)+'\n  </main>\n</template>\n\n<style>\n'+M.exCSS()+'\n</style>\n';
}
function exSvelte(){
  const css = M.exCSS().replace(/`/g,'\\`').replace(/\$\{/g,'\\${');
  return '<!-- generated by Mirage · Svelte -->\n<main class="'+pageClass()+'">\n'+braces(curBody())+'\n</main>\n\n'+
    '<svelte:head>\n  {@html `<style>\n'+css+'\n</style>`}\n</svelte:head>\n';
}
function exAstro(){
  return '---\n// generated by Mirage · Astro\n---\n<main class="'+pageClass()+'">\n'+braces(curBody())+
    '\n</main>\n\n<style is:global>\n'+M.exCSS()+'\n</style>\n';
}
/* HTML to JSX lives in core so the CLI uses the same conversion */
let toJSX = h => h;
import(new URL('./core/jsx.js', document.currentScript.src).href).then(m => { toJSX = m.toJSX; });
function nextPage(p, name){
  const body = withAssets('/assets/', () => M.exBody(p ? p.boxes : undefined)) || '  {/* nothing drawn yet */}';
  const m = M.metaFor && p ? M.metaFor(p.id) : null;
  const md = m ? 'export const metadata = '+JSON.stringify({title:m.title, ...(m.description?{description:m.description}:{}),
    openGraph:{title:m.title, ...(m.description?{description:m.description}:{}), ...(m.og?{images:['/assets/'+m.og.slice(6)+'.'+M.assetExt(M.assets[m.og.slice(6)]||'')]}:{})}}, null, 2)+'\n\n' : '';
  return "// generated by Mirage · Next.js App Router\n"+(name?"// app/"+name+"/page.jsx\n":"// app/page.jsx\n")+md+
    "export default function Page() {\n  return (\n    <main className=\""+pageClass()+"\">\n"+
    indent(toJSX(body),4)+"\n    </main>\n  )\n}\n";
}
function exNext(){
  return nextPage(null)+'\n// Styles go in app/mirage.css and are imported once in app/layout.jsx.\n'+
    '// Download gives you the whole app folder, every page included.\n';
}
exNext.download = () => {
  const files = pageFiles(), out = [];
  const links = files.map(f => ({name:f.page.name, href:f.file==='index'?'/':'/'+f.file}));
  M.setExportLinks(M.pages.length>1 ? links : null);
  try{
    files.forEach(f => out.push({name: f.file==='index' ? 'app/page.jsx' : 'app/'+f.file+'/page.jsx',
      data: nextPage(f.page, f.file==='index'?null:f.file)}));
  } finally { M.setExportLinks(null); }
  out.push({name:'app/mirage.css', data:M.exCSS()});
  assetFiles('public/assets/').forEach(f => out.push(f));
  const site = ((M.pageMeta||{}).site||{}).url;
  if(site) out.push({name:'app/sitemap.js', data:'export default function sitemap() {\n  return '+JSON.stringify(files.map(f => ({url: site+(f.file==='index'?'':'/'+f.file)})), null, 2)+'\n}\n'});
  out.push({name:'app/layout.jsx', data:
    "// generated by Mirage\nimport './mirage.css'\n\nexport const metadata = { title: "+JSON.stringify(M.project.name)+" }\n\n"+
    "export default function RootLayout({ children }) {\n  return (\n    <html lang=\""+(((M.pageMeta||{}).site||{}).lang||'en')+"\">\n      <body>{children}</body>\n    </html>\n  )\n}\n"});
  download(slug(M.project.name)+'-next.zip', zip(out)); M.toast('Downloaded the Next.js app folder');
};
M.exports.react.download = async () => {
  let ui;
  try{ ui = await (await fetch(new URL('../packages/ui/src/index.jsx', location.href))).text(); }
  catch(_){ M.toast('Could not load the component file'); return; }
  const page = withAssets('/assets/', () => M.exReact());
  download(slug(M.project.name)+'-react.zip', zip([
    {name:'src/Page.jsx', data:page},
    {name:'src/mirage-ui.jsx', data:ui},
    {name:'src/mirage.css', data:M.exCSS()},
    {name:'README.md', data:'# '+M.project.name+'\n\nExported from Mirage. Drop `src/` into any React app (Vite, Next, CRA) and render `<Page />`.\n'+
      'Images are in `public/assets/`. To use the published package instead, `npm i @mirage/ui` and change the import in Page.jsx.\n'},
  ].concat(assetFiles('public/assets/'))));
  M.toast('Downloaded the React page with its components');
};
M.exnotes.react = 'Imports the real components. Download includes mirage-ui.jsx, the CSS and your images.';
Object.assign(M.exports, {vue:exVue, svelte:exSvelte, astro:exAstro, next:exNext});
Object.assign(M.ext, {vue:'vue', svelte:'svelte', astro:'astro', next:'jsx'});
Object.assign(M.exnotes, {
  vue:'Single file component. Global styles, so the page classes work as is.',
  svelte:'Styles are injected through svelte:head so Svelte does not strip unused selectors.',
  astro:'Drop into src/pages. Styles are global.',
  next:'This page as app/page.jsx. Download gives every page plus layout and CSS as a zip.',
});

/* ============================================================ per-box copy */
function findLaid(id){
  let hit = null;
  const walk = rows => rows.forEach(r => r.items.forEach(b => { if(b.id===id) hit=b; if(b.rows) walk(b.rows); }));
  walk(M.laidRows());
  return hit;
}
$('bCopyBox').onclick = () => {
  const b = M.boxes[M.sel]; if(!b) return;
  let laid = findLaid(b.id);
  if(!laid){ // merged box: copy the component it belongs to
    const c = M.classify().list[M.sel];
    if(c.merged){ const lead = M.boxes.find((x,i)=>{ const l=M.classify().list[i]; return l.lead && l.row===c.row && !x.pid===!b.pid; }); if(lead) laid=findLaid(lead.id); }
  }
  if(!laid){ M.toast('Nothing to copy'); return; }
  copyText(M.mk(laid,'')).then(()=>M.toast('Copied '+M.NICE[laid.type]+' HTML'));
};

/* ============================================================ shared nav toggle */
$('shareChrome').checked = M.shareChrome;
$('shareChrome').onchange = e => { M.shareChrome = e.target.checked; M.toast(e.target.checked?'Nav and footer text shared across pages':'Each page keeps its own nav and footer text'); };
M.on('load', () => { $('shareChrome').checked = M.shareChrome; });

/* ============================================================ snippets */
let snippets = [];
M.STORE.setting('snippets').then(v => { snippets = v || []; });
const saveSnips = () => M.STORE.setting('snippets', snippets);
function openSnips(){
  const {list, rows} = M.classify();
  $('snipRows').innerHTML = rows.length ? rows.map((r,ri) =>
    '<label><input type="checkbox" value="'+ri+'"> Row '+(ri+1)+' <span>'+
    esc(r.items.filter(o=>!list[o.i].merged).map(o=>M.NICE[list[o.i].type]+(list[o.i].cells>1?' ×'+list[o.i].cells:'')).join(', '))+
    '</span></label>').join('') : '<p class="empty2">Draw something first.</p>';
  renderSnipList(); open('mSnip');
}
function renderSnipList(){
  const el = $('snipList');
  if(!snippets.length){ el.innerHTML = '<p class="empty2">No snippets yet. Tick some rows above and save them.</p>'; return; }
  el.innerHTML = '';
  snippets.forEach((sn,k) => {
    const d = document.createElement('div'); d.className='li';
    d.innerHTML = '<b>'+esc(sn.name)+'</b><span class="m">'+sn.boxes.filter(b=>!b.pid).length+' boxes</span>'+
      '<span class="a"><button data-a="ins">Insert</button><button data-a="del" class="dg">Delete</button></span>';
    d.querySelector('[data-a=ins]').onclick = () => { insertSnippet(sn); close('mSnip'); };
    d.querySelector('[data-a=del]').onclick = () => { snippets.splice(k,1); saveSnips(); renderSnipList(); };
    el.appendChild(d);
  });
}
$('bSnipSave').onclick = () => {
  const picked = [...$('snipRows').querySelectorAll('input:checked')].map(i => +i.value);
  if(!picked.length){ M.toast('Tick at least one row'); return; }
  const {rows} = M.classify();
  const chosen = new Set();
  picked.forEach(ri => rows[ri].items.forEach(o => chosen.add(M.boxes[o.i].id)));
  const boxes = M.boxes.filter(b => chosen.has(b.id) || chosen.has(b.pid)).map(b => M.clone(b));
  const minY = Math.min(...boxes.filter(b=>!b.pid).map(b=>b.cy));
  boxes.forEach(b => b.cy -= minY);
  const name = $('snipName').value.trim() || ('Snippet '+(snippets.length+1));
  snippets.unshift({id:M.bid(), name, boxes, at:Date.now()});
  saveSnips(); $('snipName').value=''; renderSnipList(); M.toast('Saved "'+name+'"');
};
function insertSnippet(sn){
  const y0 = M.boxes.filter(b=>!b.pid).reduce((m,b)=>Math.max(m,b.cy+b.ch),0) + (M.boxes.length?1:0);
  const map = {};
  const fresh = sn.boxes.map(b => { const nb = {...M.clone(b), id:M.bid(), cy:b.cy+y0}; map[b.id]=nb.id; return nb; });
  fresh.forEach(b => { if(b.pid) b.pid = map[b.pid]; });
  fresh.sort((a,b) => (a.pid?1:0)-(b.pid?1:0));
  M.boxes = M.boxes.concat(fresh); M.sel = -1; M.resize(); M.commit(true);
  M.toast('Inserted "'+sn.name+'" · ⌘Z to undo');
}
$('bSnips').onclick = openSnips;

/* ============================================================ versions */
function renderVers(){
  const el = $('verList'), v = M.versions;
  if(!v.length){ el.innerHTML = '<p class="empty2">No versions yet. Name one before a big change.</p>'; return; }
  el.innerHTML = '';
  v.forEach((x,k) => {
    const d = document.createElement('div'); d.className='li';
    const pagesN = x.state.pages.length, boxesN = x.state.pages.reduce((n,p)=>n+p.boxes.length,0);
    d.innerHTML = '<b>'+esc(x.name)+'</b><span class="m">'+new Date(x.at).toLocaleString()+' · '+pagesN+' page'+(pagesN>1?'s':'')+
      ' · '+boxesN+' boxes</span><span class="a"><button data-a="r">Restore</button><button data-a="d" class="dg">Delete</button></span>';
    d.querySelector('[data-a=r]').onclick = () => restoreVersion(x);
    d.querySelector('[data-a=d]').onclick = () => { if(!confirm('Delete version "'+x.name+'"? This cannot be undone.')) return;
      v.splice(k,1); M.versions = v; renderVers(); };
    el.appendChild(d);
  });
}
function saveVersion(name){
  const v = M.versions.slice();
  v.unshift({id:M.bid(), name:name||('Version '+(v.length+1)), at:Date.now(), state:M.state()});
  if(v.length>40) v.length = 40;
  M.versions = v; M.saveNow();
}
function restoreVersion(x){
  saveVersion('Before restoring "'+x.name+'"');
  M.applyState(x.state, {keepName:true});
  M.emit('change'); renderVers(); M.toast('Restored "'+x.name+'". The previous state was saved as a version.', 3000);
}
$('bVerSave').onclick = () => { saveVersion($('verName').value.trim()); $('verName').value=''; renderVers(); M.toast('Version saved'); };
$('verName').addEventListener('keydown', e => { e.stopPropagation(); if(e.key==='Enter') $('bVerSave').click(); });
$('bVers').onclick = () => { renderVers(); open('mVer'); };

/* ============================================================ share links */
const b64u = u8 => { let s=''; for(let i=0;i<u8.length;i+=0x8000) s+=String.fromCharCode.apply(null,u8.subarray(i,i+0x8000));
  return btoa(s).replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,''); };
const unb64u = s => { s=s.replace(/-/g,'+').replace(/_/g,'/'); while(s.length%4) s+='=';
  const b=atob(s), u=new Uint8Array(b.length); for(let i=0;i<b.length;i++) u[i]=b.charCodeAt(i); return u; };
async function pack(obj){
  const raw = new TextEncoder().encode(JSON.stringify(obj));
  if(window.CompressionStream){
    const out = await new Response(new Blob([raw]).stream().pipeThrough(new CompressionStream('deflate-raw'))).arrayBuffer();
    return 'z'+b64u(new Uint8Array(out));
  }
  return 'j'+b64u(raw);
}
async function unpack(str){
  const kind = str[0], u8 = unb64u(str.slice(1));
  let txt;
  if(kind==='z'){
    if(!window.DecompressionStream) throw new Error('This browser cannot open compressed links');
    txt = await new Response(new Blob([u8]).stream().pipeThrough(new DecompressionStream('deflate-raw'))).text();
  } else txt = new TextDecoder().decode(u8);
  return JSON.parse(txt);
}
M.pack = pack; M.unpack = unpack;
let sharedImages = 0;
const strip = st => { // drop editor-only fields and images to keep links short
  st = M.clone({...st, assets:undefined});
  sharedImages = 0;
  st.pages.forEach(p => p.boxes.forEach(b => {
    delete b.conf; delete b.row; delete b.alts;
    if(b.c) Object.keys(b.c).forEach(k => { if(/:src$/.test(k)){ delete b.c[k]; sharedImages++; } });
  }));
  if(st.pageMeta && st.pageMeta.pages) Object.values(st.pageMeta.pages).forEach(m => { if(m) delete m.og; });
  return st;
};
async function shareUrl(){
  const code = await pack({v:1, ...strip(M.state())});
  return location.origin + location.pathname + '#s=' + code;
}
async function openShare(){
  open('mShare');
  $('shareUrl').value = 'Packing…';
  const url = await shareUrl();
  $('shareUrl').value = url;
  $('shareLen').textContent = url.length > 8000
    ? 'This link is '+url.length.toLocaleString()+' characters. Some chat apps cut long links; the JSON export is safer for big projects.'
    : url.length.toLocaleString()+' characters.';
  if(sharedImages) $('shareLen').textContent += ' Images are not included in links ('+sharedImages+' left out); send the JSON export to share them.';
  try{ $('nlToken').value = localStorage.getItem('mirage.netlify') || ''; }catch(_){}
}
$('bShare').onclick = openShare;
$('bShareCopy').onclick = () => copyText($('shareUrl').value);
async function bootShare(){
  const m = location.hash.match(/^#s=(.+)$/);
  if(!m) return;
  try{
    const st = await unpack(m[1]);
    M.newProject();
    M.applyState(st);
    M.project.name = (st.name||'Shared sketch'); $('projName').textContent = M.project.name;
    M.saveNow();
    history.replaceState(null,'',location.pathname);
    M.toast('Opened a shared sketch. It is saved as your own copy.', 3200);
  }catch(err){ console.error(err); M.toast('That share link is damaged'); }
}
bootShare();
/* /mirage?example=bakery opens a gallery example as your own copy */
(async () => {
  const ex = new URLSearchParams(location.search).get('example');
  if(!ex || !/^[a-z0-9-]+$/.test(ex)) return;
  try{
    const r = await fetch(new URL('../gallery/examples/'+ex+'.json', location.href));
    if(!r.ok) throw new Error(r.status);
    openJSON(await r.text(), ex);
    history.replaceState(null, '', location.pathname);
  }catch(err){ M.toast('Could not open that example'); }
})();

/* ============================================================ Figma: SVG out and in */
const UNIT = 60;
function wireSVG(){
  const {list} = M.classify();
  const H = Math.max(1, ...M.boxes.map(b=>b.cy+b.ch));
  const order = M.boxes.map((b,i)=>i).sort((a,b)=>(M.boxes[a].pid?1:0)-(M.boxes[b].pid?1:0));
  const g = order.map(i => {
    const b = M.boxes[i], c = list[i], x=b.cx*UNIT, y=b.cy*UNIT, w=b.cw*UNIT, h=b.ch*UNIT;
    const name = M.NICE[c.type] + (c.cells>1?' ×'+c.cells:'');
    return '  <g id="'+esc(name.replace(/[^\w ×]/g,''))+'">\n'+
      '    <rect x="'+x+'" y="'+y+'" width="'+w+'" height="'+h+'" fill="'+(b.pid?'#F2F5F8':'#FFFFFF')+'" stroke="#141C22" stroke-width="2"/>\n'+
      '    <text x="'+(x+12)+'" y="'+(y+26)+'" font-family="IBM Plex Mono, monospace" font-size="16" fill="#141C22">'+esc(name)+'</text>\n  </g>';
  }).join('\n');
  return '<svg xmlns="http://www.w3.org/2000/svg" width="'+(M.COLS*UNIT)+'" height="'+(H*UNIT)+'" viewBox="0 0 '+(M.COLS*UNIT)+' '+(H*UNIT)+'">\n'+
    '  <rect width="100%" height="100%" fill="#FAFAFA"/>\n'+g+'\n</svg>\n';
}
$('bFigOut').onclick = () => { download(slug(M.project.name)+'-'+slug(M.pages[M.pg].name)+'.svg', wireSVG(), 'image/svg+xml'); M.toast('Downloaded SVG'); };
$('bFigCopy').onclick = () => copyText(wireSVG());

/* Turn pixel rectangles into grid boxes. Shared by Figma import and image import.
   rects: [{x,y,w,h}] in any units; W: total width those units span. */
function rectsToBoxes(rects, W){
  const cell = W / M.COLS;
  const snap = r => {
    const cx = Math.max(0, Math.round(r.x/cell)), cy = Math.max(0, Math.round(r.y/cell));
    const cw = Math.max(1, Math.min(M.COLS-cx, Math.round((r.x+r.w)/cell)-cx));
    const ch = Math.max(1, Math.round((r.y+r.h)/cell)-cy);
    return {cx,cy,cw,ch};
  };
  const all = rects.map(r => ({...snap(r), area:r.w*r.h, hint:r.hint})).filter(b => b.cx < M.COLS)
    .sort((a,b) => b.area-a.area);
  const out = [];
  const inside = (o,r) => r.cx>=o.cx && r.cy>=o.cy && r.cx+r.cw<=o.cx+o.cw && r.cy+r.ch<=o.cy+o.ch;
  const same = (a,b) => a.cx===b.cx&&a.cy===b.cy&&a.cw===b.cw&&a.ch===b.ch;
  all.forEach(r => {
    if(out.some(o => same(o,r))) return;
    // nest only inside something clearly bigger, never because of rounding
    const host = out.find(o => !o.pid && inside(o,r) && o.ch>=3 && (o.cw>r.cw || o.ch>r.ch) && o.cw*o.ch >= 1.5*r.cw*r.ch);
    const sib = out.filter(o => (host ? o.pid===host.id : !o.pid));
    if(sib.some(o => M.overlaps(o,r))){
      // try trimming one cell off each side before giving up
      for(const t of [{cw:r.cw-1},{cx:r.cx+1,cw:r.cw-1},{ch:r.ch-1},{cy:r.cy+1,ch:r.ch-1}]){
        const tr = {...r, ...t}; if(tr.cw<1||tr.ch<1) continue;
        if(!sib.some(o => M.overlaps(o,tr))){ Object.assign(r,tr); break; }
      }
      if(sib.some(o => M.overlaps(o,r))) return;
    }
    const nb = {cx:r.cx, cy:r.cy, cw:r.cw, ch:r.ch, id:M.bid()};
    if(r.hint){ nb.type = r.hint; nb.label = M.NICE[r.hint]+' (X)'; }
    if(host) nb.pid = host.id;
    out.push(nb);
  });
  // keep only one level of nesting and make sure parents come first
  return out.filter(b => !b.pid || out.find(o=>o.id===b.pid && !o.pid))
            .sort((a,b) => (a.pid?1:0)-(b.pid?1:0));
}
M.rectsToBoxes = rectsToBoxes;

function svgRects(text){
  const host = document.createElement('div');
  host.style.cssText = 'position:fixed;left:-99999px;top:0;width:2000px;visibility:hidden';
  host.innerHTML = text;
  const svg = host.querySelector('svg');
  if(!svg) throw new Error('No <svg> found');
  svg.querySelectorAll('script,foreignObject').forEach(n => n.remove());
  document.body.appendChild(host);
  try{
    const base = svg.getBoundingClientRect();
    const rs = [...svg.querySelectorAll('rect')].map(r => {
      const b = r.getBoundingClientRect();
      return {x:b.left-base.left, y:b.top-base.top, w:b.width, h:b.height};
    }).filter(r => r.w>4 && r.h>4);
    const W = base.width || Math.max(...rs.map(r=>r.x+r.w));
    // drop a full-size background rect
    const big = rs.filter(r => r.w >= W*0.98 && r.h >= base.height*0.98);
    return {rects: rs.length>big.length ? rs.filter(r=>big.indexOf(r)<0) : rs, W};
  } finally { host.remove(); }
}
$('bFigIn').onclick = () => {
  const t = $('figIn').value.trim();
  if(!t){ M.toast('Paste SVG first'); return; }
  try{
    const {rects, W} = svgRects(t);
    if(!rects.length){ M.toast('No rectangles found in that SVG'); return; }
    const boxes = rectsToBoxes(rects, W);
    M.addPage('From Figma');
    M.boxes = boxes; M.sel=-1; M.resize(); M.commit(true); M.syncPages();
    close('mShare'); $('figIn').value='';
    M.toast('Imported '+boxes.length+' boxes as a new page');
  }catch(err){ console.error(err); M.toast('Could not read that SVG'); }
};
$('figIn').addEventListener('keydown', e => e.stopPropagation());

/* ============================================================ deploy (Netlify) */
$('bDrop').onclick = () => {
  download(slug(M.project.name)+'-site.zip', siteZip());
  window.open('https://app.netlify.com/drop','_blank','noopener');
  M.toast('Drag the downloaded zip onto Netlify Drop', 3200);
};
$('bDeploy').onclick = async () => {
  const token = $('nlToken').value.trim();
  if(!token){ M.toast('Paste a Netlify token, or use Netlify Drop'); return; }
  try{ localStorage.setItem('mirage.netlify', token); }catch(_){}
  const out = $('deployOut'); out.textContent = 'Uploading…';
  const key = 'mirage.site.'+M.project.id;
  let siteId = null; try{ siteId = localStorage.getItem(key); }catch(_){}
  const body = siteZip();
  const req = url => fetch(url, {method:'POST', headers:{'Content-Type':'application/zip', Authorization:'Bearer '+token}, body});
  try{
    let res = siteId ? await req('https://api.netlify.com/api/v1/sites/'+siteId+'/deploys') : null;
    if(!res || res.status===404) res = await req('https://api.netlify.com/api/v1/sites');
    if(!res.ok) throw new Error(res.status+' '+(await res.text()).slice(0,140));
    const j = await res.json();
    const id = j.site_id || j.id; if(id) try{ localStorage.setItem(key, id); }catch(_){}
    const url = j.ssl_url || j.deploy_ssl_url || j.url || (j.subdomain ? 'https://'+j.subdomain+'.netlify.app' : '');
    out.innerHTML = 'Live at <a class="lnk" target="_blank" rel="noopener" href="'+esc(url)+'">'+esc(url)+'</a>. Redeploying updates the same site.';
  }catch(err){
    out.textContent = 'Deploy failed: '+err.message+'. Check the token, or use Netlify Drop.';
  }
};
$('nlToken').addEventListener('keydown', e => e.stopPropagation());

/* ============================================================ command palette */
const CMDS = () => {
  const c = [];
  const add = (g,name,run,key) => c.push({g,name,run,key});
  const click = id => () => $(id).click();
  add('Edit','Undo',click('bUndo'),'⌘Z'); add('Edit','Redo',click('bRedo'),'⇧⌘Z');
  add('Edit','Tidy rows',click('bTidy'),'T'); add('Edit','Clear page',click('bClear'));
  add('Edit','Toggle labels',click('bLabels'),'L');
  if(M.sel>=0){ add('Box','Duplicate box',click('bDupe'),'⌘D'); add('Box','Delete box',click('bDel'),'Del');
    add('Box','Re-read box from geometry',click('bAuto')); add('Box','Copy box HTML',click('bCopyBox')); }
  add('View','Dark mode',click('bDark'),'D'); add('View','Expand preview',click('bFull'),'F');
  add('View','Zoom in',() => M.setZoom(M.zoom*1.25)); add('View','Zoom out',() => M.setZoom(M.zoom/1.25)); add('View','Reset zoom',() => M.setZoom(1));
  ['Full','Tablet','Phone'].forEach((n,k) => add('View','Preview: '+n,() => $('segDev').children[k].click()));
  add('Page','New page',() => M.addPage());
  M.pages.forEach((p,j) => { if(j!==M.pg) add('Page','Go to '+p.name,() => M.switchPage(j)); });
  [...$('themeSel').options].forEach(o => add('Style',o.textContent,() => { $('themeSel').value=o.value; $('themeSel').dispatchEvent(new Event('change')); }));
  [['html','HTML'],['react','React'],['tw','Tailwind'],['vue','Vue'],['svelte','Svelte'],['astro','Astro'],['next','Next.js'],['design','design.md'],['json','JSON']]
    .forEach(([f,n]) => add('Export','Export '+n,() => { $('bExport').click(); [...$('segFmt').children].find(b=>b.dataset.f===f).click(); }));
  add('Export','Download site zip',click('bSiteZip'));
  add('Share','Copy share link',async () => copyText(await shareUrl()));
  add('Share','Share, Figma and deploy',openShare);
  add('Share','Go live',click('bLive'));
  add('Project','Projects',click('bProjects'),'⌘P'); add('Project','New project',click('bNewProj'));
  add('Project','Design system',click('bDesign'));
  add('Style','Browse all styles',() => M.openThemes && M.openThemes());
  add('Project','Save a version',() => { saveVersion(); M.toast('Version saved'); });
  add('Project','Versions',click('bVers'));
  add('Project','Snippets',openSnips);
  snippets.forEach(sn => add('Snippet','Insert '+sn.name,() => insertSnippet(sn)));
  add('Make','Import a photo or screenshot',click('bImport'));
  add('Make','AI: write the copy',() => { $('bAI').click(); M.emit('ai-mode','copy'); });
  add('Make','AI: design a palette',() => { $('bAI').click(); M.emit('ai-mode','design'); });
  add('Make','AI: draft a layout',() => { $('bAI').click(); M.emit('ai-mode','layout'); });
  add('Help','Keyboard shortcuts',click('bKeys'));
  return c;
};
function score(q, s){
  q = q.toLowerCase(); s = s.toLowerCase();
  if(!q) return 1;
  const at = s.indexOf(q); if(at>=0) return 100 - at;
  let i=0, gaps=0, last=-1;
  for(const ch of q){ const k = s.indexOf(ch, last+1); if(k<0) return 0; gaps += k-last-1; last=k; i++; }
  return 40 - gaps;
}
let cmdItems = [], cmdIdx = 0;
function drawCmds(){
  const q = $('cmdIn').value.trim();
  cmdItems = CMDS().map(c => ({...c, s: Math.max(score(q,c.name), score(q,c.g+' '+c.name)-5)}))
    .filter(c => c.s>0).sort((a,b) => b.s-a.s).slice(0,40);
  cmdIdx = Math.min(cmdIdx, Math.max(0,cmdItems.length-1));
  $('cmdList').innerHTML = cmdItems.length ? cmdItems.map((c,k) =>
    '<button role="option" data-k="'+k+'" class="'+(k===cmdIdx?'on':'')+'"><span class="g">'+esc(c.g)+'</span>'+esc(c.name)+
    (c.key?'<kbd>'+esc(c.key)+'</kbd>':'')+'</button>').join('') : '<p class="empty2" style="padding:10px 16px">No matching command</p>';
  $('cmdList').querySelectorAll('button').forEach(b => {
    b.onclick = () => run(+b.dataset.k);
    b.onmousemove = () => { if(cmdIdx!==+b.dataset.k){ cmdIdx=+b.dataset.k; paintSel(); } };
  });
}
const paintSel = () => $('cmdList').querySelectorAll('button').forEach((b,k) => {
  b.classList.toggle('on', k===cmdIdx); if(k===cmdIdx) b.scrollIntoView({block:'nearest'}); });
function run(k){ const c = cmdItems[k]; if(!c) return; close('mCmd'); setTimeout(c.run, 0); }
function openCmd(){ $('cmdIn').value=''; cmdIdx=0; open('mCmd'); drawCmds(); setTimeout(()=>$('cmdIn').focus(),0); }
$('cmdIn').addEventListener('input', () => { cmdIdx=0; drawCmds(); });
$('cmdIn').addEventListener('keydown', e => {
  e.stopPropagation();
  if(e.key==='ArrowDown'){ e.preventDefault(); cmdIdx=Math.min(cmdItems.length-1,cmdIdx+1); paintSel(); }
  else if(e.key==='ArrowUp'){ e.preventDefault(); cmdIdx=Math.max(0,cmdIdx-1); paintSel(); }
  else if(e.key==='Enter'){ e.preventDefault(); run(cmdIdx); }
  else if(e.key==='Escape'){ close('mCmd'); }
});
$('bCmd').onclick = openCmd;
document.addEventListener('keydown', e => {
  if((e.metaKey||e.ctrlKey) && e.key.toLowerCase()==='k'){
    e.preventDefault();
    $('mCmd').classList.contains('on') ? close('mCmd') : openCmd();
  }
});
M.openCmd = openCmd;

/* ============================================================ more menu */
const menu = $('moreMenu'), more = $('bMore');
const setMenu = on => { menu.classList.toggle('on', on); more.setAttribute('aria-expanded', on); more.classList.toggle('on', on); };
more.onclick = e => { e.stopPropagation(); setMenu(!menu.classList.contains('on')); };
menu.addEventListener('click', e => { if(e.target.closest('button')) setMenu(false); });
document.addEventListener('click', e => { if(!e.target.closest('.more')) setMenu(false); });
document.addEventListener('keydown', e => { if(e.key==='Escape') setMenu(false); });

/* ============================================================ open a sketch file */
function openJSON(text, name){
  const j = JSON.parse(text);
  if(!j || !(Array.isArray(j.pages) || Array.isArray(j.boxes))) throw new Error('not a Mirage sketch');
  (j.pages||[]).forEach(p => (p.boxes||[]).forEach(b => { delete b.read; }));
  M.newProject();
  M.applyState({...j, name: j.name || (name||'Sketch').replace(/\.json$/i,'')});
  M.saveNow(); M.syncPages();
  $('mProj').classList.remove('on');
  M.toast('Opened "'+M.project.name+'" as a new project');
}
M.openJSON = openJSON;
$('bOpenJson').onclick = () => $('openJson').click();
$('openJson').onchange = e => { const f = e.target.files[0]; e.target.value=''; if(!f) return;
  f.text().then(t => { try{ openJSON(t, f.name); }catch(err){ M.toast('Could not open it: '+err.message); } }); };

/* ============================================================ zoom + small screens */
$('zIn').onclick = () => M.setZoom(M.zoom*1.25);
$('zOut').onclick = () => M.setZoom(M.zoom/1.25);
$('zoomLbl').onclick = () => M.setZoom(1);
const mob = v => {
  document.body.classList.remove('v-sketch','v-preview','v-panel'); document.body.classList.add('v-'+v);
  [...$('mobTog').children].forEach(b => { const on = b.dataset.v===v; b.classList.toggle('on', on); b.setAttribute('aria-selected', on); });
};
[...$('mobTog').children].forEach(b => b.onclick = () => mob(document.body.classList.contains('v-'+b.dataset.v) && b.dataset.v==='panel' ? 'sketch' : b.dataset.v));
M.on('select', i => { if(i>=0 && matchMedia('(max-width:760px)').matches && !document.body.classList.contains('v-preview')) mob('panel'); });

})();
