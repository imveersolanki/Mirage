#!/usr/bin/env node
/* =====================================================================
   mirage: build a committed sketch into code, in CI or locally.

     mirage build sketch.json --target site --out dist
     mirage build sketch.json --target next --out app-export
     mirage check sketch.json             exits 1 on errors
     mirage css --out mirage.css [--theme brutal | --all-themes]

   Uses the same core modules as the editor, so output matches the editor's export.
   ===================================================================== */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { classify } from '../js/core/classify.js';
import { createMarkup, esc } from '../js/core/markup.js';
import { exportCSS, fontImport, designCSS } from '../js/core/css.js';
import { toJSX } from '../js/core/jsx.js';
import { pageHTML, sitemapXML, robotsTXT } from '../js/core/site.js';
import { D, DEFAULT_DESIGN, fieldsFor } from '../js/core/content.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const TARGETS = ['site', 'html', 'react', 'next', 'tailwind', 'json'];

function args(argv){
  const a = {_: []};
  for(let i=0;i<argv.length;i++){
    const x = argv[i];
    if(x.startsWith('--')){ const k = x.slice(2); const v = argv[i+1] && !argv[i+1].startsWith('--') ? argv[++i] : true; a[k] = v; }
    else a._.push(x);
  }
  return a;
}
const die = m => { console.error('mirage: '+m); process.exit(2); };
const slug = s => (s||'page').toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'') || 'page';
const write = (file, data) => { fs.mkdirSync(path.dirname(file), {recursive:true}); fs.writeFileSync(file, data); };

function load(file){
  if(!file) die('give a sketch file, e.g. mirage build sketch.json');
  let j; try{ j = JSON.parse(fs.readFileSync(file, 'utf8')); }catch(e){ die('could not read '+file+': '+e.message); }
  const pages = j.pages && j.pages.length ? j.pages : [{id:'pg_home', name:'Home', boxes:j.boxes||[]}];
  return {name:j.name||'Mirage page', theme:j.theme||'', design:Object.assign({}, DEFAULT_DESIGN, j.design||{}),
    components:j.components||[], pageMeta:j.pageMeta||null, assets:j.assets||{}, pages};
}
const ext = u => { const m = /^data:image\/(\w+)/.exec(u||''); return m ? (m[1]==='jpeg'?'jpg':m[1]) : 'png'; };
const bytes = u => Buffer.from(u.slice(u.indexOf(',')+1), 'base64');

function stylesheet(sk, opts){
  const files = ['css/mirage.css', 'css/themes.css', 'css/themes-extra.css', 'css/themes-looks.css'].map(p => fs.readFileSync(path.join(ROOT, p), 'utf8'));
  (sk ? sk.components : []).forEach(c => c.css && files.push(c.css));
  const {rules, frames} = exportCSS(files, {theme: opts.theme, allThemes: opts.allThemes});
  let css = rules.join('\n') + (frames.length ? '\n\n'+frames.join('\n') : '');
  if(opts.theme === '__custom' && sk) css += '\n.page.th-__custom{\n'+designCSS(sk.design)+'\n}';
  return fontImport(css) + css + '\n';
}

function markup(sk, assetPrefix, links){
  return createMarkup({
    classify: arr => classify(arr, {custom: sk.components}),
    pageNames: () => sk.pages.length > 1 ? sk.pages.map(p => p.name) : [],
    links: () => links || null,
    asset: ref => !ref || ref.indexOf('asset:')!==0 ? (ref||'') :
      (assetPrefix==null ? (sk.assets[ref.slice(6)]||'') : assetPrefix+ref.slice(6)+'.'+ext(sk.assets[ref.slice(6)])),
    custom: k => sk.components.find(c => c.key===k) || null,
  });
}
function files(sk){
  const used = new Set();
  return sk.pages.map((p,j) => { let f = j===0 ? 'index' : slug(p.name); while(used.has(f)) f += '-'+j; used.add(f); return {page:p, file:f}; });
}
function meta(sk, p){
  const m = ((sk.pageMeta||{}).pages||{})[p.id] || {}, site = (sk.pageMeta||{}).site || {};
  return {title: m.title || p.name+' · '+sk.name, description: m.description||'', og: m.og||'', url: site.url||'', lang: site.lang||'en'};
}
function writeAssets(sk, dir){
  Object.entries(sk.assets).forEach(([id, u]) => write(path.join(dir, id+'.'+ext(u)), bytes(u)));
}
const pageClass = sk => 'page' + (sk.theme ? ' th-'+sk.theme : '');

