/* The classifier is the product: these pin what common sketches read as. */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { classify } from '../js/core/classify.js';

const B = (cx,cy,cw,ch,extra) => Object.assign({id:'b'+cx+'_'+cy+'_'+cw+'_'+ch, cx, cy, cw, ch}, extra||{});
const read = (boxes, opts) => classify(boxes, opts).list.map(b => b.merged ? '↳'+b.type : b.type);

const LANDING = [B(0,0,16,2), B(0,2,16,7), B(0,9,5,5), B(5,9,6,5), B(11,9,5,5), B(0,14,8,6), B(8,14,8,6), B(0,20,16,4), B(0,24,16,2)];
test('landing page preset', () => {
  assert.deepEqual(read(LANDING), ['nav','hero','image','text','image','cards','↳cards','banner','footer']);
});
test('hero plus image split', () => {
  assert.deepEqual(read([B(0,0,16,2), B(0,2,9,8), B(9,2,7,8), B(0,10,16,2)]), ['nav','hero','image','footer']);
});
test('docs layout: side rail beside stacked text', () => {
  assert.deepEqual(read([B(0,0,16,2), B(0,2,4,16), B(4,2,12,5), B(4,7,12,5), B(4,12,12,6)]), ['nav','sidebar','hero','text','text']);
});
test('dashboard: rail, toolbar, two panels, wide panel', () => {
  assert.deepEqual(read([B(0,0,16,2), B(0,2,3,16), B(3,2,13,2), B(3,4,6,7), B(9,4,7,7), B(3,11,13,7)]), ['nav','sidebar','stats','image','image','text']);
});
test('three equal boxes in a row become one card grid', () => {
  const {list} = classify([B(0,0,5,5), B(5,0,5,5), B(10,0,5,5)]);
  assert.equal(list[0].type, 'cards'); assert.equal(list[0].cells, 3); assert.ok(list[1].merged && list[2].merged);
});
test('five short equal boxes are a logo row', () => {
  assert.equal(read([B(0,4,3,2), B(3,4,3,2), B(6,4,3,2), B(9,4,3,2), B(12,4,3,2)])[0], 'logos');
});
test('a box set by hand is never re-read', () => {
  const {list} = classify([B(0,0,16,2,{type:'form', locked:true})]);
  assert.equal(list[0].type, 'form'); assert.equal(list[0].conf, 1);
});
test('runner-up readings are offered', () => {
  const {list} = classify(LANDING);
  assert.ok(list[3].alts.length > 0, 'text block has alternatives');
  assert.ok(list[3].alts.every(a => a[0] !== 'text'));
});
test('children are read inside their parent and the parent becomes a group', () => {
  const p = B(0,2,16,7);
  const {list} = classify([B(0,0,16,2), p, B(1,3,7,5,{pid:p.id}), B(9,3,6,5,{pid:p.id})]);
  assert.equal(list[1].type, 'group');
  assert.equal(list[1].kids.length, 1, 'one row inside');
  assert.ok(['hero','text','image'].includes(list[2].type));
  assert.notEqual(list[2].type, 'nav', 'no nav inside a group');
});
test('custom components read after nav, footer and hero', () => {
  const faq = {key:'x_faq', name:'FAQ', template:'<section class="c-x-faq"></section>', rule:{minW:10, minH:6, row:'alone'}};
  const r = read([B(0,0,16,2), B(0,2,16,7), B(0,10,16,7), B(0,17,16,2)], {custom:[faq]});
  assert.deepEqual(r, ['nav','hero','x_faq','footer']);
});
test('custom components never merge into a grid', () => {
  const t = {key:'x_t', name:'T', template:'<div class="c-x-t"></div>', rule:{maxW:5}};
  const {list} = classify([B(0,4,5,4), B(5,4,5,4), B(10,4,5,4)], {custom:[t]});
  assert.ok(list.every(b => b.type==='x_t' && !b.merged));
});
