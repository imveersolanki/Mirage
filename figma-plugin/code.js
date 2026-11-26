/* Mirage for Figma: frames to Mirage sketches and back. No network access.
   Export: each selected frame becomes a page; rectangles and frames inside it become boxes
   on Mirage's 16-column grid (frames inside frames become nested boxes, one level deep).
   A layer named like a component ("Hero", "nav", "Pricing cards") sets that box's type. */
const COLS = 16, UNIT = 60;
const HINTS = [
  [/\bnav|header bar|menu\b/i, 'nav'], [/\bhero\b/i, 'hero'], [/\bfooter\b/i, 'footer'],
  [/\bgallery\b/i, 'gallery'], [/\b(img|image|photo|picture)\b/i, 'image'], [/\bcards?\b/i, 'cards'],
  [/\bside|sidebar|rail\b/i, 'sidebar'], [/\bstats?\b/i, 'stats'], [/\blogos?\b/i, 'logos'],
  [/\bquote|testimonial\b/i, 'quote'], [/\bform|contact\b/i, 'form'], [/\btable\b/i, 'table'],
  [/\btabs?\b/i, 'tabs'], [/\bpric(e|ing)\b/i, 'price'], [/\b(cta|banner)\b/i, 'banner'],
  [/\bcode\b/i, 'code'], [/\b(button|btn)\b/i, 'button'], [/\b(text|copy|prose|paragraph)\b/i, 'text'],
];
const NAMES = {nav:'Nav bar',hero:'Hero',cards:'Card grid',text:'Text block',image:'Image',gallery:'Gallery',sidebar:'Side nav',
  stats:'Stat row',logos:'Logo row',quote:'Quote',form:'Form',table:'Table',tabs:'Tabs',price:'Pricing',banner:'CTA banner',
  code:'Code block',button:'Button',footer:'Footer',group:'Group'};
const hint = name => { for(const [re, t] of HINTS) if(re.test(name||'')) return t; return null; };
const id = () => 'b' + Math.random().toString(36).slice(2, 9);
const BOXY = n => n.visible !== false && (n.type === 'RECTANGLE' || n.type === 'FRAME' || n.type === 'COMPONENT' || n.type === 'INSTANCE' || n.type === 'GROUP');

function frameToPage(frame){
  const fb = frame.absoluteBoundingBox, cell = fb.width / COLS;
  const snap = b => {
    const cx = Math.max(0, Math.round((b.x - fb.x) / cell)), cy = Math.max(0, Math.round((b.y - fb.y) / cell));
    const cw = Math.max(1, Math.min(COLS - cx, Math.round((b.x + b.width - fb.x) / cell) - cx));
    return {cx, cy, cw, ch: Math.max(1, Math.round((b.y + b.height - fb.y) / cell) - cy)};
  };
  const boxes = [];
  const add = (node, pid) => {
    const bb = node.absoluteBoundingBox; if(!bb || bb.width < cell*0.5 || bb.height < cell*0.5) return null;
    const b = Object.assign({id: id()}, snap(bb));
    if(pid) b.pid = pid;
    const t = hint(node.name); if(t){ b.type = t; b.locked = true; }
    boxes.push(b); return b;
  };
  ('children' in frame ? frame.children : []).filter(BOXY).forEach(n => {
    const b = add(n, null);
    if(b && 'children' in n && n.type !== 'INSTANCE') n.children.filter(BOXY).forEach(k => add(k, b.id));
  });
  // a parent with children is a group in Mirage: its own type comes from the children
  boxes.forEach(b => { if(boxes.some(k => k.pid === b.id)){ delete b.type; delete b.locked; } });
  return {id: 'pg_' + Math.random().toString(36).slice(2, 8), name: frame.name, boxes};
}

async function pagesToFrames(sketch){
  await figma.loadFontAsync({family: 'Inter', style: 'Regular'});
  const made = [];
  let x = figma.viewport.center.x - (COLS * UNIT) / 2;
  for(const page of sketch.pages || []){
    const H = Math.max(4, ...page.boxes.map(b => b.cy + b.ch)) * UNIT;
    const f = figma.createFrame();
    f.name = page.name || 'Page'; f.resize(COLS * UNIT, H); f.x = x; f.y = figma.viewport.center.y - H / 2;
    f.fills = [{type: 'SOLID', color: {r: .98, g: .98, b: .98}}];
    const byId = {};
    const ordered = page.boxes.slice().sort((a, b) => (a.pid ? 1 : 0) - (b.pid ? 1 : 0));
    for(const b of ordered){
      const parent = b.pid && byId[b.pid] ? byId[b.pid] : null;
      const host = parent ? parent.node : f;
      const ox = parent ? parent.b.cx : 0, oy = parent ? parent.b.cy : 0;
      const isGroup = page.boxes.some(k => k.pid === b.id);
      const n = isGroup ? figma.createFrame() : figma.createRectangle();
      const type = b.read || b.type;
      n.name = NAMES[type] || type || 'Box';
      n.resize(b.cw * UNIT, b.ch * UNIT); n.x = (b.cx - ox) * UNIT; n.y = (b.cy - oy) * UNIT;
      n.fills = [{type: 'SOLID', color: parent ? {r: .95, g: .96, b: .97} : {r: 1, g: 1, b: 1}}];
      n.strokes = [{type: 'SOLID', color: {r: .08, g: .11, b: .13}}]; n.strokeWeight = 2;
      host.appendChild(n);
      if(!isGroup){
        const t = figma.createText(); t.characters = n.name; t.fontSize = 14;
        t.x = n.x + 10; t.y = n.y + 8; host.appendChild(t);
      }
      byId[b.id] = {node: isGroup ? n : host, b: isGroup ? b : (parent ? parent.b : {cx: 0, cy: 0})};
    }
    figma.currentPage.appendChild(f); made.push(f);
    x += COLS * UNIT + 120;
  }
  figma.currentPage.selection = made; figma.viewport.scrollAndZoomIntoView(made);
  return made.length;
}

figma.showUI(__html__, {width: 420, height: 540, themeColors: true});
figma.ui.onmessage = async msg => {
  if(msg.type === 'export'){
    const frames = figma.currentPage.selection.filter(n => n.type === 'FRAME' || n.type === 'COMPONENT' || n.type === 'SECTION');
    if(!frames.length){ figma.ui.postMessage({type: 'error', text: 'Select one or more frames first. Each frame becomes a page.'}); return; }
    const pages = frames.map(frameToPage);
    const sketch = {version: 7, name: figma.root.name || 'From Figma', cols: COLS, theme: '', pages};
    figma.ui.postMessage({type: 'exported', json: JSON.stringify(sketch, null, 2), pages: pages.length, boxes: pages.reduce((n, p) => n + p.boxes.length, 0)});
  }
  if(msg.type === 'import'){
    try{
      const sketch = JSON.parse(msg.json);
      if(!sketch || !Array.isArray(sketch.pages)) throw new Error('That is not a Mirage sketch (export JSON from Mirage).');
      const n = await pagesToFrames(sketch);
      figma.ui.postMessage({type: 'imported', pages: n});
    }catch(err){ figma.ui.postMessage({type: 'error', text: err.message}); }
  }
};
