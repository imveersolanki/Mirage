import { test } from 'node:test';
import assert from 'node:assert/strict';
import { classify } from '../js/core/classify.js';
import { createMarkup } from '../js/core/markup.js';

const mk = (opts={}) => createMarkup({classify: a => classify(a, {custom: opts.custom||[]}), pageNames: () => opts.pages||[],
  links: () => opts.links||null, asset: r => r && r.startsWith('asset:') ? 'assets/'+r.slice(6)+'.jpg' : r, custom: k => (opts.custom||[]).find(c => c.key===k)});
const B = (cx,cy,cw,ch,extra) => Object.assign({id:'b'+cx+'_'+cy, cx, cy, cw, ch}, extra||{});

test('exactly one h1, from the first hero', () => {
  const html = mk().body([B(0,0,16,2), B(0,2,16,7), B(0,9,16,7,{type:'hero', locked:true}), B(0,16,16,2)]);
  assert.equal((html.match(/<h1/g)||[]).length, 1);
  assert.ok(html.includes('<h2>'), 'the second hero uses h2');
});
test('without a hero, the first heading becomes the h1', () => {
  const html = mk().body([B(0,0,16,2), B(0,3,16,5,{type:'text', locked:true}), B(0,9,16,4,{type:'banner', locked:true})]);
  assert.equal((html.match(/<h1/g)||[]).length, 1);
  assert.ok(/<h1>[^<]*How the classifier/.test(html));
});
test('forms export real labelled inputs', () => {
  const html = mk().body([B(0,0,16,6,{type:'form', locked:true})]);
  assert.ok(html.includes('<input type="email" name="email"'));
  assert.ok(html.includes('<span class="vh">'));
  assert.ok(html.includes('<button class="sb" type="submit">'));
});
test('images export with alt text and the asset path', () => {
  const html = mk().body([B(0,0,8,8,{type:'image', locked:true, c:{'img:src':'asset:abc', 'img:alt':'A loaf "of" bread'}})]);
  assert.ok(html.includes('src="assets/abc.jpg"'));
  assert.ok(html.includes('alt="A loaf &quot;of&quot; bread"'));
});
test('text is escaped', () => {
  const html = mk().body([B(0,0,16,2,{c:{brand:'<script>alert(1)</script>'}})]);
  assert.ok(!html.includes('<script>')); assert.ok(html.includes('&lt;script&gt;'));
});
test('responsive flags become classes', () => {
  const html = mk().body([B(0,4,6,6,{hide:['p'], stack:'t', first:true}), B(6,4,10,6,{stack:'t'})]);
  assert.ok(html.includes('c-hide-p')); assert.ok(html.includes('c-stack-t')); assert.ok(html.includes('c-first'));
});
test('edit mode adds editable spans, export mode does not', () => {
  const m = mk(), boxes = [B(0,2,16,7)];
  assert.ok(m.body(boxes, {edit:true}).includes('contenteditable'));
  assert.ok(!m.body(boxes).includes('contenteditable'));
});
test('multi-page nav uses page names and links', () => {
  const html = mk({pages:['Home','Menu'], links:[{name:'Home',href:'index.html'},{name:'Menu',href:'menu.html'}]}).body([B(0,0,16,2)]);
  assert.ok(html.includes('<a href="menu.html">Menu</a>'));
});
test('custom templates fill their fields', () => {
  const c = {key:'x_q', name:'Q', template:'<div class="c-x-q"><b>{{who|Ann}}</b></div>', rule:{auto:false}};
  const html = mk({custom:[c]}).body([B(0,0,16,4,{type:'x_q', locked:true, c:{who:'Bea & Co'}})]);
  assert.ok(html.includes('<b>Bea &amp; Co</b>'));
});
test('react export imports only what it uses and passes changed text', () => {
  const out = mk().react([B(0,0,16,2,{c:{brand:'Crumb'}}), B(0,2,16,7)]);
  assert.ok(out.includes("import { Nav, Hero } from './mirage-ui'"));
  assert.ok(out.includes('t={{"brand":"Crumb"}}'));
});
