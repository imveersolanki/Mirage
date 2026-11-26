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
let lastRev = 0, pendingState = null, sendTimer = null;
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
    case 'hello': case 'want': if(synced) sendState(true); break;
    case 'state': applyRemote(msg); break;
    case 'cursor': if(!msg.ping){ Object.assign(people.get(msg.from), {x:msg.x, y:msg.y, pg:msg.pg}); M.paint(); } break;
    case 'bye': people.delete(msg.from); M.paint(); break;
  }
  drawPeople();
}

/* ------------------------------------------------------------ state sync */
function sendState(now){
  clearTimeout(sendTimer);
  const go = () => { const rev = Date.now(); lastRev = Math.max(lastRev, rev);
    send({t:'state', rev, name:me.name, color:me.color, state:M.state()}); };
  now ? go() : (sendTimer = setTimeout(go, 120));
}
function applyRemote(msg){
  if(msg.rev < lastRev) return;            // older than what we already have
  lastRev = msg.rev; synced = true;
  if(M.isBusy()){ pendingState = msg; return; }   // never yank a box out from under the mouse
  M.applyState(msg.state, {keepPage:true});
}
setInterval(() => {
  if(pendingState && !M.isBusy()){ const m = pendingState; pendingState = null; M.applyState(m.state, {keepPage:true}); }
}, 200);
M.on('change', () => { if(room && synced) sendState(false); });

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
  if(host) sendState(true);
  else setTimeout(() => { if(room===code && !synced) synced = true; }, 4000);  // nobody answered: this tab holds the sketch now
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
