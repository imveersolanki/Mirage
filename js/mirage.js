/* =====================================================================
   Mirage v0.6
   ===================================================================== */
(() => {
'use strict';

const COLS = 16, MINROWS = 26;
const TYPES = [
  ['nav','Nav bar'],['hero','Hero'],['cards','Card grid'],['text','Text block'],
  ['image','Image'],['gallery','Gallery'],['sidebar','Side nav'],['stats','Stat row'],
  ['logos','Logo row'],['quote','Quote'],['form','Form'],['table','Table'],
  ['tabs','Tabs'],['price','Pricing'],['banner','CTA banner'],['code','Code block'],
  ['button','Button'],['footer','Footer'],
];
const NICE=Object.assign(Object.fromEntries(TYPES),{group:'Group'});
const MULTI=['cards','stats','logos','gallery','price'];
const SHAPED=['cards','image','gallery','price'];
const ALIGNABLE=['hero','text','button','banner','quote','footer','nav','sidebar','logos','form','tabs'];
const SHAPES=[['rect','Square'],['round','Rounded'],['pill','Pill'],
  ['circle','Circle'],['squircle','Squircle'],['cut','Cut corner']];
const VARIANTS=[['primary','Primary'],['secondary','Secondary'],['ghost','Ghost'],
  ['pill','Pill'],['link','Link'],['group','Group']];
const ALIGNS=[['start','Left'],['center','Centre'],['end','Right']];

const FONTS=['Inter','Archivo','Archivo Black','Space Grotesk','Manrope','Sora','Syne','Work Sans',
  'DM Sans','IBM Plex Sans','Roboto','Oswald','Bebas Neue','Nunito','Playfair Display',
  'Cormorant Garamond','EB Garamond','Libre Baskerville','Lora','Source Serif 4','Fraunces',
  'Instrument Serif','Poiret One','Caveat','Kalam','JetBrains Mono','IBM Plex Mono','Space Mono',
  'VT323','Orbitron'];

const DEFAULT_DESIGN = {
  bg:'#FFFFFF', fg:'#111111', mut:'#6E6E6E', line:'#E4E4E4', acc:'#E30613', acc2:'#111111',
  fontD:'Inter', fontB:'Inter', weight:800, track:-30,
  radius:2, border:1, pad:26, shadow:'none',
};
let design = {...DEFAULT_DESIGN};

let boxes=[], sel=-1;
let pages=[{id:'pg_home',name:'Home',boxes:[]}], pg=0;   // multi-page; `boxes` is always pages[pg].boxes
let shareChrome=true;                                     // nav + footer text shared across pages
let versions=[];                                          // named snapshots
const bid=()=>'b'+Math.random().toString(36).slice(2,9);
const ensureIds=arr=>(arr||boxes).forEach(b=>{ if(!b.id) b.id=bid(); });
/* tiny event bus so feature modules can hook in without touching internals */
const BUS={};
const on=(ev,fn)=>{ (BUS[ev]=BUS[ev]||[]).push(fn); };
const emit=(ev,x)=>{ (BUS[ev]||[]).forEach(fn=>{ try{ fn(x); }catch(err){ console.error(err); } }); };
let showLabels=true, dark=false, theme='', devW=0, fmt='html';
let hist=[], hi=-1;
let project={id:null, name:'Untitled sketch'};
let saveTimer=null, holdRender=false;

const $=id=>document.getElementById(id);
const clone=v=>JSON.parse(JSON.stringify(v));
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
const esc=s=>String(s).replace(/[&<>]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;'}[c]));

/* ============================================================ history */
function push(){
  hist=hist.slice(0,hi+1); hist.push(clone(boxes));
  if(hist.length>90) hist.shift();
  hi=hist.length-1; syncHist(); scheduleSave(); emit('change');
}
function syncHist(){ $('bUndo').disabled=hi<=0; $('bRedo').disabled=hi>=hist.length-1; }
function undo(){ if(hi>0){ hi--; boxes=clone(hist[hi]); sel=-1; commit(false); syncHist(); scheduleSave(); emit('change'); } }
function redo(){ if(hi<hist.length-1){ hi++; boxes=clone(hist[hi]); sel=-1; commit(false); syncHist(); scheduleSave(); emit('change'); } }

/* ============================================================ geometry */
const bottomMost=()=>boxes.reduce((m,b)=>Math.max(m,b.cy+b.ch),0);
const surfaceRows=()=>Math.max(MINROWS,bottomMost()+6);
const overlaps=(a,b)=>a.cx<b.cx+b.cw&&b.cx<a.cx+a.cw&&a.cy<b.cy+b.ch&&b.cy<a.cy+a.ch;
const contains=(o,r)=>r.cx>=o.cx&&r.cy>=o.cy&&r.cx+r.cw<=o.cx+o.cw&&r.cy+r.ch<=o.cy+o.ch;
const parentOf=b=>b&&b.pid?boxes.find(p=>p.id===b.pid):null;
const kidsOf=b=>b&&b.id?boxes.filter(k=>k.pid===b.id):[];
/* boxes only collide with siblings: a child may sit inside its parent */
function collides(r,skip,pid){
  if(pid===undefined) pid=skip>=0&&boxes[skip]?boxes[skip].pid:undefined;
  if(pid===null) pid=undefined;
  for(let i=0;i<boxes.length;i++){
    if(i===skip) continue;
    const o=boxes[i];
    if((o.pid||undefined)!==(pid||undefined)) continue;
    if(overlaps(r,o)) return true;
  }
  return false;
}
/* a rect is legal if it fits the surface, its parent, and still holds its own children */
function legal(idx,a){
  const b=boxes[idx]||a;
  if(a.cx<0||a.cy<0||a.cx+a.cw>COLS||a.cw<1||a.ch<1) return false;
  const p=parentOf(b); if(p&&!contains(p,a)) return false;
  if(collides(a,idx,b.pid||null)) return false;
  return true;
}
function shiftKids(b,dx,dy){ if(!dx&&!dy) return; kidsOf(b).forEach(k=>{ k.cx+=dx; k.cy+=dy; }); }
function tryPlace(idx,want){
  const b=boxes[idx];
  for(const a of [want,{cx:want.cx,cy:b.cy,cw:want.cw,ch:want.ch},{cx:b.cx,cy:want.cy,cw:want.cw,ch:want.ch}]){
    if(legal(idx,a)){ const dx=a.cx-b.cx, dy=a.cy-b.cy; Object.assign(b,a); shiftKids(b,dx,dy); return true; }
  }
  return false;
}
/* resize keeps every child inside */
function canResize(idx,a){ return legal(idx,a)&&kidsOf(boxes[idx]).every(k=>contains(a,k)); }
function removeBox(i){
  const b=boxes[i]; if(!b) return;
  const gone=new Set([b.id]); kidsOf(b).forEach(k=>gone.add(k.id));
  boxes=boxes.filter(x=>!gone.has(x.id));
}

/* ============================================================ canvas */
const cv=$('sk'), ctx=cv.getContext('2d'), scroller=$('scroll');
let W=0,H=0,cell=0,DPR=Math.min(devicePixelRatio||1,2);
function resize(){
  const r=scroller.getBoundingClientRect();
  W=r.width; cell=W/COLS; H=surfaceRows()*cell;
  cv.style.height=H+'px';
  cv.width=Math.max(1,Math.round(W*DPR)); cv.height=Math.max(1,Math.round(H*DPR));
  ctx.setTransform(DPR,0,0,DPR,0,0); paint();
}
new ResizeObserver(resize).observe(scroller);
const px=b=>({x:b.cx*cell,y:b.cy*cell,w:b.cw*cell,h:b.ch*cell});
const cssv=v=>getComputedStyle(document.body).getPropertyValue(v).trim();
function jit(i,s){ return ((Math.sin(i*12.9898+s*78.233)*43758.5453)%1)*1.4; }
function shaky(x,y,w,h){
  ctx.beginPath();
  const p=[[x,y],[x+w,y],[x+w,y+h],[x,y+h],[x,y]];
  for(let e=0;e<4;e++){
    const a=p[e],b=p[e+1];
    const seg=Math.max(2,Math.hypot(b[0]-a[0],b[1]-a[1])/26|0);
    if(e===0) ctx.moveTo(a[0],a[1]);
    for(let i=1;i<=seg;i++){
      const t=i/seg;
      ctx.lineTo(a[0]+(b[0]-a[0])*t+(i<seg?jit(i,a[0]+e):0),
                 a[1]+(b[1]-a[1])*t+(i<seg?jit(i,a[1]+e):0));
    }
  }
  ctx.stroke();
}
let drawing=null, guides=[];

function paint(){
  const g1=cssv('--sk-g1'), g2=cssv('--sk-g2'), inkc=cssv('--sk-ink'), red=cssv('--red'), rowc=cssv('--sk-row');
  ctx.clearRect(0,0,W,H);
  const rows=Math.ceil(H/cell), M=4;
  ctx.globalAlpha=.5; ctx.strokeStyle=g2; ctx.lineWidth=1; ctx.beginPath();
  for(let r=1;r<rows;r++){ if(r%M===0) continue; const y=Math.round(r*cell)+.5; ctx.moveTo(0,y); ctx.lineTo(W,y); }
  for(let c=1;c<COLS;c++){ if(c%M===0) continue; const x=Math.round(c*cell)+.5; ctx.moveTo(x,0); ctx.lineTo(x,H); }
  ctx.stroke();
  ctx.globalAlpha=.85; ctx.strokeStyle=g1; ctx.beginPath();
  for(let r=M;r<rows;r+=M){ const y=Math.round(r*cell)+.5; ctx.moveTo(0,y); ctx.lineTo(W,y); }
  for(let c=M;c<COLS;c+=M){ const x=Math.round(c*cell)+.5; ctx.moveTo(x,0); ctx.lineTo(x,H); }
  ctx.stroke();
  ctx.globalAlpha=1; ctx.fillStyle=g1;
  for(let r=0;r<=rows;r++) for(let c=0;c<=COLS;c++){
    const x=Math.round(c*cell), y=Math.round(r*cell), mj=(r%M===0&&c%M===0);
    ctx.fillRect(x-(mj?1:.5), y-(mj?1:.5), mj?2:1, mj?2:1);
  }
  ctx.globalAlpha=.5; ctx.strokeStyle=g1; ctx.strokeRect(.5,.5,W-1,H-1);
  ctx.globalAlpha=1;

  const info=classify();
  info.rows.forEach(row=>{
    if(row.items.length<2) return;
    const t=row.top*cell, b=row.bottom*cell;
    // a row is grouping, not a problem, so it uses the neutral row colour; red is kept for flags
    ctx.fillStyle=rowc; ctx.globalAlpha=.05; ctx.fillRect(0,t,W,b-t); ctx.globalAlpha=.4;
    ctx.strokeStyle=rowc; ctx.lineWidth=1; ctx.setLineDash([4,4]); ctx.beginPath();
    ctx.moveTo(0,t+.5); ctx.lineTo(W,t+.5); ctx.moveTo(0,b-.5); ctx.lineTo(W,b-.5); ctx.stroke();
    ctx.setLineDash([]); ctx.globalAlpha=1;
  });

  info.list.forEach((b,i)=>{
    const g=px(b), isSel=i===sel;
    ctx.fillStyle=isSel?'rgba(227,6,19,.10)':'rgba(0,0,0,.045)';
    ctx.fillRect(g.x,g.y,g.w,g.h);
    ctx.strokeStyle=isSel?red:(b.locked?inkc:inkc);
    ctx.lineWidth=isSel?2:(b.locked?1.7:1.2);
    if(b.shape==='circle'){ ctx.beginPath(); ctx.ellipse(g.x+g.w/2,g.y+g.h/2,g.w/2,g.h/2,0,0,6.283); ctx.stroke(); }
    else shaky(g.x,g.y,g.w,g.h);

    if(b.cells>1){
      ctx.strokeStyle='rgba(110,110,110,.8)'; ctx.lineWidth=1; ctx.setLineDash([3,4]);
      for(let k=1;k<b.cells;k++){ ctx.beginPath(); const x=g.x+(g.w/b.cells)*k;
        ctx.moveTo(x,g.y+5); ctx.lineTo(x,g.y+g.h-5); ctx.stroke(); }
      ctx.setLineDash([]);
    }
    if(!b.locked&&b.conf<.55){ ctx.fillStyle=red; ctx.beginPath(); ctx.arc(g.x+g.w-9,g.y+9,3,0,6.283); ctx.fill(); }
    if(showLabels&&g.h>22&&g.w>40){
      const lb=boxLabel(b);
      ctx.font='500 10px "IBM Plex Mono", monospace';
      let txt=lb, tw=ctx.measureText(txt).width;
      const room=g.w-14-(b.conf<.55&&!b.locked?14:0);
      while(tw>room&&txt.length>2){ txt=txt.slice(0,-2)+'\u2026'; tw=ctx.measureText(txt).width; }
      const lx=g.x+4, ly=g.y+4;
      ctx.globalAlpha=b.merged?.55:1;
      ctx.fillStyle=isSel?red:inkc; ctx.fillRect(lx,ly,tw+10,15);
      ctx.fillStyle=cssv('--paper');
      ctx.textBaseline='middle'; ctx.textAlign='left'; ctx.fillText(txt,lx+5,ly+7.5);
      ctx.globalAlpha=1;
      if(g.h>40){
        ctx.fillStyle='rgba(110,110,110,.95)'; ctx.font='400 9px "IBM Plex Mono", monospace';
        ctx.textAlign='right'; ctx.fillText(b.cw+'\u00d7'+b.ch,g.x+g.w-5,g.y+g.h-6); ctx.textAlign='left';
      }
      if(b.lead&&b.cells>1){ // say once, on the lead box, that the row became one component
        ctx.fillStyle=rowc; ctx.font='500 9px "IBM Plex Mono", monospace';
        ctx.fillText('1 component', lx+tw+16, ly+8);
      }
    }
    if(isSel){
      ctx.fillStyle=cssv('--paper'); ctx.strokeStyle=red; ctx.lineWidth=1.4;
      handles(b).forEach(h=>{ ctx.fillRect(h.x-4,h.y-4,8,8); ctx.strokeRect(h.x-4,h.y-4,8,8); });
    }
  });

  emit('paint',{ctx,cell,W,H});
  guides.forEach(gd=>{
    ctx.strokeStyle=red; ctx.lineWidth=1; ctx.setLineDash([3,3]); ctx.beginPath();
    if(gd.v){ ctx.moveTo(gd.p,0); ctx.lineTo(gd.p,H); } else { ctx.moveTo(0,gd.p); ctx.lineTo(W,gd.p); }
    ctx.stroke(); ctx.setLineDash([]);
  });
  if(drawing){
    const r=drawRect();
    ctx.strokeStyle=red; ctx.lineWidth=1.6; ctx.setLineDash([5,4]);
    ctx.strokeRect(r.cx*cell,r.cy*cell,r.cw*cell,r.ch*cell); ctx.setLineDash([]);
    ctx.fillStyle=red; ctx.font='400 9px "IBM Plex Mono", monospace';
    ctx.fillText(r.cw+'\u00d7'+r.ch, r.cx*cell+4, Math.max(9,r.cy*cell-5));
  }
}
function handles(b){
  const g=px(b);
  return [{id:'nw',x:g.x,y:g.y},{id:'n',x:g.x+g.w/2,y:g.y},{id:'ne',x:g.x+g.w,y:g.y},
    {id:'e',x:g.x+g.w,y:g.y+g.h/2},{id:'se',x:g.x+g.w,y:g.y+g.h},
    {id:'s',x:g.x+g.w/2,y:g.y+g.h},{id:'sw',x:g.x,y:g.y+g.h},{id:'w',x:g.x,y:g.y+g.h/2}];
}

/* a row merged into one component: lead says "Card grid ×3", the rest say "↳ Card grid" */
function boxLabel(c){
  if(c.merged) return '\u21b3 '+NICE[c.type];
  return NICE[c.type]+(c.cells>1?' \u00d7'+c.cells:'');
}

/* ============================================================ rows + classify */
function buildRows(list,idxs){
  const rows=[];
  (idxs||list.map((_,i)=>i)).map(i=>({b:list[i],i})).sort((p,q)=>p.b.cy-q.b.cy||p.b.cx-q.b.cx).forEach(o=>{
    const top=o.b.cy, bot=o.b.cy+o.b.ch;
    const r=rows.find(r=>top<r.bottom&&r.top<bot);
    if(r){ r.items.push(o); r.top=Math.min(r.top,top); r.bottom=Math.max(r.bottom,bot); }
    else rows.push({top,bottom:bot,items:[o]});
  });
  rows.forEach(r=>r.items.sort((a,b)=>a.b.cx-b.b.cx));
  return rows.sort((a,b)=>a.top-b.top);
}
/* Each rule is [test, type, confidence]. The first match wins; later matches become
   the "also reads as" alternatives shown in the inspector. */
function readRules(b,ctx){
  const {first,last,n,ri,cols,alone,widest,nested}=ctx;
  const full=b.cw>=cols*0.78, ratio=b.ch/b.cw;
  return [
    [!nested&&first&&full&&b.ch<=2,               'nav',     .95],
    [!nested&&last&&full&&b.ch<=3&&n>1,            'footer',  .90],
    [ri<=1&&full&&b.ch>=5,                         'hero',    .88],
    [ri<=1&&!alone&&widest&&b.ch>=5&&b.cw>=cols*0.42,'hero',  .80],
    [!alone&&ratio>=0.85&&b.cw<=cols*0.5,          'image',   .74],
    [!alone&&b.cw<=cols*0.3&&ratio>1.3,            'sidebar', .84],
    [!alone&&b.ch>=4,                              'text',    .70],
    [full&&b.ch<=2,                                'stats',   .58],
    [b.cw<=cols*0.3&&ratio>1.4,                    'sidebar', .84],
    [b.cw<=cols*0.28&&b.ch<=2,                     'button',  .80],
    [ratio>=0.75&&b.cw<cols*0.72,                  'image',   .68],
    [full&&b.ch>=3&&b.ch<=4,                       'banner',  .52],
    [true,                                         'text',    full?.74:.56],
  ].filter(r=>r[0]);
}
function classifyIn(list,idxs,cols,nested){
  const rows=buildRows(list,idxs);
  const n=rows.length;
  rows.forEach((row,ri)=>{
    const first=ri===0, last=ri===n-1;
    row.items.forEach(o=>{
      const b=list[o.i]; b.row=ri;
      if(b.locked){ b.conf=1; b.alts=[]; if(MULTI.indexOf(b.type)>=0&&!b.cells) b.cells=3; return; }
      const alone=row.items.length===1;
      const widest=row.items.every(o2=>list[o2.i].cw<=b.cw);
      const hits=readRules(b,{first,last,n,ri,cols,alone,widest,nested});
      const t=hits[0][1], c=hits[0][2];
      const seen=new Set([t]), alts=[];
      hits.slice(1).forEach(h=>{ if(!seen.has(h[1])){ seen.add(h[1]); alts.push([h[1],h[2]]); } });
      if(t==='stats') b.cells=b.cells||3;
      b.type=t; b.conf=c; b.alts=alts.slice(0,3);
    });
    const it=row.items.map(o=>list[o.i]);
    if(it.length>=2&&!it.some(b=>b.locked)){
      const ws=it.map(b=>b.cw);
      const uniform=Math.max.apply(null,ws)-Math.min.apply(null,ws)<=1;
      const same=it.every(b=>b.type===it[0].type);
      if(uniform&&same&&it[0].cw<=cols*0.5){
        const short=row.bottom-row.top<=2;
        const t=(it.length>=4&&short)?'logos':(short?'stats':'cards');
        it.forEach(b=>{ b.alts=[[b.type,b.conf]].concat(b.alts||[]).filter(a=>a[0]!==t).slice(0,3); b.type=t; b.conf=.86; });
        it[0].cells=it.length; it[0].lead=true;
        it.slice(1).forEach(b=>b.merged=true);
      }
    }
  });
  return rows;
}
/* classify(arr) works on any page's boxes; default is the current page */
function classify(arr){
  const src=arr||boxes;
  const list=src.map(b=>({...b}));
  const ids=new Set(list.map(b=>b.id));
  const top=[], byParent={};
  list.forEach((b,i)=>{
    if(b.pid&&ids.has(b.pid)) (byParent[b.pid]=byParent[b.pid]||[]).push(i);
    else top.push(i);
  });
  const rows=classifyIn(list,top,COLS,false);
  top.forEach(i=>{
    const p=list[i], k=byParent[p.id];
    if(!k||!k.length) return;
    p.type='group'; p.conf=1; p.alts=[]; p.cells=0; delete p.merged; delete p.lead;
    p.kids=classifyIn(list,k,p.cw,true);
  });
  return {list,rows};
}

/* ============================================================ content model */
/* Every string lives in box.c under a stable key, so all of it is editable. */
const D = {
  brand:'Mirage', navA:'Docs', navB:'Components', navC:'Roadmap', navCta:'Get started',
  heroH:'Everything you draw becomes real',
  heroP:'Mirage reads the geometry of a wireframe the way a person does, then builds the page it implies.',
  heroB1:'Start drawing', heroB2:'Read the docs',
  textH:'How the classifier reads a box',
  textP:'A box near the top edge that spans the full width is a nav bar. The same box halfway down the page, given more height, is a hero. Width relative to the page and height relative to width carry almost all the meaning in a wireframe.',
  cards:[['Position','Where it sits','Vertical position separates a nav from a footer.'],
    ['Proportion','How tall for its width','A tall narrow box is a rail, a wide short one a bar.'],
    ['Company','What sits beside it','Boxes sharing a row are built side by side.'],
    ['Span','How wide it runs','Width snaps to the column grid.'],
    ['Order','What comes before','Reading order follows the vertical axis.'],
    ['Override','What you corrected','A box you set by hand is never re-read.']],
  stats:[['18','components'],['16','columns'],['0','dependencies'],['MIT','licence'],['7','targets'],['90','undo steps']],
  logos:['Northwind','Cassini','Half Measure','Bellwether','Ordinal','Meridian'],
  side:['Overview','Reading a box','The column grid','Overrides','Export'],
  quote:'I drew the page on a napkin, photographed the napkin, and had the layout before the coffee arrived.',
  who:'\u2014 an optimistic description of the roadmap',
  tabs:['Geometry','Overrides','Export'],
  tabsP:'Every rule is a threshold you can tune, and every box you set by hand is left alone.',
  th:['Component','Signal','Shape','Conf.'],
  rows:[['Nav bar','first row','full width','0.95'],['Hero','top rows','tall, full','0.88'],
    ['Card grid','shared row','uniform','0.86']],
  form:['Name','Email address','Message','Send'],
  price:[['Free','$0','Everything, it is open source'],['Also free','$0','There is no second tier'],
    ['Still free','$0','Self host it anywhere']],
  banner:'Draw the page. Ship the page.', bannerB:'Open the editor',
  btn:'Start drawing', btnB:'Read the docs', btnC:'Learn more',
  footL:'Mirage', footR:'Drawn, not configured',
  img:'IMAGE',
  code:'<section class="c-row">\n  <header class="c-hero">…</header>\n  <figure class="c-img">…</figure>\n</section>',
};
function txt(b,key,fb){ return (b.c && b.c[key]!=null && b.c[key]!=='') ? b.c[key] : fb; }
function setTxt(i,key,val){
  const b=boxes[i]; if(!b) return;
  if(!b.c) b.c={};
  b.c[key]=val;
  if(shareChrome&&pages.length>1){
    const t=classify().list[i].type;
    if(t==='nav'||t==='footer') syncChrome(t,key,val);
  }
}
/* copy one nav/footer text key to the same component on every other page */
function syncChrome(type,key,val){
  pages.forEach((p,j)=>{
    if(j===pg) return;
    const L=classify(p.boxes).list;
    L.forEach((c,k)=>{ if(c.type===type){ const tb=p.boxes[k]; tb.c=tb.c||{}; tb.c[key]=val; } });
  });
}
/* editable span */
function E(i,key,val){
  return '<span class="ed" contenteditable="true" spellcheck="false" data-b="'+i+'" data-k="'+
    esc(key)+'">'+esc(val)+'</span>';
}

/* ============================================================ render */
const sheet=$('sheet');
function alignClass(b,type){
  if(ALIGNABLE.indexOf(type)<0) return '';
  const a=b.align||'start';
  return a==='start' ? '' : ' al-'+a;
}
/* responsive flags live on boxes: hide:['t','p'], stack:'t'|'keep', first:true */
function rspClass(b){
  let c='';
  if(b.hide&&b.hide.indexOf('t')>=0) c+=' c-hide-t';
  if(b.hide&&b.hide.indexOf('p')>=0) c+=' c-hide-p';
  if(b.first) c+=' c-first';
  return c;
}
function rowClass(items){
  const lead=items[0]||{};
  return lead.stack==='t'?' c-stack-t':(lead.stack==='keep'?' c-keep':'');
}
function pageNames(){ return pages.map(p=>p.name); }
function renderRows(rows,list,host,counter){
  rows.forEach(row=>{
    const pairs=row.items.map(o=>({b:list[o.i],i:o.i})).filter(p=>!p.b.merged);
    if(!pairs.length) return;
    if(pairs.length===1){
      const el=build(pairs[0].b,pairs[0].i,list);
      if(el){ el.className+=' cx'+rspClass(pairs[0].b); el.style.animationDelay=(counter.k++*30)+'ms'; host.appendChild(el); }
      return;
    }
    const wrap=document.createElement('div');
    wrap.className='c-row cx'+rowClass(pairs.map(p=>p.b));
    wrap.style.animationDelay=(counter.k++*30)+'ms';
    const cols=pairs.map(p=>p.b.cw+'fr').join(' ');
    wrap.style.setProperty('--cols',cols);
    wrap.style.gridTemplateColumns=cols;
    pairs.forEach(p=>{ const el=build(p.b,p.i,list); if(el){ el.className+=rspClass(p.b); wrap.appendChild(el); } });
    host.appendChild(wrap);
  });
}
function render(){
  if(holdRender) return;
  const {list,rows}=classify();
  sheet.className = theme ? 'th-'+theme : '';
  sheet.style.maxWidth = devW ? devW+'px' : '100%';
  if(!rows.length){
    sheet.innerHTML='<div class="void"><p class="t1">The page renders here</p>'+
      '<p class="t2">Click any text to edit it. Boxes that share a row are built side by side.</p></div>';
    emit('render');
    return;
  }
  sheet.innerHTML='';
  renderRows(rows,list,sheet,{k:0});
  emit('render');
}
const shapeClass=b=>b.shape&&b.shape!=='rect' ? ' sh-'+b.shape : '';

function build(b,i,list){
  const d=document.createElement('div');
  if(b.type==='group'){
    d.className='c-group';
    renderRows(b.kids||[],list,d,{k:0});
    return d;
  }
  const hpx=Math.max(60,b.ch*46), n=clamp(b.cells||3,2,6);
  const sc=shapeClass(b), al=alignClass(b,b.type);
  const T=(k,fb)=>E(i,k,txt(b,k,fb));

  switch(b.type){
    case 'nav':
      d.className='c-nav'+al;
      { const pn=pages.length>1?pageNames():null;
      d.innerHTML='<span class="lg">'+T('brand',D.brand)+'</span><span class="ln">'+
        (pn?pn.slice(0,4).map((nm,j)=>T('navP'+j,nm)).join(''):T('navA',D.navA)+T('navB',D.navB)+T('navC',D.navC))+
        '</span><button class="cta">'+T('navCta',D.navCta)+'</button>'; }
      break;
    case 'hero':
      d.className='c-hero'+al;
      d.innerHTML='<h1>'+T('heroH',D.heroH)+'</h1><p>'+T('heroP',D.heroP)+'</p>'+
        '<div class="bs"><button class="b1">'+T('heroB1',D.heroB1)+'</button>'+
        '<button class="b2">'+T('heroB2',D.heroB2)+'</button></div>'; break;
    case 'cards':
      d.className='c-grid'; d.style.gridTemplateColumns='repeat('+n+',minmax(0,1fr))';
      d.innerHTML=D.cards.slice(0,n).map((c,j)=>
        '<div class="c-card'+sc+'"><div class="k">'+T('cardK'+j,c[0])+'</div>'+
        '<h4>'+T('cardH'+j,c[1])+'</h4><p>'+T('cardP'+j,c[2])+'</p></div>').join(''); break;
    case 'text':
      d.className='c-text'+al;
      d.innerHTML='<h3>'+T('textH',D.textH)+'</h3><p>'+T('textP',D.textP)+'</p>'; break;
    case 'image':
      d.className='c-img'+sc; d.style.minHeight=hpx+'px';
      d.innerHTML=T('img',D.img); break;
    case 'gallery':
      d.className='c-gal'; d.style.gridTemplateColumns='repeat('+n+',minmax(0,1fr))';
      d.innerHTML=Array.from({length:n},(_,j)=>'<div class="c-img'+sc+'" style="min-height:'+
        Math.max(70,hpx/1.6)+'px">'+T('gal'+j,D.img)+'</div>').join(''); break;
    case 'sidebar':
      d.className='c-side'+al;
      d.innerHTML=D.side.map((t,j)=>'<div class="it'+(j===0?' a':'')+'">'+T('side'+j,t)+'</div>').join(''); break;
    case 'stats':
      d.className='c-stats'; d.style.gridTemplateColumns='repeat('+n+',minmax(0,1fr))';
      d.innerHTML=D.stats.slice(0,n).map((s,j)=>'<div class="s"><div class="n">'+T('statN'+j,s[0])+
        '</div><div class="l">'+T('statL'+j,s[1])+'</div></div>').join(''); break;
    case 'logos':
      d.className='c-logos'+al;
      d.innerHTML=D.logos.slice(0,Math.max(n,4)).map((l,j)=>'<span class="lo">'+T('logo'+j,l)+'</span>').join(''); break;
    case 'quote':
      d.className='c-quote'+al;
      d.innerHTML='<blockquote>'+T('quote',D.quote)+'</blockquote><div class="who">'+T('who',D.who)+'</div>'; break;
    case 'form':
      d.className='c-form'+al;
      d.innerHTML='<div class="inp">'+T('form0',D.form[0])+'</div><div class="inp">'+T('form1',D.form[1])+
        '</div><div class="inp" style="height:70px">'+T('form2',D.form[2])+'</div>'+
        '<div class="sb">'+T('form3',D.form[3])+'</div>'; break;
    case 'table':
      d.className='c-table';
      d.innerHTML='<table><thead><tr>'+D.th.map((h,j)=>'<th>'+T('th'+j,h)+'</th>').join('')+
        '</tr></thead><tbody>'+D.rows.map((r,ri)=>'<tr>'+r.map((c,ci)=>'<td>'+
        T('td'+ri+'_'+ci,c)+'</td>').join('')+'</tr>').join('')+'</tbody></table>'; break;
    case 'tabs':
      d.className='c-tabs'+al;
      d.innerHTML='<div class="tl">'+D.tabs.map((t,j)=>'<span class="tb'+(j===0?' a':'')+'">'+
        T('tab'+j,t)+'</span>').join('')+'</div><p>'+T('tabsP',D.tabsP)+'</p>'; break;
    case 'price':
      d.className='c-price'; d.style.gridTemplateColumns='repeat('+Math.min(n,3)+',minmax(0,1fr))';
      d.innerHTML=D.price.slice(0,Math.min(n,3)).map((p,j)=>'<div class="p'+sc+'">'+
        '<div class="tn">'+T('priceN'+j,p[0])+'</div><div class="am">'+T('priceA'+j,p[1])+'</div>'+
        '<ul><li>'+T('priceF'+j,p[2])+'</li></ul></div>').join(''); break;
    case 'banner':
      d.className='c-banner'+al;
      d.innerHTML='<h3>'+T('banner',D.banner)+'</h3><span class="b">'+T('bannerB',D.bannerB)+'</span>'; break;
    case 'code':
      d.className='c-code';
      d.innerHTML='<pre><code class="ed" contenteditable="true" spellcheck="false" data-b="'+i+
        '" data-k="code">'+esc(txt(b,'code',D.code))+'</code></pre>'; break;
    case 'button': {
      const v=b.variant||'primary';
      d.className='c-btn'+al;
      d.innerHTML = v==='group'
        ? '<div class="bgroup"><button class="bt bt-primary">'+T('btn',D.btn)+'</button>'+
          '<button class="bt bt-secondary">'+T('btnB',D.btnB)+'</button>'+
          '<button class="bt bt-ghost">'+T('btnC',D.btnC)+'</button></div>'
        : '<button class="bt bt-'+v+'">'+T('btn',D.btn)+'</button>';
      break;
    }
    case 'footer':
      d.className='c-foot'+al;
      d.innerHTML='<span>'+T('footL',D.footL)+'</span><span class="sp">'+T('footR',D.footR)+'</span>'; break;
    default: return null;
  }
  return d;
}

/* inline editing */
sheet.addEventListener('input',e=>{
  const el=e.target.closest('.ed'); if(!el) return;
  holdRender=true;
  setTxt(+el.dataset.b, el.dataset.k, el.textContent);
});
sheet.addEventListener('blur',e=>{
  const el=e.target.closest&&e.target.closest('.ed'); if(!el) return;
  holdRender=false; push(); render();
},true);
sheet.addEventListener('keydown',e=>{
  const el=e.target.closest&&e.target.closest('.ed'); if(!el) return;
  if(e.key==='Enter'&&el.dataset.k!=='code'){ e.preventDefault(); el.blur(); }
  if(e.key==='Escape'){ e.preventDefault(); el.blur(); }
  e.stopPropagation();
});
sheet.addEventListener('focusin',e=>{
  const el=e.target.closest&&e.target.closest('.ed'); if(!el) return;
  sel=+el.dataset.b; syncSel(); paint();
});

/* ============================================================ design.md */
function designCSS(){
  const d=design;
  return [
    '  --c-bg:'+d.bg+';','  --c-fg:'+d.fg+';','  --c-mut:'+d.mut+';','  --c-line:'+d.line+';',
    '  --c-acc:'+d.acc+';','  --c-r:'+d.radius+'px;','  --c-bw:'+d.border+'px;',
    '  --c-pad:'+d.pad+'px;','  --c-sh:'+d.shadow+';','  --c-tt:'+(d.track/1000)+'em;',
    '  --c-hw:'+d.weight+';',
    '  --c-fd:"'+d.fontD+'", sans-serif;','  --c-fb:"'+d.fontB+'", sans-serif;',
  ].join('\n');
}
function applyDesign(){
  $('customTheme').textContent = '#sheet.th-__custom{\n'+designCSS()+'\n}';
  if(theme==='__custom') render();
}
function designMd(){
  const d=design;
  const shadowName={'none':'None','0 2px 10px rgba(0,0,0,.08)':'Soft','5px 5px 0 currentColor':'Hard offset'}[d.shadow]||d.shadow;
  return [
    '# Design system',
    '',
    '**Project:** '+project.name,
    '**Updated:** '+new Date().toISOString().slice(0,10),
    '',
    '## Colour',
    '',
    '| Token | Value | Role |',
    '| --- | --- | --- |',
    '| `--c-bg` | `'+d.bg+'` | Page background |',
    '| `--c-fg` | `'+d.fg+'` | Body text |',
    '| `--c-mut` | `'+d.mut+'` | Secondary text |',
    '| `--c-line` | `'+d.line+'` | Borders and rules |',
    '| `--c-acc` | `'+d.acc+'` | Accent, buttons, links |',
    '',
    '## Typography',
    '',
    '- **Display:** '+d.fontD+', weight '+d.weight+', tracking '+(d.track/1000)+'em',
    '- **Body:** '+d.fontB+', weight 400',
    '- Headings use the display face, everything else uses the body face.',
    '',
    '## Shape and space',
    '',
    '- **Corner radius:** '+d.radius+'px',
    '- **Border width:** '+d.border+'px',
    '- **Section padding:** '+d.pad+'px',
    '- **Shadow:** '+shadowName,
    '',
    '## Tokens',
    '',
    '```css',
    ':root{',
    designCSS(),
    '}',
    '```',
    '',
    '---',
    '',
    '_Generated by Mirage. Edit it through the Design panel, not by hand._',
  ].join('\n');
}

/* ============================================================ export */
function collectCSS(){
  const cur = theme==='__custom' ? 'th-__custom' : (theme ? 'th-'+theme : null);
  const keep=[], frames=[];
  const wanted=sel=>{
    if(sel.indexOf('.th-')>=0) return cur ? sel.indexOf('.'+cur)>=0 : false;
    return sel.indexOf('#sheet')>=0||sel.indexOf('.c-')>=0||sel.indexOf('.sh-')>=0||
           sel.indexOf('.bt')>=0||sel.indexOf('.al-')>=0;
  };
  const rewrite=sel=>sel.split(',').map(s=>{
    s=s.trim().replace(/#sheet\.th-([a-z0-9_-]+)/g,'.page.th-$1').replace(/#sheet/g,'.page');
    if(s.indexOf('.page')!==0 && (s.indexOf('.c-')===0||s.indexOf('.sh-')===0||
        s.indexOf('.bt')===0||s.indexOf('.al-')===0)) s='.page '+s;
    return s;
  }).join(', ');

  const walk=list=>{
    for(const r of list){
      const cn=r.constructor?r.constructor.name:'';
      if(/Keyframes/.test(cn)){ frames.push(r.cssText); continue; }
      /* container queries become plain media queries in the exported page */
      if(/Container/.test(cn)){
        const inner=[];
        for(const ir of r.cssRules||[])
          if(ir.selectorText&&wanted(ir.selectorText)) inner.push(rewrite(ir.selectorText)+'{'+ir.style.cssText+'}');
        if(inner.length){
          const cond=(r.containerQuery||r.conditionText||'').replace(/^page\s*/,'').trim()||'(max-width:760px)';
          keep.push('@media '+cond+'{\n  '+inner.join('\n  ')+'\n}');
        }
        continue;
      }
      if(r.media){
        const inner=[];
        for(const ir of r.cssRules||[])
          if(ir.selectorText&&wanted(ir.selectorText)) inner.push(rewrite(ir.selectorText)+'{'+ir.style.cssText+'}');
        if(inner.length) keep.push('@media '+r.media.mediaText+'{\n  '+inner.join('\n  ')+'\n}');
        continue;
      }
      if(!r.selectorText) continue;
      if(r.selectorText.indexOf('.cx')>=0||r.selectorText.indexOf('.void')>=0||
         r.selectorText.indexOf('.ed')>=0) continue;
      if(!wanted(r.selectorText)) continue;
      keep.push(rewrite(r.selectorText)+'{'+r.style.cssText+'}');
    }
  };
  for(const ss of document.styleSheets){
    let rules; try{ rules=ss.cssRules; }catch(_){ continue; }
    if(rules) walk(rules);
  }
  if(theme==='__custom') keep.push('.page.th-__custom{\n'+designCSS()+'\n}');
  return {rules:keep,frames};
}
function fontImport(){
  const cs=getComputedStyle(sheet), names=new Set();
  ['--c-fd','--c-fb'].forEach(v=>{
    (cs.getPropertyValue(v)||'').split(',').forEach(p=>{
      const nm=p.trim().replace(/^["']|["']$/g,'');
      if(/^[A-Z]/.test(nm)&&!/^(Georgia|Arial|Helvetica|Didot|Bodoni|Times|system-ui)/.test(nm)) names.add(nm);
    });
  });
  names.add('IBM Plex Mono');
  if(!names.size) return '';
  return "@import url('https://fonts.googleapis.com/css2?"+
    [...names].map(n=>'family='+n.replace(/ /g,'+')+':wght@400;500;600;700;800;900').join('&')+
    "&display=swap');\n\n";
}
function laidRows(arr){
  const {list,rows}=classify(arr);
  const lay=rs=>rs.map(r=>({items:r.items.map(o=>list[o.i]).filter(b=>!b.merged).map(b=>{
    if(b.type==='group') b.rows=lay(b.kids||[]);
    return b;
  })})).filter(r=>r.items.length);
  return lay(rows);
}
/* add classes to the first class="" of a rendered snippet */
const addCls=(html,cls)=>cls?html.replace('class="','class="'+cls.trim()+' '):html;
let EXPORT_LINKS=null;   // set to [{name,href}] while exporting a multi-page site
const TAG={nav:'nav',hero:'header',footer:'footer',image:'figure',quote:'figure',
  form:'form',sidebar:'aside',code:'pre',table:'div'};

function mk(b,pad){
  return addCls(mkInner(b,pad),rspClass(b));
}
function rowsHTML(R,pad){
  return R.map(row=>{
    if(row.items.length===1) return mk(row.items[0],pad);
    const cols=row.items.map(b=>b.cw+'fr').join(' ');
    return pad+'<section class="c-row'+rowClass(row.items)+'" style="--cols:'+cols+';grid-template-columns:'+cols+'">\n'+
      row.items.map(b=>mk(b,pad+'  ')).join('\n')+'\n'+pad+'</section>';
  }).join('\n\n');
}
function mkInner(b,pad){
  const n=clamp(b.cells||3,2,6), sc=shapeClass(b), al=alignClass(b,b.type);
  const t=TAG[b.type]||'section', P=s=>pad+s, T=(k,fb)=>esc(txt(b,k,fb));
  const wrap=(cls,inner)=>P('<'+t+' class="'+cls+'">')+'\n'+
    inner.split('\n').map(l=>pad+'  '+l).join('\n')+'\n'+P('</'+t+'>');
  switch(b.type){
    case 'group': return P('<section class="c-group">')+'\n'+rowsHTML(b.rows||[],pad+'  ')+'\n'+P('</section>');
    case 'nav': {
      let links;
      if(EXPORT_LINKS) links=EXPORT_LINKS.map((l,j)=>'<a href="'+l.href+'">'+T('navP'+j,l.name)+'</a>').join('');
      else if(pages.length>1) links=pageNames().slice(0,4).map((nm,j)=>'<span>'+T('navP'+j,nm)+'</span>').join('');
      else links='<span>'+T('navA',D.navA)+'</span><span>'+T('navB',D.navB)+'</span><span>'+T('navC',D.navC)+'</span>';
      return wrap('c-nav'+al,'<span class="lg">'+T('brand',D.brand)+'</span>\n'+
      '<span class="ln">'+links+'</span>\n<button class="cta">'+T('navCta',D.navCta)+'</button>');
    }
    case 'hero': return wrap('c-hero'+al,'<h1>'+T('heroH',D.heroH)+'</h1>\n<p>'+T('heroP',D.heroP)+'</p>\n'+
      '<div class="bs"><button class="b1">'+T('heroB1',D.heroB1)+'</button><button class="b2">'+
      T('heroB2',D.heroB2)+'</button></div>');
    case 'cards': return P('<section class="c-grid" style="grid-template-columns:repeat('+n+',minmax(0,1fr))">')+'\n'+
      D.cards.slice(0,n).map((c,j)=>pad+'  <article class="c-card'+sc+'"><div class="k">'+T('cardK'+j,c[0])+
      '</div><h4>'+T('cardH'+j,c[1])+'</h4><p>'+T('cardP'+j,c[2])+'</p></article>').join('\n')+'\n'+P('</section>');
    case 'text': return wrap('c-text'+al,'<h3>'+T('textH',D.textH)+'</h3>\n<p>'+T('textP',D.textP)+'</p>');
    case 'image': return P('<figure class="c-img'+sc+'">'+T('img',D.img)+'</figure>');
    case 'gallery': return P('<section class="c-gal" style="grid-template-columns:repeat('+n+',minmax(0,1fr))">')+'\n'+
      Array.from({length:n},(_,j)=>pad+'  <figure class="c-img'+sc+'">'+T('gal'+j,D.img)+'</figure>').join('\n')+'\n'+P('</section>');
    case 'sidebar': return wrap('c-side'+al, D.side.map((s,j)=>'<div class="it'+(j===0?' a':'')+'">'+
      T('side'+j,s)+'</div>').join('\n'));
    case 'stats': return P('<section class="c-stats" style="grid-template-columns:repeat('+n+',minmax(0,1fr))">')+'\n'+
      D.stats.slice(0,n).map((s,j)=>pad+'  <div class="s"><div class="n">'+T('statN'+j,s[0])+
      '</div><div class="l">'+T('statL'+j,s[1])+'</div></div>').join('\n')+'\n'+P('</section>');
    case 'logos': return P('<section class="c-logos'+al+'">')+'\n'+
      D.logos.slice(0,Math.max(n,4)).map((l,j)=>pad+'  <span class="lo">'+T('logo'+j,l)+'</span>').join('\n')+'\n'+P('</section>');
    case 'quote': return wrap('c-quote'+al,'<blockquote>'+T('quote',D.quote)+'</blockquote>\n<figcaption class="who">'+
      T('who',D.who)+'</figcaption>');
    case 'form': return wrap('c-form'+al, D.form.slice(0,3).map((f,j)=>'<div class="inp">'+T('form'+j,f)+'</div>').join('\n')+
      '\n<button class="sb">'+T('form3',D.form[3])+'</button>');
    case 'table': return P('<div class="c-table"><table>')+'\n'+pad+'  <thead><tr>'+
      D.th.map((h,j)=>'<th>'+T('th'+j,h)+'</th>').join('')+'</tr></thead>\n'+pad+'  <tbody>'+
      D.rows.map((r,ri)=>'<tr>'+r.map((c,ci)=>'<td>'+T('td'+ri+'_'+ci,c)+'</td>').join('')+'</tr>').join('')+
      '</tbody>\n'+P('</table></div>');
    case 'tabs': return wrap('c-tabs'+al,'<div class="tl">'+D.tabs.map((t2,j)=>'<span class="tb'+(j===0?' a':'')+'">'+
      T('tab'+j,t2)+'</span>').join('')+'</div>\n<p>'+T('tabsP',D.tabsP)+'</p>');
    case 'price': return P('<section class="c-price" style="grid-template-columns:repeat('+Math.min(n,3)+',minmax(0,1fr))">')+'\n'+
      D.price.slice(0,Math.min(n,3)).map((p,j)=>pad+'  <div class="p'+sc+'"><div class="tn">'+T('priceN'+j,p[0])+
      '</div><div class="am">'+T('priceA'+j,p[1])+'</div><ul><li>'+T('priceF'+j,p[2])+'</li></ul></div>').join('\n')+
      '\n'+P('</section>');
    case 'banner': return wrap('c-banner'+al,'<h3>'+T('banner',D.banner)+'</h3>\n<a class="b" href="#">'+
      T('bannerB',D.bannerB)+'</a>');
    case 'code': return P('<pre class="c-code"><code>'+esc(txt(b,'code',D.code))+'</code></pre>');
    case 'button': {
      const v=b.variant||'primary';
      if(v==='group') return P('<div class="c-btn'+al+'"><div class="bgroup">'+
        '<button class="bt bt-primary">'+T('btn',D.btn)+'</button>'+
        '<button class="bt bt-secondary">'+T('btnB',D.btnB)+'</button>'+
        '<button class="bt bt-ghost">'+T('btnC',D.btnC)+'</button></div></div>');
      return P('<div class="c-btn'+al+'"><button class="bt bt-'+v+'">'+T('btn',D.btn)+'</button></div>');
    }
    case 'footer': return wrap('c-foot'+al,'<span>'+T('footL',D.footL)+'</span>\n<span class="sp">'+
      T('footR',D.footR)+'</span>');
  }
  return P('<div></div>');
}

function exBody(arr){
  const R=laidRows(arr);
  return R.length?rowsHTML(R,'  '):'';
}
function exCSS(){
  const {rules,frames}=collectCSS();
  return fontImport()+rules.join('\n')+(frames.length?'\n\n'+frames.join('\n'):'');
}
function exHTML(){
  const R=laidRows();
  if(!R.length) return '<!-- nothing drawn yet -->';
  const body=rowsHTML(R,'  ');
  const {rules,frames}=collectCSS();
  const cls='page'+(theme?' th-'+theme:'');
  return '<!-- generated by Mirage · style: '+(theme==='__custom'?'custom (design.md)':(theme||'plain'))+' -->\n'+
    '<main class="'+cls+'">\n'+body+'\n</main>\n\n<style>\n'+fontImport()+rules.join('\n')+
    (frames.length?'\n\n'+frames.join('\n'):'')+'\n</style>';
}
const RMAP={nav:'Nav',hero:'Hero',cards:'CardGrid',text:'Prose',image:'Figure',gallery:'Gallery',
  sidebar:'Rail',stats:'Stats',logos:'LogoRow',quote:'Quote',form:'Form',table:'DataTable',
  tabs:'Tabs',price:'Pricing',banner:'Banner',code:'CodeBlock',button:'Button',footer:'Footer',group:'Group'};
function exReact(){
  const R=laidRows(); if(!R.length) return '// nothing drawn yet';
  const one=(b,pad)=>{
    const n=clamp(b.cells||3,2,6), C=RMAP[b.type];
    const bits=[];
    if(b.align&&b.align!=='start') bits.push('align="'+b.align+'"');
    if(b.shape&&b.shape!=='rect') bits.push('shape="'+b.shape+'"');
    if(b.type==='button') bits.push('variant="'+(b.variant||'primary')+'"');
    if(MULTI.indexOf(b.type)>=0) bits.push('columns={'+n+'}');
    if(b.type==='hero') bits.push('title="'+txt(b,'heroH',D.heroH).replace(/"/g,'&quot;')+'"');
    if(b.type==='nav') bits.push('brand="'+txt(b,'brand',D.brand).replace(/"/g,'&quot;')+'"');
    if(b.hide&&b.hide.length) bits.push('hideOn={'+JSON.stringify(b.hide.map(h=>h==='t'?'tablet':'phone'))+'}');
    if(b.type==='group') return pad+'<Group>\n'+rowsJSX(b.rows||[],pad+'  ')+'\n'+pad+'</Group>';
    return pad+'<'+C+(bits.length?' '+bits.join(' '):'')+' />';
  };
  const rowsJSX=(rows,pad)=>rows.map(row=>row.items.length===1?one(row.items[0],pad)
    :pad+'<Row cols={['+row.items.map(b=>b.cw).join(',')+']}'+(row.items[0].stack?' stack="'+(row.items[0].stack==='t'?'tablet':'never')+'"':'')+'>\n'+
     row.items.map(b=>one(b,pad+'  ')).join('\n')+'\n'+pad+'</Row>').join('\n');
  const body=rowsJSX(R,'      ');
  const used=[];
  const walk=rs=>rs.forEach(r=>r.items.forEach(b=>{ const c=RMAP[b.type]; if(c&&used.indexOf(c)<0) used.push(c); if(b.rows) walk(b.rows); }));
  walk(R);
  if(R.some(r=>r.items.length>1)) used.unshift('Row');
  return "// generated by Mirage\nimport { "+used.join(', ')+" } from '@mirage/ui'\n"+
    "import './design.css' // generated from design.md\n\n"+
    "export default function Page() {\n  return (\n    <main className=\"page\">\n"+body+"\n    </main>\n  )\n}";
}
function exTW(){
  const R=laidRows(); if(!R.length) return '<!-- nothing drawn yet -->';
  const SH={round:'rounded-lg',pill:'rounded-full',circle:'rounded-full aspect-square',
    squircle:'rounded-3xl',cut:''};
  const AL={start:'',center:'text-center items-center justify-center',end:'text-right items-end justify-end'};
  const BT={primary:'bg-neutral-900 text-white px-5 py-2.5',secondary:'border-2 border-neutral-900 px-5 py-2.5',
    ghost:'px-5 py-2.5 hover:bg-neutral-100',pill:'bg-neutral-900 text-white px-6 py-2.5 rounded-full',
    link:'underline underline-offset-4',group:'flex gap-2'};
  const base={nav:'flex items-center gap-5 px-6 py-3.5 border-b border-neutral-200',
    hero:'px-6 py-14',cards:'grid gap-3 p-6',text:'p-6 max-w-prose',
    image:'bg-neutral-100 min-h-[180px] grid place-items-center',gallery:'grid gap-2 p-6',
    sidebar:'p-6 space-y-1',stats:'grid gap-px bg-neutral-200 p-6',
    logos:'flex flex-wrap items-center justify-between gap-3 p-6 opacity-70',
    quote:'px-6 py-10',form:'p-6 grid gap-2 max-w-md',table:'p-6 overflow-x-auto',
    tabs:'p-6',price:'grid gap-3 p-6',banner:'px-6 py-12 bg-neutral-900 text-white',
    code:'m-6 p-4 bg-neutral-900 text-neutral-100 text-xs',button:'p-6 flex',
    footer:'p-6 border-t border-neutral-200 text-sm text-neutral-500'};
  const one=(b,pad)=>{
    const n=clamp(b.cells||3,2,6);
    let cls=base[b.type]||'p-6';
    if(['cards','gallery','stats','price'].indexOf(b.type)>=0) cls+=' grid-cols-1 md:grid-cols-'+n;
    if(SHAPED.indexOf(b.type)>=0&&b.shape&&SH[b.shape]) cls+=' '+SH[b.shape];
    if(b.align&&AL[b.align]) cls+=' '+AL[b.align];
    if(b.hide&&b.hide.indexOf('t')>=0) cls+=' max-md:hidden';
    else if(b.hide&&b.hide.indexOf('p')>=0) cls+=' max-sm:hidden';
    if(b.first) cls+=' max-md:order-first';
    if(b.type==='group') return pad+'<section class="p-6">\n'+rowsTW(b.rows||[],pad+'  ')+'\n'+pad+'</section>';
    if(b.type==='button') return pad+'<div class="'+cls+'"><button class="'+BT[b.variant||'primary']+'">'+
      esc(txt(b,'btn',D.btn))+'</button></div>';
    const t=TAG[b.type]||'section';
    return pad+'<'+t+' class="'+cls+'">'+NICE[b.type]+'</'+t+'>';
  };
  const rowsTW=(rows,pad)=>rows.map(row=>{
    if(row.items.length===1) return one(row.items[0],pad);
    const fr=row.items.map(b=>b.cw+'fr').join('_'), st=row.items[0].stack;
    const g=st==='keep'?'grid grid-cols-['+fr+']':(st==='t'?'grid grid-cols-1 lg:grid-cols-['+fr+']':'grid grid-cols-1 md:grid-cols-['+fr+']');
    return pad+'<section class="'+g+'">\n'+row.items.map(b=>one(b,pad+'  ')).join('\n')+'\n'+pad+'</section>';
  }).join('\n\n');
  const body=rowsTW(R,'  ');
  return '<!-- generated by Mirage · Tailwind -->\n<main>\n'+body+'\n</main>';
}
function exJSON(){
  syncPage();
  return JSON.stringify({version:6,name:project.name,cols:COLS,theme,design,shareChrome,pages,boxes},null,2);
}
const EXPORTS={html:exHTML,react:exReact,tw:exTW,design:designMd,json:exJSON};
const EXT={html:'html',react:'jsx',tw:'html',design:'md',json:'json'};

/* ============================================================ storage */
const STORE=(()=>{
  let db=null, mem=new Map(), useMem=false;
  function open(){
    return new Promise(res=>{
      if(db) return res(db);
      if(useMem||!window.indexedDB){ useMem=true; return res(null); }
      let rq; try{ rq=indexedDB.open('mirage',2); }catch(_){ useMem=true; return res(null); }
      rq.onupgradeneeded=()=>{
        const d=rq.result;
        if(!d.objectStoreNames.contains('projects')) d.createObjectStore('projects',{keyPath:'id'});
        if(!d.objectStoreNames.contains('settings')) d.createObjectStore('settings',{keyPath:'k'});
      };
      rq.onsuccess=()=>{ db=rq.result; res(db); };
      rq.onerror=()=>{ useMem=true; res(null); };
      setTimeout(()=>{ if(!db){ useMem=true; res(null); } },1500);
    });
  }
  const tx=(store,mode,fn)=>open().then(d=>{
    if(!d) return fn(null);
    return new Promise((res,rej)=>{
      const t=d.transaction(store,mode); const r=fn(t.objectStore(store));
      t.oncomplete=()=>res(r&&r.result!==undefined?r.result:r);
      t.onerror=()=>rej(t.error);
    });
  });
  return {
    isMemory:()=>useMem,
    all(){ return tx('projects','readonly',s=>s?s.getAll():[...mem.values()])
      .then(v=>(v||[]).sort((a,b)=>b.updated-a.updated)).catch(()=>[...mem.values()]); },
    put(p){ if(useMem){ mem.set(p.id,p); return Promise.resolve(p); }
      return tx('projects','readwrite',s=>s?s.put(p):mem.set(p.id,p)).then(()=>p)
        .catch(()=>{ mem.set(p.id,p); return p; }); },
    del(id){ if(useMem){ mem.delete(id); return Promise.resolve(); }
      return tx('projects','readwrite',s=>s?s.delete(id):mem.delete(id)).catch(()=>{ mem.delete(id); }); },
    setting(k,v){ if(v===undefined)
        return tx('settings','readonly',s=>s?s.get(k):mem.get('s_'+k)).then(r=>r?r.v:null).catch(()=>null);
      if(useMem){ mem.set('s_'+k,{k,v}); return Promise.resolve(); }
      return tx('settings','readwrite',s=>s?s.put({k,v}):mem.set('s_'+k,{k,v})).catch(()=>{}); },
  };
})();
const uid=()=>'p_'+Date.now().toString(36)+'_'+Math.random().toString(36).slice(2,7);
function syncPage(){ if(pages[pg]) pages[pg].boxes=boxes; }
const snapshot=()=>{ syncPage(); return {id:project.id,name:project.name,cols:COLS,theme,design:clone(design),
  pages:clone(pages),pg,shareChrome,versions:clone(versions),boxes:clone(boxes),updated:Date.now()}; };
function scheduleSave(){ clearTimeout(saveTimer); saveTimer=setTimeout(saveNow,700); }
function saveNow(){
  if(!project.id) project.id=uid();
  STORE.put(snapshot()).then(()=>{
    $('savedAt').textContent='saved';
    setTimeout(()=>{ if($('savedAt').textContent==='saved') $('savedAt').textContent=''; },1300);
  });
}
function loadProject(p){
  project={id:p.id,name:p.name};
  pages=p.pages&&p.pages.length?clone(p.pages):[{id:'pg_home',name:'Home',boxes:p.boxes||[]}];
  pages.forEach(x=>ensureIds(x.boxes));
  pg=clamp(p.pg||0,0,pages.length-1); boxes=pages[pg].boxes;
  shareChrome=p.shareChrome!==false; versions=p.versions||[];
  theme=p.theme||'';
  design=Object.assign({},DEFAULT_DESIGN,p.design||{});
  $('themeSel').value=theme; $('projName').textContent=project.name;
  syncDesignForm(); applyDesign();
  sel=-1; hist=[clone(boxes)]; hi=0; syncHist(); resize(); commit(false);
  emit('load');
}
function newProject(){
  project={id:uid(),name:'Untitled sketch'};
  pages=[{id:'pg_home',name:'Home',boxes:[]}]; pg=0; versions=[]; shareChrome=true;
  boxes=pages[0].boxes; sel=-1; design={...DEFAULT_DESIGN};
  syncDesignForm(); applyDesign();
  $('projName').textContent=project.name;
  hist=[[]]; hi=0; syncHist(); resize(); commit(true); toast('New project');
}
function renderProjects(){
  const list=$('projList');
  list.innerHTML='<p class="empty">Loading…</p>';
  STORE.all().then(all=>{
    $('storeNote').textContent=STORE.isMemory()
      ? 'This browser blocked local storage, so projects last only for this session.'
      : 'Stored in this browser with IndexedDB. No account, nothing leaves your device.';
    if(!all.length){ list.innerHTML='<p class="empty">No saved projects yet. Everything autosaves.</p>'; return; }
    list.innerHTML='';
    all.forEach(p=>{
      const row=document.createElement('div');
      row.className='prj'+(p.id===project.id?' on':'');
      const w=new Date(p.updated);
      row.innerHTML='<div class="pi"><b>'+esc(p.name)+'</b><span>'+(p.boxes?p.boxes.length:0)+
        ' boxes · '+(p.theme==='__custom'?'custom':(p.theme||'plain'))+' · '+
        w.toLocaleDateString()+'</span></div><div class="pa">'+
        '<button data-a="open">Open</button><button data-a="dupe">Duplicate</button>'+
        '<button data-a="del" class="dg">Delete</button></div>';
      row.querySelector('[data-a=open]').onclick=()=>{ loadProject(p); $('mProj').classList.remove('on'); toast('Opened '+p.name); };
      row.querySelector('[data-a=dupe]').onclick=()=>{
        STORE.put({...clone(p),id:uid(),name:p.name+' copy',updated:Date.now()}).then(renderProjects); };
      row.querySelector('[data-a=del]').onclick=()=>{
        STORE.del(p.id).then(()=>{ if(p.id===project.id) project.id=null; renderProjects(); }); };
      list.appendChild(row);
    });
  });
}

/* ============================================================ pages */
function switchPage(j){
  if(j===pg||!pages[j]) return;
  syncPage(); pg=j; boxes=pages[pg].boxes; ensureIds();
  sel=-1; hist=[clone(boxes)]; hi=0; syncHist(); resize(); commit(false); syncPages(); scheduleSave();
  emit('change');
}
function addPage(name){
  syncPage();
  /* new pages start with this page's nav and footer so the site hangs together */
  const {list}=classify();
  const keep=boxes.filter((b,i)=>!b.pid&&(list[i].type==='nav'||list[i].type==='footer'))
    .map(b=>({...clone(b),id:bid()}));
  const nav=keep.filter(b=>b.cy===0), foot=keep.filter(b=>b.cy!==0);
  foot.forEach(b=>{ b.cy=(nav.length?nav[0].ch:0)+8; });
  pages.push({id:'pg_'+Math.random().toString(36).slice(2,8),name:name||('Page '+(pages.length+1)),boxes:nav.concat(foot)});
  switchPage(pages.length-1); toast('Added '+pages[pg].name);
}
function renamePage(j,name){ if(!pages[j]||!name) return; pages[j].name=name; syncPages(); render(); scheduleSave(); emit('change'); }
function deletePage(j){
  if(pages.length<2||!pages[j]) return;
  syncPage(); pages.splice(j,1);
  pg=clamp(pg>=j?pg-1:pg,0,pages.length-1); boxes=pages[pg].boxes;
  sel=-1; hist=[clone(boxes)]; hi=0; syncHist(); resize(); commit(false); syncPages(); scheduleSave(); emit('change');
}
function syncPages(){
  const el=$('pageTabs'); if(!el) return;
  el.innerHTML='';
  pages.forEach((p,j)=>{
    const t=document.createElement('button');
    t.className='pt'+(j===pg?' on':''); t.textContent=p.name; t.title='Double-click to rename';
    t.onclick=()=>switchPage(j);
    t.ondblclick=()=>{
      t.contentEditable='true'; t.focus(); document.execCommand&&document.execCommand('selectAll',false,null);
      const done=()=>{ t.contentEditable='false'; renamePage(j,t.textContent.trim()||p.name); };
      t.onblur=done; t.onkeydown=e=>{ e.stopPropagation(); if(e.key==='Enter'){ e.preventDefault(); t.blur(); } };
    };
    if(pages.length>1&&j===pg){
      const x=document.createElement('span'); x.className='px'; x.textContent='\u00d7'; x.title='Delete page';
      x.onclick=e=>{ e.stopPropagation(); if(confirm('Delete page "'+p.name+'"? This cannot be undone.')) deletePage(j); };
      t.appendChild(x);
    }
    el.appendChild(t);
  });
  const add=document.createElement('button'); add.className='pt add'; add.textContent='+'; add.title='Add a page';
  add.onclick=()=>addPage(); el.appendChild(add);
}

/* ============================================================ pointer */
function cellAt(e){ const r=cv.getBoundingClientRect(); return {x:(e.clientX-r.left)/cell,y:(e.clientY-r.top)/cell}; }
function drawRect(){
  const x0=Math.floor(Math.min(drawing.x0,drawing.x1)),x1=Math.ceil(Math.max(drawing.x0,drawing.x1));
  const y0=Math.floor(Math.min(drawing.y0,drawing.y1)),y1=Math.ceil(Math.max(drawing.y0,drawing.y1));
  return {cx:clamp(x0,0,COLS-1),cy:Math.max(0,y0),cw:clamp(x1-x0,1,COLS),ch:Math.max(1,y1-y0)};
}
function hit(p){
  let best=-1;
  for(let i=boxes.length-1;i>=0;i--){ const b=boxes[i];
    if(p.x>=b.cx&&p.x<=b.cx+b.cw&&p.y>=b.cy&&p.y<=b.cy+b.ch){
      if(b.pid) return i;           // children win over their parent
      if(best<0) best=i;
    } }
  return best;
}
function hitHandle(p){
  if(sel<0||!boxes[sel]) return null;
  const tol=9/cell;
  for(const h of handles(boxes[sel]))
    if(Math.abs(h.x/cell-p.x)<tol&&Math.abs(h.y/cell-p.y)<tol) return h.id;
  return null;
}
function snapEdges(r, idx){
  const S = 1;
  guides = [];

  const rcx = r.cx + r.cw / 2;
  const rcy = r.cy + r.ch / 2;

  boxes.forEach((o,i)=>{
    if(i===idx) return;

    const ocx = o.cx + o.cw / 2;
    const ocy = o.cy + o.ch / 2;

    // Left -> Right
    if(Math.abs(r.cx - (o.cx + o.cw)) <= S){
      r.cx = o.cx + o.cw;
      guides.push({v:true,p:r.cx*cell});
    }

    // Left -> Left
    else if(Math.abs(r.cx - o.cx) <= S){
      r.cx = o.cx;
      guides.push({v:true,p:r.cx*cell});
    }

    // Right -> Right
    else if(Math.abs((r.cx+r.cw) - (o.cx+o.cw)) <= S){
      r.cx = (o.cx+o.cw) - r.cw;
      guides.push({v:true,p:(o.cx+o.cw)*cell});
    }

    // Center X
    else if(Math.abs(rcx - ocx) <= S){
      r.cx = ocx - r.cw/2;
      guides.push({v:true,p:ocx*cell});
    }

    // Top -> Bottom
    if(Math.abs(r.cy - (o.cy+o.ch)) <= S){
      r.cy = o.cy + o.ch;
      guides.push({v:false,p:r.cy*cell});
    }

    // Top -> Top
    else if(Math.abs(r.cy - o.cy) <= S){
      r.cy = o.cy;
      guides.push({v:false,p:r.cy*cell});
    }

    // Bottom -> Bottom
    else if(Math.abs((r.cy+r.ch) - (o.cy+o.ch)) <= S){
      r.cy = (o.cy+o.ch) - r.ch;
      guides.push({v:false,p:(o.cy+o.ch)*cell});
    }

    // Center Y
    else if(Math.abs(rcy - ocy) <= S){
      r.cy = ocy - r.ch/2;
      guides.push({v:false,p:ocy*cell});
    }

  });

  return r;
}
let mode=null,anchor=null,orig=null,hnd=null,moved=false;
cv.addEventListener('pointerdown',e=>{
  if(e.button===2) return;
  const p=cellAt(e); anchor=p; moved=false;
  try{ cv.setPointerCapture(e.pointerId); }catch(_){}
  const h=hitHandle(p);
  if(h){ mode='resize'; hnd=h; orig={...boxes[sel]}; return; }
  const i=hit(p);
  /* Alt-drag inside a box draws a child box instead of moving it */
  if(i>=0&&!e.altKey){ if(sel!==i){ sel=i; syncSel(); } mode='move'; orig={...boxes[i]}; paint(); return; }
  sel=-1; syncSel(); mode='draw'; drawing={x0:p.x,y0:p.y,x1:p.x,y1:p.y};
});
cv.addEventListener('pointermove',e=>{
  const p=cellAt(e);
  if(!mode){ cv.style.cursor=hitHandle(p)?'nwse-resize':(hit(p)>=0?'move':'crosshair'); return; }
  const dx=p.x-anchor.x, dy=p.y-anchor.y;
  if(Math.abs(dx)>0.25||Math.abs(dy)>0.25) moved=true;
  if(mode==='draw'){ drawing.x1=p.x; drawing.y1=p.y; paint(); return; }
  if(mode==='move'){
    let want={cx:orig.cx+Math.round(dx),cy:Math.max(0,orig.cy+Math.round(dy)),cw:orig.cw,ch:orig.ch};
    want.cx=clamp(want.cx,0,COLS-want.cw);
    want=snapEdges(want,sel); want.cx=clamp(want.cx,0,COLS-want.cw);
    tryPlace(sel,want); grow(); paint(); render(); return;
  }
  if(mode==='resize'){
    let {cx,cy,cw,ch}=orig; const rx=Math.round(dx),ry=Math.round(dy);
    if(hnd.indexOf('e')>=0) cw=orig.cw+rx;
    if(hnd.indexOf('w')>=0){ cx=orig.cx+rx; cw=orig.cw-rx; }
    if(hnd.indexOf('s')>=0) ch=orig.ch+ry;
    if(hnd.indexOf('n')>=0){ cy=orig.cy+ry; ch=orig.ch-ry; }
    if(cw<1){ cw=1; if(hnd.indexOf('w')>=0) cx=orig.cx+orig.cw-1; }
    if(ch<1){ ch=1; if(hnd.indexOf('n')>=0) cy=orig.cy+orig.ch-1; }
    cx=clamp(cx,0,COLS-1); cy=Math.max(0,cy); cw=clamp(cw,1,COLS-cx);
    const want={cx,cy,cw,ch};
    if(canResize(sel,want)) Object.assign(boxes[sel],want);
    grow(); paint(); render(); return;
  }
});
function grow(){
  const need=surfaceRows()*cell;
  if(Math.abs(need-H)>0.5){ H=need; cv.style.height=H+'px';
    cv.height=Math.max(1,Math.round(H*DPR)); ctx.setTransform(DPR,0,0,DPR,0,0); }
}
function endPointer(){
  guides=[];
  if(mode==='draw'){
    const r=drawRect(); drawing=null;
    /* fully inside a top-level box: becomes its child (one level deep) */
    const host=boxes.find(b=>!b.pid&&contains(b,r)&&!(b.cx===r.cx&&b.cy===r.cy&&b.cw===r.cw&&b.ch===r.ch));
    if(host) r.pid=host.id;
    if(collides(r,-1,r.pid)||(!host&&boxes.some(b=>!b.pid&&overlaps(r,b)))){ toast('That space is taken'); paint(); mode=null; return; }
    r.id=bid();
    boxes.push(r); sel=boxes.length-1; resize(); commit(true);
    if(host&&kidsOf(host).length===1) toast('Drew inside '+NICE[classify().list[boxes.indexOf(host)].type]+'. It is now a group.',2600);
    coach();
  } else if(mode==='move'||mode==='resize'){
    if(moved){ resize(); commit(true); } else { paint(); syncSel(); }
  }
  mode=null; hnd=null;
}
cv.addEventListener('pointerup',endPointer);
cv.addEventListener('pointercancel',endPointer);
cv.addEventListener('contextmenu',e=>{
  e.preventDefault();
  const i=hit(cellAt(e));
  if(i>=0){ removeBox(i); sel=-1; resize(); commit(true); }
});

/* ============================================================ UI */
function toast(m,ms){
  const t=$('toast'); t.textContent=m; t.classList.add('on');
  clearTimeout(t._x); t._x=setTimeout(()=>t.classList.remove('on'),ms||1700);
}
/* first box ever: explain read-then-override once */
function coach(){
  let seen=false; try{ seen=localStorage.getItem('mirage.coached')==='1'; }catch(_){}
  if(seen||sel<0) return;
  const c=classify().list[sel];
  toast('Read as '+NICE[c.type]+'. Wrong? Pick another type on the left, it stays set.',5200);
  try{ localStorage.setItem('mirage.coached','1'); }catch(_){}
}
function commit(record){
  ensureIds();
  if(record) push();

  const blank = $('blank');

  if (boxes.length > 0) {
    blank.classList.add('gone');
    blank.style.display = 'none';
  } else {
    blank.style.display = 'flex';
    blank.classList.remove('gone');
  }

  paint();
  render();
  syncSel();
  syncStats();

  if ($('mExport').classList.contains('on')) refreshExport();
  emit('commit');
}
function syncLayers(){
  const {list,rows}=classify(), el=$('layers');
  if(!boxes.length){ el.innerHTML='<p class="empty">Nothing drawn yet. Drag a box on the surface.</p>'; return; }
  el.innerHTML='';
  rows.forEach((row,ri)=>{
    const s=document.createElement('div');
    s.className='rowsep';
    s.innerHTML='<span>ROW '+String(ri+1).padStart(2,'0')+'</span><s></s>'+
      (row.items.length>1?'<span>'+row.items.length+' ACROSS</span>':'');
    el.appendChild(s);
    const item=(i,c,kid)=>{
      const b=boxes[i];
      const d=document.createElement('div');
      d.className='lay'+(i===sel?' on':'')+(c.merged?' sub':'')+(kid?' kid':'');
      d.innerHTML='<span class="ix">'+String(i+1).padStart(2,'0')+'</span>'+
        '<span class="nm">'+esc(boxLabel(c))+'</span>'+
        (b.hide&&b.hide.length?'<span class="lk hd" title="Hidden on '+b.hide.map(h=>h==='t'?'tablet':'phone').join(' and ')+'">'+b.hide.map(h=>h.toUpperCase()).join('')+'</span>':'')+
        (b.locked?'<span class="lk">SET</span>':'')+
        '<span class="sp">'+b.cw+'\u00d7'+b.ch+'</span>';
      d.onclick=()=>{ sel=i; syncSel(); paint(); };
      el.appendChild(d);
    };
    row.items.forEach(o=>{
      const c=list[o.i]; item(o.i,c,false);
      (c.kids||[]).forEach(kr=>kr.items.forEach(ko=>item(ko.i,list[ko.i],true)));
    });
  });
}
function syncStats(){
  const {rows,list}=classify();
  $('stBox').textContent=boxes.length;
  $('stComp').textContent=list.filter(b=>!b.merged).length;
  $('stRows').textContent=rows.length;
  $('stLock').textContent=boxes.filter(b=>b.locked).length;
}
function chipGroup(host,items,attr,onPick){
  items.forEach(it=>{
    const b=document.createElement('button');
    b.dataset[attr]=it[0]; b.textContent=it[1];
    b.onclick=()=>onPick(it[0]);
    host.appendChild(b);
  });
}
chipGroup($('typeGrid'),TYPES,'t',v=>{
  const x=boxes[sel]; if(!x) return;
  x.type=v; x.locked=true;
  if(MULTI.indexOf(v)>=0&&!x.cells) x.cells=3;
  if(v==='button'&&!x.variant) x.variant='primary';
  commit(true);
});
chipGroup($('shapeGrid'),SHAPES,'s',v=>{ const x=boxes[sel]; if(!x) return; x.shape=v; commit(true); });
chipGroup($('varGrid'),VARIANTS,'v',v=>{ const x=boxes[sel]; if(!x) return;
  x.variant=v; x.type='button'; x.locked=true; commit(true); });
chipGroup($('alignGrid'),ALIGNS,'a',v=>{ const x=boxes[sel]; if(!x) return; x.align=v; commit(true); });
chipGroup($('hideGrid'),[['t','Hide on tablet'],['p','Hide on phone'],['first','First on phone']],'h',v=>{
  const x=boxes[sel]; if(!x) return;
  if(v==='first'){ x.first=!x.first; if(!x.first) delete x.first; }
  else { x.hide=x.hide||[]; const k=x.hide.indexOf(v); if(k>=0) x.hide.splice(k,1); else x.hide.push(v); if(!x.hide.length) delete x.hide; }
  commit(true);
});
chipGroup($('stackGrid'),[['p','Stack on phone'],['t','Stack on tablet'],['keep','Never stack']],'st',v=>{
  const x=boxes[sel]; if(!x) return;
  /* the row's setting lives on every box in the row so it survives reordering */
  const row=classify().rows.find(r=>r.items.some(o=>o.i===sel));
  (row?row.items.map(o=>boxes[o.i]):[x]).forEach(b=>{ if(v==='p') delete b.stack; else b.stack=v; });
  commit(true);
});

function syncSel(){
  const has=sel>=0&&!!boxes[sel];
  $('paneLayers').classList.toggle('on',!has);
  $('paneInsp').classList.toggle('on',has);
  $('ftSel').textContent=has?('box '+(sel+1)+' of '+boxes.length):'no selection';
  syncLayers();
  if(!has) return;
  const b=boxes[sel], c=classify().list[sel];
  $('inspHead').textContent='Box '+(sel+1)+' \u2014 '+NICE[c.type];

  const mark=(host,attr,val)=>Array.prototype.forEach.call(host.children,
    el=>el.classList.toggle('on',el.dataset[attr]===val));
  mark($('typeGrid'),'t',c.type);
  const pct=Math.round((b.locked?1:c.conf)*100);
  $('cfLab').textContent=b.locked?'set by hand':'auto';
  $('cfPct').textContent=pct+'%';
  const bar=$('cfBar'); bar.style.width=pct+'%'; bar.classList.toggle('low',!b.locked&&c.conf<.55);
  $('fW').max=COLS; $('fW').value=b.cw; $('fWV').textContent=b.cw;
  $('fH').value=Math.min(b.ch,24); $('fHV').textContent=b.ch;
  $('fldCells').hidden=MULTI.indexOf(c.type)<0;
  if(!$('fldCells').hidden){ const v=b.cells||c.cells||3; $('fCells').value=v; $('fCellsV').textContent=v; }
  $('fldShape').hidden=SHAPED.indexOf(c.type)<0;
  mark($('shapeGrid'),'s',b.shape||'rect');
  $('fldVar').hidden=c.type!=='button';
  mark($('varGrid'),'v',b.variant||'primary');
  $('fldAlign').hidden=ALIGNABLE.indexOf(c.type)<0;
  mark($('alignGrid'),'a',b.align||'start');
  const isGroup=c.type==='group';
  $('fldRead').hidden=isGroup; $('fldGroup').hidden=!isGroup;
  if(isGroup) $('groupNote').textContent='Holds '+kidsOf(b).length+' box'+(kidsOf(b).length===1?'':'es')+
    '. They are laid out inside it as their own rows. Delete them to turn it back into a single component.';
  const alts=$('alts');
  alts.innerHTML='';
  if(!b.locked&&c.alts&&c.alts.length){
    alts.innerHTML='<span class="ak">also reads as</span>';
    c.alts.forEach(a=>{
      const bt=document.createElement('button');
      bt.innerHTML=esc(NICE[a[0]])+' <i>'+Math.round(a[1]*100)+'%</i>';
      bt.onclick=()=>{ b.type=a[0]; b.locked=true; if(MULTI.indexOf(a[0])>=0&&!b.cells) b.cells=3; commit(true); };
      alts.appendChild(bt);
    });
  }
  const hide=b.hide||[];
  Array.prototype.forEach.call($('hideGrid').children,el=>el.classList.toggle('on',
    el.dataset.h==='first'?!!b.first:hide.indexOf(el.dataset.h)>=0));
  const inRow=(classify().rows.find(r=>r.items.some(o=>o.i===sel))||{items:[]}).items.length>1;
  $('stackWrap').hidden=!inRow||!!b.pid;
  mark($('stackGrid'),'st',b.stack||'p');
}
function sizeInput(id,apply){
  $(id).addEventListener('input',()=>{
    const b=boxes[sel]; if(!b) return;
    const v=+$(id).value, want={cx:b.cx,cy:b.cy,cw:b.cw,ch:b.ch};
    apply(want,v,b);
    if(!canResize(sel,want)){ toast('That would overlap another box or cut off its contents'); syncSel(); return; }
    Object.assign(b,want); resize(); paint(); render(); syncStats();
    $(id==='fW'?'fWV':'fHV').textContent=v;
  });
  $(id).addEventListener('change',()=>{ push(); syncSel(); });
}
sizeInput('fW',(w,v,b)=>{ w.cw=clamp(v,1,COLS-b.cx); });
sizeInput('fH',(w,v)=>{ w.ch=Math.max(1,v); });
$('fCells').addEventListener('input',()=>{
  const b=boxes[sel]; if(!b) return;
  b.cells=+$('fCells').value; b.locked=true;
  $('fCellsV').textContent=$('fCells').value; render();
});
$('fCells').addEventListener('change',()=>push());

$('bAuto').onclick=()=>{ const b=boxes[sel]; if(!b) return;
  delete b.locked; delete b.type; delete b.cells; commit(true); toast('Re-read from geometry'); };
$('bDupe').onclick=()=>{ const b=boxes[sel]; if(!b) return;
  const dy=b.ch+1, nb={...clone(b),id:bid(),cy:b.cy+dy};
  if(b.pid&&!legal(-1,nb)){ toast('No room for a copy inside this group'); return; }
  const kids=kidsOf(b).map(k=>({...clone(k),id:bid(),pid:nb.id,cy:k.cy+dy}));
  /* push everything below down so the copy never overlaps */
  if(!b.pid) boxes.forEach(o=>{ if(!o.pid&&o!==b&&o.cy>=b.cy+b.ch){ shiftKids(o,0,dy); o.cy+=dy; } });
  boxes.push(nb,...kids); sel=boxes.indexOf(nb); resize(); commit(true); };
$('bDel').onclick=()=>{ if(sel<0) return; removeBox(sel); sel=-1; resize(); commit(true); };
$('bUndo').onclick=undo; $('bRedo').onclick=redo;
$('bClear').onclick=()=>{ boxes=[]; sel=-1; resize(); commit(true); toast('Cleared \u00b7 \u2318Z to undo'); };
$('bLabels').onclick=()=>{ showLabels=!showLabels; $('bLabels').classList.toggle('on',showLabels); paint(); };
$('bDark').onclick=()=>{ dark=!dark; document.body.classList.toggle('dark',dark);
  $('bDark').classList.toggle('on',dark); requestAnimationFrame(paint); };
$('bFull').onclick=()=>{
  const o=$('out'); o.classList.toggle('full');
  const on=o.classList.contains('full');
  $('bFull').classList.toggle('on',on);
  $('bFull').title=on?'Collapse preview':'Expand preview';
};
$('bTidy').onclick=()=>{
  if(!boxes.length) return;
  const {rows}=classify(); let y=0;
  rows.forEach(r=>{
    const h=r.items.reduce((m,o)=>Math.max(m,boxes[o.i].ch),0);
    let x=0;
    r.items.forEach(o=>{ const b=boxes[o.i]; shiftKids(b,x-b.cx,y-b.cy); b.cy=y; b.cx=x; if(!kidsOf(b).length) b.ch=h; x+=b.cw; });
    y+=h+1;
  });
  sel=-1; resize(); commit(true); toast('Tidied into rows');
};
Array.prototype.forEach.call($('segDev').children,b=>{
  b.onclick=()=>{ Array.prototype.forEach.call($('segDev').children,x=>x.classList.remove('on'));
    b.classList.add('on'); devW=+b.dataset.w; render(); };
});
$('themeSel').addEventListener('change',e=>{
  theme=e.target.value; render(); scheduleSave(); emit('change');
  if($('mExport').classList.contains('on')) refreshExport();
});

const PRESETS={
  landing:[{cx:0,cy:0,cw:16,ch:2},{cx:0,cy:2,cw:16,ch:7},
    {cx:0,cy:9,cw:5,ch:5},{cx:5,cy:9,cw:6,ch:5},{cx:11,cy:9,cw:5,ch:5},
    {cx:0,cy:14,cw:8,ch:6},{cx:8,cy:14,cw:8,ch:6},
    {cx:0,cy:20,cw:16,ch:4},{cx:0,cy:24,cw:16,ch:2}],
  split:[{cx:0,cy:0,cw:16,ch:2},{cx:0,cy:2,cw:9,ch:8},{cx:9,cy:2,cw:7,ch:8},
    {cx:0,cy:10,cw:7,ch:6},{cx:7,cy:10,cw:9,ch:6},{cx:0,cy:16,cw:16,ch:2}],
  docs:[{cx:0,cy:0,cw:16,ch:2},{cx:0,cy:2,cw:4,ch:16},{cx:4,cy:2,cw:12,ch:5},
    {cx:4,cy:7,cw:12,ch:5},{cx:4,cy:12,cw:12,ch:6}],
  dash:[{cx:0,cy:0,cw:16,ch:2},{cx:0,cy:2,cw:3,ch:16},{cx:3,cy:2,cw:13,ch:2},
    {cx:3,cy:4,cw:6,ch:7},{cx:9,cy:4,cw:7,ch:7},{cx:3,cy:11,cw:13,ch:7}],
};
document.querySelectorAll('[data-preset]').forEach(b=>{
  b.onclick=()=>{
    boxes=PRESETS[b.dataset.preset].map(o=>({...o,id:bid()})); sel=-1; resize(); commit(true);
    toast('Loaded '+b.textContent+' \u00b7 \u2318Z to undo');
  };
});

const EXNOTES={
  html:'Styles read from the live preview. Renders identically, and reflows on phones.',
  react:'Assumes a component library. Row takes a cols array.',
  tw:'Utility classes with responsive row collapse.',
  design:'The design system for this project.',
  json:'The whole project, every page, reloadable.',
};
function refreshExport(){
  $('codeOut').textContent=EXPORTS[fmt]();
  $('exNote').textContent=EXNOTES[fmt]||'';
}
$('bExport').onclick=()=>{ $('mExport').classList.add('on'); refreshExport(); };
$('xExport').onclick=()=>$('mExport').classList.remove('on');
Array.prototype.forEach.call($('segFmt').children,b=>{
  b.onclick=()=>{ Array.prototype.forEach.call($('segFmt').children,x=>x.classList.remove('on'));
    b.classList.add('on'); fmt=b.dataset.f; refreshExport(); };
});
function fallbackCopy(t){
  const ta=document.createElement('textarea');
  ta.value=t; ta.style.position='fixed'; ta.style.opacity='0';
  document.body.appendChild(ta); ta.select();
  try{ document.execCommand('copy'); toast('Copied'); }catch(_){ toast('Select and copy manually'); }
  ta.remove();
}
$('bCopy').onclick=()=>{
  const t=$('codeOut').textContent;
  if(navigator.clipboard&&navigator.clipboard.writeText)
    navigator.clipboard.writeText(t).then(()=>toast('Copied'),()=>fallbackCopy(t));
  else fallbackCopy(t);
};
$('bDownload').onclick=()=>{
  if(EXPORTS[fmt].download){ EXPORTS[fmt].download(); return; }
  const blob=new Blob([$('codeOut').textContent],{type:'text/plain'});
  const a=document.createElement('a');
  a.href=URL.createObjectURL(blob);
  const base=(project.name||'mirage').replace(/[^a-z0-9]+/gi,'-').toLowerCase();
  a.download=(fmt==='design'?'design':base)+'.'+EXT[fmt];
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(()=>URL.revokeObjectURL(a.href),1000);
  toast('Downloaded');
};

$('bProjects').onclick=()=>{ $('mProj').classList.add('on'); renderProjects(); };
$('xProj').onclick=()=>$('mProj').classList.remove('on');
$('bNewProj').onclick=()=>{ newProject(); renderProjects(); };
$('projName').addEventListener('blur',()=>{
  const v=$('projName').textContent.trim()||'Untitled sketch';
  $('projName').textContent=v; project.name=v; saveNow(); refreshDesignMd();
});
$('projName').addEventListener('keydown',e=>{
  if(e.key==='Enter'){ e.preventDefault(); $('projName').blur(); }
  e.stopPropagation();
});

/* ---------- design panel ---------- */
const SWATCH=[['bg','Background'],['fg','Text'],['mut','Muted'],['line','Lines'],['acc','Accent']];
SWATCH.forEach(s=>{
  const w=document.createElement('div');
  w.className='sw';
  w.innerHTML='<input type="color" id="c_'+s[0]+'"><label for="c_'+s[0]+'">'+s[1]+'</label><code id="v_'+s[0]+'"></code>';
  $('swatches').appendChild(w);
  w.querySelector('input').addEventListener('input',e=>{
    design[s[0]]=e.target.value.toUpperCase();
    $('v_'+s[0]).textContent=design[s[0]];
    applyDesign(); refreshDesignMd(); scheduleSave(); emit('change');
  });
});
[['dFontD','fontD'],['dFontB','fontB']].forEach(pair=>{
  const s=$(pair[0]);
  FONTS.forEach(f=>{ const o=document.createElement('option'); o.value=f; o.textContent=f; s.appendChild(o); });
  s.addEventListener('change',()=>{ design[pair[1]]=s.value; applyDesign(); refreshDesignMd(); scheduleSave(); });
});
[['dWeight','weight'],['dTrack','track'],['dRadius','radius'],['dBorder','border'],['dPad','pad']]
.forEach(p=>{
  $(p[0]).addEventListener('input',()=>{
    design[p[1]]=+$(p[0]).value; $(p[0]+'V').textContent=$(p[0]).value;
    applyDesign(); refreshDesignMd();
  });
  $(p[0]).addEventListener('change',scheduleSave);
});
chipGroup($('dShadow'),[['none','None'],['0 2px 10px rgba(0,0,0,.08)','Soft'],
  ['5px 5px 0 currentColor','Hard']],'sh',v=>{
  design.shadow=v;
  Array.prototype.forEach.call($('dShadow').children,el=>el.classList.toggle('on',el.dataset.sh===v));
  applyDesign(); refreshDesignMd(); scheduleSave();
});
function syncDesignForm(){
  SWATCH.forEach(s=>{ const i=$('c_'+s[0]); if(i){ i.value=design[s[0]]; $('v_'+s[0]).textContent=design[s[0]]; } });
  $('dFontD').value=design.fontD; $('dFontB').value=design.fontB;
  [['dWeight','weight'],['dTrack','track'],['dRadius','radius'],['dBorder','border'],['dPad','pad']]
    .forEach(p=>{ $(p[0]).value=design[p[1]]; $(p[0]+'V').textContent=design[p[1]]; });
  Array.prototype.forEach.call($('dShadow').children,
    el=>el.classList.toggle('on',el.dataset.sh===design.shadow));
  refreshDesignMd();
}
function refreshDesignMd(){ $('designMd').textContent=designMd(); }
$('bDesign').onclick=()=>{ $('mDesign').classList.add('on'); syncDesignForm(); };
$('xDesign').onclick=()=>$('mDesign').classList.remove('on');
$('bDesignReset').onclick=()=>{ design={...DEFAULT_DESIGN}; syncDesignForm(); applyDesign(); scheduleSave(); };
$('bDesignApply').onclick=()=>{
  theme='__custom'; $('themeSel').value='__custom';
  applyDesign(); render(); scheduleSave(); emit('change');
  $('mDesign').classList.remove('on'); toast('Design system applied');
};

/* ---------- AI ---------- */
const AI_MODES=[['copy','Write the copy'],['design','Design a palette'],['layout','Draft a layout']];
let aiMode='copy';
if($('aiMode')){ // panel is optional; without this guard a missing #aiMode stopped the whole script
  chipGroup($('aiMode'),AI_MODES,'m',v=>{
    aiMode=v;
    Array.prototype.forEach.call($('aiMode').children,el=>el.classList.toggle('on',el.dataset.m===v));
  });
  Array.prototype.forEach.call($('aiMode').children,el=>el.classList.toggle('on',el.dataset.m==='copy'));
}

const KEYS=[['Draw a box','drag'],['Move a box','drag it'],['Resize','handle'],
  ['Delete box','right-click / Del'],['Edit text','click it in the preview'],['Undo','⌘Z'],
  ['Redo','⇧⌘Z'],['Duplicate','⌘D'],['Projects','⌘P'],['Command palette','⌘K'],['Draw inside a box','Alt + drag'],
  ['Tidy rows','T'],['Labels','L'],['Dark mode','D'],['Fullscreen','F'],['Export','⌘E']];
$('keyList').innerHTML=KEYS.map(k=>'<div><dt>'+k[0]+'</dt><dd>'+k[1]+'</dd></div>').join('');
$('bKeys').onclick=()=>$('mKeys').classList.add('on');
$('xKeys').onclick=()=>$('mKeys').classList.remove('on');
document.querySelectorAll('.modal').forEach(m=>{
  m.addEventListener('click',e=>{ if(e.target===m) m.classList.remove('on'); });
});

document.addEventListener('keydown',e=>{
  const typing=/INPUT|TEXTAREA|SELECT/.test(e.target.tagName)||e.target.isContentEditable;
  if(e.key==='Escape'){
    const open=document.querySelectorAll('.modal.on');
    if(open.length){ open.forEach(m=>m.classList.remove('on')); return; }
    if($('out').classList.contains('full')){ $('bFull').click(); return; }
    if(typing){ e.target.blur(); return; }
    sel=-1; syncSel(); paint(); return;
  }
  if(typing) return;
  const m=e.metaKey||e.ctrlKey, k=e.key.toLowerCase();
  if(m&&k==='z'){ e.preventDefault(); e.shiftKey?redo():undo(); return; }
  if(m&&k==='d'){ e.preventDefault(); $('bDupe').click(); return; }
  if(m&&k==='e'){ e.preventDefault(); $('bExport').click(); return; }
  if(m&&k==='p'){ e.preventDefault(); $('bProjects').click(); return; }
  if(m) return;
  if(k==='t') $('bTidy').click();
  if(k==='l') $('bLabels').click();
  if(k==='d') $('bDark').click();
  if(k==='f') $('bFull').click();
  if((k==='delete'||k==='backspace')&&sel>=0){ e.preventDefault(); $('bDel').click(); }
  if(k.indexOf('arrow')===0&&sel>=0){
    e.preventDefault();
    const b=boxes[sel], want={cx:b.cx,cy:b.cy,cw:b.cw,ch:b.ch};
    if(k==='arrowleft')  want.cx=Math.max(0,b.cx-1);
    if(k==='arrowright') want.cx=Math.min(COLS-b.cw,b.cx+1);
    if(k==='arrowup')    want.cy=Math.max(0,b.cy-1);
    if(k==='arrowdown')  want.cy=b.cy+1;
    if(legal(sel,want)){ const dx=want.cx-b.cx, dy=want.cy-b.cy; Object.assign(b,want); shiftKids(b,dx,dy); resize(); render(); syncSel(); push(); }
  }
});

/* ============================================================ split */
(() => {
  const sp=$('splitter'), mainEl=document.querySelector('main'), rail=$('rail');
  if(!sp) return;
  const set=a=>{ a=clamp(a,.25,.75);
    mainEl.style.setProperty('--split-a',a+'fr'); mainEl.style.setProperty('--split-b',(1-a)+'fr');
    sp.setAttribute('aria-valuenow',Math.round(a*100)); return a; };
  let ratio=.5; try{ const v=parseFloat(localStorage.getItem('mirage.split')); if(v) ratio=v; }catch(_){}
  ratio=set(ratio);
  const save=()=>{ try{ localStorage.setItem('mirage.split',ratio); }catch(_){} };
  sp.addEventListener('pointerdown',e=>{
    e.preventDefault(); sp.setPointerCapture(e.pointerId); sp.classList.add('on'); document.body.classList.add('resizing');
    const move=ev=>{
      const r=mainEl.getBoundingClientRect(), left=r.left+rail.offsetWidth, w=r.width-rail.offsetWidth;
      ratio=set((ev.clientX-left)/w);
    };
    const up=()=>{ sp.classList.remove('on'); document.body.classList.remove('resizing');
      sp.removeEventListener('pointermove',move); sp.removeEventListener('pointerup',up); save(); };
    sp.addEventListener('pointermove',move); sp.addEventListener('pointerup',up);
  });
  sp.addEventListener('dblclick',()=>{ ratio=set(.5); save(); });
  sp.addEventListener('keydown',e=>{
    if(e.key.indexOf('Arrow')===0) e.stopPropagation();
    if(e.key==='ArrowLeft'){ ratio=set(ratio-.03); save(); e.preventDefault(); }
    if(e.key==='ArrowRight'){ ratio=set(ratio+.03); save(); e.preventDefault(); }
  });
})();

/* ============================================================ API for feature modules */
window.Mirage={
  COLS, TYPES, NICE, MULTI, D, DEFAULT_DESIGN,
  get boxes(){ return boxes; }, set boxes(v){ boxes=v; pages[pg].boxes=v; },
  get sel(){ return sel; }, set sel(v){ sel=v; },
  get theme(){ return theme; }, set theme(v){ theme=v||''; $('themeSel').value=theme; },
  get design(){ return design; }, set design(v){ design=Object.assign({},DEFAULT_DESIGN,v); syncDesignForm(); applyDesign(); },
  get project(){ return project; },
  get pages(){ syncPage(); return pages; }, get pg(){ return pg; },
  get versions(){ return versions; }, set versions(v){ versions=v; scheduleSave(); },
  get shareChrome(){ return shareChrome; }, set shareChrome(v){ shareChrome=!!v; scheduleSave(); },
  get cell(){ return cell; }, canvas:cv,
  on, emit, bid, clone, esc, clamp, contains, overlaps, kidsOf,
  classify, laidRows, rowsHTML, mk, exBody, exCSS, exHTML, exReact, exTW, designMd, collectCSS, fontImport,
  txt, setTxt, render, paint, resize, commit, push, toast, saveNow, scheduleSave, syncSel, syncPage,
  switchPage, addPage, syncPages, loadProject, newProject, STORE, uid, cellAt,
  setExportLinks(v){ EXPORT_LINKS=v; },
  exports:EXPORTS, ext:EXT, exnotes:EXNOTES, refreshExport,
  /* replace the whole project state, e.g. from a share link or a collaborator */
  applyState(st,opts){
    opts=opts||{};
    if(st.pages){ pages=clone(st.pages); pages.forEach(x=>ensureIds(x.boxes)); }
    else if(st.boxes){ pages=[{id:'pg_home',name:'Home',boxes:clone(st.boxes)}]; }
    pg=clamp(opts.keepPage?pg:(st.pg||0),0,pages.length-1); boxes=pages[pg].boxes;
    if('theme' in st){ theme=st.theme||''; $('themeSel').value=theme; }
    if(st.design){ design=Object.assign({},DEFAULT_DESIGN,st.design); syncDesignForm(); applyDesign(); }
    if('shareChrome' in st) shareChrome=st.shareChrome!==false;
    if(st.name&&!opts.keepName){ project.name=st.name; $('projName').textContent=st.name; }
    if(sel>=boxes.length) sel=-1;
    if(!opts.keepHistory){ hist=[clone(boxes)]; hi=0; syncHist(); }
    resize(); commit(false); syncPages(); scheduleSave();
  },
  state(){ syncPage(); return {name:project.name,theme,design:clone(design),shareChrome,pg,pages:clone(pages)}; },
  isBusy(){ return !!mode||holdRender; },
};

/* ============================================================ boot */
resize();
hist=[[]]; hi=0; syncHist();
syncDesignForm(); applyDesign();
commit(false); syncPages();
emit('ready');
const boot=/^#(s|live)=/.test(location.hash) ? Promise.resolve() : STORE.all().then(all=>{
  if(all&&all.length){ loadProject(all[0]); syncPages(); toast('Reopened "'+all[0].name+'"'); }
  else { project.id=uid(); $('projName').textContent=project.name; }
}).catch(()=>{ project.id=uid(); });
boot.then(()=>{ if(!project.id) project.id=uid(); emit('boot'); });
})();
