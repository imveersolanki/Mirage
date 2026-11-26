/* =====================================================================
   Mirage media: real images in Image and Gallery boxes.
   Images are downscaled in the browser and kept once per project as assets;
   boxes only hold "asset:<id>" so undo history and share links stay small.
   ===================================================================== */
(() => {
'use strict';
const M = window.Mirage;
if(!M) return;
const $ = id => document.getElementById(id);

/* downscale to at most 1600px and re-encode; WebP where supported */
function encode(file){
  return new Promise((res, rej) => {
    if(!file || !/^image\//.test(file.type)) return rej(new Error('Not an image'));
    if(file.type==='image/svg+xml') return rej(new Error('SVG is not supported, use PNG, JPEG or WebP'));
    const url = URL.createObjectURL(file), im = new Image();
    im.onload = () => {
      const k = Math.min(1, 1600/Math.max(im.naturalWidth, im.naturalHeight));
      const c = document.createElement('canvas');
      c.width = Math.round(im.naturalWidth*k); c.height = Math.round(im.naturalHeight*k);
      c.getContext('2d').drawImage(im, 0, 0, c.width, c.height);
      URL.revokeObjectURL(url);
      let out = c.toDataURL('image/webp', 0.84);
      if(!/^data:image\/webp/.test(out)) out = c.toDataURL('image/jpeg', 0.86);
      res(out);
    };
    im.onerror = () => { URL.revokeObjectURL(url); rej(new Error('Could not read that image')); };
    im.src = url;
  });
}
M.encodeImage = encode;

async function setImage(i, key, file){
  const b = M.boxes[i]; if(!b) return;
  try{
    const data = await encode(file);
    const ref = M.addAsset(data);
    b.c = b.c || {};
    b.c[key+':src'] = ref;
    if(!b.c[key+':alt']) b.c[key+':alt'] = (file.name||'').replace(/\.[a-z0-9]+$/i,'').replace(/[-_]+/g,' ').trim();
    M.commit(true);
    M.toast('Image added. Check the alt text in the inspector.', 2400);
  }catch(err){ M.toast(err.message); }
}
M.setImage = setImage;

/* ---------------- inspector */
const slotKeys = (type, n) => type==='gallery' ? Array.from({length:n}, (_,j) => 'gal'+j) : ['img'];
let curKey = 'img';
function sync(i){
  const fld = $('fldImg');
  if(i<0){ fld.hidden = true; return; }
  const c = M.classify().list[i], b = M.boxes[i];
  const ok = c.type==='image' || c.type==='gallery';
  fld.hidden = !ok; if(!ok) return;
  const keys = slotKeys(c.type, Math.max(2, Math.min(6, c.cells||3)));
  if(keys.indexOf(curKey)<0) curKey = keys[0];
  $('imgSlotRow').hidden = keys.length<2;
  $('imgSlot').innerHTML = keys.map((k,j) => '<option value="'+k+'"'+(k===curKey?' selected':'')+'>Tile '+(j+1)+((b.c&&b.c[k+':src'])?' · image':'')+'</option>').join('');
  $('imgAlt').value = (b.c && b.c[curKey+':alt']) || '';
  $('bImgDel').disabled = !(b.c && b.c[curKey+':src']);
}
M.on('select', sync);
$('imgSlot').onchange = e => { curKey = e.target.value; sync(M.sel); };
$('bImgPick').onclick = () => $('imgFile').click();
$('imgFile').onchange = e => { const f = e.target.files[0]; e.target.value=''; if(f) setImage(M.sel, curKey, f); };
$('bImgDel').onclick = () => {
  const b = M.boxes[M.sel]; if(!b || !b.c) return;
  delete b.c[curKey+':src']; delete b.c[curKey+':alt'];
  M.commit(true);
};
$('imgAlt').addEventListener('keydown', e => e.stopPropagation());
$('imgAlt').addEventListener('change', e => {
  const b = M.boxes[M.sel]; if(!b) return;
  b.c = b.c || {}; b.c[curKey+':alt'] = e.target.value.trim(); M.push(); M.render();
});

/* ---------------- drop straight onto the preview */
const sheet = $('sheet');
sheet.addEventListener('dragover', e => {
  const t = e.target.closest('[data-drop]'); if(!t) return;
  e.preventDefault(); sheet.querySelectorAll('.over').forEach(x => x!==t && x.classList.remove('over')); t.classList.add('over');
});
sheet.addEventListener('dragleave', e => { const t = e.target.closest('[data-drop]'); if(t) t.classList.remove('over'); });
sheet.addEventListener('drop', e => {
  const t = e.target.closest('[data-drop]'); if(!t) return;
  e.preventDefault(); t.classList.remove('over');
  const f = e.dataTransfer.files && e.dataTransfer.files[0];
  if(f){ curKey = t.dataset.dk; M.sel = +t.dataset.drop; M.syncSel(); setImage(+t.dataset.drop, t.dataset.dk, f); }
});

/* ---------------- unused assets are dropped on export of JSON / share */
M.usedAssets = state => {
  const used = new Set();
  (state.pages||[]).forEach(p => p.boxes.forEach(b => b.c && Object.keys(b.c).forEach(k => {
    if(/:src$/.test(k) && /^asset:/.test(b.c[k]||'')) used.add(b.c[k].slice(6)); })));
  if(state.pageMeta && state.pageMeta.pages) Object.values(state.pageMeta.pages).forEach(m => { if(m && /^asset:/.test(m.og||'')) used.add(m.og.slice(6)); });
  return used;
};
})();
