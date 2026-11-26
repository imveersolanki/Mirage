/* runs the plugin against a small fake of the Figma API */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs'; import vm from 'node:vm';

function harness(selection){
  const posted = [], created = [];
  const node = (type) => ({type, children:[], visible:true, x:0, y:0, width:0, height:0, name:'',
    resize(w,h){ this.width=w; this.height=h; }, appendChild(c){ this.children.push(c); } });
  const figma = {
    root:{name:'Test file'}, currentPage:{selection, appendChild(){}},
    viewport:{center:{x:0,y:0}, scrollAndZoomIntoView(){}},
    showUI(){}, ui:{postMessage: m => posted.push(m), onmessage:null},
    loadFontAsync: async () => {},
    createFrame(){ const n = node('FRAME'); created.push(n); return n; },
    createRectangle(){ const n = node('RECTANGLE'); created.push(n); return n; },
    createText(){ const n = node('TEXT'); return n; },
  };
  vm.runInNewContext(fs.readFileSync(new URL('../figma-plugin/code.js', import.meta.url), 'utf8'), {figma, __html__:'', Math, JSON, Object});
  return {figma, posted, created};
}
const R = (name, x, y, w, h, kids, type) => ({type: type||(kids?'FRAME':'RECTANGLE'), name, visible:true, absoluteBoundingBox:{x, y, width:w, height:h}, children:kids||[]});

test('frames become pages, layer names become types, nested frames nest', async () => {
  const frame = R('Landing', 0, 0, 960, 1200, [
    R('Nav', 0, 0, 960, 120), R('Top', 0, 120, 960, 420, [R('photo', 60, 180, 400, 300)]), R('Footer', 0, 1080, 960, 120)]);
  const {figma, posted} = harness([frame]);
  await figma.ui.onmessage({type:'export'});
  const sk = JSON.parse(posted[0].json);
  assert.equal(sk.pages[0].name, 'Landing');
  const bx = sk.pages[0].boxes;
  assert.deepEqual(bx.map(b => b.type||null), ['nav', null, 'image', 'footer']);
  assert.equal(bx[0].cw, 16); assert.equal(bx[0].ch, 2);
  assert.equal(bx[2].pid, bx[1].id);
});
test('Mirage JSON becomes named frames', async () => {
  const {figma, posted, created} = harness([]);
  const json = JSON.stringify({pages:[{name:'Home', boxes:[{id:'a',cx:0,cy:0,cw:16,ch:2,read:'nav'},{id:'b',cx:0,cy:2,cw:16,ch:7,read:'group'},{id:'c',cx:1,cy:3,cw:6,ch:4,pid:'b',read:'image'}]}]});
  await figma.ui.onmessage({type:'import', json});
  assert.equal(posted[0].type, 'imported');
  assert.ok(created.some(n => n.name==='Nav bar'));
  const group = created.find(n => n.name==='Group');
  assert.ok(group && group.children.some(n => n.name==='Image'), 'child sits inside its group frame');
});
