/* =====================================================================
   Mirage live: sketch together with named cursors.
   Same device: BroadcastChannel. Other devices: WebRTC through PeerJS
   (loaded only when a session starts). No Mirage server anywhere.
   Model: whole-project state, last writer wins. Projects are small.
   ===================================================================== */
(() => {
'use strict';
const M = window.Mirage;
if(!M) return;
const $ = id => document.getElementById(id);
const LS = {get:k=>{ try{ return localStorage.getItem(k); }catch(_){ return null; } }, set:(k,v)=>{ try{ localStorage.setItem(k,v); }catch(_){} }};

const COLORS = ['#C96A5E','#57806A','#1F5F8B','#8A5CB8','#C28A1E','#2E8C8C','#B5487A','#4E5BB8'];
const me = {
  id: Math.random().toString(36).slice(2,10),
  name: LS.get('mirage.liveName') || ('Guest '+Math.floor(10+Math.random()*89)),
  color: COLORS[Math.floor(Math.random()*COLORS.length)],
};
const PEERJS = 'https://unpkg.com/peerjs@1.5.4/dist/peerjs.min.js';
let room = null, bc = null, peer = null, conns = [], isHost = false;
let sendTimer = null;
let synced = false;   // only someone already holding the sketch answers newcomers, so a blank joiner never wipes it
const people = new Map();   // id -> {name,color,x,y,pg,seen}

/* ------------------------------------------------------------ transport */
function send(msg, except){
  msg.from = msg.from || me.id;
  if(bc) bc.postMessage(msg);
  const raw = JSON.stringify(msg);
  conns.forEach(c => { if(c.open && c !== except) try{ c.send(raw); }catch(_){} });
}
function receive(msg, via){
  if(!msg || msg.from===me.id) return;
  // the host relays remote traffic so every peer sees every peer
  if(isHost && via) send(msg, via);
  const p = people.get(msg.from) || {};
  people.set(msg.from, Object.assign(p, {name:msg.name||p.name||'Someone', color:msg.color||p.color||'#888', seen:Date.now()}));
  switch(msg.t){
    case 'hello': case 'want': if(synced) sendState(); break;
    case 'state': if(!synced) applyFull(msg); break;
    case 'ops': if(synced) applyOps(msg.ops); break;
    case 'cursor': if(!msg.ping){ Object.assign(people.get(msg.from), {x:msg.x, y:msg.y, pg:msg.pg}); M.paint(); } break;
    case 'bye': people.delete(msg.from); M.paint(); break;
  }
  drawPeople();
}

/* ------------------------------------------------------------ state sync
   Per-box merge. Every box, the page list and the document settings carry a
   version [clock, client]. Local edits are found by diffing against a shadow
   copy; only changed boxes travel. Deletes leave a tombstone. When two people
   edit the same box at once, the later clock wins for that box only. */
let clock = 0;
const ver = {};          // key -> [clock, client]; keys: 'b:<page>:<box>', 'pages', 'doc'
const shadow = {};       // same keys -> JSON of what we last saw
const tomb = {};         // 'b:<page>:<box>' -> version of the delete
const sentAssets = new Set();
const newer = (a, b) => !b || a[0] > b[0] || (a[0]===b[0] && a[1] > b[1]);
const tick = () => [++clock, me.id];
const seeClock = v => { if(v && v[0] > clock) clock = v[0]; };
const pageList = st => st.pages.map(p => ({id:p.id, name:p.name}));
const docOf = st => ({theme:st.theme, design:st.design, shareChrome:st.shareChrome, components:st.components, pageMeta:st.pageMeta, name:st.name});
const boxJSON = b => JSON.stringify(b);

/* compare the live project with the shadow and stamp whatever changed */
function diff(){
  const st = M.state(), ops = {boxes:[], dels:[], assets:{}};
  const seen = new Set();
  st.pages.forEach(p => p.boxes.forEach(b => {
    const k = 'b:'+p.id+':'+b.id, j = boxJSON(b); seen.add(k);
    if(shadow[k] !== j){ shadow[k] = j; ver[k] = tick(); delete tomb[k]; ops.boxes.push({p:p.id, b, v:ver[k]});
      b.c && Object.keys(b.c).forEach(f => { const r = b.c[f]; if(/:src$/.test(f) && /^asset:/.test(r||'')){ const id = r.slice(6);
        if(!sentAssets.has(id) && st.assets[id]){ ops.assets[id] = st.assets[id]; sentAssets.add(id); } } });
    }
  }));
  Object.keys(shadow).forEach(k => { if(k.startsWith('b:') && !seen.has(k)){ delete shadow[k]; tomb[k] = tick(); ops.dels.push({k, v:tomb[k]}); } });
  const pl = JSON.stringify(pageList(st)); if(shadow.pages !== pl){ shadow.pages = pl; ver.pages = tick(); ops.pages = {list:pageList(st), v:ver.pages}; }
  const dc = JSON.stringify(docOf(st)); if(shadow.doc !== dc){ shadow.doc = dc; ver.doc = tick(); ops.doc = {data:docOf(st), v:ver.doc}; }
  return ops;
}
const empty = o => !o.boxes.length && !o.dels.length && !o.pages && !o.doc;
/* take a remote snapshot as the new baseline without stamping anything */
function baseline(st){
  Object.keys(shadow).forEach(k => delete shadow[k]);
  st.pages.forEach(p => p.boxes.forEach(b => { shadow['b:'+p.id+':'+b.id] = boxJSON(b); }));
  shadow.pages = JSON.stringify(pageList(st)); shadow.doc = JSON.stringify(docOf(st));
}

function sendOps(now){
  clearTimeout(sendTimer);
  const go = () => { const o = diff(); if(!empty(o)) send({t:'ops', name:me.name, color:me.color, ops:o}); };
  now ? go() : (sendTimer = setTimeout(go, 90));
}
/* full snapshot for someone who just joined */
function sendState(){
  diff();
  send({t:'state', name:me.name, color:me.color, state:M.state(), ver:{...ver}, tomb:{...tomb}, clock});
}

function applyOps(o){
  if(M.isBusy()){ pendingOps.push(o); return; }
  sendOps(true);   // flush our own unsent edits first so the new baseline cannot swallow them
  const st = M.state();
  let changed = false;
  const pageById = id => st.pages.find(p => p.id===id);
  if(o.pages && newer(o.pages.v, ver.pages)){
    seeClock(o.pages.v); ver.pages = o.pages.v;
    const next = o.pages.list.map(x => { const ex = pageById(x.id); return ex ? Object.assign(ex, {name:x.name}) : {id:x.id, name:x.name, boxes:[]}; });
    st.pages = next.length ? next : st.pages; changed = true;
  }
  (o.boxes||[]).forEach(({p, b, v}) => {
    seeClock(v);
    const k = 'b:'+p+':'+b.id;
    if(!newer(v, ver[k]) || (tomb[k] && !newer(v, tomb[k]))) return;
    ver[k] = v; delete tomb[k];
    let page = pageById(p); if(!page){ page = {id:p, name:'Page', boxes:[]}; st.pages.push(page); }
    const at = page.boxes.findIndex(x => x.id===b.id);
    if(at>=0) page.boxes[at] = b; else page.boxes.push(b);
    changed = true;
  });
  (o.dels||[]).forEach(({k, v}) => {
    seeClock(v);
    if(ver[k] && !newer(v, ver[k])) return;
    tomb[k] = v; delete ver[k];
    const [, p, id] = k.split(':'); const page = pageById(p);
    if(page){ const n = page.boxes.length; page.boxes = page.boxes.filter(x => x.id!==id); changed = changed || n!==page.boxes.length; }
  });
  if(o.doc && newer(o.doc.v, ver.doc)){ seeClock(o.doc.v); ver.doc = o.doc.v; Object.assign(st, o.doc.data); changed = true; }
  if(o.assets) st.assets = Object.assign({}, st.assets, o.assets);
  if(!changed && !o.assets) return;
  // children whose parent vanished go back to the top level instead of disappearing
  st.pages.forEach(p => { const ids = new Set(p.boxes.map(b => b.id)); p.boxes.forEach(b => { if(b.pid && !ids.has(b.pid)) delete b.pid; }); });
  M.applyState(st, {keepPage:true, keepName:false});
  baseline(M.state());
}
let pendingOps = [];
setInterval(() => {
  if(pendingOps.length && !M.isBusy()){ const q = pendingOps; pendingOps = []; q.forEach(applyOps); }
}, 150);
function applyFull(msg){
  seeClock([msg.clock||0]);
  Object.assign(ver, msg.ver||{}); Object.assign(tomb, msg.tomb||{});
  M.applyState(msg.state, {keepPage:false});
  baseline(M.state()); synced = true;
}
M.on('change', () => { if(room && synced) sendOps(false); });

/* ------------------------------------------------------------ cursors */
let lastCur = 0;
M.canvas.addEventListener('pointermove', e => {
  if(!room) return;
  const t = performance.now(); if(t-lastCur < 50) return; lastCur = t;
  const p = M.cellAt(e);
  send({t:'cursor', name:me.name, color:me.color, x:+p.x.toFixed(2), y:+p.y.toFixed(2), pg:M.pg});
});
M.on('paint', ({ctx, cell}) => {
  if(!room) return;
  people.forEach(p => {
    if(p.x==null || p.pg!==M.pg) return;
    const x = p.x*cell, y = p.y*cell;
    ctx.save();
    ctx.fillStyle = p.color; ctx.strokeStyle = '#fff'; ctx.lineWidth = 1.2;
    ctx.beginPath(); ctx.moveTo(x,y); ctx.lineTo(x+12.4,y+12.4); ctx.lineTo(x+6.8,y+12.9); ctx.lineTo(x+3.4,y+18); ctx.closePath();
    ctx.fill(); ctx.stroke();
    ctx.font = '500 10px "IBM Plex Mono", monospace';
    const tw = ctx.measureText(p.name).width;
    ctx.fillRect(x+11, y+16, tw+12, 16);
    ctx.fillStyle = '#fff'; ctx.textBaseline = 'middle'; ctx.fillText(p.name, x+17, y+24);
    ctx.restore();
  });
});

/* ------------------------------------------------------------ presence */
setInterval(() => {
  if(!room) return;
  send({t:'cursor', name:me.name, color:me.color, x:null, y:null, pg:M.pg, ping:1});
  const now = Date.now(); let gone = false;
  people.forEach((p,id) => { if(now-p.seen > 9000){ people.delete(id); gone = true; } });
  if(gone){ drawPeople(); M.paint(); }
}, 3000);
function drawPeople(){
  const list = [[me.name+' (you)', me.color]].concat([...people.values()].map(p => [p.name, p.color]));
  $('livePeople').innerHTML = list.map(([n,c]) => '<span style="background:'+c+'">'+M.esc(n)+'</span>').join('');
  $('liveStat').textContent = people.size ? (people.size+' other'+(people.size>1?'s':'')+' here') :
    'Waiting for someone to join. Share the link.';
}

/* ------------------------------------------------------------ PeerJS (remote) */
function loadPeer(){
  if(window.Peer) return Promise.resolve();
  return new Promise((res, rej) => {
    const s = document.createElement('script'); s.src = PEERJS; s.async = true;
    s.onload = res; s.onerror = () => rej(new Error('Could not load PeerJS'));
    document.head.appendChild(s);
  });
}
function wire(conn){
  conn.on('open', () => { conns.push(conn); conn.send(JSON.stringify({t:'hello', from:me.id, name:me.name, color:me.color})); });
  conn.on('data', d => { try{ receive(typeof d==='string' ? JSON.parse(d) : d, conn); }catch(_){} });
  conn.on('close', () => { conns = conns.filter(c => c!==conn); });
}
async function remote(host){
  try{ await loadPeer(); }catch(err){ $('liveStat').textContent = 'Other devices cannot join right now ('+err.message+'). Tabs on this device still sync.'; return; }
  const hostId = 'mirage-live-'+room;
  if(host){
    peer = new window.Peer(hostId);
    peer.on('connection', wire);
    peer.on('error', err => {
      // someone else already hosts this room: join them instead
      if(err.type==='unavailable-id'){ try{ peer.destroy(); }catch(_){} isHost = false; remote(false); }
      else $('liveStat').textContent = 'Remote link: '+err.type+'. Tabs on this device still sync.';
    });
    isHost = true;
  } else {
    peer = new window.Peer();
    peer.on('open', () => { const c = peer.connect(hostId, {reliable:true}); wire(c); c.on('open', () => c.send(JSON.stringify({t:'want', from:me.id, name:me.name, color:me.color}))); });
    peer.on('error', err => { $('liveStat').textContent = 'Could not reach the host ('+err.type+'). Tabs on this device still sync.'; });
  }
}

/* ------------------------------------------------------------ session */
const inviteUrl = () => location.origin + location.pathname + '#live=' + room;
function start(code, host){
  if(room) leave(true);
  room = code; synced = !!host;
  bc = 'BroadcastChannel' in window ? new BroadcastChannel('mirage-live-'+room) : null;
  if(bc) bc.onmessage = e => receive(e.data, null);
  history.replaceState(null, '', '#live='+room);
  $('liveOff').hidden = true; $('liveOn').hidden = false; $('liveUrl').value = inviteUrl();
  $('liveDot').classList.add('on');
  drawPeople();
  send({t: host ? 'hello' : 'want', name:me.name, color:me.color});
  if(host){ baseline(M.state()); sendState(); }
  else setTimeout(() => { if(room===code && !synced){ synced = true; baseline(M.state()); } }, 4000);  // nobody answered: this tab holds the sketch now
  remote(host);
}
function leave(quiet){
  if(!room) return;
  send({t:'bye'});
  if(bc) bc.close(); bc = null;
  conns.forEach(c => { try{ c.close(); }catch(_){} }); conns = [];
  if(peer) try{ peer.destroy(); }catch(_){}
  peer = null; room = null; isHost = false; people.clear();
  history.replaceState(null, '', location.pathname);
  $('liveOff').hidden = false; $('liveOn').hidden = true; $('liveDot').classList.remove('on');
  M.paint();
  if(!quiet) M.toast('Left the live session');
}
const newRoom = () => Array.from(crypto.getRandomValues(new Uint8Array(6)), b => 'abcdefghjkmnpqrstuvwxyz23456789'[b%31]).join('');
function codeFrom(s){ const m = (s||'').match(/live=([a-z0-9]+)/i) || (s||'').match(/^\s*([a-z0-9]{4,})\s*$/i); return m ? m[1].toLowerCase() : null; }

$('liveName').value = me.name;
$('liveName').addEventListener('input', e => { me.name = e.target.value.trim().slice(0,20) || me.name; LS.set('mirage.liveName', me.name); drawPeople(); });
['liveName','liveJoinIn'].forEach(id => $(id).addEventListener('keydown', e => e.stopPropagation()));
$('bLive').onclick = () => $('mLive').classList.add('on');
$('bLiveStart').onclick = () => { start(newRoom(), true); M.toast('Live. Copy the invite link to share it.'); };
$('bLiveJoin').onclick = () => {
  const c = codeFrom($('liveJoinIn').value);
  if(!c){ M.toast('That is not an invite link or room code'); return; }
  M.newProject(); start(c, false);
};
$('bLiveCopy').onclick = () => { navigator.clipboard && navigator.clipboard.writeText($('liveUrl').value).then(() => M.toast('Invite link copied')); };
$('bLiveLeave').onclick = () => leave(false);
addEventListener('pagehide', () => { if(room) send({t:'bye'}); });

/* opened from an invite link */
const fromUrl = codeFrom(location.hash);
if(/^#live=/.test(location.hash) && fromUrl){
  M.newProject();
  start(fromUrl, false);
  M.toast('Joined a live session as '+me.name+'. Change your name in Live.', 3000);
}
M.live = {start, leave, get room(){ return room; }, get people(){ return people; }, me};
})();