const BUILD = {
  site(sk, out){
    const fs_ = files(sk), links = fs_.map(f => ({name:f.page.name, href:f.file+'.html'}));
    const MK = markup(sk, 'assets/', sk.pages.length>1 ? links : null);
    write(path.join(out, 'mirage.css'), stylesheet(sk, {theme: sk.theme}) + '.page{max-width:1200px;margin:0 auto}\n');
    fs_.forEach(f => {
      const m = meta(sk, f.page), page = f.file==='index' ? '' : f.file+'.html';
      const og = m.og ? 'assets/'+m.og.slice(6)+'.'+ext(sk.assets[m.og.slice(6)]) : '';
      write(path.join(out, f.file+'.html'), pageHTML(m, page, og, MK.body(f.page.boxes), pageClass(sk)));
    });
    const url = ((sk.pageMeta||{}).site||{}).url;
    if(url) write(path.join(out, 'sitemap.xml'), sitemapXML(url, fs_.map(f => f.file==='index' ? '' : f.file+'.html')));
    write(path.join(out, 'robots.txt'), robotsTXT(url));
    writeAssets(sk, path.join(out, 'assets'));
    return fs_.length+' pages';
  },
  html(sk, out){
    const MK = markup(sk, null, null);
    write(path.join(out, 'index.html'), '<!-- generated by Mirage -->\n<main class="'+pageClass(sk)+'">\n'+(MK.body(sk.pages[0].boxes)||'')+'\n</main>\n\n<style>\n'+stylesheet(sk,{theme:sk.theme})+'</style>\n');
    return 'the first page, self-contained';
  },
  tailwind(sk, out){
    const MK = markup(sk, null, null);
    files(sk).forEach(f => write(path.join(out, f.file+'.html'), MK.tailwind(f.page.boxes)+'\n'));
    return sk.pages.length+' pages';
  },
  react(sk, out){
    const MK = markup(sk, '/assets/', null);
    files(sk).forEach(f => write(path.join(out, 'src', (f.file==='index'?'Page':f.file.replace(/(^|-)([a-z])/g,(m,a,b)=>b.toUpperCase())+'Page')+'.jsx'), MK.react(f.page.boxes)));
    write(path.join(out, 'src', 'mirage-ui.jsx'), fs.readFileSync(path.join(ROOT, 'packages/ui/src/index.jsx'), 'utf8'));
    write(path.join(out, 'src', 'mirage.css'), stylesheet(sk, {theme: sk.theme}));
    writeAssets(sk, path.join(out, 'public', 'assets'));
    return sk.pages.length+' pages';
  },
  next(sk, out){
    const fs_ = files(sk), links = fs_.map(f => ({name:f.page.name, href:f.file==='index'?'/':'/'+f.file}));
    const MK = markup(sk, '/assets/', sk.pages.length>1 ? links : null);
    fs_.forEach(f => {
      const m = meta(sk, f.page);
      const md = 'export const metadata = '+JSON.stringify({title:m.title, ...(m.description?{description:m.description}:{})}, null, 2)+'\n\n';
      const body = MK.body(f.page.boxes) || '  {/* empty page */}';
      write(path.join(out, 'app', f.file==='index' ? '' : f.file, 'page.jsx'),
        '// generated by Mirage\n'+md+'export default function Page() {\n  return (\n    <main className="'+pageClass(sk)+'">\n'+
        toJSX(body).split('\n').map(l => '    '+l).join('\n')+'\n    </main>\n  )\n}\n');
    });
    write(path.join(out, 'app', 'mirage.css'), stylesheet(sk, {theme: sk.theme}));
    write(path.join(out, 'app', 'layout.jsx'), "import './mirage.css'\n\nexport const metadata = { title: "+JSON.stringify(sk.name)+" }\n\nexport default function RootLayout({ children }) {\n  return (\n    <html lang=\""+(((sk.pageMeta||{}).site||{}).lang||'en')+"\">\n      <body>{children}</body>\n    </html>\n  )\n}\n");
    writeAssets(sk, path.join(out, 'public', 'assets'));
    return fs_.length+' pages';
  },
  json(sk, out){
    const typed = {...sk, pages: sk.pages.map(p => { const {list} = classify(p.boxes, {custom: sk.components});
      return {...p, boxes: p.boxes.map((b,i) => ({...b, read: list[i].type}))}; })};
    write(path.join(out, 'sketch.typed.json'), JSON.stringify(typed, null, 2));
    return 'with every box\'s reading';
  },
};

