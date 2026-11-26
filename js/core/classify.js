/* Mirage core: the classifier. Reads box geometry and decides what each box is.
   Pure functions; runs in the browser and in Node (tests, CLI). */
import { COLS, MULTI } from './content.js';

/* boxes whose vertical spans overlap share a row */
export function buildRows(list, idxs){
  const rows = [];
  (idxs || list.map((_,i) => i)).map(i => ({b:list[i], i})).sort((p,q) => p.b.cy-q.b.cy || p.b.cx-q.b.cx).forEach(o => {
    const top = o.b.cy, bot = o.b.cy+o.b.ch;
    const r = rows.find(r => top < r.bottom && r.top < bot);
    if(r){ r.items.push(o); r.top = Math.min(r.top, top); r.bottom = Math.max(r.bottom, bot); }
    else rows.push({top, bottom:bot, items:[o]});
  });
  rows.forEach(r => r.items.sort((a,b) => a.b.cx-b.b.cx));
  return rows.sort((a,b) => a.top-b.top);
}

/* a custom component's shape rule: {minW,maxW,minH,maxH,where:'any'|'top'|'bottom',row:'any'|'alone'|'shared'} */
export function customMatch(def, b, ctx){
  const r = def.rule || {}, scale = ctx.cols / COLS;    // widths are written for the 16 column page
  const w = b.cw/scale;
  if(r.minW!=null && w < r.minW) return false;
  if(r.maxW!=null && w > r.maxW) return false;
  if(r.minH!=null && b.ch < r.minH) return false;
  if(r.maxH!=null && b.ch > r.maxH) return false;
  if(r.where==='top' && !ctx.first) return false;
  if(r.where==='bottom' && !ctx.last) return false;
  if(r.row==='alone' && !ctx.alone) return false;
  if(r.row==='shared' && ctx.alone) return false;
  return true;
}

/* Each rule is [test, type, confidence]. The first match wins; later matches
   become the "also reads as" alternatives shown in the inspector. */
export function readRules(b, ctx){
  const {first, last, n, ri, cols, alone, widest, nested, custom} = ctx;
  const atTop = ctx.top==null || b.cy===ctx.top, atBottom = ctx.bottom==null || b.cy+b.ch===ctx.bottom;
  const full = b.cw >= cols*0.78, ratio = b.ch/b.cw;
  const own = (custom||[]).filter(d => d.rule && d.rule.auto !== false).map(d => [customMatch(d,b,ctx), d.key, 0.9]);
  /* custom shapes come after the unmistakable reads (nav, footer, hero) and before the generic ones */
  return [
    [!nested&&first&&full&&b.ch<=2,                   'nav',     .95],
    [!nested&&last&&atBottom&&full&&b.ch<=3&&n>1,      'footer',  .90],
    [ri<=1&&atTop&&full&&b.ch>=5,                      'hero',    .88],
    [ri<=1&&!alone&&atTop&&widest&&b.ch>=5&&b.cw>=cols*0.42,'hero',.80],   // beside a tall rail, only the top block
  ].concat(own, [
    [!alone&&ratio>=0.85&&ratio<=1.8&&b.cw<=cols*0.5,  'image',   .74],   // square-ish; tall and narrow is a rail
    [!alone&&b.cw<=cols*0.3&&ratio>1.3,                'sidebar', .84],
    [!alone&&b.ch>=4,                                  'text',    .70],
    [full&&b.ch<=2,                                    'stats',   .58],
    [b.cw<=cols*0.3&&ratio>1.4,                        'sidebar', .84],
    [b.cw<=cols*0.28&&b.ch<=2,                         'button',  .80],
    [ratio>=0.75&&ratio<=1.8&&b.cw<cols*0.72,          'image',   .68],
    [full&&b.ch>=3&&b.ch<=4,                           'banner',  .52],
    [true,                                             'text',    full?.74:.56],
  ]).filter(r => r[0]);
}

export function classifyIn(list, idxs, cols, nested, custom){
  const rows = buildRows(list, idxs);
  const n = rows.length;
  rows.forEach((row, ri) => {
    const first = ri===0, last = ri===n-1;
    row.items.forEach(o => {
      const b = list[o.i]; b.row = ri;
      if(b.locked){ b.conf = 1; b.alts = []; if(MULTI.indexOf(b.type)>=0 && !b.cells) b.cells = 3; return; }
      const alone = row.items.length===1;
      const widest = row.items.every(o2 => list[o2.i].cw <= b.cw);
      const hits = readRules(b, {first, last, n, ri, cols, alone, widest, nested, custom, top:row.top, bottom:row.bottom});
      const t = hits[0][1], c = hits[0][2];
      const seen = new Set([t]), alts = [];
      hits.slice(1).forEach(h => { if(!seen.has(h[1])){ seen.add(h[1]); alts.push([h[1], h[2]]); } });
      if(t==='stats') b.cells = b.cells || 3;
      b.type = t; b.conf = c; b.alts = alts.slice(0,3);
    });
    const it = row.items.map(o => list[o.i]);
    if(it.length>=2 && !it.some(b => b.locked)){
      const ws = it.map(b => b.cw);
      const uniform = Math.max.apply(null, ws) - Math.min.apply(null, ws) <= 1;
      const same = it.every(b => b.type===it[0].type);
      const builtIn = !(custom||[]).some(d => d.key===it[0].type);   // custom components never merge into a grid
      if(uniform && same && builtIn && it[0].cw <= cols*0.5){
        const short = row.bottom-row.top <= 2;
        const t = (it.length>=4 && short) ? 'logos' : (short ? 'stats' : 'cards');
        it.forEach(b => { b.alts = [[b.type,b.conf]].concat(b.alts||[]).filter(a => a[0]!==t).slice(0,3); b.type = t; b.conf = .86; });
        it[0].cells = it.length; it[0].lead = true;
        it.slice(1).forEach(b => b.merged = true);
      }
    }
  });
  return rows;
}

/* classify a page's boxes. Children (pid) are read inside their parent. */
export function classify(src, opts){
  opts = opts || {};
  const list = (src||[]).map(b => ({...b}));
  const ids = new Set(list.map(b => b.id));
  const top = [], byParent = {};
  list.forEach((b,i) => {
    if(b.pid && ids.has(b.pid)) (byParent[b.pid] = byParent[b.pid] || []).push(i);
    else top.push(i);
  });
  const rows = classifyIn(list, top, COLS, false, opts.custom);
  top.forEach(i => {
    const p = list[i], k = byParent[p.id];
    if(!k || !k.length) return;
    p.type = 'group'; p.conf = 1; p.alts = []; p.cells = 0; delete p.merged; delete p.lead;
    p.kids = classifyIn(list, k, p.cw, true, opts.custom);
  });
  return {list, rows};
}
