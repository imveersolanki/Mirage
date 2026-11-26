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
   1. adaptive threshold finds pen strokes
   2. strokes are thickened slightly to close small gaps in hand-drawn lines
   3. flood fill from the border marks the outside
   4. every remaining enclosed region is the inside of a drawn box */
function detectSketch(cv, sens){
  const {g, w, h} = toGray(cv);
  // integral image for local mean
  const I = new Float64Array((w+1)*(h+1));
  for(let y=0;y<h;y++){ let row=0; for(let x=0;x<w;x++){ row+=g[y*w+x]; I[(y+1)*(w+1)+x+1] = I[y*(w+1)+x+1] + row; } }
  const r = Math.max(6, Math.round(Math.max(w,h)/24)), C = 14;
  const ink = new Uint8Array(w*h);
  for(let y=0;y<h;y++) for(let x=0;x<w;x++){
    const x0=Math.max(0,x-r), y0=Math.max(0,y-r), x1=Math.min(w,x+r+1), y1=Math.min(h,y+r+1);
    const s = I[y1*(w+1)+x1]-I[y0*(w+1)+x1]-I[y1*(w+1)+x0]+I[y0*(w+1)+x0];
    const mean = s/((x1-x0)*(y1-y0));
    if(g[y*w+x] < mean - C) ink[y*w+x] = 1;
  }
  // dilate (closes gaps up to ~2px at this scale)
  const dil = new Uint8Array(w*h), R = 2;
  for(let y=0;y<h;y++) for(let x=0;x<w;x++){
    if(!ink[y*w+x]) continue;
    for(let dy=-R;dy<=R;dy++) for(let dx=-R;dx<=R;dx++){
      const xx=x+dx, yy=y+dy; if(xx>=0&&yy>=0&&xx<w&&yy<h) dil[yy*w+xx]=1; }
  }
  // label open regions
  const lab = new Int32Array(w*h); // 0 unvisited, -1 outside, >0 region id
  const stack = new Int32Array(w*h);
  const fill = (seed, id) => {
    let sp=0, n=0, minx=w, miny=h, maxx=0, maxy=0;
    stack[sp++]=seed; lab[seed]=id;
    while(sp){
      const p = stack[--sp], x = p%w, y = (p/w)|0; n++;
      if(x<minx)minx=x; if(x>maxx)maxx=x; if(y<miny)miny=y; if(y>maxy)maxy=y;
      const nb = [x>0?p-1:-1, x<w-1?p+1:-1, y>0?p-w:-1, y<h-1?p+w:-1];
      for(const q of nb) if(q>=0 && !lab[q] && !dil[q]){ lab[q]=id; stack[sp++]=q; }
    }
    return {n,minx,miny,maxx,maxy};
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
  // a parent box is a ring around its children, so count boxes it encloses as part of it
  const within = (o,c) => c!==o && c.minx>=o.minx && c.miny>=o.miny && c.maxx<=o.maxx && c.maxy<=o.maxy;
  const rects = [];
  comps.forEach(c => {
    const held = comps.filter(k => within(c,k)).reduce((n,k) => n + (k.bw+2*R+2)*(k.bh+2*R+2), 0);
    if((c.n + held) / (c.bw*c.bh) < 0.55) return;      // ragged blobs are not boxes
    // grow back out by the stroke thickness so neighbours touch like they were drawn
    rects.push({x:c.minx-R-1, y:c.miny-R-1, w:c.bw+2*R+2, h:c.bh+2*R+2});
  });
  return rects;
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
  found.forEach((b,i) => {
    ctx.strokeStyle = b.pid ? '#1F5F8B' : '#E30613';
    ctx.strokeRect(b.cx*cellPx+1, b.cy*cellPx+1, b.cw*cellPx-2, b.ch*cellPx-2);
  });
}
function analyse(){
  if(!img) return;
  const sens = +$('impMin').value;
  work = scaled(img, mode==='sketch' ? 640 : 900);
  let rects = mode==='sketch' ? detectSketch(work, sens) : detectShot(work, sens);
  // map to the content area so paper margins do not count as page
  if(mode==='sketch' && rects.length){
    const x0 = Math.min(...rects.map(r=>r.x)), x1 = Math.max(...rects.map(r=>r.x+r.w));
    const y0 = Math.min(...rects.map(r=>r.y));
    rects = rects.map(r => ({x:r.x-x0, y:r.y-y0, w:r.w, h:r.h}));
    foundW = x1-x0;
    // re-crop the preview to match
    const c2 = document.createElement('canvas'); c2.width = Math.max(1,foundW); c2.height = Math.max(1, Math.max(...rects.map(r=>r.y+r.h)));
    c2.getContext('2d').drawImage(work, x0, y0, c2.width, c2.height, 0, 0, c2.width, c2.height);
    work = c2;
  } else foundW = work.width;
  found = M.rectsToBoxes(rects, foundW);
  const tops = found.filter(b=>!b.pid).length, kids = found.length - tops;
  $('impStat').textContent = found.length ? found.length+' box'+(found.length>1?'es':'')+' found'+(kids?' ('+kids+' nested)':'') : 'no boxes found, try the other mode or a lower sensitivity';
  draw();
}
function load(file){
  if(!file || !/^image\//.test(file.type)){ M.toast('That is not an image'); return; }
  const url = URL.createObjectURL(file), im = new Image();
  im.onload = () => { img = im; analyse(); URL.revokeObjectURL(url); };
  im.onerror = () => M.toast('Could not read that image');
  im.src = url;
}
M.importDetect = {detectSketch, detectShot, scaled};
M.importImage = (image, m) => { mode = m||mode; img = image; analyse(); return found; };  // for tests and other modules

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
  M.boxes = found.map(b => ({...b})); M.sel = -1; M.resize(); M.commit(true); M.syncPages();
  $('mImport').classList.remove('on');
  M.toast('Imported '+found.length+' boxes'+(asPage?' as a new page':'')+' · ⌘Z to undo', 2800);
}
$('bImpUse').onclick = () => use(false);
$('bImpPage').onclick = () => use(true);
$('bImport').onclick = () => $('mImport').classList.add('on');
})();