/* the DOM-free subset of the editor's checks: alt text, placeholders, descriptions */
function check(sk){
  const issues = [], defaults = new Set();
  const walk = v => Array.isArray(v) ? v.forEach(walk) : (typeof v==='string' && defaults.add(v));
  Object.values(D).forEach(walk);
  sk.pages.forEach(p => {
    const {list} = classify(p.boxes, {custom: sk.components}), names = sk.pages.length>1 ? sk.pages.map(x=>x.name) : [];
    if(!p.boxes.length) issues.push(['warn', p.name+': empty page']);
    list.forEach((c,i) => {
      if(c.merged) return;
      const b = p.boxes[i];
      Object.keys(b.c||{}).filter(k => /:src$/.test(k)).forEach(k => { if(!(b.c[k.replace(/:src$/,':alt')]||'').trim()) issues.push(['err', p.name+': image without alt text (box '+(i+1)+')']); });
      fieldsFor(c, {pageNames:names, custom:k => sk.components.find(x=>x.key===k)}).forEach(([k,def]) => {
        const v = (b.c && b.c[k]) || def;
        if(defaults.has(v) && !/^nav[PA-C]|^img$|^gal\d/.test(k)) issues.push(['warn', p.name+': placeholder text in '+k+' (box '+(i+1)+')']);
      });
    });
    const m = ((sk.pageMeta||{}).pages||{})[p.id] || {};
    if(!m.description) issues.push(['warn', p.name+': no meta description']);
  });
  return issues;
}

const a = args(process.argv.slice(2)), cmd = a._[0];
if(!cmd || a.help || cmd==='help'){
  console.log(`mirage: build a Mirage sketch into code

  mirage build <sketch.json> [--target ${TARGETS.join('|')}] [--out dir]
  mirage check <sketch.json> [--strict]      warnings fail too with --strict
  mirage css [--theme name | --all-themes] [--out file]

Export the sketch from the editor (Export > JSON) and commit it.`);
  process.exit(0);
}
if(cmd==='build'){
  const sk = load(a._[1]), target = a.target || 'site', out = path.resolve(a.out || 'mirage-out');
  if(!BUILD[target]) die('unknown target "'+target+'". Use one of: '+TARGETS.join(', '));
  const what = BUILD[target](sk, out);
  console.log('mirage: built '+target+' ('+what+') into '+path.relative(process.cwd(), out)+'/');
} else if(cmd==='check'){
  const issues = check(load(a._[1]));
  issues.forEach(([lv, m]) => console.log((lv==='err'?'error  ':'warn   ')+m));
  const errs = issues.filter(i => i[0]==='err').length, warns = issues.length-errs;
  console.log('mirage: '+errs+' error'+(errs===1?'':'s')+', '+warns+' warning'+(warns===1?'':'s'));
  process.exit(errs || (a.strict && warns) ? 1 : 0);
} else if(cmd==='css'){
  const css = stylesheet(null, {theme: a.theme===true ? '' : (a.theme||''), allThemes: !!a['all-themes']});
  if(a.out) write(path.resolve(a.out), css); else process.stdout.write(css);
} else die('unknown command "'+cmd+'". Try mirage help');
