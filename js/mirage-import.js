/* =====================================================================
   Mirage import: a photo of a paper sketch, or a screenshot, into boxes.
   Runs entirely in the browser on a downscaled copy of the image.
   ===================================================================== */
(() => {
'use strict';
const M = window.Mirage;
if(!M) return;
const $ = id => document.getElementById(id);

let mode = 'sketch', img = null, found = [], foundW = 1, foundH = 1, work = null;

/* ------------------------------------------------------------ helpers */
function toGray(cv){
  const ctx = cv.getContext('2d'), {width:w, height:h} = cv;
  const d = ctx.getImageData(0,0,w,h).data, g = new Float32Array(w*h);
  for(let i=0,j=0;i<g.length;i++,j+=4) g[i] = 0.299*d[j]+0.587*d[j+1]+0.114*d[j+2];
  return {g, d, w, h};
}
function scaled(image, max){
  const k = Math.min(1, max/Math.max(image.naturalWidth, image.naturalHeight));
  const cv = document.createElement('canvas');
  cv.width = Math.max(1, Math.round(image.naturalWidth*k)); cv.height = Math.max(1, Math.round(image.naturalHeight*k));
  const ctx = cv.getContext('2d', {willReadFrequently:true});
  ctx.fillStyle = '#fff'; ctx.fillRect(0,0,cv.width,cv.height);
  ctx.drawImage(image, 0, 0, cv.width, cv.height);
  return cv;
}

/* ------------------------------------------------------------ paper sketch
   1. adaptive threshold finds pen strokes (copes with shadows and uneven light)
   2. the page is straightened: the angle that makes ink line up best wins
   3. strokes are thickened by about half the pen width to close small gaps
   4. flood fill from the border marks the outside
   5. every enclosed region that is close to a rectangle is the inside of a box */
function inkMask(g, w, h){
  const I = new Float64Array((w+1)*(h+1));
  for(let y=0;y<h;y++){ let row=0; for(let x=0;x<w;x++){ row+=g[y*w+x]; I[(y+1)*(w+1)+x+1] = I[y*(w+1)+x+1] + row; } }
  const r = Math.max(6, Math.round(Math.max(w,h)/24)), C = 14;
  const ink = new Uint8Array(w*h);
  for(let y=0;y<h;y++) for(let x=0;x<w;x++){
    const x0=Math.max(0,x-r), y0=Math.max(0,y-r), x1=Math.min(w,x+r+1), y1=Math.min(h,y+r+1);
    const s = I[y1*(w+1)+x1]-I[y0*(w+1)+x1]-I[y1*(w+1)+x0]+I[y0*(w+1)+x0];
    if(g[y*w+x] < s/((x1-x0)*(y1-y0)) - C) ink[y*w+x] = 1;
  }
  return ink;
}
/* projection profile: rotate the ink points and keep the angle with the sharpest row and column peaks */
function skewAngle(ink, w, h){
  const pts = [];
  for(let y=0;y<h;y+=2) for(let x=0;x<w;x+=2) if(ink[y*w+x]) pts.push(x-w/2, y-h/2);
  if(pts.length < 200) return 0;
  const step = Math.max(2, Math.floor(pts.length/2/6000))*2;   // sample at most ~6000 points
  const score = deg => {
    const a = deg*Math.PI/180, c = Math.cos(a), s = Math.sin(a), D = Math.ceil(Math.hypot(w,h));
    const rows = new Float32Array(D), cols = new Float32Array(D);
    for(let i=0;i<pts.length;i+=step){ const x=pts[i], y=pts[i+1];
      rows[Math.round(-x*s+y*c+D/2)]++; cols[Math.round(x*c+y*s+D/2)]++; }
    let t = 0; for(let i=0;i<D;i++) t += rows[i]*rows[i] + cols[i]*cols[i];
    return t;
  };
  let best = 0, bs = score(0);
  for(let d=-12; d<=12; d+=1){ const v = score(d); if(v > bs){ bs = v; best = d; } }
  for(let d=best-0.9; d<=best+0.9; d+=0.15){ const v = score(d); if(v > bs){ bs = v; best = d; } }
  return Math.abs(best) < 0.4 ? 0 : Math.round(best*100)/100;
}
function rotated(cv, deg){
  const a = -deg*Math.PI/180, w = cv.width, h = cv.height;
  const c = document.createElement('canvas'); c.width = w; c.height = h;
  const x = c.getContext('2d', {willReadFrequently:true});
  x.fillStyle = '#fff'; x.fillRect(0,0,w,h);
  // fill the corners with the paper colour so they do not read as ink
  const d = cv.getContext('2d').getImageData(Math.floor(w/2), 2, 1, 1).data;
  x.fillStyle = 'rgb('+d[0]+','+d[1]+','+d[2]+')'; x.fillRect(0,0,w,h);
  x.translate(w/2, h/2); x.rotate(a); x.drawImage(cv, -w/2, -h/2);
  return c;
}
/* typical pen thickness: median horizontal run of ink */
function strokeWidth(ink, w, h){
  const runs = [];
  for(let y=0;y<h;y+=3){ let r=0; for(let x=0;x<w;x++){ if(ink[y*w+x]) r++; else if(r){ runs.push(r); r=0; } } }
  if(!runs.length) return 2;
  runs.sort((a,b)=>a-b); return runs[Math.floor(runs.length/2)];
}
function detectSketch(cv, sens, opts){
  opts = opts || {};
  let {g, w, h} = toGray(cv);
  let ink = inkMask(g, w, h), angle = 0;
  if(opts.straighten !== false){
    angle = skewAngle(ink, w, h);
    if(angle){ cv = rotated(cv, angle); ({g, w, h} = toGray(cv)); ink = inkMask(g, w, h); }
  }
  const sw = strokeWidth(ink, w, h), R = Math.max(1, Math.min(4, Math.round(sw/2)+1));
  /* bridge gaps along lines: a short run of paper between two inked pixels on the
     same row (or column) is filled. Hand-drawn boxes rarely close perfectly. */
  const L = Math.max(4, Math.round(Math.min(w,h)*0.035)), T = Math.max(3, Math.round(sw*1.5)+1);
  const closed = ink.slice();
  /* only bridge when the ink on both sides runs in the bridging direction: that is a broken
     line. Two parallel lines (a box edge and a child's edge) cross it only briefly. */
  /* a corner: at this pixel the ink also runs a long way across the bridging direction */
  const across = (x, y, horiz) => {
    let best = 0;
    for(let o=-1;o<=1;o++){
      const yy = horiz ? y : y+o, xx = horiz ? x+o : x;
      if(xx<0||yy<0||xx>=w||yy>=h) continue;
      let n = 0;
      if(horiz){ for(let k=yy;k>=0&&ink[k*w+xx];k--) n++; for(let k=yy+1;k<h&&ink[k*w+xx];k++) n++; }
      else { for(let k=xx;k>=0&&ink[yy*w+k];k--) n++; for(let k=xx+1;k<w&&ink[yy*w+k];k++) n++; }
      best = Math.max(best, n);
    }
    return best > sw*2+3;
  };
  const bridge = (len, at, step, base) => {
    const horiz = step===1;
    const pos = i => horiz ? [i, at] : [at, i];
    let run = 0, lastEnd = -1, lastRun = 0;
    for(let i=0;i<=len;i++){
      const on = i<len && ink[base+i*step];
      if(on){ run++; continue; }
      if(run){
        const start = i-run;
        if(lastEnd>=0 && start-lastEnd-1<=L && start-lastEnd>1 && lastRun>=T && run>=T &&
           !across(...pos(lastEnd), horiz) && !across(...pos(start), horiz))
          for(let k=lastEnd+1;k<start;k++) closed[base+k*step] = 1;
        lastEnd = i-1; lastRun = run; run = 0;
      }
    }
  };
  for(let y=0;y<h;y++) bridge(w, y, 1, y*w);
  for(let x=0;x<w;x++) bridge(h, x, w, x);
  ink = closed;
  const dil = new Uint8Array(w*h);
  for(let y=0;y<h;y++) for(let x=0;x<w;x++){
    if(!ink[y*w+x]) continue;
    for(let dy=-R;dy<=R;dy++) for(let dx=-R;dx<=R;dx++){
      const xx=x+dx, yy=y+dy; if(xx>=0&&yy>=0&&xx<w&&yy<h) dil[yy*w+xx]=1; }
  }
  const lab = new Int32Array(w*h);   // 0 unvisited, -1 outside, >0 region id
  const stack = new Int32Array(w*h);
  const fill = (seed, id) => {
    let sp=0, n=0, minx=w, miny=h, maxx=0, maxy=0;
    stack[sp++]=seed; lab[seed]=id;
    while(sp){
      const p = stack[--sp], x = p%w, y = (p/w)|0; n++;
      if(x<minx)minx=x; if(x>maxx)maxx=x; if(y<miny)miny=y; if(y>maxy)maxy=y;
      if(x>0 && !lab[p-1] && !dil[p-1]){ lab[p-1]=id; stack[sp++]=p-1; }
      if(x<w-1 && !lab[p+1] && !dil[p+1]){ lab[p+1]=id; stack[sp++]=p+1; }
      if(y>0 && !lab[p-w] && !dil[p-w]){ lab[p-w]=id; stack[sp++]=p-w; }
      if(y<h-1 && !lab[p+w] && !dil[p+w]){ lab[p+w]=id; stack[sp++]=p+w; }
    }
    return {id,n,minx,miny,maxx,maxy};
  };
  for(let x=0;x<w;x++){ if(!dil[x]&&!lab[x]) fill(x,-1); const b=(h-1)*w+x; if(!dil[b]&&!lab[b]) fill(b,-1); }
  for(let y=0;y<h;y++){ const a=y*w; if(!dil[a]&&!lab[a]) fill(a,-1); const b=a+w-1; if(!dil[b]&&!lab[b]) fill(b,-1); }
  const minSide = Math.max(w,h) * (0.006*sens + 0.01);
  const comps = []; let id = 1;
  for(let p=0;p<w*h;p++){
    if(lab[p] || dil[p]) continue;
    const c = fill(p, ++id);
    c.bw = c.maxx-c.minx+1; c.bh = c.maxy-c.miny+1;
    if(c.bw >= minSide && c.bh >= minSide) comps.push(c);
  }
  /* An X (or one diagonal) through a box is the wireframe sign for an image. It splits
     the inside into triangles whose bounding boxes overlap; join those back into one box. */
  const ov = (a,b) => { const ix = Math.min(a.maxx,b.maxx)-Math.max(a.minx,b.minx), iy = Math.min(a.maxy,b.maxy)-Math.max(a.miny,b.miny);
    return ix>0 && iy>0 ? ix*iy : 0; };
  const inside = (o,c) => c.minx>=o.minx-2 && c.miny>=o.miny-2 && c.maxx<=o.maxx+2 && c.maxy<=o.maxy+2;
  const groups = [];
  comps.forEach(c => {
    const g = groups.find(g => g.some(o => !inside(o,c) && !inside(c,o) && ov(o,c) > 0.15*Math.min(o.bw*o.bh, c.bw*c.bh)));
    g ? g.push(c) : groups.push([c]);
  });
  const merged = groups.map(g => {
    if(g.length===1) return g[0];
    const u = {minx:Math.min(...g.map(c=>c.minx)), miny:Math.min(...g.map(c=>c.miny)), maxx:Math.max(...g.map(c=>c.maxx)), maxy:Math.max(...g.map(c=>c.maxy)),
      n:g.reduce((t,c)=>t+c.n,0), ids:g.map(c=>c.id), crossed:true};
    u.bw = u.maxx-u.minx+1; u.bh = u.maxy-u.miny+1;
    return u;
  });
  /* rectangularity: a box's inside never contains the outside. Writing, letters and
     child boxes inside it are fine; an L shape or a gap to the outside is not. */
  const rects = [];
  merged.forEach(c => {
    let out = 0, area = c.bw*c.bh;
    for(let y=c.miny;y<=c.maxy;y+=2) for(let x=c.minx;x<=c.maxx;x+=2) if(lab[y*w+x]===-1) out++;
    const outside = out*4/area;
    if(outside > 0.08) return;
    // boxes drawn inside count as part of it, so a parent full of children still passes
    const held = merged.reduce((t,m) => m!==c && inside(c,m) ? t + (m.bw+2*R+2)*(m.bh+2*R+2) : t, 0);
    if((c.n+held)/area < 0.45) return;                 // mostly ink: a scribble, not a box
    rects.push({x:c.minx-R-1, y:c.miny-R-1, w:c.bw+2*R+2, h:c.bh+2*R+2, q:1-outside, hint:c.crossed?'image':null});
  });
  return {rects, angle, canvas:cv, stroke:sw};
}

/* ------------------------------------------------------------ screenshot
   XY-cut on differences, not raw colour: a row is compared with the row
   above it, so things that run the full height (grid lines, borders) cancel
   out. A sudden change across most of the width is a section edge. */
function detectShot(cv, sens){
  const {d, w, h} = toGray(cv);
  const P = (x,y) => (y*w+x)*4;
  const diff = (i,j) => Math.abs(d[i]-d[j])+Math.abs(d[i+1]-d[j+1])+Math.abs(d[i+2]-d[j+2]);
  const minGapY = Math.max(3, Math.round(h*0.0035*sens)), minGapX = Math.max(5, Math.round(w*0.006*sens));
  const fr = new Float32Array(h);
  for(let y=1;y<h;y++){ let c=0,n=0; for(let x=0;x<w;x+=2){ n++; if(diff(P(x,y),P(x,y-1))>30) c++; } fr[y]=c/n; }
  // a line shows up as a short run (1 to 3 rows) of near-total change; photos are long runs
  const edge = new Uint8Array(h);
  for(let y=1;y<h;y++){
    if(fr[y]<=0.6 || fr[y-1]>0.6) continue;
    let k=y; while(k<h && fr[k]>0.6) k++;
    if(k-y<=3) for(let j=y;j<k;j++) edge[j]=1;
  }
  const edgeY = y => edge[y]===1;
  const bands = [];
  let start = 0, gap = 0;
  for(let y=1;y<h;y++){
    if(edgeY(y)){
      if(y-start > minGapY*2 && !edge[y-1]) { bands.push([start, y]); start = y; }
      gap++; continue;
    }
    if(fr[y] <= 0.004){ gap++; continue; }
    if(gap >= minGapY*3 && y-gap-start > minGapY*2){ const cut = y-Math.floor(gap/2); bands.push([start, cut]); start = cut; }
    gap = 0;
  }
  bands.push([start, h]);
  // the grid cell is w/16; a band thinner than most of a cell would collide after snapping, so fold it into a neighbour
  const minH = (w/M.COLS)*0.75;
  for(let k=0;k<bands.length;){
    if(bands.length>1 && bands[k][1]-bands[k][0] < minH){
      if(k+1<bands.length){ bands[k+1][0]=bands[k][0]; bands.splice(k,1); }
      else { bands[k-1][1]=bands[k][1]; bands.splice(k,1); }
      k=Math.max(0,k-1);
    } else k++;
  }
  const rects = [];
  bands.forEach(([y0,y1]) => {
    const cf = new Float32Array(w), ny = Math.max(1, Math.ceil((y1-y0)/2));
    for(let x=1;x<w;x++){ let c=0; for(let y=y0;y<y1;y+=2) if(diff(P(x,y),P(x-1,y))>30) c++; cf[x]=c/ny; }
    const vedge = new Uint8Array(w);
    for(let x=1;x<w;x++){ if(cf[x]<=0.8 || cf[x-1]>0.8) continue; let k=x; while(k<w && cf[k]>0.8) k++; if(k-x<=3) for(let j=x;j<k;j++) vedge[j]=1; }
    const isEdge = x => vedge[x]===1;
    const busy = x => x>0 && cf[x]>0.01 && !isEdge(x);
    const segs = []; let s = -1, g = 0;
    for(let x=1;x<=w;x++){
      const b = x<w && busy(x);
      if(b){ if(s<0) s=x; g=0; }
      else if(s>=0){ g++; if(g>=minGapX || x===w){ segs.push([s, x-g+1]); s=-1; g=0; } }
    }
    const wide = segs.filter(sg => sg[1]-sg[0] > w*0.05);
    if(wide.length >= 2 && wide.length <= 8){
      const cuts = [0]; for(let k=1;k<wide.length;k++) cuts.push(Math.round((wide[k-1][1]+wide[k][0])/2)); cuts.push(w);
      for(let k=0;k<wide.length;k++) rects.push({x:cuts[k], y:y0, w:cuts[k+1]-cuts[k], h:y1-y0});
    } else rects.push({x:0, y:y0, w, h:y1-y0});
  });
  return rects;
}

/* ------------------------------------------------------------ UI */
function draw(){
  const cv = $('impCv'), ctx = cv.getContext('2d');
  if(!img){ ctx.clearRect(0,0,cv.width,cv.height); return; }
  const k = Math.min(cv.width/work.width, 1e9);
  cv.height = Math.round(work.height*k);
  ctx.drawImage(work, 0, 0, cv.width, cv.height);
  ctx.fillStyle = 'rgba(255,255,255,.35)'; ctx.fillRect(0,0,cv.width,cv.height);
  ctx.lineWidth = 2; ctx.font = '500 10px "IBM Plex Mono", monospace';
  const cellPx = cv.width / M.COLS;
  found.forEach(b => {
    const off = excluded.has(b.id);
    ctx.setLineDash(off ? [5,5] : []);
    ctx.strokeStyle = off ? 'rgba(110,110,110,.7)' : (b.pid ? '#1F5F8B' : '#E30613');
    ctx.strokeRect(b.cx*cellPx+1, b.cy*cellPx+1, b.cw*cellPx-2, b.ch*cellPx-2);
    if(b.label && !off){ ctx.fillStyle = '#141C22'; ctx.fillRect(b.cx*cellPx+3, b.cy*cellPx+3, ctx.measureText(b.label).width+8, 14);
      ctx.fillStyle = '#fff'; ctx.fillText(b.label, b.cx*cellPx+7, b.cy*cellPx+13); }
  });
  ctx.setLineDash([]);
}
let excluded = new Set(), lastAngle = 0;
function analyse(){
  if(!img) return;
  const sens = +$('impMin').value;
  work = scaled(img, mode==='sketch' ? 640 : 900);
  let rects;
  if(mode==='sketch'){
    const r = detectSketch(work, sens, {straighten: $('impStraight').checked});
    rects = r.rects; work = r.canvas; lastAngle = r.angle;
  } else { rects = detectShot(work, sens); lastAngle = 0; }
  // map to the content area so paper margins do not count as page
  if(mode==='sketch' && rects.length){
    const x0 = Math.max(0, Math.min(...rects.map(r=>r.x))), x1 = Math.max(...rects.map(r=>r.x+r.w));
    const y0 = Math.max(0, Math.min(...rects.map(r=>r.y)));
    rects = rects.map(r => ({x:r.x-x0, y:r.y-y0, w:r.w, h:r.h}));
    foundW = x1-x0;
    const c2 = document.createElement('canvas'); c2.width = Math.max(1,foundW); c2.height = Math.max(1, Math.max(...rects.map(r=>r.y+r.h)));
    c2.getContext('2d').drawImage(work, x0, y0, c2.width, c2.height, 0, 0, c2.width, c2.height);
    work = c2;
  } else foundW = work.width;
  found = M.rectsToBoxes(rects, foundW);
  excluded = new Set();
  stat(); draw();
}
function stat(){
  const keep = found.filter(b => !excluded.has(b.id));
  const kids = keep.filter(b=>b.pid).length;
  $('impStat').textContent = keep.length
    ? keep.length+' box'+(keep.length>1?'es':'')+(kids?' ('+kids+' nested)':'')+(lastAngle?' · straightened '+lastAngle+'°':'')+(excluded.size?' · '+excluded.size+' removed':'')+' · tap a box to drop it'
    : 'no boxes found, try the other mode or a lower sensitivity';
}
/* tap a detection in the preview to drop it (and its children) */
$('impCv').addEventListener('click', e => {
  if(!found.length) return;
  const r = e.target.getBoundingClientRect(), cell = r.width/M.COLS;
  const gx = (e.clientX-r.left)/cell, gy = (e.clientY-r.top)/cell;
  const hits = found.filter(b => gx>=b.cx && gx<=b.cx+b.cw && gy>=b.cy && gy<=b.cy+b.ch).sort((a,b) => a.cw*a.ch-b.cw*b.ch);
  if(!hits.length) return;
  const b = hits[0];
  const toggle = id => excluded.has(id) ? excluded.delete(id) : excluded.add(id);
  const was = excluded.has(b.id); toggle(b.id);
  found.filter(k => k.pid===b.id).forEach(k => was ? excluded.delete(k.id) : excluded.add(k.id));
  stat(); draw();
});
function load(file){
  if(!file || !/^image\//.test(file.type)){ M.toast('That is not an image'); return; }
  const url = URL.createObjectURL(file), im = new Image();
  im.onload = () => { img = im; analyse(); URL.revokeObjectURL(url); };
  im.onerror = () => M.toast('Could not read that image');
  im.src = url;
}
M.importDetect = {detectSketch, detectShot, scaled, skewAngle, inkMask, toGray, rotated};
M.importImage = (image, m) => { mode = m||mode; img = image; analyse(); return found; };
M.importState = () => ({found, excluded:[...excluded], angle:lastAngle});  // for tests and other modules

[...$('impMode').children].forEach(b => b.onclick = () => {
  [...$('impMode').children].forEach(x => x.classList.toggle('on', x===b));
  mode = b.dataset.m;
  $('impHint').textContent = mode==='sketch'
    ? 'A photo of boxes drawn on paper or a whiteboard. Dark lines on a light background work best.'
    : 'A screenshot of any web page. Mirage splits it into bands and columns.';
  analyse();
});
$('impMin').addEventListener('input', () => { $('impMinV').textContent = $('impMin').value; analyse(); });
$('impFile').addEventListener('change', e => load(e.target.files[0]));
const drop = $('impDrop');
['dragenter','dragover'].forEach(ev => drop.addEventListener(ev, e => { e.preventDefault(); drop.classList.add('over'); }));
['dragleave','drop'].forEach(ev => drop.addEventListener(ev, e => { e.preventDefault(); drop.classList.remove('over'); }));
drop.addEventListener('drop', e => load(e.dataTransfer.files[0]));
document.addEventListener('paste', e => {
  if(!$('mImport').classList.contains('on')) return;
  const it = [...(e.clipboardData||{}).items||[]].find(i => /^image\//.test(i.type));
  if(it){ e.preventDefault(); load(it.getAsFile()); }
});
function use(asPage){
  if(!found.length){ M.toast('Nothing to import yet'); return; }
  if(asPage) M.addPage(mode==='sketch' ? 'From sketch' : 'From screenshot');
  M.boxes = found.filter(b => !excluded.has(b.id)).map(b => { const o = {...b}; delete o.label;
    if(b.type){ o.type = b.type; o.locked = true; } return o; });
  M.sel = -1; M.resize(); M.commit(true); M.syncPages();
  $('mImport').classList.remove('on');
  M.toast('Imported '+found.length+' boxes'+(asPage?' as a new page':'')+' · ⌘Z to undo', 2800);
}
$('bImpUse').onclick = () => use(false);
$('bImpPage').onclick = () => use(true);
$('bImport').onclick = () => $('mImport').classList.add('on');
$('bImpCam').onclick = () => $('impCam').click();
$('impCam').addEventListener('change', e => { mode='sketch'; [...$('impMode').children].forEach(x => x.classList.toggle('on', x.dataset.m==='sketch')); load(e.target.files[0]); });
$('impStraight').addEventListener('change', analyse);

/* Gemini reads handwritten labels inside the detected boxes */
$('bImpAI').onclick = async () => {
  const out = $('impAIOut');
  if(!found.length){ out.textContent = 'Import an image first.'; return; }
  if(!M.gemini){ out.textContent = 'The AI panel is not available.'; return; }
  const types = M.TYPES.map(t => t[0]).concat(M.components.map(c => c.key));
  const list = found.filter(b => !excluded.has(b.id)).map((b,i) => ({i:found.indexOf(b), x:b.cx, y:b.cy, w:b.cw, h:b.ch, inside:b.pid?found.indexOf(found.find(p=>p.id===b.pid)):null}));
  const c = document.createElement('canvas'), k = Math.min(1, 1024/Math.max(work.width, work.height));
  c.width = Math.round(work.width*k); c.height = Math.round(work.height*k);
  c.getContext('2d').drawImage(work, 0, 0, c.width, c.height);
  out.textContent = 'Reading…';
  try{
    const ans = await M.gemini(
      'This is a photo of a hand-drawn website wireframe. The page is '+M.COLS+' grid columns wide; each box below is given in grid cells (x, y, w, h) measured from the top-left of the drawing.\n'+
      'Boxes: '+JSON.stringify(list)+'\n'+
      'For each box, read any handwritten word or symbol inside it (for example "nav", "hero", "img", an X through it meaning image, "pricing", "form", "footer") and map it to one of these types: '+JSON.stringify(types)+'. '+
      'If a box has no readable label, leave it out. Answer as JSON: {"boxes":[{"i":<box i>,"type":"<one of the types>","read":"<what you read>"}]}',
      c.toDataURL('image/jpeg', 0.85));
    let n = 0;
    (ans.boxes||[]).forEach(a => { const b = found[a.i]; if(b && types.indexOf(a.type)>=0){ b.type = a.type; b.label = (M.NICE[a.type]||a.type); n++; } });
    out.textContent = n ? 'Read '+n+' label'+(n>1?'s':'')+'. Those boxes keep that type when imported.' : 'No labels found.';
    draw();
  }catch(err){ out.textContent = 'Could not read labels: '+err.message; }
};
})();
